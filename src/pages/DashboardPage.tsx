import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight,
  RefreshCw, CreditCard, Banknote, Smartphone, Printer,
  Calendar, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSolde } from '../hooks/useSolde';
import type { Caisse, Encaissement, Decaissement } from '../types/database';

interface Props {
  caisseActive: Caisse | null;
  caisses: Caisse[];
  userRole: string;
  onNavigate: (page: string) => void;
}

const MODE_LABELS: Record<string, string> = {
  especes: 'Especes',
  wave: 'Wave',
  orange_money: 'O. Money',
  carte: 'Carte',
  cheque: 'Cheque',
};

const MODE_ICON: Record<string, React.ReactNode> = {
  especes: <Banknote size={11} />,
  wave: <Smartphone size={11} />,
  orange_money: <Smartphone size={11} />,
  carte: <CreditCard size={11} />,
  cheque: <Banknote size={11} />,
};

const MODE_BG: Record<string, string> = {
  especes: 'bg-emerald-100 text-emerald-700',
  wave: 'bg-blue-100 text-blue-700',
  orange_money: 'bg-orange-100 text-orange-700',
  carte: 'bg-sky-100 text-sky-700',
  cheque: 'bg-slate-100 text-slate-600',
};

const DISPLAY_LIMIT = 20;

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

