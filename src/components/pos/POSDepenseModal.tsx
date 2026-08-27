import { useState } from 'react';
import { X, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CATEGORIES_DEPENSES, MODES_PAIEMENT } from '../../lib/utils';

interface Props {
  companyId: string;
  sessionId: string | null;
  onClose: () => void;
  onSaved: (montant: number) => void;
}

export default function POSDepenseModal({ companyId, sessionId, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    categorie: 'Autre',
    description: '',
    montant: '',
    mode_paiement: 'Espèces',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || !form.montant) return;
    setLoading(true);
    setError('');
    const montant = parseFloat(form.montant);
    const { error } = await supabase.from('depenses').insert({
      company_id: companyId,
      categorie: form.categorie,
      description: form.description,
      montant,
      mode_paiement: form.mode_paiement,
      date_depense: new Date().toISOString().split('T')[0],
      reference: 'POS',
      notes: 'Dépense enregistrée depuis le point de vente',
    });
    if (error) { setError(error.message); setLoading(false); return; }
    onSaved(montant);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Nouvelle dépense</h2>
            <p className="text-xs text-slate-500">Enregistrer une dépense depuis le POS</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
            <select value={form.categorie} onChange={e => set('categorie', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {CATEGORIES_DEPENSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Achat fournitures bureau" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Montant *</label>
              <input type="number" value={form.montant} onChange={e => set('montant', e.target.value)} required min="0"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mode</label>
              <select value={form.mode_paiement} onChange={e => set('mode_paiement', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MODES_PAIEMENT.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-500 disabled:opacity-60">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
