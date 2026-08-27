import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingDown, CheckCircle } from 'lucide-react';
import type { Caisse } from '../hooks/useCaisse';

const api = () => window.electronAPI;

interface Props {
  caisseActive: Caisse | null;
  userId: string;
  onNavigate: (page: string) => void;
}

function today() { return new Date().toISOString().slice(0, 10); }

export default function DecaissementPage({ caisseActive, userId, onNavigate }: Props) {
  const [comptes, setComptes] = useState<any[]>([]);
  const [saved, setSaved] = useState<any>(null);

  const [date, setDate] = useState(today());
  const [numero, setNumero] = useState('');
  const [compteId, setCompteId] = useState('');
  const [compteNumero, setCompteNumero] = useState('');
  const [compteLibelle, setCompteLibelle] = useState('');
  const [description, setDescription] = useState('');
  const [montant, setMontant] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api().comptes.getAll().then(data => setComptes(data ?? []));
  }, []);

  const handleCompteChange = (id: string) => {
    const c = comptes.find((c: any) => c.id === id);
    setCompteId(id);
    setCompteNumero(c?.numero ?? '');
    setCompteLibelle(c?.libelle ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caisseActive) { setError('Aucune caisse selectionnee.'); return; }
    if (!numero.trim()) { setError('Numero de piece obligatoire.'); return; }
    if (!compteId) { setError('Selectionnez un compte de charge.'); return; }
    if (!montant || parseFloat(montant) <= 0) { setError('Montant invalide.'); return; }
    setSaving(true);
    setError('');

    try {
      const data = await api().decaissements.create({
        caisse_id: caisseActive.id,
        user_id: userId,
        compte_id: compteId,
        compte_numero: compteNumero,
        compte_libelle: compteLibelle,
        description,
        montant: parseFloat(montant),
      });
      setSaved(data);
      setSaving(false);
    } catch (err: any) {
      setError(err.message || 'Erreur');
      setSaving(false);
    }
  };

  const reset = () => {
    setDate(today()); setNumero(''); setCompteId(''); setCompteNumero('');
    setCompteLibelle(''); setDescription(''); setMontant(''); setError(''); setSaved(null);
  };

  if (saved) {
    return (
      <div className="h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-4 max-w-sm w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-red-600" />
          </div>
          <h2 className="text-lg font-black text-gray-900">Decaissement enregistre</h2>
          <p className="text-sm text-gray-500">{saved.numero_piece} - {new Intl.NumberFormat('fr-FR').format(saved.montant)} FCFA</p>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Imprimer</button>
            <button onClick={reset} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition text-sm">Nouveau</button>
          </div>
          <button onClick={() => onNavigate('home')} className="text-xs text-gray-400 hover:text-gray-600 transition">Retour a l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
        <button onClick={() => onNavigate('home')} className="p-1.5 text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft size={16} />
        </button>
        <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
          <TrendingDown size={14} className="text-red-600" />
        </div>
        <h1 className="text-sm font-black text-gray-900">Decaissement
          <span className="text-gray-400 font-normal text-xs ml-2">{caisseActive?.nom}</span>
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 mb-2">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">N Piece *</label>
              <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="DEC-000001" required
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Compte de charge *</label>
            <select value={compteId} onChange={e => handleCompteChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent">
              <option value="">-- Selectionner un compte --</option>
              {comptes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.numero} - {c.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Details (optionnel)"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Montant *</label>
            <div className="relative">
              <input type="number" min="1" step="1" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0"
                className="w-full pl-3 pr-14 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">FCFA</span>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm">
            {saving ? 'Enregistrement...' : 'ENREGISTRER'}
          </button>
        </form>
      </div>
    </div>
  );
}
