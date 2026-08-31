import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { esc, fmtAmt, A4_CSS, A4_CSS_LANDSCAPE, buildA4Header, printViaIframe } from '../lib/printUtils';
import {
  BarChart3, TrendingUp, Package, Truck, FlaskConical,
  ShoppingBag, Download, Printer, FileText, CalendarDays,
  ArrowUpRight, ArrowDownRight, DollarSign, Users,
  RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Filter, Check
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { useSettings } from '../context/SettingsContext';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type ReportTab = 'sales' | 'products' | 'drivers' | 'stock' | 'production';
type PeriodPreset = 'today' | 'week' | 'month' | 'specific-month' | 'custom';

interface PeriodRange {
  from: string;
  to: string;
}

const MONTH_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function getMonthRange(year: number, month: number): PeriodRange {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { from: fmtDate(first), to: fmtDate(last) };
}

function getPresetRange(preset: PeriodPreset): PeriodRange {
  const now = new Date();

  if (preset === 'today') {
    const t = fmtDate(now);
    return { from: t, to: t };
  }
  if (preset === 'week') {
    const mon = new Date(now);
    mon.setDate(now.getDate() - now.getDay() + 1);
    return { from: fmtDate(mon), to: fmtDate(now) };
  }
  if (preset === 'month') {
    return { from: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`, to: fmtDate(now) };
  }
  if (preset === 'specific-month') {
    return getMonthRange(now.getFullYear(), now.getMonth());
  }
  return { from: fmtDate(now), to: fmtDate(now) };
}

// ─────────────────────────────────────────────────────────
// Recharts custom tooltip
// ─────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, sym }: { active?: boolean; payload?: Array<{ value: number; name?: string; color?: string }>; label?: string; sym: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-white/10 rounded-xl p-3 shadow-2xl text-xs">
      {label && <p className="text-white/50 mb-2">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#fff' }} className="font-semibold">
          {p.name ? `${p.name}: ` : ''}{p.value.toLocaleString('fr-FR')} {sym}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Period filter bar
// ─────────────────────────────────────────────────────────
interface PeriodFilterProps {
  preset: PeriodPreset;
  range: PeriodRange;
  monthValue: { year: number; month: number };
  availableYears: number[];
  onPresetChange: (p: PeriodPreset) => void;
  onRangeChange: (r: PeriodRange) => void;
  onMonthChange: (v: { year: number; month: number }) => void;
  onRefresh: () => void;
  loading: boolean;
}

function PeriodFilter({ preset, range, monthValue, availableYears, onPresetChange, onRangeChange, onMonthChange, onRefresh, loading }: PeriodFilterProps) {
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: 'today', label: "Aujourd'hui" },
    { id: 'week', label: 'Cette semaine' },
    { id: 'month', label: 'Ce mois' },
    { id: 'specific-month', label: 'Mois précis' },
    { id: 'custom', label: 'Personnalisé' },
  ];

  const now = new Date();
  const isCurrentMonth = monthValue.year === now.getFullYear() && monthValue.month === now.getMonth();
  const canGoNext = !(monthValue.year >= now.getFullYear() && monthValue.month >= now.getMonth());

  const shiftMonth = (delta: number) => {
    const d = new Date(monthValue.year, monthValue.month + delta, 1);
    if (d.getTime() > new Date(now.getFullYear(), now.getMonth(), 1).getTime()) return;
    onMonthChange({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/8">
        {presets.map(p => (
          <button
            key={p.id}
            onClick={() => onPresetChange(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${preset === p.id ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'specific-month' && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/60 hover:text-white transition-all"
            title="Mois précédent"
          >
            <ChevronLeft size={14} />
          </button>
          <select
            value={monthValue.month}
            onChange={e => onMonthChange({ ...monthValue, month: parseInt(e.target.value, 10) })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
          >
            {MONTH_LABELS.map((m, i) => {
              const disabled = monthValue.year === now.getFullYear() && i > now.getMonth();
              return <option key={i} value={i} disabled={disabled}>{m}</option>;
            })}
          </select>
          <select
            value={monthValue.year}
            onChange={e => {
              const y = parseInt(e.target.value, 10);
              const m = (y === now.getFullYear() && monthValue.month > now.getMonth()) ? now.getMonth() : monthValue.month;
              onMonthChange({ year: y, month: m });
            }}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50 [color-scheme:dark]"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => shiftMonth(1)}
            disabled={!canGoNext}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/60 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Mois suivant"
          >
            <ChevronRight size={14} />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => onMonthChange({ year: now.getFullYear(), month: now.getMonth() })}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white text-[11px] font-medium transition-all"
            >
              Ce mois-ci
            </button>
          )}
        </div>
      )}

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.from}
            onChange={e => onRangeChange({ ...range, from: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50"
          />
          <span className="text-white/30 text-xs">→</span>
          <input
            type="date"
            value={range.to}
            onChange={e => onRangeChange({ ...range, to: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50"
          />
        </div>
      )}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="p-2 rounded-xl bg-white/5 border border-white/8 text-white/40 hover:text-white/70 transition-all disabled:opacity-40"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Stat card mini
// ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, change }: { label: string; value: string | number; sub?: string; color: string; change?: number }) {
  return (
    <div className="glass-card rounded-2xl p-4 border border-white/8">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
      <p className="text-white/50 text-xs mt-1">{label}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          {Math.abs(change).toFixed(1)}% vs période préc.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Export utilities
// ─────────────────────────────────────────────────────────
function exportToCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface PrintReportSettings {
  restaurant_name: string;
  address?: string;
  phone?: string;
  currency_symbol: string;
}

function buildReportHtml(
  title: string,
  settings: PrintReportSettings,
  headers: string[],
  rows: (string | number)[][],
  options: { orientation?: 'portrait' | 'landscape'; colWidths?: string[]; alignRight?: number[] } = {},
): string {
  const orientation = options.orientation ?? 'portrait';
  const css = orientation === 'landscape' ? A4_CSS_LANDSCAPE : A4_CSS;
  const dateStr = new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const docHeader = buildA4Header(settings);
  const rightSet = new Set(options.alignRight ?? []);
  const colgroupHtml = options.colWidths
    ? `<colgroup>${options.colWidths.map(w => `<col style="width:${w};">`).join('')}</colgroup>`
    : '';
  const thHtml = headers.map((h, i) =>
    `<th${rightSet.has(i) ? ' class="text-right"' : ''}>${esc(h)}</th>`
  ).join('');
  const trHtml = rows.map(r =>
    `<tr>${r.map((c, i) => `<td${rightSet.has(i) ? ' class="text-right"' : ''}>${esc(String(c))}</td>`).join('')}</tr>`
  ).join('');

  const footer = `<div class="doc-footer"><span>${esc(settings.restaurant_name)}</span><span>${esc(title)}</span></div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="only light">
  <title>${esc(title)}</title>
  <style>${css}</style>
</head>
<body>
  ${docHeader}
  <h2>${esc(title)}</h2>
  <p class="subtitle">Édité le ${esc(dateStr)}</p>
  <hr class="sep">
  ${rows.length > 0
    ? `<table>${colgroupHtml}<thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>`
    : `<p style="color:#333;font-size:10pt;margin-top:12px;">Aucune donnée à afficher.</p>`
  }
  ${footer}
</body>
</html>`;
}

function printReportHtml(html: string) {
  printViaIframe(html);
}

// ─────────────────────────────────────────────────────────
// SALES REPORT
// ─────────────────────────────────────────────────────────
interface SaleRow {
  id: string;
  sale_number: number;
  sale_type: string;
  total: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  customer_name: string;
  table_number: string;
  cashier_id: string | null;
  created_at: string;
}

function SalesReport({ range, sym, settings }: { range: PeriodRange; sym: string; settings: PrintReportSettings }) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const [includeDetail, setIncludeDetail] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('site_id', siteId)
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(5000);
    setSales((data ?? []) as SaleRow[]);
    setSelectedDay(null);
    setLoading(false);
  }, [range, siteId]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = sales.reduce((s, r) => s + r.total, 0);
  const totalSubtotal = sales.reduce((s, r) => s + r.subtotal, 0);
  const totalDiscount = sales.reduce((s, r) => s + r.discount_amount, 0);
  const totalTax = sales.reduce((s, r) => s + r.tax_amount, 0);
  const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;

  // ── Daily totals ─────────────────────────────────────────────
  interface DayTotal {
    date: string;
    count: number;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  }
  const dailyByKey: Record<string, DayTotal> = {};
  sales.forEach(s => {
    const d = s.created_at.slice(0, 10);
    if (!dailyByKey[d]) dailyByKey[d] = { date: d, count: 0, subtotal: 0, discount: 0, tax: 0, total: 0 };
    dailyByKey[d].count++;
    dailyByKey[d].subtotal += s.subtotal;
    dailyByKey[d].discount += s.discount_amount;
    dailyByKey[d].tax += s.tax_amount;
    dailyByKey[d].total += s.total;
  });

  // Fill missing days across the range
  const allDays: DayTotal[] = [];
  const from = new Date(range.from + 'T00:00:00');
  const to = new Date(range.to + 'T00:00:00');
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  for (let d = new Date(from); d.getTime() <= to.getTime() && d.getTime() <= today.getTime(); d.setDate(d.getDate() + 1)) {
    const key = fmtDate(d);
    allDays.push(dailyByKey[key] ?? { date: key, count: 0, subtotal: 0, discount: 0, tax: 0, total: 0 });
  }
  const dailyRows = hideEmptyDays ? allDays.filter(d => d.count > 0) : allDays;

  const chartData = allDays.map(d => ({
    date: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    total: d.total,
  }));

  // By type
  const byType = { dine_in: 0, takeaway: 0, delivery: 0 };
  sales.forEach(s => {
    if (s.sale_type in byType) byType[s.sale_type as keyof typeof byType] += s.total;
  });
  const pieData = [
    { name: 'Sur place', value: byType.dine_in, color: '#3B82F6' },
    { name: 'À emporter', value: byType.takeaway, color: '#10B981' },
    { name: 'Livraison', value: byType.delivery, color: '#F59E0B' },
  ].filter(p => p.value > 0);

  const displayedSales = selectedDay ? sales.filter(s => s.created_at.slice(0, 10) === selectedDay) : sales;

  const rangeLabel = range.from === range.to
    ? new Date(range.from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : `Du ${new Date(range.from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} au ${new Date(range.to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  const formatDayLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleExport = () => exportToCSV(
    ['#', 'Type', 'Client', 'Table', 'Sous-total', 'Remise', 'TVA', 'Total', 'Date'],
    sales.map(s => [s.sale_number, s.sale_type, s.customer_name, s.table_number, s.subtotal, s.discount_amount, s.tax_amount, s.total, new Date(s.created_at).toLocaleString('fr-FR')]),
    'rapport_ventes'
  );

  const handlePrint = () => {
    const dateStr = new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const docHeader = buildA4Header(settings);
    const fmtAmount = (n: number) => `${Math.round(n).toLocaleString('fr-FR')}\u00a0${sym}`;

    const kpisHtml = `
      <div class="stat-block">
        <div class="stat"><span class="stat-val">${fmtAmount(totalRevenue)}</span><span class="stat-lbl">Chiffre d'affaires</span></div>
        <div class="stat"><span class="stat-val">${sales.length}</span><span class="stat-lbl">Tickets</span></div>
        <div class="stat"><span class="stat-val">${fmtAmount(avgTicket)}</span><span class="stat-lbl">Ticket moyen</span></div>
        <div class="stat"><span class="stat-val">${fmtAmount(totalDiscount)}</span><span class="stat-lbl">Remises</span></div>
        <div class="stat"><span class="stat-val">${fmtAmount(totalTax)}</span><span class="stat-lbl">TVA collectée</span></div>
      </div>
    `;

    const dailyRowsHtml = dailyRows.map(d => `
      <tr>
        <td>${esc(formatDayLabel(d.date))}</td>
        <td class="text-right">${d.count}</td>
        <td class="text-right">${fmtAmount(d.subtotal)}</td>
        <td class="text-right">${fmtAmount(d.discount)}</td>
        <td class="text-right">${fmtAmount(d.tax)}</td>
        <td class="text-right">${fmtAmount(d.total)}</td>
      </tr>
    `).join('');
    const dailyTable = `
      <h3 style="margin-top:14px;">Totaux par jour</h3>
      <table>
        <colgroup>
          <col style="width:28%;">
          <col style="width:12%;">
          <col style="width:15%;">
          <col style="width:15%;">
          <col style="width:15%;">
          <col style="width:15%;">
        </colgroup>
        <thead>
          <tr>
            <th>Jour</th>
            <th class="text-right">Tickets</th>
            <th class="text-right">Sous-total</th>
            <th class="text-right">Remises</th>
            <th class="text-right">TVA</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>${dailyRowsHtml || `<tr><td colspan="6" style="text-align:center;color:#555;">Aucune journée à afficher.</td></tr>`}</tbody>
        <tfoot>
          <tr class="total-row">
            <td>Total du mois</td>
            <td class="text-right">${sales.length}</td>
            <td class="text-right">${fmtAmount(totalSubtotal)}</td>
            <td class="text-right">${fmtAmount(totalDiscount)}</td>
            <td class="text-right">${fmtAmount(totalTax)}</td>
            <td class="text-right">${fmtAmount(totalRevenue)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    const typeLabel = (t: string) => t === 'dine_in' ? 'Sur place' : t === 'takeaway' ? 'À emporter' : 'Livraison';
    const detailRowsHtml = sales.slice().reverse().map(s => `
      <tr>
        <td>${esc(String(s.sale_number))}</td>
        <td>${esc(typeLabel(s.sale_type))}</td>
        <td>${esc(s.customer_name || '—')}</td>
        <td>${esc(s.table_number || '—')}</td>
        <td class="text-right">${fmtAmount(s.subtotal)}</td>
        <td class="text-right">${fmtAmount(s.discount_amount)}</td>
        <td class="text-right">${fmtAmount(s.tax_amount)}</td>
        <td class="text-right">${fmtAmount(s.total)}</td>
        <td>${esc(new Date(s.created_at).toLocaleString('fr-FR'))}</td>
      </tr>
    `).join('');
    const detailBlock = includeDetail && sales.length > 0 ? `
      <h3 style="margin-top:14px;">Détail des tickets</h3>
      <table>
        <colgroup>
          <col style="width:6%;">
          <col style="width:10%;">
          <col style="width:16%;">
          <col style="width:7%;">
          <col style="width:11%;">
          <col style="width:10%;">
          <col style="width:10%;">
          <col style="width:12%;">
          <col style="width:18%;">
        </colgroup>
        <thead>
          <tr>
            <th>#</th><th>Type</th><th>Client</th><th>Table</th>
            <th class="text-right">Sous-total</th>
            <th class="text-right">Remise</th>
            <th class="text-right">TVA</th>
            <th class="text-right">Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${detailRowsHtml}</tbody>
      </table>
    ` : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="only light">
  <title>Rapport Ventes</title>
  <style>${A4_CSS_LANDSCAPE}</style>
</head>
<body>
  ${docHeader}
  <h2>Rapport des ventes</h2>
  <p class="subtitle">${esc(rangeLabel)} — édité le ${esc(dateStr)}</p>
  <hr class="sep">
  ${kpisHtml}
  ${dailyTable}
  ${detailBlock}
  <div class="doc-footer">
    <span>${esc(settings.restaurant_name)}</span>
    <span>Rapport des ventes — ${esc(rangeLabel)}</span>
  </div>
</body>
</html>`;
    printViaIframe(html);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 flex-1">
          <StatCard label="Chiffre d'affaires" value={`${(totalRevenue/1000).toFixed(1)}K`} sub={sym} color="text-blue-400" />
          <StatCard label="Transactions" value={sales.length} color="text-white" />
          <StatCard label="Ticket moyen" value={`${Math.round(avgTicket).toLocaleString('fr-FR')}`} sub={sym} color="text-emerald-400" />
          <StatCard label="Remises totales" value={`${Math.round(totalDiscount).toLocaleString('fr-FR')}`} sub={sym} color="text-amber-400" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end items-center">
        <label className="flex items-center gap-1.5 text-white/50 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideEmptyDays}
            onChange={e => setHideEmptyDays(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-500"
          />
          Masquer les jours sans vente
        </label>
        <label className="flex items-center gap-1.5 text-white/50 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeDetail}
            onChange={e => setIncludeDetail(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-500"
          />
          Inclure le détail à l'impression
        </label>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Download size={12} /> Exporter CSV
        </button>
        <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-200 hover:text-white text-xs transition-all">
          <Printer size={12} /> Imprimer
        </button>
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-2 sm:gap-4">
          <div className="xl:col-span-2 glass-card rounded-2xl p-3 sm:p-5 border border-white/8">
            <h3 className="text-white font-semibold text-sm mb-4">Évolution des ventes</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="saleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip sym={sym} />} />
                <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} fill="url(#saleGrad)" name="Ventes" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {pieData.length > 0 && (
            <div className="glass-card rounded-2xl p-5 border border-white/8">
              <h3 className="text-white font-semibold text-sm mb-4">Par type de vente</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="45%" outerRadius={60} paddingAngle={3}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString('fr-FR')} ${sym}`, '']} />
                  <Legend formatter={(v) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Daily totals table */}
      <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/3">
          <div>
            <h3 className="text-white font-semibold text-sm">Totaux par jour</h3>
            <p className="text-white/30 text-[11px] mt-0.5">Cliquez sur une ligne pour filtrer les tickets ci-dessous</p>
          </div>
          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[11px] font-medium transition-all"
            >
              Retirer le filtre
            </button>
          )}
        </div>
        <div className="grid grid-cols-12 px-3 sm:px-4 py-2 border-b border-white/5 bg-white/2 text-white/30 text-[10px] font-medium uppercase tracking-wider">
          <div className="col-span-4">Jour</div>
          <div className="col-span-2 text-right">Tickets</div>
          <div className="col-span-2 text-right hidden sm:block">Remises</div>
          <div className="col-span-2 text-right hidden sm:block">TVA</div>
          <div className="col-span-2 sm:col-span-2 col-start-11 text-right">Total</div>
        </div>
        <div className="divide-y divide-white/5 max-h-72 overflow-y-auto scrollbar-thin">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse bg-white/2" />)
          ) : dailyRows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-white/30 text-sm">Aucune journée à afficher</p>
            </div>
          ) : dailyRows.map(d => {
            const active = selectedDay === d.date;
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDay(active ? null : d.date)}
                className={`w-full grid grid-cols-12 items-center px-3 sm:px-4 py-2.5 text-left transition-colors ${active ? 'bg-blue-500/15' : 'hover:bg-white/3'}`}
              >
                <div className="col-span-4">
                  <p className="text-white text-xs font-medium">{formatDayLabel(d.date)}</p>
                </div>
                <div className="col-span-2 text-right">
                  <span className={`text-xs tabular-nums ${d.count > 0 ? 'text-white/70' : 'text-white/25'}`}>{d.count}</span>
                </div>
                <div className="col-span-2 text-right hidden sm:block">
                  <span className={`text-xs tabular-nums ${d.discount > 0 ? 'text-amber-400/80' : 'text-white/25'}`}>{d.discount > 0 ? d.discount.toLocaleString('fr-FR') : '—'}</span>
                </div>
                <div className="col-span-2 text-right hidden sm:block">
                  <span className={`text-xs tabular-nums ${d.tax > 0 ? 'text-white/60' : 'text-white/25'}`}>{d.tax > 0 ? d.tax.toLocaleString('fr-FR') : '—'}</span>
                </div>
                <div className="col-span-2 sm:col-span-2 col-start-11 text-right">
                  <span className={`font-semibold text-xs sm:text-sm tabular-nums ${d.total > 0 ? 'text-white' : 'text-white/30'}`}>
                    {d.total > 0 ? d.total.toLocaleString('fr-FR') : '—'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-12 items-center px-3 sm:px-4 py-2.5 border-t border-white/8 bg-white/3">
          <div className="col-span-4 text-white/60 text-xs font-semibold">Total de la période</div>
          <div className="col-span-2 text-right text-white/50 text-xs tabular-nums">{sales.length}</div>
          <div className="col-span-2 text-right hidden sm:block text-amber-400/80 text-xs tabular-nums">{totalDiscount > 0 ? totalDiscount.toLocaleString('fr-FR') : '—'}</div>
          <div className="col-span-2 text-right hidden sm:block text-white/50 text-xs tabular-nums">{totalTax > 0 ? totalTax.toLocaleString('fr-FR') : '—'}</div>
          <div className="col-span-2 sm:col-span-2 col-start-11 text-right text-white font-black text-sm tabular-nums">{totalRevenue.toLocaleString('fr-FR')}</div>
        </div>
      </div>

      <div ref={printRef} className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="w-8 sm:w-10 text-white/30 text-xs font-medium">#</div>
          <div className="flex-1 text-white/30 text-xs font-medium">
            {selectedDay ? `Tickets du ${formatDayLabel(selectedDay)}` : 'Client / Table'}
          </div>
          <div className="hidden sm:block w-24 text-white/30 text-xs font-medium">Type</div>
          <div className="hidden md:block w-24 text-white/30 text-xs font-medium text-right">Remise</div>
          <div className="w-20 sm:w-28 text-white/30 text-xs font-medium text-right">Total</div>
          <div className="hidden sm:block w-28 text-white/30 text-xs font-medium text-right">Date</div>
        </div>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 border-b border-white/5 animate-pulse bg-white/2" />)
        ) : displayedSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <DollarSign size={28} className="text-white/15 mb-2" />
            <p className="text-white/30 text-sm">{selectedDay ? 'Aucune vente ce jour' : 'Aucune vente sur cette période'}</p>
          </div>
        ) : displayedSales.map(s => (
          <div key={s.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
            <div className="w-8 sm:w-10 text-white/40 text-[10px] sm:text-xs font-mono">#{s.sale_number}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs sm:text-sm truncate">{s.customer_name || s.table_number || '—'}</p>
            </div>
            <div className="hidden sm:block w-24">
              <span className="text-xs text-white/40">{s.sale_type === 'dine_in' ? 'Sur place' : s.sale_type === 'takeaway' ? 'Emporter' : 'Livraison'}</span>
            </div>
            <div className="hidden md:block w-24 text-right">
              {s.discount_amount > 0 && <span className="text-amber-400 text-xs">-{s.discount_amount.toLocaleString('fr-FR')} {sym}</span>}
            </div>
            <div className="w-20 sm:w-28 text-right">
              <p className="text-white font-semibold text-xs sm:text-sm">{s.total.toLocaleString('fr-FR')} {sym}</p>
            </div>
            <div className="hidden sm:block w-28 text-right">
              <p className="text-white/40 text-xs">{new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
              <p className="text-white/25 text-[10px]">{new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PRODUCTS REPORT
// ─────────────────────────────────────────────────────────
function ProductsReport({ range, sym, settings }: { range: PeriodRange; sym: string; settings: PrintReportSettings }) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [items, setItems] = useState<{ product_name: string; total_qty: number; total_revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sale_items')
      .select('product_name, quantity, subtotal, sale:sales!inner(created_at, status)')
      .eq('sale.site_id', siteId)
      .gte('sale.created_at', range.from + 'T00:00:00')
      .lte('sale.created_at', range.to + 'T23:59:59')
      .eq('sale.status', 'paid');

    if (data) {
      const map: Record<string, { total_qty: number; total_revenue: number }> = {};
      (data as { product_name: string; quantity: number; subtotal: number }[]).forEach(item => {
        if (!map[item.product_name]) map[item.product_name] = { total_qty: 0, total_revenue: 0 };
        map[item.product_name].total_qty += item.quantity;
        map[item.product_name].total_revenue += item.subtotal;
      });
      setItems(
        Object.entries(map)
          .map(([name, v]) => ({ product_name: name, ...v }))
          .sort((a, b) => b.total_revenue - a.total_revenue)
      );
    }
    setLoading(false);
  }, [range, siteId]);

  useEffect(() => { load(); }, [load]);

  const top10 = items.slice(0, 10);
  const totalRevenue = items.reduce((s, i) => s + i.total_revenue, 0);

  const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#EC4899','#14B8A6','#6366F1'];

  const handleExport = () => exportToCSV(
    ['Produit', 'Qté vendue', `CA (${sym})`],
    items.map(i => [i.product_name, i.total_qty, i.total_revenue]),
    'rapport_produits'
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Produits vendus (réf)" value={items.length} color="text-white" />
        <StatCard label="Unités totales" value={items.reduce((s, i) => s + i.total_qty, 0).toLocaleString('fr-FR')} color="text-blue-400" />
        <StatCard label="CA produits" value={`${(totalRevenue/1000).toFixed(1)}K`} sub={sym} color="text-emerald-400" />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Download size={12} /> Exporter CSV
        </button>
        <button onClick={() => printReportHtml(buildReportHtml('Rapport Produits', settings,
            ['Rang', 'Produit', 'Qté vendue', `CA (${sym})`, 'Part %'],
            items.map((item, idx) => [idx + 1, item.product_name, item.total_qty.toLocaleString('fr-FR'), `${item.total_revenue.toLocaleString('fr-FR')} ${sym}`, totalRevenue > 0 ? `${((item.total_revenue / totalRevenue) * 100).toFixed(1)}%` : '0%'])
          ))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Printer size={12} /> Imprimer
        </button>
      </div>

      {top10.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-white/8">
          <h3 className="text-white font-semibold text-sm mb-4">Top 10 produits (CA)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top10} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="product_name" width={110} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip sym={sym} />} />
              <Bar dataKey="total_revenue" name="CA" radius={[0, 4, 4, 0]}>
                {top10.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div ref={printRef} className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="w-8 text-white/30 text-xs font-medium">Rang</div>
          <div className="flex-1 text-white/30 text-xs font-medium">Produit</div>
          <div className="w-24 text-white/30 text-xs font-medium text-right">Qté vendue</div>
          <div className="w-28 text-white/30 text-xs font-medium text-right">CA</div>
          <div className="w-20 text-white/30 text-xs font-medium text-right">Part</div>
        </div>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 border-b border-white/5 animate-pulse bg-white/2" />)
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package size={28} className="text-white/15 mb-2" />
            <p className="text-white/30 text-sm">Aucune donnée sur cette période</p>
          </div>
        ) : items.map((item, idx) => {
          const pct = totalRevenue > 0 ? (item.total_revenue / totalRevenue) * 100 : 0;
          return (
            <div key={item.product_name} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
              <div className="w-8 text-white/30 text-xs font-bold">{idx + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{item.product_name}</p>
                <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="w-24 text-right">
                <p className="text-white/70 text-sm">{item.total_qty.toLocaleString('fr-FR')}</p>
              </div>
              <div className="w-28 text-right">
                <p className="text-white font-semibold text-sm">{item.total_revenue.toLocaleString('fr-FR')} {sym}</p>
              </div>
              <div className="w-20 text-right">
                <p className="text-blue-400 text-xs font-medium">{pct.toFixed(1)}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// DRIVERS REPORT
// ─────────────────────────────────────────────────────────
function DriversReport({ range, sym, settings }: { range: PeriodRange; sym: string; settings: PrintReportSettings }) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [data, setData] = useState<{ name: string; deliveries: number; revenue: number; commission: number; avg_time: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('driver_id, delivery_fee, commission_amount, driver:drivers(id, name), delivered_at, created_at')
      .eq('site_id', siteId)
      .eq('status', 'delivered')
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59');

    if (deliveries) {
      const map: Record<string, { name: string; deliveries: number; revenue: number; commission: number; times: number[] }> = {};
      (deliveries as { driver_id: string; delivery_fee: number; commission_amount: number; driver: { id: string; name: string } | null; delivered_at: string | null; created_at: string }[]).forEach(d => {
        const driverId = d.driver_id ?? 'unknown';
        const name = d.driver?.name ?? 'Inconnu';
        if (!map[driverId]) map[driverId] = { name, deliveries: 0, revenue: 0, commission: 0, times: [] };
        map[driverId].deliveries++;
        map[driverId].revenue += d.delivery_fee;
        map[driverId].commission += d.commission_amount;
        if (d.delivered_at) {
          const mins = Math.floor((new Date(d.delivered_at).getTime() - new Date(d.created_at).getTime()) / 60000);
          if (mins > 0 && mins < 300) map[driverId].times.push(mins);
        }
      });
      setData(
        Object.values(map)
          .map(v => ({
            name: v.name,
            deliveries: v.deliveries,
            revenue: v.revenue,
            commission: v.commission,
            avg_time: v.times.length > 0 ? Math.round(v.times.reduce((a, b) => a + b, 0) / v.times.length) : 0,
          }))
          .sort((a, b) => b.deliveries - a.deliveries)
      );
    }
    setLoading(false);
  }, [range, siteId]);

  useEffect(() => { load(); }, [load]);

  const handleExport = () => exportToCSV(
    ['Livreur', 'Livraisons', `CA (${sym})`, `Commission (${sym})`, 'Temps moyen (min)'],
    data.map(d => [d.name, d.deliveries, d.revenue, d.commission, d.avg_time]),
    'rapport_livreurs'
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Livraisons" value={data.reduce((s, d) => s + d.deliveries, 0)} color="text-blue-400" />
        <StatCard label="CA livraisons" value={`${data.reduce((s, d) => s + d.revenue, 0).toLocaleString('fr-FR')}`} sub={sym} color="text-emerald-400" />
        <StatCard label="Commissions" value={`${data.reduce((s, d) => s + d.commission, 0).toLocaleString('fr-FR')}`} sub={sym} color="text-amber-400" />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Download size={12} /> Exporter CSV
        </button>
        <button onClick={() => printReportHtml(buildReportHtml('Rapport Livreurs', settings,
            ['Livreur', 'Livraisons', `CA (${sym})`, `Commission (${sym})`, 'Temps moy. (min)'],
            data.map(d => [d.name, d.deliveries, `${d.revenue.toLocaleString('fr-FR')} ${sym}`, `${d.commission.toLocaleString('fr-FR')} ${sym}`, d.avg_time > 0 ? `${d.avg_time} min` : '—'])
          ))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Printer size={12} /> Imprimer
        </button>
      </div>

      <div ref={printRef} className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="flex-1 text-white/30 text-xs font-medium">Livreur</div>
          <div className="w-20 text-white/30 text-xs font-medium text-right">Livraisons</div>
          <div className="hidden sm:block w-28 text-white/30 text-xs font-medium text-right">CA</div>
          <div className="w-28 text-white/30 text-xs font-medium text-right">Commission</div>
          <div className="hidden md:block w-24 text-white/30 text-xs font-medium text-right">Temps moy.</div>
        </div>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 border-b border-white/5 animate-pulse bg-white/2" />)
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Truck size={28} className="text-white/15 mb-2" />
            <p className="text-white/30 text-sm">Aucune livraison sur cette période</p>
          </div>
        ) : data.map(d => (
          <div key={d.name} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{d.name}</p>
            </div>
            <div className="w-20 text-right">
              <p className="text-blue-400 font-bold text-sm">{d.deliveries}</p>
            </div>
            <div className="hidden sm:block w-28 text-right">
              <p className="text-white text-sm">{d.revenue.toLocaleString('fr-FR')} {sym}</p>
            </div>
            <div className="w-28 text-right">
              <p className="text-emerald-400 font-semibold text-sm">{d.commission.toLocaleString('fr-FR')} {sym}</p>
            </div>
            <div className="hidden md:block w-24 text-right">
              <p className="text-white/50 text-sm">{d.avg_time > 0 ? `${d.avg_time} min` : '—'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// STOCK REPORT
// ─────────────────────────────────────────────────────────
function StockReport({ sym, settings }: { sym: string; settings: PrintReportSettings }) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [products, setProducts] = useState<{ name: string; stock: number | null; unit: string; cost_price: number; low_stock_threshold: number; track_stock: boolean }[]>([]);
  const [ingredients, setIngredients] = useState<{ name: string; stock: number; unit: string; cost_per_unit: number; low_stock_threshold: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('name, stock, unit, cost_price, low_stock_threshold, track_stock').eq('site_id', siteId).eq('track_stock', true).order('name'),
      supabase.from('ingredients').select('name, stock, unit, cost_per_unit, low_stock_threshold').eq('site_id', siteId).eq('is_active', true).order('name'),
    ]).then(([pRes, iRes]) => {
      if (pRes.data) setProducts(pRes.data as typeof products);
      if (iRes.data) setIngredients(iRes.data as typeof ingredients);
      setLoading(false);
    });
  }, [siteId]);

  const productValue = products.reduce((s, p) => s + (p.stock ?? 0) * p.cost_price, 0);
  const ingredientValue = ingredients.reduce((s, i) => s + i.stock * i.cost_per_unit, 0);
  const alerts = ingredients.filter(i => i.stock <= i.low_stock_threshold && i.low_stock_threshold > 0);
  const outOfStock = [...products.filter(p => (p.stock ?? 0) <= 0), ...ingredients.filter(i => i.stock <= 0)];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Valeur produits" value={`${(productValue/1000).toFixed(1)}K`} sub={sym} color="text-blue-400" />
        <StatCard label="Valeur ingrédients" value={`${(ingredientValue/1000).toFixed(1)}K`} sub={sym} color="text-emerald-400" />
        <StatCard label="Alertes stock" value={alerts.length} color={alerts.length > 0 ? 'text-amber-400' : 'text-white/50'} />
        <StatCard label="Ruptures" value={outOfStock.length} color={outOfStock.length > 0 ? 'text-red-400' : 'text-white/50'} />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={() => exportToCSV(['Produit', 'Stock', 'Unité', `Valeur (${sym})`], products.map(p => [p.name, p.stock ?? 0, p.unit, (p.stock ?? 0) * p.cost_price]), 'rapport_stock_produits')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Download size={12} /> Produits CSV
        </button>
        <button onClick={() => exportToCSV(['Ingrédient', 'Stock', 'Unité', `Valeur (${sym})`], ingredients.map(i => [i.name, i.stock, i.unit, i.stock * i.cost_per_unit]), 'rapport_stock_ingredients')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Download size={12} /> Ingrédients CSV
        </button>
        <button onClick={() => printReportHtml(buildReportHtml('Rapport Stock — Ingrédients', settings,
            ['Ingrédient', 'Stock', 'Unité', `Valeur (${sym})`, 'Statut'],
            ingredients.map(i => [i.name, i.stock.toLocaleString('fr-FR', { maximumFractionDigits: 3 }), i.unit, `${(i.stock * i.cost_per_unit).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${sym}`, i.stock <= 0 ? 'RUPTURE' : i.stock <= i.low_stock_threshold && i.low_stock_threshold > 0 ? 'ALERTE' : 'OK'])
          ))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Printer size={12} /> Imprimer
        </button>
      </div>

      <div ref={printRef} className="space-y-4">
        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <h4 className="text-amber-400 font-semibold text-sm mb-2">Alertes stock bas</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {alerts.map(i => (
                <div key={i.name} className="bg-white/5 rounded-xl px-3 py-2">
                  <p className="text-white/80 text-xs font-medium truncate">{i.name}</p>
                  <p className="text-amber-400 text-xs">{i.stock} / {i.low_stock_threshold} {i.unit}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients table */}
        <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 bg-white/3">
            <h4 className="text-white/60 text-xs font-semibold">Ingrédients</h4>
          </div>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 border-b border-white/5 animate-pulse bg-white/2" />)
          ) : ingredients.map(i => {
            const isAlert = i.stock <= i.low_stock_threshold && i.low_stock_threshold > 0;
            const isOut = i.stock <= 0;
            return (
              <div key={i.name} className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${isOut ? 'bg-red-500/5' : isAlert ? 'bg-amber-500/5' : 'hover:bg-white/3'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{i.name}</p>
                </div>
                <div className={`text-sm font-semibold ${isOut ? 'text-red-400' : isAlert ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {i.stock.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} {i.unit}
                </div>
                <div className="w-28 text-right">
                  <p className="text-blue-400 text-sm">{(i.stock * i.cost_per_unit).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PRODUCTION REPORT
// ─────────────────────────────────────────────────────────
function ProductionReport({ range, sym, settings }: { range: PeriodRange; sym: string; settings: PrintReportSettings }) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [prods, setProds] = useState<{ product_name: string; quantity_produced: number; total_cost: number; unit_cost: number; loss_quantity: number; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('productions')
      .select('product_name, quantity_produced, total_cost, unit_cost, loss_quantity, status, created_at')
      .eq('site_id', siteId)
      .gte('created_at', range.from + 'T00:00:00')
      .lte('created_at', range.to + 'T23:59:59')
      .order('created_at', { ascending: false });
    setProds((data ?? []) as typeof prods);
    setLoading(false);
  }, [range, siteId]);

  useEffect(() => { load(); }, [load]);

  const totalProduced = prods.reduce((s, p) => s + p.quantity_produced, 0);
  const totalLoss = prods.reduce((s, p) => s + p.loss_quantity, 0);
  const totalCost = prods.reduce((s, p) => s + p.total_cost, 0);
  const lossRate = totalProduced > 0 ? (totalLoss / (totalProduced + totalLoss)) * 100 : 0;

  const handleExport = () => exportToCSV(
    ['Produit', 'Qté produite', 'Pertes', `Coût total (${sym})`, `Coût unitaire (${sym})`, 'Date'],
    prods.map(p => [p.product_name, p.quantity_produced, p.loss_quantity, p.total_cost, p.unit_cost, new Date(p.created_at).toLocaleString('fr-FR')]),
    'rapport_production'
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Productions" value={prods.length} color="text-white" />
        <StatCard label="Unités produites" value={totalProduced.toLocaleString('fr-FR')} color="text-emerald-400" />
        <StatCard label="Taux de perte" value={`${lossRate.toFixed(1)}%`} color={lossRate > 10 ? 'text-red-400' : lossRate > 5 ? 'text-amber-400' : 'text-emerald-400'} />
        <StatCard label="Coût total" value={`${(totalCost/1000).toFixed(1)}K`} sub={sym} color="text-blue-400" />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Download size={12} /> Exporter CSV
        </button>
        <button onClick={() => printReportHtml(buildReportHtml('Rapport Production', settings,
            ['Produit', 'Qté produite', 'Pertes', `Coût unitaire (${sym})`, `Coût total (${sym})`, 'Statut', 'Date'],
            prods.map(p => [p.product_name, p.quantity_produced.toLocaleString('fr-FR'), p.loss_quantity.toLocaleString('fr-FR'), `${p.unit_cost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${sym}`, `${p.total_cost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${sym}`, p.status, new Date(p.created_at).toLocaleDateString('fr-FR')])
          ))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs transition-all">
          <Printer size={12} /> Imprimer
        </button>
      </div>

      <div ref={printRef} className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
          <div className="flex-1 text-white/30 text-xs font-medium">Produit</div>
          <div className="w-20 text-white/30 text-xs font-medium text-right">Produit</div>
          <div className="hidden sm:block w-16 text-white/30 text-xs font-medium text-right">Pertes</div>
          <div className="hidden md:block w-28 text-white/30 text-xs font-medium text-right">Coût unit.</div>
          <div className="w-28 text-white/30 text-xs font-medium text-right">Coût total</div>
          <div className="w-24 text-white/30 text-xs font-medium text-right">Date</div>
        </div>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 border-b border-white/5 animate-pulse bg-white/2" />)
        ) : prods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FlaskConical size={28} className="text-white/15 mb-2" />
            <p className="text-white/30 text-sm">Aucune production sur cette période</p>
          </div>
        ) : prods.map((p, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{p.product_name}</p>
            </div>
            <div className="w-20 text-right">
              <p className="text-emerald-400 font-semibold text-sm">{p.quantity_produced}</p>
            </div>
            <div className="hidden sm:block w-16 text-right">
              {p.loss_quantity > 0 ? <p className="text-red-400 text-sm">{p.loss_quantity}</p> : <p className="text-white/20 text-sm">—</p>}
            </div>
            <div className="hidden md:block w-28 text-right">
              <p className="text-white/50 text-sm">{p.unit_cost.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {sym}</p>
            </div>
            <div className="w-28 text-right">
              <p className="text-white font-semibold text-sm">{p.total_cost.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {sym}</p>
            </div>
            <div className="w-24 text-right">
              <p className="text-white/40 text-xs">{new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────
const tabs: { id: ReportTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'sales',      label: 'Ventes',      icon: BarChart3 },
  { id: 'products',   label: 'Produits',    icon: ShoppingBag },
  { id: 'drivers',    label: 'Livreurs',    icon: Truck },
  { id: 'stock',      label: 'Stock',       icon: Package },
  { id: 'production', label: 'Production',  icon: FlaskConical },
];

export function ReportsPage() {
  const { settings } = useSettings();
  const { currentSite } = useTenant();
  const sym = settings.currency_symbol;

  const nowRef = new Date();
  const [tab, setTab] = useState<ReportTab>('sales');
  const [preset, setPreset] = useState<PeriodPreset>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('reports.preset') : null;
    return (stored === 'today' || stored === 'week' || stored === 'month' || stored === 'specific-month' || stored === 'custom') ? stored : 'month';
  });
  const [monthValue, setMonthValue] = useState<{ year: number; month: number }>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('reports.month') : null;
      if (stored) {
        const parsed = JSON.parse(stored) as { year: number; month: number };
        if (Number.isInteger(parsed.year) && Number.isInteger(parsed.month)) return parsed;
      }
    } catch { /* ignore */ }
    return { year: nowRef.getFullYear(), month: nowRef.getMonth() };
  });
  const [range, setRange] = useState<PeriodRange>(() => {
    if (preset === 'specific-month') return getMonthRange(monthValue.year, monthValue.month);
    return getPresetRange(preset);
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [availableYears, setAvailableYears] = useState<number[]>([nowRef.getFullYear()]);

  // Load available years from earliest sale
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentSite?.id) return;
      const { data } = await supabase
        .from('sales')
        .select('created_at')
        .eq('site_id', currentSite.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (cancelled) return;
      const firstYear = data && data.length > 0 ? new Date((data[0] as { created_at: string }).created_at).getFullYear() : nowRef.getFullYear();
      const years: number[] = [];
      for (let y = firstYear; y <= nowRef.getFullYear(); y++) years.push(y);
      setAvailableYears(years);
    })();
    return () => { cancelled = true; };
  }, [currentSite?.id]);

  // Persist selection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('reports.preset', preset);
    window.localStorage.setItem('reports.month', JSON.stringify(monthValue));
  }, [preset, monthValue]);

  function handlePresetChange(p: PeriodPreset) {
    setPreset(p);
    if (p === 'specific-month') {
      setRange(getMonthRange(monthValue.year, monthValue.month));
    } else if (p !== 'custom') {
      setRange(getPresetRange(p));
    }
  }

  function handleMonthChange(v: { year: number; month: number }) {
    setMonthValue(v);
    if (preset === 'specific-month') setRange(getMonthRange(v.year, v.month));
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 pb-0 space-y-3">
        {/* Period filter */}
        <PeriodFilter
          preset={preset}
          range={range}
          monthValue={monthValue}
          availableYears={availableYears}
          onPresetChange={handlePresetChange}
          onRangeChange={setRange}
          onMonthChange={handleMonthChange}
          onRefresh={() => setRefreshKey(k => k + 1)}
          loading={false}
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/8 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
                  ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                <Icon size={14} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 scrollbar-thin">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${refreshKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'sales'      && <SalesReport      key={refreshKey} range={range} sym={sym} settings={settings} />}
            {tab === 'products'   && <ProductsReport   key={refreshKey} range={range} sym={sym} settings={settings} />}
            {tab === 'drivers'    && <DriversReport    key={refreshKey} range={range} sym={sym} settings={settings} />}
            {tab === 'stock'      && <StockReport      sym={sym} settings={settings} />}
            {tab === 'production' && <ProductionReport key={refreshKey} range={range} sym={sym} settings={settings} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
