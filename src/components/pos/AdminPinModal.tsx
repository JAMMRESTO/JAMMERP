import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Delete, AlertTriangle, Loader2 } from 'lucide-react';
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

export function AdminPinModal({
  title = 'Validation administrateur',
  description = 'Saisissez le code PIN administrateur pour confirmer',
  requireReason = true,
  onConfirm,
  onClose,
}: AdminPinModalProps) {
  const { allUsers } = useAuth();
  const { ownerPin, siteManager, authUser, isSiteManager } = useTenant();

  const adminUsers = allUsers.filter(
    u => u.role?.permissions?.all === true || u.role?.name === 'admin'
  );

  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleDigit(d: string) {
    if (pin.length >= 6) return;
    setPin(p => p + d);
    setError('');
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1));
    setError('');
  }

  function handleValidate() {
    const finalReason = reason === 'Autre' ? customReason.trim() : reason;
    if (requireReason && !finalReason) {
      setError('Veuillez selectionner un motif');
      return;
    }

    // Check admin staff users first
    const admin = adminUsers.find(u => u.pin === pin);
    if (admin) {
      setLoading(true);
      onConfirm(admin, finalReason);
      return;
    }

    // Check owner/site manager PIN
    if (ownerPin && pin === ownerPin) {
      setLoading(true);
      const ownerAsUser: UserWithRole = {
        id: authUser?.id ?? siteManager?.id ?? '',
        tenant_id: siteManager?.tenant_id ?? null,
        site_id: siteManager?.site_id ?? null,
        name: siteManager?.name ?? authUser?.email ?? 'Proprietaire',
        pin: ownerPin,
        email: siteManager?.email ?? authUser?.email ?? '',
        role_id: null,
        avatar_url: '',
        is_active: true,
        created_at: '',
        updated_at: '',
        role: { id: '', tenant_id: null, name: 'owner', label: 'Proprietaire', permissions: { all: true }, color: '#3B82F6', created_at: '' },
      };
      onConfirm(ownerAsUser, finalReason);
      return;
    }

    setError('Code PIN invalide');
    setPin('');
  }

  const hasAnyValidator = adminUsers.length > 0 || !!ownerPin;

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

            {/* PIN display */}
            <div className="text-center">
              <p className="text-white/40 text-xs mb-2">Code PIN</p>
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
                onClick={handleValidate}
                disabled={pin.length === 0 || loading}
                className="h-12 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all flex items-center justify-center"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'OK'}
              </button>
            </div>

            {!hasAnyValidator && (
              <p className="text-amber-400/80 text-xs text-center">
                Aucun code PIN configure. Le proprietaire doit d'abord definir son code PIN dans les parametres.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
