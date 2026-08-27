import { useState, useEffect, useCallback } from 'react';
import { History, Search, Printer, ArrowDownCircle, ArrowUpCircle, Filter, X, ChevronDown, ChevronUp, Calendar, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import TicketEncaissement from '../components/TicketEncaissement';
import RecuDecaissement from '../components/RecuDecaissement';
import type { Caisse, Societe, Encaissement, Decaissement } from '../types/database';

interface Props {
  caisseActive: Caisse | null;
  caisses: Caisse[];
  userRole: string;
}

type TransactionItem =
  | { type: 'encaissement'; data: Encaissement; date: string; time: string }
  | { type: 'decaissement'; data: Decaissement; date: string; time: string };

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const MODE_LABELS: Record<string, string> = {
  especes: 'Especes',
  wave: 'Wave',
  orange_money: 'O. Money',
  carte: 'Carte',
  cheque: 'Cheque',
};

export default function HistoriquePage({ caisseActive, caisses, userRole }: Props) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'encaissement' | 'decaissement'>('all');
  const [filterCaisse, setFilterCaisse] = useState<string>(() => userRole === 'admin' ? 'all' : 'current');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [societe, setSociete] = useState<Societe | null>(null);

  // Reprint state
  const [reprintEnc, setReprintEnc] = useState<Encaissement | null>(null);
  const [reprintDec, setReprintDec] = useState<Decaissement | null>(null);
  const [reprintCaisse, setReprintCaisse] = useState<Caisse | null>(null);

  useEffect(() => {
    supabase.from('societe').select('*').maybeSingle().then(({ data }) => {
      if (data) setSociete(data as Societe);
    });
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const targetCaisseId = filterCaisse === 'all' ? null : (filterCaisse === 'current' ? caisseActive?.id : filterCaisse);

    let encQuery = supabase
      .from('encaissements')
      .select('*')
      .order('date_transaction', { ascending: false })
      .order('heure_transaction', { ascending: false })
      .limit(500);
    if (targetCaisseId) encQuery = encQuery.eq('caisse_id', targetCaisseId);
    if (dateFrom) encQuery = encQuery.gte('date_transaction', dateFrom);
    if (dateTo) encQuery = encQuery.lte('date_transaction', dateTo);

    let decQuery = supabase
      .from('decaissements')
      .select('*')
      .order('date_transaction', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);
    if (targetCaisseId) decQuery = decQuery.eq('caisse_id', targetCaisseId);
    if (dateFrom) decQuery = decQuery.gte('date_transaction', dateFrom);
    if (dateTo) decQuery = decQuery.lte('date_transaction', dateTo);

    const [encRes, decRes] = await Promise.all([
      filterType !== 'decaissement' ? encQuery : Promise.resolve({ data: [] as Encaissement[] }),
      filterType !== 'encaissement' ? decQuery : Promise.resolve({ data: [] as Decaissement[] }),
    ]);

    const items: TransactionItem[] = [];

    for (const e of (encRes.data ?? []) as Encaissement[]) {
      items.push({ type: 'encaissement', data: e, date: e.date_transaction, time: e.heure_transaction ?? '00:00' });
    }
    for (const d of (decRes.data ?? []) as Decaissement[]) {
      items.push({ type: 'decaissement', data: d, date: d.date_transaction, time: '23:59' });
    }

    items.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.time.localeCompare(a.time);
    });

    setTransactions(items);
    setLoading(false);
  }, [caisseActive?.id, filterType, filterCaisse, dateFrom, dateTo]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const filtered = transactions.filter(tx => {
    if (!search) return true;
    const s = search.toLowerCase();
    if (tx.type === 'encaissement') {
      const e = tx.data as Encaissement;
      return e.client_nom.toLowerCase().includes(s)
        || e.numero_facture.toLowerCase().includes(s)
        || String(e.montant).includes(s);
    } else {
      const d = tx.data as Decaissement;
      return d.compte_libelle.toLowerCase().includes(s)
        || d.numero_piece.toLowerCase().includes(s)
        || d.description?.toLowerCase().includes(s)
        || String(d.montant).includes(s);
    }
  });

  const getCaisseForTransaction = (caisseId: string): Caisse | null => {
    return caisses.find(c => c.id === caisseId) ?? caisseActive;
  };

  const handleReprintEnc = (enc: Encaissement) => {
    setReprintCaisse(getCaisseForTransaction(enc.caisse_id));
    setReprintEnc(enc);
  };

  const handleReprintDec = (dec: Decaissement) => {
    setReprintCaisse(getCaisseForTransaction(dec.caisse_id));
    setReprintDec(dec);
  };

  return (
    <>
      <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
                <History size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-gray-900">Historique</h1>
                <p className="text-[11px] text-gray-400">
                  {dateFrom || dateTo
                    ? `${dateFrom ? fmtDate(dateFrom) : '…'} → ${dateTo ? fmtDate(dateTo) : '…'}`
                    : 'Toutes les operations'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                showFilters ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={13} />
              Filtres
              {(dateFrom || dateTo || filterType !== 'all') && !showFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
              {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, numero, montant..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-2 space-y-2">
              {/* Type + caisse */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
                  {(['all', 'encaissement', 'decaissement'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        filterType === t ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t === 'all' ? 'Tout' : t === 'encaissement' ? 'Encaissements' : 'Decaissements'}
                    </button>
                  ))}
                </div>

                {userRole === 'admin' && caisses.length > 1 && (
                  <select
                    value={filterCaisse}
                    onChange={e => setFilterCaisse(e.target.value)}
                    className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="current">{caisseActive?.nom ?? 'Caisse active'}</option>
                    <option value="all">Toutes les caisses</option>
                    {caisses.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date range */}
              <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                <Calendar size={13} className="text-gray-400 shrink-0" />
                <span className="text-xs font-semibold text-gray-500 shrink-0">Période</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
                <ChevronRight size={12} className="text-gray-300 shrink-0" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition font-medium"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Active period badge */}
          {(dateFrom || dateTo) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 rounded-xl px-3 py-1.5 w-fit">
              <Calendar size={11} className="text-slate-400" />
              <span>
                {dateFrom ? fmtDate(dateFrom) : '…'} → {dateTo ? fmtDate(dateTo) : '…'}
              </span>
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="ml-1 text-slate-400 hover:text-red-500 transition"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-slate-900 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History size={40} className="text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-400">Aucune operation trouvee</p>
              {search && <p className="text-xs text-gray-300 mt-1">Essayez avec un autre terme de recherche</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400 font-medium px-1">
                {filtered.length} operation{filtered.length > 1 ? 's' : ''}
              </p>
              {filtered.map(tx => {
                if (tx.type === 'encaissement') {
                  const e = tx.data as Encaissement;
                  return (
                    <div key={`enc-${e.id}`} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 ${e.archived ? 'border-slate-200 opacity-75' : 'border-gray-100'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${e.archived ? 'bg-slate-100' : 'bg-emerald-100'}`}>
                        <ArrowDownCircle size={18} className={e.archived ? 'text-slate-400' : 'text-emerald-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 truncate">{e.client_nom}</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold shrink-0">
                            {MODE_LABELS[e.mode_paiement] ?? e.mode_paiement}
                          </span>
                          {e.archived && (
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold shrink-0">Archivé</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400 font-mono">{e.numero_facture}</span>
                          <span className="text-[10px] text-gray-300">|</span>
                          <span className="text-[11px] text-gray-400">{fmtDate(e.date_transaction)}</span>
                          {e.heure_transaction && (
                            <>
                              <span className="text-[10px] text-gray-300">|</span>
                              <span className="text-[11px] text-gray-400">{e.heure_transaction.slice(0, 5)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-emerald-600 tabular-nums">+{fmt(e.montant)}</p>
                        <button
                          onClick={() => handleReprintEnc(e)}
                          className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-gray-700 transition"
                        >
                          <Printer size={11} />
                          Reimprimer
                        </button>
                      </div>
                    </div>
                  );
                } else {
                  const d = tx.data as Decaissement;
                  return (
                    <div key={`dec-${d.id}`} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 ${d.archived ? 'border-slate-200 opacity-75' : 'border-gray-100'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${d.archived ? 'bg-slate-100' : 'bg-red-100'}`}>
                        <ArrowUpCircle size={18} className={d.archived ? 'text-slate-400' : 'text-red-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 truncate">{d.compte_libelle}</span>
                          {d.archived && (
                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold shrink-0">Archivé</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400 font-mono">{d.numero_piece}</span>
                          <span className="text-[10px] text-gray-300">|</span>
                          <span className="text-[11px] text-gray-400">{fmtDate(d.date_transaction)}</span>
                          {d.description && (
                            <>
                              <span className="text-[10px] text-gray-300">|</span>
                              <span className="text-[11px] text-gray-400 truncate max-w-[80px]">{d.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-red-500 tabular-nums">-{fmt(d.montant)}</p>
                        <button
                          onClick={() => handleReprintDec(d)}
                          className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-gray-700 transition"
                        >
                          <Printer size={11} />
                          Reimprimer
                        </button>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reprint modals */}
      {reprintEnc && (
        <TicketEncaissement
          encaissement={reprintEnc}
          caisse={reprintCaisse}
          societe={societe}
          onClose={() => setReprintEnc(null)}
          onNew={() => setReprintEnc(null)}
        />
      )}
      {reprintDec && (
        <RecuDecaissement
          decaissement={reprintDec}
          caisse={reprintCaisse}
          societe={societe}
          onClose={() => setReprintDec(null)}
          onNew={() => setReprintDec(null)}
        />
      )}
    </>
  );
}
