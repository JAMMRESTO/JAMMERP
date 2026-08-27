import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Caisse, Societe, Encaissement } from '../types/database';
import TicketEncaissement from '../components/TicketEncaissement';

interface Props {
  caisseActive: Caisse | null;
  userId: string;
  organisationId: string;
  onNavigate: (page: string) => void;
}

const MODES = [
  { value: 'especes', label: 'Espèces' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'O. Money' },
  { value: 'carte', label: 'Carte' },
  { value: 'cheque', label: 'Chèque' },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function EncaissementPage({ caisseActive, userId, organisationId, onNavigate }: Props) {
  const [step, setStep] = useState<'form' | 'paiement' | 'ticket'>('form');
  const [societe, setSociete] = useState<Societe | null>(null);
  const [saved, setSaved] = useState<Encaissement | null>(null);

  const [date, setDate] = useState(today());
  const [numero, setNumero] = useState('');
  const [client, setClient] = useState('');
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [montantRecu, setMontantRecu] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const monnaie = Math.max(0, parseFloat(montantRecu || '0') - parseFloat(montant || '0'));
  const montantInsuffisant = parseFloat(montantRecu || '0') < parseFloat(montant || '0');

  useEffect(() => {
    supabase.from('societe').select('*').maybeSingle().then(({ data }) => setSociete(data));
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) { setError('N° facture obligatoire.'); return; }
    if (!client.trim()) { setError('Nom client obligatoire.'); return; }
    if (!montant || parseFloat(montant) <= 0) { setError('Montant invalide.'); return; }
    setError('');
    setStep('paiement');
  };

  const handleEncaisser = async () => {
    if (!caisseActive) { setError('Aucune caisse sélectionnée.'); return; }
    if (montantInsuffisant) { setError('Montant reçu insuffisant.'); return; }
    setSaving(true);
    setError('');
    const now = new Date();
    const heure = now.toTimeString().slice(0, 8);

    const { data, error: dbError } = await supabase.from('encaissements').insert({
      numero_facture: numero,
      caisse_id: caisseActive.id,
      user_id: userId,
      organisation_id: organisationId,
      client_nom: client,
      montant: parseFloat(montant),
      mode_paiement: mode,
      montant_recu: parseFloat(montantRecu),
      monnaie_rendue: monnaie,
      date_transaction: date,
      heure_transaction: heure,
    }).select().maybeSingle();

    if (dbError) { setError(dbError.message); setSaving(false); return; }
    setSaved(data);
    setSaving(false);
    setStep('ticket');
  };

  const reset = () => {
    setStep('form');
    setDate(today());
    setNumero('');
    setClient('');
    setMontant('');
    setMontantRecu('');
    setMode('especes');
    setError('');
    setSaved(null);
  };

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
        <button onClick={() => onNavigate('home')} className="p-1.5 text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft size={16} />
        </button>
        <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
          <CheckCircle size={14} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-gray-900 leading-tight">Encaissement
            <span className="text-gray-400 font-normal text-xs ml-2 hidden sm:inline">{caisseActive?.nom}</span>
          </h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {['Facture', 'Paiement'].map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                step === 'form' && i === 0 ? 'bg-emerald-500 text-white' :
                step === 'paiement' && i === 1 ? 'bg-emerald-500 text-white' :
                step === 'paiement' && i === 0 ? 'bg-emerald-100 text-emerald-700' :
                'bg-gray-100 text-gray-400'
              }`}>{i + 1}. {label}</span>
              {i === 0 && <div className={`w-3 h-0.5 rounded ${step === 'paiement' ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 mb-2">
            {error}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">N° Facture *</label>
                <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="FAC-000001" required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nom du client *</label>
              <input type="text" value={client} onChange={e => setClient(e.target.value)} placeholder="Nom du client" autoFocus
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Montant *</label>
              <div className="relative">
                <input type="number" min="1" step="1" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0"
                  className="w-full pl-3 pr-14 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">FCFA</span>
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm">
              Continuer vers le paiement
            </button>
          </form>
        )}

        {step === 'paiement' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500">Montant à encaisser</div>
              <div className="text-2xl font-black text-emerald-700 mt-0.5 break-all">
                {new Intl.NumberFormat('fr-FR').format(parseFloat(montant))} FCFA
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5 truncate">{client} · {numero}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mode de paiement</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {MODES.map(m => (
                  <button key={m.value} type="button" onClick={() => setMode(m.value)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition ${
                      mode === m.value ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-300 bg-white'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Montant reçu *</label>
              <div className="relative">
                <input type="number" min="0" step="1" value={montantRecu} onChange={e => setMontantRecu(e.target.value)} placeholder="0" autoFocus
                  className={`w-full pl-3 pr-14 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition ${
                    montantInsuffisant && montantRecu ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-emerald-400'
                  }`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">FCFA</span>
              </div>
              {montantInsuffisant && montantRecu && <p className="text-red-500 text-[10px] mt-0.5">Montant reçu insuffisant</p>}
            </div>

            <div className={`rounded-xl p-3 flex justify-between items-center gap-2 ${monnaie >= 0 && montantRecu ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <span className="text-xs font-semibold text-gray-600 shrink-0">Monnaie à rendre</span>
              <span className={`text-xl font-black ${monnaie > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                {new Intl.NumberFormat('fr-FR').format(monnaie)} FCFA
              </span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('form')} className="px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition shrink-0 text-sm">
                Retour
              </button>
              <button onClick={handleEncaisser} disabled={saving || montantInsuffisant || !montantRecu}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-2.5 rounded-xl transition active:scale-[0.98] text-sm">
                {saving ? 'Enregistrement...' : 'ENCAISSER'}
              </button>
            </div>
          </div>
        )}
      </div>

      {step === 'ticket' && saved && (
        <TicketEncaissement encaissement={saved} caisse={caisseActive} societe={societe} onClose={() => onNavigate('home')} onNew={reset} />
      )}
    </div>
  );
}
