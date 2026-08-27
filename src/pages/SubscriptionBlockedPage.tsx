import { Lock, LogOut, Calendar } from 'lucide-react';
import type { Subscription } from '../hooks/useSubscription';

interface Props {
  subscription: Subscription | null;
  onSignOut: () => void;
}

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const PLAN_LABELS: Record<string, string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  annuel: 'Annuel',
};

export default function SubscriptionBlockedPage({ subscription, onSignOut }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
          <Lock size={28} className="text-red-500" />
        </div>

        <h1 className="text-xl font-black text-gray-900 mb-2">Abonnement expire</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Votre abonnement a expire. L'acces a l'application est bloque jusqu'au renouvellement par le super administrateur.
        </p>

        {subscription && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Calendar size={14} className="text-red-500" />
              <span className="text-xs font-bold text-red-700 uppercase">
                Plan {PLAN_LABELS[subscription.plan] ?? subscription.plan}
              </span>
            </div>
            <p className="text-sm text-red-600">
              Expire le <span className="font-bold">{fmtDate(subscription.date_fin)}</span>
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mb-6">
          Contactez votre administrateur pour renouveler l'abonnement.
        </p>

        <button
          onClick={onSignOut}
          className="flex items-center justify-center gap-2 w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
        >
          <LogOut size={16} />
          Se deconnecter
        </button>
      </div>
    </div>
  );
}
