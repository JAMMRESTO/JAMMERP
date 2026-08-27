import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Check, Package, Image, ChevronDown, ChevronUp, Layers, Upload, RotateCcw, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Product, Category, ProductOption, ProductVariantGroup, ProductVariant } from '../../lib/types';
import {
  exportProductsToExcel,
  downloadProductTemplate,
  parseProductsExcel,
  validateImportRows,
  importProducts,
  type ImportRow,
  type ImportResult,
} from '../../services/productImportExport';

interface ProdForm { nom: string; category_id: string; prix: number | ''; image_url: string; actif: boolean; }
const emptyProd: ProdForm = { nom: '', category_id: '', prix: '', image_url: '', actif: true };

async function uploadProductImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    const url = await uploadProductImage(file);
    setUploading(false);
    if (url) onChange(url);
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-2">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden ${dragOver ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}
        style={{ height: 140 }}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="bg-white text-gray-800 rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                <RotateCcw size={12} /> Changer
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="bg-red-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow"
              >
                <X size={12} /> Supprimer
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-amber-500 transition-colors"
          >
            {uploading ? (
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Upload size={28} strokeWidth={1.5} />
                <span className="text-xs font-medium">Cliquer ou glisser une image</span>
                <span className="text-[10px] text-gray-300">JPG, PNG, WEBP — max 5 Mo</span>
              </>
            )}
          </button>
        )}
        {uploading && value && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

interface VGForm { nom: string; required: boolean; }

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [form, setForm] = useState<ProdForm>(emptyProd);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [newOptionNom, setNewOptionNom] = useState('');
  const [newOptionPrix, setNewOptionPrix] = useState<number | ''>('');
  const [variantGroups, setVariantGroups] = useState<ProductVariantGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [activeTab, setActiveTab] = useState<'infos' | 'options' | 'variantes'>('infos');

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importValidation, setImportValidation] = useState<ReturnType<typeof validateImportRows> | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [prodsRes, catsRes] = await Promise.all([
      supabase.from('products').select('*, category:categories!category_id(nom), options:product_options(*)').order('nom'),
      supabase.from('categories').select('*').order('ordre'),
    ]);
    setProducts(prodsRes.data || []);
    setCategories(catsRes.data || []);
    setLoading(false);
  };

  const fetchVariantGroups = async (productId: string) => {
    const { data } = await supabase
      .from('product_variant_groups')
      .select('*, variants:product_variants(*)')
      .eq('product_id', productId)
      .order('ordre');
    setVariantGroups(data || []);
  };

  const openCreate = () => {
    setEditProd(null);
    setForm({ ...emptyProd, category_id: categories[0]?.id || '' });
    setOptions([]);
    setVariantGroups([]);
    setActiveTab('infos');
    setShowModal(true);
  };

  const openEdit = async (p: Product) => {
    setEditProd(p);
    setForm({ nom: p.nom, category_id: p.category_id, prix: p.prix || '', image_url: p.image_url, actif: p.actif });
    setOptions(p.options || []);
    setVariantGroups([]);
    setActiveTab('infos');
    setShowModal(true);
    await fetchVariantGroups(p.id);
  };

  const close = () => { setShowModal(false); setEditProd(null); setOptions([]); setVariantGroups([]); };

  const handleSave = async () => {
    if (!form.nom || !form.category_id) return;
    setSaving(true);
    let productId = editProd?.id;
    const formToSave = { ...form, prix: Number(form.prix) || 0 };

    if (editProd) {
      await supabase.from('products').update(formToSave).eq('id', editProd.id);
    } else {
      const { data } = await supabase.from('products').insert(formToSave).select().single();
      productId = data?.id;
    }

    if (productId) {
      const existingOptions = editProd?.options || [];
      const toDelete = existingOptions.filter(o => !options.find(oo => oo.id === o.id));
      const toInsert = options.filter(o => !existingOptions.find(oo => oo.id === o.id));
      if (toDelete.length > 0) await supabase.from('product_options').delete().in('id', toDelete.map(o => o.id));
      if (toInsert.length > 0) {
        await supabase.from('product_options').insert(toInsert.map(o => ({
          product_id: productId, nom: o.nom, prix_delta: o.prix_delta,
        })));
      }
    }

    await fetchAll();
    setSaving(false);
    close();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addOption = () => {
    if (!newOptionNom) return;
    setOptions(prev => [...prev, { id: crypto.randomUUID(), product_id: editProd?.id || '', nom: newOptionNom, prix_delta: Number(newOptionPrix) || 0, created_at: '' }]);
    setNewOptionNom('');
    setNewOptionPrix('');
  };

  const removeOption = (id: string) => setOptions(prev => prev.filter(o => o.id !== id));

  const addVariantGroup = async () => {
    if (!editProd) return;
    const { data } = await supabase
      .from('product_variant_groups')
      .insert({ product_id: editProd.id, nom: 'Nouveau groupe', required: false, ordre: variantGroups.length })
      .select('*, variants:product_variants(*)')
      .single();
    if (data) setVariantGroups(prev => [...prev, data]);
  };

  const updateVariantGroup = async (groupId: string, updates: Partial<VGForm>) => {
    await supabase.from('product_variant_groups').update(updates).eq('id', groupId);
    setVariantGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
  };

  const deleteVariantGroup = async (groupId: string) => {
    if (!confirm('Supprimer ce groupe de variantes ?')) return;
    await supabase.from('product_variant_groups').delete().eq('id', groupId);
    setVariantGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const addVariant = async (groupId: string) => {
    const { data } = await supabase
      .from('product_variants')
      .insert({ group_id: groupId, nom: 'Nouvelle variante', prix_delta: 0, default_selected: false, actif: true })
      .select()
      .single();
    if (data) {
      setVariantGroups(prev => prev.map(g => g.id === groupId ? { ...g, variants: [...(g.variants || []), data] } : g));
    }
  };

  const updateVariant = async (groupId: string, variantId: string, updates: Partial<ProductVariant>) => {
    await supabase.from('product_variants').update(updates).eq('id', variantId);
    setVariantGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, variants: (g.variants || []).map(v => v.id === variantId ? { ...v, ...updates } : v) }
      : g
    ));
  };

  const deleteVariant = async (groupId: string, variantId: string) => {
    await supabase.from('product_variants').delete().eq('id', variantId);
    setVariantGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, variants: (g.variants || []).filter(v => v.id !== variantId) }
      : g
    ));
  };

  const parentCats = categories.filter(c => !c.parent_id);
  const subCats = categories.filter(c => !!c.parent_id);

  const filtered = filterCat
    ? products.filter(p => {
        if (p.category_id === filterCat) return true;
        const cat = categories.find(c => c.id === p.category_id);
        return cat?.parent_id === filterCat;
      })
    : products;

  const getCatLabel = (p: Product) => {
    const cat = categories.find(c => c.id === p.category_id);
    if (!cat) return (p as any).category?.nom || '';
    if (cat.parent_id) {
      const parent = categories.find(c => c.id === cat.parent_id);
      return parent ? `${parent.nom} › ${cat.nom}` : cat.nom;
    }
    return cat.nom;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Produits</h2>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} produit(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportProductsToExcel(products, categories)} title="Exporter en Excel" className="flex items-center gap-2 bg-white border border-gray-200 hover:border-emerald-300 hover:text-emerald-600 text-gray-600 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <Download size={16} /> <span className="hidden sm:inline">Exporter</span>
          </button>
          <button onClick={() => setShowImport(true)} title="Importer depuis Excel" className="flex items-center gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 text-gray-600 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <Upload size={16} /> <span className="hidden sm:inline">Importer</span>
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      <div className="overflow-x-auto flex gap-2 pb-1">
        <button onClick={() => setFilterCat('')} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${!filterCat ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300'}`}>
          Tout
        </button>
        {parentCats.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filterCat === c.id ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300'}`}>
            {c.nom}
          </button>
        ))}
        {subCats.filter(c => !filterCat || c.parent_id === filterCat).map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${filterCat === c.id ? 'bg-gray-700 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}>
            <span className="text-gray-400">›</span> {c.nom}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="relative w-full bg-gray-100 overflow-hidden" style={{ height: 140 }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.nom} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-1">
                    <Image size={28} strokeWidth={1.5} />
                    <span className="text-xs text-gray-300">Pas d'image</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.actif ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                    {p.actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
              <div className="flex-1 p-3 flex flex-col">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{p.nom}</p>
                <p className="text-xs text-gray-500 mt-0.5">{getCatLabel(p)}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-amber-600 text-base">{p.prix.toLocaleString('fr-FR')} FCFA</span>
                  {p.options && p.options.length > 0 && (
                    <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{p.options.length} option(s)</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(p)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all">
                    <Pencil size={12} /> Modifier
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center text-red-500 transition-all flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full p-10 text-center text-gray-400">Aucun produit</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">{editProd ? 'Modifier' : 'Nouveau'} produit</h3>
              </div>
              <button onClick={close}><X size={18} /></button>
            </div>

            <div className="flex border-b border-gray-100 flex-shrink-0">
              {(['infos', 'options', 'variantes'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-all border-b-2 ${activeTab === tab ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {tab === 'infos' ? 'Informations' : tab === 'options' ? 'Options' : 'Variantes'}
                  {tab === 'variantes' && variantGroups.length > 0 && (
                    <span className="ml-1 bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full text-[10px]">{variantGroups.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {activeTab === 'infos' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom du produit</label>
                      <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" placeholder="Ex: Thiéboudienne" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1.5">Catégorie</label>
                      <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20">
                        {parentCats.map(c => (
                          <optgroup key={c.id} label={c.nom}>
                            <option value={c.id}>{c.nom}</option>
                            {subCats.filter(s => s.parent_id === c.id).map(s => (
                              <option key={s.id} value={s.id}>  › {s.nom}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1.5">Prix (FCFA)</label>
                      <input type="number" value={form.prix} onChange={e => setForm(f => ({ ...f, prix: e.target.value === '' ? '' : +e.target.value }))} placeholder="0" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1.5 flex items-center gap-1.5">
                        <Image size={13} className="text-gray-400" /> Image du produit
                      </label>
                      <ImageUploader value={form.image_url} onChange={url => setForm(f => ({ ...f, image_url: url }))} />
                    </div>
                    <div className="col-span-2 flex items-center gap-3">
                      <button onClick={() => setForm(f => ({ ...f, actif: !f.actif }))} className={`w-12 h-6 rounded-full transition-colors flex items-center ${form.actif ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.actif ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                      <span className="text-sm text-gray-700">{form.actif ? 'Produit actif' : 'Produit inactif'}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'options' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">Les options sont des suppléments multi-sélectionnables avec un prix additionnel (ex: Extra fromage, Sauce piquante).</p>
                  {options.map(o => (
                    <div key={o.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{o.nom}</span>
                      <span className="text-sm text-amber-600 font-medium w-28 text-right">
                        {o.prix_delta > 0 ? `+${o.prix_delta.toLocaleString()}` : o.prix_delta === 0 ? 'Gratuit' : o.prix_delta.toLocaleString()} FCFA
                      </span>
                      <button onClick={() => removeOption(o.id)} className="w-7 h-7 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-500">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {options.length === 0 && <p className="text-center text-gray-400 text-sm py-4">Aucune option</p>}
                  <div className="flex gap-2 mt-2">
                    <input value={newOptionNom} onChange={e => setNewOptionNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOption()} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" placeholder="Nom de l'option" />
                    <input type="number" value={newOptionPrix} onChange={e => setNewOptionPrix(e.target.value === '' ? '' : +e.target.value)} className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" placeholder="0" />
                    <button onClick={addOption} className="w-9 h-9 bg-amber-500 hover:bg-amber-400 text-white rounded-xl flex items-center justify-center">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'variantes' && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 flex-1">Les variantes sont des choix mutuellement exclusifs par groupe (ex: Taille → Petit/Grand, Cuisson → Saignant/Bien cuit).</p>
                    {editProd ? (
                      <button onClick={addVariantGroup} className="flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-xl font-semibold whitespace-nowrap flex-shrink-0">
                        <Plus size={12} /> Groupe
                      </button>
                    ) : (
                      <p className="text-xs text-amber-600 flex-shrink-0 pt-2">Enregistrez d'abord</p>
                    )}
                  </div>

                  {variantGroups.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Layers size={28} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Aucun groupe de variantes</p>
                    </div>
                  )}

                  {variantGroups.map(group => (
                    <VariantGroupEditor
                      key={group.id}
                      group={group}
                      onUpdateGroup={updates => updateVariantGroup(group.id, updates)}
                      onDeleteGroup={() => deleteVariantGroup(group.id)}
                      onAddVariant={() => addVariant(group.id)}
                      onUpdateVariant={(vid, upd) => updateVariant(group.id, vid, upd)}
                      onDeleteVariant={vid => deleteVariant(group.id, vid)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-gray-100 flex-shrink-0">
              <button onClick={close} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.nom} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Check size={16} /> {saving ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal
          fileInputRef={fileInputRef}
          importRows={importRows}
          importValidation={importValidation}
          importMode={importMode}
          importError={importError}
          importing={importing}
          importResult={importResult}
          onClose={() => {
            setShowImport(false);
            setImportRows([]);
            setImportValidation(null);
            setImportError('');
            setImportResult(null);
          }}
          onFileSelect={async (file) => {
            setImportError('');
            setImportResult(null);
            try {
              const rows = await parseProductsExcel(file);
              setImportRows(rows);
              setImportValidation(validateImportRows(rows, categories));
            } catch (e: any) {
              setImportError(e.message || 'Erreur de lecture du fichier');
              setImportRows([]);
              setImportValidation(null);
            }
          }}
          onModeChange={setImportMode}
          onDownloadTemplate={() => downloadProductTemplate(categories)}
          onImport={async () => {
            if (!importValidation) return;
            setImporting(true);
            setImportError('');
            try {
              const result = await importProducts(importValidation.valid, categories, importMode);
              setImportResult(result);
              await fetchAll();
            } catch (e: any) {
              setImportError(e.message || 'Erreur lors de l\'import');
            } finally {
              setImporting(false);
            }
          }}
        />
      )}
    </div>
  );
}

interface VGEditorProps {
  group: ProductVariantGroup;
  onUpdateGroup: (u: Partial<VGForm>) => void;
  onDeleteGroup: () => void;
  onAddVariant: () => void;
  onUpdateVariant: (id: string, u: Partial<ProductVariant>) => void;
  onDeleteVariant: (id: string) => void;
}

function VariantGroupEditor({ group, onUpdateGroup, onDeleteGroup, onAddVariant, onUpdateVariant, onDeleteVariant }: VGEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingNom, setEditingNom] = useState(false);
  const [nomVal, setNomVal] = useState(group.nom);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {editingNom ? (
          <input
            value={nomVal}
            onChange={e => setNomVal(e.target.value)}
            onBlur={() => { onUpdateGroup({ nom: nomVal }); setEditingNom(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { onUpdateGroup({ nom: nomVal }); setEditingNom(false); } }}
            className="flex-1 text-sm font-semibold border border-amber-300 rounded-lg px-2 py-1 focus:outline-none"
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-gray-800 cursor-pointer hover:text-amber-600"
            onClick={() => setEditingNom(true)}
            title="Cliquer pour renommer"
          >
            {group.nom}
          </span>
        )}
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={group.required}
            onChange={e => onUpdateGroup({ required: e.target.checked })}
            className="rounded"
          />
          Requis
        </label>
        <span className="text-xs text-gray-400">{group.variants?.filter(v => v.actif).length || 0} opt.</span>
        <button onClick={onDeleteGroup} className="w-6 h-6 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-400">
          <Trash2 size={11} />
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-2">
          {(group.variants || []).map(v => (
            <div key={v.id} className="flex items-center gap-2">
              <input
                defaultValue={v.nom}
                onBlur={e => { if (e.target.value !== v.nom) onUpdateVariant(v.id, { nom: e.target.value }); }}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
                placeholder="Nom"
              />
              <input
                type="number"
                defaultValue={v.prix_delta || ''}
                onBlur={e => { if (+e.target.value !== v.prix_delta) onUpdateVariant(v.id, { prix_delta: +e.target.value || 0 }); }}
                className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-400 text-center"
                placeholder="0"
              />
              <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={v.default_selected}
                  onChange={e => onUpdateVariant(v.id, { default_selected: e.target.checked })}
                  className="rounded"
                />
                Défaut
              </label>
              <button onClick={() => onDeleteVariant(v.id)} className="w-7 h-7 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-400 flex-shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
          <button onClick={onAddVariant} className="w-full border border-dashed border-gray-300 hover:border-amber-400 text-gray-400 hover:text-amber-500 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all">
            <Plus size={12} /> Ajouter une variante
          </button>
        </div>
      )}
    </div>
  );
}

interface ImportModalProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  importRows: ImportRow[];
  importValidation: ReturnType<typeof validateImportRows> | null;
  importMode: 'merge' | 'replace';
  importError: string;
  importing: boolean;
  importResult: ImportResult | null;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  onModeChange: (mode: 'merge' | 'replace') => void;
  onDownloadTemplate: () => void;
  onImport: () => void;
}

function ImportModal({
  fileInputRef, importRows, importValidation, importMode,
  importError, importing, importResult,
  onClose, onFileSelect, onModeChange, onDownloadTemplate, onImport,
}: ImportModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const hasFatalErrors = importValidation && importValidation.errors.length > 0;
  const canImport = importValidation && importValidation.valid.length > 0 && !hasFatalErrors && !importing;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-500" />
            <h3 className="font-semibold text-gray-900">Importer des produits (Excel)</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {importResult ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800">Import terminé</p>
                  <ul className="text-sm text-green-700 mt-1 space-y-0.5">
                    <li>{importResult.categoriesCreated} catégorie(s) créée(s)</li>
                    <li>{importResult.productsCreated} produit(s) créé(s)</li>
                    <li>{importResult.productsUpdated} produit(s) mis à jour</li>
                  </ul>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="font-semibold text-amber-800 mb-1">Erreurs partielles</p>
                  <ul className="text-xs text-amber-700 space-y-0.5 max-h-40 overflow-y-auto">
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-400 text-white py-2.5 rounded-xl text-sm font-semibold">Fermer</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-700">Besoin d'un point de départ ? Téléchargez un modèle pré-rempli.</p>
                <button onClick={onDownloadTemplate} className="flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap">
                  <Download size={12} /> Modèle
                </button>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) onFileSelect(f); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <FileSpreadsheet size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm font-medium text-gray-700">Glissez un fichier .xlsx ici</p>
                <p className="text-xs text-gray-400 mt-1">ou cliquez pour parcourir</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
              </div>

              {importError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{importError}</p>
                </div>
              )}

              {importValidation && importRows.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-lg font-medium">{importValidation.valid.length} valides</span>
                    <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-lg font-medium">{importValidation.errors.length} erreurs</span>
                    {importValidation.categoriesToCreate.length > 0 && (
                      <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg font-medium">{importValidation.categoriesToCreate.length} nouvelles catégories</span>
                    )}
                  </div>

                  {importValidation.categoriesToCreate.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">Catégories qui seront créées :</p>
                      <div className="flex flex-wrap gap-1">
                        {importValidation.categoriesToCreate.map(c => (
                          <span key={c} className="text-xs bg-white text-amber-700 px-2 py-0.5 rounded border border-amber-200">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                      <div className="col-span-5">Désignation</div>
                      <div className="col-span-4">Catégorie</div>
                      <div className="col-span-2">Prix</div>
                      <div className="col-span-1">Statut</div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {[...importValidation.valid, ...importValidation.errors].sort((a, b) => a.lineNumber - b.lineNumber).map(row => (
                        <div key={row.lineNumber} className="px-3 py-2 grid grid-cols-12 gap-2 text-sm border-t border-gray-100">
                          <div className="col-span-5 text-gray-800 truncate">{row.designation || <span className="text-red-400 italic">vide</span>}</div>
                          <div className="col-span-4 text-gray-600 truncate flex items-center gap-1">
                            {row.categorie}
                            {row.isNewCategory && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">nouvelle</span>}
                          </div>
                          <div className="col-span-2 text-gray-700">{row.prix != null ? row.prix.toLocaleString() : '-'}</div>
                          <div className="col-span-1">
                            {row.error ? (
                              <span title={row.error} className="text-red-500"><AlertCircle size={14} /></span>
                            ) : (
                              <span className="text-green-500"><CheckCircle2 size={14} /></span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Mode d'import</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onModeChange('merge')}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${importMode === 'merge' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        Fusion — Mettre à jour les existants, ajouter les nouveaux
                      </button>
                      <button
                        onClick={() => onModeChange('replace')}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${importMode === 'replace' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        Remplacement — Mettre à jour les présents, ignorer les autres
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {!importResult && (
          <div className="flex gap-3 px-6 pb-6 pt-3 border-t border-gray-100 flex-shrink-0">
            <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
            <button
              onClick={onImport}
              disabled={!canImport}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {importing ? 'Import en cours...' : `Importer${importValidation ? ` (${importValidation.valid.length})` : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
