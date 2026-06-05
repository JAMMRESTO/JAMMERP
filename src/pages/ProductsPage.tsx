import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useRealtimeTable } from '../lib/useRealtimeTable';
import { useTenant } from '../context/TenantContext';
import { ProductList } from '../components/inventory/ProductList';
import { ProductForm } from '../components/inventory/ProductForm';
import type { Product, Category } from '../types/database';

export function ProductsPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);

  const loadData = useCallback(async () => {
    if (!siteId) return;
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*').eq('site_id', siteId).order('name'),
      supabase.from('categories').select('*').eq('site_id', siteId).order('sort_order'),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (catRes.data) setCategories(catRes.data as Category[]);
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
    </div>
  );
}
