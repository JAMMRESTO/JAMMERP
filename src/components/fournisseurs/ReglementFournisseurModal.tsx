import { useState, useEffect } from 'react';
import { CheckCircle, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FactureFournisseur } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

interface Props {
  facture: FactureFournisseur;
  currencySymbol: string;
  companyId: string;
  onSave: () => void;
  onCancel: () => void;
}

interface Paiement {
  id: string;
  date_paiement: string;
  montant: number;
  mode_paiement: string;
  reference: string;
  notes: string;
}

const MODES = [
  { value: 'espèces', label: 'Espèces', icon: Banknote },
  { value: 'virement', label: 'Virement', icon: CreditCard },
  { value: 'chèque', label: 'Chèque', icon: CreditCard },
  { value: 'wave', label: 'Wave', icon: Smartphone },
  { value: 'orange_money', label: 'Orange Money', icon: Smartphone },
  { value: 'autre', label: 'Autre', icon: CreditCard },
];

export default function ReglementFournisseurModal({ facture, currencySymbol, companyId, onSave, onCancel }: Props) {
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [montant, setMontant] = useState(facture.reste_a_payer);
  const [mode, setMode] = useState('espèces');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [loadingPaiements, setLoadingPaiements] = useState(true);

  useEffect(() => { loadPaiements(); }, [facture.id]);

  async function loadPaiements() {
    const { data } = await supabase
      .from('paiements_fournisseurs')
      .select('*')
      .eq('facture_fournisseur_id', facture.id)
      .order('date_paiement', { ascending: false });
    setPaiements((data as Paiement[]) || []);
    setLoadingPaiements(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (montant <= 0 || montant > facture.reste_a_payer) return;
    setLoading(true);

    await supabase.from('paiements_fournisseurs').insert({
      company_id: companyId,
      facture_fournisseur_id: facture.id,
      fournisseur_id: facture.fournisseur_id,
      date_paiement: datePaiement,
      montant,
      mode_paiement: mode,
      reference,
      notes,
    });

    const nouveauMontantPaye = facture.montant_paye + montant;
    const nouveauReste = facture.reste_a_payer - montant;
    const nouveauStatut = nouveauReste <= 0 ? 'payée' : 'partiellement_payée';

    await supabase.from('factures_fournisseurs').update({
      montant_paye: nouveauMontantPaye,
      reste_a_payer: Math.max(0, nouveauReste),
      statut: nouveauStatut,
      updated_at: new Date().toISOString(),
    }).eq('id', facture.id);

    setLoading(false);
    onSave();
  }

  const fournisseurName = (facture.fournisseurs as any)?.name || '—';

  if (facture.reste_a_payer <= 0) {
    return (
      <div className="p-6 text-center">
        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <div className="font-semibold text-emerald-700 text-base mb-1">Facture entièrement réglée</div>
        <div className="text-sm text-slate-500 mb-4">{facture.numero} · {fournisseurName}</div>
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 font-semibold text-sm hover:bg-emerald-50">
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-0 lg:grid lg:grid-cols-2 lg:divide-x lg:divide-gray-100">

      <div className="lg:p-5 space-y-3 mb-4 lg:mb-0">
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-slate-900">{facture.numero}</div>
              <div className="text-xs text-slate-500 mt-0.5">{fournisseurName} · {formatDate(facture.date_facture)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400">Total</div>
              <div className="font-bold text-slate-900">{formatCurrency(facture.total, currencySymbol)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white rounded-lg p-2 border border-slate-100 text-center">
              <div className="text-xs text-slate-400">Payé</div>
              <div className="font-semibold text-emerald-700 text-xs mt-0.5">{formatCurrency(facture.montant_paye, currencySymbol)}</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-red-100 text-center">
              <div className="text-xs text-slate-400">Reste</div>
              <div className="font-bold text-red-600 text-xs mt-0.5">{formatCurrency(facture.reste_a_payer, currencySymbol)}</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-slate-100 text-center">
              <div className="text-xs text-slate-400">Statut</div>
              <div className="font-semibold text-slate-600 text-xs mt-0.5 capitalize leading-tight">{facture.statut.replace('_', ' ')}</div>
            </div>
          </div>
        </div>

        {!loadingPaiements && paiements.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Historique</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {paiements.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-700">{formatDate(p.date_paiement)}</div>
                    <div className="text-xs text-slate-400 capitalize">{p.mode_paiement}{p.reference && ` · ${p.reference}`}</div>
                  </div>
                  <div className="font-bold text-emerald-700 text-sm">{formatCurrency(p.montant, currencySymbol)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingPaiements && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="lg:p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide hidden lg:block mb-1">Nouveau paiement</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Montant</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={facture.reste_a_payer}
                value={montant}
                onChange={e => setMontant(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <button
                type="button"
                onClick={() => setMontant(facture.reste_a_payer)}
                className="mt-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Tout régler
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={datePaiement}
                onChange={e => setDatePaiement(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mode de paiement</label>
            <div className="grid grid-cols-3 gap-1.5">
              {MODES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    mode === m.value
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <m.icon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Référence <span className="font-normal text-slate-400">(optionnel)</span></label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="N° chèque, transaction..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes <span className="font-normal text-slate-400">(optionnel)</span></label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-slate-600 font-semibold text-sm hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || montant <= 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-60"
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{loading ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
