import { useState, useEffect, useRef } from 'react';
import { CreditCard as Edit2, CheckCircle, RotateCcw, AlertTriangle, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Facture, Paiement, Company, LigneDocument } from '../../types';
import { formatCurrency, formatDate, getStatutColor, getStatutLabel, MODES_PAIEMENT } from '../../lib/utils';
import PrintShareModal from './PrintShareModal';

interface Props {
  factureId: string;
  company: Company;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  autoOpenPrint?: boolean;
  onPrintOpened?: () => void;
}

export default function FactureDetail({ factureId, company, onClose, onEdit, onRefresh, autoOpenPrint, onPrintOpened }: Props) {
  const [facture, setFacture] = useState<Facture | null>(null);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [showPaiement, setShowPaiement] = useState(false);
  const [montantPaie, setMontantPaie] = useState(0);
  const [modePaiement, setModePaiement] = useState('Espèces');
  const [datePaie, setDatePaie] = useState(new Date().toISOString().split('T')[0]);
  const [loadingPaie, setLoadingPaie] = useState(false);
  const [showRetourForm, setShowRetourForm] = useState(false);
  const [showPrintShare, setShowPrintShare] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const autoOpenRef = useRef(false);
  const [retourType, setRetourType] = useState<'partiel' | 'total'>('partiel');
  const [retourLignes, setRetourLignes] = useState<{ligne: LigneDocument; qte: number; selected: boolean}[]>([]);
  const [retourMotif, setRetourMotif] = useState('');
  const [loadingRetour, setLoadingRetour] = useState(false);

  useEffect(() => { load(); }, [factureId]);

  async function load() {
    const [{ data: f }, { data: l }, { data: p }] = await Promise.all([
      supabase.from('factures').select('*, clients(*)').eq('id', factureId).maybeSingle(),
      supabase.from('facture_lignes').select('*, produits(name, unite, conditionnement_nom)').eq('facture_id', factureId).order('sort_order'),
      supabase.from('paiements').select('*').eq('facture_id', factureId).order('date_paiement'),
    ]);
    setFacture(f);
    setLignes((l as LigneDocument[]) || []);
    setPaiements(p || []);
    if (f) setMontantPaie(f.reste_a_payer);
    setDataLoaded(true);
  }

  useEffect(() => {
    if (autoOpenPrint && dataLoaded && !autoOpenRef.current) {
      autoOpenRef.current = true;
      setShowPrintShare(true);
      onPrintOpened?.();
    }
  }, [autoOpenPrint, dataLoaded]);

  async function encaisser() {
    if (!facture || montantPaie <= 0) return;
    setLoadingPaie(true);
    const nouveau = facture.montant_paye + montantPaie;
    const reste = Math.max(0, facture.total - nouveau);
    const statut = reste <= 0 ? 'payée' : 'partiellement_payée';

    await supabase.from('paiements').insert({
      company_id: company.id, facture_id: facture.id, client_id: facture.client_id,
      date_paiement: datePaie, montant: montantPaie, mode_paiement: modePaiement
    });

    await supabase.from('factures').update({ montant_paye: nouveau, reste_a_payer: reste, statut }).eq('id', facture.id);
    setShowPaiement(false);
    setLoadingPaie(false);
    load();
    onRefresh();
  }

  function openRetour() {
    setRetourType('partiel');
    setRetourMotif('');
    setRetourLignes(
      (lignes as LigneDocument[])
        .map(l => ({ ligne: l, qte: l.quantite, selected: false }))
    );
    setShowRetourForm(true);
  }

  async function processRetour() {
    if (!facture) return;
    const toReturn = retourType === 'total'
      ? retourLignes.map(r => ({ ...r, selected: true }))
      : retourLignes.filter(r => r.selected && r.qte > 0);
    if (toReturn.length === 0) return;

    setLoadingRetour(true);

    const montantRembourse = toReturn.reduce((acc, r) => acc + r.qte * r.ligne.prix_unitaire, 0);

    const { data: retour } = await supabase.from('retours').insert({
      company_id: company.id, facture_id: facture.id, client_id: facture.client_id,
      date_retour: new Date().toISOString().split('T')[0],
      type_retour: retourType, motif: retourMotif,
      statut: 'traité', montant_rembourse: montantRembourse
    }).select().single();

    if (!retour) { setLoadingRetour(false); return; }

    for (const r of toReturn) {
      const l = r.ligne;

      await supabase.from('retour_lignes').insert({
        retour_id: retour.id, facture_ligne_id: l.id || null,
        produit_id: l.produit_id || null, designation: l.designation,
        quantite_retournee: r.qte, prix_unitaire: l.prix_unitaire, motif: retourMotif
      });

      if (l.produit_id) {
        const { data: produit } = await supabase.from('produits').select('stock_actuel, unite, stock_minimum').eq('id', l.produit_id).maybeSingle();
        if (produit) {
          const stockApres = produit.stock_actuel + r.qte;
          await supabase.from('produits').update({ stock_actuel: stockApres }).eq('id', l.produit_id);
          await supabase.from('mouvements_stock').insert({
            company_id: company.id, produit_id: l.produit_id, type_mouvement: 'retour',
            quantite: r.qte, stock_avant: produit.stock_actuel, stock_apres: stockApres,
            reference_id: retour.id, reference_type: 'retour', source: 'retour',
            notes: `Retour ${retourType}: ${facture.numero}`
          });
        }
      }
    }

    const nouveauPaye = Math.max(0, facture.montant_paye - montantRembourse);
    const nouveauReste = Math.min(facture.total, facture.reste_a_payer + montantRembourse);
    const statutRetour = nouveauPaye <= 0
      ? (facture.statut === 'annulée' ? 'annulée' as const : 'envoyée' as const)
      : nouveauPaye < facture.total
        ? 'partiellement_payée' as const
        : 'payée' as const;

    await supabase.from('factures').update({
      montant_paye: nouveauPaye,
      reste_a_payer: nouveauReste,
      statut: statutRetour,
    }).eq('id', facture.id);

    setShowRetourForm(false);
    setLoadingRetour(false);
    load();
    onRefresh();
  }

  if (!facture) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  const client = facture.clients as any;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">{facture.numero}</div>
          <div className="text-sm text-slate-500 mt-1">{formatDate(facture.date_facture)}</div>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${getStatutColor(facture.statut)}`}>
            {getStatutLabel(facture.statut)}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {facture.statut !== 'annulée' && (
            <button onClick={openRetour}
              className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl font-semibold hover:bg-amber-100 border border-amber-200">
              <RotateCcw className="w-3 h-3" /> Retour
            </button>
          )}
          <button onClick={() => setShowPrintShare(true)}
            className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-100 border border-blue-200">
            <Share2 className="w-3 h-3" /> Partager
          </button>
          {['brouillon', 'envoyée'].includes(facture.statut) ? (
            <button onClick={onEdit} className="flex items-center gap-1 text-xs bg-gray-100 text-slate-600 px-3 py-1.5 rounded-xl font-semibold hover:bg-gray-200">
              <Edit2 className="w-3 h-3" /> Modifier
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-gray-50 text-slate-400 px-3 py-1.5 rounded-xl font-semibold border border-gray-200 cursor-not-allowed" title="Facture validée — modification impossible">
              <Edit2 className="w-3 h-3" /> Modifier
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="text-xs text-slate-400 mb-1">Client</div>
          <div className="font-semibold text-slate-900">{client?.name}</div>
          {client?.phone && <div className="text-sm text-slate-500">{client.phone}</div>}
          {client?.address && <div className="text-xs text-slate-400">{client.address}</div>}
        </div>
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="text-xs text-slate-400 mb-1">Paiement</div>
          <div className="font-semibold text-slate-900 capitalize">{facture.type_paiement}</div>
          {facture.date_echeance && <div className="text-sm text-slate-500">Échéance: {formatDate(facture.date_echeance)}</div>}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-700 mb-2">Produits / Services</div>
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Désignation</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Qté</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Unité</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">P.U.</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => {
                const unite = l.type_vente === 'conditionnement'
                  ? (l.produits?.conditionnement_nom || 'cond.')
                  : (l.produits?.unite || '');
                return (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-4 py-2 text-slate-900">{l.designation}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{l.quantite}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{unite}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(l.prix_unitaire, company.currency_symbol)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-1">
        {company.tva_enabled && <div className="flex justify-between text-slate-600"><span>Sous-total HT</span><span>{formatCurrency(facture.sous_total, company.currency_symbol)}</span></div>}
        {company.tva_enabled && <div className="flex justify-between text-slate-600"><span>TVA</span><span>{formatCurrency(facture.tva_montant, company.currency_symbol)}</span></div>}
        <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-gray-200">
          <span>Total</span><span>{formatCurrency(facture.total, company.currency_symbol)}</span>
        </div>
        {facture.montant_paye > 0 && (
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>Payé</span><span>{formatCurrency(facture.montant_paye, company.currency_symbol)}</span>
          </div>
        )}
        {facture.reste_a_payer > 0 && (
          <div className="flex justify-between text-red-600 font-bold text-base">
            <span>Reste à payer</span><span>{formatCurrency(facture.reste_a_payer, company.currency_symbol)}</span>
          </div>
        )}
      </div>

      {paiements.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">Historique des paiements</div>
          <div className="space-y-2">
            {paiements.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-2.5">
                <div>
                  <div className="text-sm font-medium text-slate-900">{p.mode_paiement}</div>
                  <div className="text-xs text-slate-500">{formatDate(p.date_paiement)}</div>
                </div>
                <div className="font-bold text-emerald-600">{formatCurrency(p.montant, company.currency_symbol)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {facture.reste_a_payer > 0 && (
        <div>
          {!showPaiement ? (
            <button onClick={() => setShowPaiement(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-500 transition-colors">
              <CheckCircle className="w-5 h-5" /> Enregistrer un paiement
            </button>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="text-sm font-semibold text-emerald-800">Encaissement</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Montant</label>
                  <input type="number" value={montantPaie || ''} onChange={e => setMontantPaie(Number(e.target.value))}
                    max={facture.reste_a_payer} min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
                  <select value={modePaiement} onChange={e => setModePaiement(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {MODES_PAIEMENT.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input type="date" value={datePaie} onChange={e => setDatePaie(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPaiement(false)} className="flex-1 border border-gray-200 text-slate-700 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
                <button type="button" onClick={encaisser} disabled={loadingPaie}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60">
                  {loadingPaie ? 'En cours...' : 'Valider'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showPrintShare && (
        <PrintShareModal
          document={{
            type: 'facture',
            numero: facture.numero,
            date: facture.date_facture,
            dateEcheance: facture.date_echeance || undefined,
            clientName: client?.name || '',
            clientPhone: client?.phone,
            clientAddress: client?.address,
            clientTaxNumber: client?.tax_number,
            lignes,
            sousTotal: facture.sous_total,
            tvaMontant: facture.tva_montant,
            total: facture.total,
            montantPaye: facture.montant_paye,
            resteAPayer: facture.reste_a_payer,
            notes: facture.notes,
            statut: facture.statut,
          }}
          company={company}
          onClose={() => setShowPrintShare(false)}
        />
      )}

      {showRetourForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div className="text-sm font-bold text-amber-800">Traitement d'un retour</div>
          </div>

          <div className="flex gap-2">
            {(['partiel', 'total'] as const).map(t => (
              <button key={t} type="button" onClick={() => setRetourType(t)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors capitalize ${
                  retourType === t ? 'bg-amber-600 text-white' : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                }`}>
                Retour {t}
              </button>
            ))}
          </div>

          {retourType === 'partiel' && retourLignes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-amber-700">Sélectionner les articles retournés :</div>
              {retourLignes.map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-amber-100">
                  <input type="checkbox" checked={r.selected}
                    onChange={e => setRetourLignes(prev => prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                    className="w-4 h-4" />
                  <span className="flex-1 text-sm text-slate-700">{r.ligne.designation}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Qté:</span>
                    <input type="number" value={r.qte || ''}
                      onChange={e => setRetourLignes(prev => prev.map((x, j) => j === i ? { ...x, qte: Math.min(Number(e.target.value), r.ligne.quantite), selected: true } : x))}
                      min="0" max={r.ligne.quantite} step="0.001"
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                      disabled={!r.selected} />
                    <span className="text-xs text-slate-400">/ {r.ligne.quantite}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {retourType === 'total' && (
            <div className="bg-white rounded-xl p-3 border border-amber-100 text-sm text-slate-600">
              Toutes les lignes ({retourLignes.length}) seront retournées.
              {retourLignes.filter(r => r.ligne.produit_id).length > 0 && (
                <span className="block mt-1 text-xs text-amber-600">
                  {retourLignes.filter(r => r.ligne.produit_id).length} produit(s) retourné(s) en stock.
                </span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-amber-700 mb-1">Motif du retour</label>
            <input type="text" value={retourMotif} onChange={e => setRetourMotif(e.target.value)}
              placeholder="Ex: produit défectueux, erreur de commande..."
              className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setShowRetourForm(false)}
              className="flex-1 border border-gray-200 text-slate-700 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Annuler
            </button>
            <button type="button" onClick={processRetour} disabled={loadingRetour}
              className="flex-1 bg-amber-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-amber-500 disabled:opacity-60">
              {loadingRetour ? 'Traitement...' : 'Valider le retour & mettre à jour stock'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
