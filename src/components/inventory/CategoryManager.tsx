import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight,
  Salad, Utensils, Flame, Fish, GlassWater, Cake, Sandwich,
  Coffee, Package, BarChart3, type LucideIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useTenant } from '../../context/TenantContext';
import type { Category, Sauce, Flavor } from '../../types/database';

const ICONS: { id: string; icon: LucideIcon }[] = [
  { id: 'utensils', icon: Utensils },
  { id: 'salad', icon: Salad },
  { id: 'flame', icon: Flame },
  { id: 'fish', icon: Fish },
  { id: 'glass-water', icon: GlassWater },
  { id: 'cake', icon: Cake },
  { id: 'sandwich', icon: Sandwich },
  { id: 'coffee', icon: Coffee },
  { id: 'package', icon: Package },
];

const COLORS = [
  '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#06B6D4',
  '#8B5CF6', '#EC4899', '#F97316', '#14B8A6', '#6366F1',
];

function getIcon(name: string): LucideIcon {
  return ICONS.find(i => i.id === name)?.icon ?? Utensils;
}

interface CategoryFormProps {
  initial?: Partial<Category>;
  sauces: Sauce[];
  flavors: Flavor[];
  onSave: (data: Omit<Category, 'id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
}

function CategoryForm({ initial, sauces, flavors, onSave, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'utensils');
  const [color, setColor] = useState(initial?.color ?? '#3B82F6');
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0);
  const [trackStock, setTrackStock] = useState(initial?.track_stock ?? true);
  const [requiresSauce, setRequiresSauce] = useState(initial?.requires_sauce ?? false);
  const [sauceRequired, setSauceRequired] = useState(initial?.sauce_required ?? false);
  const [sauceCount, setSauceCount] = useState(initial?.sauce_count ?? 1);
  const [allowedSauceIds, setAllowedSauceIds] = useState<string[]>(initial?.allowed_sauce_ids ?? []);
  const [requiresFlavor, setRequiresFlavor] = useState(initial?.requires_flavor ?? false);
  const [flavorRequired, setFlavorRequired] = useState(initial?.flavor_required ?? false);
  const [flavorCount, setFlavorCount] = useState(initial?.flavor_count ?? 1);
  const [allowedFlavorIds, setAllowedFlavorIds] = useState<string[]>(initial?.allowed_flavor_ids ?? []);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(), icon, color, sort_order: sortOrder,
      is_active: initial?.is_active ?? true, track_stock: trackStock,
      requires_sauce: requiresSauce, sauce_required: sauceRequired, sauce_count: sauceCount, allowed_sauce_ids: allowedSauceIds,
      requires_flavor: requiresFlavor, flavor_required: flavorRequired, flavor_count: flavorCount, allowed_flavor_ids: allowedFlavorIds,
    });
    setSaving(false);
  }

  const IconComp = getIcon(icon);

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onSubmit={handleSubmit}
      className="bg-gray-800/60 border border-white/10 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-white font-semibold text-sm">{initial?.id ? 'Modifier catégorie' : 'Nouvelle catégorie'}</h3>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/25"
          >
            {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
            Enregistrer
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all flex items-center gap-1.5">
            <X size={14} /> Annuler
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Preview */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border"
          style={{ backgroundColor: color + '22', borderColor: color + '55' }}
        >
          <IconComp size={22} style={{ color }} />
        </div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom de la catégorie"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
          autoFocus
          required
        />
      </div>

      {/* Icons */}
      <div>
        <p className="text-white/40 text-xs mb-2 font-medium">Icône</p>
        <div className="flex flex-wrap gap-2">
          {ICONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setIcon(id)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all
                ${icon === id ? 'border-blue-500/60 bg-blue-500/15 text-blue-400' : 'border-white/10 bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10'}`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <p className="text-white/40 text-xs mb-2 font-medium">Couleur</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-lg transition-all hover:scale-110"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? `0 0 0 3px ${c}44, 0 0 0 1px ${c}` : 'none',
                outline: color === c ? `2px solid white` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-white/40 text-xs font-medium">Ordre d'affichage</label>
        <input
          type="number"
          value={sortOrder}
          onChange={e => setSortOrder(parseInt(e.target.value) || 0)}
          className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/8">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-white/40" />
          <span className="text-white/60 text-sm">Suivi de stock</span>
        </div>
        <button
          type="button"
          onClick={() => setTrackStock(!trackStock)}
          className={`relative w-9 h-5 rounded-full transition-colors ${trackStock ? 'bg-blue-600' : 'bg-white/10'}`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${trackStock ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
        <span className="text-white/30 text-xs ml-2">{trackStock ? 'Activé' : 'Désactivé'}</span>
      </div>
      {!trackStock && (
        <p className="text-amber-400/70 text-xs">Les produits de cette catégorie seront toujours disponibles à la vente, sans limite de stock.</p>
      )}

      <CategoryOptionSection
        title="Sauces"
        enabled={requiresSauce}
        required={sauceRequired}
        count={sauceCount}
        selectedIds={allowedSauceIds}
        options={sauces}
        emptyLabel="Aucune sauce active. Ajoutez-en depuis la gestion des produits."
        onEnabledChange={setRequiresSauce}
        onRequiredChange={setSauceRequired}
        onCountChange={setSauceCount}
        onToggle={id => setAllowedSauceIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])}
      />
      <CategoryOptionSection
        title="Gouts"
        enabled={requiresFlavor}
        required={flavorRequired}
        count={flavorCount}
        selectedIds={allowedFlavorIds}
        options={flavors}
        emptyLabel="Aucun gout actif. Ajoutez-en depuis la gestion des produits."
        onEnabledChange={setRequiresFlavor}
        onRequiredChange={setFlavorRequired}
        onCountChange={setFlavorCount}
        onToggle={id => setAllowedFlavorIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])}
      />
    </motion.form>
  );
}

interface CategoryOption {
  id: string;
  name: string;
  is_active: boolean;
}

interface CategoryOptionSectionProps {
  title: string;
  enabled: boolean;
  required: boolean;
  count: number;
  selectedIds: string[];
  options: CategoryOption[];
  emptyLabel: string;
  onEnabledChange: (value: boolean) => void;
  onRequiredChange: (value: boolean) => void;
  onCountChange: (value: number) => void;
  onToggle: (id: string) => void;
}

function CategoryOptionSection({ title, enabled, required, count, selectedIds, options, emptyLabel, onEnabledChange, onRequiredChange, onCountChange, onToggle }: CategoryOptionSectionProps) {
  const activeOptions = options.filter(option => option.is_active);
  return (
    <div className="bg-white/3 rounded-2xl border border-white/8 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-white/70 text-sm font-semibold">{title} pour cette catégorie</span>
        <button type="button" onClick={() => onEnabledChange(!enabled)} className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-emerald-600' : 'bg-white/10'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onRequiredChange(true)} className={`px-3 py-2 rounded-xl border text-xs ${required ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50'}`}>Obligatoire</button>
            <button type="button" onClick={() => onRequiredChange(false)} className={`px-3 py-2 rounded-xl border text-xs ${!required ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50'}`}>Facultatif</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(value => <button key={value} type="button" onClick={() => onCountChange(value)} className={`px-2 py-2 rounded-xl border text-xs ${count === value ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{value} choix</button>)}
          </div>
          {activeOptions.length === 0 ? <p className="text-white/40 text-xs p-3 rounded-xl bg-white/3 border border-white/8">{emptyLabel}</p> : <div className="flex flex-wrap gap-1.5">{activeOptions.map(option => <button key={option.id} type="button" onClick={() => onToggle(option.id)} className={`px-3 py-1.5 rounded-xl border text-xs ${selectedIds.includes(option.id) ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white/60'}`}>{option.name}</button>)}</div>}
          <p className="text-white/25 text-[10px]">Aucune sélection signifie que tous les éléments actifs seront proposés.</p>
        </>
      )}
    </div>
  );
}

interface CategoryManagerProps {
  categories: Category[];
  onRefresh: () => void;
}

export function CategoryManager({ categories, onRefresh }: CategoryManagerProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sauces, setSauces] = useState<Sauce[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);

  useEffect(() => {
    if (!siteId) return;
    Promise.all([
      supabase.from('sauces').select('id,name,is_active').eq('site_id', siteId).order('sort_order').order('name'),
      supabase.from('flavors').select('id,name,is_active').eq('site_id', siteId).order('sort_order').order('name'),
    ]).then(([sauceResult, flavorResult]) => {
      if (sauceResult.data) setSauces(sauceResult.data as Sauce[]);
      if (flavorResult.data) setFlavors(flavorResult.data as Flavor[]);
    });
  }, [siteId]);

  async function handleCreate(data: Omit<Category, 'id' | 'created_at'>) {
    const dataWithSite = siteId ? { ...data, site_id: siteId } : data;
    const { error } = await supabase.from('categories').insert(dataWithSite);
    if (error) { toast('error', 'Erreur lors de la création'); return; }
    toast('success', 'Catégorie créée');
    setShowForm(false);
    onRefresh();
  }

  async function handleUpdate(id: string, data: Omit<Category, 'id' | 'created_at'>) {
    const { error } = await supabase.from('categories').update(data).eq('id', id);
    if (error) { toast('error', 'Erreur lors de la mise à jour'); return; }
    toast('success', 'Catégorie mise à jour');
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { toast('error', 'Impossible de supprimer cette catégorie'); return; }
    toast('success', 'Catégorie supprimée');
    onRefresh();
  }

  async function handleToggle(cat: Category) {
    const { error } = await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id);
    if (error) { toast('error', 'Erreur'); return; }
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Catégories</h3>
          <p className="text-white/30 text-xs mt-0.5">{categories.length} catégorie{categories.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/25"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <CategoryForm
            sauces={sauces}
            flavors={flavors}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {categories.map(cat => {
            const Icon = getIcon(cat.icon);
            if (editingId === cat.id) {
              return (
                <motion.div key={cat.id} layout>
                  <CategoryForm
                    initial={cat}
                    sauces={sauces}
                    flavors={flavors}
                    onSave={data => handleUpdate(cat.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </motion.div>
              );
            }
            return (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all group
                  ${cat.is_active ? 'border-white/8 bg-white/3 hover:bg-white/5' : 'border-white/5 bg-white/2 opacity-60'}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cat.color + '22', border: `1px solid ${cat.color}44` }}
                >
                  <Icon size={18} style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{cat.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/30 text-xs">Ordre: {cat.sort_order}</span>
                    {!cat.track_stock && (
                      <span className="text-xs text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded">Sans stock</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggle(cat)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                      ${cat.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/30 hover:bg-white/10'}`}
                    title={cat.is_active ? 'Désactiver' : 'Activer'}
                  >
                    {cat.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button
                    onClick={() => setEditingId(cat.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
