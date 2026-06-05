import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat, Clock, CheckCircle2, XCircle, Plus,
  Flame, AlertTriangle, RefreshCw, Filter,
  Package, ArrowRight, Check, X, Utensils
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import type { Order, OrderItem, OrderStatus, OrderType, RestaurantTable } from '../types/database';

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────
const orderStatusConfig: Record<OrderStatus, { label: string; color: string; bg: string; border: string; next?: OrderStatus }> = {
  pending:    { label: 'En attente',     color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   next: 'preparing' },
  preparing:  { label: 'En préparation', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    next: 'ready' },
  ready:      { label: 'Prêt',           color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', next: 'served' },
  served:     { label: 'Servi',          color: 'text-white/50',    bg: 'bg-white/5',        border: 'border-white/10' },
  cancelled:  { label: 'Annulé',         color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25' },
};

const orderTypeConfig: Record<OrderType, { label: string; icon: typeof Utensils }> = {
  dine_in:   { label: 'Sur place', icon: Utensils },
  takeaway:  { label: 'À emporter', icon: Package },
  delivery:  { label: 'Livraison', icon: Package },
};

interface OrderWithItems extends Order {
  items: OrderItem[];
  table: Pick<RestaurantTable, 'id' | 'name'> | null;
}

// ─────────────────────────────────────────────────────────
// New order form modal
// ─────────────────────────────────────────────────────────
interface NewOrderModalProps {
  tables: RestaurantTable[];
  onSave: () => void;
  onClose: () => void;
}

function NewOrderModal({ tables, onSave, onClose }: NewOrderModalProps) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;

  const [form, setForm] = useState({
    order_type: 'dine_in' as OrderType,
    table_id: '',
    customer_name: '',
    notes: '',
  });
  const [items, setItems] = useState<{ product_name: string; quantity: number; unit_price: number; variant_label: string; kitchen_note: string }[]>([
    { product_name: '', quantity: 1, unit_price: 0, variant_label: '', kitchen_note: '' }
  ]);
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItems(prev => [...prev, { product_name: '', quantity: 1, unit_price: 0, variant_label: '', kitchen_note: '' }]);
  }
  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter(i => i.product_name.trim());
    if (validItems.length === 0) { toast('error', 'Ajoutez au moins un article'); return; }
    setSaving(true);

    const { data: orderData, error } = await supabase.from('orders').insert({
      order_type: form.order_type,
      table_id: form.table_id || null,
      customer_name: form.customer_name,
      notes: form.notes,
      status: 'pending',
      total_amount: total,
      cashier_id: currentUser?.id ?? null,
      site_id: siteId,
    }).select().single();

    if (error || !orderData) { toast('error', 'Erreur de création'); setSaving(false); return; }

    await supabase.from('order_items').insert(
      validItems.map(i => ({ ...i, order_id: orderData.id, status: 'pending', site_id: siteId }))
    );

    if (form.table_id) {
      await supabase.from('restaurant_tables').update({ status: 'occupied', active_order_id: orderData.id }).eq('id', form.table_id).eq('site_id', siteId);
    }

    toast('success', 'Commande créée');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <h2 className="text-white font-bold text-lg mb-5">Nouvelle commande</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Table */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Type</label>
              <select
                value={form.order_type}
                onChange={e => setForm(f => ({ ...f, order_type: e.target.value as OrderType }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="dine_in" className="bg-gray-900">Sur place</option>
                <option value="takeaway" className="bg-gray-900">À emporter</option>
                <option value="delivery" className="bg-gray-900">Livraison</option>
              </select>
            </div>
            {form.order_type === 'dine_in' && (
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">Table</label>
                <select
                  value={form.table_id}
                  onChange={e => setForm(f => ({ ...f, table_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="" className="bg-gray-900">Sans table</option>
                  {tables.filter(t => t.status !== 'occupied').map(t => (
                    <option key={t.id} value={t.id} className="bg-gray-900">{t.name} ({t.capacity}p)</option>
                  ))}
                </select>
              </div>
            )}
            {form.order_type !== 'dine_in' && (
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">Client</label>
                <input
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Nom du client"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/50 text-xs font-medium">Articles</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors">
                <Plus size={11} /> Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={item.product_name}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, product_name: e.target.value } : it))}
                    placeholder="Article"
                    className="col-span-5 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-blue-500/40"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it))}
                    min={1}
                    className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-xs text-center focus:outline-none focus:border-blue-500/40"
                  />
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, unit_price: parseFloat(e.target.value) || 0 } : it))}
                    placeholder={`Prix ${sym}`}
                    className="col-span-3 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-blue-500/40"
                  />
                  <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1} className="col-span-1 flex items-center justify-center text-white/20 hover:text-red-400 disabled:opacity-20 transition-colors">
                    <X size={13} />
                  </button>
                  <input
                    value={item.kitchen_note}
                    onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, kitchen_note: e.target.value } : it))}
                    placeholder="Note cuisine"
                    className="col-span-11 bg-white/3 border border-white/8 rounded-xl px-3 py-1.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/30"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes + Total */}
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes générales..."
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
            <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-white/40 text-sm">Total</span>
              <span className="text-white font-bold">{total.toLocaleString('fr-FR')} {sym}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
              {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={15} />}
              Créer la commande
            </button>
            <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Order card
