import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, Search, X, Phone, MapPin, Clock,
  CheckCircle2, ChefHat, Package, Truck, Ban,
  ShoppingBag, User, FileText, Loader2,
  ChevronDown, Link2, Copy, Check, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { useSettings } from '../context/SettingsContext';
import type { OnlineOrder, OnlineOrderStatus, OnlineOrderType, OnlineOrderItem, Product } from '../types/database';

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────
const STATUS_CFG: Record<OnlineOrderStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  new:        { label: 'Nouvelle',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    icon: ShoppingBag },
  confirmed:  { label: 'Confirmée',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/25',    icon: CheckCircle2 },
  preparing:  { label: 'En préparation',color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   icon: ChefHat },
  ready:      { label: 'Prête',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: Package },
  delivered:  { label: 'Livrée',        color: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10',       icon: Truck },
  cancelled:  { label: 'Annulée',       color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     icon: Ban },
};

const TYPE_CFG: Record<OnlineOrderType, { label: string; icon: typeof Truck }> = {
  delivery: { label: 'Livraison',       icon: Truck },
  takeaway: { label: 'Commandes client', icon: Package },
};

const NEXT_STATUS: Partial<Record<OnlineOrderStatus, OnlineOrderStatus>> = {
  new:       'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready:     'delivered',
};

const BOARD_COLUMNS: OnlineOrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────
// Order Card (kanban)
// ─────────────────────────────────────────────────────────
function OrderCard({ order, onAdvance, onCancel, onDetail, sym }: {
  order: OnlineOrder;
  onAdvance: (o: OnlineOrder) => void;
  onCancel: (o: OnlineOrder) => void;
  onDetail: (o: OnlineOrder) => void;
  sym: string;
}) {
  const cfg = STATUS_CFG[order.status];
  const TypeIcon = TYPE_CFG[order.order_type].icon;
  const next = NEXT_STATUS[order.status];
  const nextCfg = next ? STATUS_CFG[next] : null;
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card rounded-xl border ${cfg.border} p-3 space-y-2.5 cursor-pointer hover:border-white/20 transition-all`}
      onClick={() => onDetail(order)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-bold text-sm">#{order.order_number.toString().padStart(4, '0')}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-white/40 text-[10px]">
            <TypeIcon size={10} />
            <span>{TYPE_CFG[order.order_type].label}</span>
          </div>
        </div>
        <span className="text-white/25 text-[10px] flex-shrink-0">{timeAgo(order.created_at)}</span>
      </div>

      {/* Customer */}
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0">
          <User size={11} className="text-white/40" />
        </div>
        <div className="min-w-0">
          <p className="text-white text-xs font-medium truncate">{order.customer_name}</p>
          {order.customer_phone && <p className="text-white/30 text-[10px]">{order.customer_phone}</p>}
        </div>
      </div>

      {/* Items preview */}
      <div className="text-white/40 text-[10px]">
        {itemCount} article{itemCount > 1 ? 's' : ''} · {order.total.toLocaleString('fr-FR')} {sym}
      </div>

      {/* Actions */}
      {(next || order.status !== 'cancelled') && (
        <div className="flex gap-1.5 pt-0.5" onClick={e => e.stopPropagation()}>
          {next && nextCfg && (
            <button
              onClick={() => onAdvance(order)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${nextCfg.bg} ${nextCfg.color} hover:opacity-80`}
            >
              <nextCfg.icon size={10} />
              {nextCfg.label}
            </button>
          )}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <button
              onClick={() => onCancel(order)}
              className="px-2 py-1.5 rounded-lg text-[10px] bg-red-500/8 text-red-400 hover:bg-red-500/15 transition-all"
            >
              <Ban size={10} />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Detail Modal
