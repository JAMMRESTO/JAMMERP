import { useState, useEffect, useCallback } from 'react';
import { ArrowDown, ArrowUp, Truck, Plus, Search, Package, BarChart2, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Produit, MouvementStock } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import Modal from '../ui/Modal';
import ValuationPage from './ValuationPage';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props { companyId: string; currencySymbol: string; }

type Tab = 'entree' | 'sortie' | 'approvisionnement' | 'valorisation';

interface LigneMouvement {
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
}

interface MultiForm {
  lignes: LigneMouvement[];
  notes: string;
}

export default function InventairePage({ companyId, currencySymbol }: Props) {
  const [tab, setTab] = useState<Tab>('entree');
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchProduit, setSearchProduit] = useState('');
  const [form, setForm] = useState<MultiForm>({ lignes: [{ produit_id: '', quantite: 1, prix_unitaire: 0 }], notes: '' });

  useEffect(() => { loadAll(); }, [companyId]);
  useRealtimeRefresh(['produits', 'mouvements_stock'], companyId, useCallback(() => { loadAll(true); }, [companyId]));

  async function loadAll(silent = false) {
    if (!silent) setLoading(true);
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase.from('produits').select('*').eq('company_id', companyId).eq('is_active', true).order('name'),
      supabase.from('mouvements_stock')
        .select('*, produits(name, unite)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    setProduits(prods || []);
    setMouvements(movs || []);
    if (!silent) setLoading(false);
  }

  function openForm() {
    setForm({ lignes: [{ produit_id: '', quantite: 1, prix_unitaire: 0 }], notes: '' });
    setSearchProduit('');
    setError('');
    setShowForm(true);
  }

  function addLigne() {
    setForm(f => ({ ...f, lignes: [...f.lignes, { produit_id: '', quantite: 1, prix_unitaire: 0 }] }));
  }

  function removeLigne(idx: number) {
    setForm(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== idx) }));
  }

  function updateLigneProduit(idx: number, produit_id: string) {
    const p = produits.find(x => x.id === produit_id);
    setForm(f => ({
      ...f,
      lignes: f.lignes.map((l, i) => i === idx ? { ...l, produit_id, prix_unitaire: p?.prix_achat || 0 } : l),
    }));
  }

  function updateLigneQty(idx: number, quantite: number) {
    setForm(f => ({ ...f, lignes: f.lignes.map((l, i) => i === idx ? { ...l, quantite } : l) }));
  }

  function updateLignePrix(idx: number, prix_unitaire: number) {
    setForm(f => ({ ...f, lignes: f.lignes.map((l, i) => i === idx ? { ...l, prix_unitaire } : l) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validLignes = form.lignes.filter(l => l.produit_id && l.quantite > 0);
    if (validLignes.length === 0) { setError('Ajoutez au moins un produit avec une quantité valide'); return; }

    const duplicates = validLignes.map(l => l.produit_id).filter((id, i, arr) => arr.indexOf(id) !== i);
    if (duplicates.length > 0) { setError('Un même produit est sélectionné plusieurs fois'); return; }

    setSaving(true);
    setError('');

    const isSortie = tab === 'sortie';
    const type_mouvement = isSortie ? 'sortie' : 'entrée';
    const reference_type = tab === 'approvisionnement' ? 'approvisionnement' : tab;

    for (const ligne of validLignes) {
      const produit = produits.find(p => p.id === ligne.produit_id)!;
      const stock_avant = produit.stock_actuel;
      const stock_apres = isSortie ? stock_avant - ligne.quantite : stock_avant + ligne.quantite;

      const { error: mvErr } = await supabase.from('mouvements_stock').insert({
        company_id: companyId,
        produit_id: ligne.produit_id,
        type_mouvement,
        quantite: ligne.quantite,
        stock_avant,
        stock_apres,
        reference_type,
        source: reference_type,
        notes: form.notes,
      });

      if (mvErr) { setError(mvErr.message); setSaving(false); return; }

      await supabase.from('produits').update({ stock_actuel: stock_apres }).eq('id', ligne.produit_id);

      produit.stock_actuel = stock_apres;
    }

    setSaving(false);
    setShowForm(false);
    loadAll(true);
  }

  const filteredMovs = mouvements.filter(m => {
    if (tab === 'approvisionnement') return m.reference_type === 'approvisionnement';
    if (tab === 'sortie') return m.type_mouvement === 'sortie' && m.reference_type !== 'approvisionnement';
    return m.type_mouvement === 'entrée' && m.reference_type !== 'approvisionnement';
  });

  const filteredSearch = search
    ? filteredMovs.filter(m => (m.produits as any)?.name?.toLowerCase().includes(search.toLowerCase()))
    : filteredMovs;

  const TAB_CONFIG = {
    entree: { label: 'Entrée de stock', icon: ArrowDown, color: 'text-emerald-600', bg: 'bg-emerald-50', btnColor: 'bg-emerald-600 hover:bg-emerald-500', action: 'Enregistrer une entrée' },
    sortie: { label: 'Sortie de stock', icon: ArrowUp, color: 'text-red-600', bg: 'bg-red-50', btnColor: 'bg-red-600 hover:bg-red-500', action: 'Enregistrer une sortie' },
    approvisionnement: { label: 'Approvisionnement', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', btnColor: 'bg-blue-600 hover:bg-blue-500', action: 'Créer un approvisionnement' },
    valorisation: { label: 'Valorisation', icon: BarChart2, color: 'text-teal-600', bg: 'bg-teal-50', btnColor: 'bg-teal-600 hover:bg-teal-500', action: '' },
  };

  const cfg = TAB_CONFIG[tab] || TAB_CONFIG['entree'];

  const totalAppro = form.lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);

  const produitsFiltered = searchProduit
    ? produits.filter(p => p.name.toLowerCase().includes(searchProduit.toLowerCase()) || (p.reference || '').toLowerCase().includes(searchProduit.toLowerCase()))
    : produits;

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Inventaire</h2>
          <p className="text-sm text-slate-500">{mouvements.length} mouvement(s) enregistré(s)</p>
        </div>
        {tab !== 'valorisation' && (
          <button onClick={openForm}
            className={`flex items-center gap-2 ${cfg.btnColor} text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors`}>
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">{cfg.action}</span><span className="sm:hidden">Nouveau</span>
          </button>
        )}
      </div>

      <div className="hidden sm:flex gap-0 mb-5 border-b border-gray-200">
        {(Object.entries(TAB_CONFIG) as [Tab, typeof cfg][]).map(([id, c]) => {
          const Icon = c.icon;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                tab === id ? `border-current ${c.color}` : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sm:hidden grid grid-cols-4 gap-1.5 mb-5">
        {(Object.entries(TAB_CONFIG) as [Tab, typeof cfg][]).map(([id, c]) => {
          const Icon = c.icon;
          const shortLabels: Record<string, string> = { entree: 'Entrée', sortie: 'Sortie', approvisionnement: 'Approv.', valorisation: 'Valeur' };
          const isActive = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-colors ${
                isActive ? `${c.bg} ${c.color}` : 'bg-gray-100 text-slate-500'
              }`}>
              <Icon className="w-4 h-4" />
              <span className="leading-tight text-center">{shortLabels[id] || id}</span>
            </button>
          );
        })}
      </div>

      {tab === 'valorisation' ? (
        <ValuationPage companyId={companyId} currencySymbol={currencySymbol} />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredSearch.length === 0 ? (
            <div className="text-center py-20">
              <div className={`w-14 h-14 ${cfg.bg} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                <cfg.icon className={`w-7 h-7 ${cfg.color}`} />
              </div>
              <div className="text-slate-500 text-sm">Aucun mouvement enregistré</div>
              <button onClick={openForm} className={`mt-3 ${cfg.btnColor} text-white px-4 py-2 rounded-xl text-sm font-semibold`}>
                {cfg.action}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSearch.map(m => (
                <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.type_mouvement === 'entrée' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {m.type_mouvement === 'entrée'
                      ? <ArrowDown className="w-5 h-5 text-emerald-600" />
                      : <ArrowUp className="w-5 h-5 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 text-sm">{(m.produits as any)?.name || 'Produit inconnu'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {m.notes || m.reference_type} · {formatDate(m.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${m.type_mouvement === 'entrée' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.type_mouvement === 'entrée' ? '+' : '-'}{m.quantite} {(m.produits as any)?.unite}
                    </div>
                    <div className="text-xs text-slate-400">{m.stock_avant} → {m.stock_apres}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && (
        <Modal title={cfg.action} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col" style={{ maxHeight: '85vh' }}>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</div>}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchProduit}
                  onChange={e => setSearchProduit(e.target.value)}
                  placeholder="Filtrer les produits..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-3">
                {form.lignes.map((ligne, idx) => {
                  const produit = produits.find(p => p.id === ligne.produit_id);
                  const enAlerte = produit && produit.stock_actuel <= produit.stock_minimum;
                  return (
                    <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <select
                            value={ligne.produit_id}
                            onChange={e => updateLigneProduit(idx, e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Sélectionner un produit</option>
                            {produitsFiltered.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.reference ? ` (${p.reference})` : ''} — Stock: {p.stock_actuel} {p.unite}
                              </option>
                            ))}
                          </select>
                        </div>
                        {form.lignes.length > 1 && (
                          <button type="button" onClick={() => removeLigne(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {produit && (
                        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${enAlerte ? 'bg-orange-50 text-orange-700' : 'bg-white text-slate-500'}`}>
                          {produit.image_path || produit.image_url ? (
                            <img src={produit.image_path || produit.image_url} alt={produit.name} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-6 h-6 bg-slate-200 rounded flex items-center justify-center flex-shrink-0">
                              <Package className="w-3 h-3 text-slate-400" />
                            </div>
                          )}
                          <span>Stock actuel : <strong>{produit.stock_actuel} {produit.unite}</strong></span>
                          {enAlerte && <span className="ml-auto font-semibold text-orange-600">Alerte stock</span>}
                        </div>
                      )}

                      <div className={`grid gap-2 ${tab === 'approvisionnement' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Quantité *</label>
                          <input
                            type="number"
                            value={ligne.quantite || ''}
                            onChange={e => updateLigneQty(idx, Number(e.target.value))}
                            min="0.001" step="0.001"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        {tab === 'approvisionnement' && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Prix unitaire</label>
                            <input
                              type="number"
                              value={ligne.prix_unitaire || ''}
                              onChange={e => updateLignePrix(idx, Number(e.target.value))}
                              min="0" step="0.01"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                          </div>
                        )}
                      </div>

                      {tab === 'approvisionnement' && ligne.quantite > 0 && ligne.prix_unitaire > 0 && (
                        <div className="text-xs text-blue-700 font-semibold px-1">
                          Sous-total : {formatCurrency(ligne.quantite * ligne.prix_unitaire, currencySymbol)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addLigne}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter un produit
              </button>

              {tab === 'approvisionnement' && totalAppro > 0 && (
                <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-sm text-blue-700 font-medium">Total approvisionnement</span>
                  <span className="text-sm text-blue-800 font-bold">{formatCurrency(totalAppro, currencySymbol)}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Référence</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Référence, raison, fournisseur..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 sm:p-6 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Annuler
              </button>
              <button type="submit" disabled={saving}
                className={`flex-1 ${cfg.btnColor} text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2`}>
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement...</>
                ) : (
                  <>{form.lignes.filter(l => l.produit_id).length > 1
                    ? `Confirmer (${form.lignes.filter(l => l.produit_id).length} produits)`
                    : 'Confirmer'
                  }</>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
