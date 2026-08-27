import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Activity,
  Search, Download, Printer, RefreshCw,
  ArrowUpRight, ArrowDownRight, Calendar, BarChart3,
  ChevronRight, CreditCard, Banknote, Smartphone, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  Encaissement, Decaissement, ClotureCaisse,
  StatsGlobales, StatsCaisse, StatsMode, StatsCompte, StatsJour,
} from '../types/database';

const MODE_LABELS: Record<string, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  carte: 'Carte bancaire',
  cheque: 'Chèque',
};

const MODE_COLORS: Record<string, string> = {
  especes: '#10b981',
  wave: '#3b82f6',
  orange_money: '#f97316',
  carte: '#0ea5e9',
  cheque: '#64748b',
};

const MODE_BG: Record<string, string> = {
  especes: 'bg-emerald-100 text-emerald-700',
  wave: 'bg-blue-100 text-blue-700',
  orange_money: 'bg-orange-100 text-orange-700',
  carte: 'bg-sky-100 text-sky-700',
  cheque: 'bg-slate-100 text-slate-700',
};

const MODE_ICON: Record<string, React.ReactNode> = {
  especes: <Banknote size={12} />,
  wave: <Smartphone size={12} />,
  orange_money: <Smartphone size={12} />,
  carte: <CreditCard size={12} />,
  cheque: <Banknote size={12} />,
};

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}
function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

type Tab = 'apercu' | 'enc' | 'dec';

