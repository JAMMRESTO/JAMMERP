import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useRealtimeTable } from '../lib/useRealtimeTable';
import { useTenant } from '../context/TenantContext';
import { CategoryManager } from '../components/inventory/CategoryManager';
import type { Category } from '../types/database';

export function CategoriesPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!siteId) return;
    const { data } = await supabase.from('categories').select('*').eq('site_id', siteId).order('sort_order');
    if (data) setCategories(data as Category[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadData(); }, [loadData]);

  useRealtimeTable<Category>({
    table: 'categories',
    siteId,
    onInsert: (row) => setCategories(c => c.some(x => x.id === row.id) ? c : [...c, row].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))),
    onUpdate: (row) => setCategories(c => c.map(x => x.id === row.id ? row : x)),
    onDelete: (row) => setCategories(c => c.filter(x => x.id !== row.id)),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Chargement catégories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-3 sm:p-4 lg:p-6">
      <CategoryManager categories={categories} onRefresh={loadData} />
    </div>
  );
}
