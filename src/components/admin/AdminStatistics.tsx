import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, Users, Calendar, RefreshCw,
  BarChart3, CreditCard, Banknote, Smartphone,
  Clock, AlertTriangle, ChevronDown, ChevronUp,
  DollarSign, ShoppingBag, Layers, Receipt, Wallet, TrendingDown, Package,
} from 'lucide-react';
import { Expense } from '../../lib/types';
import { supabase } from '../../lib/supabase';
import { getBusinessDayRange } from '../../lib/businessDay';

interface CashierRevenue {
  id: string;
  nom: string;
  totalOrders: number;
  totalRevenue: number;
  paidOrders: number;
  unpaidOrders: number;
  unpaidAmount: number;
}

interface CategoryStat {
  categoryName: string;
  totalQty: number;
  totalRevenue: number;
  orderCount: number;
}

interface ProductStat {
  productId: string;
  nom: string;
  categoryName: string;
  totalQty: number;
  totalRevenue: number;
  orderCount: number;
}

interface ClosureInfo {
  sessionId: string;
  caissierNom: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  closureType: string | null;
  totalEncaisse: number;
  unpaidCount: number;
  unpaidAmount: number;
  openingFloat: number;
  totalExpenses: number;
  totalNetCaisse: number;
}

interface PaymentMethodStat {
  method: string;
  label: string;
  count: number;
  total: number;
}

interface ExpenseStat {
  category: string;
  label: string;
  total: number;
  count: number;
}

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  FOURNITURE: 'Fournitures',
  TRANSPORT: 'Transport',
  SALAIRE: 'Salaire',
  MAINTENANCE: 'Maintenance',
  REPAS: 'Repas personnel',
  AUTRE: 'Autre',
};

type StatTab = 'revenue' | 'categories' | 'products' | 'closures' | 'payments' | 'expenses';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Especes',
  CARD: 'Carte bancaire',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  OTHER: 'Autre',
};

const formatFCFA = (v: number) => v.toLocaleString('fr-FR') + ' F';

function getDateRange(period: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();

  if (period === 'custom' && customStart && customEnd) {
    const start = new Date(customStart + 'T00:00:00');
    const end = new Date(customEnd + 'T23:59:59.999');
    return { start, end };
  }

  if (period === 'today') {
    return getBusinessDayRange(now);
  }

  if (period === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return getBusinessDayRange(yesterday);
  }

  const todayRange = getBusinessDayRange(now);

  if (period === 'week') {
    const start = new Date(todayRange.start);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    return { start, end: todayRange.end };
  }

  if (period === 'month') {
    const start = new Date(todayRange.start);
    start.setDate(1);
    return { start, end: todayRange.end };
  }

  return todayRange;
}

