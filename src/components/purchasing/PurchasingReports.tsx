import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Truck, Package, DollarSign } from 'lucide-react';
import type { PurchaseOrder, PurchaseOrderItem, Supplier, SupplierInvoice, Loss, Product, Recipe, RecipeItem, Ingredient } from '../../types/database';

interface Props {
  orders: PurchaseOrder[];
  orderItems: PurchaseOrderItem[];
  suppliers: Supplier[];
  invoices: SupplierInvoice[];
  losses: Loss[];
  products: Product[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  ingredients: Ingredient[];
}

type ReportView = 'purchases' | 'suppliers' | 'profitable' | 'losses';

export function PurchasingReports({ orders, orderItems, suppliers, invoices, losses, products, recipes, recipeItems, ingredients }: Props) {
  const [view, setView] = useState<ReportView>('purchases');
  const [periodDays, setPeriodDays] = useState(30);

  const cutoffDate = useMemo(() => new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000), [periodDays]);

  // Purchases by period
  const periodOrders = useMemo(() =>
    orders.filter(o => new Date(o.created_at) >= cutoffDate && o.status !== 'cancelled'),
    [orders, cutoffDate]
  );
  const totalPurchases = periodOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  // Supplier spending
  const supplierSpending = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number }> = {};
    periodOrders.forEach(o => {
      if (!o.supplier_id) return;
      const sup = suppliers.find(s => s.id === o.supplier_id);
      if (!map[o.supplier_id]) map[o.supplier_id] = { name: sup?.name || 'Inconnu', total: 0, count: 0 };
      map[o.supplier_id].total += Number(o.total_amount);
      map[o.supplier_id].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodOrders, suppliers]);

  // Most profitable products
  const profitableProducts = useMemo(() => {
    return products.map(product => {
      const recipe = recipes.find(r => r.product_id === product.id);
      let materialCost = 0;
      if (recipe) {
        const items = recipeItems.filter(ri => ri.recipe_id === recipe.id);
        materialCost = items.reduce((sum, item) => {
          const ing = ingredients.find(i => i.id === item.ingredient_id);
          return sum + (ing ? Number(ing.cost_per_unit) * Number(item.quantity) : 0);
        }, 0);
      } else if (product.cost_price > 0) {
        materialCost = product.cost_price;
      }
      const batchYield = recipe?.batch_yield || 1;
      const unitCost = materialCost / batchYield;
      const margin = product.price - unitCost;
      const marginPct = product.price > 0 ? (margin / product.price) * 100 : 0;
      return { product, unitCost, margin, marginPct };
    })
    .filter(p => p.unitCost > 0)
    .sort((a, b) => b.marginPct - a.marginPct);
  }, [products, recipes, recipeItems, ingredients]);

  // Products with most losses
  const lossRanking = useMemo(() => {
    const periodLosses = losses.filter(l => new Date(l.declared_at) >= cutoffDate);
    const map: Record<string, { name: string; total: number; count: number }> = {};
    periodLosses.forEach(l => {
      const key = l.item_name;
      if (!map[key]) map[key] = { name: key, total: 0, count: 0 };
      map[key].total += Number(l.total_cost);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [losses, cutoffDate]);

  const VIEWS: { id: ReportView; label: string; icon: typeof BarChart3 }[] = [
    { id: 'purchases', label: 'Achats par periode', icon: Package },
    { id: 'suppliers', label: 'Depenses fournisseurs', icon: Truck },
    { id: 'profitable', label: 'Produits rentables', icon: TrendingUp },
    { id: 'losses', label: 'Top pertes', icon: TrendingDown },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {VIEWS.map(v => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                view === v.id ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:text-white/60'
              }`}
            >
              <Icon size={11} /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-2">
        <span className="text-white/30 text-[10px]">Periode:</span>
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setPeriodDays(d)} className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${periodDays === d ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/50'}`}>
            {d}j
          </button>
        ))}
      </div>

      {/* Content */}
      {view === 'purchases' && (
        <div className="space-y-3">
          <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-blue-400" />
              <span className="text-white/40 text-[10px] uppercase tracking-wider">Total achats ({periodDays} jours)</span>
            </div>
            <p className="text-white font-bold text-2xl">{totalPurchases.toLocaleString('fr-FR')} F</p>
            <p className="text-white/30 text-[10px]">{periodOrders.length} commandes</p>
          </div>

          <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
            <h3 className="text-white font-semibold text-sm mb-3">Commandes recentes</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {periodOrders.slice(0, 20).map(o => {
                const sup = suppliers.find(s => s.id === o.supplier_id);
                return (
                  <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div>
                      <span className="text-white text-xs font-medium">BC-{String(o.order_number).padStart(4, '0')}</span>
                      <span className="text-white/30 text-[10px] ml-2">{sup?.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-medium text-xs">{Number(o.total_amount).toLocaleString('fr-FR')} F</p>
                      <p className="text-white/30 text-[10px]">{new Date(o.order_date).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === 'suppliers' && (
        <div className="space-y-2">
          {supplierSpending.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-8">Aucune depense sur cette periode</p>
          ) : (
            supplierSpending.map((s, idx) => {
              const pctOfTotal = totalPurchases > 0 ? (s.total / totalPurchases) * 100 : 0;
              return (
                <div key={idx} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white font-medium text-xs">{s.name}</p>
                      <p className="text-white/30 text-[10px]">{s.count} commande{s.count > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-sm">{s.total.toLocaleString('fr-FR')} F</p>
                      <p className="text-white/30 text-[10px]">{pctOfTotal.toFixed(1)}% du total</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pctOfTotal}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {view === 'profitable' && (
        <div className="space-y-2">
          {profitableProducts.slice(0, 15).map((row, idx) => (
            <div key={row.product.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <span className="text-white/20 text-[10px] font-mono w-5 text-center">{idx + 1}</span>
                <div>
                  <p className="text-white font-medium text-xs">{row.product.name}</p>
                  <p className="text-white/30 text-[10px]">Cout: {row.unitCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F | Vente: {row.product.price.toLocaleString('fr-FR')} F</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                row.marginPct >= 60 ? 'text-emerald-400 bg-emerald-500/10' :
                row.marginPct >= 30 ? 'text-blue-400 bg-blue-500/10' :
                'text-amber-400 bg-amber-500/10'
              }`}>
                {row.marginPct.toFixed(1)}%
              </span>
            </div>
          ))}
          {profitableProducts.length === 0 && <p className="text-white/30 text-xs text-center py-8">Aucun produit avec cout de revient defini</p>}
        </div>
      )}

      {view === 'losses' && (
        <div className="space-y-2">
          {lossRanking.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-8">Aucune perte sur cette periode</p>
          ) : (
            lossRanking.slice(0, 15).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <span className="text-white/20 text-[10px] font-mono w-5 text-center">{idx + 1}</span>
                  <div>
                    <p className="text-white font-medium text-xs">{item.name}</p>
                    <p className="text-white/30 text-[10px]">{item.count} declaration{item.count > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span className="text-red-400 font-bold text-xs">{item.total.toLocaleString('fr-FR')} F</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
