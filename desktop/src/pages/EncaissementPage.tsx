import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import type { Caisse } from '../hooks/useCaisse';
import type { Societe } from '../hooks/useSociete';

const api = () => window.electronAPI;

interface Props {
  caisseActive: Caisse | null;
  userId: string;
  onNavigate: (page: string) => void;
}

const MODES = [
  { value: 'especes', label: 'Especes' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'O. Money' },
  { value: 'carte', label: 'Carte' },
  { value: 'cheque', label: 'Cheque' },
];

function today() { return new Date().toISOString().slice(0, 10); }

export default function EncaissementPage({ caisseActive, userId, onNavigate }: Props) {
  const [step, setStep] = useState<'form' | 'paiement' | 'done'>('form');
  const [societe, setSociete] = useState<Societe | null>(null);

  const [date, setDate] = useState(today());
  const [numero, setNumero] = useState('');
  const [client, setClient] = useState('');
  const [montant, setMontant] = useState('');
  const [mode, setMode] = useState('especes');
  const [montantRecu, setMontantRecu] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedData, setSavedData] = useState<any>(null);

  const monnaie = Math.max(0, parseFloat(montantRecu || '0') - parseFloat(montant || '0'));
  const montantInsuffisant = parseFloat(montantRecu || '0') < parseFloat(montant || '0');

  useEffect(() => {
    api().societe.get().then(data => setSociete(data));
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) { setError('N facture obligatoire.'); return; }
    if (!client.trim()) { setError('Nom client obligatoire.'); return; }
    if (!montant || parseFloat(montant) <= 0) { setError('Montant invalide.'); return; }
    setError('');
    setStep('paiement');
  };

  const handleEncaisser = async () => {
    if (!caisseActive) { setError('Aucune caisse selectionnee.'); return; }
    if (montantInsuffisant) { setError('Montant recu insuffisant.'); return; }
    setSaving(true);
    setError('');

    try {
      const data = await api().encaissements.create({
        caisse_id: caisseActive.id,
        user_id: userId,
        client_nom: client,
        montant: parseFloat(montant),
        mode_paiement: mode,
        montant_recu: parseFloat(montantRecu),
        monnaie_rendue: monnaie,
      });
      setSavedData(data);
      setSaving(false);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Erreur');
      setSaving(false);
    }
  };

  const reset = () => {
    setStep('form'); setDate(today()); setNumero(''); setClient('');
    setMontant(''); setMontantRecu(''); setMode('especes');
    setError(''); setSavedData(null);
  };

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
        <button onClick={() => onNavigate('home')} className="p-1.5 text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft size={16} />
        </button>
        <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
          <CheckCircle size={14} className="text-emerald-600" />
        </div>
        <h1 className="text-sm font-black text-gray-900">Encaissement
          <span className="text-gray-400 font-normal text-xs ml-2">{caisseActive?.nom}</span>
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 mb-2">{error}</div>
        )}

        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">N Facture *</label>
                <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="FAC-000001" required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nom du client *</label>
              <input type="text" value={client} onChange={e => setClient(e.target.value)} placeholder="Nom du client" autoFocus
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Montant *</label>
              <div className="relative">
                <input type="number" min="1" step="1" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0"
                  className="w-full pl-3 pr-14 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
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
              <div className="text-xs text-gray-500">Montant a encaisser</div>
              <div className="text-2xl font-black text-emerald-700 mt-0.5">
                {new Intl.NumberFormat('fr-FR').format(parseFloat(montant))} FCFA
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{client} - {numero}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mode de paiement</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {MODES.map(m => (
                  <button key={m.value} type="button" onClick={() => setMode(m.value)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition ${
                      mode === m.value ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-300 bg-white'
                    }`}>{m.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Montant recu *</label>
              <div className="relative">
                <input type="number" min="0" step="1" value={montantRecu} onChange={e => setMontantRecu(e.target.value)} placeholder="0" autoFocus
                  className={`w-full pl-3 pr-14 py-2.5 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition ${
                    montantInsuffisant && montantRecu ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-emerald-400'
                  }`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">FCFA</span>
              </div>
            </div>
            <div className={`rounded-xl p-3 flex justify-between items-center gap-2 ${monnaie > 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <span className="text-xs font-semibold text-gray-600">Monnaie a rendre</span>
              <span className={`text-xl font-black ${monnaie > 0 ? 'text-blue-700' : 'text-gray-400'}`}>
                {new Intl.NumberFormat('fr-FR').format(monnaie)} FCFA
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('form')} className="px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition text-sm">Retour</button>
              <button onClick={handleEncaisser} disabled={saving || montantInsuffisant || !montantRecu}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-2.5 rounded-xl transition active:scale-[0.98] text-sm">
                {saving ? 'Enregistrement...' : 'ENCAISSER'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && savedData && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-black text-gray-900">Encaissement enregistre</h2>
            <p className="text-sm text-gray-500">{savedData.numero_facture} - {new Intl.NumberFormat('fr-FR').format(savedData.montant)} FCFA</p>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Imprimer</button>
              <button onClick={reset} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl transition text-sm">Nouveau</button>
            </div>
            <button onClick={() => onNavigate('home')} className="text-xs text-gray-400 hover:text-gray-600 transition">Retour a l'accueil</button>
          </div>
        )}
      </div>
    </div>
  );
}
