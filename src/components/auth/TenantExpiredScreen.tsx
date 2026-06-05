import { motion } from 'framer-motion';
import { Clock, AlertTriangle, LogOut, CreditCard, Mail } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';

export function TenantExpiredScreen() {
  const { tenant, signOut } = useTenant();

  const expiredAt = tenant?.subscription_expires_at
    ? new Date(tenant.subscription_expires_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.04] bg-red-500" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md text-center"
      >
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle size={32} className="text-red-400" />
        </div>

        <h1 className="text-white text-2xl font-black mb-2">Periode d'essai terminee</h1>
        <p className="text-white/40 text-sm mb-2">
          Votre essai gratuit pour <span className="text-white/70 font-semibold">{tenant?.name}</span> a expire le {expiredAt}.
        </p>
        <p className="text-white/30 text-xs mb-8">
          Pour continuer a utiliser la plateforme, veuillez souscrire a un abonnement.
        </p>

        {/* Plan info */}
        <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] mb-6 text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Clock size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-white/80 text-sm font-semibold">Essai expire</p>
              <p className="text-white/30 text-xs capitalize">Plan {tenant?.plan ?? 'starter'} - 5 jours d'essai</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <CreditCard size={16} className="text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-white/70 text-xs font-medium">Souscrire a un abonnement</p>
                <p className="text-white/30 text-[10px]">Contactez-nous pour activer votre compte</p>
              </div>
            </div>

            <a
              href="mailto:support@jammpos.com"
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
            >
              <Mail size={16} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-white/70 text-xs font-medium">Nous contacter</p>
                <p className="text-white/30 text-[10px]">support@jammpos.com</p>
              </div>
            </a>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.06] text-sm font-medium transition-all"
        >
          <LogOut size={14} /> Se deconnecter
        </button>
      </motion.div>
    </div>
  );
}
