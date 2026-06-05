import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Check, Pencil, Trash2, ChefHat,
  TrendingUp, AlertTriangle, Package, Zap, Info
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
import type { Recipe, RecipeWithItems, Ingredient, Product } from '../../types/database';

// ─────────────────────────────────────────────────────────
// Auto-calculation engine
// ─────────────────────────────────────────────────────────
function calcRecipe(
  items: { ingredient: Ingredient | null; quantity: number }[],
  batchYield: number,
  sellingPrice: number
): { totalCost: number; unitCost: number; maxProducible: number; marginPct: number } {
  const totalCost = items.reduce((sum, item) => {
    if (!item.ingredient) return sum;
    return sum + item.ingredient.cost_per_unit * item.quantity;
  }, 0);

  const unitCost = batchYield > 0 ? totalCost / batchYield : 0;

  // Max producible = minimum across all ingredients (bottleneck)
  const maxProducible = items.reduce((min, item) => {
    if (!item.ingredient || item.quantity <= 0) return min;
    const possible = Math.floor((item.ingredient.stock / item.quantity) * batchYield);
    return Math.min(min, possible);
  }, Infinity);

  const marginPct = sellingPrice > 0 ? ((sellingPrice - unitCost) / sellingPrice) * 100 : 0;

  return {
    totalCost,
    unitCost,
    maxProducible: maxProducible === Infinity ? 0 : maxProducible,
    marginPct,
  };
}

// ─────────────────────────────────────────────────────────
// Recipe form
// ─────────────────────────────────────────────────────────
interface RecipeFormProps {
  recipe: RecipeWithItems | null;
  ingredients: Ingredient[];
  products: Product[];
  onSave: () => void;
  onClose: () => void;
}

