import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, X, Pencil, Trash2, Calendar, DollarSign,
  TrendingDown, Filter, ChevronDown, Receipt
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/ui/Toast';
import type { Expense, ExpensePaymentMethod } from '../types/database';

const EXPENSE_CATEGORIES = [
  'Loyer', 'Salaires', 'Electricite', 'Eau', 'Internet',
  'Transport', 'Fournitures', 'Entretien', 'Marketing',
  'Alimentation', 'Equipement', 'Assurance', 'Impots', 'Autre'
];

const PAYMENT_METHODS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Especes' },
  { value: 'wave', label: 'Wave' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'card', label: 'Carte' },
  { value: 'bank_transfer', label: 'Virement' },
];

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  wave: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  orange_money: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  card: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  bank_transfer: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
};

interface ExpenseFormData {
  category: string;
  description: string;
  amount: string;
  payment_method: ExpensePaymentMethod;
  reference: string;
  recipient: string;
  notes: string;
  expense_date: string;
}

const emptyForm: ExpenseFormData = {
  category: '',
  description: '',
  amount: '',
  payment_method: 'cash',
  reference: '',
  recipient: '',
  notes: '',
  expense_date: new Date().toISOString().slice(0, 10),
};

export function ExpensesPage() {
  const { currentSite } = useTenant();
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const siteId = currentSite?.id ?? null;
  const sym = settings.currency_symbol;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [showFilters, setShowFilters] = useState(false);

  const loadExpenses = useCallback(async () => {
    if (!siteId) return;
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('site_id', siteId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filterPeriod !== 'all') {
      const now = new Date();
      let startDate: string;
      if (filterPeriod === 'today') {
        startDate = now.toISOString().slice(0, 10);
      } else if (filterPeriod === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().slice(0, 10);
      } else {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = d.toISOString().slice(0, 10);
      }
      query = query.gte('expense_date', startDate);
    }

    const { data } = await query;
    if (data) setExpenses(data as Expense[]);
    setLoading(false);
  }, [siteId, filterPeriod]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const filtered = expenses.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.description.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q) && !e.recipient.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCash = filtered.filter(e => e.payment_method === 'cash').reduce((s, e) => s + Number(e.amount), 0);
  const totalMobile = filtered.filter(e => e.payment_method === 'wave' || e.payment_method === 'orange_money').reduce((s, e) => s + Number(e.amount), 0);
  const totalOther = totalFiltered - totalCash - totalMobile;

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(expense: Expense) {
    setForm({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      payment_method: expense.payment_method,
      reference: expense.reference,
      recipient: expense.recipient,
      notes: expense.notes,
      expense_date: expense.expense_date,
    });
    setEditingId(expense.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId || !form.category || !form.amount) return;
    setSaving(true);

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast('error', 'Montant invalide');
      setSaving(false);
      return;
    }

    const payload = {
      site_id: siteId,
      category: form.category,
      description: form.description,
      amount,
      payment_method: form.payment_method,
      reference: form.reference,
      recipient: form.recipient,
      notes: form.notes,
      expense_date: form.expense_date,
      created_by: currentUser?.name || 'Utilisateur',
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('expenses').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('expenses').insert(payload));
    }

    setSaving(false);
    if (error) {
      toast('error', 'Erreur lors de l\'enregistrement');
      return;
    }
    toast('success', editingId ? 'Depense modifiee' : 'Depense ajoutee');
    setShowForm(false);
    loadExpenses();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast('error', 'Impossible de supprimer'); return; }
    toast('success', 'Depense supprimee');
    loadExpenses();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/30 text-sm">Chargement depenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-3 sm:p-4 lg:p-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="bg-white/3 border border-white/8 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-white/40 text-[10px] sm:text-xs">Total depenses</span>
          </div>
          <p className="text-white font-bold text-base sm:text-lg">{totalFiltered.toLocaleString('fr-FR')} <span className="text-white/40 text-xs">{sym}</span></p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-emerald-400" />
            <span className="text-white/40 text-[10px] sm:text-xs">Especes</span>
          </div>
          <p className="text-white font-bold text-base sm:text-lg">{totalCash.toLocaleString('fr-FR')} <span className="text-white/40 text-xs">{sym}</span></p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-blue-400" />
            <span className="text-white/40 text-[10px] sm:text-xs">Mobile Money</span>
          </div>
          <p className="text-white font-bold text-base sm:text-lg">{totalMobile.toLocaleString('fr-FR')} <span className="text-white/40 text-xs">{sym}</span></p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Receipt size={14} className="text-white/40" />
            <span className="text-white/40 text-[10px] sm:text-xs">Nombre</span>
          </div>
          <p className="text-white font-bold text-base sm:text-lg">{filtered.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 flex-wrap">
        <div className="flex-1 relative min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/40 transition-all"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"><X size={13} /></button>}
        </div>
        <button
          onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all ${showFilters ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
        >
          <Filter size={14} />
          <span className="hidden sm:inline">Filtres</span>
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-medium shadow-lg shadow-red-600/25 transition-all"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Nouvelle depense</span>
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex flex-wrap gap-2 p-3 bg-white/3 border border-white/8 rounded-2xl">
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white/70 text-xs focus:outline-none"
              >
                <option value="" className="bg-gray-900">Toutes categories</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
              </select>
              {(['today', 'week', 'month', 'all'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl border text-xs transition-all ${filterPeriod === p ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
                >
                  {p === 'today' ? "Aujourd'hui" : p === 'week' ? '7 jours' : p === 'month' ? 'Ce mois' : 'Tout'}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-white/2 rounded-2xl border border-white/8 min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3 sticky top-0 z-10">
          <div className="w-16 text-white/30 text-xs font-medium">Date</div>
          <div className="flex-1 text-white/30 text-xs font-medium">Description</div>
          <div className="hidden sm:block w-24 text-white/30 text-xs font-medium">Categorie</div>
          <div className="hidden md:block w-24 text-white/30 text-xs font-medium">Paiement</div>
          <div className="w-24 text-white/30 text-xs font-medium text-right">Montant</div>
          <div className="w-16 flex-shrink-0" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingDown size={32} className="text-white/15 mb-3" />
            <p className="text-white/30 font-medium">Aucune depense trouvee</p>
            <button onClick={openNew} className="mt-4 flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm transition-colors">
              <Plus size={14} />
              Ajouter une depense
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(expense => (
              <motion.div
                key={expense.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors border-b border-white/5 group last:border-0"
              >
                <div className="w-16 flex-shrink-0">
                  <span className="text-white/50 text-xs">
                    {new Date(expense.expense_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{expense.description || expense.category}</p>
                  {expense.recipient && (
                    <p className="text-white/30 text-xs truncate">{expense.recipient}</p>
                  )}
                </div>
                <div className="hidden sm:block w-24 flex-shrink-0">
                  <span className="text-xs text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg">
                    {expense.category}
                  </span>
                </div>
                <div className="hidden md:block w-24 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${PAYMENT_COLORS[expense.payment_method] || 'text-white/40 bg-white/5 border-white/10'}`}>
                    {PAYMENT_METHODS.find(m => m.value === expense.payment_method)?.label}
                  </span>
                </div>
                <div className="w-24 text-right flex-shrink-0">
                  <p className="text-red-400 font-semibold text-sm">-{Number(expense.amount).toLocaleString('fr-FR')} {sym}</p>
                </div>
                <div className="w-16 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => openEdit(expense)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Total bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 mt-2 bg-red-500/5 border border-red-500/15 rounded-2xl">
          <span className="text-white/50 text-sm">{filtered.length} depense(s)</span>
          <span className="text-red-400 font-bold text-lg">-{totalFiltered.toLocaleString('fr-FR')} {sym}</span>
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <h3 className="text-white font-semibold text-base">{editingId ? 'Modifier la depense' : 'Nouvelle depense'}</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm font-medium block mb-1.5">Categorie *</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="" className="bg-gray-900">Choisir...</option>
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/60 text-sm font-medium block mb-1.5">Date *</label>
                    <input
                      type="date"
                      value={form.expense_date}
                      onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Ex: Achat sacs poubelle"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm font-medium block mb-1.5">Montant ({sym}) *</label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      min="0"
                      step="1"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm font-medium block mb-1.5">Moyen de paiement</label>
                    <select
                      value={form.payment_method}
                      onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as ExpensePaymentMethod }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value} className="bg-gray-900">{m.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-sm font-medium block mb-1.5">Beneficiaire</label>
                    <input
                      type="text"
                      value={form.recipient}
                      onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}
                      placeholder="Nom du fournisseur..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm font-medium block mb-1.5">Reference</label>
                    <input
                      type="text"
                      value={form.reference}
                      onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                      placeholder="N facture, recu..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="Notes supplementaires..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 resize-none"
                  />
                </div>
              </form>

              <div className="flex items-center gap-3 px-5 py-4 border-t border-white/8 bg-white/2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit as unknown as () => void}
                  disabled={saving || !form.category || !form.amount}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium shadow-lg shadow-red-600/25 transition-all flex items-center justify-center gap-2"
                >
                  {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingId ? 'Mettre a jour' : 'Enregistrer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
