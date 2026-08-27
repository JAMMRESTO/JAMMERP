import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

const api = () => window.electronAPI;

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)); }

export default function StatistiquesPage() {
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState<any>(null);
  const [parCaisse, setParCaisse] = useState<any[]>([]);
  const [parMode, setParMode] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [g, c, m] = await Promise.all([
      api().stats.globales(dateFrom, dateTo),
      api().stats.parCaisse(dateFrom, dateTo),
      api().stats.parMode(dateFrom, dateTo),
    ]);
    setStats(g);
    setParCaisse(c);
    setParMode(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
            <BarChart3 size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-black text-gray-900">Statistiques</h1>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none" />
          <span className="text-gray-300">-</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="py-1.5 px-2 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-slate-900 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Encaissements</p>
                <p className="text-lg font-black text-emerald-600 mt-1">{fmt(stats.total_encaissements)} FCFA</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{stats.nb_encaissements} operations</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Decaissements</p>
                <p className="text-lg font-black text-red-500 mt-1">{fmt(stats.total_decaissements)} FCFA</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{stats.nb_decaissements} operations</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Solde</p>
                <p className="text-lg font-black text-gray-900 mt-1">{fmt(stats.solde)} FCFA</p>
              </div>
            </div>
          )}

          {parCaisse.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Par caisse</h3>
              <div className="space-y-2">
                {parCaisse.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-sm font-semibold text-gray-700">{c.nom}</span>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600">+{fmt(c.total_encaissements)}</span>
                      <span className="text-xs text-gray-300 mx-1">|</span>
                      <span className="text-xs font-bold text-red-500">-{fmt(c.total_decaissements)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parMode.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Par mode de paiement</h3>
              <div className="space-y-2">
                {parMode.map((m: any) => (
                  <div key={m.mode_paiement} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-sm font-semibold text-gray-700 capitalize">{m.mode_paiement.replace('_', ' ')}</span>
                    <span className="text-xs font-bold text-gray-900">{fmt(m.total)} FCFA ({m.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