// ─────────────────────────────────────────────────────────
interface OrderCardProps {
  order: OrderWithItems;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onCancel: (id: string) => void;
}

function OrderCard({ order, onStatusChange, onCancel }: OrderCardProps) {
  const cfg = orderStatusConfig[order.status];
  const typeCfg = orderTypeConfig[order.order_type];
  const TypeIcon = typeCfg.icon;
  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isUrgent = elapsed > 20 && order.status !== 'served' && order.status !== 'cancelled';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-gray-900/60 border rounded-2xl overflow-hidden ${isUrgent ? 'border-red-500/40' : cfg.border} ${isUrgent ? 'shadow-lg shadow-red-500/10' : ''}`}
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${isUrgent ? 'border-red-500/20 bg-red-500/5' : 'border-white/8'}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
          <TypeIcon size={13} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">#{order.order_number}</span>
            {order.table && <span className="text-white/40 text-xs">{order.table.name}</span>}
            {order.customer_name && <span className="text-white/50 text-xs truncate">{order.customer_name}</span>}
          </div>
          <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs ${isUrgent ? 'text-red-400' : 'text-white/30'}`}>
          {isUrgent && <Flame size={11} />}
          <Clock size={11} />
          <span>{elapsed}min</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-1.5">
        {order.items.map(item => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="text-white/50 text-xs w-5 text-right flex-shrink-0 mt-0.5">{item.quantity}×</span>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium">{item.product_name}</p>
              {item.variant_label && <p className="text-white/30 text-[10px]">{item.variant_label}</p>}
              {item.kitchen_note && (
                <p className="text-amber-400/70 text-[10px] italic">⚠ {item.kitchen_note}</p>
              )}
            </div>
          </div>
        ))}
        {order.notes && (
          <div className="flex items-start gap-1.5 mt-2 bg-white/3 rounded-lg px-2.5 py-1.5">
            <AlertTriangle size={10} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-400/80 text-[10px]">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {order.status !== 'served' && order.status !== 'cancelled' && (
        <div className="px-4 pb-3 flex gap-2">
          {cfg.next && (
            <button
              onClick={() => onStatusChange(order.id, cfg.next!)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition-all
                ${orderStatusConfig[cfg.next].bg} ${orderStatusConfig[cfg.next].border} ${orderStatusConfig[cfg.next].color}`}
            >
              <ArrowRight size={11} />
              {orderStatusConfig[cfg.next].label}
            </button>
          )}
          <button
            onClick={() => onCancel(order.id)}
            className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-all"
          >
            <XCircle size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// History row
// ─────────────────────────────────────────────────────────
function HistoryRow({ order }: { order: OrderWithItems }) {
  const cfg = orderStatusConfig[order.status];
  const typeCfg = orderTypeConfig[order.order_type];
  const TypeIcon = typeCfg.icon;
  const { settings } = useSettings();

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        <TypeIcon size={13} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">#{order.order_number}</span>
          {order.table && <span className="text-white/40 text-xs">{order.table.name}</span>}
          {order.customer_name && <span className="text-white/40 text-xs">{order.customer_name}</span>}
        </div>
        <span className="text-white/30 text-xs">{order.items.length} article{order.items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="text-right">
        <span className={`text-xs px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
        <p className="text-white/40 text-[10px] mt-1">
          {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="text-right w-20">
        <p className="text-white text-sm font-semibold">{order.total_amount.toLocaleString('fr-FR')}</p>
        <p className="text-white/30 text-[10px]">{settings.currency_symbol}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
type Tab = 'board' | 'history';

export function KitchenPage() {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [tab, setTab] = useState<Tab>('board');
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('');
  const prevCountRef = useRef(0);

  const load = useCallback(async () => {
    const isHistory = tab === 'history';
    const statusFilter = isHistory ? ['served', 'cancelled'] : ['pending', 'preparing', 'ready'];

    const [oRes, tRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, items:order_items(*), table:restaurant_tables(id, name)')
        .eq('site_id', siteId)
        .in('status', statusFilter)
        .order('created_at', { ascending: !isHistory }),
      supabase.from('restaurant_tables').select('id, name, capacity, status').eq('site_id', siteId).eq('is_active', true),
    ]);

    if (oRes.data) {
      const newOrders = oRes.data as OrderWithItems[];
      if (tab === 'board' && newOrders.length > prevCountRef.current && prevCountRef.current > 0) {
        toast('info', 'Nouvelle commande reçue!');
      }
      prevCountRef.current = newOrders.length;
      setOrders(newOrders);
    }
    if (tRes.data) setTables(tRes.data as RestaurantTable[]);
    setLoading(false);
  }, [tab, toast, siteId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleStatusChange(id: string, status: OrderStatus) {
    const now = new Date().toISOString();
    const extra = status === 'served' ? { served_at: now } : status === 'cancelled' ? { cancelled_at: now } : {};
    await supabase.from('orders').update({ status, updated_at: now, ...extra }).eq('id', id).eq('site_id', siteId);
    if (status === 'served') {
      // Free the table
      const order = orders.find(o => o.id === id);
      if (order?.table_id) {
        await supabase.from('restaurant_tables').update({ status: 'free', active_order_id: null }).eq('id', order.table_id).eq('site_id', siteId);
      }
    }
    setOrders(prev => prev.filter(o => o.id !== id));
    toast('success', status === 'served' ? 'Commande servie' : 'Statut mis à jour');
  }

  async function handleCancel(id: string) {
    const order = orders.find(o => o.id === id);
    await supabase.from('orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id).eq('site_id', siteId);
    if (order?.table_id) {
      await supabase.from('restaurant_tables').update({ status: 'free', active_order_id: null }).eq('id', order.table_id).eq('site_id', siteId);
    }
    setOrders(prev => prev.filter(o => o.id !== id));
    toast('success', 'Commande annulée');
  }

  const activeOrders = orders.filter(o => !filterStatus || o.status === filterStatus);

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-0">
        {/* Tabs */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/8">
            {[{ id: 'board', label: 'Tableau de bord', icon: ChefHat }, { id: 'history', label: 'Historique', icon: CheckCircle2 }].map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id as Tab); setFilterStatus(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
                    ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>
          <button onClick={load} className="p-2 rounded-xl bg-white/5 border border-white/8 text-white/40 hover:text-white/70 transition-all">
            <RefreshCw size={14} />
          </button>
          <div className="flex-1" />
          {tab === 'board' && (
            <button
              onClick={() => setShowNewOrder(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
            >
              <Plus size={14} /> Nouvelle commande
            </button>
          )}
        </div>

        {/* Board stats + filters */}
        {tab === 'board' && (
          <div className="flex items-center gap-2 pb-3 flex-wrap">
            {([
              { status: '' as const, label: 'Toutes', count: orders.length, color: 'text-white' },
              { status: 'pending' as OrderStatus, label: 'En attente', count: stats.pending, color: 'text-amber-400' },
              { status: 'preparing' as OrderStatus, label: 'En préparation', count: stats.preparing, color: 'text-blue-400' },
              { status: 'ready' as OrderStatus, label: 'Prêtes', count: stats.ready, color: 'text-emerald-400' },
            ]).map(f => (
              <button
                key={f.label}
                onClick={() => setFilterStatus(f.status as OrderStatus | '')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all
                  ${filterStatus === f.status
                    ? 'bg-white/10 border-white/20 text-white'
                    : 'bg-white/3 border-white/8 text-white/40 hover:text-white/60'
                  }`}
              >
                <span className={`font-bold ${f.color}`}>{f.count}</span>
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4 scrollbar-thin">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 bg-white/3 border border-white/8 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : tab === 'board' ? (
          activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <ChefHat size={36} className="text-white/10 mb-3" />
              <p className="text-white/30 font-medium">Aucune commande active</p>
              <p className="text-white/20 text-sm mt-1">Les nouvelles commandes apparaîtront ici</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
                {activeOrders.map(o => (
                  <OrderCard key={o.id} order={o} onStatusChange={handleStatusChange} onCancel={handleCancel} />
                ))}
              </div>
            </AnimatePresence>
          )
        ) : (
          <div className="mt-2 bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
              <div className="w-7 flex-shrink-0" />
              <div className="flex-1 text-white/30 text-xs font-medium">Commande</div>
              <div className="text-white/30 text-xs font-medium">Statut</div>
              <div className="w-20 text-white/30 text-xs font-medium text-right">Total</div>
            </div>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14">
                <CheckCircle2 size={28} className="text-white/15 mb-2" />
                <p className="text-white/30 text-sm">Aucun historique</p>
              </div>
            ) : (
              <AnimatePresence>
                {orders.map(o => <HistoryRow key={o.id} order={o} />)}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showNewOrder && (
          <NewOrderModal
            tables={tables}
            onSave={() => { setShowNewOrder(false); load(); }}
            onClose={() => setShowNewOrder(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
