import { useSolde } from '../hooks/useSolde';
import { TrendingUp, TrendingDown, Wallet, History, Lock } from 'lucide-react';
import type { Caisse } from '../hooks/useCaisse';

interface Props {
  caisseActive: Caisse | null;
  caisses: Caisse[];
  userRole: string;
  onNavigate: (page: string) => void;
  societeNom?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

export default function HomePage({ caisseActive, userRole, onNavigate, societeNom }: Props) {
  const solde = useSolde(caisseActive?.id ?? null);

  const actions = [
    { key: 'encaissement', label: 'Encaissement', icon: TrendingUp, color: 'bg-emerald-500', hover: 'hover:bg-emerald-600' },
    { key: 'decaissement', label: 'Decaissement', icon: TrendingDown, color: 'bg-red-500', hover: 'hover:bg-red-600' },
    { key: 'historique', label: 'Historique', icon: History, color: 'bg-slate-800', hover: 'hover:bg-slate-900' },
    { key: 'cloture', label: 'Cloture', icon: Lock, color: 'bg-amber-500', hover: 'hover:bg-amber-600' },
  ];

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-y-auto p-4">
      {/* Solde card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">{societeNom || 'Ma Caisse'}</p>
            <p className="text-sm font-semibold text-gray-600 mt-0.5">
              {caisseActive?.nom ?? 'Aucune caisse'}
            </p>
          </div>
          <Wallet size={20} className="text-emerald-500" />
        </div>
        <div className="mt-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Solde actuel</p>
          <p className="text-3xl font-black text-gray-900 mt-1">
            {solde !== null ? `${fmt(solde)} FCFA` : '---'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map(a => (
          <button key={a.key} onClick={() => onNavigate(a.key)}
            className={`${a.color} ${a.hover} text-white rounded-2xl p-4 flex flex-col items-start gap-3 transition active:scale-[0.97] shadow-sm`}>
            <a.icon size={24} />
            <span className="font-bold text-sm">{a.label}</span>
          </button>
        ))}
      </div>

      {userRole === 'admin' && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button onClick={() => onNavigate('statistiques')}
            className="bg-white border border-gray-200 text-gray-700 rounded-2xl p-4 flex flex-col items-start gap-2 hover:bg-gray-50 transition">
            <span className="font-bold text-sm">Statistiques</span>
          </button>
          <button onClick={() => onNavigate('parametres')}
            className="bg-white border border-gray-200 text-gray-700 rounded-2xl p-4 flex flex-col items-start gap-2 hover:bg-gray-50 transition">
            <span className="font-bold text-sm">Parametres</span>
          </button>
        </div>
      )}
    </div>
  );
}
