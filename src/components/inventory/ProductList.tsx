import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Pencil, Trash2, AlertTriangle,
  CheckCircle2, XCircle, Filter, Package,
  ChevronDown, X, Download, Upload, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
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
  const { currentSite } = useTenant();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function handleExportXLS() {
    const data = products.map(p => {
      const cat = p.category_id ? catMap.get(p.category_id) : undefined;
      return {
        nom: p.name,
        code: p.product_code,
        categorie: cat?.name ?? '',
        prix: p.price,
        cout: p.cost_price,
        stock: p.stock ?? '',
        seuil_alerte: p.low_stock_threshold,
        unite: p.unit,
        suivi_stock: p.track_stock ? 'oui' : 'non',
        disponible: p.is_available ? 'oui' : 'non',
        description: p.description,
        variantes: (p.variants ?? []).map(v => v.price ? `${v.label}:${v.price}` : v.label).join(';'),
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const colWidths = [
      { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      { wch: 30 }, { wch: 30 },
    ];
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produits');
    XLSX.writeFile(wb, `produits_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast('success', `${products.length} produit(s) exporté(s)`);
  }

  function handleDownloadTemplate() {
    const templateData = [
      { nom: 'Poulet Yassa', code: 'YASS-001', categorie: 'Plats', prix: 3500, cout: 1200, stock: 50, seuil_alerte: 10, unite: 'portion', suivi_stock: 'oui', disponible: 'oui', description: 'Poulet marine au citron et oignons', variantes: 'Normal;Grande portion:4500' },
      { nom: 'Jus Bissap', code: 'BISS-001', categorie: 'Boissons', prix: 500, cout: 150, stock: 100, seuil_alerte: 20, unite: 'pièce', suivi_stock: 'oui', disponible: 'oui', description: 'Jus de bissap frais', variantes: 'Petit:500;Grand:800' },
      { nom: 'Thieboudienne', code: 'THIE-001', categorie: 'Plats', prix: 2500, cout: 900, stock: '', seuil_alerte: 5, unite: 'portion', suivi_stock: 'non', disponible: 'oui', description: '', variantes: '' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
      { wch: 30 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modele');
    XLSX.writeFile(wb, 'modele_import_produits.xlsx');
    toast('success', 'Modèle téléchargé');
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const arrayBuffer = ev.target?.result as ArrayBuffer;
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) { toast('error', 'Fichier vide'); return; }
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (rows.length === 0) {
        toast('error', 'Le fichier est vide ou ne contient pas de données');
        return;
      }
      const data = rows.map(row => {
        const obj: Record<string, string> = {};
        Object.entries(row).forEach(([key, val]) => {
          obj[key.toLowerCase().replace(/\s+/g, '_')] = String(val ?? '');
        });
        return obj;
      });
      setImportPreview(data);
      setImportErrors([]);
      setShowImportModal(true);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }

  async function handleImportConfirm() {
    if (!currentSite) return;
    setImporting(true);
    const errors: string[] = [];
    const catNameMap = new Map(categories.map(c => [c.name.toLowerCase().trim(), c.id]));
    let insertedCount = 0;
    let skippedCount = 0;

    const existingNames = new Set(products.map(p => p.name.toLowerCase().trim()));
    const existingCodes = new Set(products.filter(p => p.product_code).map(p => p.product_code.toLowerCase().trim()));

    const productsToInsert = importPreview.map((row, idx) => {
      const name = row['nom'] || row['name'] || '';
      if (!name) { errors.push(`Ligne ${idx + 2}: nom manquant`); return null; }

      const product_code = row['code'] || row['product_code'] || '';

      if (existingNames.has(name.toLowerCase().trim())) {
        skippedCount++;
        return null;
      }
      if (product_code && existingCodes.has(product_code.toLowerCase().trim())) {
        skippedCount++;
        return null;
      }

      const catName = (row['categorie'] || row['category'] || '').toLowerCase().trim();
      const category_id = catName ? (catNameMap.get(catName) ?? null) : null;
      if (catName && !category_id) { errors.push(`Ligne ${idx + 2}: categorie "${row['categorie'] || row['category']}" introuvable`); }

      const price = parseFloat(row['prix'] || row['price'] || '0') || 0;
      const cost_price = parseFloat(row['cout'] || row['cost'] || row['cost_price'] || '0') || 0;
      const stockVal = row['stock'] || '';
      const stock = stockVal !== '' ? (parseFloat(stockVal) || 0) : null;
      const low_stock_threshold = parseInt(row['seuil_alerte'] || row['threshold'] || '5') || 5;
      const unit = row['unite'] || row['unit'] || 'unite';
      const track_stock = ['oui', 'true', '1', 'yes'].includes((row['suivi_stock'] || row['track_stock'] || 'non').toLowerCase());
      const is_available = !['non', 'false', '0', 'no'].includes((row['disponible'] || row['available'] || 'oui').toLowerCase());
      const description = row['description'] || '';
      const variantStr = row['variantes'] || row['variants'] || '';
      const variants = variantStr ? variantStr.split(';').filter(Boolean).map(part => {
        const [label, priceStr] = part.split(':');
        const price = priceStr ? parseFloat(priceStr) || undefined : undefined;
        return { label: label.trim(), price };
      }) : [];

      existingNames.add(name.toLowerCase().trim());
      if (product_code) existingCodes.add(product_code.toLowerCase().trim());

      return {
        site_id: currentSite.id,
        name,
        product_code,
        category_id,
        price,
        cost_price,
        stock,
        low_stock_threshold,
        unit,
        track_stock,
        is_available,
        description,
        variants,
        image_url: '',
      };
    }).filter(Boolean);

    if (errors.length > 0 && productsToInsert.length === 0) {
      if (skippedCount > 0) errors.push(`${skippedCount} produit(s) ignore(s) car deja existant(s)`);
      setImportErrors(errors);
      setImporting(false);
      return;
    }

    const batchSize = 50;
    for (let i = 0; i < productsToInsert.length; i += batchSize) {
      const batch = productsToInsert.slice(i, i + batchSize);
      const { error } = await supabase.from('products').insert(batch as Record<string, unknown>[]);
      if (error) {
        errors.push(`Erreur batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        insertedCount += batch.length;
      }
    }

    setImporting(false);
    if (skippedCount > 0) {
      errors.push(`${skippedCount} produit(s) ignore(s) car deja existant(s)`);
    }
    if (errors.length > 0) {
      setImportErrors(errors);
    } else {
      setShowImportModal(false);
      setImportPreview([]);
    }
    if (insertedCount > 0) {
      toast('success', `${insertedCount} produit(s) importe(s)${skippedCount > 0 ? `, ${skippedCount} doublon(s) ignore(s)` : ''}`);
      onRefresh();
    } else if (skippedCount > 0 && insertedCount === 0) {
      toast('info', `Aucun nouveau produit - ${skippedCount} doublon(s) ignore(s)`);
    }
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
          onClick={handleExportXLS}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border bg-white/5 border-white/10 text-white/50 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 text-xs sm:text-sm transition-all"
          title="Exporter Excel"
        >
          <Download size={12} className="sm:hidden" />
          <Download size={14} className="hidden sm:block" />
          <span className="hidden sm:inline">Exporter</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border bg-white/5 border-white/10 text-white/50 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 text-xs sm:text-sm transition-all"
          title="Importer Excel"
        >
          <Upload size={12} className="sm:hidden" />
          <Upload size={14} className="hidden sm:block" />
          <span className="hidden sm:inline">Importer</span>
        </button>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl border bg-white/5 border-white/10 text-white/50 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10 text-xs sm:text-sm transition-all"
          title="Télécharger modèle Excel"
        >
          <FileSpreadsheet size={12} className="sm:hidden" />
          <FileSpreadsheet size={14} className="hidden sm:block" />
          <span className="hidden sm:inline">Modèle</span>
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
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

      {/* Import Modal */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => { setShowImportModal(false); setImportPreview([]); setImportErrors([]); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <div>
                  <h3 className="text-white font-semibold text-base">Importer des produits</h3>
                  <p className="text-white/40 text-xs mt-0.5">{importPreview.length} produit(s) detecte(s)</p>
                </div>
                <button
                  onClick={() => { setShowImportModal(false); setImportPreview([]); setImportErrors([]); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {importErrors.length > 0 && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
                    <p className="text-red-400 text-xs font-medium">Avertissements :</p>
                    {importErrors.slice(0, 10).map((err, i) => (
                      <p key={i} className="text-red-300/70 text-xs">{err}</p>
                    ))}
                    {importErrors.length > 10 && (
                      <p className="text-red-300/50 text-xs">...et {importErrors.length - 10} autre(s)</p>
                    )}
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-white/40 font-medium pb-2 pr-3">#</th>
                        <th className="text-left text-white/40 font-medium pb-2 pr-3">Nom</th>
                        <th className="text-left text-white/40 font-medium pb-2 pr-3">Categorie</th>
                        <th className="text-right text-white/40 font-medium pb-2 pr-3">Prix</th>
                        <th className="text-right text-white/40 font-medium pb-2">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-1.5 pr-3 text-white/30">{i + 1}</td>
                          <td className="py-1.5 pr-3 text-white">{row['nom'] || row['name'] || '-'}</td>
                          <td className="py-1.5 pr-3 text-white/60">{row['categorie'] || row['category'] || '-'}</td>
                          <td className="py-1.5 pr-3 text-right text-white/80">{row['prix'] || row['price'] || '0'}</td>
                          <td className="py-1.5 text-right text-white/60">{row['stock'] || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.length > 20 && (
                    <p className="text-white/30 text-xs mt-2">...et {importPreview.length - 20} autre(s) produit(s)</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-5 py-4 border-t border-white/8 bg-white/2">
                <p className="text-white/30 text-xs">
                  Format Excel (.xlsx) - Colonnes : nom, code, categorie, prix, cout, stock, seuil_alerte, unite, suivi_stock, disponible, description, variantes
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowImportModal(false); setImportPreview([]); setImportErrors([]); }}
                    className="px-4 py-2 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    disabled={importing || importPreview.length === 0}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2"
                  >
                    {importing && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {importing ? 'Import en cours...' : `Importer ${importPreview.length} produit(s)`}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
