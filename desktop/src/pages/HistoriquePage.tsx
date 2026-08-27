import { useState, useEffect, useCallback } from 'react';
import { History, Search, ArrowDownCircle, ArrowUpCircle, Filter, X, ChevronDown, ChevronUp, Calendar, ChevronRight } from 'lucide-react';
import type { Caisse } from '../hooks/useCaisse';

const api = () => window.electronAPI;

interface Props {
  caisseActive: Caisse | null;
  caisses: Caisse[];
  userRole: string;
}

type TransactionItem =
  | { type: 'encaissement'; data: any; date: string; time: string }
  | { type: 'decaissement'; data: any; date: string; time: string };

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)); }
function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const MODE_LABELS: Record<string, string> = { especes: 'Especes', wave: 'Wave', orange_money: 'O. Money', carte: 'Carte', cheque: 'Cheque' };

export default function HistoriquePage({ caisseActive, caisses, userRole }: Props) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'encaissement' | 'decaissement'>('all');
  const [filterCaisse, setFilterCaisse] = useState<string>('current');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const targetCaisseId = filterCaisse === 'all' ? undefined : (filterCaisse === 'current' ? caisseActive?.id : filterCaisse);

    const filters = {
      caisse_id: targetCaisseId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    };

    const [encData, decData] = await Promise.all([
      filterType !== 'decaissement' ? api().encaissements.getAll(filters) : Promise.resolve([]),
      filterType !== 'encaissement' ? api().decaissements.getAll(filters) : Promise.resolve([]),
    ]);

    const items: TransactionItem[] = [];
    for (const e of encData) items.push({ type: 'encaissement', data: e, date: e.date_transaction, time: e.heure_transaction ?? '00:00' });
    for (const d of decData) items.push({ type: 'decaissement', data: d, date: d.date_transaction, time: '23:59' });
    items.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

    setTransactions(items);
    setLoading(false);
  }, [caisseActive?.id, filterType, filterCaisse, dateFrom, dateTo]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const filtered = transactions.filter(tx => {
    if (!search) return true;
    const s = search.toLowerCase();
    if (tx.type === 'encaissement') {
      return tx.data.client_nom.toLowerCase().includes(s) || tx.data.numero_facture.toLowerCase().includes(s) || String(tx.data.montant).includes(s);
    } else {
      return tx.data.compte_libelle.toLowerCase().includes(s) || tx.data.numero_piece.toLowerCase().includes(s) || String(tx.data.montant).includes(s);
    }
  });

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
              <History size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900">Historique</h1>
              <p className="text-[11px] text-gray-400">
                {dateFrom || dateTo ? `${dateFrom ? fmtDate(dateFrom) : '...'} -> ${dateTo ? fmtDate(dateTo) : '...'}` : 'Toutes les operations'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              showFilters ? 'bg-slate-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Filter size={13} /> Filtres
            {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 transition" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
                {(['all', 'encaissement', 'decaissement'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      filterType === t ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}>{t === 'all' ? 'Tout' : t === 'encaissement' ? 'Enc.' : 'Dec.'}</button>
                ))}
              </div>
              {userRole === 'admin' && caisses.length > 1 && (
                <select value={filterCaisse} onChange={e => setFilterCaisse(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none">
                  <option value="current">{caisseActive?.nom ?? 'Caisse'}</option>
                  <option value="all">Toutes</option>
                  {caisses.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Calendar size={13} className="text-gray-400" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none" />
              <ChevronRight size={12} className="text-gray-300" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition">Effacer</button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-slate-900 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History size={40} className="text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">Aucune operation trouvee</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400 font-medium px-1">{filtered.length} operation{filtered.length > 1 ? 's' : ''}</p>
            {filtered.map(tx => {
              if (tx.type === 'encaissement') {
                const e = tx.data;
                return (
                  <div key={`enc-${e.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <ArrowDownCircle size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate">{e.client_nom}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold shrink-0">
                          {MODE_LABELS[e.mode_paiement] ?? e.mode_paiement}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400 font-mono">{e.numero_facture}</span>
                        <span className="text-[10px] text-gray-300">|</span>
                        <span className="text-[11px] text-gray-400">{fmtDate(e.date_transaction)}</span>
                      </div>
                    </div>
                    <p className="text-sm font-black text-emerald-600 tabular-nums shrink-0">+{fmt(e.montant)}</p>
                  </div>
                );
              } else {
                const d = tx.data;
                return (
                  <div key={`dec-${d.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                      <ArrowUpCircle size={18} className="text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate">{d.compte_libelle}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-400 font-mono">{d.numero_piece}</span>
                        <span className="text-[10px] text-gray-300">|</span>
                        <span className="text-[11px] text-gray-400">{fmtDate(d.date_transaction)}</span>
                      </div>
                    </div>
                    <p className="text-sm font-black text-red-500 tabular-nums shrink-0">-{fmt(d.montant)}</p>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}
