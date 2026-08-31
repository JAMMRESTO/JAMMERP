import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X, Check, Image, TrendingUp, AlertTriangle, Plus, Minus, Upload, Loader2, Utensils
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useTenant } from '../../context/TenantContext';
import { useSettings } from '../../context/SettingsContext';
import type { Product, Category, ProductVariant, Sauce, Flavor } from '../../types/database';

const UNITS = ['pièce', 'kg', 'g', 'litre', 'cl', 'ml', 'portion', 'boîte', 'sachet', 'lot'];

interface ProductFormProps {
  product?: Product | null;
  categories: Category[];
  sauces?: Sauce[];
  flavors?: Flavor[];
  onSave: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, categories, sauces = [], flavors = [], onSave, onCancel }: ProductFormProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const { settings } = useSettings();
  const siteId = currentSite?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      variants: (product?.variants as ProductVariant[]) ?? [],
      requires_sauce: product?.requires_sauce ?? false,
      sauce_required: product?.sauce_required ?? false,
      sauce_count: Math.min(3, Math.max(1, product?.sauce_count ?? 1)),
      allowed_sauce_ids: (product?.allowed_sauce_ids as string[]) ?? [],
      requires_flavor: product?.requires_flavor ?? false,
      flavor_required: product?.flavor_required ?? false,
      flavor_count: Math.min(3, Math.max(1, product?.flavor_count ?? 1)),
      allowed_flavor_ids: (product?.allowed_flavor_ids as string[]) ?? [],
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
    // Auto-generate product code if empty
    if (!form.product_code && form.name) {
      const code = form.name.toUpperCase().replace(/\s+/g, '').slice(0, 4) +
        '-' + String(Math.floor(Math.random() * 999 + 1)).padStart(3, '0');
      setForm(f => ({ ...f, product_code: code }));
    }
  }, [form.name]);

  function addVariant() {
    if (!newVariant.trim()) return;
    const price = newVariantPrice ? parseFloat(newVariantPrice) || undefined : undefined;
    setForm(f => ({ ...f, variants: [...f.variants, { label: newVariant.trim(), price }] }));
    setNewVariant('');
    setNewVariantPrice('');
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

  function toggleAllowedSauce(id: string) {
    setForm(prev => ({
      ...prev,
      allowed_sauce_ids: prev.allowed_sauce_ids.includes(id)
        ? prev.allowed_sauce_ids.filter(x => x !== id)
        : [...prev.allowed_sauce_ids, id],
    }));
  }

  function toggleAllowedFlavor(id: string) {
    setForm(prev => ({
      ...prev,
      allowed_flavor_ids: prev.allowed_flavor_ids.includes(id)
        ? prev.allowed_flavor_ids.filter(x => x !== id)
        : [...prev.allowed_flavor_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      ...form,
      stock: form.track_stock ? form.stock : null,
    };

    let error;
    if (product) {
      ({ error } = await supabase.from('products').update(payload).eq('id', product.id).eq('site_id', siteId));
    } else {
      const payloadWithSite = { ...payload, site_id: siteId };
      ({ error } = await supabase.from('products').insert(payloadWithSite));
    }

    setSaving(false);
    if (error) {
      toast('error', 'Erreur lors de l\'enregistrement');
      return;
    }
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

            {/* Variants */}
            <div>
              <label className="text-white/60 text-sm font-medium block mb-2">Variantes</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newVariant}
                  onChange={e => setNewVariant(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariant(); } }}
                  placeholder="Ex: Grande portion..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <input
                  type="number"
                  value={newVariantPrice}
                  onChange={e => setNewVariantPrice(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariant(); } }}
                  placeholder="Prix"
                  min={0}
                  step={50}
                  className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <button type="button" onClick={addVariant} className="px-3 py-2 rounded-xl bg-white/8 hover:bg-blue-600/30 text-white/60 hover:text-white transition-all">
                  <Plus size={15} />
                </button>
              </div>
              {form.variants.length > 0 && (
                <div className="space-y-1.5">
                  {form.variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-1.5">
                      <span className="text-sm text-blue-200 flex-1 truncate">{v.label}</span>
                      <input
                        type="number"
                        value={v.price ?? ''}
                        onChange={e => updateVariantPrice(i, e.target.value)}
                        placeholder={String(form.price || 0)}
                        min={0}
                        step={50}
                        className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs text-right placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                      />
                      <button type="button" onClick={() => removeVariant(i)} className="text-blue-400/50 hover:text-red-400 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <p className="text-white/25 text-[10px] mt-1">Laissez vide pour utiliser le prix par defaut ({form.price.toLocaleString('fr-FR')})</p>
                </div>
              )}
            </div>

            {settings.sauces_enabled && (
              <div className="bg-white/3 rounded-2xl border border-white/8 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils size={14} className="text-white/40" />
                    <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Sauces</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => f('requires_sauce', !form.requires_sauce)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${form.requires_sauce ? 'bg-emerald-600' : 'bg-white/10'}`}
                  >
                    <motion.div
                      animate={{ x: form.requires_sauce ? 16 : 2 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {form.requires_sauce && (
                  <>
                    <p className="text-white/40 text-xs">
                      L'écran de caisse ouvrira le choix des sauces après sélection de ce produit.
                    </p>

                    <div>
                      <label className="text-white/60 text-xs font-medium block mb-1.5">Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => f('sauce_required', true)}
                          className={`px-3 py-2 rounded-xl border text-xs transition-all ${form.sauce_required ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
                        >
                          Obligatoire
                        </button>
                        <button
                          type="button"
                          onClick={() => f('sauce_required', false)}
                          className={`px-3 py-2 rounded-xl border text-xs transition-all ${!form.sauce_required ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
                        >
                          Facultative
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-white/60 text-xs font-medium block mb-1.5">Nombre de sauces</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => f('sauce_count', n)}
                            className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${form.sauce_count === n ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
                          >
                            {n === 1 ? '1 sauce' : `${n} sauces`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-white/60 text-xs font-medium block mb-1.5">
                        Sauces autorisées <span className="text-white/30">({form.allowed_sauce_ids.length === 0 ? 'toutes' : `${form.allowed_sauce_ids.length} sélection${form.allowed_sauce_ids.length > 1 ? 's' : ''}`})</span>
                      </label>
                      {sauces.filter(s => s.is_active).length === 0 ? (
                        <p className="text-white/40 text-xs p-3 rounded-xl bg-white/3 border border-white/8">
                          Aucune sauce active. Créez d'abord des sauces via "Gérer les sauces".
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {sauces.filter(s => s.is_active).map(s => {
                            const selected = form.allowed_sauce_ids.length === 0 || form.allowed_sauce_ids.includes(s.id);
                            const explicitlySelected = form.allowed_sauce_ids.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => toggleAllowedSauce(s.id)}
                                className={`px-3 py-1.5 rounded-xl border text-xs transition-all ${explicitlySelected ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : selected ? 'bg-white/5 border-white/10 text-white/60' : 'bg-white/3 border-white/5 text-white/30'}`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-white/25 text-[10px] mt-1.5">Aucune sélection = toutes les sauces actives seront proposées.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {settings.flavors_enabled && (
              <div className="bg-white/3 rounded-2xl border border-white/8 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils size={14} className="text-white/40" />
                    <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Gouts</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => f('requires_flavor', !form.requires_flavor)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${form.requires_flavor ? 'bg-emerald-600' : 'bg-white/10'}`}
                  >
                    <motion.div
                      animate={{ x: form.requires_flavor ? 16 : 2 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {form.requires_flavor && (
                  <>
                    <p className="text-white/40 text-xs">
                      L'écran de caisse ouvrira le choix des gouts après sélection de ce produit.
                    </p>

                    <div>
                      <label className="text-white/60 text-xs font-medium block mb-1.5">Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => f('flavor_required', true)}
                          className={`px-3 py-2 rounded-xl border text-xs transition-all ${form.flavor_required ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
                        >
                          Obligatoire
                        </button>
                        <button
                          type="button"
                          onClick={() => f('flavor_required', false)}
                          className={`px-3 py-2 rounded-xl border text-xs transition-all ${!form.flavor_required ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
                        >
                          Facultative
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-white/60 text-xs font-medium block mb-1.5">Nombre de gouts</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => f('flavor_count', n)}
                            className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all ${form.flavor_count === n ? 'bg-blue-600/20 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
                          >
                            {n === 1 ? '1 gout' : `${n} gouts`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-white/60 text-xs font-medium block mb-1.5">
                        Gouts autorisés <span className="text-white/30">({form.allowed_flavor_ids.length === 0 ? 'tous' : `${form.allowed_flavor_ids.length} sélection${form.allowed_flavor_ids.length > 1 ? 's' : ''}`})</span>
                      </label>
                      {flavors.filter(fl => fl.is_active).length === 0 ? (
                        <p className="text-white/40 text-xs p-3 rounded-xl bg-white/3 border border-white/8">
                          Aucun gout actif. Créez d'abord des gouts via "Gérer les gouts".
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {flavors.filter(fl => fl.is_active).map(fl => {
                            const selected = form.allowed_flavor_ids.length === 0 || form.allowed_flavor_ids.includes(fl.id);
                            const explicitlySelected = form.allowed_flavor_ids.includes(fl.id);
                            return (
                              <button
                                key={fl.id}
                                type="button"
                                onClick={() => toggleAllowedFlavor(fl.id)}
                                className={`px-3 py-1.5 rounded-xl border text-xs transition-all ${explicitlySelected ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : selected ? 'bg-white/5 border-white/10 text-white/60' : 'bg-white/3 border-white/5 text-white/30'}`}
                              >
                                {fl.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-white/25 text-[10px] mt-1.5">Aucune sélection = tous les gouts actifs seront proposés.</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Pricing */}
            <div className="bg-white/3 rounded-2xl border border-white/8 p-4 space-y-4">
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Prix & Marges</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">Prix de vente *</label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => f('price', parseFloat(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    placeholder="0"
                    min={0}
                    step={50}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  />
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
                    onChange={e => f('stock', parseInt(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    placeholder="0"
                    min={0}
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
            </div>
          </div>
        </div>

        {/* Footer */}
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
