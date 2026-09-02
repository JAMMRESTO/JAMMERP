import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Utensils } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRealtimeTable } from '../lib/useRealtimeTable';
import { useTenant } from '../context/TenantContext';
import { useSettings } from '../context/SettingsContext';
import { ProductList } from '../components/inventory/ProductList';
import { ProductForm } from '../components/inventory/ProductForm';
import { SauceManagerModal } from '../components/inventory/SauceManager';
import { FlavorManagerModal } from '../components/inventory/FlavorManager';
import type { Product, Category, Sauce, Flavor } from '../types/database';

export function ProductsPage() {
  const { currentSite } = useTenant();
  const { settings } = useSettings();
  const siteId = currentSite?.id ?? null;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sauces, setSauces] = useState<Sauce[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [showSauces, setShowSauces] = useState(false);
  const [showFlavors, setShowFlavors] = useState(false);

  const loadData = useCallback(async () => {
    if (!siteId) return;
    const [prodRes, catRes, sauceRes, flavorRes] = await Promise.all([
      supabase.from('products').select('*').eq('site_id', siteId).order('name'),
      supabase.from('categories').select('*').eq('site_id', siteId).order('sort_order'),
      supabase.from('sauces').select('*').eq('site_id', siteId).order('sort_order').order('name'),
      supabase.from('flavors').select('*').eq('site_id', siteId).order('sort_order').order('name'),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (sauceRes.data) setSauces(sauceRes.data as Sauce[]);
    if (flavorRes.data) setFlavors(flavorRes.data as Flavor[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadData(); }, [loadData]);

  useRealtimeTable<Product>({
    table: 'products',
    siteId,
    onInsert: (row) => setProducts(p => p.some(x => x.id === row.id) ? p : [...p, row].sort((a, b) => a.name.localeCompare(b.name))),
    onUpdate: (row) => setProducts(p => p.map(x => x.id === row.id ? row : x)),
    onDelete: (row) => setProducts(p => p.filter(x => x.id !== row.id)),
  });

  useRealtimeTable<Category>({
    table: 'categories',
    siteId,
    onInsert: (row) => setCategories(c => c.some(x => x.id === row.id) ? c : [...c, row].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))),
    onUpdate: (row) => setCategories(c => c.map(x => x.id === row.id ? row : x)),
    onDelete: (row) => setCategories(c => c.filter(x => x.id !== row.id)),
  });

  useRealtimeTable<Sauce>({
    table: 'sauces',
    siteId,
    onInsert: (row) => setSauces(s => s.some(x => x.id === row.id) ? s : [...s, row].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))),
    onUpdate: (row) => setSauces(s => s.map(x => x.id === row.id ? row : x)),
    onDelete: (row) => setSauces(s => s.filter(x => x.id !== row.id)),
  });

  useRealtimeTable<Flavor>({
    table: 'flavors',
    siteId,
    onInsert: (row) => setFlavors(f => f.some(x => x.id === row.id) ? f : [...f, row].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))),
    onUpdate: (row) => setFlavors(f => f.map(x => x.id === row.id ? row : x)),
    onDelete: (row) => setFlavors(f => f.filter(x => x.id !== row.id)),
  });

  const showingForm = editingProduct !== undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Chargement produits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className={`flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 ${showingForm ? 'hidden lg:block lg:w-0 lg:overflow-hidden lg:p-0' : ''}`}>
        {(settings.sauces_enabled || settings.flavors_enabled) && (
          <div className="mb-3 sm:mb-4 flex justify-end gap-2">
            {settings.sauces_enabled && (
              <button
                onClick={() => setShowSauces(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs sm:text-sm transition-all"
              >
                <Utensils size={14} />
                Gérer les sauces
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/8 text-white/50 text-[10px]">{sauces.length}</span>
              </button>
            )}
            {settings.flavors_enabled && (
              <button
                onClick={() => setShowFlavors(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs sm:text-sm transition-all"
              >
                <Utensils size={14} />
                Gérer les gouts
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white/8 text-white/50 text-[10px]">{flavors.length}</span>
              </button>
            )}
          </div>
        )}
        <ProductList
          products={products}
          categories={categories}
          onEdit={p => setEditingProduct(p)}
          onNew={() => setEditingProduct(null)}
          onRefresh={loadData}
        />
      </div>

      <AnimatePresence>
        {showingForm && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="w-full md:max-w-2xl lg:max-w-3xl xl:max-w-4xl border-l border-white/8 bg-gray-950/50 overflow-hidden overflow-y-auto"
          >
            <ProductForm
              product={editingProduct ?? null}
              categories={categories}
              onSave={() => { setEditingProduct(undefined); }}
              onCancel={() => setEditingProduct(undefined)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <SauceManagerModal open={showSauces} onClose={() => setShowSauces(false)} />
      <FlavorManagerModal open={showFlavors} onClose={() => setShowFlavors(false)} />
    </div>
  );
}
