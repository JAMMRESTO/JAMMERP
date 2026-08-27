import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Crown, Clock, Check, X, AlertTriangle,
  Users, ShoppingCart, LayoutGrid, Zap, Star, ChevronRight,
  Calendar, Loader, Shield, ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { SubscriptionPlan, Subscription, BillingCycle } from '../../lib/types';

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001';

const PLAN_COLORS: Record<string, { bg: string; border: string; badge: string; icon: string; glow: string }> = {
  FREE: { bg: 'bg-gray-50', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-600', icon: 'text-gray-400', glow: '' },
  STARTER: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: 'text-blue-500', glow: '' },
  PRO: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: 'text-amber-500', glow: 'ring-2 ring-amber-200' },
  ENTERPRISE: { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-500', glow: 'ring-2 ring-emerald-200' },
};

const PLAN_ICONS: Record<string, typeof Star> = {
  FREE: Shield,
  STARTER: Zap,
  PRO: Crown,
  ENTERPRISE: Star,
};

const FEATURE_LABELS: Record<string, string> = {
  printers: 'Imprimantes',
  kitchen_display: 'Ecran cuisine',
  cash_closure: 'Cloture de caisse',
  data_export: 'Export de donnees',
  activity_logs: 'Journal d\'activites',
  multi_location: 'Multi-etablissement',
};

function formatPrice(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
  label: string;
}

function getCountdown(expiresAt: string | null): CountdownResult {
  if (!expiresAt) return { days: 0, hours: 0, minutes: 0, expired: false, label: 'Illimite' };

  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diff = exp - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true, label: 'Expire' };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 30) return { days, hours, minutes, expired: false, label: `${days} jours restants` };
  if (days > 0) return { days, hours, minutes, expired: false, label: `${days}j ${hours}h restants` };
  if (hours > 0) return { days, hours, minutes, expired: false, label: `${hours}h ${minutes}min restants` };
  return { days, hours, minutes, expired: false, label: `${minutes} min restantes` };
}

