import { useState, useEffect, useCallback } from 'react';
import { Plus, CreditCard, CreditCard as Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Depense, Profile } from '../../types';
import { formatCurrency, formatDate, CATEGORIES_DEPENSES, MODES_PAIEMENT } from '../../lib/utils';
import { isAdmin } from '../../lib/permissions';
import { PeriodFilter, getDateRange } from '../../lib/dateFilter';
import PeriodFilterBar from '../ui/PeriodFilter';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props { companyId: string; currencySymbol: string; profile?: Profile | null; }

export default function DepensesPage({ companyId, currencySymbol, profile }: Props) {
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Depense | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>('jour');

  useEffect(() => { load(); }, [companyId, period]);
  useRealtimeRefresh(['depenses'], companyId, useCallback(() => { load(true); }, [companyId, period]));

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const { start, end } = getDateRange(period);
    const { data } = await supabase.from('depenses').select('*').eq('company_id', companyId)
      .gte('date_depense', start).lte('date_depense', end).order('date_depense', { ascending: false });
    setDepenses(data || []);
    if (!silent) setLoading(false);
  }

  async function deleteDepense(id: string) {
    if (!confirm('Supprimer cette dépense ?')) return;
    await supabase.from('depenses').delete().eq('id', id);
    load(true);
  }

  const total = depenses.reduce((a, d) => a + d.montant, 0);
  const byCategorie = depenses.reduce((acc, d) => {
    acc[d.categorie] = (acc[d.categorie] || 0) + d.montant;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dépenses</h2>
          <p className="text-sm text-slate-500">Total: <span className="font-semibold text-rose-600">{formatCurrency(total, currencySymbol)}</span></p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodFilterBar value={period} onChange={setPeriod} />
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm">
            <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouvelle dépense</span>
          </button>
        </div>
      </div>

      {Object.keys(byCategorie).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <div className="text-sm font-semibold text-slate-700 mb-3">Par catégorie</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byCategorie).sort((a, b) => b[1] - a[1]).map(([cat, montant]) => (
              <div key={cat} className="bg-rose-50 text-rose-700 text-xs px-3 py-1.5 rounded-full font-medium">
                {cat}: {formatCurrency(montant, currencySymbol)}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : depenses.length === 0 ? (
        <EmptyState icon={CreditCard} title="Aucune dépense" description="Aucune dépense enregistrée pour cette période" action={
          <button onClick={() => setShowForm(true)} className="bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Ajouter une dépense</button>
        } />
      ) : (
        <div className="grid gap-3">
          {depenses.map(d => (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{d.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{d.categorie}</span>
                      <span className="text-xs text-slate-400">{formatDate(d.date_depense)}</span>
                      <span className="text-xs text-slate-400">{d.mode_paiement}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-bold text-rose-600">{formatCurrency(d.montant, currencySymbol)}</div>
                  </div>
                  <button onClick={() => { setEditing(d); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {isAdmin(profile ?? null) && (
                    <button onClick={() => deleteDepense(d.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'} onClose={() => setShowForm(false)}>
          <DepenseForm companyId={companyId} depense={editing}
            onSave={() => { setShowForm(false); load(true); }} onCancel={() => setShowForm(false)} />
        </Modal>
      )}
    </div>
  );
}

function DepenseForm({ companyId, depense, onSave, onCancel }: { companyId: string; depense?: Depense | null; onSave: () => void; onCancel: () => void; }) {
  const [form, setForm] = useState({
    categorie: depense?.categorie || 'Autre',
    description: depense?.description || '',
    montant: depense?.montant || 0,
    date_depense: depense?.date_depense || new Date().toISOString().split('T')[0],
    mode_paiement: depense?.mode_paiement || 'Espèces',
    reference: depense?.reference || '',
    notes: depense?.notes || '',
  });
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string | number) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (depense) {
      await supabase.from('depenses').update(form).eq('id', depense.id);
    } else {
      await supabase.from('depenses').insert({ ...form, company_id: companyId });
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
          <select value={form.categorie} onChange={e => set('categorie', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CATEGORIES_DEPENSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input type="date" value={form.date_depense} onChange={e => set('date_depense', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
          <input type="text" value={form.description} onChange={e => set('description', e.target.value)} required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Montant *</label>
          <input type="number" value={form.montant || ''} onChange={e => set('montant', Number(e.target.value))} min="0" required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mode de paiement</label>
          <select value={form.mode_paiement} onChange={e => set('mode_paiement', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MODES_PAIEMENT.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={loading} className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-500 disabled:opacity-60">
          {loading ? 'Enregistrement...' : depense ? 'Modifier' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
