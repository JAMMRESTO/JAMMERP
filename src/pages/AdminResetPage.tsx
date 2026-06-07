import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';

const KNOWN_CREDENTIALS = [
  { email: 'superadmin@restobar.com', password: 'SuperAdmin2026!' },
  { email: 'superadmin@restobar.com', password: 'Alioune1982' },
  { email: 'superadmin@senresto.com', password: 'Alioune1982' },
  { email: 'superadmin@senresto.com', password: 'SuperAdmin2026!' },
];

export function AdminResetPage() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [foundEmail, setFoundEmail] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  async function tryAllCredentials() {
    setIsRunning(true);
    setError('');
    setSuccess('');
    setFoundEmail('');

    for (const cred of KNOWN_CREDENTIALS) {
      setStatus(`Tentative: ${cred.email} / ${cred.password.slice(0, 3)}...`);
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: cred.email,
        password: cred.password,
      });
      if (data?.user && !err) {
        setFoundEmail(cred.email);
        setSuccess(`Connexion reussie avec: ${cred.email} / ${cred.password}`);
        setStatus('');
        setIsRunning(false);
        return;
      }
    }

    setStatus('');
    setError('Aucune combinaison connue ne fonctionne. Le compte a ete modifie de facon inconnue. Utilisez le Supabase Dashboard > Authentication > Users pour reinitialiser.');
    setIsRunning(false);
  }

  async function changePassword() {
    if (!newPassword || newPassword.length < 6) {
      setError('Mot de passe minimum 6 caracteres');
      return;
    }
    setChangingPw(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    if (err) {
      setError(err.message);
    } else {
      setSuccess(`Mot de passe change avec succes! Connectez-vous avec: ${foundEmail} / ${newPassword}`);
      await supabase.auth.signOut();
    }
    setChangingPw(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <KeyRound size={18} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Reinitialisation d'urgence</h1>
            <p className="text-white/40 text-xs">Super Admin - Recuperation de compte</p>
          </div>
        </div>

        {!foundEmail && (
          <button
            onClick={tryAllCredentials}
            disabled={isRunning}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : null}
            {isRunning ? 'Test en cours...' : 'Tester toutes les combinaisons connues'}
          </button>
        )}

        {status && (
          <p className="text-white/50 text-xs text-center">{status}</p>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <span className="text-red-400 text-xs">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <span className="text-emerald-400 text-xs">{success}</span>
          </div>
        )}

        {foundEmail && !success.includes('Mot de passe change') && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            <p className="text-white/60 text-xs">
              Votre email reel en base est: <span className="text-white font-semibold">{foundEmail}</span>
            </p>
            <p className="text-white/40 text-xs">
              Vous pouvez changer le mot de passe ci-dessous :
            </p>
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min 6 car.)"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={changePassword}
              disabled={changingPw}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {changingPw ? <Loader2 size={14} className="animate-spin" /> : null}
              Changer le mot de passe
            </button>
          </div>
        )}

        <div className="pt-3 border-t border-white/5">
          <a
            href="/"
            className="text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            Retour a la connexion
          </a>
        </div>
      </div>
    </div>
  );
}
