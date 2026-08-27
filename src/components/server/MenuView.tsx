import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  Search, Plus, X, Minus, Image, StickyNote,
  CheckCircle, Receipt, Printer, AlertCircle,
  Star, ChevronLeft, UtensilsCrossed, Wifi, WifiOff,
  ShoppingCart, Trash2, ChevronUp, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Category, Product, ProductOption, ProductVariant, PrintStation } from '../../lib/types';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useFeedback } from '../../hooks/useFeedback';
import { showToast } from '../shared/Toast';
import {
  buildPrintGroupsFromOrderItems,
  createPrintJobs,
  markItemsAsPrinted,
  dispatchOrderPrint,
  buildBillPrintGroup,
  logPrintJobs,
} from '../../lib/printService';
import { useOfflineQueue, PendingOrder } from '../../hooks/useOfflineQueue';

const FAVORITES_KEY = 'restobar_favorites';

function stationsSuffix(stations: PrintStation[]): string {
  const hasBar = stations.includes('bar');
  const hasKitchen = stations.includes('kitchen');
  if (hasBar && hasKitchen) return 'en cuisine et au bar';
  if (hasBar) return 'au bar';
  if (hasKitchen) return 'en cuisine';
  return "à l'impression";
}

interface ProductCardProps {
  p: Product;
  isFlashing: boolean;
  isFav: boolean;
  inCartQty: number;
  disabled: boolean;
  onTap: (p: Product) => void;
  onQuickAdd: (p: Product, e: React.MouseEvent) => void;
  onToggleFav: (id: string, e: React.MouseEvent) => void;
}

const ProductCard = memo(function ProductCard({
  p, isFlashing, isFav, inCartQty, disabled, onTap, onQuickAdd, onToggleFav,
}: ProductCardProps) {
  return (
    <button
      onClick={() => onTap(p)}
      disabled={disabled}
      className={`relative rounded-xl border-2 overflow-hidden text-left transition-all active:scale-[0.96] disabled:opacity-50 shadow-sm ${isFlashing ? 'border-amber-400 ring-2 ring-amber-300/40' : inCartQty > 0 ? 'border-green-400' : 'border-transparent'}`}
      style={{ aspectRatio: '3/4' }}
    >
      <div className="absolute inset-0">
        {p.image_url ? (
          <img src={p.image_url} alt={p.nom} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-300">
            <UtensilsCrossed size={22} />
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent pt-8 pb-1.5 px-1.5">
        <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 drop-shadow">{p.nom}</p>
        <span className="text-[11px] font-black text-amber-300 drop-shadow">{p.prix.toLocaleString('fr-FR')} F</span>
      </div>
      <button
        onClick={(e) => onToggleFav(p.id, e)}
        className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center bg-black/35 backdrop-blur-sm"
      >
        <Star size={10} className={isFav ? 'text-amber-400' : 'text-white/60'} fill={isFav ? 'currentColor' : 'none'} />
      </button>
      {inCartQty > 0 && (
        <div className="absolute top-1 right-1 min-w-[20px] h-5 rounded-full bg-green-500 flex items-center justify-center shadow px-1">
          <span className="text-white text-[10px] font-black">{inCartQty}</span>
        </div>
      )}
      <button
        onClick={(e) => onQuickAdd(p, e)}
        disabled={disabled}
        className="absolute bottom-1 right-1 w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500 active:bg-amber-600 active:scale-90 transition-all disabled:opacity-40 shadow-md"
      >
        <Plus size={14} className="text-white" strokeWidth={3} />
      </button>
    </button>
  );
});

function loadFavorites(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveFavorites(fav: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...fav]));
}

interface Props { onOrderPlaced: () => void; }

