import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Save, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';

export function SuperAdminProfilePage() {
  const { authUser } = useTenant();

  const [newEmail, setNewEmail] = useState(authUser?.email ?? '');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showNew, setShowNew] = useState(false);

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    if (!newEmail.trim() || newEmail === authUser?.email) return;

    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });

    if (error) {
      setEmailError(error.message);
    } else {
      setEmailSuccess('Email mis a jour avec succes');
      const { data } = await supabase.from('super_admins').select('id').eq('id', authUser?.id).maybeSingle();
      if (data) {
        await supabase.from('super_admins').update({ email: newEmail.trim() }).eq('id', authUser!.id);
      }
    }
    setEmailSaving(false);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || !confirmPassword) {
      setPasswordError('Veuillez remplir tous les champs');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setPasswordSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess('Mot de passe mis a jour avec succes. Utilisez le nouveau mot de passe a la prochaine connexion.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err?.message ?? 'Erreur inattendue');
    }
    setPasswordSaving(false);
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-white font-bold text-lg">Mon Profil</h1>
        <p className="text-white/40 text-xs mt-1">Modifier votre email et mot de passe</p>
      </div>

      {/* Email Section */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleEmailUpdate}
        className="bg-white/4 rounded-2xl border border-white/8 p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-blue-400" />
          <h2 className="text-white font-semibold text-sm">Adresse email</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Email actuel</label>
            <div className="px-3 py-2.5 bg-white/3 border border-white/8 rounded-xl text-white/60 text-sm">
              {authUser?.email}
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Nouvel email</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
              placeholder="nouveau@email.com"
            />
          </div>
        </div>

        {emailError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-xs">{emailError}</span>
          </div>
        )}
        {emailSuccess && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400 text-xs">{emailSuccess}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={emailSaving || !newEmail.trim() || newEmail === authUser?.email}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {emailSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Mettre a jour l'email
        </button>
      </motion.form>

      {/* Password Section */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        onSubmit={handlePasswordUpdate}
        className="bg-white/4 rounded-2xl border border-white/8 p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-amber-400" />
          <h2 className="text-white font-semibold text-sm">Mot de passe</h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="Minimum 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
              placeholder="Retapez le nouveau mot de passe"
            />
          </div>
        </div>

        {passwordError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
            <span className="text-red-400 text-xs">{passwordError}</span>
          </div>
        )}
        {passwordSuccess && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400 text-xs">{passwordSuccess}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={passwordSaving || !newPassword || !confirmPassword}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {passwordSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          Modifier le mot de passe
        </button>
      </motion.form>
    </div>
  );
}
