import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, ShoppingCart, FileText, TrendingDown, BarChart3, Loader2 } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { supabase } from '../lib/supabase';
import { SuppliersManager } from '../components/purchasing/SuppliersManager';
import { PurchaseOrdersManager } from '../components/purchasing/PurchaseOrdersManager';
import { CostAnalysis } from '../components/purchasing/CostAnalysis';
import { LossesManager } from '../components/purchasing/LossesManager';
import { PurchasingReports } from '../components/purchasing/PurchasingReports';
import type { Supplier, PurchaseOrder, PurchaseOrderItem, SupplierInvoice, Loss, Ingredient, Product, Recipe, RecipeItem } from '../types/database';

type Tab = 'suppliers' | 'orders' | 'costs' | 'losses' | 'reports';

const TABS: { id: Tab; label: string; icon: typeof Truck }[] = [
  { id: 'suppliers', label: 'Fournisseurs', icon: Truck },
  { id: 'orders', label: 'Achats', icon: ShoppingCart },
  { id: 'costs', label: 'Cout de revient', icon: FileText },
  { id: 'losses', label: 'Pertes', icon: TrendingDown },
  { id: 'reports', label: 'Rapports', icon: BarChart3 },
];

export function PurchasingPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [tab, setTab] = useState<Tab>('suppliers');
  const [loading, setLoading] = useState(true);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [losses, setLosses] = useState<Loss[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);

  const loadData = useCallback(async () => {
    if (!siteId) { setLoading(false); return; }
    setLoading(true);

    try {
      const [suppRes, ordRes, itemsRes, invRes, lossRes, ingRes, prodRes, recRes, riRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('site_id', siteId).order('name'),
        supabase.from('purchase_orders').select('*').eq('site_id', siteId).order('created_at', { ascending: false }),
        supabase.from('purchase_order_items').select('*').eq('site_id', siteId),
        supabase.from('supplier_invoices').select('*').eq('site_id', siteId).order('invoice_date', { ascending: false }),
        supabase.from('losses').select('*').eq('site_id', siteId).order('declared_at', { ascending: false }),
        supabase.from('ingredients').select('*').eq('site_id', siteId).eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('site_id', siteId).eq('is_available', true).order('name'),
        supabase.from('recipes').select('*').eq('site_id', siteId).eq('is_active', true).order('name'),
        supabase.from('recipe_items').select('*').eq('site_id', siteId),
      ]);

      setSuppliers((suppRes.data ?? []) as Supplier[]);
      setOrders((ordRes.data ?? []) as PurchaseOrder[]);
      setOrderItems((itemsRes.data ?? []) as PurchaseOrderItem[]);
      setInvoices((invRes.data ?? []) as SupplierInvoice[]);
      setLosses((lossRes.data ?? []) as Loss[]);
      setIngredients((ingRes.data ?? []) as Ingredient[]);
      setProducts((prodRes.data ?? []) as Product[]);
      setRecipes((recRes.data ?? []) as Recipe[]);
      setRecipeItems((riRes.data ?? []) as RecipeItem[]);
    } catch (err) {
      console.warn('[PurchasingPage] Failed to load data:', err);
    }

    setLoading(false);
  }, [siteId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 border-b border-white/[0.06] bg-gray-950/50 backdrop-blur-sm px-3 sm:px-4 lg:px-6">
        <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  active ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'suppliers' && (
              <SuppliersManager
                suppliers={suppliers}
                orders={orders}
                invoices={invoices}
                siteId={siteId}
                onRefresh={loadData}
              />
            )}
            {tab === 'orders' && (
              <PurchaseOrdersManager
                orders={orders}
                orderItems={orderItems}
                suppliers={suppliers}
                invoices={invoices}
                ingredients={ingredients}
                products={products}
                siteId={siteId}
                onRefresh={loadData}
              />
            )}
            {tab === 'costs' && (
              <CostAnalysis
                products={products}
                recipes={recipes}
                recipeItems={recipeItems}
                ingredients={ingredients}
              />
            )}
            {tab === 'losses' && (
              <LossesManager
                losses={losses}
                products={products}
                ingredients={ingredients}
                siteId={siteId}
                onRefresh={loadData}
              />
            )}
            {tab === 'reports' && (
              <PurchasingReports
                orders={orders}
                orderItems={orderItems}
                suppliers={suppliers}
                invoices={invoices}
                losses={losses}
                products={products}
                recipes={recipes}
                recipeItems={recipeItems}
                ingredients={ingredients}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
