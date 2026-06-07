import { useMemo } from 'react';
import { TrendingUp, AlertTriangle, DollarSign, Percent } from 'lucide-react';
import type { Product, Recipe, RecipeItem, Ingredient } from '../../types/database';

interface Props {
  products: Product[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  ingredients: Ingredient[];
}

interface CostRow {
  product: Product;
  recipe: Recipe | null;
  materialCost: number;
  unitCost: number;
  sellingPrice: number;
  margin: number;
  marginPct: number;
}

export function CostAnalysis({ products, recipes, recipeItems, ingredients }: Props) {
  const costData = useMemo<CostRow[]>(() => {
    return products.map(product => {
      const recipe = recipes.find(r => r.product_id === product.id) || null;
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
      const sellingPrice = product.price;
      const margin = sellingPrice - unitCost;
      const marginPct = sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0;

      return { product, recipe, materialCost, unitCost, sellingPrice, margin, marginPct };
    }).sort((a, b) => b.marginPct - a.marginPct);
  }, [products, recipes, recipeItems, ingredients]);

  const productsWithCost = costData.filter(c => c.materialCost > 0);
  const avgMarginPct = productsWithCost.length > 0
    ? productsWithCost.reduce((sum, c) => sum + c.marginPct, 0) / productsWithCost.length
    : 0;
  const lowMarginProducts = productsWithCost.filter(c => c.marginPct < 30);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-emerald-400" />
            <span className="text-white/40 text-[10px] uppercase tracking-wider">Produits analyses</span>
          </div>
          <p className="text-white font-bold text-xl">{productsWithCost.length}</p>
          <p className="text-white/30 text-[10px]">sur {products.length} produits</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Percent size={14} className="text-blue-400" />
            <span className="text-white/40 text-[10px] uppercase tracking-wider">Marge moyenne</span>
          </div>
          <p className="text-white font-bold text-xl">{avgMarginPct.toFixed(1)}%</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-white/40 text-[10px] uppercase tracking-wider">Marge faible (&lt;30%)</span>
          </div>
          <p className="text-white font-bold text-xl">{lowMarginProducts.length}</p>
        </div>
      </div>

      {/* Cost table */}
      <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left p-3 text-white/40 text-[10px] uppercase tracking-wider font-medium">Produit</th>
                <th className="text-right p-3 text-white/40 text-[10px] uppercase tracking-wider font-medium">Cout matiere</th>
                <th className="text-right p-3 text-white/40 text-[10px] uppercase tracking-wider font-medium">Cout unitaire</th>
                <th className="text-right p-3 text-white/40 text-[10px] uppercase tracking-wider font-medium">Prix vente</th>
                <th className="text-right p-3 text-white/40 text-[10px] uppercase tracking-wider font-medium">Marge</th>
                <th className="text-right p-3 text-white/40 text-[10px] uppercase tracking-wider font-medium">% Marge</th>
              </tr>
            </thead>
            <tbody>
              {costData.map(row => (
                <tr key={row.product.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="p-3">
                    <div>
                      <p className="text-white font-medium text-xs">{row.product.name}</p>
                      {row.recipe && <p className="text-white/30 text-[10px]">Recette: {row.recipe.name}</p>}
                      {!row.recipe && row.materialCost > 0 && <p className="text-white/30 text-[10px]">Cout d'achat direct</p>}
                      {row.materialCost === 0 && <p className="text-amber-400/50 text-[10px]">Pas de cout defini</p>}
                    </div>
                  </td>
                  <td className="p-3 text-right text-white/60">{row.materialCost > 0 ? `${row.materialCost.toLocaleString('fr-FR')} F` : '-'}</td>
                  <td className="p-3 text-right text-white/60">{row.unitCost > 0 ? `${row.unitCost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F` : '-'}</td>
                  <td className="p-3 text-right text-white font-medium">{row.sellingPrice.toLocaleString('fr-FR')} F</td>
                  <td className="p-3 text-right">
                    <span className={row.margin > 0 ? 'text-emerald-400' : row.margin < 0 ? 'text-red-400' : 'text-white/30'}>
                      {row.margin !== 0 ? `${row.margin.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F` : '-'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {row.materialCost > 0 ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                        row.marginPct >= 60 ? 'bg-emerald-500/10 text-emerald-400' :
                        row.marginPct >= 30 ? 'bg-blue-500/10 text-blue-400' :
                        row.marginPct >= 0 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        <TrendingUp size={9} />
                        {row.marginPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-white/20">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