// ─────────────────────────────────────────────────────────
function OrderDetailModal({ order, onClose, onAdvance, onCancel, sym }: {
  order: OnlineOrder;
  onClose: () => void;
  onAdvance: (o: OnlineOrder) => void;
  onCancel: (o: OnlineOrder) => void;
  sym: string;
}) {
  const cfg = STATUS_CFG[order.status];
  const TypeIcon = TYPE_CFG[order.order_type].icon;
  const next = NEXT_STATUS[order.status];
  const nextCfg = next ? STATUS_CFG[next] : null;

  const timeline: { label: string; time: string | null; done: boolean }[] = [
    { label: 'Commande reçue',    time: order.created_at,   done: true },
    { label: 'Confirmée',         time: order.confirmed_at, done: !!order.confirmed_at },
    { label: 'En préparation',    time: null,               done: ['preparing','ready','delivered'].includes(order.status) },
    { label: 'Prête',             time: order.ready_at,     done: !!order.ready_at },
    { label: 'Livrée / Récupérée',time: order.delivered_at, done: !!order.delivered_at },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b border-white/8 flex items-center justify-between ${cfg.bg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
              <cfg.icon size={16} className={cfg.color} />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Commande #{order.order_number.toString().padStart(4, '0')}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                <span className="text-white/30 text-[10px]">·</span>
                <span className="text-white/40 text-[10px] flex items-center gap-1"><TypeIcon size={9} /> {TYPE_CFG[order.order_type].label}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: 'thin' }}>
          {/* Customer */}
          <div className="glass-card rounded-xl p-4 border border-white/8 space-y-2">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Client</p>
            <div className="flex items-center gap-2">
              <User size={14} className="text-white/40 flex-shrink-0" />
              <span className="text-white font-medium text-sm">{order.customer_name}</span>
            </div>
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Phone size={12} className="flex-shrink-0" />
                <span>{order.customer_phone}</span>
              </div>
            )}
            {order.customer_address && (
              <div className="flex items-start gap-2 text-white/50 text-xs">
                <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                <span>{order.customer_address}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="glass-card rounded-xl border border-white/8 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Articles</p>
            </div>
            <div className="divide-y divide-white/5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-white/40 text-xs w-5 text-right flex-shrink-0">{item.quantity}x</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{item.product_name}</p>
                    {item.variant_label && <p className="text-white/30 text-[10px]">{item.variant_label}</p>}
                  </div>
                  <span className="text-white/70 text-xs font-medium flex-shrink-0">{item.subtotal.toLocaleString('fr-FR')}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-white/8 space-y-1.5">
              <div className="flex justify-between text-xs text-white/40">
                <span>Sous-total</span><span>{order.subtotal.toLocaleString('fr-FR')} {sym}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-xs text-amber-400">
                  <span>Remise</span><span>-{order.discount_amount.toLocaleString('fr-FR')} {sym}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-white/40">
                <span>TVA</span><span>{order.tax_amount.toLocaleString('fr-FR')} {sym}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-white/8">
                <span>Total</span><span className="text-emerald-400">{order.total.toLocaleString('fr-FR')} {sym}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <FileText size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-white/60 text-xs">{order.notes}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="glass-card rounded-xl p-4 border border-white/8 space-y-3">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Suivi</p>
            <div className="space-y-2">
              {timeline.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 text-xs ${step.done ? 'text-white/70' : 'text-white/20'}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${step.done ? 'bg-emerald-400' : 'bg-white/10'}`} />
                  <span className="flex-1">{step.label}</span>
                  {step.time && <span className="text-white/30 text-[10px]">{new Date(step.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        {(next || (order.status !== 'cancelled' && order.status !== 'delivered')) && (
          <div className="px-5 py-4 border-t border-white/8 flex gap-2">
            {next && nextCfg && (
              <button
                onClick={() => { onAdvance(order); onClose(); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${nextCfg.bg} ${nextCfg.color} border ${nextCfg.border} hover:opacity-80`}
              >
                <nextCfg.icon size={15} />
                Passer à : {nextCfg.label}
              </button>
            )}
            {order.status !== 'cancelled' && order.status !== 'delivered' && (
              <button
                onClick={() => { onCancel(order); onClose(); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <Ban size={14} /> Annuler
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// New Order Form Modal
// ─────────────────────────────────────────────────────────
function NewOrderModal({ onClose, onCreated, taxRate, sym }: {
  onClose: () => void;
  onCreated: () => void;
  taxRate: number;
  sym: string;
}) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    order_type: 'delivery' as OnlineOrderType,
    notes: '',
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [cartItems, setCartItems] = useState<OnlineOrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [prodLoading, setProdLoading] = useState(true);

  useEffect(() => {
    supabase.from('products').select('*').eq('site_id', siteId).eq('is_available', true).order('name')
      .then(({ data }) => { setProducts((data ?? []) as Product[]); setProdLoading(false); });
  }, [siteId]);

  const filteredProducts = products.filter(p =>
    !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 12);

  function addItem(product: Product) {
    setCartItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unit_price }
          : i
        );
      }
      return [...prev, { product_id: product.id, product_name: product.name, unit_price: product.price, quantity: 1, subtotal: product.price }];
    });
  }

  function updateQty(product_id: string, qty: number) {
    if (qty <= 0) setCartItems(prev => prev.filter(i => i.product_id !== product_id));
    else setCartItems(prev => prev.map(i => i.product_id === product_id ? { ...i, quantity: qty, subtotal: qty * i.unit_price } : i));
  }

  const subtotal = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const taxAmount = Math.round((subtotal - discount) * taxRate / 100);
  const total = subtotal - discount + taxAmount;

  async function handleSubmit() {
    if (!form.customer_name.trim() || cartItems.length === 0) return;
    setLoading(true);
    await supabase.from('online_orders').insert({
      ...form,
      items: cartItems,
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discount,
      total,
      status: 'new',
      source: 'manual',
      site_id: siteId,
    });
    setLoading(false);
    onCreated();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="text-white font-bold text-base">Nouvelle commande en ligne</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/8">
            {/* Left: customer + type */}
            <div className="p-5 space-y-4">
              {/* Type */}
              <div>
                <label className="text-white/50 text-xs font-medium block mb-2">Type de commande</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['delivery', 'takeaway'] as OnlineOrderType[]).map(t => {
                    const tc = TYPE_CFG[t];
                    const active = form.order_type === t;
                    return (
                      <button key={t} onClick={() => setForm(f => ({ ...f, order_type: t }))}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${active ? 'bg-blue-600/15 border-blue-500/30 text-blue-300' : 'bg-white/4 border-white/10 text-white/50 hover:text-white/70'}`}>
                        <tc.icon size={14} />{tc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer info */}
              <div className="space-y-3">
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Nom du client *</label>
                  <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Prénom Nom"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all" />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Téléphone</label>
                  <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="+221 XX XXX XX XX"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all" />
                </div>
                {form.order_type === 'delivery' && (
                  <div>
                    <label className="text-white/50 text-xs font-medium block mb-1.5">Adresse de livraison</label>
                    <textarea value={form.customer_address} onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))}
                      rows={2} placeholder="Rue, Quartier, Ville..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 resize-none transition-all" />
                  </div>
                )}
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2} placeholder="Instructions particulières..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 resize-none transition-all" />
                </div>
              </div>

              {/* Cart summary */}
              {cartItems.length > 0 && (
                <div className="glass-card rounded-xl border border-white/8 overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {cartItems.map(item => (
                      <div key={item.product_id} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-white/40 text-[10px] w-4">{item.quantity}x</span>
                        <span className="text-white text-xs flex-1 truncate">{item.product_name}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-5 h-5 rounded bg-white/8 text-white/50 hover:text-red-400 text-xs flex items-center justify-center">−</button>
                          <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-5 h-5 rounded bg-white/8 text-white/50 hover:text-blue-400 text-xs flex items-center justify-center">+</button>
                        </div>
                        <span className="text-white/60 text-[10px] w-16 text-right">{item.subtotal.toLocaleString('fr-FR')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t border-white/8 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs flex-1">Remise</span>
                      <input type="number" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                        onFocus={e => e.target.select()} placeholder="0"
                        className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white">
                      <span>Total</span>
                      <span className="text-emerald-400">{total.toLocaleString('fr-FR')} {sym}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: product picker */}
            <div className="p-5 space-y-3">
              <div>
                <label className="text-white/50 text-xs font-medium block mb-2">Ajouter des articles *</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                    placeholder="Rechercher un produit..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all" />
                </div>
              </div>
              {prodLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={20} className="text-white/30 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {filteredProducts.map(p => {
                    const inCart = cartItems.find(i => i.product_id === p.id);
                    return (
                      <button key={p.id} onClick={() => addItem(p)}
                        className={`text-left p-2.5 rounded-xl border transition-all ${inCart ? 'border-blue-500/30 bg-blue-500/8' : 'border-white/8 bg-white/3 hover:border-white/16 hover:bg-white/6'}`}>
                        <p className="text-white text-xs font-medium truncate">{p.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-white/40 text-[10px]">{p.price.toLocaleString('fr-FR')} {sym}</p>
                          {inCart && <span className="text-blue-400 text-[10px] font-bold">×{inCart.quantity}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {cartItems.length === 0 && (
                <p className="text-white/20 text-xs text-center py-4">Cliquez sur un produit pour l'ajouter</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/8 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-sm transition-all">
            Annuler
          </button>
          <motion.button
            onClick={handleSubmit}
            disabled={loading || !form.customer_name.trim() || cartItems.length === 0}
            whileTap={{ scale: 0.98 }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Créer la commande
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────
export function OnlineOrdersPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { settings } = useSettings();
  const sym = settings.currency_symbol;
  const taxRate = settings.tax_rate;

  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<OnlineOrderStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [detailOrder, setDetailOrder] = useState<OnlineOrder | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('online_orders')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as OnlineOrder[]);
    setLoading(false);
    setRefreshing(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  async function advanceOrder(order: OnlineOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const timestamps: Partial<OnlineOrder> = {};
    if (next === 'confirmed') timestamps.confirmed_at = new Date().toISOString();
    if (next === 'ready')     timestamps.ready_at     = new Date().toISOString();
    if (next === 'delivered') timestamps.delivered_at = new Date().toISOString();
    await supabase.from('online_orders').update({ status: next, updated_at: new Date().toISOString(), ...timestamps }).eq('id', order.id).eq('site_id', siteId);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next, ...timestamps } : o));
    if (detailOrder?.id === order.id) setDetailOrder(o => o ? { ...o, status: next, ...timestamps } : o);
  }

  async function cancelOrder(order: OnlineOrder) {
    await supabase.from('online_orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', order.id).eq('site_id', siteId);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled', cancelled_at: new Date().toISOString() } : o));
    if (detailOrder?.id === order.id) setDetailOrder(null);
  }

  const filtered = orders.filter(o => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!o.customer_name.toLowerCase().includes(q) && !String(o.order_number).includes(q) && !o.customer_phone.includes(q)) return false;
    }
    return true;
  });

  const countByStatus = (s: OnlineOrderStatus) => orders.filter(o => o.status === s).length;
  const activeCount = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length;

  // KPI
  const todayOrders = orders.filter(o => o.created_at.startsWith(new Date().toISOString().slice(0, 10)));
  const todayRevenue = todayOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total, 0);

  // Public order link
  const [copied, setCopied] = useState(false);
  const orderUrl = `${window.location.origin}/order`;
  function copyLink() {
    navigator.clipboard.writeText(orderUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-3">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Actives', value: activeCount, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: "Nouvelles", value: countByStatus('new'), color: 'text-white', bg: 'bg-white/5', border: 'border-white/10' },
            { label: "En prép.", value: countByStatus('preparing'), color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { label: "CA du jour", value: `${todayRevenue.toLocaleString('fr-FR')} ${sym}`, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          ].map((k, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`${k.bg} border ${k.border} rounded-xl px-3 py-2.5`}>
              <p className={`font-black text-base ${k.color}`}>{k.value}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{k.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Public link banner */}
        <div className="flex items-center gap-2 p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl flex-wrap sm:flex-nowrap">
          <Link2 size={14} className="text-blue-400 flex-shrink-0" />
          <span className="text-blue-300 text-xs font-medium flex-shrink-0">Lien de commande en ligne :</span>
          <span className="text-white/60 text-xs font-mono truncate flex-1 min-w-0">{orderUrl}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={copyLink}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium transition-all">
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
            <a href={orderUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-xs font-medium transition-all">
              <ExternalLink size={11} /> Ouvrir
            </a>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Chercher une commande..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-500/40 transition-all" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as OnlineOrderStatus | 'all')}
              className="bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-white/70 text-xs focus:outline-none appearance-none cursor-pointer">
              <option value="all">Tous les statuts</option>
              {BOARD_COLUMNS.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>

          {/* View toggle */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5">
            {(['board', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === v ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
                {v === 'board' ? 'Kanban' : 'Liste'}
              </button>
            ))}
          </div>

          <button onClick={load} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white/80 transition-all disabled:opacity-50 text-xs">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>

          <motion.button onClick={() => setShowNewOrder(true)} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all">
            <Plus size={13} />
            <span className="hidden sm:inline">Nouvelle commande</span>
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={28} className="text-white/30 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <ShoppingBag size={28} className="text-white/20" />
            </div>
            <div>
              <p className="text-white/50 font-medium">Aucune commande</p>
              <p className="text-white/25 text-sm mt-1">
                {search || filterStatus !== 'all' ? 'Aucun résultat pour ces filtres' : 'Les commandes en ligne apparaîtront ici'}
              </p>
            </div>
            {!search && filterStatus === 'all' && (
              <button onClick={() => setShowNewOrder(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
                <Plus size={14} /> Créer une commande
              </button>
            )}
          </div>
        ) : viewMode === 'board' ? (
          /* ── KANBAN BOARD ── */
          <div className="h-full overflow-x-auto p-2 sm:p-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-2 sm:gap-3 h-full" style={{ minWidth: `${BOARD_COLUMNS.length * 180}px` }}>
              {BOARD_COLUMNS.map(status => {
                const colOrders = filtered.filter(o => o.status === status);
                const cfg = STATUS_CFG[status];
                return (
                  <div key={status} className="flex flex-col w-44 sm:w-52 flex-shrink-0">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-2 ${cfg.bg} border ${cfg.border}`}>
                      <cfg.icon size={13} className={cfg.color} />
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className={`ml-auto text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                        {colOrders.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                      <AnimatePresence>
                        {colOrders.map(o => (
                          <OrderCard key={o.id} order={o} sym={sym}
                            onAdvance={advanceOrder} onCancel={cancelOrder} onDetail={setDetailOrder} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div className="overflow-y-auto h-full p-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="space-y-1.5">
              {filtered.map((order, i) => {
                const cfg = STATUS_CFG[order.status];
                const TypeIcon = TYPE_CFG[order.order_type].icon;
                return (
                  <motion.div key={order.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setDetailOrder(order)}
                    className="flex items-center gap-3 p-3.5 rounded-xl glass-card border border-white/8 hover:border-white/16 cursor-pointer transition-all"
                  >
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
                      <cfg.icon size={15} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm">#{order.order_number.toString().padStart(4, '0')}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-white/30 text-[10px] flex items-center gap-1"><TypeIcon size={9} />{TYPE_CFG[order.order_type].label}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-white/40 text-xs">
                        <span className="flex items-center gap-1"><User size={10} />{order.customer_name}</span>
                        {order.customer_phone && <span className="flex items-center gap-1"><Phone size={10} />{order.customer_phone}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white font-bold text-sm">{order.total.toLocaleString('fr-FR')} {sym}</p>
                      <p className="text-white/30 text-[10px]">{timeAgo(order.created_at)}</p>
                    </div>
                    {NEXT_STATUS[order.status] && (
                      <button onClick={e => { e.stopPropagation(); advanceOrder(order); }}
                        className={`ml-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${STATUS_CFG[NEXT_STATUS[order.status]!].bg} ${STATUS_CFG[NEXT_STATUS[order.status]!].color} border ${STATUS_CFG[NEXT_STATUS[order.status]!].border} hover:opacity-80 flex-shrink-0`}>
                        {STATUS_CFG[NEXT_STATUS[order.status]!].label}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNewOrder && (
          <NewOrderModal sym={sym} taxRate={taxRate} onClose={() => setShowNewOrder(false)} onCreated={() => { setShowNewOrder(false); load(); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailOrder && (
          <OrderDetailModal order={detailOrder} sym={sym} onClose={() => setDetailOrder(null)}
            onAdvance={advanceOrder} onCancel={cancelOrder} />
        )}
      </AnimatePresence>
    </div>
  );
}
