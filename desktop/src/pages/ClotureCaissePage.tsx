import { useState, useEffect } from 'react';
import { Lock, CheckCircle } from 'lucide-react';
import type { Caisse } from '../hooks/useCaisse';

const api = () => window.electronAPI;

interface Props {
  caisseActive: Caisse | null;
  userId: string;
  userRole: string;
}

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)); }

export default function ClotureCaissePage({ caisseActive, userId, userRole }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [clotures, setClotures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!caisseActive) return;
    loadData();
  }, [caisseActive]);

  const loadData = async () => {
    if (!caisseActive) return;
    setLoading(true);
    const [solde, hist] = await Promise.all([
      api().solde.get(caisseActive.id),
      api().cloture.getAll(caisseActive.id),
    ]);
    const encData = await api().encaissements.getAll({ caisse_id: caisseActive.id, archived: false });
    const decData = await api().decaissements.getAll({ caisse_id: caisseActive.id, archived: false });

    const totalEnc = (encData ?? []).reduce((s: number, e: any) => s + e.montant, 0);
    const totalDec = (decData ?? []).reduce((s: number, d: any) => s + d.montant, 0);

    setStats({
      solde,
      total_encaissements: totalEnc,
      total_decaissements: totalDec,
      nb_encaissements: (encData ?? []).length,
      nb_decaissements: (decData ?? []).length,
      fond_de_caisse: caisseActive.fond_de_caisse,
    });
    setClotures(hist ?? []);
    setLoading(false);
  };

  const handleCloture = async () => {
    if (!caisseActive) return;
    setClosing(true);
    setError('');
    try {
      await api().cloture.execute(caisseActive.id, userId);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la cloture');
    }
    setClosing(false);
  };

  if (!caisseActive) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Aucune caisse selectionnee</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-4 max-w-sm w-full">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-black text-gray-900">Caisse cloturee</h2>
          <p className="text-sm text-gray-500">Les transactions ont ete archivees et le fond de caisse remis a zero.</p>
          <button onClick={() => { setDone(false); loadData(); }}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl transition text-sm">OK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center">
          <Lock size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black text-gray-900">Cloture de caisse</h1>
          <p className="text-[11px] text-gray-400">{caisseActive.nom}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {stats && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Situation actuelle</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">Fond de caisse</p>
                  <p className="text-sm font-black text-gray-900">{fmt(stats.fond_de_caisse)} FCFA</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">Encaissements ({stats.nb_encaissements})</p>
                  <p className="text-sm font-black text-emerald-700">{fmt(stats.total_encaissements)} FCFA</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">Decaissements ({stats.nb_decaissements})</p>
                  <p className="text-sm font-black text-red-600">{fmt(stats.total_decaissements)} FCFA</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">Solde</p>
                  <p className="text-sm font-black text-blue-700">{fmt(stats.solde)} FCFA</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>
              )}

              <button onClick={handleCloture} disabled={closing || (stats.nb_encaissements === 0 && stats.nb_decaissements === 0)}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm">
                {closing ? 'Cloture en cours...' : 'CLOTURER LA CAISSE'}
              </button>
            </div>
          )}

          {clotures.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Historique des clotures</h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {clotures.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{c.date_debut} - {c.date_fin}</p>
                      <p className="text-[10px] text-gray-400">{c.nb_encaissements} enc. / {c.nb_decaissements} dec.</p>
                    </div>
                    <p className="text-xs font-black text-gray-900">{fmt(c.solde)} FCFA</p>
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