function RecipeForm({ recipe, ingredients, products, onSave, onClose }: RecipeFormProps) {
  const toast = useToast();
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;

  const [form, setForm] = useState({
    name: recipe?.name ?? '',
    description: recipe?.description ?? '',
    product_id: recipe?.product_id ?? '',
    batch_yield: recipe?.batch_yield ?? 1,
  });

  const [items, setItems] = useState<{ ingredient_id: string; quantity: number; ingredient: Ingredient | null }[]>(
    recipe?.items?.map(i => ({
      ingredient_id: i.ingredient_id,
      quantity: i.quantity,
      ingredient: i.ingredient ?? null,
    })) ?? [{ ingredient_id: '', quantity: 0, ingredient: null }]
  );

  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find(p => p.id === form.product_id) ?? null;

  const calc = calcRecipe(items, form.batch_yield, selectedProduct?.price ?? 0);

  function updateItemIngredient(idx: number, ingId: string) {
    const ing = ingredients.find(i => i.id === ingId) ?? null;
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ingredient_id: ingId, ingredient: ing } : item));
  }

  function updateItemQty(idx: number, qty: number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = items.filter(i => i.ingredient_id && i.quantity > 0);
    if (validItems.length === 0) { toast('error', 'Ajoutez au moins un ingrédient'); return; }
    setSaving(true);

    const recipePayload = {
      name: form.name || selectedProduct?.name || 'Recette sans nom',
      description: form.description,
      product_id: form.product_id || null,
      batch_yield: form.batch_yield,
      total_cost: calc.totalCost,
      max_producible: calc.maxProducible,
      margin_pct: parseFloat(calc.marginPct.toFixed(2)),
      updated_at: new Date().toISOString(),
    };

    let recipeId = recipe?.id;

    if (recipe) {
      await supabase.from('recipes').update(recipePayload).eq('id', recipe.id);
      await supabase.from('recipe_items').delete().eq('recipe_id', recipe.id);
    } else {
      const payloadWithSite = siteId ? { ...recipePayload, site_id: siteId } : recipePayload;
      const { data, error } = await supabase.from('recipes').insert(payloadWithSite).select().single();
      if (error || !data) { toast('error', 'Erreur de création'); setSaving(false); return; }
      recipeId = data.id;
    }

    const itemsWithSite = validItems.map(i => ({
      recipe_id: recipeId,
      ingredient_id: i.ingredient_id,
      quantity: i.quantity,
      unit: i.ingredient?.unit ?? '',
      ...(siteId && { site_id: siteId }),
    }));
    await supabase.from('recipe_items').insert(itemsWithSite);

    toast('success', recipe ? 'Recette modifiée' : 'Recette créée');
    onSave();
  }

  const marginColor = calc.marginPct >= 60 ? 'text-emerald-400' : calc.marginPct >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/8 flex-shrink-0">
          <h2 className="text-white font-bold text-lg">{recipe ? 'Modifier la recette' : 'Nouvelle recette'}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <form id="recipe-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">Produit associé</label>
                <select
                  value={form.product_id}
                  onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="" className="bg-gray-900">Sans produit</option>
                  {products.map(p => <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">Nom de la recette</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={selectedProduct?.name ?? 'Ex: Gâteau chocolat...'}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">Rendement par batch (portions)</label>
                <input
                  type="number"
                  value={form.batch_yield || ''}
                  onChange={e => setForm(f => ({ ...f, batch_yield: parseInt(e.target.value) || 1 }))}
                  onFocus={e => e.target.select()}
                  placeholder="1"
                  min={1}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs font-medium block mb-1.5">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Notes de recette..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Ingredients list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-white/60 text-sm font-semibold">Ingrédients</label>
                <button
                  type="button"
                  onClick={() => setItems(prev => [...prev, { ingredient_id: '', quantity: 0, ingredient: null }])}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                >
                  <Plus size={12} /> Ajouter
                </button>
              </div>

              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                <div className="col-span-5 text-white/30 text-[10px] font-medium">Ingrédient</div>
                <div className="col-span-3 text-white/30 text-[10px] font-medium">Quantité</div>
                <div className="col-span-3 text-white/30 text-[10px] font-medium">Coût ligne</div>
                <div className="col-span-1" />
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => {
                  const lineCost = (item.ingredient?.cost_per_unit ?? 0) * item.quantity;
                  const canMake = item.ingredient && item.quantity > 0
                    ? Math.floor((item.ingredient.stock / item.quantity) * form.batch_yield)
                    : null;
                  const isBottleneck = canMake !== null && canMake === calc.maxProducible && calc.maxProducible < 999;

                  return (
                    <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-all ${isBottleneck ? 'bg-red-500/5 border-red-500/15' : 'bg-white/3 border-white/5'}`}>
                      <select
                        value={item.ingredient_id}
                        onChange={e => updateItemIngredient(idx, e.target.value)}
                        className="col-span-5 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/40"
                      >
                        <option value="" className="bg-gray-900">Sélectionner...</option>
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id} className="bg-gray-900">{i.name} ({i.unit})</option>
                        ))}
                      </select>
                      <div className="col-span-3 flex items-center gap-1">
                        <input
                          type="number"
                          value={item.quantity || ''}
                          onChange={e => updateItemQty(idx, parseFloat(e.target.value) || 0)}
                          onFocus={e => e.target.select()}
                          placeholder="0"
                          min={0}
                          step={0.01}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center focus:outline-none focus:border-blue-500/40"
                        />
                        <span className="text-white/30 text-[10px] flex-shrink-0">{item.ingredient?.unit ?? ''}</span>
                      </div>
                      <div className="col-span-3 text-right">
                        <p className="text-white/60 text-xs font-medium">{Math.round(lineCost).toLocaleString('fr-FR')} {sym}</p>
                        {item.ingredient && (
                          <p className={`text-[10px] ${isBottleneck ? 'text-red-400' : 'text-white/25'}`}>
                            stock: {item.ingredient.stock} {item.ingredient.unit}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                        disabled={items.length === 1}
                        className="col-span-1 flex items-center justify-center text-white/20 hover:text-red-400 disabled:opacity-20 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live calculation panel */}
            {items.some(i => i.ingredient_id && i.quantity > 0) && (
              <div className="bg-gray-800/60 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={13} className="text-blue-400" />
                  <h3 className="text-white/80 text-sm font-semibold">Calculs automatiques</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/3 rounded-xl p-3 text-center">
                    <p className="text-blue-400 font-black text-lg">{Math.round(calc.totalCost).toLocaleString('fr-FR')} {sym}</p>
                    <p className="text-white/30 text-[10px]">Coût batch ({form.batch_yield}p)</p>
                  </div>
                  <div className="bg-white/3 rounded-xl p-3 text-center">
                    <p className="text-white font-black text-lg">{Math.round(calc.unitCost).toLocaleString('fr-FR')} {sym}</p>
                    <p className="text-white/30 text-[10px]">Coût unitaire</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center border ${calc.maxProducible > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <p className={`font-black text-lg ${calc.maxProducible > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{calc.maxProducible}</p>
                    <p className="text-white/30 text-[10px]">Fabricables</p>
                  </div>
                  {selectedProduct && (
                    <div className={`rounded-xl p-3 text-center border ${calc.marginPct >= 50 ? 'bg-emerald-500/10 border-emerald-500/20' : calc.marginPct >= 30 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                      <p className={`font-black text-lg ${marginColor}`}>{calc.marginPct.toFixed(1)}%</p>
                      <p className="text-white/30 text-[10px]">Marge</p>
                    </div>
                  )}
                </div>

                {calc.maxProducible === 0 && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                    <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-xs">Stock insuffisant pour produire — vérifiez les approvisionnements</p>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>

        <div className="flex gap-2 p-6 border-t border-white/8 flex-shrink-0">
          <button form="recipe-form" type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
            {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
            Enregistrer la recette
          </button>
          <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Recipe card
// ─────────────────────────────────────────────────────────
interface RecipeCardProps {
  recipe: RecipeWithItems;
  onEdit: () => void;
  onDelete: () => void;
  onProduce: () => void;
  sym: string;
}

function RecipeCard({ recipe, onEdit, onDelete, onProduce, sym }: RecipeCardProps) {
  const marginColor = recipe.margin_pct >= 60 ? 'text-emerald-400' : recipe.margin_pct >= 40 ? 'text-amber-400' : 'text-red-400';
  const canProduce = recipe.max_producible > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="bg-gray-900/60 border border-white/8 rounded-2xl overflow-hidden hover:border-white/14 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3 border-b border-white/8">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{recipe.name || recipe.product?.name}</p>
          {recipe.product && (
            <div className="flex items-center gap-1 mt-0.5">
              <Package size={10} className="text-white/30" />
              <p className="text-white/40 text-xs truncate">{recipe.product.name}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
            <Pencil size={12} />
          </button>
          <button onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 p-4 pb-3">
        <div className="text-center">
          <p className="text-white font-bold">{Math.round(recipe.total_cost).toLocaleString('fr-FR')}</p>
          <p className="text-white/30 text-[10px]">{sym} / batch</p>
        </div>
        <div className={`text-center rounded-xl p-1.5 border ${canProduce ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <p className={`font-bold ${canProduce ? 'text-emerald-400' : 'text-red-400'}`}>{recipe.max_producible}</p>
          <p className="text-white/30 text-[10px]">Fabricables</p>
        </div>
        <div className="text-center">
          <p className={`font-bold ${marginColor}`}>{recipe.margin_pct.toFixed(1)}%</p>
          <p className="text-white/30 text-[10px]">Marge</p>
        </div>
      </div>

      {/* Ingredients preview */}
      <div className="px-4 pb-3">
        <div className="flex flex-wrap gap-1">
          {recipe.items.slice(0, 4).map(item => (
            <span key={item.id} className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-lg">
              {item.ingredient?.name ?? '?'} ×{item.quantity}
            </span>
          ))}
          {recipe.items.length > 4 && (
            <span className="text-[10px] text-white/30 bg-white/3 px-2 py-0.5 rounded-lg">+{recipe.items.length - 4}</span>
          )}
        </div>
      </div>

      {/* Produce button */}
      <div className="px-4 pb-4">
        <button
          onClick={onProduce}
          disabled={!canProduce}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all
            ${canProduce
              ? 'bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30'
              : 'bg-white/3 border-white/8 text-white/20 cursor-not-allowed'
            }`}
        >
          <ChefHat size={13} />
          {canProduce ? 'Lancer production' : 'Stock insuffisant'}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────
interface RecipesManagerProps {
  ingredients: Ingredient[];
  onRefresh: () => void;
  onLaunchProduction: (recipe: RecipeWithItems) => void;
}

export function RecipesManager({ ingredients, onRefresh, onLaunchProduction }: RecipesManagerProps) {
  const toast = useToast();
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;

  const [recipes, setRecipes] = useState<RecipeWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecipeWithItems | null>(null);

  const load = useCallback(async () => {
    let rQuery = supabase
      .from('recipes')
      .select('*, items:recipe_items(*, ingredient:ingredients(*)), product:products(id, name, price)')
      .eq('is_active', true);
    if (siteId) rQuery = rQuery.eq('site_id', siteId);
    const rRes = await rQuery.order('name');
    const pRes = await supabase.from('products').select('id, name, price').eq('site_id', siteId ?? '').order('name');
    if (rRes.data) setRecipes(rRes.data as RecipeWithItems[]);
    if (pRes.data) setProducts(pRes.data as Product[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from('recipes').update({ is_active: false }).eq('id', id);
    if (error) { toast('error', 'Erreur de suppression'); return; }
    toast('success', 'Recette supprimée');
    load();
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-52 bg-white/3 border border-white/8 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white/40 text-sm">{recipes.length} recette{recipes.length !== 1 ? 's' : ''}</span>
          {recipes.filter(r => r.max_producible === 0).length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
              <AlertTriangle size={11} /> {recipes.filter(r => r.max_producible === 0).length} sans stock
            </span>
          )}
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
        >
          <Plus size={14} /> Nouvelle recette
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ChefHat size={36} className="text-white/10 mb-3" />
          <p className="text-white/30 font-medium">Aucune recette créée</p>
          <p className="text-white/20 text-sm mt-1">Associez des ingrédients à vos produits</p>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="mt-4 flex items-center gap-1.5 text-blue-400 text-sm">
            <Plus size={13} /> Créer une recette
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {recipes.map(r => (
              <RecipeCard
                key={r.id}
                recipe={r}
                sym={sym}
                onEdit={() => { setEditing(r); setShowForm(true); }}
                onDelete={() => handleDelete(r.id)}
                onProduce={() => onLaunchProduction(r)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <RecipeForm
            recipe={editing}
            ingredients={ingredients}
            products={products}
            onSave={() => { setShowForm(false); load(); onRefresh(); }}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