export default function StatistiquesPage() {
  const [tab, setTab] = useState<Tab>('apercu');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [societeNom, setSocieteNom] = useState('');

  const [globales, setGlobales] = useState<StatsGlobales | null>(null);
  const [parCaisse, setParCaisse] = useState<StatsCaisse[]>([]);
  const [parMode, setParMode] = useState<StatsMode[]>([]);
  const [parCompte, setParCompte] = useState<StatsCompte[]>([]);
  const [parJour, setParJour] = useState<StatsJour[]>([]);
  const [encaissements, setEncaissements] = useState<(Encaissement & { caisse_nom?: string })[]>([]);
  const [decaissements, setDecaissements] = useState<(Decaissement & { caisse_nom?: string })[]>([]);
  const [clotures, setClotures] = useState<(ClotureCaisse & { caisse_nom?: string })[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    const args = { p_date_from: dateFrom || null, p_date_to: dateTo || null };

    const [
      { data: g }, { data: pc }, { data: pm }, { data: pco }, { data: pj },
      { data: enc }, { data: dec }, { data: caissesData }, { data: cloturesData },
    ] = await Promise.all([
      supabase.rpc('get_stats_globales', args),
      supabase.rpc('get_stats_par_caisse', args),
      supabase.rpc('get_stats_par_mode', args),
      supabase.rpc('get_stats_par_compte', args),
      supabase.rpc('get_stats_par_jour', { p_date_from: dateFrom || null, p_date_to: dateTo || null }),
      (() => {
        let q = supabase.from('encaissements').select('*')
          .order('date_transaction', { ascending: false })
          .order('heure_transaction', { ascending: false });
        if (dateFrom) q = q.gte('date_transaction', dateFrom);
        if (dateTo) q = q.lte('date_transaction', dateTo);
        return q;
      })(),
      (() => {
        let q = supabase.from('decaissements').select('*')
          .order('date_transaction', { ascending: false })
          .order('created_at', { ascending: false });
        if (dateFrom) q = q.gte('date_transaction', dateFrom);
        if (dateTo) q = q.lte('date_transaction', dateTo);
        return q;
      })(),
      supabase.from('caisses').select('id, nom'),
      (() => {
        let q = supabase.from('clotures_caisses').select('*')
          .eq('has_individual_records', false)
          .order('date_fin', { ascending: false });
        if (dateFrom) q = q.gte('date_fin', dateFrom);
        if (dateTo) q = q.lte('date_debut', dateTo);
        return q;
      })(),
    ]);

    if (g?.[0]) setGlobales(g[0]);
    setParCaisse(pc ?? []);
    setParMode(pm ?? []);
    setParCompte(pco ?? []);
    setParJour((pj ?? []).slice(-30));

    const caissesMap: Record<string, string> = {};
    for (const c of (caissesData ?? [])) caissesMap[c.id] = c.nom;

    setEncaissements((enc ?? []).map((e: Encaissement) => ({ ...e, caisse_nom: caissesMap[e.caisse_id] ?? '' })));
    setDecaissements((dec ?? []).map((d: Decaissement) => ({ ...d, caisse_nom: caissesMap[d.caisse_id] ?? '' })));
    setClotures((cloturesData ?? []).map((c: ClotureCaisse) => ({ ...c, caisse_nom: caissesMap[c.caisse_id] ?? '' })));

    if (showRefresh) setRefreshing(false); else setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    supabase.from('societe').select('nom').maybeSingle().then(({ data }) => {
      if (data) setSocieteNom(data.nom || '');
    });
  }, []);

  const filterEnc = encaissements.filter(e => {
    const q = search.toLowerCase();
    const ms = !q || (e.client_nom || '').toLowerCase().includes(q) || (e.numero_facture || '').toLowerCase().includes(q);
    const mf = !dateFrom || e.date_transaction >= dateFrom;
    const mt = !dateTo || e.date_transaction <= dateTo;
    return ms && mf && mt;
  });

  const filterDec = decaissements.filter(d => {
    const q = search.toLowerCase();
    const ms = !q || (d.compte_libelle || '').toLowerCase().includes(q) || (d.numero_piece || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
    const mf = !dateFrom || d.date_transaction >= dateFrom;
    const mt = !dateTo || d.date_transaction <= dateTo;
    return ms && mf && mt;
  });

  const exportCSV = (type: 'enc' | 'dec') => {
    const data = type === 'enc' ? filterEnc : filterDec;
    if (!data.length) return;
    const headers = type === 'enc'
      ? ['Date', 'Heure', 'N° Facture', 'Client', 'Montant', 'Mode de paiement', 'Montant reçu', 'Monnaie rendue', 'Caisse']
      : ['Date', 'N° Pièce', 'Compte', 'Libellé', 'Description', 'Montant', 'Caisse'];
    const rows = type === 'enc'
      ? filterEnc.map(e => [e.date_transaction, e.heure_transaction, e.numero_facture, e.client_nom, e.montant, MODE_LABELS[e.mode_paiement] ?? e.mode_paiement, e.montant_recu, e.monnaie_rendue, e.caisse_nom ?? ''])
      : filterDec.map(d => [d.date_transaction, d.numero_piece, d.compte_numero, d.compte_libelle, d.description, d.montant, d.caisse_nom ?? '']);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type === 'enc' ? 'encaissements' : 'decaissements'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handlePrint = () => window.print();

  const periodLabel = dateFrom || dateTo
    ? `${dateFrom ? fmtDate(dateFrom) : '…'} → ${dateTo ? fmtDate(dateTo) : '…'}`
    : 'Toutes périodes';

  const maxEnc = parJour.length ? Math.max(...parJour.map(j => j.total_encaissements), 1) : 1;
  const maxDec = parJour.length ? Math.max(...parJour.map(j => j.total_decaissements), 1) : 1;
  const maxBar = Math.max(maxEnc, maxDec);

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Chargement des statistiques...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── PRINT LAYER ── */}
      <div id="stats-print" className="hidden print:block">
        <PrintReport
          periodLabel={periodLabel}
          globales={globales}
          parCaisse={parCaisse}
          parMode={parMode}
          parCompte={parCompte}
          parJour={parJour}
          encaissements={filterEnc}
          decaissements={filterDec}
          clotures={clotures}
          societeNom={societeNom}
        />
      </div>

      {/* ── SCREEN LAYER ── */}
      <div className="print:hidden h-[calc(100vh-56px)] bg-slate-50 flex flex-col overflow-hidden" ref={printRef}>
        {/* Sticky top section: header + filters + tabs */}
        <div className="shrink-0 bg-slate-50 px-4 pt-3 pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Statistiques</h1>
              <p className="text-slate-400 text-xs">{periodLabel}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => load(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-semibold shadow-sm transition">
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition">
                <Printer size={12} />
                <span className="hidden sm:inline">Imprimer</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
              <Calendar size={13} />
              <span className="text-xs font-semibold">Période</span>
            </div>
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
            <ChevronRight size={12} className="text-slate-300 shrink-0" />
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="text-xs text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition font-medium">
                Effacer
              </button>
            )}
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <KpiCard label="Encaissements" value={`${fmt(globales?.total_encaissements ?? 0)}`} unit="FCFA"
              sub={`${globales?.nb_encaissements ?? 0} op.`} trend="up" color="emerald" icon={<TrendingUp size={14} />} />
            <KpiCard label="Décaissements" value={`${fmt(globales?.total_decaissements ?? 0)}`} unit="FCFA"
              sub={`${globales?.nb_decaissements ?? 0} op.`} trend="down" color="red" icon={<TrendingDown size={14} />} />
            <KpiCard label="Solde net" value={`${fmt(Math.abs(globales?.solde ?? 0))}`} unit="FCFA"
              sub={(globales?.solde ?? 0) >= 0 ? 'Excédent' : 'Déficit'}
              trend={(globales?.solde ?? 0) >= 0 ? 'up' : 'down'}
              color={(globales?.solde ?? 0) >= 0 ? 'blue' : 'orange'} icon={<Wallet size={14} />} />
            <KpiCard label="Transactions" value={fmt((globales?.nb_encaissements ?? 0) + (globales?.nb_decaissements ?? 0))}
              unit="" sub="total op." color="slate" icon={<Activity size={14} />} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              ['apercu', 'Aperçu', 'slate'],
              ['enc', `Enc. (${filterEnc.length})`, 'emerald'],
              ['dec', `Déc. (${filterDec.length})`, 'red'],
            ] as [Tab, string, string][]).map(([id, label, color]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  tab === id
                    ? color === 'emerald' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                    : color === 'red' ? 'bg-red-500 text-white shadow-sm shadow-red-200'
                    : 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">

          {/* ── TAB: Aperçu ── */}
          {tab === 'apercu' && (
            <div className="space-y-6">

              {/* Evolution chart */}
              {parJour.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-slate-900">Évolution journalière</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{parJour.length} jours</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Encaissements</span>
                      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Décaissements</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-1.5 min-w-0" style={{ minWidth: `${Math.max(parJour.length * 28, 300)}px`, height: '140px' }}>
                      {parJour.map(j => (
                        <div key={j.jour} className="flex-1 flex flex-col items-center gap-0.5 group min-w-[20px]">
                          <div className="relative w-full flex flex-col justify-end gap-0.5" style={{ height: '120px' }}>
                            <div
                              className="w-full bg-red-400 rounded-t-sm transition-all duration-300 group-hover:bg-red-500"
                              style={{ height: `${(j.total_decaissements / maxBar) * 110}px`, minHeight: j.total_decaissements > 0 ? '2px' : '0' }}
                              title={`Déc: ${fmt(j.total_decaissements)} FCFA`}
                            />
                            <div
                              className="w-full bg-emerald-500 rounded-t-sm transition-all duration-300 group-hover:bg-emerald-600"
                              style={{ height: `${(j.total_encaissements / maxBar) * 110}px`, minHeight: j.total_encaissements > 0 ? '2px' : '0' }}
                              title={`Enc: ${fmt(j.total_encaissements)} FCFA`}
                            />
                          </div>
                          <span className="text-[8px] text-slate-300 rotate-45 origin-left mt-1 whitespace-nowrap">
                            {j.jour.slice(5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Two-column: modes + caisses */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Modes de paiement */}
                {parMode.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
                      <BarChart3 size={16} className="text-slate-400" />
                      Modes de paiement
                    </h3>
                    <div className="space-y-4">
                      {parMode.map(m => (
                        <div key={m.mode_paiement}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${MODE_BG[m.mode_paiement] ?? 'bg-slate-100 text-slate-600'}`}>
                                {MODE_ICON[m.mode_paiement]}
                                {MODE_LABELS[m.mode_paiement] ?? m.mode_paiement}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <span className="text-xs text-slate-400">{m.nb} op.</span>
                              <span className="font-bold text-slate-900 text-sm">{fmt(m.total)}</span>
                              <span className="text-xs font-semibold text-slate-400 w-9 text-right">{m.pourcentage.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all duration-700"
                              style={{ width: `${m.pourcentage}%`, backgroundColor: MODE_COLORS[m.mode_paiement] ?? '#94a3b8' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Par caisse */}
                {parCaisse.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-5">Par caisse</h3>
                    <div className="space-y-3">
                      {parCaisse.map(c => (
                        <div key={c.caisse_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition">
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{c.caisse_nom}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5">
                                <ArrowUpRight size={11} />{fmt(c.total_encaissements)}
                              </span>
                              <span className="text-xs text-red-500 font-semibold flex items-center gap-0.5">
                                <ArrowDownRight size={11} />{fmt(c.total_decaissements)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-black text-base ${c.solde >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                              {c.solde >= 0 ? '+' : ''}{fmt(c.solde)}
                            </div>
                            <div className="text-xs text-slate-400">{c.nb_encaissements + c.nb_decaissements} op.</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Comptes de charge */}
              {parCompte.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Dépenses par compte de charge</h3>
                    <span className="text-xs text-slate-400">{parCompte.length} comptes</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {parCompte.map((c, i) => {
                      const maxTotal = parCompte[0]?.total ?? 1;
                      const pct = (c.total / maxTotal) * 100;
                      return (
                        <div key={c.compte_numero} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition">
                          <span className="text-xs font-bold text-slate-300 w-5 shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-400 shrink-0">{c.compte_numero}</span>
                              <span className="text-sm font-semibold text-slate-800 truncate">{c.compte_libelle}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1 mt-1.5">
                              <div className="h-1 rounded-full bg-red-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-red-600 text-sm">{fmt(c.total)} <span className="font-normal text-xs text-slate-400">FCFA</span></div>
                            <div className="text-xs text-slate-400">{c.nb} op.</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary table par caisse full */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50">
                  <h3 className="font-bold text-slate-900">Tableau récapitulatif par caisse</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Caisse', 'Total Encaissements', 'Nb Enc.', 'Total Décaissements', 'Nb Déc.', 'Solde'].map(h => (
                          <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {parCaisse.map(c => (
                        <tr key={c.caisse_id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-3.5 font-bold text-slate-900">{c.caisse_nom}</td>
                          <td className="px-5 py-3.5 font-semibold text-emerald-700">{fmt(c.total_encaissements)} <span className="text-xs font-normal text-slate-400">FCFA</span></td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs">{c.nb_encaissements}</td>
                          <td className="px-5 py-3.5 font-semibold text-red-600">{fmt(c.total_decaissements)} <span className="text-xs font-normal text-slate-400">FCFA</span></td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs">{c.nb_decaissements}</td>
                          <td className={`px-5 py-3.5 font-black ${c.solde >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {c.solde >= 0 ? '+' : ''}{fmt(c.solde)} <span className="text-xs font-normal text-slate-400">FCFA</span>
                          </td>
                        </tr>
                      ))}
                      {parCaisse.length > 1 && (
                        <tr className="bg-slate-900">
                          <td className="px-5 py-3.5 font-black text-white text-xs uppercase tracking-wider">Total</td>
                          <td className="px-5 py-3.5 font-black text-emerald-400">{fmt(globales?.total_encaissements ?? 0)} <span className="text-xs font-normal text-slate-400">FCFA</span></td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs">{globales?.nb_encaissements}</td>
                          <td className="px-5 py-3.5 font-black text-red-400">{fmt(globales?.total_decaissements ?? 0)} <span className="text-xs font-normal text-slate-400">FCFA</span></td>
                          <td className="px-5 py-3.5 text-slate-400 text-xs">{globales?.nb_decaissements}</td>
                          <td className={`px-5 py-3.5 font-black ${(globales?.solde ?? 0) >= 0 ? 'text-sky-400' : 'text-orange-400'}`}>
                            {(globales?.solde ?? 0) >= 0 ? '+' : ''}{fmt(globales?.solde ?? 0)} <span className="text-xs font-normal text-slate-400">FCFA</span>
                          </td>
                        </tr>
                      )}
                      {!parCaisse.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">Aucune donnée</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Encaissements ── */}
          {tab === 'enc' && (
            <div className="space-y-4">
              {/* Cloture summaries when individual records are gone */}
              {clotures.length > 0 && clotures.some(c => c.nb_encaissements > 0) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-xs font-semibold text-amber-800">Encaissements des clotures precedentes (detail individuel supprime)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['Periode', 'Caisse', 'Nb operations', 'Total', 'Fond de caisse', 'Solde cloture'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {clotures.filter(c => c.nb_encaissements > 0).map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}</td>
                            <td className="px-4 py-3 text-slate-700 font-semibold text-xs">{c.caisse_nom}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs text-center">{c.nb_encaissements}</td>
                            <td className="px-4 py-3 font-bold text-emerald-700 text-xs whitespace-nowrap">{fmt(c.total_encaissements)} FCFA</td>
                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmt(c.fond_de_caisse)} FCFA</td>
                            <td className="px-4 py-3 font-bold text-blue-700 text-xs whitespace-nowrap">{fmt(c.solde)} FCFA</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900">
                          <td colSpan={2} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Total clotures</td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-300 text-center">{clotures.reduce((s, c) => s + c.nb_encaissements, 0)}</td>
                          <td className="px-4 py-3 font-black text-emerald-400 text-xs whitespace-nowrap">{fmt(clotures.reduce((s, c) => s + c.total_encaissements, 0))} FCFA</td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Client, numero de facture..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <span className="font-bold text-emerald-700">{fmt(filterEnc.reduce((s, e) => s + e.montant, 0))}</span>
                  <span className="text-emerald-600">FCFA</span>
                </div>
                <button onClick={() => exportCSV('enc')} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {filterEnc.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <EncTable data={filterEnc} />
                </div>
              )}
              {filterEnc.length === 0 && clotures.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-16 text-center">
                  <TrendingUp size={32} className="text-slate-200 mx-auto mb-3" />
                  <div className="text-slate-400 text-sm">Aucun encaissement trouve</div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Decaissements ── */}
          {tab === 'dec' && (
            <div className="space-y-4">
              {/* Cloture summaries when individual records are gone */}
              {clotures.length > 0 && clotures.some(c => c.nb_decaissements > 0) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-xs font-semibold text-amber-800">Decaissements des clotures precedentes (detail individuel supprime)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['Periode', 'Caisse', 'Nb operations', 'Total', 'Fond de caisse', 'Solde cloture'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {clotures.filter(c => c.nb_decaissements > 0).map(c => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}</td>
                            <td className="px-4 py-3 text-slate-700 font-semibold text-xs">{c.caisse_nom}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs text-center">{c.nb_decaissements}</td>
                            <td className="px-4 py-3 font-bold text-red-600 text-xs whitespace-nowrap">{fmt(c.total_decaissements)} FCFA</td>
                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmt(c.fond_de_caisse)} FCFA</td>
                            <td className="px-4 py-3 font-bold text-blue-700 text-xs whitespace-nowrap">{fmt(c.solde)} FCFA</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900">
                          <td colSpan={2} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Total clotures</td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-300 text-center">{clotures.reduce((s, c) => s + c.nb_decaissements, 0)}</td>
                          <td className="px-4 py-3 font-black text-red-400 text-xs whitespace-nowrap">{fmt(clotures.reduce((s, c) => s + c.total_decaissements, 0))} FCFA</td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Libelle, numero de piece..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-sm px-3 py-2.5 bg-red-50 rounded-xl border border-red-100">
                  <TrendingDown size={14} className="text-red-600" />
                  <span className="font-bold text-red-700">{fmt(filterDec.reduce((s, d) => s + d.montant, 0))}</span>
                  <span className="text-red-600">FCFA</span>
                </div>
                <button onClick={() => exportCSV('dec')} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm">
                  <Download size={14} /> Export CSV
                </button>
              </div>

              {filterDec.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <DecTable data={filterDec} />
                </div>
              )}
              {filterDec.length === 0 && clotures.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-16 text-center">
                  <TrendingDown size={32} className="text-slate-200 mx-auto mb-3" />
                  <div className="text-slate-400 text-sm">Aucun decaissement trouve</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──

function KpiCard({ label, value, unit, sub, color, icon, trend }: {
  label: string; value: string; unit: string; sub: string;
  color: string; icon: React.ReactNode; trend?: 'up' | 'down';
}) {
  const schemes: Record<string, { bg: string; icon: string; val: string }> = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
    red:     { bg: 'bg-red-50',     icon: 'text-red-500',     val: 'text-red-700' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    val: 'text-blue-700' },
    orange:  { bg: 'bg-orange-50',  icon: 'text-orange-500',  val: 'text-orange-700' },
    slate:   { bg: 'bg-slate-100',  icon: 'text-slate-500',   val: 'text-slate-800' },
  };
  const s = schemes[color] ?? schemes.slate;
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.bg} ${s.icon}`}>{icon}</div>
        {trend && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          </span>
        )}
      </div>
      <div className={`text-base font-black leading-tight ${s.val}`}>{value}</div>
      {unit && <div className="text-[10px] font-semibold text-slate-400">{unit}</div>}
      <div className="text-[10px] text-slate-400 mt-1 font-medium">{label}</div>
      <div className="text-[10px] text-slate-300">{sub}</div>
    </div>
  );
}

function EncTable({ data }: { data: (Encaissement & { caisse_nom?: string })[] }) {
  if (!data.length) return (
    <div className="p-16 text-center">
      <TrendingUp size={32} className="text-slate-200 mx-auto mb-3" />
      <div className="text-slate-400 text-sm">Aucun encaissement trouvé</div>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            {['Date', 'Heure', 'N° Facture', 'Client', 'Montant', 'Mode', 'Reçu', 'Monnaie', 'Caisse'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map(e => (
            <tr key={e.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{fmtDate(e.date_transaction)}</td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{e.heure_transaction}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{e.numero_facture}</td>
              <td className="px-4 py-3 font-semibold text-slate-900 max-w-[140px] truncate">{e.client_nom}</td>
              <td className="px-4 py-3 font-bold text-emerald-700 whitespace-nowrap">{new Intl.NumberFormat('fr-FR').format(e.montant)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-md text-xs font-semibold ${MODE_BG[e.mode_paiement] ?? 'bg-slate-100 text-slate-600'}`}>
                  {MODE_ICON[e.mode_paiement]}
                  {MODE_LABELS[e.mode_paiement] ?? e.mode_paiement}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Intl.NumberFormat('fr-FR').format(e.montant_recu)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {e.monnaie_rendue > 0
                  ? <span className="font-semibold text-blue-600 text-xs">{new Intl.NumberFormat('fr-FR').format(e.monnaie_rendue)}</span>
                  : <span className="text-slate-300 text-xs">—</span>
                }
              </td>
              <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{e.caisse_nom}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900">
            <td colSpan={4} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Total ({data.length} lignes)</td>
            <td className="px-4 py-3 font-black text-emerald-400 whitespace-nowrap">{fmt(data.reduce((s, e) => s + e.montant, 0))}</td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DecTable({ data }: { data: (Decaissement & { caisse_nom?: string })[] }) {
  if (!data.length) return (
    <div className="p-16 text-center">
      <TrendingDown size={32} className="text-slate-200 mx-auto mb-3" />
      <div className="text-slate-400 text-sm">Aucun décaissement trouvé</div>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            {['Date', 'N° Pièce', 'Compte', 'Libellé', 'Description', 'Montant', 'Caisse'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map(d => (
            <tr key={d.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{fmtDate(d.date_transaction)}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{d.numero_piece}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{d.compte_numero}</td>
              <td className="px-4 py-3 font-semibold text-slate-900 max-w-[160px] truncate">{d.compte_libelle}</td>
              <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate">{d.description || '—'}</td>
              <td className="px-4 py-3 font-bold text-red-600 whitespace-nowrap">{new Intl.NumberFormat('fr-FR').format(d.montant)}</td>
              <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{d.caisse_nom}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-900">
            <td colSpan={5} className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Total ({data.length} lignes)</td>
            <td className="px-4 py-3 font-black text-red-400 whitespace-nowrap">{fmt(data.reduce((s, d) => s + d.montant, 0))}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Print Report ──
function PrintReport({
  periodLabel, globales, parCaisse, parMode, parCompte, parJour, encaissements, decaissements, clotures, societeNom,
}: {
  periodLabel: string;
  globales: StatsGlobales | null;
  parCaisse: StatsCaisse[];
  parMode: StatsMode[];
  parCompte: StatsCompte[];
  parJour: StatsJour[];
  encaissements: (Encaissement & { caisse_nom?: string })[];
  decaissements: (Decaissement & { caisse_nom?: string })[];
  clotures: (ClotureCaisse & { caisse_nom?: string })[];
  societeNom: string;
}) {
  const now = new Date().toLocaleString('fr-FR');
  const hasClotureEnc = clotures.some(c => c.nb_encaissements > 0);
  const hasCloturesDec = clotures.some(c => c.nb_decaissements > 0);

  return (
    <div className="p-8 font-sans text-sm text-slate-900 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">RAPPORT STATISTIQUES</h1>
          <p className="text-slate-500 mt-1">Période : {periodLabel}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>Imprimé le</div>
          <div className="font-semibold text-slate-600">{now}</div>
        </div>
      </div>

      {/* Archived data notice */}
      {(hasClotureEnc || hasCloturesDec) && (
        <div className="mb-6 border border-amber-300 bg-amber-50 rounded-lg px-4 py-3">
          <div className="font-bold text-amber-800 text-xs uppercase tracking-wide mb-1">Donnees partiellement archivees</div>
          <p className="text-amber-700 text-xs">
            Certaines transactions ont ete supprimees lors d'anciennes clotures de caisse.
            Les totaux sont inclus via les fiches de cloture ci-dessous.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Encaissements', val: `${fmt(globales?.total_encaissements ?? 0)} FCFA`, sub: `${globales?.nb_encaissements ?? 0} opérations` },
          { label: 'Total Décaissements', val: `${fmt(globales?.total_decaissements ?? 0)} FCFA`, sub: `${globales?.nb_decaissements ?? 0} opérations` },
          { label: 'Solde Net', val: `${fmt(globales?.solde ?? 0)} FCFA`, sub: (globales?.solde ?? 0) >= 0 ? 'Excédent' : 'Déficit' },
          { label: 'Total Transactions', val: `${(globales?.nb_encaissements ?? 0) + (globales?.nb_decaissements ?? 0)}`, sub: 'opérations' },
        ].map(k => (
          <div key={k.label} className="border border-slate-200 rounded-lg p-3">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{k.label}</div>
            <div className="font-black text-lg mt-1">{k.val}</div>
            <div className="text-xs text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Par caisse */}
      {parCaisse.length > 0 && (
        <div className="mb-8">
          <h2 className="font-black text-base uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">Récapitulatif par caisse</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {['Caisse', 'Encaissements', 'Nb', 'Décaissements', 'Nb', 'Solde'].map(h => (
                  <th key={h} className="border border-slate-200 px-3 py-2 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parCaisse.map(c => (
                <tr key={c.caisse_id}>
                  <td className="border border-slate-200 px-3 py-2 font-semibold">{c.caisse_nom}</td>
                  <td className="border border-slate-200 px-3 py-2">{fmt(c.total_encaissements)} FCFA</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{c.nb_encaissements}</td>
                  <td className="border border-slate-200 px-3 py-2">{fmt(c.total_decaissements)} FCFA</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{c.nb_decaissements}</td>
                  <td className="border border-slate-200 px-3 py-2 font-bold">{fmt(c.solde)} FCFA</td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white">
                <td className="border border-slate-700 px-3 py-2 font-black">TOTAL</td>
                <td className="border border-slate-700 px-3 py-2 font-bold">{fmt(globales?.total_encaissements ?? 0)} FCFA</td>
                <td className="border border-slate-700 px-3 py-2 text-center">{globales?.nb_encaissements}</td>
                <td className="border border-slate-700 px-3 py-2 font-bold">{fmt(globales?.total_decaissements ?? 0)} FCFA</td>
                <td className="border border-slate-700 px-3 py-2 text-center">{globales?.nb_decaissements}</td>
                <td className="border border-slate-700 px-3 py-2 font-bold">{fmt(globales?.solde ?? 0)} FCFA</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Modes de paiement */}
      <div className="mb-8">
        <h2 className="font-black text-base uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">Encaissements par mode de paiement</h2>
        {parMode.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {['Mode', 'Montant total', 'Nb opérations', '% du total'].map(h => (
                  <th key={h} className="border border-slate-200 px-3 py-2 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parMode.map(m => (
                <tr key={m.mode_paiement}>
                  <td className="border border-slate-200 px-3 py-2 font-semibold">{MODE_LABELS[m.mode_paiement] ?? m.mode_paiement}</td>
                  <td className="border border-slate-200 px-3 py-2">{fmt(m.total)} FCFA</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{m.nb}</td>
                  <td className="border border-slate-200 px-3 py-2">{m.pourcentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : parMode.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Aucune donnee pour cette periode.</p>
        ) : null}
      </div>

      {/* Comptes de charge */}
      <div className="mb-8">
        <h2 className="font-black text-base uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">Dépenses par compte de charge</h2>
        {parCompte.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {['N° Compte', 'Libellé', 'Montant total', 'Nb opérations'].map(h => (
                  <th key={h} className="border border-slate-200 px-3 py-2 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parCompte.map(c => (
                <tr key={c.compte_numero}>
                  <td className="border border-slate-200 px-3 py-2 font-mono">{c.compte_numero}</td>
                  <td className="border border-slate-200 px-3 py-2">{c.compte_libelle}</td>
                  <td className="border border-slate-200 px-3 py-2 font-bold">{fmt(c.total)} FCFA</td>
                  <td className="border border-slate-200 px-3 py-2 text-center">{c.nb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : parCompte.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Aucune depense pour cette periode.</p>
        ) : null}
      </div>

      {/* Evolution journalière */}
      {parJour.length > 0 && (
        <div className="mb-8">
          <h2 className="font-black text-base uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">Évolution journalière</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {['Date', 'Encaissements', 'Décaissements', 'Solde du jour'].map(h => (
                  <th key={h} className="border border-slate-200 px-3 py-2 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parJour.map(j => (
                <tr key={j.jour}>
                  <td className="border border-slate-200 px-3 py-2 font-mono">{fmtDate(j.jour)}</td>
                  <td className="border border-slate-200 px-3 py-2">{fmt(j.total_encaissements)} FCFA</td>
                  <td className="border border-slate-200 px-3 py-2">{fmt(j.total_decaissements)} FCFA</td>
                  <td className="border border-slate-200 px-3 py-2 font-bold">{fmt(j.solde_jour)} FCFA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Page break */}
      <div style={{ pageBreakBefore: 'always' }} />

      {/* Détail encaissements */}
      <div className="mb-8">
        <h2 className="font-black text-base uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
          Detail des encaissements
          {encaissements.length > 0 && ` (${encaissements.length} lignes — ${fmt(encaissements.reduce((s, e) => s + e.montant, 0))} FCFA)`}
        </h2>
        {encaissements.length > 0 && (
          <table className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr className="bg-slate-100">
                {['Date', 'N. Facture', 'Client', 'Montant', 'Mode', 'Recu', 'Monnaie', 'Caisse'].map(h => (
                  <th key={h} className="border border-slate-200 px-2 py-2 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {encaissements.map(e => (
                <tr key={e.id}>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono">{fmtDate(e.date_transaction)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono">{e.numero_facture}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{e.client_nom}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-bold">{fmt(e.montant)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{MODE_LABELS[e.mode_paiement] ?? e.mode_paiement}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{fmt(e.montant_recu)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{fmt(e.monnaie_rendue)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{e.caisse_nom}</td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white">
                <td colSpan={3} className="border border-slate-700 px-2 py-2 font-black">TOTAL</td>
                <td className="border border-slate-700 px-2 py-2 font-black">{fmt(encaissements.reduce((s, e) => s + e.montant, 0))} FCFA</td>
                <td colSpan={4} className="border border-slate-700" />
              </tr>
            </tbody>
          </table>
        )}
        {hasClotureEnc && (
          <>
            <h3 className="font-bold text-xs text-amber-800 uppercase mb-2">Encaissements des clotures precedentes</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50">
                  {['Periode', 'Caisse', 'Nb operations', 'Total encaissements', 'Solde cloture'].map(h => (
                    <th key={h} className="border border-slate-200 px-2 py-2 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clotures.filter(c => c.nb_encaissements > 0).map(c => (
                  <tr key={c.id}>
                    <td className="border border-slate-200 px-2 py-1.5 font-mono">{fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">{c.caisse_nom}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center">{c.nb_encaissements}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-bold">{fmt(c.total_encaissements)} FCFA</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-bold">{fmt(c.solde)} FCFA</td>
                  </tr>
                ))}
                <tr className="bg-slate-800 text-white">
                  <td colSpan={2} className="border border-slate-700 px-2 py-2 font-black">TOTAL CLOTURES</td>
                  <td className="border border-slate-700 px-2 py-2 text-center font-bold">{clotures.reduce((s, c) => s + c.nb_encaissements, 0)}</td>
                  <td className="border border-slate-700 px-2 py-2 font-bold">{fmt(clotures.reduce((s, c) => s + c.total_encaissements, 0))} FCFA</td>
                  <td className="border border-slate-700" />
                </tr>
              </tbody>
            </table>
          </>
        )}
        {encaissements.length === 0 && !hasClotureEnc && (
          <p className="text-xs text-slate-400 italic">Aucun encaissement pour cette periode.</p>
        )}
      </div>

      {/* Détail décaissements */}
      <div className="mb-8">
        <h2 className="font-black text-base uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
          Detail des decaissements
          {decaissements.length > 0 && ` (${decaissements.length} lignes — ${fmt(decaissements.reduce((s, d) => s + d.montant, 0))} FCFA)`}
        </h2>
        {decaissements.length > 0 && (
          <table className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr className="bg-slate-100">
                {['Date', 'N. Piece', 'Compte', 'Libelle', 'Description', 'Montant', 'Caisse'].map(h => (
                  <th key={h} className="border border-slate-200 px-2 py-2 text-left font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decaissements.map(d => (
                <tr key={d.id}>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono">{fmtDate(d.date_transaction)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono">{d.numero_piece}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-mono">{d.compte_numero}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{d.compte_libelle}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{d.description}</td>
                  <td className="border border-slate-200 px-2 py-1.5 font-bold">{fmt(d.montant)}</td>
                  <td className="border border-slate-200 px-2 py-1.5">{d.caisse_nom}</td>
                </tr>
              ))}
              <tr className="bg-slate-900 text-white">
                <td colSpan={5} className="border border-slate-700 px-2 py-2 font-black">TOTAL</td>
                <td className="border border-slate-700 px-2 py-2 font-black">{fmt(decaissements.reduce((s, d) => s + d.montant, 0))} FCFA</td>
                <td className="border border-slate-700" />
              </tr>
            </tbody>
          </table>
        )}
        {hasCloturesDec && (
          <>
            <h3 className="font-bold text-xs text-amber-800 uppercase mb-2">Decaissements des clotures precedentes</h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-amber-50">
                  {['Periode', 'Caisse', 'Nb operations', 'Total decaissements', 'Solde cloture'].map(h => (
                    <th key={h} className="border border-slate-200 px-2 py-2 text-left font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clotures.filter(c => c.nb_decaissements > 0).map(c => (
                  <tr key={c.id}>
                    <td className="border border-slate-200 px-2 py-1.5 font-mono">{fmtDate(c.date_debut)} → {fmtDate(c.date_fin)}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-semibold">{c.caisse_nom}</td>
                    <td className="border border-slate-200 px-2 py-1.5 text-center">{c.nb_decaissements}</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-bold">{fmt(c.total_decaissements)} FCFA</td>
                    <td className="border border-slate-200 px-2 py-1.5 font-bold">{fmt(c.solde)} FCFA</td>
                  </tr>
                ))}
                <tr className="bg-slate-800 text-white">
                  <td colSpan={2} className="border border-slate-700 px-2 py-2 font-black">TOTAL CLOTURES</td>
                  <td className="border border-slate-700 px-2 py-2 text-center font-bold">{clotures.reduce((s, c) => s + c.nb_decaissements, 0)}</td>
                  <td className="border border-slate-700 px-2 py-2 font-bold">{fmt(clotures.reduce((s, c) => s + c.total_decaissements, 0))} FCFA</td>
                  <td className="border border-slate-700" />
                </tr>
              </tbody>
            </table>
          </>
        )}
        {decaissements.length === 0 && !hasCloturesDec && (
          <p className="text-xs text-slate-400 italic">Aucun decaissement pour cette periode.</p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-4 mt-8 text-xs text-slate-400 flex justify-between">
        <span>{societeNom || 'Ma Caisse'} — Rapport généré automatiquement</span>
        <span>{now}</span>
      </div>
    </div>
  );
}
