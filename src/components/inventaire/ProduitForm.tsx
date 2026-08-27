import { useState, useRef } from 'react';
import { Plus, Upload, X, Trash2, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Produit, Categorie, ProduitUnite } from '../../types';

interface Props {
  companyId: string;
  produit?: Produit | null;
  categories: Categorie[];
  onSave: () => void;
  onCancel: () => void;
  onCategoryCreated: () => void;
}

const UNITES_SUGGERES = ['unité', 'pièce', 'kg', 'g', 'litre', 'cl', 'ml', 'm', 'cm', 'boîte', 'sac', 'paquet'];
const CONDITIONNEMENTS_SUGGERES = ['Carton', 'Pack', 'Palette', 'Lot', 'Colis', 'Caisse', 'Sachet', 'Boîte'];

function emptyUnite(sortOrder: number): ProduitUnite {
  return { nom: '', type: 'conditionnement', quantite: 1, prix: null, sort_order: sortOrder };
}

export default function ProduitForm({ companyId, produit, categories, onSave, onCancel, onCategoryCreated }: Props) {
  const [form, setForm] = useState({
    name: produit?.name || '',
    description: produit?.description || '',
    reference: produit?.reference || '',
    category_id: produit?.category_id || '',
    prix_achat: produit?.prix_achat ?? 0,
    prix_vente: produit?.prix_vente ?? 0,
    stock_actuel: produit?.stock_actuel ?? 0,
    stock_minimum: produit?.stock_minimum ?? 0,
    unite: produit?.unite || 'unité',
    tva_taux: produit?.tva_taux ?? 0,
  });

  const [unites, setUnites] = useState<ProduitUnite[]>(
    produit?.produit_unites?.length
      ? produit.produit_unites
      : produit?.conditionnement_nom
        ? [{ nom: produit.conditionnement_nom, type: 'conditionnement', quantite: produit.quantite_par_conditionnement || produit.conditionnement_quantite || 1, prix: produit.prix_conditionnement ?? null, sort_order: 0 }]
        : []
  );

  const [imagePreview, setImagePreview] = useState<string>(
    produit?.image_path || produit?.image_url || ''
  );
  const [imageData, setImageData] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showUniteSuggestions, setShowUniteSuggestions] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string | number) { setForm(f => ({ ...f, [k]: v })); }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      setImageData(result);
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImagePreview('');
    setImageData(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function createCategory() {
    if (!newCat.trim()) return;
    const { data } = await supabase.from('categories').insert({ company_id: companyId, name: newCat.trim() }).select().single();
    if (data) { set('category_id', data.id); onCategoryCreated(); setShowNewCat(false); setNewCat(''); }
  }

  function addUnite() {
    setUnites(u => [...u, emptyUnite(u.length)]);
  }

  function removeUnite(idx: number) {
    setUnites(u => u.filter((_, i) => i !== idx).map((x, i) => ({ ...x, sort_order: i })));
  }

  function updateUnite(idx: number, field: keyof ProduitUnite, value: string | number | null) {
    setUnites(u => u.map((x, i) => i === idx ? { ...x, [field]: value } : x));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const firstCond = unites.find(u => u.type === 'conditionnement');

    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description,
      reference: form.reference,
      category_id: form.category_id || null,
      prix_achat: form.prix_achat,
      prix_vente: form.prix_vente,
      prix_conditionnement: firstCond?.prix ?? null,
      stock_actuel: form.stock_actuel,
      stock_minimum: form.stock_minimum,
      unite: form.unite,
      conditionnement: firstCond?.nom || '',
      conditionnement_nom: firstCond?.nom || '',
      conditionnement_quantite: firstCond?.quantite || 1,
      quantite_par_conditionnement: firstCond?.quantite || 1,
      tva_taux: form.tva_taux,
    };

    if (imageData) {
      payload.image_path = imageData;
      payload.image_url = '';
    } else if (!imagePreview) {
      payload.image_path = null;
    }

    let produitId = produit?.id;

    if (produit) {
      const { error: err } = await supabase.from('produits').update(payload).eq('id', produit.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { data, error: err } = await supabase.from('produits').insert({ ...payload, company_id: companyId }).select().single();
      if (err || !data) { setError(err?.message || 'Erreur'); setLoading(false); return; }
      produitId = data.id;
    }

    if (produitId) {
      await supabase.from('produit_unites').delete().eq('produit_id', produitId);
      if (unites.length > 0) {
        const validUnites = unites.filter(u => u.nom.trim());
        if (validUnites.length > 0) {
          await supabase.from('produit_unites').insert(
            validUnites.map((u, i) => ({
              produit_id: produitId,
              company_id: companyId,
              nom: u.nom.trim(),
              type: u.type,
              quantite: u.quantite,
              prix: u.prix,
              sort_order: i,
            }))
          );
        }
      }
    }

    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom du produit *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Référence</label>
          <input type="text" value={form.reference} onChange={e => set('reference', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
          <div className="flex gap-2">
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sans catégorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => setShowNewCat(!showNewCat)}
              className="w-10 h-10 border border-gray-200 rounded-xl flex items-center justify-center text-blue-600 hover:bg-blue-50">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {showNewCat && (
            <div className="flex gap-2 mt-2">
              <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nouvelle catégorie"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={createCategory} className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">Créer</button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prix d'achat</label>
          <input type="number" value={form.prix_achat || ''} onChange={e => set('prix_achat', Number(e.target.value))} min="0"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prix de vente unitaire *</label>
          <input type="number" value={form.prix_vente || ''} onChange={e => set('prix_vente', Number(e.target.value))} min="0" required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Stock actuel</label>
          <input type="number" value={form.stock_actuel || ''} onChange={e => set('stock_actuel', Number(e.target.value))} min="0" step="0.001"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Stock minimum (alerte)</label>
          <input type="number" value={form.stock_minimum || ''} onChange={e => set('stock_minimum', Number(e.target.value))} min="0" step="0.001"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">Unité de base</label>
          <div className="flex gap-2">
            <input type="text" value={form.unite} onChange={e => set('unite', e.target.value)}
              onFocus={() => setShowUniteSuggestions(true)}
              onBlur={() => setTimeout(() => setShowUniteSuggestions(false), 150)}
              placeholder="unité, kg, litre..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {showUniteSuggestions && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
              <div className="flex flex-wrap gap-1.5 p-2">
                {UNITES_SUGGERES.map(u => (
                  <button key={u} type="button"
                    onMouseDown={() => { set('unite', u); setShowUniteSuggestions(false); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${form.unite === u ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-slate-600 border-gray-200 hover:bg-blue-50 hover:border-blue-300'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">TVA (%)</label>
          <input type="number" value={form.tva_taux || ''} onChange={e => set('tva_taux', Number(e.target.value))} min="0" max="100"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-700">Unités & Conditionnements</div>
            <div className="text-xs text-slate-400 mt-0.5">Ajoutez plusieurs modes de vente (carton, pack, palette...)</div>
          </div>
          <button type="button" onClick={addUnite}
            className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-500">
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        </div>

        {unites.length === 0 ? (
          <div className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-300 rounded-xl">
            Aucun mode de vente supplémentaire. Cliquez "Ajouter" pour créer un conditionnement ou une unité alternative.
          </div>
        ) : (
          <div className="space-y-2">
            {unites.map((u, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-1 flex items-center justify-center pt-2">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                  </div>

                  <div className="col-span-11 sm:col-span-3">
                    <label className="block text-xs text-slate-500 mb-1">Nom</label>
                    <div className="relative">
                      <input type="text" value={u.nom}
                        onChange={e => updateUnite(i, 'nom', e.target.value)}
                        placeholder="Carton, Pack..."
                        list={`cond-suggestions-${i}`}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <datalist id={`cond-suggestions-${i}`}>
                        {CONDITIONNEMENTS_SUGGERES.map(s => <option key={s} value={s} />)}
                      </datalist>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Type</label>
                    <select value={u.type} onChange={e => updateUnite(i, 'type', e.target.value as 'unite' | 'conditionnement')}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="conditionnement">Conditionnement</option>
                      <option value="unite">Unité alt.</option>
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">
                      {u.type === 'conditionnement' ? `Qté (${form.unite || 'u'})` : 'Coeff.'}
                    </label>
                    <input type="number" value={u.quantite || ''}
                      onChange={e => updateUnite(i, 'quantite', Number(e.target.value))}
                      min="0.001" step="0.001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="col-span-10 sm:col-span-3">
                    <label className="block text-xs text-slate-500 mb-1">
                      Prix spécifique
                      {u.prix === null && form.prix_vente > 0 && u.quantite > 0 && (
                        <span className="text-slate-400 ml-1">(auto: {new Intl.NumberFormat('fr-FR').format(form.prix_vente * u.quantite)})</span>
                      )}
                    </label>
                    <input type="number"
                      value={u.prix ?? ''}
                      onChange={e => updateUnite(i, 'prix', e.target.value === '' ? null : Number(e.target.value))}
                      min="0" step="0.01" placeholder="Vide = auto"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="col-span-2 sm:col-span-1 flex items-end pb-0.5 justify-center">
                    <button type="button" onClick={() => removeUnite(i)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors mt-5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {unites.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {CONDITIONNEMENTS_SUGGERES.filter(s => !unites.some(u => u.nom === s)).slice(0, 5).map(s => (
              <button key={s} type="button"
                onClick={() => setUnites(u => [...u, { nom: s, type: 'conditionnement', quantite: 1, prix: null, sort_order: u.length }])}
                className="text-xs px-2.5 py-1 bg-white border border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Image du produit</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="preview" className="h-24 w-24 rounded-xl object-cover border border-gray-200" />
            <button type="button" onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Upload className="w-4 h-4" />
            Charger une image depuis l'appareil
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
          {loading ? 'Enregistrement...' : produit ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  );
}
