import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Users, Clock, CheckCircle2, XCircle,
  Edit3, Trash2, RefreshCw, ArrowRightLeft, Layers,
  Coffee, X, Check, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { useToast } from '../components/ui/Toast';
import type { RestaurantTable, TableStatus, Order } from '../types/database';

// ─────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────
const statusConfig: Record<TableStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  free:     { label: 'Libre',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: '#10B981' },
  occupied: { label: 'Occupée', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   dot: '#F59E0B' },
  reserved: { label: 'Réservée',color: 'text-blue-400',    bg: 'bg-blue-500/10',     border: 'border-blue-500/30',     dot: '#3B82F6' },
};

// ─────────────────────────────────────────────────────────
// Table card (floor plan node)
// ─────────────────────────────────────────────────────────
interface TableCardProps {
  table: RestaurantTable;
  selected: boolean;
  onClick: () => void;
}

function TableCard({ table, selected, onClick }: TableCardProps) {
  const cfg = statusConfig[table.status];
  const isRound = table.shape === 'round';

  return (
    <motion.button
      layout
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`absolute flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all select-none
        ${isRound ? 'rounded-full' : 'rounded-2xl'}
        ${selected ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-transparent z-10' : ''}
        border ${cfg.border} ${cfg.bg} shadow-lg`}
      style={{
        left: table.pos_x,
        top: table.pos_y,
        width: table.capacity <= 2 ? 72 : table.capacity <= 4 ? 90 : table.capacity <= 6 ? 110 : 130,
        height: table.capacity <= 2 ? 72 : table.capacity <= 4 ? 90 : table.capacity <= 6 ? 80 : 90,
      }}
    >
      <span className="text-white font-bold text-xs">{table.name}</span>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
        <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
      </div>
      <span className="text-white/30 text-[9px]">{table.capacity} pers.</span>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────
// Table form modal
// ─────────────────────────────────────────────────────────
interface TableFormProps {
  table: RestaurantTable | null;
  floor: number;
  onSave: () => void;
  onClose: () => void;
}

function TableForm({ table, floor, onSave, onClose }: TableFormProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [form, setForm] = useState({
    name: table?.name ?? '',
    capacity: table?.capacity ?? 4,
    shape: table?.shape ?? 'rect' as 'rect' | 'round',
    floor: table?.floor ?? floor,
    notes: table?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (table) {
      const { error } = await supabase.from('restaurant_tables').update({ ...form, pos_x: table.pos_x, pos_y: table.pos_y }).eq('id', table.id).eq('site_id', siteId);
      if (error) { toast('error', 'Erreur lors de la sauvegarde'); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('restaurant_tables').insert({
        ...form, pos_x: 80 + Math.floor(Math.random() * 400), pos_y: 80 + Math.floor(Math.random() * 200), status: 'free', site_id: siteId,
      });
      if (error) { toast('error', 'Erreur lors de la création'); setSaving(false); return; }
    }
    toast('success', table ? 'Table modifiée' : 'Table créée');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl"
      >
        <h2 className="text-white font-bold text-lg mb-5">{table ? 'Modifier la table' : 'Nouvelle table'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Nom</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Capacité</label>
              <input
                type="number"
                value={form.capacity || ''}
                onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                onFocus={e => e.target.select()}
                placeholder="1"
                min={1}
                max={20}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Forme</label>
              <div className="flex gap-2">
                {(['rect', 'round'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, shape: s }))}
                    className={`flex-1 py-2 rounded-xl text-xs border transition-all ${form.shape === s ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    {s === 'rect' ? 'Rectangle' : 'Rond'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Étage/Zone</label>
              <input
                type="number"
                value={form.floor || ''}
                onChange={e => setForm(f => ({ ...f, floor: parseInt(e.target.value) || 1 }))}
                onFocus={e => e.target.select()}
                placeholder="1"
                min={1}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Notes</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ex: Fenêtre, accès PMR..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
              {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={15} />}
              Enregistrer
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">
              <X size={15} />
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Reserve modal
// ─────────────────────────────────────────────────────────
interface ReserveModalProps {
  table: RestaurantTable;
  onSave: () => void;
  onClose: () => void;
}

function ReserveModal({ table, onSave, onClose }: ReserveModalProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [name, setName] = useState(table.reserved_for ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('restaurant_tables').update({
      status: 'reserved',
      reserved_for: name,
      reserved_at: new Date().toISOString(),
    }).eq('id', table.id).eq('site_id', siteId);
    toast('success', 'Table réservée');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-white font-bold text-lg mb-4">Réserver {table.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Nom du client</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Ex: M. Dupont"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
              Réserver
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Transfer modal
// ─────────────────────────────────────────────────────────
interface TransferModalProps {
  fromTable: RestaurantTable;
  tables: RestaurantTable[];
  onSave: () => void;
  onClose: () => void;
}

function TransferModal({ fromTable, tables, onSave, onClose }: TransferModalProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [toId, setToId] = useState('');
  const [saving, setSaving] = useState(false);
  const freeTables = tables.filter(t => t.id !== fromTable.id && t.status === 'free');

  async function handleTransfer() {
    if (!toId) return;
    setSaving(true);
    const toTable = tables.find(t => t.id === toId);
    if (!toTable) return;

    await supabase.from('restaurant_tables').update({
      status: 'occupied',
      active_order_id: fromTable.active_order_id,
    }).eq('id', toId).eq('site_id', siteId);

    await supabase.from('restaurant_tables').update({
      status: 'free',
      active_order_id: null,
    }).eq('id', fromTable.id).eq('site_id', siteId);

    if (fromTable.active_order_id) {
      await supabase.from('orders').update({ table_id: toId }).eq('id', fromTable.active_order_id).eq('site_id', siteId);
    }

    toast('success', `Transféré vers ${toTable.name}`);
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-white font-bold text-lg mb-1">Transférer {fromTable.name}</h2>
        <p className="text-white/40 text-sm mb-4">Déplacer vers une table libre</p>
        {freeTables.length === 0 ? (
          <p className="text-white/40 text-sm py-4 text-center">Aucune table libre disponible</p>
        ) : (
          <div className="space-y-2 mb-4">
            {freeTables.map(t => (
              <button
                key={t.id}
                onClick={() => setToId(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                  ${toId === t.id ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/3 border-white/8 text-white/70 hover:bg-white/5'}`}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-medium">{t.name}</span>
                <span className="text-white/30 text-xs ml-auto">{t.capacity} pers.</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleTransfer} disabled={!toId || saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
            Transférer
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Detail panel
// ─────────────────────────────────────────────────────────
interface TableDetailProps {
  table: RestaurantTable;
  order: Order | null;
  onClose: () => void;
  onRefresh: () => void;
  onEdit: () => void;
  onTransfer: () => void;
  onReserve: () => void;
}

function TableDetail({ table, order, onClose, onRefresh, onEdit, onTransfer, onReserve }: TableDetailProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const cfg = statusConfig[table.status];

  async function handleFree() {
    await supabase.from('restaurant_tables').update({ status: 'free', active_order_id: null, reserved_for: '', reserved_at: null }).eq('id', table.id).eq('site_id', siteId);
    toast('success', 'Table libérée');
    onRefresh();
    onClose();
  }

  async function handleOccupy() {
    await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', table.id).eq('site_id', siteId);
    toast('success', 'Table occupée');
    onRefresh();
    onClose();
  }

  async function handleDelete() {
    if (table.status !== 'free') { toast('error', 'Libérer la table avant de la supprimer'); return; }
    await supabase.from('restaurant_tables').delete().eq('id', table.id).eq('site_id', siteId);
    toast('success', 'Table supprimée');
    onRefresh();
    onClose();
  }

  const elapsed = order
    ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="w-full md:w-80 flex-shrink-0 border-l border-white/8 bg-gray-950/60 flex flex-col fixed inset-0 md:static md:inset-auto z-40 md:z-auto"
    >
      <div className="flex items-center justify-between p-5 border-b border-white/8">
        <div>
          <h3 className="text-white font-bold text-lg">{table.name}</h3>
          <span className={`text-xs ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-lg border ${cfg.border}`}>{cfg.label}</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/40">Capacité</span>
            <span className="text-white">{table.capacity} personnes</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/40">Forme</span>
            <span className="text-white capitalize">{table.shape === 'rect' ? 'Rectangle' : 'Ronde'}</span>
          </div>
          {table.notes && (
            <div className="flex items-start justify-between text-sm gap-2">
              <span className="text-white/40">Notes</span>
              <span className="text-white/70 text-right text-xs">{table.notes}</span>
            </div>
          )}
        </div>

        {/* Reservation info */}
        {table.status === 'reserved' && table.reserved_for && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-blue-400 text-xs font-medium mb-1">Réservation</p>
            <p className="text-white font-semibold">{table.reserved_for}</p>
            {table.reserved_at && (
              <p className="text-white/40 text-xs mt-1">
                {new Date(table.reserved_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* Order info */}
        {order && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-amber-400 text-xs font-medium">Commande #{order.order_number}</p>
              {elapsed !== null && (
                <div className="flex items-center gap-1 text-white/40 text-xs">
                  <Clock size={10} /> {elapsed}min
                </div>
              )}
            </div>
            {order.customer_name && <p className="text-white text-sm">{order.customer_name}</p>}
            <div className={`text-xs px-2 py-1 rounded-lg inline-block font-medium ${
              order.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
              order.status === 'preparing' ? 'bg-blue-500/20 text-blue-400' :
              order.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400' :
              'bg-white/10 text-white/60'
            }`}>
              {order.status === 'pending' ? 'En attente' : order.status === 'preparing' ? 'En préparation' :
               order.status === 'ready' ? 'Prêt' : order.status === 'served' ? 'Servi' : order.status}
            </div>
            <p className="text-white font-bold">{order.total_amount.toLocaleString('fr-FR')} FCFA</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-white/8 space-y-2">
        {table.status === 'free' && (
          <>
            <button onClick={handleOccupy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 text-sm transition-all">
              <Coffee size={14} /> Marquer occupée
            </button>
            <button onClick={onReserve} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 text-sm transition-all">
              <Clock size={14} /> Réserver
            </button>
          </>
        )}
        {table.status === 'occupied' && (
          <button onClick={onTransfer} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 text-sm transition-all">
            <ArrowRightLeft size={14} /> Transférer
          </button>
        )}
        {table.status !== 'free' && (
          <button onClick={handleFree} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15 text-sm transition-all">
            <CheckCircle2 size={14} /> Libérer
          </button>
        )}
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-white/60 text-sm transition-all">
            <Edit3 size={13} /> Modifier
          </button>
          <button onClick={handleDelete} className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 text-sm transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
export function TablesPage() {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFloor, setActiveFloor] = useState(1);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [showReserve, setShowReserve] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const load = useCallback(async () => {
    const [tRes, oRes] = await Promise.all([
      supabase.from('restaurant_tables').select('*').eq('site_id', siteId).eq('is_active', true).order('name'),
      supabase.from('orders').select('*').eq('site_id', siteId).in('status', ['pending', 'preparing', 'ready']),
    ]);
    if (tRes.data) setTables(tRes.data as RestaurantTable[]);
    if (oRes.data) setOrders(oRes.data as Order[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const floors = [...new Set(tables.map(t => t.floor))].sort();
  const floorTables = tables.filter(t => t.floor === activeFloor);

  const stats = {
    total: tables.length,
    free: tables.filter(t => t.status === 'free').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  };

  const selectedOrder = selectedTable?.active_order_id
    ? orders.find(o => o.id === selectedTable.active_order_id) ?? null
    : null;

  // Refresh selected table from latest data
  const liveSelected = selectedTable
    ? tables.find(t => t.id === selectedTable.id) ?? selectedTable
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Chargement tables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-3 space-y-3">
        {/* Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Libres', value: stats.free, color: 'text-emerald-400' },
            { label: 'Occupées', value: stats.occupied, color: 'text-amber-400' },
            { label: 'Réservées', value: stats.reserved, color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
              <span className={`font-bold text-sm ${s.color}`}>{s.value}</span>
              <span className="text-white/40 text-xs">{s.label}</span>
            </div>
          ))}
          <div className="flex-1" />
          <button onClick={load} className="p-2 rounded-xl bg-white/5 border border-white/8 text-white/40 hover:text-white/70 transition-all">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setEditingTable(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
          >
            <Plus size={14} /> Nouvelle table
          </button>
        </div>

        {/* Floor tabs */}
        {floors.length > 1 && (
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/8 w-fit">
            {floors.map(f => (
              <button
                key={f}
                onClick={() => setActiveFloor(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${activeFloor === f ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                <Layers size={11} /> Étage {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Floor plan */}
        <div className="flex-1 relative overflow-auto p-2 sm:p-4 -webkit-overflow-scrolling-touch" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="relative" style={{ width: 760, height: 500, minWidth: 760, minHeight: 500 }}>
            {/* Grid background */}
            <div
              className="absolute inset-0 rounded-3xl border border-white/8 bg-gray-900/30"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />

            {/* Legend */}
            <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-10">
              {Object.entries(statusConfig).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v.dot }} />
                  <span className="text-white/40 text-[10px]">{v.label}</span>
                </div>
              ))}
            </div>

            {/* Tables */}
            {floorTables.map(t => (
              <TableCard
                key={t.id}
                table={t}
                selected={selectedTable?.id === t.id}
                onClick={() => setSelectedTable(liveSelected?.id === t.id ? null : t)}
              />
            ))}

            {floorTables.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <AlertTriangle size={28} className="text-white/15 mb-2" />
                <p className="text-white/30 text-sm">Aucune table sur cet étage</p>
                <button
                  onClick={() => { setEditingTable(null); setShowForm(true); }}
                  className="mt-3 text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  <Plus size={13} /> Ajouter une table
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {liveSelected && (
            <TableDetail
              table={liveSelected}
              order={selectedOrder}
              onClose={() => setSelectedTable(null)}
              onRefresh={() => { load(); }}
              onEdit={() => { setEditingTable(liveSelected); setShowForm(true); }}
              onTransfer={() => setShowTransfer(true)}
              onReserve={() => setShowReserve(true)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <TableForm
            table={editingTable}
            floor={activeFloor}
            onSave={() => { setShowForm(false); load(); }}
            onClose={() => setShowForm(false)}
          />
        )}
        {showReserve && liveSelected && (
          <ReserveModal
            table={liveSelected}
            onSave={() => { setShowReserve(false); setSelectedTable(null); load(); }}
            onClose={() => setShowReserve(false)}
          />
        )}
        {showTransfer && liveSelected && (
          <TransferModal
            fromTable={liveSelected}
            tables={tables}
            onSave={() => { setShowTransfer(false); setSelectedTable(null); load(); }}
            onClose={() => setShowTransfer(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
