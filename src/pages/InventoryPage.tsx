import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, ArrowUpDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { InventoryDashboard } from '../components/inventory/InventoryDashboard';
import { StockMovements } from '../components/inventory/StockMovements';
import type { Product, Category } from '../types/database';

type Tab = 'dashboard' | 'movements';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: 'movements', label: 'Mouvements', icon: ArrowUpDown },
];

export function InventoryPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [tab, setTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*').eq('site_id', siteId).order('name'),
      supabase.from('categories').select('*').eq('site_id', siteId).order('sort_order'),
    ]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Chargement inventaire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs */}
      <div className="flex-shrink-0 px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-0">
        <div className="flex gap-0.5 sm:gap-1 bg-white/5 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-white/8 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
                  ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                <Icon size={14} className="sm:hidden" />
                <Icon size={15} className="hidden sm:block" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
        <AnimatePresence mode="wait">
          {tab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <InventoryDashboard products={products} categories={categories} onNavigate={() => {}} />
            </motion.div>
          )}
          {tab === 'movements' && (
            <motion.div key="movements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StockMovements products={products} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
