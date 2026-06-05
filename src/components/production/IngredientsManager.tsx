import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Pencil, Trash2, X, Check,
  AlertTriangle, XCircle, CheckCircle2, Package,
  ChevronDown, Filter
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
import type { Ingredient } from '../../types/database';

// ─────────────────────────────────────────────────────────
// Stock badge
// ─────────────────────────────────────────────────────────
function StockBadge({ ing }: { ing: Ingredient }) {
  if (ing.stock <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">
        <XCircle size={9} /> Rupture
      </span>
    );
  }
  if (ing.stock <= ing.low_stock_threshold) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
        <AlertTriangle size={9} /> {ing.stock} {ing.unit}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-lg">
      <CheckCircle2 size={9} /> {ing.stock} {ing.unit}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Ingredient form
// ─────────────────────────────────────────────────────────
interface IngFormProps {
  ingredient: Ingredient | null;
  onSave: () => void;
  onClose: () => void;
}

function IngredientForm({ ingredient, onSave, onClose }: IngFormProps) {
  const toast = useToast();
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;

  const [form, setForm] = useState({
    name: ingredient?.name ?? '',
    unit: ingredient?.unit ?? 'kg',
    cost_per_unit: ingredient?.cost_per_unit ?? 0,
    stock: ingredient?.stock ?? 0,
    low_stock_threshold: ingredient?.low_stock_threshold ?? 0,
    category: ingredient?.category ?? '',
    description: ingredient?.description ?? '',
  });
  const [saving, setSaving] = useState(false);

  const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'boîte', 'sachet', 'portion'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    if (ingredient) {
      const { error } = await supabase.from('ingredients').update(payload).eq('id', ingredient.id);
      if (error) { toast('error', 'Erreur lors de la modification'); setSaving(false); return; }
    } else {
      const payloadWithSite = siteId ? { ...payload, site_id: siteId } : payload;
      const { error } = await supabase.from('ingredients').insert(payloadWithSite);
      if (error) { toast('error', 'Erreur lors de la création'); setSaving(false); return; }
    }
    toast('success', ingredient ? 'Ingrédient modifié' : 'Ingrédient créé');
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
        <h2 className="text-white font-bold text-lg mb-5">{ingredient ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Nom *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              placeholder="Ex: Farine de blé"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Unité</label>
              <select
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                {UNITS.map(u => <option key={u} value={u} className="bg-gray-900">{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Coût / unité ({sym})</label>
              <input
                type="number"
                value={form.cost_per_unit || ''}
                onChange={e => setForm(f => ({ ...f, cost_per_unit: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.select()}
                placeholder="0"
                min={0}
                step={0.01}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Stock actuel ({form.unit})</label>
              <input
                type="number"
                value={form.stock || ''}
                onChange={e => setForm(f => ({ ...f, stock: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.select()}
                placeholder="0"
                min={0}
                step={0.001}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Seuil alerte ({form.unit})</label>
              <input
                type="number"
                value={form.low_stock_threshold || ''}
                onChange={e => setForm(f => ({ ...f, low_stock_threshold: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.select()}
                placeholder="0"
                min={0}
                step={0.001}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Catégorie</label>
              <input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Ex: Sec, Frais..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-end">
              {form.cost_per_unit > 0 && form.stock > 0 && (
                <div className="w-full bg-white/3 border border-white/8 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-blue-400 font-bold text-sm">{(form.stock * form.cost_per_unit).toLocaleString('fr-FR')} {sym}</p>
                  <p className="text-white/30 text-[10px]">Valeur stock</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || !form.name.trim()} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
              {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
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
// Main component
// ─────────────────────────────────────────────────────────
interface IngredientsManagerProps {
  ingredients: Ingredient[];
  onRefresh: () => void;
}

export function IngredientsManager({ ingredients, onRefresh }: IngredientsManagerProps) {
  const toast = useToast();
  const { settings } = useSettings();
  const sym = settings.currency_symbol;

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const categories = [...new Set(ingredients.map(i => i.category).filter(Boolean))].sort();

  const filtered = ingredients.filter(ing => {
    if (search) {
      const q = search.toLowerCase();
      if (!ing.name.toLowerCase().includes(q) && !ing.category.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && ing.category !== filterCategory) return false;
    if (filterStock === 'out' && ing.stock > 0) return false;
    if (filterStock === 'low' && (ing.stock <= 0 || ing.stock > ing.low_stock_threshold)) return false;
    return true;
  });

  const totalValue = ingredients.reduce((s, i) => s + i.stock * i.cost_per_unit, 0);
  const alerts = ingredients.filter(i => i.stock <= i.low_stock_threshold && i.low_stock_threshold > 0);

  async function handleDelete(id: string) {
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    if (error) { toast('error', 'Impossible de supprimer (utilisé dans une recette)'); return; }
    toast('success', 'Ingrédient supprimé');
    onRefresh();
  }

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total ingrédients', value: ingredients.length, color: 'text-white', sub: null },
          { label: 'Valeur du stock', value: `${totalValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${sym}`, color: 'text-blue-400', sub: null },
          { label: 'Alertes stock', value: alerts.length, color: alerts.length > 0 ? 'text-amber-400' : 'text-emerald-400', sub: null },
          { label: 'Ruptures', value: ingredients.filter(i => i.stock <= 0).length, color: 'text-red-400', sub: null },
        ].map(card => (
          <div key={card.label} className="glass-card rounded-2xl p-4 border border-white/8">
            <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
            <p className="text-white/40 text-xs mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 relative min-w-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un ingrédient..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/40"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"><X size={12} /></button>}
        </div>
        <button
          onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all ${showFilters ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/50'}`}
        >
          <Filter size={13} />
          <ChevronDown size={11} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus size={14} /> Nouvel ingrédient
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 p-3 bg-white/3 border border-white/8 rounded-2xl">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white/70 text-xs focus:outline-none"
              >
                <option value="" className="bg-gray-900">Toutes catégories</option>
                {categories.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
              </select>
              {(['all', 'low', 'out'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStock(s)}
                  className={`px-3 py-1.5 rounded-xl border text-xs transition-all ${filterStock === s ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
                >
                  {s === 'all' ? 'Tous' : s === 'low' ? '⚠ Faible' : '✗ Rupture'}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white/2 border border-white/8 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3 sticky top-0 flex-shrink-0">
          <div className="flex-1 text-white/30 text-xs font-medium">Ingrédient</div>
          <div className="hidden sm:block w-20 text-white/30 text-xs font-medium">Stock</div>
          <div className="hidden md:block w-24 text-white/30 text-xs font-medium">Coût / unité</div>
          <div className="hidden lg:block w-28 text-white/30 text-xs font-medium text-right">Valeur stock</div>
          <div className="w-16 flex-shrink-0" />
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Package size={28} className="text-white/15 mb-3" />
              <p className="text-white/30 text-sm">Aucun ingrédient</p>
              <button onClick={() => { setEditing(null); setShowForm(true); }} className="mt-3 text-blue-400 text-sm flex items-center gap-1">
                <Plus size={13} /> Ajouter
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map(ing => (
                <motion.div
                  key={ing.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{ing.name}</p>
                      {ing.category && (
                        <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-md">{ing.category}</span>
                      )}
                    </div>
                    <p className="text-white/30 text-xs mt-0.5">{ing.unit}</p>
                  </div>
                  <div className="hidden sm:flex w-20 flex-shrink-0">
                    <StockBadge ing={ing} />
                  </div>
                  <div className="hidden md:block w-24 flex-shrink-0">
                    <p className="text-white/70 text-sm">{ing.cost_per_unit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {sym}</p>
                    <p className="text-white/30 text-[10px]">/{ing.unit}</p>
                  </div>
                  <div className="hidden lg:block w-28 flex-shrink-0 text-right">
                    <p className="text-blue-400 text-sm font-semibold">{(ing.stock * ing.cost_per_unit).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity w-16 flex-shrink-0">
                    <button
                      onClick={() => { setEditing(ing); setShowForm(true); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(ing.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <IngredientForm
            ingredient={editing}
            onSave={() => { setShowForm(false); onRefresh(); }}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
