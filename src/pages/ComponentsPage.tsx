import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Archive, RotateCcw, X, Check, Package, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCcw, ChevronDown, Search, Loader2, Printer
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import type {
  ProductComponent, ComponentStockMovement, ComponentStockMovementWithComponent, ComponentMovementType
} from '../types/database';

const UNITS = ['pièce', 'kg', 'g', 'litre', 'cl', 'ml', 'portion', 'boîte', 'sachet', 'bouteille', 'lot'];

type Tab = 'list' | 'movements';

const movementConfig: Record<ComponentMovementType, { label: string; color: string; bg: string; border: string; icon: typeof TrendingUp }> = {
  in: { label: 'Entrée', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp },
  out: { label: 'Sortie', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: TrendingDown },
  adjustment: { label: 'Ajustement', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: RefreshCcw },
};

export function ComponentsPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [tab, setTab] = useState<Tab>('list');
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [movements, setMovements] = useState<ComponentStockMovementWithComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState(30);

  const loadData = useCallback(async () => {
    if (!siteId) { setLoading(false); return; }
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const [compRes, movRes] = await Promise.all([
      supabase.from('product_components').select('*').eq('site_id', siteId).order('name'),
      supabase.from('component_stock_movements')
        .select('*, component:product_components(id, name, unit)')
        .eq('site_id', siteId)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false }),
    ]);
    setComponents((compRes.data ?? []) as ProductComponent[]);
    setMovements((movRes.data ?? []) as ComponentStockMovementWithComponent[]);
    setLoading(false);
  }, [siteId, periodDays]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-white/30" size={32} />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'list', label: 'Composants' },
    { id: 'movements', label: 'Mouvements' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mx-4 mt-4 mb-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/8 flex-shrink-0 w-fit">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                ${tab === t.id ? 'text-white shadow-lg' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              style={tab === t.id ? { backgroundColor: 'var(--color-primary)' } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'movements' && (
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/8">
            <span className="text-white/30 text-[10px] pl-1">Période:</span>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setPeriodDays(d)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${periodDays === d ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}
              >
                {d}j
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait">
          {tab === 'list' && (
            <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ComponentList components={components} siteId={siteId} onRefresh={loadData} />
            </motion.div>
          )}
          {tab === 'movements' && (
            <motion.div key="mov" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <ComponentMovements movements={movements} components={components} siteId={siteId} periodDays={periodDays} onRefresh={loadData} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================
// Component List + CRUD
// ============================================================
interface ComponentListProps {
  components: ProductComponent[];
  siteId: string | null;
  onRefresh: () => void;
}

function ComponentList({ components, siteId, onRefresh }: ComponentListProps) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductComponent | null>(null);
  const [search, setSearch] = useState('');

  const filtered = components.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.reference.toLowerCase().includes(search.toLowerCase())
  );

  const totalStockValue = components.reduce((sum, c) => sum + c.stock * c.avg_cost, 0);
  const lowStockCount = components.filter(c => c.is_active && c.stock <= c.low_stock_threshold).length;

  async function handleDelete(id: string) {
    const { error } = await supabase.from('product_components').update({ is_active: false }).eq('id', id);
    if (error) { toast('error', 'Impossible d\'archiver ce composant'); return; }
    toast('success', 'Composant archivé');
    setPendingDelete(null);
    onRefresh();
  }

  async function handleRestore(id: string, name: string) {
    const { error } = await supabase.from('product_components').update({ is_active: true }).eq('id', id);
    if (error) { toast('error', 'Erreur lors de la restauration'); return; }
    toast('success', `${name} restauré`);
    onRefresh();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <div className="flex items-center gap-2 mb-1">
            <Package size={15} className="text-blue-400" />
            <span className="text-white/50 text-xs">Composants</span>
          </div>
          <p className="text-white text-2xl font-bold">{components.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-amber-400" />
            <span className="text-white/50 text-xs">Stock bas</span>
          </div>
          <p className="text-white text-2xl font-bold">{lowStockCount}</p>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-white/8">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={15} className="text-emerald-400" />
            <span className="text-white/50 text-xs">Valeur stock</span>
          </div>
          <p className="text-white text-2xl font-bold">{Math.round(totalStockValue).toLocaleString('fr-FR')}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un composant..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/25 whitespace-nowrap"
        >
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <ComponentForm
            component={editingId ? components.find(c => c.id === editingId) ?? null : null}
            siteId={siteId}
            onSave={() => { setShowForm(false); setEditingId(null); onRefresh(); }}
            onCancel={() => { setShowForm(false); setEditingId(null); }}
          />
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map(comp => {
            const isLow = comp.is_active && comp.stock <= comp.low_stock_threshold;
            const isOut = comp.is_active && comp.stock <= 0;
            return (
              <motion.div
                key={comp.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all group
                  ${comp.is_active ? 'border-white/8 bg-white/3 hover:bg-white/5' : 'border-white/5 bg-white/2 opacity-60'}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10">
                  <Package size={18} className="text-white/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium text-sm ${comp.is_active ? 'text-white' : 'text-white/50 line-through'}`}>{comp.name}</p>
                    {comp.reference && (
                      <span className="text-white/30 text-xs font-mono">{comp.reference}</span>
                    )}
                    {!comp.is_active && (
                      <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">Archivé</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-white/40 text-xs">Stock: {comp.stock} {comp.unit}</span>
                    <span className="text-white/30 text-xs">Prix achat: {comp.avg_cost.toLocaleString('fr-FR')} F</span>
                    <span className="text-white/40 text-xs font-medium">Valeur: {(comp.stock * comp.avg_cost).toLocaleString('fr-FR')} F</span>
                    {isOut ? (
                      <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">Rupture</span>
                    ) : isLow ? (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Stock bas</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {comp.is_active ? (
                    <>
                      <button
                        onClick={() => { setEditingId(comp.id); setShowForm(true); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(comp)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                        title="Archiver"
                      >
                        <Archive size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleRestore(comp.id, comp.name)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-all"
                      title="Restaurer"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && !showForm && (
          <div className="text-center py-12">
            <Package size={32} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Aucun composant. Cliquez sur « Ajouter » pour commencer.</p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-base">Archiver le composant</h3>
                  <p className="text-white/50 text-sm mt-1">
                    <span className="text-white font-medium">{pendingDelete.name}</span> sera archivé. Il ne sera plus proposé pour les nouvelles opérations mais restera visible dans l'historique et les rapports. Vous pourrez le restaurer à tout moment.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setPendingDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-all">Annuler</button>
                <button onClick={() => handleDelete(pendingDelete.id)} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-all shadow-lg shadow-amber-600/25">Archiver</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Component Form
// ============================================================
interface ComponentFormProps {
  component: ProductComponent | null;
  siteId: string | null;
  onSave: () => void;
  onCancel: () => void;
}

function ComponentForm({ component, siteId, onSave, onCancel }: ComponentFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: component?.name ?? '',
    reference: component?.reference ?? '',
    unit: component?.unit ?? 'pièce',
    avg_cost: component?.avg_cost ?? 0,
    low_stock_threshold: component?.low_stock_threshold ?? 5,
    is_active: component?.is_active ?? true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, site_id: siteId };
    let error;
    if (component) {
      ({ error } = await supabase.from('product_components').update(payload).eq('id', component.id));
    } else {
      ({ error } = await supabase.from('product_components').insert(payload));
    }
    setSaving(false);
    if (error) { toast('error', 'Erreur lors de l\'enregistrement'); return; }
    toast('success', component ? 'Composant mis à jour' : 'Composant créé');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="glass-card rounded-2xl border border-white/8 p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">{component ? 'Modifier le composant' : 'Nouveau composant'}</h3>
        <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
          <X size={17} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-white/60 text-sm font-medium block mb-1.5">Désignation *</label>
            <input
              type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Tenders pièce" required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm font-medium block mb-1.5">Référence</label>
            <input
              type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              placeholder="Ex: TEND-001"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-white/60 text-sm font-medium block mb-1.5">Unité</label>
            <select
              value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
            >
              {UNITS.map(u => <option key={u} value={u} className="bg-gray-900">{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-white/60 text-sm font-medium block mb-1.5">Prix d'achat unit.</label>
            <input
              type="number" value={form.avg_cost || ''} onChange={e => setForm(f => ({ ...f, avg_cost: parseFloat(e.target.value) || 0 }))}
              placeholder="0" min={0} step="1"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <div>
            <label className="text-white/60 text-sm font-medium block mb-1.5">Seuil d'alerte</label>
            <input
              type="number" value={form.low_stock_threshold || ''} onChange={e => setForm(f => ({ ...f, low_stock_threshold: parseInt(e.target.value) || 0 }))}
              placeholder="5" min={0}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/50 text-sm">Actif</span>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-emerald-600' : 'bg-white/10'}`}
          >
            <motion.div
              animate={{ x: form.is_active ? 20 : 2 }}
              transition={{ type: 'spring', damping: 20, stiffness: 400 }}
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
            />
          </button>
        </div>
        <p className="text-white/30 text-xs">
          Le stock n'est pas saisi ici. Utilisez les achats (réception) ou les mouvements d'inventaire pour ajuster le stock.
        </p>
        <div className="flex gap-3 pt-2">
          <motion.button
            type="submit" disabled={saving || !form.name.trim()}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm shadow-xl shadow-blue-600/25 transition-all"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
            {component ? 'Mettre à jour' : 'Créer le composant'}
          </motion.button>
          <button type="button" onClick={onCancel} className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition-all">Annuler</button>
        </div>
      </form>
    </motion.div>
  );
}

// ============================================================
// Component Movements
// ============================================================
interface ComponentMovementsProps {
  movements: ComponentStockMovementWithComponent[];
  components: ProductComponent[];
  siteId: string | null;
  periodDays: number;
  onRefresh: () => void;
}

function ComponentMovements({ movements, components, siteId, periodDays, onRefresh }: ComponentMovementsProps) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<ComponentMovementType | ''>('');
  const [search, setSearch] = useState('');
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  const filtered = movements.filter(m => {
    if (filterType && m.movement_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (m.component?.name ?? '').toLowerCase().includes(q) || m.reason.toLowerCase().includes(q);
    }
    return true;
  });

  const totalIn = movements.filter(m => m.movement_type === 'in').reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter(m => m.movement_type === 'out').reduce((s, m) => s + m.quantity, 0);

  // Group movements by component
  const byComponent = useMemo(() => {
    const map: Record<string, ComponentStockMovementWithComponent[]> = {};
    filtered.forEach(m => {
      const key = m.component_id;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [filtered]);

  const componentSummary = useMemo(() => {
    return Object.entries(byComponent).map(([compId, movs]) => {
      const comp = components.find(c => c.id === compId);
      const inTotal = movs.filter(m => m.movement_type === 'in').reduce((s, m) => s + m.quantity, 0);
      const outTotal = movs.filter(m => m.movement_type === 'out').reduce((s, m) => s + m.quantity, 0);
      return { compId, name: comp?.name ?? 'Composant supprimé', unit: comp?.unit ?? '', inTotal, outTotal, count: movs.length, movs };
    }).sort((a, b) => b.count - a.count);
  }, [byComponent, components]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Print-only report */}
      <div className="hidden print:block">
        <ComponentMovementsPrintReport summary={componentSummary} periodDays={periodDays} />
      </div>

      <div className="no-print">
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card rounded-2xl p-4 border border-white/8">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={15} className="text-emerald-400" /><span className="text-white/50 text-xs">Entrées</span></div>
            <p className="text-white text-2xl font-bold">{totalIn.toLocaleString('fr-FR')}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-white/8">
            <div className="flex items-center gap-2 mb-1"><TrendingDown size={15} className="text-red-400" /><span className="text-white/50 text-xs">Sorties</span></div>
            <p className="text-white text-2xl font-bold">{totalOut.toLocaleString('fr-FR')}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-white/8">
            <div className="flex items-center gap-2 mb-1"><RefreshCcw size={15} className="text-blue-400" /><span className="text-white/50 text-xs">Mouvements</span></div>
            <p className="text-white text-2xl font-bold">{movements.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/8">
            {(['', 'in', 'out', 'adjustment'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                {t === '' ? 'Tous' : movementConfig[t].label}
              </button>
            ))}
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-all whitespace-nowrap"
          >
            <Printer size={16} /> Imprimer
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/25 whitespace-nowrap"
          >
            <Plus size={16} /> Mouvement
          </button>
        </div>

        <AnimatePresence>
          {showForm && (
            <AddComponentMovementForm
              components={components}
              siteId={siteId}
              currentUser={currentUser}
              onSave={() => { setShowForm(false); onRefresh(); }}
              onCancel={() => setShowForm(false)}
            />
          )}
        </AnimatePresence>

        {/* Detailed per-component sections */}
        <div className="space-y-2 mt-4">
          {componentSummary.map(({ compId, name, unit, inTotal, outTotal, count, movs }) => {
            const expanded = expandedComponent === compId;
            return (
              <div key={compId} className="bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-hidden">
                <div
                  className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedComponent(expanded ? null : compId)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10">
                      <Package size={15} className="text-white/50" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{name}</p>
                      <p className="text-white/30 text-xs">{count} mouvement{count > 1 ? 's' : ''} · {periodDays}j</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-emerald-400 text-xs font-medium">+{inTotal.toLocaleString('fr-FR')} {unit}</p>
                      <p className="text-red-400 text-xs font-medium">-{outTotal.toLocaleString('fr-FR')} {unit}</p>
                    </div>
                    {expanded ? <ChevronDown size={16} className="text-white/30 rotate-180 transition-transform" /> : <ChevronDown size={16} className="text-white/30 transition-transform" />}
                  </div>
                </div>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/[0.04] p-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-white/30 text-[10px] uppercase">
                              <th className="text-left py-2 px-2 font-medium">Date</th>
                              <th className="text-left py-2 px-2 font-medium">Type</th>
                              <th className="text-right py-2 px-2 font-medium">Quantité</th>
                              <th className="text-right py-2 px-2 font-medium">Stock avant</th>
                              <th className="text-right py-2 px-2 font-medium">Stock après</th>
                              <th className="text-left py-2 px-2 font-medium">Motif</th>
                            </tr>
                          </thead>
                          <tbody>
                            {movs.map(m => {
                              const cfg = movementConfig[m.movement_type as ComponentMovementType] ?? movementConfig.adjustment;
                              return (
                                <tr key={m.id} className="border-t border-white/[0.03]">
                                  <td className="py-2 px-2 text-white/60">
                                    {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    <span className="text-white/30 ml-1">{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </td>
                                  <td className="py-2 px-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.color} ${cfg.border} border`}>
                                      {cfg.label}
                                    </span>
                                  </td>
                                  <td className={`py-2 px-2 text-right font-medium ${m.movement_type === 'in' ? 'text-emerald-400' : m.movement_type === 'out' ? 'text-red-400' : 'text-blue-400'}`}>
                                    {m.movement_type === 'in' ? '+' : m.movement_type === 'out' ? '-' : ''}{m.quantity} {unit}
                                  </td>
                                  <td className="py-2 px-2 text-right text-white/40">{m.stock_before} {unit}</td>
                                  <td className="py-2 px-2 text-right text-white/60">{m.stock_after} {unit}</td>
                                  <td className="py-2 px-2 text-white/50 max-w-[200px] truncate">{m.reason || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {componentSummary.length === 0 && !showForm && (
            <div className="text-center py-12">
              <RefreshCcw size={32} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Aucun mouvement sur cette période.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Add Component Movement Form
// ============================================================
interface AddComponentMovementFormProps {
  components: ProductComponent[];
  siteId: string | null;
  currentUser: { id: string } | null;
  onSave: () => void;
  onCancel: () => void;
}

function AddComponentMovementForm({ components, siteId, currentUser, onSave, onCancel }: AddComponentMovementFormProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [componentId, setComponentId] = useState('');
  const [type, setType] = useState<ComponentMovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const selected = components.find(c => c.id === componentId);
  const stockBefore = selected?.stock ?? 0;
  const qty = parseFloat(quantity) || 0;
  const stockAfter = type === 'in' ? stockBefore + qty : type === 'out' ? Math.max(0, stockBefore - qty) : qty;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity) || 0;
    if (!componentId || qty <= 0) return;
    setSaving(true);
    const { error: movError } = await supabase.from('component_stock_movements').insert({
      site_id: siteId,
      component_id: componentId,
      movement_type: type,
      quantity: qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reason: reason.trim(),
      user_id: currentUser?.id ?? null,
      reference_type: 'adjustment',
    });
    if (movError) { toast('error', 'Erreur lors du mouvement'); setSaving(false); return; }

    const { error: updateError } = await supabase.from('product_components')
      .update({ stock: stockAfter, updated_at: new Date().toISOString() })
      .eq('id', componentId);
    if (updateError) { toast('error', 'Erreur lors de la mise à jour du stock'); setSaving(false); return; }

    toast('success', 'Mouvement enregistré');
    setSaving(false);
    onSave();
  }

  const activeComponents = components.filter(c => c.is_active);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="glass-card rounded-2xl border border-white/8 p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">Nouveau mouvement</h3>
        <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
          <X size={17} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/8">
          {(['in', 'out', 'adjustment'] as const).map(t => {
            const cfg = movementConfig[t];
            const Icon = cfg.icon;
            return (
              <button
                key={t} type="button"
                onClick={() => setType(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${type === t ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : 'text-white/40 hover:text-white/70'}`}
              >
                <Icon size={13} /> {cfg.label}
              </button>
            );
          })}
        </div>
        <div>
          <label className="text-white/60 text-sm font-medium block mb-1.5">Composant *</label>
          <select
            value={componentId} onChange={e => setComponentId(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          >
            <option value="" className="bg-gray-900">Sélectionner...</option>
            {activeComponents.map(c => (
              <option key={c.id} value={c.id} className="bg-gray-900">{c.name} (stock: {c.stock} {c.unit})</option>
            ))}
          </select>
        </div>
        {selected && (
          <p className="text-white/30 text-xs">Stock actuel: {stockBefore} {selected.unit} → Après: {stockAfter} {selected.unit}</p>
        )}
        <div>
          <label className="text-white/60 text-sm font-medium block mb-1.5">
            {type === 'adjustment' ? 'Nouveau stock' : 'Quantité'}
          </label>
          <input
            type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
            placeholder="0" min={0} step={1}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div>
          <label className="text-white/60 text-sm font-medium block mb-1.5">Motif</label>
          <input
            type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Ex: Réapprovisionnement, perte, inventaire..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <motion.button
            type="submit" disabled={saving || !componentId}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm shadow-xl shadow-blue-600/25 transition-all"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
            Enregistrer
          </motion.button>
          <button type="button" onClick={onCancel} className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition-all">Annuler</button>
        </div>
      </form>
    </motion.div>
  );
}

// ============================================================
// Print Report Component
// ============================================================
interface ComponentSummaryEntry {
  compId: string;
  name: string;
  unit: string;
  inTotal: number;
  outTotal: number;
  count: number;
  movs: ComponentStockMovementWithComponent[];
}

function ComponentMovementsPrintReport({ summary, periodDays }: { summary: ComponentSummaryEntry[]; periodDays: number }) {
  return (
    <div>
      <h1>Mouvements de composants</h1>
      <p style={{ marginBottom: '12pt' }}>
        <strong>Période:</strong> {periodDays} derniers jours &nbsp;|&nbsp;
        <strong>Édité le:</strong> {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {summary.length === 0 ? (
        <p>Aucun mouvement sur cette période.</p>
      ) : (
        summary.map(({ compId, name, unit, inTotal, outTotal, movs }) => (
          <div key={compId} style={{ marginBottom: '16pt' }} className="page-break-inside-avoid">
            <h2>{name}</h2>
            <p style={{ marginBottom: '6pt' }}>
              Entrées: <strong>+{inTotal.toLocaleString('fr-FR')} {unit}</strong> &nbsp;|&nbsp;
              Sorties: <strong>-{outTotal.toLocaleString('fr-FR')} {unit}</strong> &nbsp;|&nbsp;
              {movs.length} mouvement{movs.length > 1 ? 's' : ''}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Quantité</th>
                  <th style={{ textAlign: 'right' }}>Stock avant</th>
                  <th style={{ textAlign: 'right' }}>Stock après</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {movs.map(m => {
                  const typeLabel = m.movement_type === 'in' ? 'Entrée' : m.movement_type === 'out' ? 'Sortie' : 'Ajustement';
                  const sign = m.movement_type === 'in' ? '+' : m.movement_type === 'out' ? '-' : '';
                  return (
                    <tr key={m.id}>
                      <td>
                        {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {' '}
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>{typeLabel}</td>
                      <td style={{ textAlign: 'right' }}>{sign}{m.quantity} {unit}</td>
                      <td style={{ textAlign: 'right' }}>{m.stock_before} {unit}</td>
                      <td style={{ textAlign: 'right' }}>{m.stock_after} {unit}</td>
                      <td>{m.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
