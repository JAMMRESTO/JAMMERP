import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, ChefHat, Play, Building2, AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { IngredientsManager } from '../components/production/IngredientsManager';
import { RecipesManager } from '../components/production/RecipesManager';
import { ProductionManager, LaunchProductionModal } from '../components/production/ProductionManager';
import { WarehousesManager } from '../components/production/WarehousesManager';
import type { Ingredient, Warehouse, RecipeWithItems } from '../types/database';

type Tab = 'ingredients' | 'recipes' | 'productions' | 'warehouses';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'ingredients', label: 'Ingrédients', icon: FlaskConical },
  { id: 'recipes', label: 'Recettes', icon: ChefHat },
  { id: 'productions', label: 'Productions', icon: Play },
  { id: 'warehouses', label: 'Dépôts', icon: Building2 },
];

export function ProductionPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [tab, setTab] = useState<Tab>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [launchingRecipe, setLaunchingRecipe] = useState<RecipeWithItems | null>(null);

  const loadShared = useCallback(async () => {
    const [ingRes, whRes] = await Promise.all([
      supabase.from('ingredients').select('*').eq('site_id', siteId).eq('is_active', true).order('name'),
      supabase.from('warehouses').select('*').eq('site_id', siteId).eq('is_active', true).order('name'),
    ]);
    if (ingRes.data) setIngredients(ingRes.data as Ingredient[]);
    if (whRes.data) setWarehouses(whRes.data as Warehouse[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadShared(); }, [loadShared]);

  // Smart alerts
  const lowStockIngredients = ingredients.filter(i => i.stock > 0 && i.stock <= i.low_stock_threshold && i.low_stock_threshold > 0);
  const outOfStock = ingredients.filter(i => i.stock <= 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Chargement production...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-0 space-y-3">
        {/* Smart alerts banner */}
        {(lowStockIngredients.length > 0 || outOfStock.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl"
          >
            <Zap size={14} className="text-amber-400 flex-shrink-0" />
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {outOfStock.length > 0 && (
                <button onClick={() => setTab('ingredients')} className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs transition-colors">
                  <AlertTriangle size={11} /> {outOfStock.length} rupture{outOfStock.length > 1 ? 's' : ''}
                </button>
              )}
              {lowStockIngredients.length > 0 && (
                <button onClick={() => setTab('ingredients')} className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs transition-colors">
                  <AlertTriangle size={11} /> {lowStockIngredients.length} stock bas
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/8 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
                  ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{t.label}</span>
                {t.id === 'ingredients' && outOfStock.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {outOfStock.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 scrollbar-thin">
        <AnimatePresence mode="wait">
          {tab === 'ingredients' && (
            <motion.div key="ingredients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
              <IngredientsManager ingredients={ingredients} onRefresh={loadShared} />
            </motion.div>
          )}

          {tab === 'recipes' && (
            <motion.div key="recipes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RecipesManager
                ingredients={ingredients}
                onRefresh={loadShared}
                onLaunchProduction={recipe => setLaunchingRecipe(recipe)}
              />
            </motion.div>
          )}

          {tab === 'productions' && (
            <motion.div key="productions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProductionManager warehouses={warehouses} />
            </motion.div>
          )}

          {tab === 'warehouses' && (
            <motion.div key="warehouses" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WarehousesManager ingredients={ingredients} warehouses={warehouses} onRefresh={loadShared} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Launch production modal */}
      <AnimatePresence>
        {launchingRecipe && (
          <LaunchProductionModal
            recipe={launchingRecipe}
            warehouses={warehouses}
            onSave={() => {
              setLaunchingRecipe(null);
              loadShared();
              setTab('productions');
            }}
            onClose={() => setLaunchingRecipe(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
