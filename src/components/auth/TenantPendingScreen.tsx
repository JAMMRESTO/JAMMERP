import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, ChefHat, LogOut, RefreshCw } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import type { TenantStatus } from '../../types/database';

const STATUS_CONTENT: Record<Extract<TenantStatus, 'pending' | 'approved' | 'rejected' | 'suspended'>, {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  color: string;
}> = {
  pending: {
    icon: <Clock size={28} />,
    iconBg: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
    title: 'Demande en cours de validation',
    subtitle: "Votre demande d'inscription a bien été reçue. Notre équipe va examiner votre dossier et vous notifier dès que votre compte sera activé.",
    color: 'text-amber-400',
  },
  approved: {
    icon: <CheckCircle2 size={28} />,
    iconBg: 'bg-sky-500/15 border-sky-500/25 text-sky-400',
    title: 'Compte approuvé — Configuration requise',
    subtitle: "Votre compte a été approuvé ! Un administrateur va finaliser la configuration de votre espace. Revenez dans quelques instants.",
    color: 'text-sky-400',
  },
  rejected: {
    icon: <XCircle size={28} />,
    iconBg: 'bg-red-500/15 border-red-500/25 text-red-400',
    title: 'Demande refusée',
    subtitle: "Votre demande n'a pas pu être acceptée. Consultez le motif ci-dessous et contactez notre support si vous pensez qu'il s'agit d'une erreur.",
    color: 'text-red-400',
  },
  suspended: {
    icon: <XCircle size={28} />,
    iconBg: 'bg-orange-500/15 border-orange-500/25 text-orange-400',
    title: 'Compte suspendu',
    subtitle: "Votre compte a été temporairement suspendu. Veuillez contacter notre support pour plus d'informations.",
    color: 'text-orange-400',
  },
};

export function TenantPendingScreen() {
  const { tenant, signOut } = useTenant();
  const status = (tenant?.status ?? 'pending') as Extract<TenantStatus, 'pending' | 'approved' | 'rejected' | 'suspended'>;
  const content = STATUS_CONTENT[status] ?? STATUS_CONTENT.pending;

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050810 0%, #0a0f1e 50%, #060b14 100%)' }}
    >
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-5" style={{ backgroundColor: '#3B82F6' }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-4" style={{ backgroundColor: '#F59E0B' }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-12"
        >
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#3B82F6' }}>
            <ChefHat size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-base leading-tight">RestoBar POS</p>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest">Plateforme multi-sites</p>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/3 border border-white/8 rounded-3xl p-8 text-center">
            {/* Icon */}
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-6 ${content.iconBg}`}>
              {content.icon}
            </div>

            {/* Title */}
            <h1 className="text-white text-xl font-black mb-3">{content.title}</h1>
            <p className="text-white/40 text-sm leading-relaxed">{content.subtitle}</p>

            {/* Rejection reason */}
            {status === 'rejected' && tenant?.rejection_reason && (
              <div className="mt-5 p-4 rounded-2xl bg-red-500/8 border border-red-500/15 text-left">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5">Motif</p>
                <p className="text-white/70 text-sm leading-relaxed">{tenant.rejection_reason}</p>
              </div>
            )}

            {/* Tenant info */}
            {tenant && (
              <div className="mt-5 p-4 rounded-2xl bg-white/3 border border-white/6 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/35 text-xs">Établissement</span>
                  <span className="text-white text-xs font-semibold">{tenant.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/35 text-xs">Statut</span>
                  <span className={`text-xs font-semibold ${content.color}`}>
                    {STATUS_CONTENT[status]?.title.split(' ')[0]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/35 text-xs">Inscription</span>
                  <span className="text-white/60 text-xs">{new Date(tenant.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            )}

            {/* Steps for pending */}
            {status === 'pending' && (
              <div className="mt-5 space-y-2.5">
                {[
                  { n: 1, label: "Inscription reçue", done: true },
                  { n: 2, label: "Examen par notre équipe", done: false, active: true },
                  { n: 3, label: "Activation du compte", done: false },
                  { n: 4, label: "Configuration et démarrage", done: false },
                ].map(step => (
                  <div key={step.n} className="flex items-center gap-3 text-left">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                      step.done ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                      : step.active ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                      : 'bg-white/5 border border-white/10 text-white/20'
                    }`}>
                      {step.done ? <CheckCircle2 size={12} /> : step.n}
                    </div>
                    <span className={`text-xs ${step.done ? 'text-emerald-400' : step.active ? 'text-amber-300 font-semibold' : 'text-white/25'}`}>
                      {step.label}
                    </span>
                    {step.active && (
                      <span className="ml-auto">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/6 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm font-medium transition-all"
            >
              <RefreshCw size={14} /> Actualiser
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={signOut}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/6 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm font-medium transition-all"
            >
              <LogOut size={14} /> Se déconnecter
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
