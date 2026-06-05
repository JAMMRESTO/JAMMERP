import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, X, Check, ArrowRight,
  Pencil, Trash2, Package, AlertTriangle,
  CheckCircle2, Clock, XCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
import type {
  Warehouse, WarehouseStockWithIngredient, WarehouseTransferWithDetails, Ingredient
} from '../../types/database';

type TransferStatus = 'pending' | 'validated' | 'cancelled';

const statusConfig: Record<TransferStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: 'En attente', color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  validated: { label: 'Validé',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  cancelled: { label: 'Annulé',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
};

// ─────────────────────────────────────────────────────────
// Warehouse form
// ─────────────────────────────────────────────────────────
interface WarehouseFormProps {
  warehouse: Warehouse | null;
  onSave: () => void;
  onClose: () => void;
}

function WarehouseForm({ warehouse, onSave, onClose }: WarehouseFormProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [form, setForm] = useState({
    name: warehouse?.name ?? '',
    description: warehouse?.description ?? '',
    location: warehouse?.location ?? '',
    is_default: warehouse?.is_default ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (warehouse) {
      await supabase.from('warehouses').update(form).eq('id', warehouse.id);
    } else {
      const formWithSite = siteId ? { ...form, site_id: siteId } : form;
      await supabase.from('warehouses').insert(formWithSite);
    }
    toast('success', warehouse ? 'Dépôt modifié' : 'Dépôt créé');
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
        className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl"
      >
        <h2 className="text-white font-bold text-lg mb-5">{warehouse ? 'Modifier le dépôt' : 'Nouveau dépôt'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Nom *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="Ex: Cuisine principale"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Emplacement</label>
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Ex: Cuisine, Sous-sol..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Notes sur ce dépôt..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm(f => ({ ...f, is_default: !f.is_default }))}
              className={`w-10 h-5 rounded-full transition-all relative ${form.is_default ? 'bg-blue-600' : 'bg-white/10'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.is_default ? 'left-5.5' : 'left-0.5'}`} style={{ left: form.is_default ? '22px' : '2px' }} />
            </div>
            <span className="text-white/60 text-sm">Dépôt par défaut</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
              {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Enregistrer
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm">
              <X size={15} />
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// New transfer modal
// ─────────────────────────────────────────────────────────
interface TransferModalProps {
  warehouses: Warehouse[];
  ingredients: Ingredient[];
  onSave: () => void;
  onClose: () => void;
}

function NewTransferModal({ warehouses, ingredients, onSave, onClose }: TransferModalProps) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ ingredient_id: string; quantity: number; unit: string }[]>([
    { ingredient_id: '', quantity: 0, unit: '' }
  ]);
  const [saving, setSaving] = useState(false);

  function updateItem(idx: number, field: string, value: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'ingredient_id') {
        const ing = ingredients.find(x => x.id === value);
        return { ...item, ingredient_id: String(value), unit: ing?.unit ?? '' };
      }
      return { ...item, [field]: value };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId) { toast('error', 'Sélectionnez deux dépôts différents'); return; }
    const validItems = items.filter(i => i.ingredient_id && i.quantity > 0);
    if (validItems.length === 0) { toast('error', 'Ajoutez au moins un article'); return; }
    setSaving(true);

    const transferPayload = {
      from_warehouse_id: fromId,
      to_warehouse_id: toId,
      status: 'pending' as const,
      notes,
      requested_by: currentUser?.id ?? null,
      ...(siteId && { site_id: siteId }),
    };
    const { data: tr, error } = await supabase.from('warehouse_transfers').insert(transferPayload).select().single();

    if (error || !tr) { toast('error', 'Erreur de création'); setSaving(false); return; }

    const itemsWithSite = validItems.map(i => ({
      transfer_id: tr.id,
      ...i,
      ...(siteId && { site_id: siteId }),
    }));
    await supabase.from('warehouse_transfer_items').insert(itemsWithSite);

    toast('success', 'Transfert créé');
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
        className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/8 flex-shrink-0">
          <h2 className="text-white font-bold text-lg">Nouveau transfert</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          <form id="transfer-form" onSubmit={handleSubmit} className="space-y-4">
            {/* From / To */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-white/50 text-xs font-medium block mb-1.5">Depuis</label>
                <select
                  value={fromId}
                  onChange={e => setFromId(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="" className="bg-gray-900">Dépôt source</option>
                  {warehouses.map(w => <option key={w.id} value={w.id} className="bg-gray-900">{w.name}</option>)}
                </select>
              </div>
              <ArrowRight size={16} className="text-white/30 flex-shrink-0 mt-5" />
              <div className="flex-1">
                <label className="text-white/50 text-xs font-medium block mb-1.5">Vers</label>
                <select
                  value={toId}
                  onChange={e => setToId(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="" className="bg-gray-900">Dépôt destination</option>
                  {warehouses.filter(w => w.id !== fromId).map(w => <option key={w.id} value={w.id} className="bg-gray-900">{w.name}</option>)}
                </select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/60 text-sm font-semibold">Articles</label>
                <button type="button" onClick={() => setItems(p => [...p, { ingredient_id: '', quantity: 0, unit: '' }])} className="flex items-center gap-1 text-blue-400 text-xs">
                  <Plus size={11} /> Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={item.ingredient_id}
                      onChange={e => updateItem(idx, 'ingredient_id', e.target.value)}
                      className="col-span-6 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-xs focus:outline-none focus:border-blue-500/40"
                    >
                      <option value="" className="bg-gray-900">Ingrédient</option>
                      {ingredients.map(i => <option key={i.id} value={i.id} className="bg-gray-900">{i.name} ({i.unit})</option>)}
                    </select>
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      min={0}
                      step={0.01}
                      placeholder="Qté"
                      className="col-span-4 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-xs focus:outline-none focus:border-blue-500/40"
                    />
                    <span className="col-span-1 text-white/30 text-[10px] truncate">{item.unit}</span>
                    <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} disabled={items.length === 1} className="col-span-1 flex items-center justify-center text-white/20 hover:text-red-400 disabled:opacity-20">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Motif du transfert..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </form>
        </div>

        <div className="flex gap-2 p-5 border-t border-white/8 flex-shrink-0">
          <button form="transfer-form" type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
            {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight size={14} />}
            Créer le transfert
          </button>
          <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 text-white/60 text-sm">Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────
interface WarehousesManagerProps {
  ingredients: Ingredient[];
  warehouses: Warehouse[];
  onRefresh: () => void;
}

export function WarehousesManager({ ingredients, warehouses, onRefresh }: WarehousesManagerProps) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;

  const [transfers, setTransfers] = useState<WarehouseTransferWithDetails[]>([]);
  const [stock, setStock] = useState<WarehouseStockWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(warehouses[0]?.id ?? '');
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    let trQuery = supabase
      .from('warehouse_transfers')
      .select('*, from_warehouse:warehouses!from_warehouse_id(id, name), to_warehouse:warehouses!to_warehouse_id(id, name), items:warehouse_transfer_items(*, ingredient:ingredients(id, name, unit))')
      .order('requested_at', { ascending: false });
    if (siteId) trQuery = trQuery.eq('site_id', siteId);
    const trRes = await trQuery.limit(30);

    let stQuery = supabase
      .from('warehouse_stock')
      .select('*, ingredient:ingredients(*)')
      .order('updated_at', { ascending: false });
    if (siteId) stQuery = stQuery.eq('site_id', siteId);
    const stRes = await stQuery;

    if (trRes.data) setTransfers(trRes.data as WarehouseTransferWithDetails[]);
    if (stRes.data) setStock(stRes.data as WarehouseStockWithIngredient[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadData(); }, [loadData]);

  const warehouseStock = stock.filter(s => s.warehouse_id === selectedWarehouse);

  async function validateTransfer(transfer: WarehouseTransferWithDetails) {
    await supabase.from('warehouse_transfers').update({
      status: 'validated',
      validated_by: currentUser?.id ?? null,
      validated_at: new Date().toISOString(),
    }).eq('id', transfer.id);

    // Deduct from source warehouse_stock, add to destination
    for (const item of transfer.items) {
      if (!item.ingredient_id) continue;

      // Deduct from source
      const { data: srcStock } = await supabase
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('warehouse_id', transfer.from_warehouse_id)
        .eq('ingredient_id', item.ingredient_id)
        .maybeSingle();

      if (srcStock) {
        await supabase.from('warehouse_stock').update({
          quantity: Math.max(0, srcStock.quantity - item.quantity),
          updated_at: new Date().toISOString(),
        }).eq('id', srcStock.id);
      }

      // Add to destination
      const { data: dstStock } = await supabase
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('warehouse_id', transfer.to_warehouse_id)
        .eq('ingredient_id', item.ingredient_id)
        .maybeSingle();

      if (dstStock) {
        await supabase.from('warehouse_stock').update({
          quantity: dstStock.quantity + item.quantity,
          updated_at: new Date().toISOString(),
        }).eq('id', dstStock.id);
      } else {
        await supabase.from('warehouse_stock').insert({
          warehouse_id: transfer.to_warehouse_id,
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
        });
      }
    }

    toast('success', 'Transfert validé');
    loadData();
  }

  async function cancelTransfer(id: string) {
    await supabase.from('warehouse_transfers').update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    }).eq('id', id);
    toast('success', 'Transfert annulé');
    loadData();
  }

  async function handleDeleteWarehouse(id: string) {
    await supabase.from('warehouses').update({ is_active: false }).eq('id', id);
    toast('success', 'Dépôt désactivé');
    onRefresh();
  }

  const totalWarehouseValue = warehouseStock.reduce((s, ws) => {
    return s + ws.quantity * (ws.ingredient?.cost_per_unit ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Warehouse selector */}
      <div className="flex items-center gap-3 flex-wrap">
        {warehouses.map(w => (
          <button
            key={w.id}
            onClick={() => setSelectedWarehouse(w.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${selectedWarehouse === w.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
          >
            <Building2 size={13} />
            {w.name}
            {w.is_default && <span className="text-[9px] text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded">défaut</span>}
          </button>
        ))}
        <button
          onClick={() => { setEditingWarehouse(null); setShowWarehouseForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 text-sm transition-all"
        >
          <Plus size={13} /> Nouveau dépôt
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowTransferModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all"
        >
          <ArrowRight size={13} /> Nouveau transfert
        </button>
      </div>

      {/* Selected warehouse detail */}
      {selectedWarehouse && (
        <div>
          {/* Warehouse card */}
          {warehouses.filter(w => w.id === selectedWarehouse).map(w => (
            <div key={w.id} className="glass-card rounded-2xl p-4 border border-white/8 mb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-blue-400" />
                    <h3 className="text-white font-bold">{w.name}</h3>
                    {w.is_default && <span className="text-xs text-blue-400 bg-blue-500/15 border border-blue-500/20 px-2 py-0.5 rounded-lg">Défaut</span>}
                  </div>
                  {w.location && <p className="text-white/40 text-xs mt-0.5 ml-6">{w.location}</p>}
                  {w.description && <p className="text-white/30 text-xs mt-0.5 ml-6">{w.description}</p>}
                </div>
                <div className="text-right">
                  <p className="text-blue-400 font-bold">{totalWarehouseValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</p>
                  <p className="text-white/30 text-xs">Valeur du stock</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setEditingWarehouse(w); setShowWarehouseForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs hover:text-white/80 transition-all">
                  <Pencil size={11} /> Modifier
                </button>
                <button onClick={() => handleDeleteWarehouse(w.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/15 transition-all">
                  <Trash2 size={11} /> Désactiver
                </button>
              </div>
            </div>
          ))}

          {/* Warehouse stock */}
          <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/3">
              <h4 className="text-white/60 text-xs font-semibold">Stock dans ce dépôt</h4>
              <span className="text-white/30 text-xs">{warehouseStock.length} référence{warehouseStock.length !== 1 ? 's' : ''}</span>
            </div>
            {warehouseStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Package size={24} className="text-white/15 mb-2" />
                <p className="text-white/30 text-sm">Stock vide</p>
              </div>
            ) : (
              warehouseStock.map(ws => (
                <div key={ws.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{ws.ingredient?.name}</p>
                    <p className="text-white/30 text-xs">{ws.ingredient?.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold text-sm">{ws.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} {ws.ingredient?.unit}</p>
                    <p className="text-blue-400 text-xs">{(ws.quantity * (ws.ingredient?.cost_per_unit ?? 0)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Transfers */}
      <div>
        <h4 className="text-white/60 text-sm font-semibold mb-3">Transferts</h4>
        <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
            <div className="flex-1 text-white/30 text-xs font-medium">Transfert</div>
            <div className="hidden sm:block w-32 text-white/30 text-xs font-medium">Articles</div>
            <div className="text-white/30 text-xs font-medium">Statut</div>
            <div className="w-24 flex-shrink-0" />
          </div>

          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <div className="flex-1 h-8 bg-white/5 rounded animate-pulse" />
              </div>
            ))
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <ArrowRight size={24} className="text-white/15 mb-2" />
              <p className="text-white/30 text-sm">Aucun transfert</p>
            </div>
          ) : (
            <AnimatePresence>
              {transfers.map(tr => {
                const cfg = statusConfig[tr.status as TransferStatus];
                return (
                  <motion.div
                    key={tr.id}
                    layout
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">#{tr.transfer_number}</span>
                        <span className="text-white/50 text-xs">{tr.from_warehouse?.name ?? '?'}</span>
                        <ArrowRight size={10} className="text-white/30" />
                        <span className="text-white/50 text-xs">{tr.to_warehouse?.name ?? '?'}</span>
                      </div>
                      {tr.notes && <p className="text-white/30 text-xs mt-0.5">{tr.notes}</p>}
                      <p className="text-white/20 text-[10px]">{new Date(tr.requested_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="hidden sm:block w-32 flex-shrink-0">
                      <p className="text-white/50 text-xs">{tr.items.length} référence{tr.items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                    {tr.status === 'pending' && (
                      <div className="flex items-center gap-1 w-24 flex-shrink-0">
                        <button
                          onClick={() => validateTransfer(tr)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/15 transition-all"
                        >
                          <Check size={11} /> Valider
                        </button>
                        <button
                          onClick={() => cancelTransfer(tr.id)}
                          className="px-2 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-all"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {tr.status !== 'pending' && <div className="w-24 flex-shrink-0" />}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showWarehouseForm && (
          <WarehouseForm
            warehouse={editingWarehouse}
            onSave={() => { setShowWarehouseForm(false); onRefresh(); loadData(); }}
            onClose={() => setShowWarehouseForm(false)}
          />
        )}
        {showTransferModal && (
          <NewTransferModal
            warehouses={warehouses}
            ingredients={ingredients}
            onSave={() => { setShowTransferModal(false); loadData(); }}
            onClose={() => setShowTransferModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
