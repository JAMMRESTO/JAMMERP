import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat, Delete, Lock, ArrowLeft, Shield, Clock, ShoppingCart, LogOut, Power,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../ui/Toast';
import { forceCloseApp } from '../../lib/supabase';
import type { UserWithRole } from '../../types/database';

const ROLE_CONFIG: Record<string, {
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
}> = {
  admin:   { color: '#EF4444', icon: Shield,      label: 'Admin' },
  cashier: { color: '#F59E0B', icon: ShoppingCart, label: 'Caissier' },
};

function getRoleConfig(name?: string) {
  return ROLE_CONFIG[name ?? ''] ?? { color: '#3B82F6', icon: ShoppingCart, label: name ?? '' };
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── User Card ──────────────────────────────────────────────────────────────

function UserCard({ user, selected, onClick }: {
  user: UserWithRole;
  selected: boolean;
  onClick: () => void;
}) {
  const cfg = getRoleConfig(user.role?.name);
  const Icon = cfg.icon;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -3 }}
      whileTap={{ scale: 0.96 }}
      className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-200 cursor-pointer group overflow-hidden
        ${selected
          ? 'border-white/25 shadow-2xl'
          : 'border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/15'
        }`}
      style={selected ? { background: `linear-gradient(135deg, ${cfg.color}18, ${cfg.color}08)`, borderColor: cfg.color + '50', boxShadow: `0 0 30px ${cfg.color}20` } : {}}
    >
      {selected && (
        <motion.div
          layoutId="user-selection-glow"
          className="absolute inset-0 rounded-2xl"
          style={{ background: `linear-gradient(135deg, ${cfg.color}15, transparent)` }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        />
      )}

      {/* Avatar */}
      <div className="relative">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg transition-transform duration-200"
          style={{ background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}15)`, border: `1.5px solid ${cfg.color}40` }}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold" style={{ color: cfg.color }}>{getInitials(user.name)}</span>
          )}
        </div>
        {/* Role icon badge */}
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
          style={{ backgroundColor: cfg.color, boxShadow: `0 2px 8px ${cfg.color}50` }}
        >
          <Icon size={10} className="text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="text-center relative z-10 w-full">
        <p className="text-white font-semibold text-xs leading-tight truncate px-1">{user.name}</p>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium mt-1 inline-block"
          style={{ backgroundColor: cfg.color + '20', color: cfg.color }}
        >
          {user.role?.label ?? cfg.label}
        </span>
      </div>
    </motion.button>
  );
}

// ─── PIN Dot ─────────────────────────────────────────────────────────────────

function PinDot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <motion.div
      animate={{
        scale: filled ? 1 : 0.5,
        opacity: filled ? 1 : 0.3,
      }}
      transition={{ type: 'spring', damping: 15, stiffness: 500 }}
      className="w-3.5 h-3.5 rounded-full"
      style={{ backgroundColor: filled ? color : 'rgba(255,255,255,0.3)' }}
    />
  );
}

// ─── PIN Pad ──────────────────────────────────────────────────────────────────

