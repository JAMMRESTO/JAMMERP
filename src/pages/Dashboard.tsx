import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, ShoppingBag, DollarSign, Receipt, Users,
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle,
  Package, ChefHat, Truck, Clock, CheckCircle2, UserCircle2,
  Building2, Globe, LayoutGrid, Wallet, Printer,
  Calendar, ChevronLeft, ChevronRight, ChevronDown, BarChart3,
  Tag, ShoppingBag as BagIcon,
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
import { esc, A4_CSS_LANDSCAPE, buildA4Header, printViaIframe } from '../lib/printUtils';
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
interface CategoryPoint { name: string; value: number; qty: number; color: string }
interface ProductPoint { name: string; qty: number; revenue: number; color: string }
interface LiveOrder { id: string; order_number: number; table: string; status: string; type: string; created_at: string }
interface DashAlert { id: string; level: 'warning' | 'error' | 'info'; title: string; message: string; time: string }
interface UserRevenue { cashier_id: string | null; name: string; revenue: number; count: number; avatar_url: string; products: ProductPoint[] }
interface SiteStat { site: Site; revenue: number; orders: number; avgTicket: number }

type DetailTab = 'categories' | 'products' | 'cashiers';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  pending:   { label: 'En attente',     color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: Clock },
  preparing: { label: 'En préparation', color: 'text-blue-400',    bg: 'bg-blue-500/10',    icon: ChefHat },
  ready:     { label: 'Prêt',           color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
};
const TYPE_LABELS: Record<string, string> = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Vente directe' };
const CATEGORY_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4','#F97316','#14B8A6','#EAB308','#0EA5E9','#22C55E','#DC2626','#0891B2'];
const PRODUCT_COLORS  = ['#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4','#F97316','#EC4899','#14B8A6','#6366F1','#0EA5E9'];
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
      className="glass-card rounded-2xl p-3 sm:p-4 border border-white/8 hover:border-white/16 transition-all cursor-default relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(circle at 0% 0%, ${kpi.color}08 0%, transparent 70%)` }} />
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
          <Icon size={16} className="sm:hidden" style={{ color: kpi.color }} />
          <Icon size={18} className="hidden sm:block" style={{ color: kpi.color }} />
        </div>
        <span className={`flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-1 rounded-full ${positive ? 'text-emerald-400 bg-emerald-500/12 border border-emerald-500/20' : 'text-red-400 bg-red-500/12 border border-red-500/20'}`}>
          {positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {Math.abs(kpi.change)}%
        </span>
      </div>
      <p className="text-lg sm:text-2xl font-black text-white leading-tight tabular-nums">{kpi.value}</p>
      <p className="text-white/40 text-[10px] sm:text-xs mt-1 font-medium">{kpi.label}</p>
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

// ─── Date Picker ──────────────────────────────────────────────────────────────
function DatePickerBar({ date, onChange, todayStr }: { date: string; onChange: (d: string) => void; todayStr: string }) {
  const shift = (delta: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    onChange(d.toISOString().slice(0, 10));
  };
  const formatDate = (ds: string) => {
    const d = new Date(ds + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const isToday = date === todayStr;
  return (
    <div className="flex items-center gap-2 glass-card rounded-2xl px-3 py-2 border border-white/8 flex-shrink-0">
      <Calendar size={14} className="text-white/30 hidden sm:block" />
      <button
        onClick={() => shift(-1)}
        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/60 hover:text-white transition-all flex-shrink-0"
      >
        <ChevronLeft size={16} />
      </button>
      <div className="flex flex-col items-center min-w-0">
        <span className="text-white text-xs sm:text-sm font-semibold truncate">{formatDate(date)}</span>
      </div>
      <button
        onClick={() => shift(1)}
        disabled={date >= todayStr}
        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
      >
        <ChevronRight size={16} />
      </button>
      {!isToday && (
        <button
          onClick={() => onChange(todayStr)}
          className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-200 hover:text-white text-[11px] font-semibold transition-all whitespace-nowrap flex-shrink-0"
        >
          Aujourd'hui
        </button>
      )}
      <input
        type="date"
        value={date}
        max={todayStr}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 text-[10px] text-white/50 hover:text-white cursor-pointer transition-all [color-scheme:dark] flex-shrink-0"
        style={{ colorScheme: 'dark' }}
      />
    </div>
  );
}

// ─── Detail Tabs ──────────────────────────────────────────────────────────────
function DetailTabBar({ tab, onChange }: { tab: DetailTab; onChange: (t: DetailTab) => void }) {
  const tabs: { id: DetailTab; label: string; icon: LucideIcon }[] = [
    { id: 'categories', label: 'Catégories', icon: Tag },
    { id: 'products',   label: 'Produits',   icon: BagIcon },
    { id: 'cashiers',   label: 'Caissiers',  icon: Users },
  ];
  return (
    <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/8 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {tabs.map(t => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              tab === t.id ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            <Icon size={14} />
            <span>{t.label}</span>
          </button>
        );
      })}
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
          <p className="text-white/30 text-xs mt-0.5">Chiffre d'affaires de la journée</p>
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
                  <div><p className="text-white/35 text-[10px]">{s.orders} cmdes</p></div>
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
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: color + '15', background: `linear-gradient(to right, ${color}08, transparent)` }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}>
          <Building2 size={15} style={{ color }} />
        </div>
        <div>
          <p className="text-white font-bold text-sm">{stat.site.name}</p>
          {stat.site.address && <p className="text-white/30 text-[10px] mt-0.5">{stat.site.address}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/5">
        {[
          { label: "CA", value: stat.revenue.toLocaleString('fr-FR'), sub: sym },
          { label: "Commandes", value: String(stat.orders), sub: 'jour' },
          { label: "Ticket moy.", value: stat.avgTicket.toLocaleString('fr-FR'), sub: sym },
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
        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => Number(v) >= 1000 ? `${Math.round(Number(v)/1000)}k` : Number(v).toLocaleString('fr-FR')} />
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

  const isTenantOwnerView = !currentUser;
  const isMultiSite = sites.length > 1;

  const [viewMode, setViewMode]     = useState<ViewMode>('consolidated');
  const [kpis, setKpis]             = useState<KPI[]>([]);
  const [weekData, setWeekData]     = useState<DayPoint[]>([]);
  const [multiWeek, setMultiWeek]   = useState<Record<string, Record<string, number>>>({});
  const [catData, setCatData]       = useState<CategoryPoint[]>([]);
  const [prodData, setProdData]     = useState<ProductPoint[]>([]);
  const [liveOrders, setLiveOrders] = useState<LiveOrder[]>([]);
  const [alerts, setAlerts]         = useState<DashAlert[]>([]);
  const [userRevenues, setUserRevenues] = useState<UserRevenue[]>([]);
  const [siteStats, setSiteStats]   = useState<SiteStat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailTab, setDetailTab]   = useState<DetailTab>('categories');
  const [expandedCashier, setExpandedCashier] = useState<string | null>(null);

  // Global date — defaults to today
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selDate, setSelDate]       = useState(todayStr);

  const load = useCallback(async () => {
    setRefreshing(true);
    const selected   = selDate;
    const dayBefore  = new Date(new Date(selected + 'T00:00:00').getTime() - 86400000).toISOString().slice(0, 10);
    const weekAgo    = new Date(new Date(selected + 'T00:00:00').getTime() - 7 * 86400000).toISOString().slice(0, 10);

    // Determine which site(s) to query
    const querySites: Site[] = isTenantOwnerView && isMultiSite ? sites : [currentSite!].filter(Boolean);
    const siteIds = querySites.map(s => s.id);

    // Helper — filter by site(s)
    const sf = (q: ReturnType<typeof supabase.from>) =>
      siteIds.length === 1
        ? q.eq('site_id', siteIds[0])
        : q.in('site_id', siteIds);

    const [allSales, staleOrders, orders, lowProducts, lowIngredients, allUsers, allExpenses] = await Promise.all([
      sf(supabase.from('sales').select('total, created_at, site_id, cashier_id')).eq('status','paid').gte('created_at', weekAgo+'T00:00:00'),
      sf(supabase.from('orders').select('id, order_number, status, created_at')).in('status',['pending','preparing']).lt('created_at', new Date(Date.now() - 20 * 60000).toISOString()).limit(5),
      sf(supabase.from('orders').select('id, order_number, status, order_type, notes, created_at')).in('status',['pending','preparing','ready']).order('created_at',{ ascending: false }).limit(5),
      sf(supabase.from('products').select('name, stock, low_stock_threshold')).eq('track_stock',true).gt('low_stock_threshold',0).limit(20),
      sf(supabase.from('ingredients').select('name, stock, low_stock_threshold')).eq('is_active',true).gt('low_stock_threshold',0).lte('stock',0).limit(10),
      sf(supabase.from('users').select('id, name, avatar_url')).eq('is_active',true),
      sf(supabase.from('expenses').select('amount, expense_date')).gte('expense_date', dayBefore).lte('expense_date', selected),
    ]);

    // Split the single sales query into selected / dayBefore / week
    const selStart  = selected + 'T00:00:00';
    const selEnd    = selected + 'T23:59:59';
    const prevStart = dayBefore + 'T00:00:00';
    const prevEnd   = dayBefore + 'T23:59:59';
    const allSalesData = allSales.data ?? [];
    const selSalesData = allSalesData.filter((s: {created_at: string}) => s.created_at >= selStart && s.created_at <= selEnd);
    const prevSalesData = allSalesData.filter((s: {created_at: string}) => s.created_at >= prevStart && s.created_at <= prevEnd);

    // ─── Aggregated KPIs ───────────────────────────────────────
    const selRevenue = selSalesData.reduce((s, r: {total: number}) => s + r.total, 0);
    const prevRevenue  = prevSalesData.reduce((s, r: {total: number}) => s + r.total, 0);
    const selCount   = selSalesData.length;
    const prevCount    = prevSalesData.length;
    const avgTicket    = selCount > 0 ? Math.round(selRevenue / selCount) : 0;
    const prevAvg      = prevCount  > 0 ? Math.round(prevRevenue  / prevCount)  : 0;
    const selExpTotal = (allExpenses.data ?? []).filter((e: {expense_date: string}) => e.expense_date === selected).reduce((s, r: {amount: number}) => s + Number(r.amount), 0);
    const prevExpTotal  = (allExpenses.data ?? []).filter((e: {expense_date: string}) => e.expense_date === dayBefore).reduce((s, r: {amount: number}) => s + Number(r.amount), 0);
    const selNet = selRevenue - selExpTotal;
    const prevNet  = prevRevenue - prevExpTotal;

    const isToday = selected === todayStr;
    const compareLabel = isToday ? 'vs hier' : `vs ${new Date(dayBefore+'T00:00:00').toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`;

    setKpis([
      { label: "Chiffre d'affaires", value: `${selRevenue.toLocaleString('fr-FR')} ${sym}`, rawValue: selRevenue, change: pct(selRevenue, prevRevenue), icon: DollarSign, color: '#3B82F6', bg: '#3B82F620' },
      { label: 'Commandes',          value: String(selCount), rawValue: selCount, change: pct(selCount, prevCount), icon: ShoppingBag, color: '#10B981', bg: '#10B98120' },
      { label: 'Depenses',           value: `${selExpTotal.toLocaleString('fr-FR')} ${sym}`, rawValue: selExpTotal, change: pct(selExpTotal, prevExpTotal), icon: Wallet, color: '#EF4444', bg: '#EF444420' },
      { label: 'Benefice net',       value: `${selNet.toLocaleString('fr-FR')} ${sym}`, rawValue: selNet, change: pct(selNet, prevNet), icon: TrendingUp, color: '#F59E0B', bg: '#F59E0B20' },
      { label: 'Ticket moyen',       value: `${avgTicket.toLocaleString('fr-FR')} ${sym}`, rawValue: avgTicket, change: pct(avgTicket, prevAvg), icon: Receipt, color: '#06B6D4', bg: '#06B6D420' },
    ]);

    // ─── Per-site stats ────────────────────────────────────────
    if (isTenantOwnerView && isMultiSite) {
      const perSite: SiteStat[] = querySites.map(site => {
        const siteSales = selSalesData.filter((s: {site_id: string}) => s.site_id === site.id);
        const siteRevenue = siteSales.reduce((s, r: {total: number}) => s + r.total, 0);
        const siteOrders  = siteSales.length;
        return { site, revenue: siteRevenue, orders: siteOrders, avgTicket: siteOrders > 0 ? Math.round(siteRevenue / siteOrders) : 0 };
      });
      setSiteStats(perSite);

      const mw: Record<string, Record<string, number>> = {};
      for (const site of querySites) mw[site.id] = {};
      (allSalesData as {total: number; created_at: string; site_id: string}[]).forEach((s) => {
        const d = new Date(s.created_at);
        const label = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
        if (!mw[s.site_id]) mw[s.site_id] = {};
        mw[s.site_id][label] = (mw[s.site_id][label] ?? 0) + s.total;
      });
      setMultiWeek(mw);
    }

    // ─── Week data (rolling 7 days from selDate) ──────────────
    const wMap: Record<string, number> = {};
    (allSalesData as {total: number; created_at: string}[]).forEach((s) => {
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

    // ─── Revenue by cashier (with product breakdown) ───────────
    const userMap: Record<string, {revenue: number; count: number; saleIds: string[]}> = {};
    (selSalesData as {cashier_id: string | null; total: number; id?: string}[]).forEach((s) => {
      const key = s.cashier_id ?? '__unknown__';
      if (!userMap[key]) userMap[key] = { revenue: 0, count: 0, saleIds: [] };
      userMap[key].revenue += s.total;
      userMap[key].count++;
      if (s.id) userMap[key].saleIds.push(s.id);
    });
    const usersById: Record<string, {name: string; avatar_url: string}> = {};
    (allUsers.data ?? []).forEach((u: {id: string; name: string; avatar_url: string}) => { usersById[u.id] = { name: u.name, avatar_url: u.avatar_url }; });
    setUserRevenues(
      Object.entries(userMap).map(([id, v]) => ({
        cashier_id: id === '__unknown__' ? null : id,
        name: id === '__unknown__' ? 'Non assigné' : (usersById[id]?.name ?? 'Inconnu'),
        avatar_url: usersById[id]?.avatar_url ?? '',
        revenue: v.revenue, count: v.count, products: [],
      })).sort((a, b) => b.revenue - a.revenue)
    );

    setLoading(false);
    setRefreshing(false);
  }, [sym, isTenantOwnerView, isMultiSite, sites, currentSite, selDate, todayStr]);

  useEffect(() => { load(); }, [load]);

  // ─── Load category + product + cashier-product detail data ───
  const loadDetailData = useCallback(async (dateStr: string) => {
    const querySitesDetail: Site[] = isTenantOwnerView && isMultiSite ? sites : [currentSite!].filter(Boolean);
    const detailSiteIds = querySitesDetail.map(s => s.id);
    const dsf = (q: ReturnType<typeof supabase.from>) =>
      detailSiteIds.length === 1 ? q.eq('site_id', detailSiteIds[0]) : q.in('site_id', detailSiteIds);

    const { data: saleItems } = await dsf(
      supabase.from('sale_items')
        .select('subtotal, quantity, product_name, product:products!left(category:categories!left(name)), sale:sales!inner(created_at, status, site_id, cashier_id)')
        .eq('sale.status', 'paid')
        .gte('sale.created_at', dateStr + 'T00:00:00')
        .lte('sale.created_at', dateStr + 'T23:59:59')
    );

    // Category aggregation
    const catMap: Record<string, { value: number; qty: number }> = {};
    // Product aggregation
    const prodMap: Record<string, { qty: number; revenue: number }> = {};
    // Cashier-product aggregation
    const cashierProdMap: Record<string, Record<string, { qty: number; revenue: number }>> = {};

    (saleItems ?? []).forEach((item: {
      subtotal: number; quantity: number; product_name: string;
      product: { category: { name: string } | null } | null;
      sale: { cashier_id: string | null };
    }) => {
      const catName = item.product?.category?.name ?? 'Non classé';
      if (!catMap[catName]) catMap[catName] = { value: 0, qty: 0 };
      catMap[catName].value += item.subtotal;
      catMap[catName].qty += item.quantity;

      if (!prodMap[item.product_name]) prodMap[item.product_name] = { qty: 0, revenue: 0 };
      prodMap[item.product_name].qty += item.quantity;
      prodMap[item.product_name].revenue += item.subtotal;

      const cKey = item.sale?.cashier_id ?? '__unknown__';
      if (!cashierProdMap[cKey]) cashierProdMap[cKey] = {};
      if (!cashierProdMap[cKey][item.product_name]) cashierProdMap[cKey][item.product_name] = { qty: 0, revenue: 0 };
      cashierProdMap[cKey][item.product_name].qty += item.quantity;
      cashierProdMap[cKey][item.product_name].revenue += item.subtotal;
    });

    // Set category data
    const sortedCats = Object.entries(catMap).sort(([,a],[,b]) => b.value - a.value);
    setCatData(sortedCats.map(([name, v], i) => ({ name, value: v.value, qty: v.qty, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] })));

    // Set product data
    const sortedProds = Object.entries(prodMap).sort(([,a],[,b]) => b.revenue - a.revenue);
    setProdData(sortedProds.map(([name, v], i) => ({ name, qty: v.qty, revenue: v.revenue, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] })));

    // Merge product breakdown into userRevenues
    setUserRevenues(prev => prev.map(u => {
      const key = u.cashier_id ?? '__unknown__';
      const prods = cashierProdMap[key];
      if (!prods) return { ...u, products: [] };
      const products: ProductPoint[] = Object.entries(prods)
        .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue, color: '#3B82F6' }))
        .sort((a, b) => b.qty - a.qty);
      return { ...u, products };
    }));
  }, [isTenantOwnerView, isMultiSite, sites, currentSite]);

  useEffect(() => { loadDetailData(selDate); }, [loadDetailData, selDate]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  const userName = currentUser?.name?.split(' ')[0] ?? tenant?.name ?? 'Chef';
  const totalCatValue = catData.reduce((s, c) => s + c.value, 0);
  const totalProdRevenue = prodData.reduce((s, p) => s + p.revenue, 0);
  const totalProdQty = prodData.reduce((s, p) => s + p.qty, 0);
  const showMultiView = isTenantOwnerView && isMultiSite;
  const top10Products = prodData.slice(0, 10);

  const handlePrintReport = () => {
    const dateStr = new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const selDateLabel = new Date(selDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const scope = showMultiView ? `Vue consolidée — ${sites.length} sites` : `Site : ${currentSite?.name ?? ''}`;
    const header = buildA4Header({
      restaurant_name: settings.restaurant_name || tenant?.name || 'Rapport',
      address: settings.address,
      phone: settings.phone,
    });
    const kpisHtml = kpis.map(k => `
      <div class="stat">
        <span class="stat-val">${esc(k.value)}</span>
        <span class="stat-lbl">${esc(k.label)}</span>
      </div>
    `).join('');
    const cashierRowsHtml = userRevenues.length > 0
      ? userRevenues.map(u => `
        <tr>
          <td>${esc(u.name)}</td>
          <td class="text-right">${u.count}</td>
          <td class="text-right">${u.revenue.toLocaleString('fr-FR')} ${esc(sym)}</td>
        </tr>
      `).join('')
      : '';
    const totalCashiers = userRevenues.reduce((s, u) => s + u.revenue, 0);
    const totalTickets = userRevenues.reduce((s, u) => s + u.count, 0);
    const cashierBlockHtml = userRevenues.length > 0
      ? `
        <h3 style="margin-top:14px;">Chiffre d'affaires par caissier</h3>
        <table>
          <colgroup><col style="width:55%;"><col style="width:15%;"><col style="width:30%;"></colgroup>
          <thead><tr><th>Caissier</th><th class="text-right">Tickets</th><th class="text-right">CA</th></tr></thead>
          <tbody>${cashierRowsHtml}</tbody>
          <tfoot><tr class="total-row"><td>Total</td><td class="text-right">${totalTickets}</td><td class="text-right">${totalCashiers.toLocaleString('fr-FR')} ${esc(sym)}</td></tr></tfoot>
        </table>
      `
      : '';
    const catRowsHtml = catData.length > 0
      ? catData.map(c => `<tr><td>${esc(c.name)}</td><td class="text-right">${c.qty}</td><td class="text-right">${c.value.toLocaleString('fr-FR')} ${esc(sym)}</td><td class="text-right">${totalCatValue > 0 ? ((c.value / totalCatValue) * 100).toFixed(1) : 0}%</td></tr>`).join('')
      : '';
    const catBlockHtml = catRowsHtml
      ? `<h3 style="margin-top:14px;">Ventes par catégories</h3><table><thead><tr><th>Catégorie</th><th class="text-right">Qté</th><th class="text-right">CA</th><th class="text-right">Part</th></tr></thead><tbody>${catRowsHtml}</tbody></table>`
      : '';
    const prodRowsHtml = prodData.length > 0
      ? prodData.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td class="text-right">${p.qty}</td><td class="text-right">${p.revenue.toLocaleString('fr-FR')} ${esc(sym)}</td></tr>`).join('')
      : '';
    const prodBlockHtml = prodRowsHtml
      ? `<h3 style="margin-top:14px;">Ventes par produits</h3><table><thead><tr><th>#</th><th>Produit</th><th class="text-right">Qté</th><th class="text-right">CA</th></tr></thead><tbody>${prodRowsHtml}</tbody></table>`
      : '';
    const siteRowsHtml = showMultiView && siteStats.length > 0
      ? siteStats.map(s => `<tr><td>${esc(s.site.name)}</td><td class="text-right">${s.orders}</td><td class="text-right">${s.avgTicket.toLocaleString('fr-FR')} ${esc(sym)}</td><td class="text-right">${s.revenue.toLocaleString('fr-FR')} ${esc(sym)}</td></tr>`).join('')
      : '';
    const siteBlockHtml = siteRowsHtml
      ? `<h3 style="margin-top:14px;">Répartition par site</h3><table><thead><tr><th>Site</th><th class="text-right">Commandes</th><th class="text-right">Ticket moyen</th><th class="text-right">CA</th></tr></thead><tbody>${siteRowsHtml}</tbody></table>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="only light">
  <title>Rapport du ${esc(selDateLabel)}</title>
  <style>${A4_CSS_LANDSCAPE}</style>
</head>
<body>
  ${header}
  <h2>Rapport du tableau de bord</h2>
  <p class="subtitle">${esc(scope)} — ${esc(selDateLabel)} — édité le ${esc(dateStr)}</p>
  <hr class="sep">
  <div class="stat-block">${kpisHtml}</div>
  ${siteBlockHtml}
  ${catBlockHtml}
  ${prodBlockHtml}
  ${cashierBlockHtml}
  <div class="doc-footer">
    <span>${esc(settings.restaurant_name || tenant?.name || '')}</span>
    <span>Rapport du ${esc(selDateLabel)}</span>
  </div>
</body>
</html>`;
    printViaIframe(html);
  };

  return (
    <div className="p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-4 h-full overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
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
                : `Site ${currentSite?.name ?? ''}`
              }
            </motion.p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showMultiView && <ViewToggle mode={viewMode} onChange={setViewMode} />}
            <button
              onClick={handlePrintReport}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-200 hover:text-white text-xs font-medium transition-all disabled:opacity-50"
            >
              <Printer size={12} />
              <span className="hidden sm:inline">Imprimer</span>
            </button>
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

        {/* Global date picker */}
        <DatePickerBar date={selDate} onChange={setSelDate} todayStr={todayStr} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {siteStats.map((s, i) => (
                <SiteStatCard key={s.site.id} stat={s} color={SITE_COLORS[i % SITE_COLORS.length]} index={i} />
              ))}
            </div>
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
            className="space-y-3 sm:space-y-4"
          >
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="glass-card rounded-2xl p-4 border border-white/8 h-24 animate-pulse bg-white/3" />
                  ))
                : kpis.map((k, i) => <StatCard key={k.label} kpi={k} index={i} />)
              }
            </div>

            {/* Site comparison (multi-site only) */}
            {showMultiView && siteStats.length > 0 && (
              <SiteComparisonBar stats={siteStats} sym={sym} />
            )}

            {/* Charts row — hidden on mobile to save space */}
            <div className={`hidden lg:grid grid-cols-1 ${showMultiView ? 'xl:grid-cols-5' : 'lg:grid-cols-5'} gap-2 sm:gap-3 lg:gap-4`}>
              {/* Area chart */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="xl:col-span-3 glass-card rounded-2xl p-4 sm:p-5 border border-white/8"
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
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => Number(v) >= 1000 ? `${Math.round(Number(v)/1000)}k` : Number(v).toLocaleString('fr-FR')} />
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
                className="xl:col-span-2 glass-card rounded-2xl p-4 sm:p-5 border border-white/8"
              >
                <h3 className="text-white font-semibold text-sm mb-3">Aperçu par catégories</h3>
                {catData.length === 0 ? (
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
                        <p className="text-white font-black text-[10px] leading-tight text-center">{totalCatValue.toLocaleString('fr-FR')}</p>
                        <p className="text-white/30 text-[9px]">Total</p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5 max-h-[130px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {catData.slice(0, 6).map((c, i) => (
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

            {/* ── Detail Tabs ─────────────────────────────────────── */}
            <div className="space-y-3">
              <DetailTabBar tab={detailTab} onChange={setDetailTab} />

              <AnimatePresence mode="wait">
                {/* ── Categories tab ── */}
                {detailTab === 'categories' && (
                  <motion.div
                    key="categories"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="glass-card rounded-2xl border border-white/8 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/8">
                      <h3 className="text-white font-semibold text-sm">Détail des ventes par catégories</h3>
                      {catData.length > 0 && (
                        <span className="text-white/30 text-xs">{catData.length} catégories · {totalCatValue.toLocaleString('fr-FR')} {sym}</span>
                      )}
                    </div>
                    {catData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10">
                        <Tag size={28} className="text-white/15 mb-2" />
                        <p className="text-white/30 text-sm">Aucune vente pour cette journée</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {catData.map((c, i) => {
                          const pctVal = totalCatValue > 0 ? (c.value / totalCatValue) * 100 : 0;
                          return (
                            <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-white/3 transition-colors">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-white text-sm font-medium truncate">{c.name}</span>
                                  <span className="text-white/40 text-xs flex-shrink-0">{pctVal.toFixed(1)}%</span>
                                </div>
                                <div className="h-1.5 mt-1.5 rounded-full overflow-hidden bg-white/5">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pctVal}%` }}
                                    transition={{ delay: 0.1 + i * 0.05, duration: 0.6 }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: c.color }}
                                  />
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-white font-bold text-sm tabular-nums">{c.value.toLocaleString('fr-FR')}</p>
                                <p className="text-white/30 text-[10px]">{c.qty} art · {sym}</p>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-white/8 bg-white/2">
                          <span className="text-white/50 text-xs font-semibold">Total</span>
                          <div className="text-right">
                            <p className="text-white font-black text-sm tabular-nums">{totalCatValue.toLocaleString('fr-FR')} {sym}</p>
                            <p className="text-white/30 text-[10px]">{catData.reduce((s, c) => s + c.qty, 0)} articles</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Products tab ── */}
                {detailTab === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {/* Top 10 chart */}
                    {top10Products.length > 0 && (
                      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/8">
                        <h3 className="text-white font-semibold text-sm mb-4">Top 10 produits (CA)</h3>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={top10Products} layout="vertical" barSize={14} margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                            <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => Number(v) >= 1000 ? `${Math.round(Number(v)/1000)}k` : Number(v).toLocaleString('fr-FR')} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip sym={sym} />} />
                            <Bar dataKey="revenue" name="CA" radius={[0, 4, 4, 0]}>
                              {top10Products.map((_, i) => <Cell key={i} fill={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Product list */}
                    <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
                      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/8">
                        <h3 className="text-white font-semibold text-sm">Détail des ventes par produits</h3>
                        {prodData.length > 0 && (
                          <span className="text-white/30 text-xs">{prodData.length} produits · {totalProdQty} unités</span>
                        )}
                      </div>
                      {prodData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10">
                          <BagIcon size={28} className="text-white/15 mb-2" />
                          <p className="text-white/30 text-sm">Aucune vente pour cette journée</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto scrollbar-thin">
                          {prodData.map((p, i) => {
                            const pctVal = totalProdRevenue > 0 ? (p.revenue / totalProdRevenue) * 100 : 0;
                            return (
                              <div key={i} className="px-4 sm:px-5 py-3 hover:bg-white/3 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ backgroundColor: p.color + '20', color: p.color }}>
                                    {i + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{p.name}</p>
                                    <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${pctVal}%`, backgroundColor: p.color }} />
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-white font-bold text-sm tabular-nums">{p.revenue.toLocaleString('fr-FR')}</p>
                                    <p className="text-white/30 text-[10px]">{p.qty} vendus · {pctVal.toFixed(1)}%</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {prodData.length > 0 && (
                        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-white/8 bg-white/2">
                          <span className="text-white/50 text-xs font-semibold">Total</span>
                          <div className="text-right">
                            <p className="text-white font-black text-sm tabular-nums">{totalProdRevenue.toLocaleString('fr-FR')} {sym}</p>
                            <p className="text-white/30 text-[10px]">{totalProdQty} unités vendues</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── Cashiers tab ── */}
                {detailTab === 'cashiers' && (
                  <motion.div
                    key="cashiers"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="glass-card rounded-2xl border border-white/8 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/8">
                      <h3 className="text-white font-semibold text-sm">Détail des ventes par caissier</h3>
                      {userRevenues.length > 0 && (
                        <span className="text-white/30 text-xs">{userRevenues.length} caissiers</span>
                      )}
                    </div>
                    {userRevenues.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10">
                        <UserCircle2 size={28} className="text-white/15 mb-2" />
                        <p className="text-white/30 text-sm">Aucune vente pour cette journée</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {userRevenues.map((u, i) => {
                          const topRevenue = userRevenues[0]?.revenue ?? 1;
                          const pctBar = Math.round((u.revenue / topRevenue) * 100);
                          const initial = u.name.charAt(0).toUpperCase();
                          const barColors = ['#3B82F6','#10B981','#F59E0B','#EF4444','#06B6D4'];
                          const barColor  = barColors[i % barColors.length];
                          const isExpanded = expandedCashier === (u.cashier_id ?? '__unknown__');
                          return (
                            <div key={u.cashier_id ?? '__unknown__'}>
                              <button
                                onClick={() => setExpandedCashier(isExpanded ? null : (u.cashier_id ?? '__unknown__'))}
                                className="w-full flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 hover:bg-white/3 transition-colors text-left"
                              >
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: barColor + '30', border: `1px solid ${barColor}40` }}>
                                  {u.avatar_url ? <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold" style={{ color: barColor }}>{initial}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-white text-xs sm:text-sm font-medium truncate">{u.name}</p>
                                    <ChevronDown size={14} className={`text-white/30 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </div>
                                  <div className="h-1 mt-1 rounded-full overflow-hidden bg-white/5 w-full">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${pctBar}%` }} transition={{ delay: 0.3, duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: barColor }} />
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-white font-bold text-sm tabular-nums">{u.revenue.toLocaleString('fr-FR')}</p>
                                  <p className="text-white/30 text-[10px]">{u.count} ticket{u.count > 1 ? 's' : ''} · {sym}</p>
                                </div>
                              </button>
                              <AnimatePresence>
                                {isExpanded && u.products.length > 0 && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden bg-white/2"
                                  >
                                    <div className="px-4 sm:px-5 py-2 border-t border-white/5">
                                      <p className="text-white/30 text-[10px] font-medium uppercase tracking-wider mb-2">Produits vendus ({u.products.length})</p>
                                      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                                        {u.products.map((p, pi) => (
                                          <div key={pi} className="flex items-center justify-between gap-2 py-1">
                                            <span className="text-white/60 text-xs truncate flex-1 min-w-0">{p.name}</span>
                                            <span className="text-white/40 text-[10px] flex-shrink-0">×{p.qty}</span>
                                            <span className="text-white/70 text-xs font-medium tabular-nums flex-shrink-0 w-20 text-right">{p.revenue.toLocaleString('fr-FR')}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                                {isExpanded && u.products.length === 0 && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-white/2"
                                  >
                                    <div className="px-4 sm:px-5 py-3 text-center">
                                      <p className="text-white/30 text-xs">Chargement des produits...</p>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-white/8 bg-white/2">
                          <span className="text-white/50 text-xs font-semibold">Total du jour</span>
                          <div className="text-right">
                            <p className="text-white font-black text-sm tabular-nums">{userRevenues.reduce((s, u) => s + u.revenue, 0).toLocaleString('fr-FR')} {sym}</p>
                            <p className="text-white/30 text-[10px]">{userRevenues.reduce((s, u) => s + u.count, 0)} tickets</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
