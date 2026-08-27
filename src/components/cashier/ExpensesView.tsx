import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Receipt, AlertCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Expense, ExpenseCategory } from '../../lib/types';

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001';

const CATEGORIES: { id: ExpenseCategory; label: string; color: string }[] = [
  { id: 'FOURNITURE', label: 'Fournitures', color: 'bg-blue-100 text-blue-700' },
  { id: 'TRANSPORT', label: 'Transport', color: 'bg-amber-100 text-amber-700' },
  { id: 'SALAIRE', label: 'Salaire', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'MAINTENANCE', label: 'Maintenance', color: 'bg-orange-100 text-orange-700' },
  { id: 'REPAS', label: 'Repas personnel', color: 'bg-rose-100 text-rose-700' },
  { id: 'AUTRE', label: 'Autre', color: 'bg-gray-100 text-gray-700' },
];

const formatFCFA = (v: number) => v.toLocaleString('fr-FR') + ' F';

function getCategoryStyle(cat: string) {
  return CATEGORIES.find(c => c.id === cat)?.color || 'bg-gray-100 text-gray-700';
}

function getCategoryLabel(cat: string) {
  return CATEGORIES.find(c => c.id === cat)?.label || cat;
}

interface AddExpenseFormProps {
  sessionId: string | null;
  onAdded: () => void;
}

function AddExpenseForm({ sessionId, onAdded }: AddExpenseFormProps) {
  const { user } = useAuth();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('AUTRE');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(amount);
    if (!label.trim()) { setError('Le libelle est obligatoire'); return; }
    if (isNaN(amt) || amt <= 0) { setError('Montant invalide'); return; }

    setSaving(true);
    const { error: err } = await supabase.from('expenses').insert({
      restaurant_id: RESTAURANT_ID,
      session_id: sessionId || null,
      created_by: user?.id || null,
      category,
      label: label.trim(),
      amount: amt,
      notes: notes.trim(),
      expense_date: new Date().toISOString(),
    });

    if (err) {
      setError('Erreur lors de l\'enregistrement');
    } else {
      setLabel('');
      setAmount('');
      setNotes('');
      setCategory('AUTRE');
      onAdded();
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <h3 className="font-bold text-gray-900 flex items-center gap-2">
        <Plus size={16} className="text-amber-500" />
        Nouvelle depense
      </h3>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Libelle *</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ex: Achat emballages, Transport..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Montant (FCFA) *</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            min="0"
            step="1"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Categorie</label>
          <div className="relative">
            <select
              value={category}
              onChange={e => setCategory(e.target.value as ExpenseCategory)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent appearance-none bg-white"
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Note (optionnel)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Details supplementaires..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Plus size={16} />
        )}
        Enregistrer la depense
      </button>
    </form>
  );
}

interface ExpensesViewProps {
  sessionId: string | null;
}

export default function ExpensesView({ sessionId }: ExpensesViewProps) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const fetchExpenses = useCallback(async () => {
    let query = supabase
      .from('expenses')
      .select('*, created_by_user:users!expenses_created_by_fkey(nom)')
      .eq('restaurant_id', RESTAURANT_ID)
      .order('created_at', { ascending: false });

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      query = query.gte('expense_date', startOfDay.toISOString());
    }

    const { data } = await query;
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchExpenses();
    const channel = supabase
      .channel('expenses_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchExpenses)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchExpenses]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('expenses').delete().eq('id', id);
    setDeletingId(null);
  };

  const filtered = filterCategory === 'ALL' ? expenses : expenses.filter(e => e.category === filterCategory);
  const totalToday = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Depenses du jour</h2>
        <p className="text-xs text-gray-500 mt-0.5">Saisir les depenses de caisse pour la journee</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total depenses</p>
          <p className="text-2xl font-black text-red-600">{formatFCFA(totalToday)}</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nb. depenses</p>
          <p className="text-2xl font-black text-gray-700">{expenses.length}</p>
        </div>
      </div>

      <AddExpenseForm sessionId={sessionId} onAdded={fetchExpenses} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 text-sm">Historique du jour</h3>
          <div className="flex gap-1.5 flex-wrap justify-end">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filterCategory === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              Tous
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setFilterCategory(c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filterCategory === c.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <Receipt size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-gray-500 text-sm font-medium">Aucune depense enregistree</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(expense => (
              <div key={expense.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{expense.label}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getCategoryStyle(expense.category)}`}>
                      {getCategoryLabel(expense.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-gray-400">
                      {new Date(expense.expense_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {(expense as any).created_by_user?.nom && (
                      <p className="text-xs text-gray-400">{(expense as any).created_by_user.nom}</p>
                    )}
                    {expense.notes && <p className="text-xs text-gray-400 italic truncate">{expense.notes}</p>}
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="font-black text-red-600 text-base">{formatFCFA(expense.amount)}</span>
                  {(expense.created_by === user?.id || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      {deletingId === expense.id
                        ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 size={14} />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filterCategory !== 'ALL' && filtered.length > 0 && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600">Sous-total</span>
                <span className="font-black text-gray-800">{formatFCFA(totalFiltered)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
