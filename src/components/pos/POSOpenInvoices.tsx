import { useState, useEffect } from 'react';
import { FileText, CheckCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Facture } from '../../types';
import { formatCurrency, formatDate, MODES_PAIEMENT } from '../../lib/utils';

interface Props {
  companyId: string;
  currencySymbol: string;
  sessionId: string | null;
  onClose: () => void;
  onPaid: () => void;
}

export default function POSOpenInvoices({ companyId, currencySymbol, sessionId, onClose, onPaid }: Props) {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [mode, setMode] = useState('Espèces');
  const [montant, setMontant] = useState<Record<string, string>>({});

  useEffect(() => { loadFactures(); }, [companyId]);

  async function loadFactures() {
    setLoading(true);
    const { data } = await supabase
      .from('factures')
      .select('*, clients(name)')
      .eq('company_id', companyId)
      .in('statut', ['envoyée', 'partiellement_payée'])
      .order('date_facture', { ascending: false });
    setFactures((data || []) as Facture[]);
    setLoading(false);
  }

  async function payFacture(facture: Facture) {
    const m = parseFloat(montant[facture.id] || String(facture.reste_a_payer));
    if (!m || m <= 0) return;
    setPaying(facture.id);

    const nouveauMontantPaye = facture.montant_paye + m;
    const nouveauReste = Math.max(0, facture.total - nouveauMontantPaye);
    const newStatut = nouveauReste <= 0 ? 'payée' : 'partiellement_payée';

    await supabase.from('paiements').insert({
      company_id: companyId,
      facture_id: facture.id,
      client_id: facture.client_id,
      date_paiement: new Date().toISOString().split('T')[0],
      montant: m,
      mode_paiement: mode,
      reference: 'POS',
      notes: 'Encaissement depuis le point de vente',
    });

    await supabase.from('factures').update({
      montant_paye: nouveauMontantPaye,
      reste_a_payer: nouveauReste,
      statut: newStatut,
      updated_at: new Date().toISOString(),
    }).eq('id', facture.id);

    if (facture.client_id) {
      await supabase.rpc('update_client_balance', { p_client_id: facture.client_id }).catch(() => {});
    }

    if (sessionId) {
      const { data: sess } = await supabase.from('pos_sessions').select('total_especes, total_wave, total_om, total_autres').eq('id', sessionId).maybeSingle();
      if (sess) {
        const isCash = mode === 'Espèces';
        const isWave = mode === 'Wave';
        const isOM = mode === 'Orange Money';
        const isOther = !isCash && !isWave && !isOM;
        await supabase.from('pos_sessions').update({
          total_especes: sess.total_especes + (isCash ? m : 0),
          total_wave: (sess.total_wave || 0) + (isWave ? m : 0),
          total_om: (sess.total_om || 0) + (isOM ? m : 0),
          total_autres: sess.total_autres + (isOther ? m : 0),
        }).eq('id', sessionId);
      }
    }

    setPaying(null);
    await loadFactures();
    onPaid();
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Factures impayées</h2>
            <p className="text-xs text-slate-500">Encaisser une facture depuis le module facturation</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 flex-shrink-0">Mode de paiement</label>
            <select value={mode} onChange={e => setMode(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MODES_PAIEMENT.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : factures.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <CheckCircle className="w-12 h-12 mb-3 opacity-40" />
              <p className="font-medium">Aucune facture impayée</p>
            </div>
          ) : (
            factures.map(f => (
              <div key={f.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{f.numero}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {(f.clients as any)?.name} · {formatDate(f.date_facture)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Reste à payer</div>
                    <div className="font-bold text-amber-600">{formatCurrency(f.reste_a_payer, currencySymbol)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={montant[f.id] ?? f.reste_a_payer}
                    onChange={e => setMontant(prev => ({ ...prev, [f.id]: e.target.value }))}
                    min="1"
                    max={f.reste_a_payer}
                    step="1"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Montant"
                  />
                  <button
                    onClick={() => payFacture(f)}
                    disabled={paying === f.id}
                    className="flex-shrink-0 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors"
                  >
                    {paying === f.id ? '...' : 'Encaisser'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
