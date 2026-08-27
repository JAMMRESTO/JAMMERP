import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, ShoppingBag, DollarSign, Receipt, Users,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle,
  Package, ChefHat, Truck, Clock, CheckCircle2, UserCircle2,
  Building2, Globe, LayoutGrid, Wallet,
  Calendar, ChevronLeft, ChevronRight,
  type LucideIcon
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import type { Site } from '../types/database';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KPI {
  label: string;
  value: string;
  rawValue: number;
  change: number;
  icon: LucideIcon;
  color: string;
  bg: string;
}
interface DayPoint { day: string; ventes: number }
interface CategoryPoint { name: string; value: number; color: string }
interface LiveOrder { id: string; order_number: number; table: string; status: string; type: string; created_at: string }
interface DashAlert { id: string; level: 'warning' | 'error' | 'info'; title: string; message: string; time: string }
interface UserRevenue { cashier_id: string | null; name: string; revenue: number; count: number; avatar_url: string }
interface SiteStat { site: Site; revenue: number; orders: number; avgTicket: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  pending:   { label: 'En attente',     color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: Clock },
  preparing: { label: 'En préparation', color: 'text-blue-400',    bg: 'bg-blue-500/10',    icon: ChefHat },
  ready:     { label: 'Prêt',           color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
};
const TYPE_LABELS: Record<string, string> = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Vente directe' };
const CATEGORY_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4','#F97316','#14B8A6','#EAB308','#0EA5E9','#22C55E','#DC2626','#0891B2'];
const SITE_COLORS     = ['#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4','#8B5CF6','#EC4899'];
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round(((a - b) / b) * 100 * 10) / 10;
}