function CountdownTimer({ expiresAt }: { expiresAt: string | null }) {
  const [countdown, setCountdown] = useState(() => getCountdown(expiresAt));

  useEffect(() => {
    if (!expiresAt) return;
    const iv = setInterval(() => setCountdown(getCountdown(expiresAt)), 60_000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  if (!expiresAt) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
        <Check size={15} />
        <span>Plan gratuit - Pas d'expiration</span>
      </div>
    );
  }

  if (countdown.expired) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 font-semibold">
        <AlertTriangle size={15} />
        <span>Abonnement expire</span>
      </div>
    );
  }

  const urgency = countdown.days <= 3;

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-sm font-medium ${urgency ? 'text-red-600' : 'text-gray-700'}`}>
        <Clock size={15} className={urgency ? 'animate-pulse' : ''} />
        <span>{countdown.label}</span>
      </div>
      <div className="flex gap-3">
        {[
          { value: countdown.days, unit: 'Jours' },
          { value: countdown.hours, unit: 'Heures' },
          { value: countdown.minutes, unit: 'Min' },
        ].map(({ value, unit }) => (
          <div
            key={unit}
            className={`flex flex-col items-center px-3 py-2 rounded-xl ${
              urgency ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'
            }`}
          >
            <span className={`text-xl font-bold tabular-nums ${urgency ? 'text-red-700' : 'text-gray-900'}`}>
              {String(value).padStart(2, '0')}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubscriptionManager() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ plan: SubscriptionPlan; cycle: BillingCycle } | null>(null);

  const fetchData = useCallback(async () => {
    const [plansRes, subRes] = await Promise.all([
      supabase.from('subscription_plans').select('*').eq('active', true).order('sort_order'),
      supabase
        .from('subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPlans(plansRes.data || []);
    setSubscription(subRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubscribe = async (plan: SubscriptionPlan, cycle: BillingCycle) => {
    setUpgrading(plan.id);
    setShowConfirm(null);

    const price = cycle === 'annual' ? plan.price_annual : plan.price_monthly;
    const now = new Date();
    const expiresAt = plan.name === 'FREE'
      ? null
      : new Date(
          cycle === 'annual'
            ? now.getTime() + 365 * 24 * 60 * 60 * 1000
            : now.getTime() + 30 * 24 * 60 * 60 * 1000
        ).toISOString();

    if (subscription) {
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', subscription.id);
    }

    await supabase.from('subscriptions').insert({
      restaurant_id: RESTAURANT_ID,
      plan_id: plan.id,
      billing_cycle: cycle,
      status: 'active',
      started_at: now.toISOString(),
      expires_at: expiresAt,
      amount: price,
    });

    await fetchData();
    setUpgrading(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = subscription?.plan;
  const currentPlanName = currentPlan?.name || 'FREE';
  const colors = PLAN_COLORS[currentPlanName] || PLAN_COLORS.FREE;
  const PlanIcon = PLAN_ICONS[currentPlanName] || Shield;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
          <CreditCard size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Abonnement</h2>
          <p className="text-xs text-gray-500">Gerez votre plan et suivez votre abonnement</p>
        </div>
      </div>

      <div className={`${colors.bg} border ${colors.border} rounded-2xl p-6 ${colors.glow}`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colors.badge}`}>
              <PlanIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-gray-900">{currentPlan?.display_name || 'Gratuit'}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  {subscription?.billing_cycle === 'annual' ? 'Annuel' : 'Mensuel'}
                </span>
              </div>
              {subscription?.amount ? (
                <p className="text-sm text-gray-600">
                  {formatPrice(subscription.amount)} / {subscription.billing_cycle === 'annual' ? 'an' : 'mois'}
                </p>
              ) : (
                <p className="text-sm text-gray-500">Plan gratuit</p>
              )}
              {subscription?.started_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Depuis le {formatDate(subscription.started_at)}
                </p>
              )}
            </div>
          </div>

          <div className="sm:text-right">
            <CountdownTimer expiresAt={subscription?.expires_at || null} />
            {subscription?.expires_at && (
              <p className="text-xs text-gray-400 mt-2">
                Expire le {formatDate(subscription.expires_at)}
              </p>
            )}
          </div>
        </div>

        {currentPlan && currentPlanName !== 'FREE' && (
          <div className="mt-5 pt-5 border-t border-gray-200/50">
            <div className="grid grid-cols-3 gap-4">
              <LimitCard
                icon={<Users size={16} />}
                label="Utilisateurs"
                value={currentPlan.max_users ? `${currentPlan.max_users} max` : 'Illimite'}
              />
              <LimitCard
                icon={<ShoppingCart size={16} />}
                label="Commandes/mois"
                value={currentPlan.max_orders_per_month ? `${currentPlan.max_orders_per_month.toLocaleString('fr-FR')}` : 'Illimite'}
              />
              <LimitCard
                icon={<LayoutGrid size={16} />}
                label="Tables"
                value={currentPlan.max_tables ? `${currentPlan.max_tables} max` : 'Illimite'}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">Choisir un plan</h3>
        <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
          <button
            onClick={() => setSelectedCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              selectedCycle === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setSelectedCycle('annual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedCycle === 'annual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Annuel
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">-17%</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => {
          const planColors = PLAN_COLORS[plan.name] || PLAN_COLORS.FREE;
          const Icon = PLAN_ICONS[plan.name] || Shield;
          const price = selectedCycle === 'annual' ? plan.price_annual : plan.price_monthly;
          const monthlyEquiv = selectedCycle === 'annual' ? Math.round(plan.price_annual / 12) : plan.price_monthly;
          const isCurrent = plan.id === subscription?.plan_id;
          const isDowngrade = (plan.sort_order < (currentPlan?.sort_order || 0));
          const isUpgrade = (plan.sort_order > (currentPlan?.sort_order || 0));

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-5 transition-all ${
                isCurrent
                  ? `${planColors.border} ${planColors.bg} ${planColors.glow}`
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
              }`}
            >
              {plan.name === 'PRO' && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                  POPULAIRE
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                  ACTUEL
                </div>
              )}

              <div className="text-center mb-4 pt-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 ${planColors.badge}`}>
                  <Icon size={20} />
                </div>
                <h4 className="font-bold text-gray-900">{plan.display_name}</h4>
                <div className="mt-2">
                  {price === 0 ? (
                    <p className="text-2xl font-bold text-gray-900">Gratuit</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-900">{formatPrice(price)}</p>
                      <p className="text-xs text-gray-400">
                        {selectedCycle === 'annual' ? (
                          <>{formatPrice(monthlyEquiv)}/mois</>
                        ) : (
                          <>par mois</>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Users size={13} className="text-gray-400 flex-shrink-0" />
                  <span>{plan.max_users ? `${plan.max_users} utilisateurs` : 'Utilisateurs illimites'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <ShoppingCart size={13} className="text-gray-400 flex-shrink-0" />
                  <span>{plan.max_orders_per_month ? `${plan.max_orders_per_month.toLocaleString('fr-FR')} commandes/mois` : 'Commandes illimitees'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <LayoutGrid size={13} className="text-gray-400 flex-shrink-0" />
                  <span>{plan.max_tables ? `${plan.max_tables} tables` : 'Tables illimitees'}</span>
                </div>
                <div className="h-px bg-gray-100 my-2" />
                {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                  const enabled = plan.features?.[key];
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      {enabled ? (
                        <Check size={13} className="text-emerald-500 flex-shrink-0" />
                      ) : (
                        <X size={13} className="text-gray-300 flex-shrink-0" />
                      )}
                      <span className={enabled ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                    </div>
                  );
                })}
              </div>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-400 cursor-not-allowed"
                >
                  Plan actuel
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirm({ plan, cycle: selectedCycle })}
                  disabled={upgrading === plan.id}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isUpgrade
                      ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-sm'
                      : isDowngrade
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  } disabled:opacity-50`}
                >
                  {upgrading === plan.id ? (
                    <Loader size={14} className="animate-spin" />
                  ) : (
                    <>
                      {isUpgrade ? 'Passer a ce plan' : isDowngrade ? 'Revenir a ce plan' : 'Choisir'}
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
        <div className="flex items-start gap-3">
          <Calendar size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-1">Renouvellement automatique</p>
            <p className="text-xs text-blue-600">
              L'abonnement se renouvelle automatiquement a la date d'expiration.
              Le decompte ci-dessus se met a jour en temps reel.
              Vous pouvez changer de plan a tout moment.
            </p>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          plan={showConfirm.plan}
          cycle={showConfirm.cycle}
          currentPlan={currentPlan || null}
          onConfirm={() => handleSubscribe(showConfirm.plan, showConfirm.cycle)}
          onCancel={() => setShowConfirm(null)}
        />
      )}
    </div>
  );
}

function LimitCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/60 rounded-xl px-3 py-2.5 text-center">
      <div className="flex justify-center text-gray-400 mb-1">{icon}</div>
      <p className="text-sm font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
    </div>
  );
}

interface ConfirmModalProps {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ plan, cycle, currentPlan, onConfirm, onCancel }: ConfirmModalProps) {
  const price = cycle === 'annual' ? plan.price_annual : plan.price_monthly;
  const isUpgrade = (plan.sort_order > (currentPlan?.sort_order || 0));
  const colors = PLAN_COLORS[plan.name] || PLAN_COLORS.FREE;
  const Icon = PLAN_ICONS[plan.name] || Shield;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.badge}`}>
            <Icon size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isUpgrade ? 'Passer au plan' : 'Changer pour le plan'} {plan.display_name}
            </h3>
            <p className="text-sm text-gray-500">
              {cycle === 'annual' ? 'Facturation annuelle' : 'Facturation mensuelle'}
            </p>
          </div>
        </div>

        <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 mb-5`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Montant</span>
            <span className="text-lg font-bold text-gray-900">{formatPrice(price)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-400">Duree</span>
            <span className="text-xs font-semibold text-gray-600">
              {cycle === 'annual' ? '12 mois' : '30 jours'}
            </span>
          </div>
          {currentPlan && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/50">
              <ChevronRight size={14} className="text-gray-400" />
              <span className="text-xs text-gray-500">
                Remplacement du plan <strong>{currentPlan.display_name}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-white transition-all flex items-center justify-center gap-2"
          >
            Confirmer
            <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