export default function MenuView({ onOrderPlaced }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, ProductVariant>>({});
  const [actionLoading, setActionLoading] = useState<'validate' | 'addition' | 'addons' | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [unprintedInfo, setUnprintedInfo] = useState<{
    hasUnprinted: boolean; orderId: string | null; ticketNumber: string; total: number;
  }>({ hasUnprinted: false, orderId: null, ticketNumber: '', total: 0 });
  const [flashedId, setFlashedId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [expandedNoteIdx, setExpandedNoteIdx] = useState<number | null>(null);
  const submittingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { addToCart, activeTable, cartCount, cart, clearCart, cartTotal, updateQty, removeFromCart } = useCart();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { feedback } = useFeedback();

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  };

  const processPendingOrder = useCallback(async (order: PendingOrder): Promise<boolean> => {
    try {
      const result = await dispatchOrderPrint({
        cart: order.cart,
        tableId: order.table.id,
        tableNom: order.table.nom,
        userId: order.userId,
        type: 'INITIAL',
        waitForCashier: false,
      });
      return result.missingCategories.length === 0;
    } catch { return false; }
  }, []);

  const { queue: offlineQueue, isOnline, syncing, enqueue } = useOfflineQueue(processPendingOrder);

  useEffect(() => { fetchMenu(); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const checkUnprinted = useCallback(async () => {
    if (!activeTable) {
      setUnprintedInfo({ hasUnprinted: false, orderId: null, ticketNumber: '', total: 0 });
      return;
    }
    const { data: order } = await supabase
      .from('orders')
      .select('id, ticket_number, total, items:order_items(id, qty, printed_qty)')
      .eq('table_id', activeTable.id)
      .in('statut', ['BROUILLON', 'VALIDE'])
      .maybeSingle();
    if (!order) {
      setUnprintedInfo({ hasUnprinted: false, orderId: null, ticketNumber: '', total: 0 });
      return;
    }
    const hasUnprinted = (order.items || []).some((i: any) => i.qty > i.printed_qty);
    setUnprintedInfo({
      hasUnprinted,
      orderId: order.id,
      ticketNumber: order.ticket_number || '',
      total: order.total || 0,
    });
  }, [activeTable]);

  useEffect(() => {
    checkUnprinted();
    const channel = supabase
      .channel('menu_unprinted')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, checkUnprinted)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [checkUnprinted]);

  const fetchMenu = async () => {
    const [catsRes, prodsRes] = await Promise.all([
      supabase.from('categories').select('*').eq('actif', true).order('ordre'),
      supabase.from('products')
        .select('*, category:categories!category_id(nom), options:product_options(*), variant_groups:product_variant_groups(*, variants:product_variants(*))')
        .eq('actif', true)
        .order('nom'),
    ]);
    setCategories(catsRes.data || []);
    setProducts(prodsRes.data || []);
    setLoading(false);
  };

  const flashProduct = (id: string) => {
    setFlashedId(id);
    setTimeout(() => setFlashedId(null), 300);
  };

  const toggleFavorite = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    vibrate(20);
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const handleProductTap = useCallback((p: Product) => {
    if (!activeTable) return;
    const hasOptions = p.options && p.options.length > 0;
    const hasVariants = p.variant_groups && p.variant_groups.length > 0;
    if (settings.expressMode || (!hasOptions && !hasVariants)) {
      addToCart(p, 1, '', []);
      feedback('add');
      vibrate(30);
      flashProduct(p.id);
    } else {
      openModal(p);
    }
  }, [activeTable, settings.expressMode, addToCart, feedback]);

  const handleQuickAdd = useCallback((p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeTable) return;
    addToCart(p, 1, '', []);
    feedback('add');
    vibrate(30);
    flashProduct(p.id);
  }, [activeTable, addToCart, feedback]);

  const openModal = (p: Product) => {
    const defaultVariants: Record<string, ProductVariant> = {};
    if (p.variant_groups) {
      for (const group of p.variant_groups) {
        const def = (group.variants || []).find(v => v.default_selected && v.actif);
        if (def) defaultVariants[group.id] = def;
      }
    }
    setModalProduct(p); setQty(1); setNotes(''); setSelectedOptions([]); setSelectedVariants(defaultVariants);
  };

  const toggleOption = (opt: ProductOption) => {
    setSelectedOptions(prev =>
      prev.some(o => o.id === opt.id) ? prev.filter(o => o.id !== opt.id) : [...prev, opt]
    );
  };

  const handleAdd = () => {
    if (!modalProduct) return;
    addToCart(modalProduct, qty, notes, selectedOptions, selectedVariants);
    feedback('add');
    vibrate(30);
    flashProduct(modalProduct.id);
    setModalProduct(null);
  };

  const filtered = useMemo(() => {
    const parentCats = categories.filter(c => !c.parent_id);
    return products.filter(p => {
      const matchSearch = !debouncedSearch || p.nom.toLowerCase().includes(debouncedSearch.toLowerCase());
      let matchCat = activeCategory === 'all';
      if (!matchCat) {
        const isParent = parentCats.some(c => c.id === activeCategory);
        if (isParent) {
          const childIds = categories.filter(c => c.parent_id === activeCategory).map(c => c.id);
          matchCat = p.category_id === activeCategory || childIds.includes(p.category_id);
        } else {
          matchCat = p.category_id === activeCategory;
        }
      }
      const matchFav = !showFavOnly || favorites.has(p.id);
      return matchSearch && matchCat && matchFav;
    });
  }, [products, categories, debouncedSearch, activeCategory, showFavOnly, favorites]);

  const itemPrice = modalProduct
    ? (modalProduct.prix
        + selectedOptions.reduce((s, o) => s + o.prix_delta, 0)
        + Object.values(selectedVariants).reduce((s, v) => s + v.prix_delta, 0)
      ) * qty
    : 0;

  const handleValidate = async () => {
    if (!activeTable || cart.length === 0 || submittingRef.current) return;
    submittingRef.current = true;

    if (!isOnline) {
      enqueue({ table: activeTable, cart: [...cart], userId: user?.id || '' });
      clearCart();
      setCartOpen(false);
      vibrate([30, 50, 30]);
      showToast('Commande sauvegardée hors ligne', 'success');
      onOrderPlaced();
      submittingRef.current = false;
      return;
    }

    setActionLoading('validate');
    setPrintError(null);

    const cartSnapshot = [...cart];
    clearCart();
    setCartOpen(false);
    vibrate([30, 50, 80]);
    feedback('print');
    onOrderPlaced();

    dispatchOrderPrint({
      cart: cartSnapshot,
      tableId: activeTable.id,
      tableNom: activeTable.nom,
      userId: user?.id || '',
      type: 'INITIAL',
      waitForCashier: false,
    }).then(result => {
      if (result.missingCategories.length > 0) {
        setPrintError(`Catégories sans imprimante : ${result.missingCategories.join(', ')}`);
      }
      showToast(`Commande envoyée ${stationsSuffix(result.stations)}`, 'print');
    }).catch(err => {
      console.error('handleValidate error:', err);
      setPrintError('Erreur lors de l\'envoi de la commande');
    }).finally(() => {
      setActionLoading(null);
      submittingRef.current = false;
    });
  };

  const handleImprimeAjouts = async () => {
    if (!unprintedInfo.orderId || submittingRef.current) return;
    submittingRef.current = true;
    setActionLoading('addons');

    try {
      const { groups, missingCategories } = await buildPrintGroupsFromOrderItems(unprintedInfo.orderId, true);
      if (missingCategories.length > 0) {
        setPrintError(`Catégories sans imprimante : ${missingCategories.join(', ')}`);
        return;
      }

      const { data: unprintedItems } = await supabase
        .from('order_items')
        .select('id, qty, printed_qty')
        .eq('order_id', unprintedInfo.orderId);
      const toMark = (unprintedItems || []).filter(i => i.qty > i.printed_qty).map(i => i.id);

      await createPrintJobs(groups, {
        orderId: unprintedInfo.orderId,
        tableId: activeTable!.id,
        tableNom: activeTable!.nom,
        ticketNumber: unprintedInfo.ticketNumber,
        userId: user?.id || '',
        type: 'ADDONS',
      }, false);

      await markItemsAsPrinted(toMark);

      const stations = Array.from(new Set(groups.map(g => g.station)));
      vibrate([30, 50, 80]);
      feedback('print');
      showToast(`Ajouts envoyés ${stationsSuffix(stations)}`, 'print');
      setUnprintedInfo(u => ({ ...u, hasUnprinted: false }));
    } catch (err) {
      console.error('handleImprimeAjouts error:', err);
      setPrintError('Erreur lors de l\'impression des ajouts');
    } finally {
      setActionLoading(null);
      submittingRef.current = false;
    }
  };

  const handleAddition = async () => {
    if (!activeTable || submittingRef.current) return;
    submittingRef.current = true;
    setActionLoading('addition');
    setPrintError(null);

    try {
      let orderId = unprintedInfo.orderId;
      let ticketNumber = unprintedInfo.ticketNumber;
      let orderTotal = unprintedInfo.total;

      if (cart.length > 0) {
        const result = await dispatchOrderPrint({
          cart: [...cart],
          tableId: activeTable.id,
          tableNom: activeTable.nom,
          userId: user?.id || '',
          type: 'INITIAL',
          existingOrderId: orderId || undefined,
          existingTicketNumber: ticketNumber || undefined,
          waitForCashier: false,
        });

        if (result.missingCategories.length > 0) {
          setPrintError(`Catégories sans imprimante : ${result.missingCategories.join(', ')}`);
          return;
        }

        orderId = result.orderId;
        ticketNumber = result.ticketNumber;
        clearCart();
        setCartOpen(false);
      }

      if (!orderId) {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, ticket_number, total')
          .eq('table_id', activeTable.id)
          .in('statut', ['BROUILLON', 'VALIDE'])
          .maybeSingle();
        orderId = existingOrder?.id || null;
        ticketNumber = existingOrder?.ticket_number || '';
        orderTotal = existingOrder?.total || 0;
      }

      if (orderId) {
        await supabase.from('orders').update({ statut: 'VALIDE', updated_at: new Date().toISOString() }).eq('id', orderId);
      }
      await supabase.from('tables').update({ statut: 'A_ENCAISSER' }).eq('id', activeTable.id);

      if (orderId) {
        const { group: billGroup, error: billErr } = await buildBillPrintGroup(orderId, activeTable.nom);
        if (!billErr && billGroup) {
          await logPrintJobs([billGroup], {
            orderId,
            tableId: activeTable.id,
            tableNom: activeTable.nom,
            ticketNumber,
            userId: user?.id || '',
            type: 'BILL',
            total: orderTotal,
          });
        }
      }

      vibrate([30, 50, 80]);
      feedback('print');
      showToast('Addition demandée', 'success');
      onOrderPlaced();
    } catch (err) {
      console.error('handleAddition error:', err);
      setPrintError('Erreur lors de la demande d\'addition');
    } finally {
      setActionLoading(null);
      submittingRef.current = false;
    }
  };

  const hasCart = cart.length > 0;
  const isOccupied = activeTable?.statut === 'OCCUPEE' || activeTable?.statut === 'SERVIE';
  const showActionBar = activeTable && (hasCart || isOccupied || unprintedInfo.hasUnprinted);

  return (
    <div className="flex flex-col pb-52">
      {(offlineQueue.length > 0 || !isOnline) && (
        <div className={`mx-4 mt-3 rounded-2xl px-4 py-2.5 flex items-center gap-2 ${isOnline ? 'bg-amber-50 border border-amber-200' : 'bg-gray-800'}`}>
          {isOnline ? (
            <>
              <Wifi size={14} className="text-amber-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-700">
                {syncing ? 'Synchronisation...' : `${offlineQueue.length} commande(s) hors ligne`}
              </span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-white flex-shrink-0" />
              <span className="text-xs font-semibold text-white">Mode hors ligne</span>
            </>
          )}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-gray-50 px-3 pt-2 pb-2 space-y-1.5 shadow-sm">
        {!activeTable && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 text-sm text-amber-800 font-semibold flex items-center gap-2">
            <UtensilsCrossed size={15} className="text-amber-500" />
            Sélectionnez une table
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 w-full">
          <button
            onClick={() => { setActiveCategory('all'); setShowFavOnly(false); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${activeCategory === 'all' && !showFavOnly ? 'bg-gray-900 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            Tout
          </button>
          <button
            onClick={() => { setShowFavOnly(f => !f); setActiveCategory('all'); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${showFavOnly ? 'bg-amber-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            <Star size={10} fill={showFavOnly ? 'white' : 'none'} />
            Favoris
          </button>
          {categories.filter(c => !c.parent_id).map(c => {
            const subs = categories.filter(s => s.parent_id === c.id);
            const isParentActive = activeCategory === c.id || subs.some(s => s.id === activeCategory);
            return (
              <div key={c.id} className="contents">
                <button
                  onClick={() => { setActiveCategory(c.id); setShowFavOnly(false); }}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${activeCategory === c.id && !showFavOnly ? 'bg-gray-900 text-white shadow-sm' : isParentActive ? 'bg-gray-200 text-gray-800' : 'bg-white border border-gray-200 text-gray-600'}`}
                >
                  {c.nom}
                </button>
                {isParentActive && subs.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => { setActiveCategory(sub.id); setShowFavOnly(false); }}
                    className={`px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-all ${activeCategory === sub.id && !showFavOnly ? 'bg-gray-700 text-white shadow-sm' : 'bg-white border border-gray-300 text-gray-500'}`}
                  >
                    › {sub.nom}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-9 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {printError && (
        <div className="mx-4 mb-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-red-700">Erreur impression</p>
            <p className="text-xs text-red-600 mt-0.5">{printError}</p>
          </div>
          <button onClick={() => setPrintError(null)} className="text-red-400"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-2 pb-4">
          <div className="grid grid-cols-3 min-[400px]:grid-cols-4 min-[560px]:grid-cols-5 gap-2">
            {filtered.map(p => {
              const inCart = cart.find(c => c.product.id === p.id);
              return (
                <ProductCard
                  key={p.id}
                  p={p}
                  isFlashing={flashedId === p.id}
                  isFav={favorites.has(p.id)}
                  inCartQty={inCart?.qty ?? 0}
                  disabled={!activeTable}
                  onTap={handleProductTap}
                  onQuickAdd={handleQuickAdd}
                  onToggleFav={toggleFavorite}
                />
              );
            })}
          </div>
          {filtered.length === 0 && !loading && (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-sm">
                {showFavOnly ? 'Aucun favori' : 'Aucun produit trouve'}
              </p>
            </div>
          )}
        </div>
      )}

      {showActionBar && (
        <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4 pointer-events-none">
          <div className="max-w-2xl mx-auto space-y-2 pointer-events-auto">
            {unprintedInfo.hasUnprinted && !hasCart && (
              <button
                onClick={handleImprimeAjouts}
                disabled={!!actionLoading}
                className="w-full bg-blue-500 active:bg-blue-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl"
              >
                {actionLoading === 'addons'
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Printer size={18} />}
                Imprimer ajouts
              </button>
            )}

            {hasCart && (
              <button
                onClick={() => setCartOpen(o => !o)}
                className="w-full bg-gray-900 active:bg-gray-800 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-between px-5 transition-all shadow-xl"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart size={17} />
                  <span className="font-semibold">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-amber-400">{cartTotal.toLocaleString('fr-FR')} F</span>
                  {cartOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </button>
            )}

            {hasCart && (
              <button
                onClick={handleValidate}
                disabled={!!actionLoading}
                className="w-full bg-green-500 active:bg-green-600 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl"
              >
                {actionLoading === 'validate'
                  ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <CheckCircle size={22} strokeWidth={2.5} />}
                ENVOYER COMMANDE
              </button>
            )}

            {isOccupied && !hasCart && (
              <button
                onClick={handleAddition}
                disabled={!!actionLoading}
                className="w-full bg-rose-500 active:bg-rose-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl"
              >
                {actionLoading === 'addition'
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Receipt size={18} />}
                Demander addition
              </button>
            )}
          </div>
        </div>
      )}

      {cartOpen && hasCart && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={() => setCartOpen(false)}>
          <div
            className="bg-white rounded-t-3xl shadow-2xl max-h-[78vh] flex flex-col max-w-2xl mx-auto w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-amber-500" />
                <h3 className="font-black text-gray-900">Panier · {activeTable?.nom}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={clearCart} className="flex items-center gap-1 text-xs text-rose-500 font-semibold px-2 py-1">
                  <Trash2 size={12} /> Vider
                </button>
                <button onClick={() => setCartOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {cart.map((item, index) => {
                const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
                const variantTotal = item.selectedVariants ? Object.values(item.selectedVariants).reduce((s, v) => s + v.prix_delta, 0) : 0;
                const lineTotal = (item.product.prix + optTotal + variantTotal) * item.qty;
                const isNoteOpen = expandedNoteIdx === index;
                const variantNames = item.selectedVariants ? Object.values(item.selectedVariants).map(v => v.nom) : [];
                const displayName = variantNames.length > 0
                  ? `${item.product.nom} - ${variantNames.join(', ')}`
                  : item.product.nom;

                return (
                  <div key={index} className="bg-gray-50 rounded-2xl overflow-hidden">
                    <div className="flex items-start gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm leading-snug">{displayName}</p>
                        {item.selectedOptions.length > 0 && (
                          <p className="text-xs text-amber-600 font-medium mt-0.5">{item.selectedOptions.map(o => o.nom).join(', ')}</p>
                        )}
                        {item.notes && !isNoteOpen && (
                          <p className="text-xs text-gray-400 italic mt-0.5 truncate">"{item.notes}"</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setExpandedNoteIdx(isNoteOpen ? null : index)}
                          className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isNoteOpen || item.notes ? 'text-amber-500 bg-amber-50' : 'text-gray-300'}`}
                        >
                          <StickyNote size={14} />
                        </button>
                        <button onClick={() => removeFromCart(index)} className="w-8 h-8 flex items-center justify-center text-rose-400 rounded-xl">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {isNoteOpen && (
                      <div className="px-3 pb-3 -mt-1">
                        <textarea
                          defaultValue={item.notes}
                          rows={2}
                          className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400 bg-amber-50/50 resize-none"
                          placeholder="Note pour la cuisine..."
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between px-3 pb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { vibrate(20); updateQty(index, item.qty - 1); }}
                          className="w-9 h-9 bg-white active:bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="font-black text-gray-900 w-5 text-center">{item.qty}</span>
                        <button
                          onClick={() => { vibrate(20); updateQty(index, item.qty + 1); }}
                          className="w-9 h-9 bg-amber-100 active:bg-amber-200 text-amber-600 rounded-xl flex items-center justify-center"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <span className="font-black text-gray-900 text-sm">{lineTotal.toLocaleString('fr-FR')} F</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 pb-6 pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-sm text-gray-500 font-medium">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
                <span className="text-lg font-black text-gray-900">{cartTotal.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <button
                onClick={handleValidate}
                disabled={!!actionLoading}
                className="w-full bg-green-500 active:bg-green-600 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg"
              >
                {actionLoading === 'validate'
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <CheckCircle size={19} strokeWidth={2.5} />}
                ENVOYER COMMANDE
              </button>
              {isOccupied && (
                <button
                  onClick={handleAddition}
                  disabled={!!actionLoading}
                  className="w-full bg-rose-500 active:bg-rose-600 disabled:opacity-50 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  {actionLoading === 'addition'
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Receipt size={15} />}
                  Envoyer + Demander addition
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {modalProduct && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setModalProduct(null)}>
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative">
              <div className="h-52 bg-gray-100 overflow-hidden rounded-t-3xl">
                {modalProduct.image_url ? (
                  <img src={modalProduct.image_url} alt={modalProduct.nom} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-200">
                    <Image size={56} />
                  </div>
                )}
              </div>
              <button
                onClick={() => setModalProduct(null)}
                className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
              >
                <ChevronLeft size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <h3 className="text-2xl font-black text-gray-900">{modalProduct.nom}</h3>
                <p className="text-amber-600 font-bold text-xl mt-1">{modalProduct.prix.toLocaleString('fr-FR')} F</p>
              </div>

              {modalProduct.variant_groups && modalProduct.variant_groups.length > 0 && (
                <div className="space-y-4">
                  {modalProduct.variant_groups.map(group => {
                    const activeVariants = (group.variants || []).filter(v => v.actif);
                    if (activeVariants.length === 0) return null;
                    return (
                      <div key={group.id}>
                        <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                          {group.nom}
                          {group.required && <span className="text-red-500 text-xs font-normal">*</span>}
                        </h4>
                        <div className="flex flex-col gap-2">
                          {activeVariants.map(v => {
                            const isSelected = selectedVariants[group.id]?.id === v.id;
                            return (
                              <button
                                key={v.id}
                                onClick={() => setSelectedVariants(prev => ({ ...prev, [group.id]: v }))}
                                className={`flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.98] ${isSelected ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-gray-50'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'border-white bg-white' : 'border-gray-300'}`}>
                                    {isSelected && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                                  </div>
                                  <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-800'}`}>{v.nom}</span>
                                </div>
                                <span className={`text-sm font-bold ${isSelected ? 'text-amber-300' : v.prix_delta > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                  {v.prix_delta > 0 ? `+${v.prix_delta.toLocaleString()} F` : v.prix_delta === 0 ? 'Inclus' : `${v.prix_delta.toLocaleString()} F`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {modalProduct.options && modalProduct.options.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3">Options</h4>
                  <div className="flex flex-col gap-2">
                    {modalProduct.options.map(opt => {
                      const isSelected = selectedOptions.some(o => o.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleOption(opt)}
                          className={`flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${isSelected ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'border-amber-400 bg-amber-400' : 'border-gray-300'}`}>
                              {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                            </div>
                            <span className="text-sm font-semibold text-gray-800">{opt.nom}</span>
                          </div>
                          <span className={`text-sm font-bold ${opt.prix_delta > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {opt.prix_delta > 0 ? `+${opt.prix_delta.toLocaleString()} F` : opt.prix_delta === 0 ? 'Inclus' : `${opt.prix_delta.toLocaleString()} F`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <StickyNote size={15} className="text-gray-400" />
                  <label className="text-sm font-bold text-gray-700">Note cuisine</label>
                </div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none bg-gray-50"
                  placeholder="Sans piment, bien cuit, allergie..."
                />
              </div>

              <div className="flex items-center justify-between py-1 border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-14 h-14 bg-gray-100 active:bg-gray-200 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="text-2xl font-black text-gray-900 w-8 text-center">{qty}</span>
                  <button
                    onClick={() => setQty(q => q + 1)}
                    className="w-14 h-14 bg-amber-500 active:bg-amber-600 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                  >
                    <Plus size={20} className="text-white" strokeWidth={3} />
                  </button>
                </div>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-2 bg-green-500 active:bg-green-600 text-white px-6 py-4 rounded-2xl font-black text-base transition-all active:scale-95 shadow-lg"
                >
                  <Plus size={18} strokeWidth={3} />
                  Ajouter · {itemPrice.toLocaleString('fr-FR')} F
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
