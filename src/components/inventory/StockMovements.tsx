import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpCircle, ArrowDownCircle, RefreshCcw, Plus,
  Search, X, Package, Check, ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import type { StockMovement, Product, StockMovementType } from '../../types/database';

interface MovementWithProduct extends StockMovement {
  product: Pick<Product, 'id' | 'name' | 'unit'> | null;
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
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(p => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || quantity <= 0) return;
    setSaving(true);

    const stockBefore = selectedProduct?.stock ?? 0;
    const stockAfter = type === 'in' ? stockBefore + quantity
      : type === 'out' ? Math.max(0, stockBefore - quantity)
      : quantity;

    const { error: movErr } = await supabase.from('stock_movements').insert({
      product_id: productId,
      movement_type: type,
      quantity,
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
                {type === 'in' ? (selectedProduct.stock ?? 0) + quantity : Math.max(0, (selectedProduct.stock ?? 0) - quantity)} {selectedProduct.unit}
              </strong></span>
            )}
            {type === 'adjustment' && (
              <span> → nouveau: <strong className="text-blue-400">{quantity} {selectedProduct.unit}</strong></span>
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
            value={quantity || ''}
            onChange={e => setQuantity(parseInt(e.target.value) || 0)}
            onFocus={e => e.target.select()}
            placeholder="0"
            min={1}
            required
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
        <button type="submit" disabled={saving || !productId} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
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

interface StockMovementsProps {
  products: Product[];
}

export function StockMovements({ products }: StockMovementsProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [movements, setMovements] = useState<MovementWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<StockMovementType | ''>('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('stock_movements')
      .select('*, product:products(id, name, unit)')
      .order('created_at', { ascending: false });
    if (siteId) query = query.eq('site_id', siteId);
    const { data } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    setMovements((data as MovementWithProduct[]) ?? []);
    setLoading(false);
  }, [page, siteId]);

  useEffect(() => { load(); }, [load]);

  const filtered = movements.filter(m => {
    if (filterType && m.movement_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.product?.name.toLowerCase().includes(q) && !m.reason.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Summary stats
  const totalIn = movements.filter(m => m.movement_type === 'in').reduce((s, m) => s + m.quantity, 0);
  const totalOut = movements.filter(m => m.movement_type === 'out').reduce((s, m) => s + m.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Entrées', value: totalIn, ...movementConfig.in },
          { label: 'Sorties', value: totalOut, ...movementConfig.out },
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

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 relative min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher produit ou motif..."
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
        {showForm && (
          <AddMovementForm
            products={products.filter(p => p.track_stock)}
            onSave={() => { setShowForm(false); load(); }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Movements list */}
      <div className="bg-white/2 rounded-2xl border border-white/8 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 text-white/30 text-xs font-medium">Produit</div>
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
            <p className="text-white/30 text-sm">Aucun mouvement trouvé</p>
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
                    <p className="text-white text-sm font-medium truncate">{m.product?.name ?? 'Produit supprimé'}</p>
                    <p className="text-white/30 text-[10px]">{m.stock_before} → {m.stock_after} {m.product?.unit}</p>
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
