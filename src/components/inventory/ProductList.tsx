import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, AlertTriangle,
  CheckCircle2, XCircle, Filter, Package, TrendingUp,
  ChevronDown, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useSettings } from '../../context/SettingsContext';
import type { Product, Category } from '../../types/database';

interface StockBadgeProps {
  product: Product;
}

function StockBadge({ product }: StockBadgeProps) {
  if (!product.track_stock || product.stock === null) {
    return <span className="text-xs text-white/30 px-2 py-0.5 rounded-lg bg-white/5">Non suivi</span>;
  }
  if (product.stock <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">
        <XCircle size={10} /> Rupture
      </span>
    );
  }
  if (product.stock <= product.low_stock_threshold) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
        <AlertTriangle size={10} /> {product.stock} {product.unit}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-lg">
      <CheckCircle2 size={10} /> {product.stock} {product.unit}
    </span>
  );
}

interface ProductRowProps {
  product: Product;
  category: Category | undefined;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
  onToggleAvailable: (p: Product) => void;
}

function ProductRow({ product, category, onEdit, onDelete, onToggleAvailable }: ProductRowProps) {
  const { settings } = useSettings();
  const sym = settings.currency_symbol;
  const margin = product.price > 0
    ? Math.round(((product.price - product.cost_price) / product.price) * 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-white/3 transition-colors border-b border-white/5 group last:border-0"
    >
      {/* Image */}
      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={14} className="sm:hidden text-white/20" />
            <Package size={16} className="hidden sm:block text-white/20" />
          </div>
        )}
      </div>

      {/* Name + code */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <p className="text-white font-medium text-xs sm:text-sm truncate">{product.name}</p>
          {!product.is_available && (
            <span className="text-[9px] sm:text-[10px] text-red-400/70 bg-red-500/10 px-1 sm:px-1.5 py-0.5 rounded-md flex-shrink-0">Indispo</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
          <span className="text-white/30 text-[9px] sm:text-[10px] font-mono">{product.product_code}</span>
          {category && (
            <span className="text-[9px] sm:text-[10px] text-white/30 hidden sm:inline">· {category.name}</span>
          )}
        </div>
      </div>

      {/* Stock */}
      <div className="hidden md:flex flex-shrink-0">
        <StockBadge product={product} />
      </div>

      {/* Margin */}
      <div className="hidden lg:flex flex-col items-end flex-shrink-0 w-16">
        <span className={`text-xs sm:text-sm font-bold ${margin >= 50 ? 'text-emerald-400' : margin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
          {margin}%
        </span>
        <span className="text-white/30 text-[9px] sm:text-[10px]">marge</span>
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right w-16 sm:w-24">
        <p className="text-white font-semibold text-xs sm:text-sm">{product.price.toLocaleString('fr-FR')} <span className="hidden sm:inline">{sym}</span></p>
        {product.cost_price > 0 && (
          <p className="text-white/30 text-[9px] sm:text-[10px] hidden sm:block">coût: {product.cost_price.toLocaleString('fr-FR')}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onToggleAvailable(product)}
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center transition-all
            ${product.is_available ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/30 hover:bg-white/10'}`}
          title={product.is_available ? 'Rendre indisponible' : 'Rendre disponible'}
        >
          <CheckCircle2 size={11} className="sm:hidden" />
          <CheckCircle2 size={13} className="hidden sm:block" />
        </button>
        <button
          onClick={() => onEdit(product)}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
        >
          <Pencil size={11} className="sm:hidden" />
          <Pencil size={13} className="hidden sm:block" />
        </button>
        <button
          onClick={() => onDelete(product.id)}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 size={11} className="sm:hidden" />
          <Trash2 size={13} className="hidden sm:block" />
        </button>
      </div>
    </motion.div>
  );
}

interface ProductListProps {
  products: Product[];
  categories: Category[];
  onEdit: (p: Product) => void;
  onNew: () => void;
  onRefresh: () => void;
}

export function ProductList({ products, categories, onEdit, onNew, onRefresh }: ProductListProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const catMap = new Map(categories.map(c => [c.id, c]));

  const filtered = products.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.product_code.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (filterStock === 'out' && (p.stock ?? 0) > 0) return false;
    if (filterStock === 'low' && (p.stock === null || p.stock <= 0 || p.stock > p.low_stock_threshold)) return false;
    if (filterStock === 'ok' && (p.stock === null || p.stock <= p.low_stock_threshold)) return false;
    return true;
  });

  const lowStockCount = products.filter(p => p.track_stock && p.stock !== null && p.stock > 0 && p.stock <= p.low_stock_threshold).length;
  const outStockCount = products.filter(p => p.track_stock && (p.stock ?? 0) <= 0).length;

  async function handleDelete(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast('error', 'Impossible de supprimer ce produit'); return; }
    toast('success', 'Produit supprimé');
    onRefresh();
  }

  async function handleToggleAvailable(product: Product) {
    const { error } = await supabase.from('products').update({ is_available: !product.is_available }).eq('id', product.id);
    if (error) { toast('error', 'Erreur'); return; }
    onRefresh();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
        <div className="flex-1 relative min-w-0">
          <Search size={12} className="sm:hidden absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <Search size={14} className="hidden sm:block absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 sm:pl-9 pr-8 py-2 sm:py-2.5 text-white text-xs sm:text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/40 transition-all"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"><X size={12} className="sm:hidden" /><X size={13} className="hidden sm:block" /></button>}
        </div>
        <button
          onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border text-xs sm:text-sm transition-all ${showFilters ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
        >
          <Filter size={12} className="sm:hidden" />
          <Filter size={14} className="hidden sm:block" />
          <span className="hidden sm:inline">Filtres</span>
          <ChevronDown size={11} className={`sm:hidden transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          <ChevronDown size={12} className={`hidden sm:block transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onNew}
          className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus size={12} className="sm:hidden" />
          <Plus size={14} className="hidden sm:block" />
          <span className="hidden sm:inline">Nouveau</span>
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-2 sm:mb-3"
          >
            <div className="flex flex-wrap gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/3 border border-white/8 rounded-xl sm:rounded-2xl">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 text-white/70 text-[10px] sm:text-xs focus:outline-none transition-all"
              >
                <option value="" className="bg-gray-900">Toutes catégories</option>
                {categories.map(c => <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>)}
              </select>
              {(['all', 'ok', 'low', 'out'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStock(s)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs transition-all ${filterStock === s ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
                >
                  {s === 'all' ? 'Tous' : s === 'ok' ? 'Normal' : s === 'low' ? 'Faible' : 'Rupture'}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert chips */}
      {(lowStockCount > 0 || outStockCount > 0) && (
        <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
          {outStockCount > 0 && (
            <button onClick={() => setFilterStock('out')} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-all">
              <AlertTriangle size={10} className="sm:hidden" />
              <AlertTriangle size={11} className="hidden sm:block" />
              <span className="hidden sm:inline">{outStockCount} rupture{outStockCount > 1 ? 's' : ''}</span>
              <span className="sm:hidden">{outStockCount}</span>
            </button>
          )}
          {lowStockCount > 0 && (
            <button onClick={() => setFilterStock('low')} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 transition-all">
              <AlertTriangle size={10} className="sm:hidden" />
              <AlertTriangle size={11} className="hidden sm:block" />
              <span className="hidden sm:inline">{lowStockCount} stock bas</span>
              <span className="sm:hidden">{lowStockCount}</span>
            </button>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <span className="text-white/30 text-[10px] sm:text-xs">
          {filtered.length} / {products.length} produit{products.length !== 1 ? 's' : ''}
        </span>
        {(search || filterCategory || filterStock !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterCategory(''); setFilterStock('all'); }}
            className="flex items-center gap-1 text-white/30 hover:text-white/60 text-[10px] sm:text-xs transition-colors"
          >
            <X size={9} className="sm:hidden" />
            <X size={10} className="hidden sm:block" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-white/2 rounded-xl sm:rounded-2xl border border-white/8 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/8 bg-white/3 sticky top-0">
          <div className="w-9 sm:w-11 flex-shrink-0" />
          <div className="flex-1 text-white/30 text-[10px] sm:text-xs font-medium">Produit</div>
          <div className="hidden md:block w-20 sm:w-24 text-white/30 text-[10px] sm:text-xs font-medium">Stock</div>
          <div className="hidden lg:block w-16 text-white/30 text-[10px] sm:text-xs font-medium text-right">Marge</div>
          <div className="w-16 sm:w-24 text-white/30 text-[10px] sm:text-xs font-medium text-right">Prix</div>
          <div className="w-14 sm:w-20 flex-shrink-0" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <Package size={24} className="sm:hidden text-white/15 mb-3" />
            <Package size={32} className="hidden sm:block text-white/15 mb-3" />
            <p className="text-white/30 font-medium text-sm sm:text-base">Aucun produit trouvé</p>
            <button onClick={onNew} className="mt-3 sm:mt-4 flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs sm:text-sm transition-colors">
              <Plus size={12} className="sm:hidden" />
              <Plus size={14} className="hidden sm:block" />
              Créer un produit
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(p => (
              <ProductRow
                key={p.id}
                product={p}
                category={p.category_id ? catMap.get(p.category_id) : undefined}
                onEdit={onEdit}
                onDelete={handleDelete}
                onToggleAvailable={handleToggleAvailable}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
