import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, CheckCircle2, XCircle, AlertTriangle,
  Clock, Package, ChefHat, TrendingDown, Check, X, Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
import type { Production, ProductionWithRecipe, RecipeWithItems, Warehouse } from '../../types/database';

type ProductionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

const statusConfig: Record<ProductionStatus, { label: string; color: string; bg: string; border: string }> = {
  planned:     { label: 'Planifiée',        color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  in_progress: { label: 'En cours',         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  completed:   { label: 'Terminée',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  cancelled:   { label: 'Annulée',          color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
};

// ─────────────────────────────────────────────────────────
// Launch production modal
// ─────────────────────────────────────────────────────────
interface LaunchModalProps {
  recipe: RecipeWithItems;
  warehouses: Warehouse[];
  onSave: () => void;
  onClose: () => void;
}

export function LaunchProductionModal({ recipe, warehouses, onSave, onClose }: LaunchModalProps) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;

  const [qty, setQty] = useState(recipe.batch_yield);
  const [lossQty, setLossQty] = useState(0);
  const [lossReason, setLossReason] = useState('');
  const [notes, setNotes] = useState('');
  const [warehouseId, setWarehouseId] = useState(warehouses.find(w => w.is_default)?.id ?? '');
  const [saving, setSaving] = useState(false);

  const batches = Math.ceil(qty / recipe.batch_yield);
  const totalCost = (recipe.total_cost / recipe.batch_yield) * qty;
  const unitCost = qty > 0 ? totalCost / qty : 0;

  // Check feasibility: can we produce `qty`?
  const maxPossible = recipe.max_producible;
  const isFeasible = qty <= maxPossible;

  // Ingredient consumption preview
  const consumption = recipe.items.map(item => ({
    name: item.ingredient?.name ?? '?',
    unit: item.ingredient?.unit ?? '',
    needed: (item.quantity / recipe.batch_yield) * qty,
    available: item.ingredient?.stock ?? 0,
    sufficient: (item.ingredient?.stock ?? 0) >= (item.quantity / recipe.batch_yield) * qty,
  }));

  async function handleLaunch() {
    if (!isFeasible) return;
    setSaving(true);

    const prodPayload = {
      recipe_id: recipe.id,
      product_id: recipe.product_id,
      product_name: recipe.product?.name ?? recipe.name,
      quantity_produced: qty,
      total_cost: totalCost,
      unit_cost: unitCost,
      loss_quantity: lossQty,
      loss_reason: lossReason,
      notes,
      status: 'completed' as const,
      produced_by: currentUser?.id ?? null,
      warehouse_id: warehouseId || null,
      completed_at: new Date().toISOString(),
      ...(siteId && { site_id: siteId }),
    };
    const { data: prodData, error } = await supabase.from('productions').insert(prodPayload).select().single();

    if (error || !prodData) { toast('error', 'Erreur lors du lancement'); setSaving(false); return; }

    // Deduct ingredient stock automatically
    for (const item of recipe.items) {
      if (!item.ingredient_id) continue;
      const consumed = (item.quantity / recipe.batch_yield) * qty;
      const newStock = Math.max(0, (item.ingredient?.stock ?? 0) - consumed);
      await supabase.from('ingredients').update({
        stock: parseFloat(newStock.toFixed(4)),
        updated_at: new Date().toISOString(),
      }).eq('id', item.ingredient_id);
    }

    // Update product stock if linked
    if (recipe.product_id) {
      const { data: prodRow } = await supabase.from('products').select('stock').eq('id', recipe.product_id).single();
      const currentStock = (prodRow as { stock: number | null } | null)?.stock ?? 0;
      await supabase.from('products').update({
        stock: (currentStock ?? 0) + qty - lossQty,
        updated_at: new Date().toISOString(),
      }).eq('id', recipe.product_id);
    }

    toast('success', `Production de ${qty} unités lancée`);
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
        className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-lg max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/8 flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Lancer la production</h2>
            <p className="text-white/40 text-sm">{recipe.product?.name ?? recipe.name}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {/* Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Quantité à produire</label>
              <input
                type="number"
                value={qty || ''}
                onChange={e => setQty(parseInt(e.target.value) || 1)}
                onFocus={e => e.target.select()}
                placeholder="1"
                min={1}
                max={maxPossible}
                className={`w-full bg-white/5 border rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none transition-all ${isFeasible ? 'border-white/10 focus:border-blue-500/50' : 'border-red-500/40 focus:border-red-500/60'}`}
              />
              <p className="text-white/30 text-[10px] mt-1">Max possible: {maxPossible}</p>
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Pertes (unités)</label>
              <input
                type="number"
                value={lossQty || ''}
                onChange={e => setLossQty(parseInt(e.target.value) || 0)}
                onFocus={e => e.target.select()}
                placeholder="0"
                min={0}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          {/* Cost summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-white font-bold">{batches}</p>
              <p className="text-white/30 text-[10px]">Batch{batches > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
              <p className="text-blue-400 font-bold">{totalCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</p>
              <p className="text-white/30 text-[10px]">Coût total</p>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-white font-bold">{Math.round(unitCost).toLocaleString('fr-FR')} {sym}</p>
              <p className="text-white/30 text-[10px]">Coût / unité</p>
            </div>
          </div>

          {/* Ingredient consumption preview */}
          <div>
            <h4 className="text-white/60 text-xs font-semibold mb-2">Consommation d'ingrédients</h4>
            <div className="space-y-1.5">
              {consumption.map((c, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${c.sufficient ? 'bg-white/3 border-white/5' : 'bg-red-500/10 border-red-500/20'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.sufficient ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-white/70 text-xs flex-1">{c.name}</span>
                  <span className={`text-xs font-medium ${c.sufficient ? 'text-white/60' : 'text-red-400'}`}>
                    {c.needed.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} / {c.available} {c.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!isFeasible && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">Quantité demandée dépasse le stock disponible. Maximum: {maxPossible} unités.</p>
            </div>
          )}

          {lossQty > 0 && (
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Raison des pertes</label>
              <input
                value={lossReason}
                onChange={e => setLossReason(e.target.value)}
                placeholder="Ex: Brûlé, cassé..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          )}

          {warehouses.length > 0 && (
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Dépôt destination</label>
              <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="" className="bg-gray-900">Aucun dépôt</option>
                {warehouses.map(w => <option key={w.id} value={w.id} className="bg-gray-900">{w.name}{w.is_default ? ' (défaut)' : ''}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes de production..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        <div className="flex gap-2 p-5 border-t border-white/8 flex-shrink-0">
          <button
            onClick={handleLaunch}
            disabled={!isFeasible || saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all"
          >
            {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={14} />}
            Lancer ({qty} unités)
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main production history
// ─────────────────────────────────────────────────────────
interface ProductionManagerProps {
  warehouses: Warehouse[];
}

export function ProductionManager({ warehouses }: ProductionManagerProps) {
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;
  const [productions, setProductions] = useState<(ProductionWithRecipe & { warehouse: Pick<Warehouse, 'id' | 'name'> | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase
      .from('productions')
      .select('*, recipe:recipes(id, name, batch_yield), warehouse:warehouses(id, name)')
      .order('created_at', { ascending: false });
    if (siteId) query = query.eq('site_id', siteId);
    const { data } = await query.limit(50);
    if (data) setProductions(data as (ProductionWithRecipe & { warehouse: Pick<Warehouse, 'id' | 'name'> | null })[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const totalProduced = productions.filter(p => p.status === 'completed').reduce((s, p) => s + p.quantity_produced, 0);
  const totalLoss = productions.reduce((s, p) => s + p.loss_quantity, 0);
  const totalCost = productions.filter(p => p.status === 'completed').reduce((s, p) => s + p.total_cost, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <p className="text-2xl font-black text-white">{productions.length}</p>
          <p className="text-white/40 text-xs mt-0.5">Productions totales</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <p className="text-2xl font-black text-emerald-400">{totalProduced.toLocaleString('fr-FR')}</p>
          <p className="text-white/40 text-xs mt-0.5">Unités produites</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <p className="text-2xl font-black text-red-400">{totalLoss}</p>
          <p className="text-white/40 text-xs mt-0.5">Unités perdues</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <p className="text-xl font-black text-blue-400">{totalCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</p>
          <p className="text-white/40 text-xs mt-0.5">Coût total production</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="flex-1 text-white/30 text-xs font-medium">Production</div>
          <div className="hidden sm:block w-20 text-white/30 text-xs font-medium">Qté</div>
          <div className="hidden md:block w-20 text-white/30 text-xs font-medium">Pertes</div>
          <div className="hidden lg:block text-white/30 text-xs font-medium w-28">Dépôt</div>
          <div className="w-24 text-white/30 text-xs font-medium text-right">Coût</div>
          <div className="w-24 text-white/30 text-xs font-medium text-right">Date</div>
        </div>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <div className="flex-1 h-8 bg-white/5 rounded animate-pulse" />
            </div>
          ))
        ) : productions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <ChefHat size={28} className="text-white/15 mb-2" />
            <p className="text-white/30 text-sm">Aucune production enregistrée</p>
          </div>
        ) : productions.map(p => {
          const cfg = statusConfig[p.status as ProductionStatus];
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm truncate">{p.product_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                </div>
                <p className="text-white/30 text-xs">#{p.production_number} · {p.recipe?.name ?? '—'}</p>
              </div>
              <div className="hidden sm:block w-20 flex-shrink-0">
                <p className="text-emerald-400 font-semibold text-sm">{p.quantity_produced}</p>
                <p className="text-white/30 text-[10px]">unités</p>
              </div>
              <div className="hidden md:block w-20 flex-shrink-0">
                {p.loss_quantity > 0 ? (
                  <div className="flex items-center gap-1">
                    <TrendingDown size={10} className="text-red-400" />
                    <span className="text-red-400 text-sm">{p.loss_quantity}</span>
                  </div>
                ) : (
                  <span className="text-white/20 text-xs">—</span>
                )}
              </div>
              <div className="hidden lg:block w-28 flex-shrink-0">
                <p className="text-white/50 text-xs">{p.warehouse?.name ?? '—'}</p>
              </div>
              <div className="w-24 flex-shrink-0 text-right">
                <p className="text-white text-sm font-semibold">{p.total_cost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</p>
                <p className="text-white/30 text-[10px]">{sym}</p>
              </div>
              <div className="w-24 flex-shrink-0 text-right">
                <p className="text-white/40 text-xs">{new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
                <p className="text-white/25 text-[10px]">{new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