function fmtDateFull(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage({ caisseActive, caisses, userRole, onNavigate }: Props) {
  const isAdmin = userRole === 'admin';
  const [viewMode, setViewMode] = useState<string>(() => isAdmin ? 'all' : 'current');
  const solde = useSolde(caisseActive?.id ?? null);
  const [totalEnc, setTotalEnc] = useState<number | null>(null);
  const [totalDec, setTotalDec] = useState<number | null>(null);
  const [fond, setFond] = useState<number>(0);
  const [displayEnc, setDisplayEnc] = useState<Encaissement[]>([]);
  const [displayDec, setDisplayDec] = useState<Decaissement[]>([]);
  const [allEnc, setAllEnc] = useState<Encaissement[]>([]);
  const [allDec, setAllDec] = useState<Decaissement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [societeNom, setSocieteNom] = useState('');

  // Date filter
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [filterActive, setFilterActive] = useState(true);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    if (!caisseActive) return;

    const caisseId = caisseActive.id;

    let encQuery = supabase
      .from('encaissements')
      .select('*')
      .order('date_transaction', { ascending: false })
      .order('heure_transaction', { ascending: false })
      .limit(10000);

    let decQuery = supabase
      .from('decaissements')
      .select('*')
      .order('date_transaction', { ascending: false })
      .limit(10000);

    if (viewMode === 'current') {
      encQuery = encQuery.eq('caisse_id', caisseId);
      decQuery = decQuery.eq('caisse_id', caisseId);
    } else if (viewMode !== 'all') {
      encQuery = encQuery.eq('caisse_id', viewMode);
      decQuery = decQuery.eq('caisse_id', viewMode);
    }

    if (filterActive && dateFrom) {
      encQuery = encQuery.gte('date_transaction', dateFrom);
      decQuery = decQuery.gte('date_transaction', dateFrom);
    }
    if (filterActive && dateTo) {
      encQuery = encQuery.lte('date_transaction', dateTo);
      decQuery = decQuery.lte('date_transaction', dateTo);
    }

    if (!filterActive) {
      encQuery = encQuery.eq('archived', false);
      decQuery = decQuery.eq('archived', false);
    }

    const fondQuery = viewMode === 'all'
      ? supabase.from('caisses').select('fond_de_caisse')
      : viewMode === 'current'
        ? supabase.from('caisses').select('fond_de_caisse').eq('id', caisseId)
        : supabase.from('caisses').select('fond_de_caisse').eq('id', viewMode);

    const [{ data: enc }, { data: dec }, { data: soc }, { data: caisseData }] = await Promise.all([
      encQuery,
      decQuery,
      supabase.from('societe').select('nom_societe,nom').maybeSingle(),
      fondQuery,
    ]);

    const encData = enc ?? [];
    const decData = dec ?? [];
    const sumEnc = encData.reduce((s, e) => s + Number(e.montant), 0);
    const sumDec = decData.reduce((s, d) => s + Number(d.montant), 0);
    const fondVal = Array.isArray(caisseData)
      ? caisseData.reduce((s, c) => s + Number(c.fond_de_caisse ?? 0), 0)
      : Number(caisseData?.fond_de_caisse ?? 0);
    setTotalEnc(sumEnc);
    setTotalDec(sumDec);
    setFond(fondVal);
    setAllEnc(encData);
    setAllDec(decData);
    setDisplayEnc(encData.slice(0, DISPLAY_LIMIT));
    setDisplayDec(decData.slice(0, DISPLAY_LIMIT));
    if (soc) setSocieteNom(soc.nom_societe || soc.nom || '');
    if (showRefresh) setRefreshing(false);
  }, [caisseActive, filterActive, dateFrom, dateTo, viewMode]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (solde === null || totalEnc === null || totalDec === null) return;
    if (!filterActive) {
      const impliedSolde = fond + totalEnc - totalDec;
      if (Math.abs(impliedSolde - solde) > 1) load();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solde]);

  const clearFilter = () => {
    setFilterActive(false);
    setDateFrom('');
    setDateTo('');
  };

  const setToday = () => {
    const today = todayISO();
    setDateFrom(today);
    setDateTo(today);
    setFilterActive(true);
  };

  const printDate = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const filterLabel = filterActive && dateFrom && dateTo
    ? dateFrom === dateTo
      ? fmtDateFull(dateFrom)
      : `${fmtDateFull(dateFrom)} - ${fmtDateFull(dateTo)}`
    : 'Toutes les dates';

  return (
    <>
      {/* Screen view */}
      <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden print:hidden">

        {/* Header */}
        <div className="shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-gray-900 leading-tight">Tableau de bord</h1>
            <p className="text-[11px] text-gray-400">Vue d'ensemble de votre activite</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && caisses.length > 1 && (
              <select
                value={viewMode}
                onChange={e => setViewMode(e.target.value)}
                className="text-[11px] font-semibold text-gray-700 bg-white border border-gray-100 px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">Toutes les caisses</option>
                {caisses.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            )}
            {caisseActive && !isAdmin && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-500 bg-white border border-gray-100 px-2.5 py-1 rounded-lg font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {caisseActive.nom}
              </span>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition active:scale-[0.97]"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Imprimer</span>
            </button>
            <button
              onClick={() => load(true)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-white rounded-xl transition border border-transparent hover:border-gray-100"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Date filter bar */}
        <div className="shrink-0 px-4 pb-2">
          <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setFilterActive(true); }}
                className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 w-[120px]"
              />
              <span className="text-xs text-gray-400 font-medium">au</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setFilterActive(true); }}
                className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 w-[120px]"
              />
            </div>
            <button
              onClick={setToday}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
            >
              Aujourd'hui
            </button>
            {filterActive && (
              <button
                onClick={clearFilter}
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-lg transition"
              >
                <X size={10} />
                Tout afficher
              </button>
            )}
            <span className="ml-auto text-[10px] text-gray-400 font-medium hidden sm:block">
              {filterLabel}
            </span>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-emerald-500 rounded-2xl p-4 text-white relative overflow-hidden shadow-lg shadow-emerald-200">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/40 to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-emerald-100 text-[11px] font-bold uppercase tracking-wider">Total Encaissements</p>
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp size={16} />
                  </div>
                </div>
                <div className="text-2xl font-black tabular-nums leading-tight">
                  {totalEnc === null ? '—' : fmt(totalEnc)}
                </div>
                <div className="text-emerald-200 text-xs font-semibold mt-0.5">FCFA</div>
                <div className="text-emerald-200/70 text-[10px] mt-1">{allEnc.length} operation{allEnc.length > 1 ? 's' : ''}</div>
              </div>
            </div>

            <div className="bg-red-500 rounded-2xl p-4 text-white relative overflow-hidden shadow-lg shadow-red-200">
              <div className="absolute inset-0 bg-gradient-to-br from-red-400/40 to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-red-100 text-[11px] font-bold uppercase tracking-wider">Total Decaissements</p>
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingDown size={16} />
                  </div>
                </div>
                <div className="text-2xl font-black tabular-nums leading-tight">
                  {totalDec === null ? '—' : fmt(totalDec)}
                </div>
                <div className="text-red-200 text-xs font-semibold mt-0.5">FCFA</div>
                <div className="text-red-200/70 text-[10px] mt-1">{allDec.length} operation{allDec.length > 1 ? 's' : ''}</div>
              </div>
            </div>

            <div className="bg-blue-600 rounded-2xl p-4 text-white relative overflow-hidden shadow-lg shadow-blue-200">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/40 to-transparent" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-blue-100 text-[11px] font-bold uppercase tracking-wider">
                    {filterActive ? 'Solde Periode' : 'Solde Actuel'}
                  </p>
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                    <Wallet size={16} />
                  </div>
                </div>
                <div className="text-2xl font-black tabular-nums leading-tight">
                  {filterActive
                    ? ((totalEnc ?? 0) - (totalDec ?? 0) < 0 ? '-' : '') + fmt(Math.abs((totalEnc ?? 0) - (totalDec ?? 0)))
                    : solde === null ? '—' : (solde < 0 ? '-' : '') + fmt(Math.abs(solde))
                  }
                </div>
                <div className="text-blue-200 text-xs font-semibold mt-0.5">FCFA</div>
                {filterActive && (
                  <div className="text-blue-200/70 text-[10px] mt-1">Enc. - Dec. de la periode</div>
                )}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* Encaissements */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-900">
                  Encaissements
                  <span className="ml-2 text-[10px] font-normal text-gray-400">
                    {displayEnc.length < allEnc.length ? `${displayEnc.length} sur ` : ''}{allEnc.length}
                  </span>
                </h2>
                <button
                  onClick={() => onNavigate('historique')}
                  className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-0.5 transition"
                >
                  Voir tout <ArrowUpRight size={12} />
                </button>
              </div>
              {displayEnc.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-gray-400">Aucune transaction pour cette periode</div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Heure</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">N. Facture</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Client</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Montant</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayEnc.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(e.date_transaction)}</td>
                          <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap font-mono text-[10px]">{e.heure_transaction ?? '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{e.numero_facture}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-800 max-w-[120px] truncate">{e.client_nom}</td>
                          <td className="px-3 py-2.5 font-bold text-emerald-600 text-right whitespace-nowrap tabular-nums">{fmt(e.montant)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold ${MODE_BG[e.mode_paiement] ?? 'bg-gray-100 text-gray-600'}`}>
                              {MODE_ICON[e.mode_paiement]}
                              {MODE_LABELS[e.mode_paiement] ?? e.mode_paiement}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0">
                      <tr className="border-t border-gray-100 bg-gray-50">
                        <td colSpan={4} className="px-3 py-2.5 font-bold text-gray-600 text-xs">
                          Total ({allEnc.length} op.)
                        </td>
                        <td className="px-3 py-2.5 font-black text-emerald-600 text-right whitespace-nowrap tabular-nums">
                          {fmt(totalEnc ?? 0)} <span className="font-normal text-gray-400">FCFA</span>
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Decaissements */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-900">
                  Decaissements
                  <span className="ml-2 text-[10px] font-normal text-gray-400">
                    {displayDec.length < allDec.length ? `${displayDec.length} sur ` : ''}{allDec.length}
                  </span>
                </h2>
                <button
                  onClick={() => onNavigate('historique')}
                  className="text-xs text-red-500 font-semibold hover:text-red-600 flex items-center gap-0.5 transition"
                >
                  Voir tout <ArrowUpRight size={12} />
                </button>
              </div>
              {displayDec.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-gray-400">Aucune transaction pour cette periode</div>
              ) : (
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">N. Piece</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Compte</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Libelle</th>
                        <th className="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wide">Description</th>
                        <th className="px-3 py-2 text-right font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayDec.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(d.date_transaction)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{d.numero_piece}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500 whitespace-nowrap">{d.compte_numero}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-800 max-w-[100px] truncate">{d.compte_libelle}</td>
                          <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate">{d.description}</td>
                          <td className="px-3 py-2.5 font-bold text-red-500 text-right whitespace-nowrap tabular-nums">{fmt(d.montant)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0">
                      <tr className="border-t border-gray-100 bg-gray-50">
                        <td colSpan={5} className="px-3 py-2.5 font-bold text-gray-600 text-xs">
                          Total ({allDec.length} op.)
                        </td>
                        <td className="px-3 py-2.5 font-black text-red-500 text-right whitespace-nowrap tabular-nums">
                          {fmt(totalDec ?? 0)} <span className="font-normal text-gray-400">FCFA</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Print document */}
      <div id="dashboard-print" className="hidden print:block bg-white">
        <div style={{ borderBottom: '2px solid #111', paddingBottom: '8px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '-0.5px' }}>
                {societeNom || 'MA CAISSE'}
              </div>
              {caisseActive && (
                <div style={{ fontSize: '9pt', color: '#555', marginTop: '2px' }}>
                  Caisse : {caisseActive.nom}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14pt', fontWeight: 800 }}>TABLEAU DE BORD</div>
              <div style={{ fontSize: '8pt', color: '#555', marginTop: '2px' }}>
                {filterActive && dateFrom ? `Periode : ${fmtDateFull(dateFrom)}${dateTo && dateTo !== dateFrom ? ` au ${fmtDateFull(dateTo)}` : ''}` : 'Toutes les transactions actives'}
              </div>
              <div style={{ fontSize: '8pt', color: '#555', marginTop: '2px' }}>
                Imprime le {printDate}
              </div>
            </div>
          </div>
        </div>

        {/* KPI summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div style={{ border: '1.5px solid #10b981', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Encaissements</div>
            <div style={{ fontSize: '16pt', fontWeight: 900, marginTop: '4px' }}>{totalEnc === null ? '—' : fmt(totalEnc)}</div>
            <div style={{ fontSize: '8pt', color: '#555' }}>FCFA ({allEnc.length} op.)</div>
          </div>
          <div style={{ border: '1.5px solid #ef4444', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Decaissements</div>
            <div style={{ fontSize: '16pt', fontWeight: 900, marginTop: '4px' }}>{totalDec === null ? '—' : fmt(totalDec)}</div>
            <div style={{ fontSize: '8pt', color: '#555' }}>FCFA ({allDec.length} op.)</div>
          </div>
          <div style={{ border: '1.5px solid #2563eb', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '7pt', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {filterActive ? 'Solde Periode' : 'Solde Actuel'}
            </div>
            <div style={{ fontSize: '16pt', fontWeight: 900, marginTop: '4px', color: (filterActive ? (totalEnc ?? 0) - (totalDec ?? 0) : solde ?? 0) < 0 ? '#ef4444' : '#111' }}>
              {filterActive
                ? ((totalEnc ?? 0) - (totalDec ?? 0) < 0 ? '-' : '') + fmt(Math.abs((totalEnc ?? 0) - (totalDec ?? 0)))
                : solde === null ? '—' : (solde < 0 ? '-' : '') + fmt(Math.abs(solde))
              }
            </div>
            <div style={{ fontSize: '8pt', color: '#555' }}>FCFA</div>
          </div>
        </div>

        {/* Encaissements table */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <div style={{ fontSize: '11pt', fontWeight: 800, borderLeft: '3px solid #10b981', paddingLeft: '8px' }}>
              Encaissements
            </div>
            <div style={{ fontSize: '8pt', color: '#555' }}>{allEnc.length} enregistrement{allEnc.length > 1 ? 's' : ''}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Heure</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>N. Facture</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Client</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Montant (FCFA)</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Mode</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Recu</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Monnaie</th>
              </tr>
            </thead>
            <tbody>
              {allEnc.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{fmtDateFull(e.date_transaction)}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontSize: '7pt' }}>{e.heure_transaction ?? ''}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{e.numero_facture}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{e.client_nom}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{fmt(e.montant)}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{MODE_LABELS[e.mode_paiement] ?? e.mode_paiement}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{fmt(e.montant_recu)}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{fmt(e.monnaie_rendue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', borderTop: '2px solid #10b981', padding: '5px 8px', fontSize: '8pt' }}>
            <span style={{ fontWeight: 800 }}>TOTAL</span>
            <span style={{ fontWeight: 900, color: '#059669' }}>
              {fmt(allEnc.reduce((s, e) => s + e.montant, 0))} FCFA
            </span>
          </div>
        </div>

        {/* Decaissements table */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <div style={{ fontSize: '11pt', fontWeight: 800, borderLeft: '3px solid #ef4444', paddingLeft: '8px' }}>
              Decaissements
            </div>
            <div style={{ fontSize: '8pt', color: '#555' }}>{allDec.length} enregistrement{allDec.length > 1 ? 's' : ''}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>N. Piece</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>N. Compte</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Libelle</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Description</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>Montant (FCFA)</th>
              </tr>
            </thead>
            <tbody>
              {allDec.map((d, i) => (
                <tr key={d.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{fmtDateFull(d.date_transaction)}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{d.numero_piece}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{d.compte_numero}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>{d.compte_libelle}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', color: '#555' }}>{d.description}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmt(d.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', borderTop: '2px solid #ef4444', padding: '5px 8px', fontSize: '8pt' }}>
            <span style={{ fontWeight: 800 }}>TOTAL</span>
            <span style={{ fontWeight: 900, color: '#dc2626' }}>
              {fmt(allDec.reduce((s, d) => s + d.montant, 0))} FCFA
            </span>
          </div>
        </div>

        {/* Print footer */}
        <div style={{ marginTop: '20px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '7.5pt', color: '#888' }}>
          <span>{societeNom || 'MA CAISSE'} — Tableau de bord</span>
          <span>Document genere le {printDate}</span>
        </div>
      </div>
    </>
  );
}
