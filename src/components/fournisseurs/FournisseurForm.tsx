import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Fournisseur } from '../../types';

interface Props {
  companyId: string;
  fournisseur?: Fournisseur | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function FournisseurForm({ companyId, fournisseur, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    name: fournisseur?.name || '',
    email: fournisseur?.email || '',
    phone: fournisseur?.phone || '',
    address: fournisseur?.address || '',
    tax_number: fournisseur?.tax_number || '',
    notes: fournisseur?.notes || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (fournisseur) {
      const { error } = await supabase.from('fournisseurs').update(form).eq('id', fournisseur.id);
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      const { error } = await supabase.from('fournisseurs').insert({ ...form, company_id: companyId });
      if (error) { setError(error.message); setLoading(false); return; }
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
          <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">N° Fiscal</label>
          <input type="text" value={form.tax_number} onChange={e => set('tax_number', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
          {loading ? 'Enregistrement...' : fournisseur ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  );
}
