import { useState } from 'react';
import {
  Building2, CheckCircle, XCircle, Calendar, Package,
  ChevronDown, ChevronUp, Users, ArrowRightLeft
} from 'lucide-react';
import { Company } from '../../types';
import { formatDate } from '../../lib/utils';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  duration_days: number;
  price: number;
  features: string[];
}

const planColors: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-700',
  monthly: 'bg-blue-100 text-blue-700',
  annual: 'bg-emerald-100 text-emerald-700',
  custom: 'bg-amber-100 text-amber-700',
};

const planLabels: Record<string, string> = {
  trial: 'Essai',
  monthly: 'Mensuel',
  annual: 'Annuel',
  custom: 'Personnalise',
};

function daysLeft(endDate?: string | null): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface Props {
  company: Company;
  plans: SubscriptionPlan[];
  isCurrent: boolean;
  onToggleActive: (c: Company) => void;
  onUpdatePlan: (companyId: string, planSlug: string, customDays?: number) => void;
  onManageUsers: (companyId: string) => void;
  onSwitchTo: (companyId: string) => void;
  userCount: number;
}

export default function CompanyCard({
  company: c, plans, isCurrent, onToggleActive, onUpdatePlan, onManageUsers, onSwitchTo, userCount
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const remaining = daysLeft(c.subscription_end_date);
  const isExpired = remaining !== null && remaining <= 0;
  const isUrgent = remaining !== null && remaining > 0 && remaining <= 7;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${
      !c.is_active ? 'border-red-200 opacity-75' : isExpired ? 'border-orange-300' : 'border-gray-100'
    } ${isCurrent ? 'ring-2 ring-amber-400' : ''}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${c.is_active ? 'bg-blue-50' : 'bg-red-50'}`}>
            <Building2 className={`w-5 h-5 ${c.is_active ? 'text-blue-600' : 'text-red-400'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                  {c.name}
                  {isCurrent && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Votre societe</span>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{c.email || "Pas d'email"} &mdash; {formatDate(c.created_at)}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${planColors[c.subscription_plan] || 'bg-gray-100 text-gray-700'}`}>
                    {planLabels[c.subscription_plan] || c.subscription_plan}
                  </span>
                  {remaining !== null && (
                    <span className={`text-xs flex items-center gap-1 font-semibold ${
                      isExpired ? 'text-red-600' : isUrgent ? 'text-orange-500' : 'text-slate-500'
                    }`}>
                      <Calendar className="w-3 h-3" />
                      {isExpired ? 'Expire' : `${remaining}j restants`}
                    </span>
                  )}
                  <span className="text-xs flex items-center gap-1 text-slate-400">
                    <Users className="w-3 h-3" />
                    {userCount} utilisateur{userCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <button onClick={() => setExpanded(!expanded)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-slate-400 flex-shrink-0">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {!isCurrent && c.is_active && (
                <button onClick={() => onSwitchTo(c.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  <ArrowRightLeft className="w-3 h-3" /> Naviguer
                </button>
              )}
              <button onClick={() => onManageUsers(c.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                <Users className="w-3 h-3" /> Utilisateurs
              </button>
              <button onClick={() => onToggleActive(c)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                  c.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}>
                {c.is_active ? <><XCircle className="w-3 h-3" /> Bloquer</> : <><CheckCircle className="w-3 h-3" /> Activer</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-slate-50/50 rounded-b-2xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Modifier l'abonnement</p>
          <div className="flex flex-wrap gap-2">
            {plans.map(plan => (
              <button key={plan.slug} onClick={() => onUpdatePlan(c.id, plan.slug)}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition-colors border ${
                  c.subscription_plan === plan.slug
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                }`}>
                <Package className="w-3 h-3" />
                {plan.name} ({plan.duration_days}j)
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="number" min="1" placeholder="Jours personnalises"
              className="w-44 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = Number((e.target as HTMLInputElement).value);
                  if (val > 0) onUpdatePlan(c.id, 'custom', val);
                }
              }}
            />
            <span className="text-xs text-slate-400">jours -- Appuyez Entree pour valider</span>
          </div>
          {c.subscription_end_date && (
            <p className="text-xs text-slate-400 mt-3">
              Expire le : <span className="font-medium text-slate-600">{formatDate(c.subscription_end_date)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
