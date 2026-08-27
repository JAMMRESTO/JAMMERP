import { useState, useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Facture, LigneDocument, Company } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface Props {
  facture: Facture;
  company: Company;
  onDone: () => void;
  onCancel: () => void;
}

export default function RetourForm({ facture, company, onDone, onCancel }: Props) {
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [retourType, setRetourType] = useState<'partiel' | 'total'>('partiel');
  const [retourLignes, setRetourLignes] = useState<{ ligne: LigneDocument; qte: number; selected: boolean }[]>([]);
  const [motif, setMotif] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLignes();
  }, [facture.id]);

  async function loadLignes() {
    const { data } = await supabase
      .from('facture_lignes')
      .select('*, produits(name, unite, conditionnement_nom)')
      .eq('facture_id', facture.id)
      .order('sort_order');
    const l = (data as LigneDocument[]) || [];
    setLignes(l);
    setRetourLignes(l.map(x => ({ ligne: x, qte: x.quantite, selected: false })));
  }

  const toReturn = retourType === 'total'
    ? retourLignes.map(r => ({ ...r, selected: true }))
    : retourLignes.filter(r => r.selected && r.qte > 0);

  const montantRembourse = toReturn.reduce((acc, r) => acc + r.qte * r.ligne.prix_unitaire, 0);

  async function submit() {
    if (toReturn.length === 0) return;
    setLoading(true);

    const { data: retour } = await supabase.from('retours').insert({
      company_id: facture.company_id,
      facture_id: facture.id,
      client_id: facture.client_id,
      date_retour: new Date().toISOString().split('T')[0],
      type_retour: retourType,
      motif,
      statut: 'traité',
      montant_rembourse: montantRembourse,
    }).select().single();

    if (!retour) { setLoading(false); return; }

    for (const r of toReturn) {
      const l = r.ligne;

      await supabase.from('retour_lignes').insert({
        retour_id: retour.id,
        facture_ligne_id: l.id || null,
        produit_id: l.produit_id || null,
        designation: l.designation,
        quantite_retournee: r.qte,
        prix_unitaire: l.prix_unitaire,
        motif,
      });

      if (l.produit_id) {
        const { data: produit } = await supabase
          .from('produits')
          .select('stock_actuel')
          .eq('id', l.produit_id)
          .maybeSingle();

        if (produit) {
          const stockApres = produit.stock_actuel + r.qte;
          await supabase.from('produits').update({ stock_actuel: stockApres }).eq('id', l.produit_id);
          await supabase.from('mouvements_stock').insert({
            company_id: facture.company_id,
            produit_id: l.produit_id,
            type_mouvement: 'retour',
            quantite: r.qte,
            stock_avant: produit.stock_actuel,
            stock_apres: stockApres,
            reference_id: retour.id,
            reference_type: 'retour',
            source: 'retour',
            notes: `Retour ${retourType}: ${facture.numero}`,
          });
        }
      }
    }

    const nouveauPaye = Math.max(0, facture.montant_paye - montantRembourse);
    const nouveauReste = Math.min(facture.total, facture.reste_a_payer + montantRembourse);
    const statut = nouveauPaye <= 0
      ? (facture.statut === 'annulée' ? 'annulée' : 'envoyée')
      : nouveauPaye < facture.total
        ? 'partiellement_payée'
        : 'payée';

    await supabase.from('factures').update({
      montant_paye: nouveauPaye,
      reste_a_payer: nouveauReste,
      statut,
    }).eq('id', facture.id);

    setLoading(false);
    onDone();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
          <RotateCcw className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">Retour sur {facture.numero}</div>
          <div className="text-xs text-slate-500">Sélectionnez le type et les articles à retourner</div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['partiel', 'total'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setRetourType(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors capitalize border ${
              retourType === t
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            Retour {t}
          </button>
        ))}
      </div>

      {retourType === 'partiel' && retourLignes.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Articles retournés</div>
          {retourLignes.map((r, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <input
                type="checkbox"
                checked={r.selected}
                onChange={e => setRetourLignes(prev =>
                  prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x)
                )}
                className="w-4 h-4 accent-amber-600"
              />
              <span className="flex-1 text-sm text-slate-800">{r.ligne.designation}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Qté</span>
                <input
                  type="number"
                  value={r.qte || ''}
                  onChange={e => setRetourLignes(prev =>
                    prev.map((x, j) => j === i
                      ? { ...x, qte: Math.min(Number(e.target.value), r.ligne.quantite), selected: true }
                      : x
                    )
                  )}
                  min="0"
                  max={r.ligne.quantite}
                  step="0.001"
                  disabled={!r.selected}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40"
                />
                <span className="text-xs text-slate-400">/ {r.ligne.quantite}</span>
              </div>
              <span className="text-xs font-medium text-slate-600 w-24 text-right">
                {formatCurrency(r.qte * r.ligne.prix_unitaire, company.currency_symbol)}
              </span>
            </div>
          ))}
        </div>
      )}

      {retourType === 'total' && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-sm text-slate-700">
          <AlertTriangle className="w-4 h-4 text-amber-600 inline mr-1.5" />
          Toutes les lignes ({retourLignes.length}) seront retournées.
          {retourLignes.filter(r => r.ligne.produit_id).length > 0 && (
            <span className="block mt-1 text-xs text-amber-600">
              {retourLignes.filter(r => r.ligne.produit_id).length} produit(s) retourné(s) en stock.
            </span>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Motif du retour</label>
        <input
          type="text"
          value={motif}
          onChange={e => setMotif(e.target.value)}
          placeholder="Ex: produit défectueux, erreur de commande..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {toReturn.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-medium text-amber-800">Montant remboursé / déduit de la caisse</span>
          <span className="text-lg font-bold text-amber-700">{formatCurrency(montantRembourse, company.currency_symbol)}</span>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading || toReturn.length === 0}
          className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Traitement...' : 'Valider le retour'}
        </button>
      </div>
    </div>
  );
}
