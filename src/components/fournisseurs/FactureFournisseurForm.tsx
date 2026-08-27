import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Fournisseur, FactureFournisseur, LigneDocument, Produit } from '../../types';
import { formatCurrency, generateNumero } from '../../lib/utils';

interface Props {
  companyId: string;
  fournisseurs: Fournisseur[];
  facture?: FactureFournisseur | null;
  currencySymbol: string;
  tvaEnabled: boolean;
  tvaRate: number;
  onSave: () => void;
  onCancel: () => void;
}

const emptyLigne = (): LigneDocument => ({
  produit_id: null, designation: '', quantite: 1, prix_unitaire: 0,
  tva_taux: 0, montant_ht: 0, montant_tva: 0, montant_ttc: 0, sort_order: 0
});

export default function FactureFournisseurForm({ companyId, fournisseurs, facture, currencySymbol, tvaEnabled, tvaRate, onSave, onCancel }: Props) {
  const [fournisseurId, setFournisseurId] = useState(facture?.fournisseur_id || '');
  const [dateFacture, setDateFacture] = useState(facture?.date_facture || new Date().toISOString().split('T')[0]);
  const [dateEcheance, setDateEcheance] = useState(facture?.date_echeance || '');
  const [notes, setNotes] = useState(facture?.notes || '');
  const [lignes, setLignes] = useState<LigneDocument[]>([emptyLigne()]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNewFournisseur, setShowNewFournisseur] = useState(false);
  const [newFournisseurForm, setNewFournisseurForm] = useState({ name: '', phone: '', email: '' });
  const [newFournisseurLoading, setNewFournisseurLoading] = useState(false);
  const [newFournisseurError, setNewFournisseurError] = useState('');
  const [localFournisseurs, setLocalFournisseurs] = useState<Fournisseur[]>([]);

  const allFournisseurs = [...fournisseurs, ...localFournisseurs];

  useEffect(() => {
    supabase.from('produits').select('*').eq('company_id', companyId).eq('is_active', true).order('name').then(({ data }) => setProduits(data || []));
    if (facture?.id) {
      supabase.from('factures_fournisseurs_lignes').select('*').eq('facture_fournisseur_id', facture.id).then(({ data }) => {
        if (data && data.length > 0) setLignes(data as LigneDocument[]);
      });
    }
  }, [companyId, facture]);

  function updateLigne(idx: number, field: string, value: string | number | null) {
    setLignes(prev => {
      const next = [...prev];
      const l = { ...next[idx], [field]: value };
      if (field === 'produit_id' && value) {
        const p = produits.find(p => p.id === value);
        if (p) { l.designation = p.name; l.prix_unitaire = p.prix_achat; l.tva_taux = tvaEnabled ? tvaRate : 0; }
      }
      l.montant_ht = l.quantite * l.prix_unitaire;
      l.montant_tva = l.montant_ht * (l.tva_taux / 100);
      l.montant_ttc = l.montant_ht + l.montant_tva;
      l.sort_order = idx;
      next[idx] = l;
      return next;
    });
  }

  const totaux = lignes.reduce((acc, l) => ({
    ht: acc.ht + l.montant_ht, tva: acc.tva + l.montant_tva, ttc: acc.ttc + l.montant_ttc
  }), { ht: 0, tva: 0, ttc: 0 });

  async function handleCreateFournisseur() {
    if (!newFournisseurForm.name.trim()) return;
    setNewFournisseurLoading(true);
    setNewFournisseurError('');
    const { data, error } = await supabase
      .from('fournisseurs')
      .insert({ ...newFournisseurForm, company_id: companyId, is_active: true })
      .select()
      .maybeSingle();
    if (error) { setNewFournisseurError(error.message); setNewFournisseurLoading(false); return; }
    if (data) {
      const newF = data as Fournisseur;
      setLocalFournisseurs(prev => [...prev, newF]);
      setFournisseurId(newF.id);
    }
    setShowNewFournisseur(false);
    setNewFournisseurForm({ name: '', phone: '', email: '' });
    setNewFournisseurLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fournisseurId) { setError('Sélectionnez un fournisseur'); return; }
    if (lignes.some(l => !l.designation)) { setError('Complétez toutes les lignes'); return; }
    setLoading(true);
    setError('');

    const { data: count } = await supabase.from('factures_fournisseurs').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    const numero = generateNumero('FA', count || 0);

    if (facture?.id) {
      await supabase.from('factures_fournisseurs').update({
        fournisseur_id: fournisseurId, date_facture: dateFacture, date_echeance: dateEcheance || null,
        notes, sous_total: totaux.ht, tva_montant: totaux.tva, total: totaux.ttc,
        reste_a_payer: totaux.ttc - facture.montant_paye, updated_at: new Date().toISOString()
      }).eq('id', facture.id);
      await supabase.from('factures_fournisseurs_lignes').delete().eq('facture_fournisseur_id', facture.id);
      await supabase.from('factures_fournisseurs_lignes').insert(lignes.map(l => ({ ...l, facture_fournisseur_id: facture.id })));
    } else {
      const { data: newFacture, error: factError } = await supabase.from('factures_fournisseurs').insert({
        company_id: companyId, fournisseur_id: fournisseurId, numero, date_facture: dateFacture,
        date_echeance: dateEcheance || null, notes, sous_total: totaux.ht, tva_montant: totaux.tva,
        total: totaux.ttc, reste_a_payer: totaux.ttc, stock_mis_a_jour: true
      }).select().single();

      if (factError || !newFacture) { setError(factError?.message || 'Erreur'); setLoading(false); return; }

      await supabase.from('factures_fournisseurs_lignes').insert(lignes.map(l => ({ ...l, facture_fournisseur_id: newFacture.id })));

      for (const l of lignes) {
        if (!l.produit_id) continue;
        const produit = produits.find(p => p.id === l.produit_id);
        if (!produit) continue;
        const newStock = produit.stock_actuel + l.quantite;
        await supabase.from('produits').update({ stock_actuel: newStock }).eq('id', l.produit_id);
        await supabase.from('mouvements_stock').insert({
          company_id: companyId, produit_id: l.produit_id, type_mouvement: 'entrée',
          quantite: l.quantite, stock_avant: produit.stock_actuel, stock_apres: newStock,
          reference_id: newFacture.id, reference_type: 'facture_fournisseur', notes: `Achat: ${numero}`
        });
      }
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Fournisseur *</label>
            <button type="button" onClick={() => { setShowNewFournisseur(v => !v); setNewFournisseurError(''); }}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-500 font-semibold transition-colors">
              {showNewFournisseur ? <><X className="w-3 h-3" />Annuler</> : <><Plus className="w-3 h-3" />Nouveau fournisseur</>}
            </button>
          </div>
          <select value={fournisseurId} onChange={e => setFournisseurId(e.target.value)} required={!showNewFournisseur}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sélectionner...</option>
            {allFournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {showNewFournisseur && (
            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-emerald-700">Nouveau fournisseur (rapide)</p>
              {newFournisseurError && <p className="text-xs text-red-600">{newFournisseurError}</p>}
              <input type="text" placeholder="Nom *" value={newFournisseurForm.name}
                onChange={e => setNewFournisseurForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <input type="tel" placeholder="Téléphone" value={newFournisseurForm.phone}
                  onChange={e => setNewFournisseurForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
                <input type="email" placeholder="Email" value={newFournisseurForm.email}
                  onChange={e => setNewFournisseurForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
              </div>
              <button type="button" onClick={handleCreateFournisseur} disabled={newFournisseurLoading}
                className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors">
                {newFournisseurLoading ? 'Création...' : 'Créer et sélectionner'}
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Lignes de produits</label>
          <button type="button" onClick={() => setLignes(l => [...l, emptyLigne()])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 font-semibold">
            <Plus className="w-3 h-3" />Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <select value={l.produit_id || ''} onChange={e => updateLigne(i, 'produit_id', e.target.value || null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Produit libre</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-12 sm:col-span-4">
                  <input type="text" value={l.designation} onChange={e => updateLigne(i, 'designation', e.target.value)}
                    placeholder="Désignation" required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-4 sm:col-span-1">
                  <input type="number" value={l.quantite || ''} onChange={e => updateLigne(i, 'quantite', Number(e.target.value))}
                    min="0.001" step="0.001" placeholder="Qté"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-6 sm:col-span-1">
                  <input type="number" value={l.prix_unitaire || ''} onChange={e => updateLigne(i, 'prix_unitaire', Number(e.target.value))}
                    min="0" placeholder="P.U."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                  {lignes.length > 1 && (
                    <button type="button" onClick={() => setLignes(l => l.filter((_, j) => j !== i))}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex justify-end text-xs text-slate-500">
                Total: <span className="font-semibold text-slate-700 ml-1">{formatCurrency(l.montant_ttc, currencySymbol)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-1">
        {tvaEnabled && <div className="flex justify-between text-slate-600"><span>Sous-total HT</span><span>{formatCurrency(totaux.ht, currencySymbol)}</span></div>}
        {tvaEnabled && <div className="flex justify-between text-slate-600"><span>TVA ({tvaRate}%)</span><span>{formatCurrency(totaux.tva, currencySymbol)}</span></div>}
        <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-gray-200">
          <span>Total</span><span>{formatCurrency(totaux.ttc, currencySymbol)}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60">
          {loading ? 'Enregistrement...' : facture ? 'Modifier' : 'Enregistrer & Mettre à jour le stock'}
        </button>
      </div>
    </form>
  );
}
