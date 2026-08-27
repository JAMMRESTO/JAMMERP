import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Client } from '../../types';

interface Props {
  companyId: string;
  client?: Client | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function ClientForm({ companyId, client, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    address: client?.address || '',
    tax_number: client?.tax_number || '',
    credit_limit: client?.credit_limit || 0,
    notes: client?.notes || '',
  });
  const [encours, setEncours] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (client) {
      const { error } = await supabase.from('clients').update(form).eq('id', client.id);
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      const balanceInitiale = encours > 0 ? encours : 0;
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({ ...form, company_id: companyId, balance: balanceInitiale })
        .select()
        .maybeSingle();
      if (error) { setError(error.message); setLoading(false); return; }

      if (newClient && encours > 0) {
        await supabase.from('paiements').insert({
          company_id: companyId,
          facture_id: null,
          client_id: newClient.id,
          date_paiement: new Date().toISOString().split('T')[0],
          montant: -encours,
          mode_paiement: 'Encours initial',
          type_paiement: 'encours',
          notes: 'Encours initial à la création du client',
        });
      }
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
          <label className="block text-sm font-medium text-slate-700 mb-1">N° Fiscal / NINEA</label>
          <input type="text" value={form.tax_number} onChange={e => set('tax_number', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Limite de crédit</label>
          <input type="number" value={form.credit_limit || ''} onChange={e => set('credit_limit', Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {!client && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Encours initial
              <span className="ml-1.5 text-xs font-normal text-slate-400">(dette existante avant utilisation du logiciel)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={encours || ''}
              onChange={e => setEncours(Number(e.target.value))}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {encours > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Le client sera créé avec un encours de {new Intl.NumberFormat('fr-FR').format(encours)} — encaissable depuis la page Encaissement.
              </p>
            )}
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-60">
          {loading ? 'Enregistrement...' : client ? 'Modifier' : 'Créer'}
        </button>
      </div>
    </form>
  );
}
