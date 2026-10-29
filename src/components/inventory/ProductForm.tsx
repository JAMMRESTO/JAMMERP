import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X, Check, Image, TrendingUp, AlertTriangle, Plus, Minus, Upload, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useTenant } from '../../context/TenantContext';
import { useSettings } from '../../context/SettingsContext';
import type { Product, Category, ProductVariant, ProductComponent, ProductComposition, DrinkChoice } from '../../types/database';

const UNITS = ['pièce', 'kg', 'g', 'litre', 'cl', 'ml', 'portion', 'boîte', 'sachet', 'lot'];

interface ProductFormProps {
  product?: Product | null;
  categories: Category[];
  onSave: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, categories, onSave, onCancel }: ProductFormProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const { settings } = useSettings();
  const siteId = currentSite?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [compositions, setCompositions] = useState<ProductComposition[]>([]);
  const [newCompComponentId, setNewCompComponentId] = useState('');
  const [newCompQty, setNewCompQty] = useState('');
  const [newCompIsDrink, setNewCompIsDrink] = useState(false);
  const [newCompDrinkChoice, setNewCompDrinkChoice] = useState<DrinkChoice>('fixed');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => {
    const categoryId = product?.category_id ?? '';
    const cat = categories.find(c => c.id === categoryId);
    const trackStock = product?.track_stock ?? (cat ? cat.track_stock : true);
    return {
      name: product?.name ?? '',
      product_code: product?.product_code ?? '',
      description: product?.description ?? '',
      category_id: categoryId,
      price: product?.price ?? 0,
      cost_price: product?.cost_price ?? 0,
      image_url: product?.image_url ?? '',
      stock: product?.stock ?? 0,
      track_stock: trackStock,
      is_available: product?.is_available ?? true,
      unit: product?.unit ?? 'pièce',
      low_stock_threshold: product?.low_stock_threshold ?? 5,
      stock_deduction_quantity: product?.stock_deduction_quantity ?? 1,
      variants: (product?.variants as ProductVariant[]) ?? [],
    };
  });

  const [newVariant, setNewVariant] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [imagePreview, setImagePreview] = useState(product?.image_url ?? '');

  const margin = form.price > 0
    ? Math.round(((form.price - form.cost_price) / form.price) * 100)
    : 0;

  const profit = form.price - form.cost_price;

  useEffect(() => {
    if (!siteId) return;
    supabase.from('product_components').select('*').eq('site_id', siteId).eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setComponents(data as ProductComponent[]); });
  }, [siteId]);

  useEffect(() => {
    if (!product?.id || !siteId) return;
    supabase.from('product_compositions').select('*, component:product_components(id, name, unit, stock, is_active)')
      .eq('product_id', product.id).eq('site_id', siteId)
      .then(({ data }) => { if (data) setCompositions(data as ProductComposition[]); });
  }, [product?.id, siteId]);

  useEffect(() => {
    // Auto-generate product code if empty
    if (!form.product_code && form.name) {
      const code = form.name.toUpperCase().replace(/\s+/g, '').slice(0, 4) +
        '-' + String(Math.floor(Math.random() * 999 + 1)).padStart(3, '0');
      setForm(f => ({ ...f, product_code: code }));
    }
  }, [form.name]);

  function addVariant() {
    if (!newVariant.trim() || !newVariantPrice) return;
    const price = parseFloat(newVariantPrice) || undefined;
    if (price === undefined) return;
    setForm(f => ({ ...f, variants: [...f.variants, { label: newVariant.trim(), price }] }));
    setNewVariant('');
    setNewVariantPrice('');
  }

  const SUGGESTED_SIZES = ['Petite', 'Moyenne', 'Grande', 'Seul', 'Menu'];
  const hasVariants = form.variants.length > 0;

  function addSuggestedSize(label: string) {
    setNewVariant(label);
    setTimeout(() => {
      const priceInput = document.getElementById('variant-price-input');
      priceInput?.focus();
    }, 0);
  }

  function removeVariant(i: number) {
    setForm(f => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }));
  }

  function updateVariantPrice(i: number, value: string) {
    const price = value ? parseFloat(value) || undefined : undefined;
    setForm(f => ({
      ...f,
      variants: f.variants.map((v, idx) => idx === i ? { ...v, price } : v),
    }));
  }

  function addComposition() {
    const qty = parseFloat(newCompQty) || 0;
    if (!newCompComponentId || qty <= 0) return;
    const comp = components.find(c => c.id === newCompComponentId);
    if (!comp) return;
    if (compositions.some(c => c.component_id === newCompComponentId && c.is_drink === newCompIsDrink)) return;
    setCompositions(prev => [...prev, {
      id: '',
      site_id: siteId,
      product_id: product?.id ?? '',
      component_id: newCompComponentId,
      quantity_per_unit: qty,
      is_drink: newCompIsDrink,
      drink_choice: newCompDrinkChoice,
      component: { id: comp.id, name: comp.name, unit: comp.unit, stock: comp.stock, is_active: comp.is_active },
      created_at: '',
    }]);
    setNewCompComponentId('');
    setNewCompQty('');
    setNewCompIsDrink(false);
    setNewCompDrinkChoice('fixed');
  }

  function removeComposition(index: number) {
    setCompositions(prev => prev.filter((_, i) => i !== index));
  }

  function updateComposition(index: number, field: 'quantity_per_unit' | 'drink_choice', value: number | DrinkChoice) {
    setCompositions(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      ...form,
      stock: form.track_stock ? form.stock : null,
    };

    let productId = product?.id;
    let error;
    if (product) {
      ({ error } = await supabase.from('products').update(payload).eq('id', product.id).eq('site_id', siteId));
    } else {
      const { data: insertData, error: insertError } = await supabase.from('products').insert({ ...payload, site_id: siteId }).select('id').single();
      error = insertError;
      productId = insertData?.id;
    }

    if (error) {
      setSaving(false);
      toast('error', 'Erreur lors de l\'enregistrement');
      return;
    }

    if (productId && siteId && settings.component_stock_enabled) {
      await supabase.from('product_compositions').delete().eq('product_id', productId).eq('site_id', siteId);
      if (compositions.length > 0) {
        await supabase.from('product_compositions').insert(
          compositions.map(c => ({
            site_id: siteId,
            product_id: productId,
            component_id: c.component_id,
            quantity_per_unit: c.quantity_per_unit,
            is_drink: c.is_drink,
            drink_choice: c.drink_choice,
          }))
        );
      }
    }

    setSaving(false);
    toast('success', product ? 'Produit mis à jour' : 'Produit créé');
    onSave();
  }

  function f(key: keyof typeof form, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) {
      toast('error', "Erreur lors de l'upload");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    f('image_url', data.publicUrl);
    setImagePreview(data.publicUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div>
          <h2 className="text-white font-bold text-lg">{product ? 'Modifier produit' : 'Nouveau produit'}</h2>
          <p className="text-white/30 text-xs mt-0.5">
            {product ? `Code: ${product.product_code}` : 'Remplissez les informations du produit'}
          </p>
        </div>
        <button onClick={onCancel} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
          <X size={17} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-5">
            {/* Image upload */}
            <div>
              <label className="text-white/60 text-sm font-medium block mb-2">Image du produit</label>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="w-full h-full object-cover" onError={() => setImagePreview('')} />
                  ) : (
                    <Image size={24} className="text-white/20" />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-blue-500/40 text-white/60 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {uploading
                      ? <><Loader2 size={14} className="animate-spin" /> Envoi en cours...</>
                      : <><Upload size={14} /> {imagePreview ? 'Changer l\'image' : 'Choisir une image'}</>
                    }
                  </button>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => { f('image_url', ''); setImagePreview(''); }}
                      className="text-xs text-red-400/70 hover:text-red-400 transition-colors text-center"
                    >
                      Supprimer l'image
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-white/60 text-sm font-medium block mb-1.5">Nom du produit *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => f('name', e.target.value)}
                placeholder="Ex: Poulet Yassa"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Code + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-sm font-medium block mb-1.5">Code produit</label>
                <input
                  type="text"
                  value={form.product_code}
                  onChange={e => f('product_code', e.target.value)}
                  placeholder="PROD-001"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                />
              </div>
              <div>
                <label className="text-white/60 text-sm font-medium block mb-1.5">Catégorie</label>
                <select
                  value={form.category_id}
                  onChange={e => {
                    const catId = e.target.value;
                    f('category_id', catId);
                    if (!product) {
                      const cat = categories.find(c => c.id === catId);
                      if (cat) f('track_stock', cat.track_stock);
                    }
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                >
                  <option value="" className="bg-gray-900">Aucune</option>
                  {categories.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id} className="bg-gray-900">{c.name}{!c.track_stock ? ' (sans stock)' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-white/60 text-sm font-medium block mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => f('description', e.target.value)}
                rows={2}
                placeholder="Description courte du produit..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
              />
            </div>

            {/* Tailles / Portions */}
            <div>
              <label className="text-white/60 text-sm font-medium block mb-2">Tailles / Portions</label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:flex gap-2 mb-2">
                <input
                  type="text"
                  value={newVariant}
                  onChange={e => setNewVariant(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariant(); } }}
                  placeholder="Ex: Petite, Moyenne..."
                  aria-label="Nom de la taille"
                  className="min-w-0 w-full sm:flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-3 sm:py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <div className="col-span-2 sm:contents flex gap-2">
                  <input
                    id="variant-price-input"
                    type="number"
                    inputMode="decimal"
                    value={newVariantPrice}
                    onChange={e => setNewVariantPrice(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariant(); } }}
                    placeholder="Prix *"
                    aria-label="Prix de la taille"
                    min={0}
                    step={50}
                    className="min-w-0 flex-1 sm:flex-none sm:w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-3 sm:py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={addVariant}
                    disabled={!newVariant.trim() || !newVariantPrice}
                    aria-label="Ajouter la taille"
                    className="min-w-[48px] sm:min-w-0 sm:px-3 py-3 sm:py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/25 text-blue-200 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Plus size={17} />
                    <span className="sm:hidden text-xs font-semibold">Valider</span>
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SUGGESTED_SIZES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSuggestedSize(s)}
                    className="min-h-9 px-3 py-1.5 rounded-lg bg-blue-500/8 hover:bg-blue-500/20 border border-blue-500/15 hover:border-blue-500/30 text-blue-300 text-xs font-medium transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {form.variants.length > 0 && (
                <div className="space-y-1.5">
                  {form.variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-2">
                      <span className="text-sm text-blue-200 flex-1 min-w-0 truncate">{v.label}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={v.price ?? ''}
                        onChange={e => updateVariantPrice(i, e.target.value)}
                        placeholder={String(form.price || 0)}
                        aria-label={`Prix de ${v.label}`}
                        min={0}
                        step={50}
                        className="w-24 sm:w-20 min-h-9 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm sm:text-xs text-right placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                      />
                      <span className="text-white/30 text-xs flex-shrink-0">{settings?.currency_symbol ?? ''}</span>
                      <button type="button" onClick={() => removeVariant(i)} aria-label={`Supprimer ${v.label}`} className="w-8 h-8 flex items-center justify-center text-blue-400/50 hover:text-red-400 transition-colors flex-shrink-0">
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  <p className="text-white/25 text-[10px] mt-1">Chaque taille doit avoir son propre prix. Le prix principal est facultatif quand le produit a des tailles.</p>
                </div>
              )}
            </div>

          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Pricing */}
            <div className="bg-white/3 rounded-2xl border border-white/8 p-4 space-y-4">
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Prix & Marges</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">
                    Prix de vente{hasVariants ? '' : ' *'}
                  </label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => f('price', parseFloat(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    placeholder={hasVariants ? 'Facultatif' : '0'}
                    min={0}
                    step={50}
                    required={!hasVariants}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                  {hasVariants && (
                    <p className="text-white/30 text-[10px] mt-1">Facultatif si le produit a des tailles</p>
                  )}
                </div>
                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">Coût de production</label>
                  <input
                    type="number"
                    value={form.cost_price || ''}
                    onChange={e => f('cost_price', parseFloat(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    placeholder="0"
                    min={0}
                    step={50}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Margin display */}
              <div className={`p-3 rounded-xl border ${margin >= 50 ? 'bg-emerald-500/8 border-emerald-500/20' : margin >= 30 ? 'bg-amber-500/8 border-amber-500/20' : 'bg-red-500/8 border-red-500/20'}`}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className={margin >= 50 ? 'text-emerald-400' : margin >= 30 ? 'text-amber-400' : 'text-red-400'} />
                  <span className="text-white/60 text-xs">Marge calculée</span>
                </div>
                <div className="flex items-end gap-3 mt-1">
                  <span className={`text-2xl font-black ${margin >= 50 ? 'text-emerald-400' : margin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                    {margin}%
                  </span>
                  <span className="text-white/40 text-sm mb-0.5">
                    Profit: {profit.toLocaleString('fr-FR')} / unité
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${margin >= 50 ? 'bg-emerald-500' : margin >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(margin, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stock */}
            <div className="bg-white/3 rounded-2xl border border-white/8 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Stock & Unités</h4>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs">Suivi stock</span>
                  <button
                    type="button"
                    onClick={() => f('track_stock', !form.track_stock)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${form.track_stock ? 'bg-blue-600' : 'bg-white/10'}`}
                  >
                    <motion.div
                      animate={{ x: form.track_stock ? 16 : 2 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">Unité</label>
                  <select
                    value={form.unit}
                    onChange={e => f('unit', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  >
                    {UNITS.map(u => <option key={u} value={u} className="bg-gray-900">{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">Stock actuel</label>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => f('stock', Math.max(0, form.stock - 1))} className="w-9 h-10 rounded-l-xl bg-white/8 hover:bg-red-500/20 text-white/60 hover:text-red-400 flex items-center justify-center transition-all">
                      <Minus size={13} />
                    </button>
                  <input
                    type="number"
                    value={form.stock || ''}
                    onChange={e => f('stock', parseFloat(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    placeholder="0"
                    min={0}
                    step="any"
                    disabled={!form.track_stock}
                    className="flex-1 h-10 bg-white/5 border-y border-white/10 text-white text-sm text-center focus:outline-none disabled:opacity-40"
                  />
                    <button type="button" onClick={() => f('stock', form.stock + 1)} className="w-9 h-10 rounded-r-xl bg-white/8 hover:bg-emerald-500/20 text-white/60 hover:text-emerald-400 flex items-center justify-center transition-all">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-white/60 text-sm font-medium block mb-1.5">Seuil d'alerte stock bas</label>
                <input
                  type="number"
                  value={form.low_stock_threshold || ''}
                  onChange={e => f('low_stock_threshold', parseInt(e.target.value) || 0)}
                  onFocus={e => e.target.select()}
                  placeholder="0"
                  min={0}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {form.track_stock && form.stock <= form.low_stock_threshold && form.stock > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                  <p className="text-amber-300 text-xs">Stock bas — pensez à réapprovisionner</p>
                </div>
              )}
              {form.track_stock && form.stock <= 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-xs">Rupture de stock — produit indisponible</p>
                </div>
              )}

              {form.track_stock && settings.stock_portion_enabled && (
                <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/20 space-y-2">
                  <label className="text-white/60 text-sm font-medium block">Quantité de stock déduite par unité vendue</label>
                  <input
                    type="number"
                    value={form.stock_deduction_quantity || ''}
                    onChange={e => f('stock_deduction_quantity', Math.max(0.01, parseFloat(e.target.value) || 1))}
                    onFocus={e => e.target.select()}
                    placeholder="1"
                    min={0}
                    step="any"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                  <p className="text-white/30 text-xs">Exemple : une portion de 4 tenders déduit 4 pièces du stock.</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-white/50 text-sm">Disponible à la vente</span>
                <button
                  type="button"
                  onClick={() => f('is_available', !form.is_available)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.is_available ? 'bg-emerald-600' : 'bg-white/10'}`}
                >
                  <motion.div
                    animate={{ x: form.is_available ? 20 : 2 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              {settings.component_stock_enabled && (
                <div className="border-t border-white/8 pt-4 space-y-3">
                  <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Composition / Stock par composants</h4>
                  {compositions.length > 0 && (
                    <div className="space-y-1.5">
                      {compositions.map((c, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-2">
                          <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                            <span className="text-sm text-blue-200 truncate block">{c.component?.name ?? 'Composant'}</span>
                            {c.is_drink && (
                              <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                Boisson {c.drink_choice === 'fixed' ? 'fixe' : 'au choix'}
                              </span>
                            )}
                          </div>
                          <input
                            type="number" min={0} step="any" value={c.quantity_per_unit || ''}
                            onChange={e => updateComposition(i, 'quantity_per_unit', parseFloat(e.target.value) || 0)}
                            className="w-16 flex-shrink-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs text-right focus:outline-none focus:border-blue-500/50"
                          />
                          {c.is_drink && (
                            <select
                              value={c.drink_choice} onChange={e => updateComposition(i, 'drink_choice', e.target.value as DrinkChoice)}
                              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                            >
                              <option value="fixed" className="bg-gray-900">Fixe</option>
                              <option value="choice" className="bg-gray-900">Au choix</option>
                            </select>
                          )}
                          <button type="button" onClick={() => removeComposition(i)} className="w-7 h-7 flex items-center justify-center text-blue-400/50 hover:text-red-400 transition-colors flex-shrink-0">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <select
                      value={newCompComponentId} onChange={e => setNewCompComponentId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="" className="bg-gray-900">Composant...</option>
                      {components.filter(c => !compositions.some(co => co.component_id === c.id && !co.is_drink)).map(c => (
                        <option key={c.id} value={c.id} className="bg-gray-900">{c.name} ({c.stock} {c.unit})</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0.01} step="any" value={newCompQty}
                        onChange={e => setNewCompQty(e.target.value)}
                        placeholder="Qté"
                        className="w-16 flex-shrink-0 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-xs text-center focus:outline-none focus:border-blue-500/50"
                      />
                      <button type="button" onClick={() => setNewCompIsDrink(!newCompIsDrink)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-all flex-shrink-0 ${newCompIsDrink ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-white/5 border-white/10 text-white/40'}`}
                        title="Marquer comme boisson"
                      >
                        Boisson
                      </button>
                      <button type="button" onClick={addComposition} disabled={!newCompComponentId || !(parseFloat(newCompQty) > 0)}
                        className="ml-auto flex items-center gap-1 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/25 text-blue-200 text-xs font-medium transition-all disabled:opacity-30 flex-shrink-0">
                        <Plus size={14} /> Ajouter
                      </button>
                    </div>
                  </div>
                  {newCompIsDrink && (
                    <select
                      value={newCompDrinkChoice} onChange={e => setNewCompDrinkChoice(e.target.value as DrinkChoice)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="fixed" className="bg-gray-900">Boisson fixe (toujours incluse)</option>
                      <option value="choice" className="bg-gray-900">Boisson au choix (le caissier choisit parmi les boissons du produit)</option>
                    </select>
                  )}
                  {compositions.length === 0 && (
                    <p className="text-white/30 text-xs">Aucune composition définie. Ce produit ne génèrera aucun mouvement de stock de composants.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="sticky bottom-0 px-6 py-4 border-t border-white/8 bg-gray-950/80 backdrop-blur-xl flex gap-3">
          <motion.button
            type="submit"
            disabled={saving || !form.name.trim()}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm shadow-xl shadow-blue-600/25 transition-all"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={16} />}
            {product ? 'Mettre à jour' : 'Créer le produit'}
          </motion.button>
          <button type="button" onClick={onCancel} className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition-all">
            Annuler
          </button>
        </div>
      </form>
    </motion.div>
  );
}
