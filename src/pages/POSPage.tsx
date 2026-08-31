import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ShoppingCart, Package, Truck, Utensils, ChevronDown, User, Clock, Lock, LogOut, Power, CreditCard, Receipt } from 'lucide-react';
import { supabase, forceCloseApp } from '../lib/supabase';
import { buildSaleReceiptHtml, buildCombinedKitchenAndReceiptHtml, printViaIframe } from '../lib/printUtils';
import { useRealtimeTable } from '../lib/useRealtimeTable';
import { POSProvider, usePOS } from '../context/POSContext';
import { useTenant } from '../context/TenantContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { CategoryBar } from '../components/pos/CategoryBar';
import { ProductGrid } from '../components/pos/ProductGrid';
import { CartPanel } from '../components/pos/CartPanel';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { TablePickerModal } from '../components/pos/TablePickerModal';
import { CustomerPickerModal } from '../components/pos/CustomerPickerModal';
import { PendingTicketsModal } from '../components/pos/PendingTicketsModal';
import { CashClosureModal } from '../components/pos/CashClosureModal';
import { SalesHistoryModal } from '../components/pos/SalesHistoryModal';
import type { Category, Product, SaleType, CashSession } from '../types/database';

const saleTypes: { id: SaleType; label: string; icon: typeof Utensils }[] = [
  { id: 'delivery', label: 'Vente directe', icon: Truck },
  { id: 'dine_in',  label: 'Sur place',     icon: Utensils },
  { id: 'takeaway', label: 'Commandes client', icon: Package },
];