export default function AdminStatistics() {
  const [tab, setTab] = useState<StatTab>('revenue');
  const [period, setPeriod] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);

  const [cashierRevenues, setCashierRevenues] = useState<CashierRevenue[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [closures, setClosures] = useState<ClosureInfo[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentMethodStat[]>([]);
  const [expenseStats, setExpenseStats] = useState<ExpenseStat[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [expandedClosure, setExpandedClosure] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (period === 'custom' && (!customStart || !customEnd)) {
      return;
    }
    setLoading(true);
    const { start, end } = getDateRange(period, customStart, customEnd);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    await Promise.all([
      fetchCashierRevenue(startISO, endISO),
      fetchCategoryStats(startISO, endISO),
      fetchProductStats(startISO, endISO),
      fetchClosures(startISO, endISO),
      fetchPaymentStats(startISO, endISO),
      fetchExpenses(startISO, endISO),
    ]);

    setLoading(false);
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel('admin_stats_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_closures' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const fetchCashierRevenue = async (startISO: string, endISO: string) => {
    const { data: users } = await supabase
      .from('users')
      .select('id, nom')
      .eq('actif', true);

    const { data: payments } = await supabase
      .from('payments')
      .select('caissier_id, montant, method, order_id')
      .eq('pay_status', 'valid')
      .gte('paid_at', startISO)
      .lte('paid_at', endISO);

    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, statut, caissier_id, serveur_id')
      .gte('updated_at', startISO)
      .lte('updated_at', endISO);

    const userMap = new Map((users || []).map(u => [u.id, u.nom]));
    const paymentsByCashier = new Map<string, { total: number; count: number }>();

    for (const p of payments || []) {
      if (!p.caissier_id) continue;
      const existing = paymentsByCashier.get(p.caissier_id) || { total: 0, count: 0 };
      existing.total += p.montant;
      existing.count += 1;
      paymentsByCashier.set(p.caissier_id, existing);
    }

    const ordersByUser = new Map<string, { total: number; paid: number; unpaidCount: number; unpaidAmount: number }>();
    for (const o of orders || []) {
      const userId = o.caissier_id || o.serveur_id;
      if (!userId) continue;
      const existing = ordersByUser.get(userId) || { total: 0, paid: 0, unpaidCount: 0, unpaidAmount: 0 };
      existing.total += 1;
      if (o.statut === 'PAYEE' || o.statut === 'CLOTUREE') {
        existing.paid += 1;
      } else if (o.statut !== 'ANNULEE') {
        existing.unpaidCount += 1;
        existing.unpaidAmount += o.total || 0;
      }
      ordersByUser.set(userId, existing);
    }

    const allUserIds = new Set([...paymentsByCashier.keys(), ...ordersByUser.keys()]);
    const results: CashierRevenue[] = [];
    let grandTotal = 0;
    let grandOrders = 0;
    let grandPaid = 0;

    for (const uid of allUserIds) {
      const payData = paymentsByCashier.get(uid) || { total: 0, count: 0 };
      const orderData = ordersByUser.get(uid) || { total: 0, paid: 0, unpaidCount: 0, unpaidAmount: 0 };
      results.push({
        id: uid,
        nom: userMap.get(uid) || 'Inconnu',
        totalOrders: orderData.total,
        totalRevenue: payData.total,
        paidOrders: orderData.paid,
        unpaidOrders: orderData.unpaidCount,
        unpaidAmount: orderData.unpaidAmount,
      });
      grandTotal += payData.total;
      grandOrders += orderData.total;
      grandPaid += orderData.paid;
    }

    results.sort((a, b) => b.totalRevenue - a.totalRevenue);
    setCashierRevenues(results);
    setTotalRevenue(grandTotal);
    setTotalOrders(grandOrders);
    setTotalPaid(grandPaid);
  };

  const fetchCategoryStats = async (startISO: string, endISO: string) => {
    const { data: items } = await supabase
      .from('order_items')
      .select('qty, prix_snapshot, product:products(category:categories!category_id(nom)), order:orders!inner(updated_at, statut)')
      .gte('order.updated_at', startISO)
      .lte('order.updated_at', endISO)
      .in('order.statut', ['PAYEE', 'CLOTUREE']);

    const catMap = new Map<string, CategoryStat>();

    for (const item of items || []) {
      const catName = (item as any).product?.category?.nom || 'Sans categorie';
      const existing = catMap.get(catName) || { categoryName: catName, totalQty: 0, totalRevenue: 0, orderCount: 0 };
      existing.totalQty += item.qty;
      existing.totalRevenue += item.qty * item.prix_snapshot;
      existing.orderCount += 1;
      catMap.set(catName, existing);
    }

    const results = Array.from(catMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    setCategoryStats(results);
  };

  const fetchProductStats = async (startISO: string, endISO: string) => {
    const { data: items } = await supabase
      .from('order_items')
      .select('qty, prix_snapshot, product:products(id, nom, category:categories!category_id(nom)), order:orders!inner(updated_at, statut)')
      .gte('order.updated_at', startISO)
      .lte('order.updated_at', endISO)
      .in('order.statut', ['PAYEE', 'CLOTUREE']);

    const prodMap = new Map<string, ProductStat>();

    for (const item of items || []) {
      const prod = (item as any).product;
      const productId = prod?.id || 'unknown';
      const nom = prod?.nom || item.nom_snapshot || 'Produit inconnu';
      const categoryName = prod?.category?.nom || 'Sans categorie';
      const existing = prodMap.get(productId) || {
        productId, nom, categoryName,
        totalQty: 0, totalRevenue: 0, orderCount: 0,
      };
      existing.totalQty += item.qty;
      existing.totalRevenue += item.qty * item.prix_snapshot;
      existing.orderCount += 1;
      prodMap.set(productId, existing);
    }

    const results = Array.from(prodMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    setProductStats(results);
  };

  const fetchClosures = async (startISO: string, endISO: string) => {
    const [
      { data: sessions },
      { data: closureRecords },
      { data: payments },
      { data: allExpenses },
    ] = await Promise.all([
      supabase
        .from('cash_sessions')
        .select('id, status, opening_float, opened_at, closed_at, caissier:users!cash_sessions_caissier_id_fkey(nom)')
        .gte('opened_at', startISO)
        .lte('opened_at', endISO)
        .order('opened_at', { ascending: false }),
      supabase
        .from('cash_closures')
        .select('session_id, type, excluded_unpaid_count, excluded_unpaid_amount, totals_json')
        .gte('created_at', startISO)
        .lte('created_at', endISO),
      supabase
        .from('payments')
        .select('session_id, montant')
        .eq('pay_status', 'valid')
        .gte('paid_at', startISO)
        .lte('paid_at', endISO),
      supabase
        .from('expenses')
        .select('amount, expense_date')
        .gte('expense_date', startISO)
        .lte('expense_date', endISO),
    ]);

    const closureMap = new Map<string, any>();
    for (const c of closureRecords || []) {
      closureMap.set(c.session_id, c);
    }

    const paymentsBySession = new Map<string, number>();
    for (const p of payments || []) {
      if (!p.session_id) continue;
      paymentsBySession.set(p.session_id, (paymentsBySession.get(p.session_id) || 0) + p.montant);
    }

    const sortedSessions = [...(sessions || [])].sort(
      (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
    );

    const results: ClosureInfo[] = sortedSessions.map((s, idx) => {
      const closure = closureMap.get(s.id);
      const sessionStart = new Date(s.opened_at).getTime();
      let sessionEnd: number;
      if (s.closed_at) {
        sessionEnd = new Date(s.closed_at).getTime();
      } else {
        const nextSession = sortedSessions[idx + 1];
        sessionEnd = nextSession ? new Date(nextSession.opened_at).getTime() - 1 : Date.now();
      }
      const sessionExpenses = (allExpenses || []).filter(e => {
        const t = new Date(e.expense_date).getTime();
        return t >= sessionStart && t <= sessionEnd;
      });
      const totalExp = sessionExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalEnc = paymentsBySession.get(s.id) || 0;
      const openingFloat = Number(s.opening_float) || 0;
      return {
        sessionId: s.id,
        caissierNom: (s as any).caissier?.nom || 'Inconnu',
        openedAt: s.opened_at,
        closedAt: s.closed_at,
        status: s.status,
        closureType: closure?.type || null,
        totalEncaisse: totalEnc,
        unpaidCount: closure?.excluded_unpaid_count || 0,
        unpaidAmount: Number(closure?.excluded_unpaid_amount || 0),
        openingFloat,
        totalExpenses: totalExp,
        totalNetCaisse: openingFloat + totalEnc - totalExp,
      };
    });

    results.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

    setClosures(results);
  };

  const fetchPaymentStats = async (startISO: string, endISO: string) => {
    const { data: payments } = await supabase
      .from('payments')
      .select('method, montant')
      .eq('pay_status', 'valid')
      .gte('paid_at', startISO)
      .lte('paid_at', endISO);

    const methodMap = new Map<string, { count: number; total: number }>();

    for (const p of payments || []) {
      const m = p.method || 'CASH';
      const existing = methodMap.get(m) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += p.montant;
      methodMap.set(m, existing);
    }

    const results: PaymentMethodStat[] = Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        label: METHOD_LABELS[method] || method,
        count: data.count,
        total: data.total,
      }))
      .sort((a, b) => b.total - a.total);

    setPaymentStats(results);
  };

  const fetchExpenses = async (startISO: string, endISO: string) => {
    const { data } = await supabase
      .from('expenses')
      .select('*, created_by_user:users!expenses_created_by_fkey(nom)')
      .gte('expense_date', startISO)
      .lte('expense_date', endISO)
      .order('expense_date', { ascending: false });

    const rows = (data as Expense[]) || [];
    setExpenses(rows);

    const catMap = new Map<string, { total: number; count: number }>();
    for (const e of rows) {
      const cat = e.category || 'AUTRE';
      const existing = catMap.get(cat) || { total: 0, count: 0 };
      existing.total += e.amount;
      existing.count += 1;
      catMap.set(cat, existing);
    }

    const stats: ExpenseStat[] = Array.from(catMap.entries())
      .map(([cat, d]) => ({
        category: cat,
        label: EXPENSE_CATEGORY_LABELS[cat] || cat,
        total: d.total,
        count: d.count,
      }))
      .sort((a, b) => b.total - a.total);

    setExpenseStats(stats);
    setTotalExpenses(rows.reduce((sum, e) => sum + e.amount, 0));
  };

  const periodOptions = [
    { id: 'today', label: "Aujourd'hui" },
    { id: 'yesterday', label: 'Hier' },
    { id: 'week', label: 'Cette semaine' },
    { id: 'month', label: 'Ce mois' },
    { id: 'custom', label: 'Personnalisé' },
  ];

  const tabItems: { id: StatTab; label: string; icon: typeof TrendingUp }[] = [
    { id: 'revenue', label: 'CA par caissier', icon: DollarSign },
    { id: 'categories', label: 'Ventes / categorie', icon: Layers },
    { id: 'products', label: 'Ventes / produit', icon: Package },
    { id: 'closures', label: 'Clotures', icon: Receipt },
    { id: 'payments', label: 'Par reglement', icon: CreditCard },
    { id: 'expenses', label: 'Depenses', icon: Wallet },
  ];

  const grandTotalCategories = categoryStats.reduce((s, c) => s + c.totalRevenue, 0);
  const grandTotalProducts = productStats.reduce((s, p) => s + p.totalRevenue, 0);
  const grandTotalPayments = paymentStats.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Statistiques</h2>
          <p className="text-sm text-gray-500 mt-0.5">Vue complete de l'activite du restaurant</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {periodOptions.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-600">Du</label>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-600">Au</label>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
          </div>
          {customStart && customEnd && (
            <span className="text-sm text-gray-500">
              {formatFCFA(totalRevenue)} sur cette période
            </span>
          )}
          {(!customStart || !customEnd) && (
            <span className="text-sm text-amber-600 font-medium">Sélectionnez les deux dates</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label="Chiffre d'affaires"
          value={formatFCFA(totalRevenue)}
          color="emerald"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Total depenses"
          value={formatFCFA(totalExpenses)}
          color="red"
        />
        <SummaryCard
          icon={DollarSign}
          label="Benefice net"
          value={formatFCFA(Math.max(0, totalRevenue - totalExpenses))}
          color="teal"
        />
        <SummaryCard
          icon={ShoppingBag}
          label="Commandes"
          value={String(totalOrders)}
          color="blue"
        />
        <SummaryCard
          icon={BarChart3}
          label="Ticket moyen"
          value={totalPaid > 0 ? formatFCFA(Math.round(totalRevenue / totalPaid)) : '0 F'}
          color="amber"
        />
        <SummaryCard
          icon={Clock}
          label="Non encaissees"
          value={String(totalOrders - totalPaid)}
          color="red"
        />
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabItems.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'revenue' && (
            <RevenueByCarshierSection cashiers={cashierRevenues} totalRevenue={totalRevenue} />
          )}
          {tab === 'categories' && (
            <SalesByCategorySection stats={categoryStats} grandTotal={grandTotalCategories} />
          )}
          {tab === 'products' && (
            <SalesByProductSection stats={productStats} grandTotal={grandTotalProducts} />
          )}
          {tab === 'closures' && (
            <ClosuresSection
              closures={closures}
              expanded={expandedClosure}
              onToggle={id => setExpandedClosure(expandedClosure === id ? null : id)}
            />
          )}
          {tab === 'payments' && (
            <PaymentMethodsSection stats={paymentStats} grandTotal={grandTotalPayments} />
          )}
          {tab === 'expenses' && (
            <ExpensesSection
              expenses={expenses}
              stats={expenseStats}
              totalRevenue={totalRevenue}
              totalExpenses={totalExpenses}
            />
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100' },
    red: { bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', iconBg: 'bg-teal-100' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-2xl p-4 border-2 border-transparent ${c.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.iconBg}`}>
          <Icon size={16} className={c.text} />
        </div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-xl font-black ${c.text}`}>{value}</p>
    </div>
  );
}

function RevenueByCarshierSection({ cashiers, totalRevenue }: {
  cashiers: CashierRevenue[];
  totalRevenue: number;
}) {
  if (cashiers.length === 0) {
    return <EmptyState message="Aucune donnee pour cette periode" />;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <h3 className="font-semibold text-gray-900">Chiffre d'affaires par caissier</h3>
        </div>
        <span className="text-sm font-bold text-emerald-600">{formatFCFA(totalRevenue)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold">Caissier</th>
              <th className="text-right px-5 py-3 font-semibold">Commandes</th>
              <th className="text-right px-5 py-3 font-semibold">Payees</th>
              <th className="text-right px-5 py-3 font-semibold">Non payees</th>
              <th className="text-right px-5 py-3 font-semibold">Montant non paye</th>
              <th className="text-right px-5 py-3 font-semibold">CA encaisse</th>
              <th className="text-right px-5 py-3 font-semibold">Part</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cashiers.map(c => {
              const pct = totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0;
              return (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-amber-700 text-xs font-bold">{c.nom.charAt(0)}</span>
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">{c.nom}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-gray-700">{c.totalOrders}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-semibold text-emerald-600">{c.paidOrders}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.unpaidOrders > 0 ? (
                      <span className="text-sm font-semibold text-red-500">{c.unpaidOrders}</span>
                    ) : (
                      <span className="text-sm text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {c.unpaidAmount > 0 ? (
                      <span className="text-sm font-semibold text-red-500">{formatFCFA(c.unpaidAmount)}</span>
                    ) : (
                      <span className="text-sm text-gray-400">0 F</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-bold text-gray-900">{formatFCFA(c.totalRevenue)}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesByCategorySection({ stats, grandTotal }: {
  stats: CategoryStat[];
  grandTotal: number;
}) {
  if (stats.length === 0) {
    return <EmptyState message="Aucune vente pour cette periode" />;
  }

  const colors = [
    'bg-emerald-400', 'bg-blue-400', 'bg-amber-400', 'bg-rose-400',
    'bg-teal-400', 'bg-orange-400', 'bg-cyan-400', 'bg-pink-400',
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={16} className="text-gray-400" />
          <h3 className="font-semibold text-gray-900">Repartition par categorie</h3>
        </div>
        <div className="flex items-center gap-1 h-8 rounded-xl overflow-hidden mb-4">
          {stats.map((s, i) => {
            const pct = grandTotal > 0 ? (s.totalRevenue / grandTotal) * 100 : 0;
            if (pct < 1) return null;
            return (
              <div
                key={s.categoryName}
                className={`h-full ${colors[i % colors.length]} transition-all relative group`}
                style={{ width: `${pct}%` }}
                title={`${s.categoryName}: ${formatFCFA(s.totalRevenue)} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          {stats.map((s, i) => (
            <div key={s.categoryName} className="flex items-center gap-1.5 text-xs">
              <div className={`w-3 h-3 rounded-sm ${colors[i % colors.length]}`} />
              <span className="text-gray-600 font-medium">{s.categoryName}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold">Categorie</th>
              <th className="text-right px-5 py-3 font-semibold">Qte vendue</th>
              <th className="text-right px-5 py-3 font-semibold">Montant</th>
              <th className="text-right px-5 py-3 font-semibold">Part</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stats.map((s, i) => {
              const pct = grandTotal > 0 ? (s.totalRevenue / grandTotal) * 100 : 0;
              return (
                <tr key={s.categoryName} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-8 rounded-sm ${colors[i % colors.length]}`} />
                      <span className="font-semibold text-gray-900 text-sm">{s.categoryName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-gray-700">{s.totalQty}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{formatFCFA(s.totalRevenue)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                      {pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-gray-50 font-bold">
              <td className="px-5 py-3 text-sm text-gray-700">TOTAL</td>
              <td className="px-5 py-3 text-right text-sm text-gray-700">
                {stats.reduce((s, c) => s + c.totalQty, 0)}
              </td>
              <td className="px-5 py-3 text-right text-sm text-gray-900">{formatFCFA(grandTotal)}</td>
              <td className="px-5 py-3 text-right text-xs text-gray-500">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesByProductSection({ stats, grandTotal }: {
  stats: ProductStat[];
  grandTotal: number;
}) {
  if (stats.length === 0) {
    return <EmptyState message="Aucune vente pour cette periode" />;
  }

  const topProduct = stats[0];
  const topPct = grandTotal > 0 ? (topProduct.totalRevenue / grandTotal) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-blue-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Produits vendus</p>
          </div>
          <p className="text-xl font-black text-blue-700">{stats.length}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={14} className="text-emerald-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quantite totale</p>
          </div>
          <p className="text-xl font-black text-emerald-700">
            {stats.reduce((s, p) => s + p.totalQty, 0)}
          </p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-amber-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Top produit</p>
          </div>
          <p className="text-sm font-black text-amber-700 truncate" title={topProduct.nom}>{topProduct.nom}</p>
          <p className="text-xs text-gray-500 mt-0.5">{topPct.toFixed(1)}% du CA</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-gray-400" />
            <h3 className="font-semibold text-gray-900">Detail des ventes par produit</h3>
          </div>
          <span className="text-sm font-bold text-emerald-600">{formatFCFA(grandTotal)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Produit</th>
                <th className="text-left px-5 py-3 font-semibold">Categorie</th>
                <th className="text-right px-5 py-3 font-semibold">Qte vendue</th>
                <th className="text-right px-5 py-3 font-semibold">Commandes</th>
                <th className="text-right px-5 py-3 font-semibold">Prix moyen</th>
                <th className="text-right px-5 py-3 font-semibold">Montant</th>
                <th className="text-right px-5 py-3 font-semibold">Part</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map(p => {
                const pct = grandTotal > 0 ? (p.totalRevenue / grandTotal) * 100 : 0;
                const avgPrice = p.totalQty > 0 ? p.totalRevenue / p.totalQty : 0;
                return (
                  <tr key={p.productId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-semibold text-gray-900 text-sm">{p.nom}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                        {p.categoryName}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{p.totalQty}</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-gray-700">{p.orderCount}</td>
                    <td className="px-5 py-3 text-right text-sm text-gray-500">{formatFCFA(Math.round(avgPrice))}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{formatFCFA(p.totalRevenue)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-bold">
                <td className="px-5 py-3 text-sm text-gray-700" colSpan={2}>TOTAL</td>
                <td className="px-5 py-3 text-right text-sm text-gray-700">
                  {stats.reduce((s, p) => s + p.totalQty, 0)}
                </td>
                <td className="px-5 py-3 text-right text-sm text-gray-700">
                  {stats.reduce((s, p) => s + p.orderCount, 0)}
                </td>
                <td className="px-5 py-3"></td>
                <td className="px-5 py-3 text-right text-sm text-gray-900">{formatFCFA(grandTotal)}</td>
                <td className="px-5 py-3 text-right text-xs text-gray-500">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClosuresSection({ closures, expanded, onToggle }: {
  closures: ClosureInfo[];
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  if (closures.length === 0) {
    return <EmptyState message="Aucune session de caisse pour cette periode" />;
  }

  return (
    <div className="space-y-3">
      {closures.map(c => {
        const isExpanded = expanded === c.sessionId;
        const isClosed = c.status === 'closed';
        return (
          <div
            key={c.sessionId}
            className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${
              isClosed ? 'border-gray-100' : 'border-amber-200'
            }`}
          >
            <button
              onClick={() => onToggle(c.sessionId)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isClosed ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  <Receipt size={18} className={isClosed ? 'text-emerald-600' : 'text-amber-600'} />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{c.caissierNom}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(c.openedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {c.closedAt && (
                      <> — {new Date(c.closedAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatFCFA(c.totalEncaisse)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isClosed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isClosed ? (c.closureType === 'Z' ? 'Cloture Z' : c.closureType === 'X' ? 'Cloture X' : 'Fermee') : 'En cours'}
                    </span>
                    {c.unpaidCount > 0 && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        {c.unpaidCount} non payee{c.unpaidCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-5 pb-4 pt-0 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Fond de caisse</p>
                    <p className="text-sm font-bold text-gray-800">{formatFCFA(c.openingFloat)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Total encaisse</p>
                    <p className="text-sm font-bold text-emerald-700">{formatFCFA(c.totalEncaisse)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Total depenses</p>
                    <p className="text-sm font-bold text-red-600">{formatFCFA(c.totalExpenses)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Non encaisses</p>
                    <p className="text-sm font-bold text-red-600">{c.unpaidCount} tickets</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">Montant non encaisse</p>
                    <p className="text-sm font-bold text-red-600">{formatFCFA(c.unpaidAmount)}</p>
                  </div>
                  <div className="bg-teal-50 rounded-xl p-3 border-2 border-teal-200">
                    <p className="text-xs text-gray-500 font-semibold">Total en caisse (net)</p>
                    <p className="text-sm font-black text-teal-700">{formatFCFA(c.totalNetCaisse)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PaymentMethodsSection({ stats, grandTotal }: {
  stats: PaymentMethodStat[];
  grandTotal: number;
}) {
  if (stats.length === 0) {
    return <EmptyState message="Aucun paiement pour cette periode" />;
  }

  const methodIcons: Record<string, typeof CreditCard> = {
    CASH: Banknote,
    CARD: CreditCard,
    WAVE: Smartphone,
    ORANGE_MONEY: Smartphone,
    OTHER: CreditCard,
  };

  const methodColors: Record<string, { bg: string; text: string; iconBg: string }> = {
    CASH: { bg: 'bg-green-50', text: 'text-green-700', iconBg: 'bg-green-100' },
    CARD: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    WAVE: { bg: 'bg-sky-50', text: 'text-sky-700', iconBg: 'bg-sky-100' },
    ORANGE_MONEY: { bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100' },
    OTHER: { bg: 'bg-gray-50', text: 'text-gray-700', iconBg: 'bg-gray-100' },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map(s => {
          const Icon = methodIcons[s.method] || CreditCard;
          const colors = methodColors[s.method] || methodColors.OTHER;
          const pct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
          return (
            <div key={s.method} className={`${colors.bg} rounded-2xl p-5 border-2 border-transparent`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.iconBg}`}>
                  <Icon size={20} className={colors.text} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">{s.label}</p>
                  <p className="text-xs text-gray-400">{s.count} paiement{s.count > 1 ? 's' : ''}</p>
                </div>
              </div>
              <p className={`text-xl font-black ${colors.text}`}>{formatFCFA(s.total)}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${colors.text.replace('text-', 'bg-')}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-500">{pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold">Mode de reglement</th>
              <th className="text-right px-5 py-3 font-semibold">Nb transactions</th>
              <th className="text-right px-5 py-3 font-semibold">Montant total</th>
              <th className="text-right px-5 py-3 font-semibold">Part</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stats.map(s => {
              const pct = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
              const Icon = methodIcons[s.method] || CreditCard;
              return (
                <tr key={s.method} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Icon size={16} className="text-gray-400" />
                      <span className="font-semibold text-gray-900 text-sm">{s.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-medium text-gray-700">{s.count}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{formatFCFA(s.total)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                      {pct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-gray-50 font-bold">
              <td className="px-5 py-3 text-sm text-gray-700">TOTAL</td>
              <td className="px-5 py-3 text-right text-sm text-gray-700">
                {stats.reduce((s, p) => s + p.count, 0)}
              </td>
              <td className="px-5 py-3 text-right text-sm text-gray-900">{formatFCFA(grandTotal)}</td>
              <td className="px-5 py-3 text-right text-xs text-gray-500">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EXPENSE_CAT_COLORS: Record<string, string> = {
  FOURNITURE: 'bg-blue-100 text-blue-700',
  TRANSPORT: 'bg-amber-100 text-amber-700',
  SALAIRE: 'bg-emerald-100 text-emerald-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  REPAS: 'bg-rose-100 text-rose-700',
  AUTRE: 'bg-gray-100 text-gray-700',
};

function ExpensesSection({ expenses, stats, totalRevenue, totalExpenses }: {
  expenses: Expense[];
  stats: ExpenseStat[];
  totalRevenue: number;
  totalExpenses: number;
}) {
  const netRevenue = Math.max(0, totalRevenue - totalExpenses);
  const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-emerald-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">CA brut</p>
          </div>
          <p className="text-xl font-black text-emerald-700">{formatFCFA(totalRevenue)}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Depenses ({expenseRatio.toFixed(1)}%)</p>
          </div>
          <p className="text-xl font-black text-red-600">{formatFCFA(totalExpenses)}</p>
        </div>
        <div className="bg-teal-50 rounded-2xl p-4 border-2 border-teal-200">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-teal-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Benefice net</p>
          </div>
          <p className="text-xl font-black text-teal-700">{formatFCFA(netRevenue)}</p>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900">Depenses par categorie</h3>
            </div>
            <span className="text-sm font-bold text-red-600">{formatFCFA(totalExpenses)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-semibold">Categorie</th>
                  <th className="text-right px-5 py-3 font-semibold">Nb</th>
                  <th className="text-right px-5 py-3 font-semibold">Montant</th>
                  <th className="text-right px-5 py-3 font-semibold">Part</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.map(s => {
                  const pct = totalExpenses > 0 ? (s.total / totalExpenses) * 100 : 0;
                  const color = EXPENSE_CAT_COLORS[s.category] || EXPENSE_CAT_COLORS.AUTRE;
                  return (
                    <tr key={s.category} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color}`}>{s.label}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-gray-700">{s.count}</td>
                      <td className="px-5 py-3 text-right text-sm font-bold text-gray-900">{formatFCFA(s.total)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{pct.toFixed(1)}%</span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="px-5 py-3 text-sm text-gray-700">TOTAL</td>
                  <td className="px-5 py-3 text-right text-sm text-gray-700">{stats.reduce((s, e) => s + e.count, 0)}</td>
                  <td className="px-5 py-3 text-right text-sm text-red-600">{formatFCFA(totalExpenses)}</td>
                  <td className="px-5 py-3 text-right text-xs text-gray-500">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState message="Aucune depense pour cette periode" />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Detail des depenses</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {expenses.map(e => {
              const color = EXPENSE_CAT_COLORS[e.category] || EXPENSE_CAT_COLORS.AUTRE;
              return (
                <div key={e.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{e.label}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
                        {EXPENSE_CATEGORY_LABELS[e.category] || e.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {new Date(e.expense_date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {(e as any).created_by_user?.nom && (
                        <span className="text-xs text-gray-400">{(e as any).created_by_user.nom}</span>
                      )}
                      {e.notes && <span className="text-xs text-gray-400 italic truncate">{e.notes}</span>}
                    </div>
                  </div>
                  <span className="font-black text-red-600 text-base whitespace-nowrap">{formatFCFA(e.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <Calendar size={36} className="mx-auto mb-3 text-gray-300" />
      <p className="text-gray-500 font-medium">{message}</p>
    </div>
  );
}