function ChartTip({ active, payload, label, sym }: { active?: boolean; payload?: Array<{value: number; name?: string; color?: string}>; label?: string; sym: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-white/10 rounded-xl p-3 shadow-2xl text-xs space-y-1">
      {label && <p className="text-white/50 mb-1.5 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          {p.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />}
          <span className="text-white font-bold">{(p.value ?? 0).toLocaleString('fr-FR')} {sym}</span>
          {p.name && <span className="text-white/40">{p.name}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ kpi, index }: { kpi: KPI; index: number }) {
  const positive = kpi.change >= 0;
  const Icon = kpi.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="glass-card rounded-2xl p-4 border border-white/8 hover:border-white/16 transition-all cursor-default relative overflow-hidden"
    >
      {/* Glow bg */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(circle at 0% 0%, ${kpi.color}08 0%, transparent 70%)` }} />
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
          <Icon size={18} style={{ color: kpi.color }} />
        </div>
        <span className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-1 rounded-full ${positive ? 'text-emerald-400 bg-emerald-500/12 border border-emerald-500/20' : 'text-red-400 bg-red-500/12 border border-red-500/20'}`}>
          {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {Math.abs(kpi.change)}%
        </span>
      </div>
      <p className="text-2xl font-black text-white leading-tight tabular-nums">{kpi.value}</p>
      <p className="text-white/40 text-xs mt-1 font-medium">{kpi.label}</p>
      <p className="text-white/20 text-[10px] mt-0.5">vs hier</p>
    </motion.div>
  );
}

// ─── View Toggle ──────────────────────────────────────────────────────────────
type ViewMode = 'consolidated' | 'per-site';

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/8">
      {([
        { id: 'consolidated', label: 'Consolidé', icon: LayoutGrid },
        { id: 'per-site',     label: 'Par site',   icon: Building2 },
      ] as const).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === id ? 'bg-white/10 text-white shadow' : 'text-white/35 hover:text-white/60'
          }`}
        >
          <Icon size={12} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Site Comparison Bar ──────────────────────────────────────────────────────
function SiteComparisonBar({ stats, sym }: { stats: SiteStat[]; sym: string }) {
  const maxRevenue = Math.max(...stats.map(s => s.revenue), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card rounded-2xl border border-white/8 overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Comparaison des sites</h3>
          <p className="text-white/30 text-xs mt-0.5">Chiffre d'affaires aujourd'hui</p>
        </div>
        <Globe size={15} className="text-white/20" />
      </div>

      <div className="p-5 space-y-4">
        {stats.map((s, i) => {
          const color = SITE_COLORS[i % SITE_COLORS.length];
          const barPct = maxRevenue > 0 ? (s.revenue / maxRevenue) * 100 : 0;
          return (
            <div key={s.site.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
                    <Building2 size={11} style={{ color }} />
                  </div>
                  <span className="text-white text-sm font-semibold">{s.site.name}</span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-white/35 text-[10px]">{s.orders} cmdes</p>
                  </div>
                  <p className="text-white font-bold text-sm tabular-nums">{s.revenue.toLocaleString('fr-FR')} <span className="text-white/30 text-xs font-normal">{sym}</span></p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Site Card (per-site view) ────────────────────────────────────────────────
function SiteStatCard({ stat, color, index }: { stat: SiteStat; color: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl border overflow-hidden"
      style={{ borderColor: color + '25' }}
    >
      {/* Site header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: color + '15', background: `linear-gradient(to right, ${color}08, transparent)` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}>
          <Building2 size={15} style={{ color }} />
        </div>
        <div>
          <p className="text-white font-bold text-sm">{stat.site.name}</p>
          {stat.site.address && <p className="text-white/30 text-[10px] mt-0.5">{stat.site.address}</p>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 divide-x divide-white/5">
        {[
          { label: "CA", value: stat.revenue.toLocaleString('fr-FR'), sub: 'FCFA' },
          { label: "Commandes", value: String(stat.orders), sub: 'aujourd\'hui' },
          { label: "Ticket moy.", value: stat.avgTicket.toLocaleString('fr-FR'), sub: 'FCFA' },
        ].map(kpi => (
          <div key={kpi.label} className="px-4 py-3 text-center">
            <p className="text-white font-black text-base tabular-nums">{kpi.value}</p>
            <p className="text-white/40 text-[10px] mt-0.5">{kpi.label}</p>
            <p className="text-white/20 text-[9px]">{kpi.sub}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Multi-site week chart ────────────────────────────────────────────────────
function MultiSiteChart({ data, sites, sym }: {
  data: Record<string, Record<string, number>>;
  sites: Site[];
  sym: string;
}) {
  const chartData = DAYS.map(day => {
    const point: Record<string, number | string> = { day };
    for (const s of sites) point[s.id] = data[s.id]?.[day] ?? 0;
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={chartData} barGap={2} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000)}k`} />
        <Tooltip content={<ChartTip sym={sym} />} />
        {sites.map((s, i) => (
          <Bar key={s.id} dataKey={s.id} name={s.name} fill={SITE_COLORS[i % SITE_COLORS.length]} radius={[4,4,0,0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function Dashboard() {
  const { settings } = useSettings();
  const { currentUser } = useAuth();
  const { currentSite, sites, tenant } = useTenant();
  const sym = settings.currency_symbol;
  const showLiveOrders = settings.dashboard_widgets?.live_orders ?? true;
  const showAlerts     = settings.dashboard_widgets?.alerts ?? true;

  // Is the current auth session the tenant owner (no PIN user logged in)
  // OR is it a site staff user
  const isTenantOwnerView = !currentUser;
  const isMultiSite = sites.length > 1;

  const [viewMode, setViewMode]     = useState<ViewMode>('consolidated');
  const [kpis, setKpis]             = useState<KPI[]>([]);
  const [weekData, setWeekData]     = useState<DayPoint[]>([]);
  const [multiWeek, setMultiWeek]   = useState<Record<string, Record<string, number>>>({});
  const [catData, setCatData]       = useState<CategoryPoint[]>([]);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [alerts, setAlerts]         = useState<DashAlert[]>([]);
  const [userRevenues, setUserRevenues] = useState<UserRevenue[]>([]);
  const [siteStats, setSiteStats]   = useState<SiteStat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catDate, setCatDate]       = useState(new Date().toISOString().slice(0, 10));
  const [catLoading, setCatLoading] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const today     = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    // Determine which site(s) to query
    const querySites: Site[] = isTenantOwnerView && isMultiSite ? sites : [currentSite!].filter(Boolean);
    const siteIds = querySites.map(s => s.id);

    // Helper — filter by site(s)
    const sf = (q: ReturnType<typeof supabase.from>) =>
      siteIds.length === 1
        ? q.eq('site_id', siteIds[0])
        : q.in('site_id', siteIds);

    const [todaySales, yestSales, weekSales, staleOrders, orders, lowProducts, lowIngredients, salesByUser, allUsers, todayExpenses, yestExpenses] = await Promise.all([
      sf(supabase.from('sales').select('total, site_id')).eq('status','paid').gte('created_at', today+'T00:00:00').lte('created_at', today+'T23:59:59'),
      sf(supabase.from('sales').select('total')).eq('status','paid').gte('created_at', yesterday+'T00:00:00').lte('created_at', yesterday+'T23:59:59'),
      sf(supabase.from('sales').select('total, created_at, site_id')).eq('status','paid').gte('created_at', weekAgo+'T00:00:00'),
      sf(supabase.from('orders').select('id, order_number, status, created_at')).in('status',['pending','preparing']).lt('created_at', new Date(Date.now() - 20 * 60000).toISOString()).limit(5),
      sf(supabase.from('orders').select('id, order_number, status, order_type, notes, created_at')).in('status',['pending','preparing','ready']).order('created_at',{ ascending: false }).limit(5),
      sf(supabase.from('products').select('name, stock, low_stock_threshold')).eq('track_stock',true).gt('low_stock_threshold',0).limit(20),
      sf(supabase.from('ingredients').select('name, stock, low_stock_threshold')).eq('is_active',true).gt('low_stock_threshold',0).lte('stock',0).limit(10),
      sf(supabase.from('sales').select('cashier_id, total, site_id')).eq('status','paid').gte('created_at', today+'T00:00:00').lte('created_at', today+'T23:59:59'),
      sf(supabase.from('users').select('id, name, avatar_url')).eq('is_active',true),
      sf(supabase.from('expenses').select('amount')).gte('expense_date', today).lte('expense_date', today),
      sf(supabase.from('expenses').select('amount')).gte('expense_date', yesterday).lte('expense_date', yesterday),
    ]);

    // ─── Aggregated KPIs ───────────────────────────────────────
    const todayRevenue = (todaySales.data ?? []).reduce((s, r: {total: number}) => s + r.total, 0);
    const yestRevenue  = (yestSales.data ?? []).reduce((s, r: {total: number}) => s + r.total, 0);
    const todayCount   = todaySales.data?.length ?? 0;
    const yestCount    = yestSales.data?.length ?? 0;
    const avgTicket    = todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0;
    const yestAvg      = yestCount  > 0 ? Math.round(yestRevenue  / yestCount)  : 0;
    const todayExpTotal = (todayExpenses.data ?? []).reduce((s, r: {amount: number}) => s + Number(r.amount), 0);
    const yestExpTotal  = (yestExpenses.data ?? []).reduce((s, r: {amount: number}) => s + Number(r.amount), 0);
    const todayNet = todayRevenue - todayExpTotal;
    const yestNet  = yestRevenue - yestExpTotal;

    setKpis([
      { label: "Chiffre d'affaires", value: `${todayRevenue.toLocaleString('fr-FR')} ${sym}`, rawValue: todayRevenue, change: pct(todayRevenue, yestRevenue), icon: DollarSign, color: '#3B82F6', bg: '#3B82F620' },
      { label: 'Commandes',          value: String(todayCount), rawValue: todayCount, change: pct(todayCount, yestCount), icon: ShoppingBag, color: '#10B981', bg: '#10B98120' },
      { label: 'Depenses',           value: `${todayExpTotal.toLocaleString('fr-FR')} ${sym}`, rawValue: todayExpTotal, change: pct(todayExpTotal, yestExpTotal), icon: Wallet, color: '#EF4444', bg: '#EF444420' },
      { label: 'Benefice net',       value: `${todayNet.toLocaleString('fr-FR')} ${sym}`, rawValue: todayNet, change: pct(todayNet, yestNet), icon: TrendingUp, color: '#F59E0B', bg: '#F59E0B20' },
      { label: 'Ticket moyen',       value: `${avgTicket.toLocaleString('fr-FR')} ${sym}`, rawValue: avgTicket, change: pct(avgTicket, yestAvg), icon: Receipt, color: '#06B6D4', bg: '#06B6D420' },
    ]);

    // ─── Per-site stats ────────────────────────────────────────
    if (isTenantOwnerView && isMultiSite) {
      const perSite: SiteStat[] = querySites.map(site => {
        const siteSales = (todaySales.data ?? []).filter((s: {site_id: string}) => s.site_id === site.id);
        const siteRevenue = siteSales.reduce((s, r: {total: number}) => s + r.total, 0);
        const siteOrders  = siteSales.length;
        return {
          site,
          revenue: siteRevenue,
          orders: siteOrders,
          avgTicket: siteOrders > 0 ? Math.round(siteRevenue / siteOrders) : 0,
        };
      });
      setSiteStats(perSite);

      // Multi-site week data
      const mw: Record<string, Record<string, number>> = {};
      for (const site of querySites) mw[site.id] = {};
      (weekSales.data ?? []).forEach((s: {total: number; created_at: string; site_id: string}) => {
        const d = new Date(s.created_at);
        const label = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
        if (!mw[s.site_id]) mw[s.site_id] = {};
        mw[s.site_id][label] = (mw[s.site_id][label] ?? 0) + s.total;
      });
      setMultiWeek(mw);
    }

    // ─── Single-site week data ─────────────────────────────────
    const wMap: Record<string, number> = {};
    (weekSales.data ?? []).forEach((s: {total: number; created_at: string}) => {
      const d = new Date(s.created_at);
      const label = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
      wMap[label] = (wMap[label] ?? 0) + s.total;
    });
    setWeekData(DAYS.map(d => ({ day: d, ventes: wMap[d] ?? 0 })));

    // ─── Live orders ───────────────────────────────────────────
    setLiveOrders((orders.data ?? []).map((o: {id: string; order_number: number; status: string; order_type: string; notes: string; created_at: string}) => ({
      id: o.id, order_number: o.order_number,
      table: o.notes || TYPE_LABELS[o.order_type] || 'N/A',
      status: o.status, type: TYPE_LABELS[o.order_type] || o.order_type,
      created_at: o.created_at,
    })));

    // ─── Alerts ────────────────────────────────────────────────
    const newAlerts: DashAlert[] = [];
    (lowProducts.data ?? []).forEach((p: {name: string; stock: number | null; low_stock_threshold: number}) => {
      if ((p.stock ?? 0) <= p.low_stock_threshold)
        newAlerts.push({ id: `p-${p.name}`, level: (p.stock ?? 0) <= 0 ? 'error' : 'warning', title: 'Stock faible', message: `${p.name} est presque épuisé`, time: 'Maintenant' });
    });
    (lowIngredients.data ?? []).forEach((i: {name: string}) => {
      newAlerts.push({ id: `i-${i.name}`, level: 'error', title: 'Ingrédient manquant', message: `${i.name} en rupture de stock`, time: 'Maintenant' });
    });
    (staleOrders.data ?? []).forEach((o: {id: string; order_number: number; created_at: string}) => {
      const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
      newAlerts.push({ id: `o-${o.id}`, level: 'warning', title: 'Commande en attente', message: `Commande #${o.order_number} en attente depuis ${mins} min`, time: `${mins} min` });
    });
    setAlerts(newAlerts.slice(0, 8));

    // ─── Revenue by cashier ────────────────────────────────────
    const userMap: Record<string, {revenue: number; count: number}> = {};
    (salesByUser.data ?? []).forEach((s: {cashier_id: string | null; total: number}) => {
      const key = s.cashier_id ?? '__unknown__';
      if (!userMap[key]) userMap[key] = { revenue: 0, count: 0 };
      userMap[key].revenue += s.total;
      userMap[key].count++;
    });
    const usersById: Record<string, {name: string; avatar_url: string}> = {};
    (allUsers.data ?? []).forEach((u: {id: string; name: string; avatar_url: string}) => { usersById[u.id] = { name: u.name, avatar_url: u.avatar_url }; });
    setUserRevenues(
      Object.entries(userMap).map(([id, v]) => ({
        cashier_id: id === '__unknown__' ? null : id,
        name: id === '__unknown__' ? 'Non assigné' : (usersById[id]?.name ?? 'Inconnu'),
        avatar_url: usersById[id]?.avatar_url ?? '',
        revenue: v.revenue, count: v.count,
      })).sort((a, b) => b.revenue - a.revenue)
    );

    setLoading(false);
    setRefreshing(false);
  }, [sym, isTenantOwnerView, isMultiSite, sites, currentSite]);

  useEffect(() => { load(); }, [load]);

  const loadCategoryData = useCallback(async (dateStr: string) => {
    setCatLoading(true);
    const querySitesCat: Site[] = isTenantOwnerView && isMultiSite ? sites : [currentSite!].filter(Boolean);
    const catSiteIds = querySitesCat.map(s => s.id);
    const catsf = (q: ReturnType<typeof supabase.from>) =>
      catSiteIds.length === 1 ? q.eq('site_id', catSiteIds[0]) : q.in('site_id', catSiteIds);

    const { data: catSaleItems } = await catsf(
      supabase.from('sale_items')
        .select('subtotal, product:products!left(category:categories!left(name)), sale:sales!inner(created_at, status, site_id)')
        .eq('sale.status', 'paid')
        .gte('sale.created_at', dateStr + 'T00:00:00')
        .lte('sale.created_at', dateStr + 'T23:59:59')
    );

    const catMap: Record<string, number> = {};
    (catSaleItems ?? []).forEach((item: { subtotal: number; product: { category: { name: string } | null } | null }) => {
      const catName = item.product?.category?.name ?? 'Non classé';
      catMap[catName] = (catMap[catName] ?? 0) + item.subtotal;
    });
    const sortedCats = Object.entries(catMap).sort(([,a],[,b]) => b - a);
    setCatData(sortedCats.map(([name, value], i) => ({ name, value, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] })));
    setCatLoading(false);
  }, [isTenantOwnerView, isMultiSite, sites, currentSite]);

  useEffect(() => { loadCategoryData(catDate); }, [loadCategoryData, catDate]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const shiftCatDate = (delta: number) => {
    const d = new Date(catDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setCatDate(d.toISOString().slice(0, 10));
  };

  const formatCatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const userName = currentUser?.name?.split(' ')[0] ?? tenant?.name ?? 'Chef';
  const totalCatValue = catData.reduce((s, c) => s + c.value, 0);
  const showMultiView = isTenantOwnerView && isMultiSite;

  return (
    <div className="p-3 sm:p-4 lg:p-5 space-y-4 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <motion.h2
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white font-bold text-lg sm:text-xl"
          >
            {greeting()}, <span style={{ color: 'var(--color-primary)' }}>{userName}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white/40 text-xs sm:text-sm mt-0.5"
          >
            {showMultiView
              ? `Vue consolidée — ${sites.length} sites`
              : `Vue du site ${currentSite?.name ?? ''} — aujourd'hui`
            }
          </motion.p>
        </div>
        <div className="flex items-center gap-2">
          {showMultiView && <ViewToggle mode={viewMode} onChange={setViewMode} />}
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white text-xs font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* ── Per-site view ─────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {showMultiView && viewMode === 'per-site' ? (
          <motion.div
            key="per-site"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Site stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {siteStats.map((s, i) => (
                <SiteStatCard key={s.site.id} stat={s} color={SITE_COLORS[i % SITE_COLORS.length]} index={i} />
              ))}
            </div>

            {/* Multi-site week chart */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-5 border border-white/8"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-sm">Ventes 7 jours — par site</h3>
                  <p className="text-white/30 text-xs mt-0.5">Chiffre d'affaires quotidien</p>
                </div>
                {/* Legend */}
                <div className="hidden sm:flex items-center gap-3">
                  {sites.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SITE_COLORS[i % SITE_COLORS.length] }} />
                      <span className="text-white/40 text-xs">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <MultiSiteChart data={multiWeek} sites={sites} sym={sym} />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="consolidated"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="glass-card rounded-2xl p-4 border border-white/8 h-28 animate-pulse bg-white/3" />
                  ))
                : kpis.map((k, i) => <StatCard key={k.label} kpi={k} index={i} />)
              }
            </div>

            {/* Site comparison (multi-site only) */}
            {showMultiView && siteStats.length > 0 && (
              <SiteComparisonBar stats={siteStats} sym={sym} />
            )}

            {/* Charts row */}
            <div className={`grid grid-cols-1 ${showMultiView ? 'xl:grid-cols-5' : 'lg:grid-cols-5'} gap-2 sm:gap-3 lg:gap-4`}>
              {/* Area/Bar chart */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="xl:col-span-3 glass-card rounded-2xl p-5 border border-white/8"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold text-sm">Ventes des 7 derniers jours</h3>
                    <p className="text-white/30 text-xs mt-0.5">
                      {showMultiView ? 'Total consolidé de tous les sites' : 'Chiffre d\'affaires journalier'}
                    </p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={weekData}>
                    <defs>
                      <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--color-primary, #3B82F6)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="var(--color-primary, #3B82F6)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v/1000)}k`} />
                    <Tooltip content={<ChartTip sym={sym} />} />
                    <Area type="monotone" dataKey="ventes" stroke="var(--color-primary, #3B82F6)" strokeWidth={2.5} fill="url(#wGrad)" dot={{ fill: 'var(--color-primary, #3B82F6)', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Donut */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="xl:col-span-2 glass-card rounded-2xl p-5 border border-white/8"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-semibold text-sm">Répartition par catégories</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => shiftCatDate(-1)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/50 hover:text-white transition-all"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      onClick={() => setCatDate(todayStr)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${catDate === todayStr ? 'bg-white/10 text-white' : 'bg-white/5 text-white/50 hover:text-white/80'}`}
                    >
                      Aujourd'hui
                    </button>
                    <button
                      onClick={() => shiftCatDate(1)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/50 hover:text-white transition-all"
                    >
                      <ChevronRight size={12} />
                    </button>
                    <input
                      type="date"
                      value={catDate}
                      onChange={(e) => e.target.value && setCatDate(e.target.value)}
                      className="w-7 h-6 rounded-lg bg-white/5 border border-white/8 text-[10px] text-white/50 hover:text-white cursor-pointer transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
                <p className="text-white/30 text-xs mb-4">{formatCatDate(catDate)}</p>

                {catLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw size={20} className="text-white/20 animate-spin" />
                  </div>
                ) : catData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Package size={28} className="text-white/15 mb-2" />
                    <p className="text-white/30 text-sm">Aucune vente pour cette journée</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <ResponsiveContainer width={130} height={130}>
                        <PieChart>
                          <Pie data={catData} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={3}>
                            {catData.map((_, i) => <Cell key={i} fill={catData[i].color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-white font-black text-xs">{Math.round(totalCatValue / 1000)} K</p>
                        <p className="text-white/30 text-[9px]">Total</p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5 max-h-[130px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {catData.map((c, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="text-white/60 text-[11px] truncate">{c.name}</span>
                          </div>
                          <span className="text-white/40 text-[10px] flex-shrink-0 ml-2">{totalCatValue > 0 ? Math.round(c.value / totalCatValue * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Revenue by cashier */}
            {!loading && userRevenues.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="glass-card rounded-2xl border border-white/8 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8">
                  <div>
                    <h3 className="text-white font-semibold text-sm">CA par caissier</h3>
                    <p className="text-white/30 text-[10px] mt-0.5">Aujourd'hui — ventes encaissées</p>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <UserCircle2 size={15} className="text-blue-400" />
                  </div>
                </div>
                <div className="grid grid-cols-12 px-3 sm:px-5 py-2 border-b border-white/5 bg-white/2">
                  <div className="col-span-5 text-white/30 text-[10px] font-medium uppercase tracking-wider">Caissier</div>
                  <div className="col-span-3 text-white/30 text-[10px] font-medium uppercase tracking-wider text-right">Ventes</div>
                  <div className="col-span-4 text-white/30 text-[10px] font-medium uppercase tracking-wider text-right">CA</div>
                </div>
                <div className="divide-y divide-white/5">
                  {(() => {
                    const topRevenue = userRevenues[0]?.revenue ?? 1;
                    return userRevenues.map((u, i) => {
                      const pctBar = Math.round((u.revenue / topRevenue) * 100);
                      const initial = u.name.charAt(0).toUpperCase();
                      const barColors = ['#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4'];
                      const barColor  = barColors[i % barColors.length];
                      return (
                        <motion.div
                          key={u.cashier_id ?? 'unknown'}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.40 + i * 0.05 }}
                          className="grid grid-cols-12 items-center gap-1 sm:gap-2 px-3 sm:px-5 py-3 hover:bg-white/3 transition-colors"
                        >
                          <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: barColor + '30', border: `1px solid ${barColor}40` }}>
                              {u.avatar_url ? <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold" style={{ color: barColor }}>{initial}</span>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-xs font-medium truncate">{u.name}</p>
                              <div className="h-1 mt-1 rounded-full overflow-hidden bg-white/5 w-full">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pctBar}%` }} transition={{ delay: 0.5, duration: 0.8, ease: [0.16,1,0.3,1] }} className="h-full rounded-full" style={{ backgroundColor: barColor }} />
                              </div>
                            </div>
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="text-white/50 text-xs">{u.count} ticket{u.count > 1 ? 's' : ''}</span>
                          </div>
                          <div className="col-span-4 text-right">
                            <p className="text-white font-bold text-sm tabular-nums">{u.revenue.toLocaleString('fr-FR')}</p>
                            <p className="text-white/30 text-[10px]">{sym}</p>
                          </div>
                        </motion.div>
                      );
                    });
                  })()}
                </div>
                <div className="grid grid-cols-12 items-center px-3 sm:px-5 py-3 border-t border-white/8 bg-white/2">
                  <div className="col-span-5 text-white/50 text-xs font-semibold">Total du jour</div>
                  <div className="col-span-3 text-right text-white/40 text-xs">{userRevenues.reduce((s, u) => s + u.count, 0)} tickets</div>
                  <div className="col-span-4 text-right">
                    <p className="text-white font-black text-sm tabular-nums">{userRevenues.reduce((s, u) => s + u.revenue, 0).toLocaleString('fr-FR')}</p>
                    <p className="text-white/30 text-[10px]">{sym}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bottom row */}
            {(showLiveOrders || showAlerts) && (
              <div className={`grid grid-cols-1 ${showLiveOrders && showAlerts ? 'lg:grid-cols-2' : ''} gap-3 sm:gap-4`}>
                {showLiveOrders && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card rounded-2xl border border-white/8 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8">
                      <h3 className="text-white font-semibold text-sm">Commandes en cours</h3>
                      <span className="text-white/20 text-xs">{liveOrders.length} active{liveOrders.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {liveOrders.length === 0 ? (
                        <div className="py-8 text-center"><p className="text-white/30 text-sm">Aucune commande active</p></div>
                      ) : liveOrders.map((o, i) => {
                        const cfg = STATUS_CFG[o.status] ?? STATUS_CFG.pending;
                        const StatusIcon = cfg.icon;
                        const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
                        return (
                          <motion.div key={o.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.42 + i * 0.04 }} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                            <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                              <StatusIcon size={13} className={cfg.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium text-xs">#{o.order_number.toString().padStart(4,'0')}</span>
                                <span className="text-white/50 text-xs truncate">{o.table}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} font-medium`}>{cfg.label}</span>
                              </div>
                            </div>
                            <span className="text-white/30 text-[10px] flex-shrink-0">{mins}min</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {showAlerts && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }} className="glass-card rounded-2xl border border-white/8 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8">
                      <h3 className="text-white font-semibold text-sm">Alertes & notifications</h3>
                      <span className="text-white/20 text-xs">{alerts.length}</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {alerts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <CheckCircle2 size={28} className="text-emerald-400/30 mb-2" />
                          <p className="text-white/30 text-sm">Tout va bien — aucune alerte</p>
                        </div>
                      ) : alerts.map((alert, i) => {
                        const colors = { warning: { bg: 'bg-amber-500/10', text: 'text-amber-400' }, error: { bg: 'bg-red-500/10', text: 'text-red-400' }, info: { bg: 'bg-blue-500/10', text: 'text-blue-400' } };
                        const c = colors[alert.level];
                        return (
                          <motion.div key={alert.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.46 + i * 0.05 }} className="flex items-start gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                            <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                              {alert.level === 'warning' ? <AlertTriangle size={13} className={c.text} /> : alert.level === 'error' ? <Package size={13} className={c.text} /> : <Truck size={13} className={c.text} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-medium">{alert.title}</p>
                              <p className="text-white/40 text-[10px] mt-0.5 leading-snug">{alert.message}</p>
                            </div>
                            <span className="text-white/20 text-[10px] flex-shrink-0">{alert.time}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
