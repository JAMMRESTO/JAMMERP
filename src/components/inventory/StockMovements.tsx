import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpCircle, ArrowDownCircle, RefreshCcw, Plus,
  Search, X, Package, Check, ChevronDown, RotateCcw, History, Archive
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { ResetStockModal } from './ResetStockModal';
import type { StockMovement, Product, StockMovementType, ProductComponent, ComponentStockMovementWithComponent, ComponentMovementType } from '../../types/database';

interface MovementWithProduct extends StockMovement {
  product: Pick<Product, 'id' | 'name' | 'unit'> | null;
}

interface DisplayMovement {
  id: string;
  movement_type: StockMovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reason: string;
  created_at: string;
  name: string;
  unit: string;
}

function localISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const movementConfig = {
  in: { label: 'Entrée', icon: ArrowUpCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  out: { label: 'Sortie', icon: ArrowDownCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  adjustment: { label: 'Ajustement', icon: RefreshCcw, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
};

interface AddMovementFormProps {
  products: Product[];
  onSave: () => void;
  onCancel: () => void;
}

function AddMovementForm({ products, onSave, onCancel }: AddMovementFormProps) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<StockMovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(p => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity, 10) || 0;
    if (!productId || qty <= 0) return;
    if (!Number.isInteger(parseFloat(quantity))) {
      toast('error', 'Les produits se comptent en quantités entières');
      return;
    }
    setSaving(true);

    const stockBefore = selectedProduct?.stock ?? 0;
    const stockAfter = type === 'in' ? stockBefore + qty
      : type === 'out' ? Math.max(0, stockBefore - qty)
      : qty;

    const { error: movErr } = await supabase.from('stock_movements').insert({
      product_id: productId,
      type,
      quantity: qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reason,
      user_id: currentUser?.id ?? null,
      site_id: siteId,
    });

    if (!movErr) {
      await supabase.from('products').update({
        stock: stockAfter,
        is_available: stockAfter > 0,
        updated_at: new Date().toISOString(),
      }).eq('id', productId);
    }

    setSaving(false);
    if (movErr) { toast('error', 'Erreur lors de l\'enregistrement'); return; }
    toast('success', 'Mouvement enregistré');
    onSave();
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onSubmit={handleSubmit}
      className="bg-gray-800/60 border border-white/10 rounded-2xl p-5 space-y-4 mb-4"
    >
      <h3 className="text-white font-semibold text-sm">Nouveau mouvement de stock</h3>

      {/* Type */}
      <div className="flex gap-2">
        {(['in', 'out', 'adjustment'] as const).map(t => {
          const cfg = movementConfig[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all
                ${type === t ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
            >
              <Icon size={13} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Product */}
      <div>
        <label className="text-white/60 text-xs font-medium block mb-1.5">Produit</label>
        <select
          value={productId}
          onChange={e => setProductId(e.target.value)}
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
        >
          <option value="" className="bg-gray-900">Sélectionner un produit</option>
          {products.map(p => (
            <option key={p.id} value={p.id} className="bg-gray-900">
              {p.name} {p.track_stock ? `(stock: ${p.stock ?? 0} ${p.unit})` : ''}
            </option>
          ))}
        </select>
        {selectedProduct && (
          <p className="text-white/30 text-xs mt-1">
            Stock actuel: <strong className="text-white/60">{selectedProduct.stock ?? 0} {selectedProduct.unit}</strong>
            {type !== 'adjustment' && (
              <span> → après: <strong className={type === 'in' ? 'text-emerald-400' : 'text-red-400'}>
                {type === 'in' ? (selectedProduct.stock ?? 0) + (parseFloat(quantity) || 0) : Math.max(0, (selectedProduct.stock ?? 0) - (parseFloat(quantity) || 0))} {selectedProduct.unit}
              </strong></span>
            )}
            {type === 'adjustment' && (
              <span> → nouveau: <strong className="text-blue-400">{parseFloat(quantity) || 0} {selectedProduct.unit}</strong></span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/60 text-xs font-medium block mb-1.5">
            {type === 'adjustment' ? 'Nouveau stock' : 'Quantité'}
          </label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            onFocus={e => e.target.select()}
            placeholder="0"
            min={0}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div>
          <label className="text-white/60 text-xs font-medium block mb-1.5">Motif</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex: Livraison fournisseur"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving || !productId || (parseFloat(quantity) || 0) <= 0} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
          {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
          Enregistrer
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-all flex items-center gap-1.5">
          <X size={14} /> Annuler
        </button>
      </div>
    </motion.form>
  );
}

interface AddComponentMovementFormProps {
  components: ProductComponent[];
  onSave: () => void;
  onCancel: () => void;
}

function AddComponentMovementForm({ components, onSave, onCancel }: AddComponentMovementFormProps) {
  const toast = useToast();
  const { currentUser } = useAuth();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [componentId, setComponentId] = useState('');
  const [type, setType] = useState<ComponentMovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedComponent = components.find(c => c.id === componentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(quantity) || 0;
    if (!componentId || qty <= 0) return;
    setSaving(true);

    const stockBefore = selectedComponent?.stock ?? 0;
    const stockAfter = type === 'in' ? stockBefore + qty
      : type === 'out' ? Math.max(0, stockBefore - qty)
      : qty;

    const { error: movErr } = await supabase.from('component_stock_movements').insert({
      component_id: componentId,
      movement_type: type,
      quantity: qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      reason,
      user_id: currentUser?.id ?? null,
      site_id: siteId,
      reference_type: 'manual',
    });

    if (!movErr) {
      await supabase.from('product_components').update({
        stock: stockAfter,
        updated_at: new Date().toISOString(),
      }).eq('id', componentId);
    }

    setSaving(false);
    if (movErr) { toast('error', 'Erreur lors de l\'enregistrement'); return; }
    toast('success', 'Mouvement composant enregistré');
    onSave();
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onSubmit={handleSubmit}
      className="bg-gray-800/60 border border-white/10 rounded-2xl p-5 space-y-4 mb-4"
    >
      <h3 className="text-white font-semibold text-sm">Nouveau mouvement de composant</h3>

      <div className="flex gap-2">
        {(['in', 'out', 'adjustment'] as const).map(t => {
          const cfg = movementConfig[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all
                ${type === t ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
            >
              <Icon size={13} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-white/60 text-xs font-medium block mb-1.5">Composant</label>
        <select
          value={componentId}
          onChange={e => setComponentId(e.target.value)}
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
        >
          <option value="" className="bg-gray-900">Sélectionner un composant</option>
          {components.map(c => (
            <option key={c.id} value={c.id} className="bg-gray-900">
              {c.name} (stock: {c.stock} {c.unit})
            </option>
          ))}
        </select>
        {selectedComponent && (
          <p className="text-white/30 text-xs mt-1">
            Stock actuel: <strong className="text-white/60">{selectedComponent.stock} {selectedComponent.unit}</strong>
            {type !== 'adjustment' && (
              <span> → après: <strong className={type === 'in' ? 'text-emerald-400' : 'text-red-400'}>
                {type === 'in' ? selectedComponent.stock + (parseFloat(quantity) || 0) : Math.max(0, selectedComponent.stock - (parseFloat(quantity) || 0))} {selectedComponent.unit}
              </strong></span>
            )}
            {type === 'adjustment' && (
              <span> → nouveau: <strong className="text-blue-400">{parseFloat(quantity) || 0} {selectedComponent.unit}</strong></span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/60 text-xs font-medium block mb-1.5">
            {type === 'adjustment' ? 'Nouveau stock' : 'Quantité'}
          </label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            onFocus={e => e.target.select()}
            placeholder="0"
            min={0}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div>
          <label className="text-white/60 text-xs font-medium block mb-1.5">Motif</label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex: Livraison fournisseur"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving || !componentId || (parseFloat(quantity) || 0) <= 0} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
          {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
          Enregistrer
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-all flex items-center gap-1.5">
          <X size={14} /> Annuler
        </button>
      </div>
    </motion.form>
  );
}

interface ResetLog {
  id: string;
  performed_by_name: string;
  products_reset: number;
  components_reset: number;
  created_at: string;
}

interface StockMovementsProps {
  products: Product[];
  components?: ProductComponent[];
  useComponentStock?: boolean;
}

export function StockMovements({ products, components = [], useComponentStock = false }: StockMovementsProps) {
  const { currentSite, isSiteManager } = useTenant();
  const { currentUser } = useAuth();
  const toast = useToast();
  const siteId = currentSite?.id ?? null;
  const isTenantOwner = !isSiteManager;
  const isAdmin = isTenantOwner || !!currentUser?.role?.permissions?.all;
  const [movements, setMovements] = useState<DisplayMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<StockMovementType | ''>('');
  const [page, setPage] = useState(0);
  const [resetLogs, setResetLogs] = useState<ResetLog[]>([]);
  const [showResetHistory, setShowResetHistory] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveDate, setArchiveDate] = useState(() => localISODate(new Date()));
  const PAGE_SIZE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    if (useComponentStock) {
      let query = supabase
        .from('component_stock_movements')
        .select('*, component:product_components(id, name, unit)')
        .order('created_at', { ascending: false });
      if (siteId) query = query.eq('site_id', siteId);
      query = query.eq('is_archived', showArchived);
      const { data } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const compData = (data as ComponentStockMovementWithComponent[]) ?? [];
      setMovements(compData.map(m => ({
        id: m.id,
        movement_type: m.movement_type as StockMovementType,
        quantity: m.quantity,
        stock_before: m.stock_before,
        stock_after: m.stock_after,
        reason: m.reason,
        created_at: m.created_at,
        name: m.component?.name ?? 'Composant supprimé',
        unit: m.component?.unit ?? '',
      })));
    } else {
      let query = supabase
        .from('stock_movements')
        .select('*, product:products(id, name, unit)')
        .order('created_at', { ascending: false });
      if (siteId) query = query.eq('site_id', siteId);
      query = query.eq('is_archived', showArchived);
      const { data } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const prodData = (data as MovementWithProduct[]) ?? [];
      setMovements(prodData.map(m => ({
        id: m.id,
        movement_type: m.type,
        quantity: m.quantity,
        stock_before: m.stock_before ?? 0,
        stock_after: m.stock_after ?? 0,
        reason: m.reason,
        created_at: m.created_at,
        name: m.product?.name ?? 'Produit supprimé',
        unit: m.product?.unit ?? '',
      })));
    }
    setLoading(false);
  }, [page, siteId, useComponentStock, showArchived]);

  const loadResetLogs = useCallback(async () => {
    if (!siteId) return;
    const { data } = await supabase
      .from('stock_reset_logs')
      .select('id, performed_by_name, products_reset, components_reset, created_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(20);
    setResetLogs((data as ResetLog[]) ?? []);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  async function handleArchive() {
    if (!siteId) return;
    setArchiving(true);
    const nextDay = new Date(`${archiveDate}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const { data, error } = await supabase.rpc('archive_old_stock_movements', {
      p_site_id: siteId,
      p_before_date: localISODate(nextDay),
    });
    setArchiving(false);
    if (error || !data) {
      toast('error', 'Erreur lors de l\'archivage');
      return;
    }
    const result = data as { products_archived: number; components_archived: number };
    const total = result.products_archived + result.components_archived;
    if (total === 0) {
      toast('error', 'Aucun mouvement à archiver jusqu\'à cette date');
    } else {
      toast('success', `${result.products_archived} produit(s) et ${result.components_archived} composant(s) archivés`);
    }
    setShowArchiveModal(false);
    setPage(0);
    if (showArchived) setShowArchived(false); else load();
  }

  useEffect(() => {
    if (isAdmin && siteId) loadResetLogs();
  }, [isAdmin, siteId, loadResetLogs]);

  const filtered = movements.filter(m => {
    if (filterType && m.movement_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.reason.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalIn = movements.filter(m => m.movement_type === 'in').reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter(m => m.movement_type === 'out').reduce((s, m) => s + m.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: totalIn, ...movementConfig.in },
          { value: totalOut, ...movementConfig.out },
          { label: 'Mouvements', value: movements.length, icon: Package, color: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`flex items-center gap-3 p-3 rounded-2xl border ${s.bg} ${s.border}`}>
              <Icon size={18} className={s.color} />
              <div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-white/30 text-xs">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && siteId && (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setPage(0); setShowArchived(s => !s); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${showArchived ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
          >
            <Archive size={13} /> {showArchived ? 'Voir actifs' : 'Voir archivés'}
          </button>
          <button
            onClick={() => setShowArchiveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-xs font-medium transition-all"
          >
            <Archive size={13} /> Archiver anciens mouvements
          </button>
          <button
            onClick={() => setShowReset(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-medium transition-all"
          >
            <RotateCcw size={13} /> Remettre tout le stock à zéro
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 relative min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={useComponentStock ? 'Rechercher composant ou motif...' : 'Rechercher produit ou motif...'}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/40 transition-all"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"><X size={13} /></button>}
        </div>
        <div className="flex gap-1">
          {(['', 'in', 'out', 'adjustment'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-2.5 rounded-xl text-xs border transition-all ${filterType === t
                ? t === '' ? 'bg-white/10 border-white/20 text-white' : `${movementConfig[t as StockMovementType].bg} ${movementConfig[t as StockMovementType].border} ${movementConfig[t as StockMovementType].color}`
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
            >
              {t === '' ? 'Tous' : movementConfig[t as StockMovementType].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus size={14} /> Mouvement
        </button>
      </div>

      <AnimatePresence>
        {showForm && useComponentStock ? (
          <AddComponentMovementForm
            components={components}
            onSave={() => { setShowForm(false); load(); }}
            onCancel={() => setShowForm(false)}
          />
        ) : showForm ? (
          <AddMovementForm
            products={products.filter(p => p.track_stock)}
            onSave={() => { setShowForm(false); load(); }}
            onCancel={() => setShowForm(false)}
          />
        ) : null}
      </AnimatePresence>

      {/* Movements list */}
      <div className="bg-white/2 rounded-2xl border border-white/8 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 text-white/30 text-xs font-medium">{useComponentStock ? 'Composant' : 'Produit'}</div>
          <div className="hidden sm:block w-20 text-white/30 text-xs font-medium">Qté</div>
          <div className="hidden md:block flex-1 text-white/30 text-xs font-medium">Motif</div>
          <div className="w-32 text-white/30 text-xs font-medium text-right">Date</div>
        </div>

        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-lg bg-white/5 animate-pulse flex-shrink-0" />
                <div className="flex-1 h-4 bg-white/5 rounded animate-pulse" />
                <div className="w-20 h-4 bg-white/5 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <Package size={28} className="text-white/15 mb-3" />
            <p className="text-white/30 text-sm">{showArchived ? 'Aucun mouvement archivé' : 'Aucun mouvement trouvé'}</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(m => {
              const cfg = movementConfig[m.movement_type];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.border} border`}>
                    <Icon size={13} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{m.name}</p>
                    <p className="text-white/30 text-[10px]">{m.stock_before} → {m.stock_after} {m.unit}</p>
                  </div>
                  <div className={`hidden sm:flex items-center gap-1 w-20 font-semibold text-sm ${cfg.color}`}>
                    {m.movement_type === 'in' ? '+' : m.movement_type === 'out' ? '-' : '='}{m.quantity}
                  </div>
                  <div className="hidden md:block flex-1 min-w-0">
                    <p className="text-white/40 text-xs truncate">{m.reason || '—'}</p>
                  </div>
                  <div className="w-32 text-right">
                    <p className="text-white/40 text-xs">
                      {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-white/25 text-[10px]">
                      {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {isAdmin && resetLogs.length > 0 && (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <button
            onClick={() => setShowResetHistory(s => !s)}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/10 border border-amber-500/20">
              <History size={13} className="text-amber-400" />
            </div>
            <span className="flex-1 text-left text-white text-sm font-medium">Historique des remises à zéro</span>
            <span className="text-white/30 text-xs">{resetLogs.length}</span>
            <ChevronDown size={15} className={`text-white/30 transition-transform ${showResetHistory ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showResetHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {resetLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-500/10 border border-red-500/20">
                      <RotateCcw size={12} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{log.performed_by_name}</p>
                      <p className="text-white/30 text-[10px]">
                        {log.products_reset} produit(s) · {log.components_reset} composant(s)
                      </p>
                    </div>
                    <div className="w-40 text-right">
                      <p className="text-white/40 text-xs">
                        {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-white/25 text-[10px]">
                        {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showReset && siteId && (
          <ResetStockModal
            siteId={siteId}
            onClose={() => setShowReset(false)}
            onDone={() => { setShowReset(false); load(); loadResetLogs(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showArchiveModal && siteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && setShowArchiveModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                    <Archive size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-base">Archiver les anciens mouvements</h3>
                    <p className="text-white/50 text-sm mt-1">
                      Tous les mouvements jusqu'à la date sélectionnée (incluse) seront masqués de la liste principale.
                      Vous pourrez toujours les consulter en activant « Voir archivés ».
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowArchiveModal(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all flex-shrink-0">
                  <X size={15} />
                </button>
              </div>

              <div>
                <label className="text-white/60 text-xs font-medium block mb-1.5">
                  Archiver jusqu'au (inclus)
                </label>
                <input
                  type="date"
                  value={archiveDate}
                  max={localISODate(new Date())}
                  onChange={e => setArchiveDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/40 transition-all"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowArchiveModal(false)} disabled={archiving} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition-all disabled:opacity-40">
                  Annuler
                </button>
                <button type="button" onClick={handleArchive} disabled={archiving} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-all disabled:opacity-40">
                  {archiving && <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />}
                  <Archive size={14} /> Archiver
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {movements.length >= PAGE_SIZE && (
        <button
          onClick={() => setPage(p => p + 1)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-white/50 hover:text-white/80 text-sm transition-all"
        >
          <ChevronDown size={15} /> Charger plus
        </button>
      )}
    </div>
  );
}
