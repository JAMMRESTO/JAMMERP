import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Delete, AlertTriangle, Loader2, KeyRound, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import type { UserWithRole } from '../../types/database';

interface AdminPinModalProps {
  title?: string;
  description?: string;
  requireReason?: boolean;
  onConfirm: (admin: UserWithRole, reason: string) => void;
  onClose: () => void;
}

const CANCEL_REASONS = [
  'Erreur de saisie',
  'Client annule',
  'Produit indisponible',
  'Doublon',
  'Autre',
];

type AuthMode = 'pin' | 'password';

export function AdminPinModal({
  title = 'Validation administrateur',
  description = 'Confirmez avec le code PIN admin ou le mot de passe du gestionnaire',
  requireReason = true,
  onConfirm,
  onClose,
}: AdminPinModalProps) {
  const { allUsers, currentUser } = useAuth();
  const { isSiteManager, siteManager, authUser } = useTenant();

  const adminUsers = allUsers.filter(
    u => u.role?.permissions?.all === true || u.role?.name === 'admin'
  );
  const hasAdminPinUsers = adminUsers.length > 0;
  const hasSiteManager = isSiteManager && !!authUser;

  const [mode, setMode] = useState<AuthMode>(hasAdminPinUsers ? 'pin' : 'password');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getReasonOrError(): string | null {
    const finalReason = reason === 'Autre' ? customReason.trim() : reason;
    if (requireReason && !finalReason) {
      setError('Veuillez sélectionner un motif');
      return null;
    }
    return finalReason;
  }

  function handleDigit(d: string) {
    if (pin.length >= 6) return;
    setPin(p => p + d);
    setError('');
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1));
    setError('');
  }

  function handlePinValidate() {
    const finalReason = getReasonOrError();
    if (finalReason === null) return;

    const admin = adminUsers.find(u => u.pin === pin);
    if (!admin) {
      setError('Code PIN invalide ou non-administrateur');
      setPin('');
      return;
    }
    setLoading(true);
    onConfirm(admin, finalReason);
  }

  async function handlePasswordValidate() {
    const finalReason = getReasonOrError();
    if (finalReason === null) return;
    if (!password.trim()) {
      setError('Veuillez saisir le mot de passe');
      return;
    }

    setLoading(true);
    setError('');

    const email = authUser?.email ?? siteManager?.email;
    if (!email) {
      setError('Aucun compte gestionnaire trouvé');
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Mot de passe incorrect');
      setPassword('');
      setLoading(false);
      return;
    }

    const managerAsUser: UserWithRole = {
      id: authUser?.id ?? siteManager?.id ?? '',
      tenant_id: siteManager?.tenant_id ?? null,
      site_id: siteManager?.site_id ?? null,
      name: siteManager?.name ?? authUser?.email ?? 'Gestionnaire',
      pin: '',
      email: email,
      role_id: null,
      avatar_url: '',
      is_active: true,
      created_at: '',
      updated_at: '',
      role: { id: '', tenant_id: null, name: 'admin', label: 'Gestionnaire', permissions: { all: true }, color: '#3B82F6', created_at: '' },
    };

    onConfirm(managerAsUser, finalReason);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-3"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                <Shield size={17} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-sm">{title}</h2>
                <p className="text-white/40 text-xs mt-0.5 max-w-[220px]">{description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Mode selector - only show if both modes available */}
            {hasAdminPinUsers && hasSiteManager && (
              <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/8">
                <button
                  onClick={() => { setMode('pin'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
                    ${mode === 'pin' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                >
                  <KeyRound size={13} />
                  Code PIN admin
                </button>
                <button
                  onClick={() => { setMode('password'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
                    ${mode === 'password' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                >
                  <Lock size={13} />
                  Mot de passe
                </button>
              </div>
            )}

            {/* Reason selector */}
            {requireReason && (
              <div className="space-y-2">
                <label className="text-white/50 text-xs font-medium">Motif d'annulation</label>
                <div className="flex flex-wrap gap-1.5">
                  {CANCEL_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setReason(r); setError(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                        ${reason === r
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {reason === 'Autre' && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    placeholder="Preciser le motif..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/40"
                  />
                )}
              </div>
            )}

            {/* PIN mode */}
            {mode === 'pin' && (
              <>
                <div className="text-center">
                  <p className="text-white/40 text-xs mb-2">Code PIN administrateur</p>
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg font-bold transition-all
                          ${i < pin.length
                            ? 'bg-red-500/15 border-red-500/30 text-red-400'
                            : 'bg-white/5 border-white/10 text-white/20'}`}
                      >
                        {i < pin.length ? '\u2022' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2">
                  {['1','2','3','4','5','6','7','8','9'].map(d => (
                    <button
                      key={d}
                      onClick={() => handleDigit(d)}
                      className="h-12 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 active:bg-white/15 transition-all"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    onClick={handleDelete}
                    className="h-12 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 flex items-center justify-center transition-all"
                  >
                    <Delete size={18} />
                  </button>
                  <button
                    onClick={() => handleDigit('0')}
                    className="h-12 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 active:bg-white/15 transition-all"
                  >
                    0
                  </button>
                  <button
                    onClick={handlePinValidate}
                    disabled={pin.length === 0 || loading}
                    className="h-12 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all flex items-center justify-center"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'OK'}
                  </button>
                </div>
              </>
            )}

            {/* Password mode */}
            {mode === 'password' && (
              <div className="space-y-3">
                <div>
                  <p className="text-white/40 text-xs mb-2">Mot de passe du gestionnaire</p>
                  <p className="text-white/25 text-[10px] mb-3">
                    {authUser?.email ?? siteManager?.email ?? ''}
                  </p>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordValidate()}
                    placeholder="Mot de passe..."
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red-500/40 transition-all"
                  />
                </div>
                <button
                  onClick={handlePasswordValidate}
                  disabled={!password.trim() || loading}
                  className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : (
                    <>
                      <Shield size={15} />
                      Valider l'annulation
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                <span className="text-red-300 text-xs">{error}</span>
              </motion.div>
            )}

            {!hasAdminPinUsers && !hasSiteManager && (
              <p className="text-amber-400/80 text-xs text-center">
                Aucun administrateur configure pour ce site
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