function PinPad({ onDigit, onDelete, color }: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  color: string;
}) {
  const digits = ['1','2','3','4','5','6','7','8','9','','0','del'];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') onDigit(e.key);
      if (e.key === 'Backspace') onDelete();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDigit, onDelete]);

  return (
    <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
      {digits.map((d, i) => {
        if (d === '') return <div key={i} />;
        if (d === 'del') return (
          <motion.button
            key="del"
            onClick={onDelete}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="h-14 rounded-2xl bg-white/6 hover:bg-white/12 border border-white/8 hover:border-white/16 flex items-center justify-center text-white/50 hover:text-white/80 transition-all"
          >
            <Delete size={18} />
          </motion.button>
        );
        return (
          <motion.button
            key={d}
            onClick={() => onDigit(d)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.9 }}
            className="h-14 rounded-2xl bg-white/6 hover:bg-white/12 border border-white/8 flex items-center justify-center text-white text-xl font-semibold transition-all duration-100 select-none"
            style={{ ['--hover-border' as string]: color + '50' }}
          >
            {d}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-white/30">
      <Clock size={12} />
      <span className="text-xs font-mono tabular-nums">
        {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function LoginScreen() {
  const { allUsers, selectedUserId, selectUser, login, isLocked, unlockSession } = useAuth();
  const { settings } = useSettings();
  const { signOut, currentSite, sites, clearSite, isSiteManager } = useTenant();
  const toast = useToast();

  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [step, setStep] = useState<'select' | 'pin'>('select');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep a ref to the currently selected userId so callbacks never see stale state
  const pendingUserIdRef = useRef<string | null>(selectedUserId);

  useEffect(() => {
    if (isLocked && selectedUserId) {
      pendingUserIdRef.current = selectedUserId;
      setStep('pin');
    }
  }, [isLocked, selectedUserId]);

  async function handleSubmit(p: string) {
    setIsLoading(true);
    let success = false;
    let errMsg = '';

    if (isLocked) {
      success = await unlockSession(p);
      if (!success) errMsg = 'Code PIN incorrect';
    } else {
      const res = await login(p, pendingUserIdRef.current ?? undefined);
      success = res.success;
      errMsg = res.error ?? '';
    }

    if (!success) {
      setShake(true);
      setError(errMsg);
      setTimeout(() => { setShake(false); setPin(''); }, 600);
      if (errMsg) toast('error', errMsg);
    } else {
      const user = allUsers.find(u => u.id === pendingUserIdRef.current);
      toast('success', `Bienvenue, ${user?.name ?? ''}!`);
    }
    setIsLoading(false);
  }

  const handleDigit = useCallback((d: string) => {
    setError('');
    setPin(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        setTimeout(() => handleSubmit(next), 80);
      }
      return next;
    });
  }, [handleSubmit]);

  const handleDelete = useCallback(() => {
    setError('');
    setPin(p => p.slice(0, -1));
  }, []);

  function handleSelectUser(userId: string) {
    pendingUserIdRef.current = userId;
    selectUser(userId);
    setStep('pin');
    setPin('');
    setError('');
  }

  function handleBack() {
    if (!isLocked) {
      setStep('select');
      setPin('');
      setError('');
    }
  }

  const selectedUser = allUsers.find(u => u.id === selectedUserId);
  const cfg = getRoleConfig(selectedUser?.role?.name);

  const sortedUsers = [...allUsers].sort((a, b) => {
    const roleOrder = ['admin', 'cashier'];
    const ai = roleOrder.indexOf(a.role?.name ?? '');
    const bi = roleOrder.indexOf(b.role?.name ?? '');
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: 'linear-gradient(135deg, #050810 0%, #0a0f1e 50%, #060b14 100%)' }}>

      {/* Left decorative panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 flex-col justify-between p-10 relative overflow-hidden border-r border-white/5">
        {/* Ambient gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-500/6 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-900/4 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Logo + name */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 overflow-hidden">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ChefHat size={20} className="text-white" />
              )}
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">{currentSite?.name ?? settings.restaurant_name}</p>
              {currentSite && settings.restaurant_name && settings.restaurant_name !== currentSite.name && (
                <p className="text-white/30 text-[9px] leading-tight">{settings.restaurant_name}</p>
              )}
              <p className="text-blue-400/70 text-[10px] font-semibold uppercase tracking-widest">Système POS</p>
            </div>
          </div>

          <div className="space-y-2 mb-10">
            <h2 className="text-white text-3xl font-black leading-tight">
              Accès<br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #3B82F6, #06B6D4)' }}>
                sécurisé
              </span>
            </h2>
            <p className="text-white/35 text-sm leading-relaxed">
              Sélectionnez votre profil et entrez votre code PIN pour accéder au système.
            </p>
          </div>

          {/* Role badges */}
          <div className="space-y-2.5">
            {Object.entries(ROLE_CONFIG).map(([key, c]) => {
              const Icon = c.icon;
              const count = allUsers.filter(u => u.role?.name === key).length;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: c.color + '20', border: `1px solid ${c.color}30` }}
                  >
                    <Icon size={13} style={{ color: c.color }} />
                  </div>
                  <span className="text-white/50 text-xs flex-1">{c.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: c.color + '20', color: c.color }}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom info */}
        <div className="relative z-10 space-y-3">
          <LiveClock />
          <p className="text-white/15 text-[10px]">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Right: main auth area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 mb-8 self-start w-full">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 overflow-hidden">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ChefHat size={16} className="text-white" />
            )}
          </div>
          <div>
            <p className="text-white font-bold text-sm">{currentSite?.name ?? settings.restaurant_name}</p>
            {currentSite && settings.restaurant_name && settings.restaurant_name !== currentSite.name && (
              <p className="text-white/30 text-[9px] leading-tight">{settings.restaurant_name}</p>
            )}
            <p className="text-blue-400/70 text-[9px] font-semibold uppercase tracking-widest">Système POS</p>
          </div>
          <div className="ml-auto">
            <LiveClock />
          </div>
        </div>

        {/* Ambient glow on right side */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl translate-x-1/2" />
          <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-cyan-500/4 rounded-full blur-3xl -translate-x-1/2" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-md"
        >
          <AnimatePresence mode="wait">

            {/* ── STEP: SELECT USER ── */}
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div className="mb-6">
                  {/* Logo above title */}
                  {settings.logo_url && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex justify-center mb-5"
                    >
                      <div className="w-28 h-28 rounded-3xl overflow-hidden bg-white/6 border border-white/10 shadow-xl flex items-center justify-center">
                        <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                      </div>
                    </motion.div>
                  )}
                  <h1 className="text-white text-2xl font-black mb-1">Qui êtes-vous ?</h1>
                  <p className="text-white/35 text-sm">Sélectionnez votre profil pour continuer</p>
                </div>

                {sortedUsers.length === 0 ? (
                  <div className="text-center py-14 rounded-3xl border border-white/8 bg-white/3">
                    <Lock size={36} className="mx-auto mb-4 text-white/15" />
                    <p className="text-white/40 font-medium">Aucun utilisateur configuré</p>
                    <p className="text-white/20 text-xs mt-1">Contactez votre administrateur</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {sortedUsers.map(user => (
                      <UserCard
                        key={user.id}
                        user={user}
                        selected={user.id === selectedUserId}
                        onClick={() => handleSelectUser(user.id)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── STEP: PIN ── */}
            {step === 'pin' && (
              <motion.div
                key="pin"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex flex-col items-center"
              >
                {/* Back button */}
                {!isLocked && (
                  <motion.button
                    onClick={handleBack}
                    whileHover={{ x: -2 }}
                    className="self-start flex items-center gap-1.5 text-white/35 hover:text-white/70 text-sm mb-6 transition-colors"
                  >
                    <ArrowLeft size={15} /> Changer d'utilisateur
                  </motion.button>
                )}

                {/* Locked indicator */}
                {isLocked && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6"
                  >
                    <Lock size={11} className="text-amber-400" />
                    <span className="text-amber-400 text-xs font-medium">Session verrouillée</span>
                  </motion.div>
                )}

                {/* User profile card */}
                {selectedUser && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    className="flex flex-col items-center mb-7"
                  >
                    <div className="relative mb-4">
                      {/* Glow ring */}
                      <div
                        className="absolute inset-0 rounded-3xl blur-md opacity-40"
                        style={{ backgroundColor: cfg.color, transform: 'scale(1.1)' }}
                      />
                      <div
                        className="relative w-20 h-20 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl"
                        style={{
                          background: `linear-gradient(135deg, ${cfg.color}35, ${cfg.color}15)`,
                          border: `2px solid ${cfg.color}50`,
                        }}
                      >
                        {selectedUser.avatar_url ? (
                          <img src={selectedUser.avatar_url} alt={selectedUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-black" style={{ color: cfg.color }}>
                            {getInitials(selectedUser.name)}
                          </span>
                        )}
                      </div>
                    </div>

                    <h2 className="text-white font-bold text-xl mb-1">{selectedUser.name}</h2>
                    {selectedUser.role && (
                      <div
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: cfg.color + '18', color: cfg.color, border: `1px solid ${cfg.color}30` }}
                      >
                        {(() => { const Icon = cfg.icon; return <Icon size={11} />; })()}
                        {selectedUser.role.label}
                      </div>
                    )}
                  </motion.div>
                )}

                <p className="text-white/40 text-sm mb-5">
                  {isLocked ? 'Entrez votre PIN pour déverrouiller' : 'Entrez votre code PIN'}
                </p>

                {/* PIN dots */}
                <motion.div
                  className="flex gap-4 mb-7"
                  animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : { x: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {[0,1,2,3].map(i => (
                    <PinDot key={i} filled={i < pin.length} color={cfg.color} />
                  ))}
                </motion.div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -6, height: 0 }}
                      className="text-red-400 text-xs mb-4 font-medium"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <PinPad onDigit={handleDigit} onDelete={handleDelete} color={cfg.color} />

                {/* Loading */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-5 flex items-center gap-2 text-white/35 text-xs"
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                        style={{ borderColor: cfg.color + '40', borderTopColor: cfg.color }}
                      />
                      Vérification en cours...
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <div className="relative z-10 flex flex-col items-center gap-3 mt-8 lg:mt-12">
          {/* Back to site picker if multiple sites, or sign out */}
          <div className="flex items-center gap-3">
            {sites.length > 1 && (
              <motion.button
                whileHover={{ x: -2 }}
                onClick={clearSite}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/25 hover:text-white/60 hover:bg-white/5 text-xs font-medium transition-all"
              >
                <ArrowLeft size={11} />
                Changer de site
              </motion.button>
            )}
            {!isSiteManager && (
              <motion.button
                whileHover={{ x: -1 }}
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/20 hover:text-red-400/70 hover:bg-red-500/6 text-xs font-medium transition-all"
              >
                <LogOut size={11} />
                Changer de compte
              </motion.button>
            )}
            <motion.button
              whileHover={{ x: -1 }}
              onClick={forceCloseApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white/20 hover:text-red-300/70 hover:bg-red-500/8 text-xs font-medium transition-all"
            >
              <Power size={11} />
              Fermer l'application
            </motion.button>
          </div>
          <p className="text-white/10 text-[10px]">
            &copy; {new Date().getFullYear()} Jamm ERP — Accès réservé au personnel autorisé
          </p>
        </div>
      </div>
    </div>
  );
}