function POSInner() {
  const {
    cart, itemCount, clearCart, saleType, setSaleType,
    tableNumber, setTableNumber,
    selectedCustomer, setSelectedCustomer, customerName,
    isPendingResume, total: usePOSTotal,
    subtotal, taxAmount, discountAmount,
    orderNotes,
  } = usePOS();
  const { settings } = useSettings();
  const { currentUser, lockSession, logout } = useAuth();
  const { currentSite, authUser, isSiteManager } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showPendingTickets, setShowPendingTickets] = useState(false);
  const [showCashClosure, setShowCashClosure] = useState(false);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [sessionOpenedAt, setSessionOpenedAt] = useState<string>('');
  const [pendingCount, setPendingCount] = useState(0);

  // Load session opening time from the last closed session
  useEffect(() => {
    async function loadSessionStart() {
      if (!siteId) return;
      const { data } = await supabase
        .from('cash_sessions')
        .select('closed_at')
        .eq('site_id', siteId)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.closed_at) {
        setSessionOpenedAt(data.closed_at);
        localStorage.setItem(`pos_session_opened_${siteId}`, data.closed_at);
      } else {
        // No prior session: use a far-back date to capture all sales
        const fallback = '2020-01-01T00:00:00.000Z';
        setSessionOpenedAt(fallback);
        localStorage.setItem(`pos_session_opened_${siteId}`, fallback);
      }
    }
    // Try localStorage first for instant display, then validate from DB
    const cached = siteId ? localStorage.getItem(`pos_session_opened_${siteId}`) : null;
    if (cached) setSessionOpenedAt(cached);
    loadSessionStart();
  }, [siteId]);

  const loadData = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').eq('site_id', siteId).eq('is_active', true).order('sort_order'),
      supabase.from('products').select('*').eq('site_id', siteId).or('is_available.eq.true,track_stock.eq.false').order('name'),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    setLoading(false);
  }, [siteId]);

  const loadPendingCount = useCallback(async () => {
    if (!siteId) return;
    const { count } = await supabase.from('sales').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('site_id', siteId);
    setPendingCount(count ?? 0);
  }, [siteId]);

  useEffect(() => { loadData(); loadPendingCount(); }, [loadData, loadPendingCount]);

  useRealtimeTable<Product>({
    table: 'products',
    siteId,
    onInsert: (row) => { if (row.is_available || !row.track_stock) setProducts(p => p.some(x => x.id === row.id) ? p : [...p, row].sort((a, b) => a.name.localeCompare(b.name))); },
    onUpdate: (row) => setProducts(p => {
      const without = p.filter(x => x.id !== row.id);
      return (row.is_available || !row.track_stock) ? [...without, row].sort((a, b) => a.name.localeCompare(b.name)) : without;
    }),
    onDelete: (row) => setProducts(p => p.filter(x => x.id !== row.id)),
  });

  useRealtimeTable<Category>({
    table: 'categories',
    siteId,
    onInsert: (row) => { if (row.is_active) setCategories(c => c.some(x => x.id === row.id) ? c : [...c, row].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))); },
    onUpdate: (row) => setCategories(c => {
      const without = c.filter(x => x.id !== row.id);
      return row.is_active ? [...without, row].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) : without;
    }),
    onDelete: (row) => setCategories(c => c.filter(x => x.id !== row.id)),
  });

  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCategoryId) list = list.filter(p => p.category_id === selectedCategoryId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategoryId, search]);

  function handlePaymentSuccess(result: { sale: { sale_number: string; created_at: string }; items: { quantity: number; product_name: string; unit_price: number; subtotal: number; variant_label?: string | null; sauces?: { name: string; price_supplement?: number }[] | null }[]; payments: { method: string; amount: number }[] }) {
    setShowPayment(false);
    if (settings.auto_print_receipt) {
      const receiptData = {
        saleNumber: result.sale.sale_number,
        createdAt: result.sale.created_at,
        saleType,
        tableNumber,
        cashierName: currentUser?.name ?? null,
        customerName: selectedCustomer ? selectedCustomer.name : customerName,
        items: result.items,
        payments: result.payments,
        subtotal,
        taxAmount,
        discountAmount,
        total: usePOSTotal,
      };
      const html = settings.print_kitchen_with_receipt
        ? buildCombinedKitchenAndReceiptHtml(
            {
              createdAt: result.sale.created_at,
              saleType,
              tableNumber,
              cashierName: currentUser?.name ?? null,
              customerName: selectedCustomer ? selectedCustomer.name : customerName,
              orderNotes,
              items: cart.map(item => ({
                quantity: item.quantity,
                product_name: item.product.name,
                variant_label: item.variant_label,
                sauces: item.sauces,
                kitchen_note: item.kitchen_note,
              })),
            },
            receiptData,
            settings
          )
        : buildSaleReceiptHtml(receiptData, settings);
      printViaIframe(html);
      clearCart();
      setShowCartMobile(false);
      return;
    }
    setShowReceipt(true);
  }
  function handleNewSale() { setShowReceipt(false); clearCart(); setShowCartMobile(false); }
  function handleDeferred() {
    setShowPayment(false);
    setShowCartMobile(false);
    clearCart();
    loadPendingCount();
  }
  function handlePendingResumed() {
    setShowPendingTickets(false);
    loadPendingCount();
    setShowPayment(true);
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function handleSaleTypeClick(id: SaleType) {
    setSaleType(id);
    if (id === 'dine_in') setShowTablePicker(true);
    if (id === 'takeaway') setShowCustomerPicker(true);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-950">
      {/* POS Top Bar */}
      <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900/80 border-b border-white/8">
        {/* Search */}
        <div className="flex-1 relative max-w-full sm:max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-white/8 border border-white/10 rounded-xl pl-8 pr-8 py-1.5 sm:py-2 text-sm placeholder-white/30 focus:outline-none focus:border-blue-500/40 transition-all"
            style={{ color: '#ffffff' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Sale type selector */}
        <div className={`flex gap-0.5 sm:gap-1 bg-white/5 p-0.5 sm:p-1 rounded-xl border border-white/8 ${isPendingResume ? 'pointer-events-none opacity-50' : ''}`}>
          {saleTypes.map(t => {
            const Icon = t.icon;
            const active = saleType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSaleTypeClick(t.id)}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all
                  ${active ? 'text-white shadow-md' : 'text-white/50 hover:text-white/80'}`}
                style={active ? {
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: '0 4px 10px color-mix(in srgb, var(--color-primary) 25%, transparent)',
                } : undefined}
              >
                <Icon size={12} className="sm:hidden" />
                <Icon size={13} className="hidden sm:block" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pending tickets button */}
        <button
          onClick={() => setShowPendingTickets(true)}
          className="relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-medium transition-all flex-shrink-0
            bg-amber-500/8 border-amber-500/25 text-amber-400 hover:bg-amber-500/15"
        >
          <Clock size={12} className="sm:hidden" />
          <Clock size={13} className="hidden sm:block" />
          <span className="hidden sm:inline">En attente</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>

        {/* Sales history / cancel button */}
        <button
          onClick={() => setShowSalesHistory(true)}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-medium transition-all flex-shrink-0
            bg-white/4 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
          title="Historique / Annulations"
        >
          <Receipt size={12} className="sm:hidden" />
          <Receipt size={13} className="hidden sm:block" />
          <span className="hidden sm:inline">Ventes</span>
        </button>

        {/* Table badge (dine_in) */}
        {saleType === 'dine_in' && (
          <button
            onClick={() => !isPendingResume && setShowTablePicker(true)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-medium transition-all flex-shrink-0
              ${isPendingResume ? 'opacity-50 cursor-default' : ''}
              ${tableNumber
                ? 'bg-blue-600/15 border-blue-500/40 text-blue-300 hover:bg-blue-600/25'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
          >
            <Utensils size={11} className="flex-shrink-0" />
            <span className="hidden sm:inline">{tableNumber ? tableNumber : 'Table...'}</span>
            <ChevronDown size={10} className="opacity-60" />
          </button>
        )}

        {/* Customer badge (takeaway) */}
        {saleType === 'takeaway' && (
          <button
            onClick={() => !isPendingResume && setShowCustomerPicker(true)}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-medium transition-all flex-shrink-0 max-w-[120px] sm:max-w-[160px]
              ${isPendingResume ? 'opacity-50 cursor-default' : ''}
              ${selectedCustomer
                ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/25'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
          >
            <User size={11} className="flex-shrink-0" />
            <span className="hidden sm:inline truncate">
              {selectedCustomer ? selectedCustomer.name : 'Client...'}
            </span>
            <ChevronDown size={10} className="opacity-60 flex-shrink-0" />
          </button>
        )}

        {/* Cash closure button */}
        <button
          onClick={() => setShowCashClosure(true)}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-medium transition-all flex-shrink-0
            bg-white/4 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
          title="Fermeture de caisse"
        >
          <Lock size={12} className="sm:hidden" />
          <Lock size={13} className="hidden sm:block" />
          <span className="hidden sm:inline">Fermeture</span>
        </button>

        {/* User avatar + menu */}
        <div ref={userMenuRef} className="relative flex items-center gap-2 flex-shrink-0 border-l border-white/8 pl-2 sm:pl-3">
          <div className="text-right hidden md:block">
            <p className="text-white text-xs font-medium leading-tight">{currentUser?.name ?? authUser?.email ?? '—'}</p>
            <p className="text-white/30 text-[10px]">{currentUser?.role?.label ?? (isSiteManager ? 'Gestionnaire' : 'Propriétaire')}</p>
          </div>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
              color: 'var(--color-primary)',
            }}
          >
            {currentUser ? getInitials(currentUser.name) : (authUser?.email?.[0] ?? '?').toUpperCase()}
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-white text-xs font-semibold truncate">{currentUser?.name ?? authUser?.email ?? '—'}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">{currentUser?.role?.label ?? (isSiteManager ? 'Gestionnaire' : 'Propriétaire')}</p>
                </div>
                {/* Actions */}
                <div className="p-1.5 space-y-0.5">
                  {currentUser && (
                    <button
                      onClick={() => { setShowUserMenu(false); lockSession(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-500/10 text-xs font-medium transition-all text-left"
                    >
                      <Lock size={13} />
                      Verrouiller
                    </button>
                  )}
                  <button
                    onClick={() => { setShowUserMenu(false); logout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-blue-400 hover:bg-blue-500/10 text-xs font-medium transition-all text-left"
                  >
                    <LogOut size={13} />
                    Changer de compte
                  </button>
                  <div className="border-t border-white/8 my-1" />
                  <button
                    onClick={() => { setShowUserMenu(false); forceCloseApp(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-300 hover:bg-red-500/15 text-xs font-medium transition-all text-left"
                  >
                    <Power size={13} />
                    Fermer l'application
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: products panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-shrink-0 px-3 sm:px-4 pt-2 sm:pt-3 pb-1.5 sm:pb-2">
            <CategoryBar
              categories={categories}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />
          </div>
          {/* Extra bottom padding on mobile so products aren't hidden behind cart bar */}
          <div className={`flex-1 overflow-y-auto px-3 sm:px-4 scrollbar-thin ${itemCount > 0 ? 'pb-24 lg:pb-4' : 'pb-3 sm:pb-4'}`}>
            <ProductGrid products={filteredProducts} loading={loading} />
          </div>
        </div>

        {/* Right: cart panel (desktop only) */}
        <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
          <CartPanel onCheckout={() => setShowPayment(true)} />
        </div>
      </div>

      {/* Mobile/tablet sticky cart bar */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2"
            style={{ background: 'linear-gradient(to top, rgba(3,7,18,0.98) 70%, transparent)' }}
          >
            <div
              className="flex items-center gap-3 bg-gray-900 border border-white/12 rounded-2xl px-4 py-3 shadow-2xl"
              style={{ boxShadow: '0 -4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}
            >
              {/* Cart icon + count */}
              <button
                onClick={() => setShowCartMobile(true)}
                className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
              >
                <ShoppingCart size={18} style={{ color: 'var(--color-primary)' }} />
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
                  style={{ backgroundColor: 'var(--color-primary)' }}>
                  {itemCount}
                </span>
              </button>

              {/* Items summary */}
              <button
                onClick={() => setShowCartMobile(true)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-white text-xs font-semibold truncate">
                  {itemCount} article{itemCount > 1 ? 's' : ''}
                </p>
                <p className="text-white/40 text-[10px] mt-0.5">Appuyer pour voir le panier</p>
              </button>

              {/* Total + checkout */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className="text-white/40 text-[9px]">Total</p>
                  <p className="font-black text-base leading-tight" style={{ color: 'var(--color-primary)' }}>
                    {usePOSTotal.toLocaleString('fr-FR')}
                    <span className="text-xs font-medium ml-1 opacity-70">{settings.currency_symbol}</span>
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowPayment(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-lg"
                  style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
                >
                  <CreditCard size={14} />
                  Encaisser
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile cart drawer */}
      <AnimatePresence>
        {showCartMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartMobile(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="lg:hidden fixed left-0 right-0 bottom-0 z-50 rounded-t-3xl overflow-hidden"
              style={{ maxHeight: '85vh' }}
            >
              {/* Drag handle */}
              <div className="absolute top-0 left-0 right-0 flex justify-center pt-2 pb-1 z-10 bg-gray-900">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="pt-6 h-full" style={{ maxHeight: '85vh' }}>
                <CartPanel onCheckout={() => { setShowCartMobile(false); setShowPayment(true); }} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTablePicker && (
          <TablePickerModal
            selectedTable={tableNumber}
            onSelect={setTableNumber}
            onClose={() => setShowTablePicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomerPicker && (
          <CustomerPickerModal
            selectedCustomer={selectedCustomer}
            onSelect={setSelectedCustomer}
            onClose={() => setShowCustomerPicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPayment && (
          <PaymentModal
            onClose={() => setShowPayment(false)}
            onSuccess={handlePaymentSuccess}
            onDeferred={handleDeferred}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPendingTickets && (
          <PendingTicketsModal
            onClose={() => setShowPendingTickets(false)}
            onResumed={handlePendingResumed}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReceipt && (
          <ReceiptModal onClose={handleNewSale} onNewSale={handleNewSale} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCashClosure && sessionOpenedAt && (
          <CashClosureModal
            openedAt={sessionOpenedAt}
            onClose={() => setShowCashClosure(false)}
            onClosed={(_session: CashSession) => {
              setShowCashClosure(false);
              const now = new Date().toISOString();
              setSessionOpenedAt(now);
              if (siteId) localStorage.setItem(`pos_session_opened_${siteId}`, now);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSalesHistory && (
          <SalesHistoryModal onClose={() => setShowSalesHistory(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export function POSPage() {
  const { settings } = useSettings();
  return (
    <POSProvider taxRate={settings.tax_rate}>
      <POSInner />
    </POSProvider>
  );
}
