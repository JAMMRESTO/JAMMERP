import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Caisse, Societe, Decaissement, CompteCharge } from '../types/database';
import RecuDecaissement from '../components/RecuDecaissement';

interface Props {
  caisseActive: Caisse | null;
  userId: string;
  organisationId: string;
  onNavigate: (page: string) => void;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function DecaissementPage({ caisseActive, userId, organisationId, onNavigate }: Props) {
  const [societe, setSociete] = useState<Societe | null>(null);
  const [comptes, setComptes] = useState<CompteCharge[]>([]);
  const [saved, setSaved] = useState<Decaissement | null>(null);
  const [showRecu, setShowRecu] = useState(false);

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
    supabase.from('societe').select('*').maybeSingle().then(({ data }) => setSociete(data));
    supabase.from('comptes_charges').select('*').order('numero').then(({ data }) => setComptes(data ?? []));
  }, []);

  const handleCompteChange = (id: string) => {
    const c = comptes.find(c => c.id === id);
    setCompteId(id);
    setCompteNumero(c?.numero ?? '');
    setCompteLibelle(c?.libelle ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caisseActive) { setError('Aucune caisse sélectionnée.'); return; }
    if (!numero.trim()) { setError('Le numéro de pièce est obligatoire.'); return; }
    if (!compteId) { setError('Sélectionnez un compte de charge.'); return; }
    if (!montant || parseFloat(montant) <= 0) { setError('Montant invalide.'); return; }
    setSaving(true);
    setError('');

    const { data, error: dbError } = await supabase.from('decaissements').insert({
      numero_piece: numero,
      caisse_id: caisseActive.id,
      user_id: userId,
      organisation_id: organisationId,
      compte_id: compteId,
      compte_numero: compteNumero,
      compte_libelle: compteLibelle,
      description,
      montant: parseFloat(montant),
      date_transaction: date,
    }).select().maybeSingle();

    if (dbError) { setError(dbError.message); setSaving(false); return; }
    setSaved(data);
    setSaving(false);
    setShowRecu(true);
  };

  const reset = () => {
    setDate(today());
    setNumero('');
    setCompteId('');
    setCompteNumero('');
    setCompteLibelle('');
    setDescription('');
    setMontant('');
    setError('');
    setSaved(null);
    setShowRecu(false);
  };

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
        <button onClick={() => onNavigate('home')} className="p-1.5 text-gray-500 hover:text-gray-800 transition">
          <ArrowLeft size={16} />
        </button>
        <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
          <TrendingDown size={14} className="text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black text-gray-900 leading-tight">Décaissement
            <span className="text-gray-400 font-normal text-xs ml-2 hidden sm:inline">{caisseActive?.nom}</span>
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2 mb-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">N° Pièce *</label>
              <input type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="DEC-000001" required
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Compte de charge *</label>
            <select value={compteId} onChange={e => handleCompteChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition">
              <option value="">-- Sélectionner un compte --</option>
              {comptes.map(c => (
                <option key={c.id} value={c.id}>{c.numero} – {c.libelle}</option>
              ))}
            </select>
          </div>

          {compteId && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">N° Compte</label>
                <input value={compteNumero} readOnly className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Libellé</label>
                <input value={compteLibelle} readOnly className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 truncate" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Détails (optionnel)"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition resize-none" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Montant *</label>
            <div className="relative">
              <input type="number" min="1" step="1" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0"
                className="w-full pl-3 pr-14 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">FCFA</span>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm">
            {saving ? 'Enregistrement...' : 'ENREGISTRER'}
          </button>
        </form>
      </div>

      {showRecu && saved && (
        <RecuDecaissement decaissement={saved} caisse={caisseActive} societe={societe} onClose={() => onNavigate('home')} onNew={reset} />
      )}
    </div>
  );
}
