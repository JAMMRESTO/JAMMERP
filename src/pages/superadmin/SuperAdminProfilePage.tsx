import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Mail, Lock, Save, Loader2, CheckCircle2, AlertTriangle,
  Eye, EyeOff, Bell, BellOff, Phone, MessageSquare,
  Send, Info, ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';

type NotifChannel = 'sms' | 'whatsapp';

export function SuperAdminProfilePage() {
  const { authUser } = useTenant();

  // ── Email ──────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState(authUser?.email ?? '');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError, setEmailError] = useState('');

  // ── Password ───────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showNew, setShowNew] = useState(false);

  // ── Notifications ──────────────────────────────────────────
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPhone, setNotifPhone] = useState('');
  const [notifChannel, setNotifChannel] = useState<NotifChannel>('whatsapp');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState('');
  const [notifError, setNotifError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [notifLoaded, setNotifLoaded] = useState(false);

  useEffect(() => {
    if (!authUser?.id) return;
    supabase
      .from('super_admins')
      .select('notification_phone, notification_channel, notifications_enabled')
      .eq('id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNotifPhone((data as { notification_phone: string | null }).notification_phone ?? '');
          setNotifChannel(((data as { notification_channel: string | null }).notification_channel ?? 'whatsapp') as NotifChannel);
          setNotifEnabled((data as { notifications_enabled: boolean | null }).notifications_enabled ?? false);
        }
        setNotifLoaded(true);
      });
  }, [authUser?.id]);

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(''); setEmailSuccess('');
    if (!newEmail.trim() || newEmail === authUser?.email) return;
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      setEmailError(error.message);
    } else {
      setEmailSuccess('Email mis à jour avec succès');
      await supabase.from('super_admins').update({ email: newEmail.trim() }).eq('id', authUser!.id);
    }
    setEmailSaving(false);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(''); setPasswordSuccess('');
    if (!newPassword || !confirmPassword) { setPasswordError('Veuillez remplir tous les champs'); return; }
    if (newPassword.length < 6) { setPasswordError('Le mot de passe doit contenir au moins 6 caractères'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Les mots de passe ne correspondent pas'); return; }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess('Mot de passe mis à jour avec succès.');
      setNewPassword(''); setConfirmPassword('');
    }
    setPasswordSaving(false);
  }

  async function handleNotifSave(e: React.FormEvent) {
    e.preventDefault();
    setNotifError(''); setNotifSuccess(''); setTestResult(null);
    if (notifEnabled && !notifPhone.trim()) {
      setNotifError('Entrez un numéro de téléphone pour activer les notifications');
      return;
    }
    setNotifSaving(true);
    const { error } = await supabase.from('super_admins').update({
      notification_phone: notifPhone.trim() || null,
      notification_channel: notifChannel,
      notifications_enabled: notifEnabled,
    }).eq('id', authUser!.id);
    if (error) {
      setNotifError(error.message);
    } else {
      setNotifSuccess('Paramètres de notification enregistrés');
    }
    setNotifSaving(false);
  }

  async function handleTest() {
    setTesting(true); setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-new-tenant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ test: true, testPhone: notifPhone.trim(), testChannel: notifChannel }),
        }
      );
      const data = await res.json();
      if (data.skipped) {
        setTestResult({ ok: false, msg: data.reason === 'Twilio credentials not configured'
          ? 'Identifiants Twilio non configurés — voir les instructions ci-dessous'
          : data.reason });
      } else if (data.error) {
        setTestResult({ ok: false, msg: data.error });
      } else {
        const sent = (data.results ?? []).filter((r: { ok: boolean }) => r.ok).length;
        setTestResult({ ok: sent > 0, msg: sent > 0 ? `Message de test envoyé !` : 'Échec d\'envoi — vérifiez vos identifiants Twilio' });
      }
    } catch {
      setTestResult({ ok: false, msg: 'Erreur réseau' });
    }
    setTesting(false);
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-white font-bold text-lg">Mon Profil</h1>
        <p className="text-white/40 text-xs mt-1">Email, mot de passe et notifications</p>
      </div>

      {/* ── Email ─────────────────────────────────────────── */}
      <motion.form
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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
            <div className="px-3 py-2.5 bg-white/3 border border-white/8 rounded-xl text-white/60 text-sm">{authUser?.email}</div>
          </div>
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Nouvel email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
              placeholder="nouveau@email.com"
            />
          </div>
        </div>
        {emailError && <Feedback type="error" msg={emailError} />}
        {emailSuccess && <Feedback type="success" msg={emailSuccess} />}
        <button type="submit" disabled={emailSaving || !newEmail.trim() || newEmail === authUser?.email}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {emailSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Mettre à jour l'email
        </button>
      </motion.form>

      {/* ── Password ──────────────────────────────────────── */}
      <motion.form
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
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
              <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder="Minimum 6 caractères"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Confirmer le nouveau mot de passe</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
              placeholder="Retapez le nouveau mot de passe"
            />
          </div>
        </div>
        {passwordError && <Feedback type="error" msg={passwordError} />}
        {passwordSuccess && <Feedback type="success" msg={passwordSuccess} />}
        <button type="submit" disabled={passwordSaving || !newPassword || !confirmPassword}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {passwordSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
          Modifier le mot de passe
        </button>
      </motion.form>

      {/* ── Notifications ─────────────────────────────────── */}
      <motion.form
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
        onSubmit={handleNotifSave}
        className="bg-white/4 rounded-2xl border border-white/8 p-5 space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-emerald-400" />
            <div>
              <h2 className="text-white font-semibold text-sm">Notifications nouvelles demandes</h2>
              <p className="text-white/35 text-xs mt-0.5">Recevoir un SMS ou WhatsApp à chaque nouvelle inscription</p>
            </div>
          </div>
          {notifLoaded && (
            <button type="button" onClick={() => setNotifEnabled(v => !v)}
              className={`relative w-12 h-6 rounded-full flex-shrink-0 transition-colors ${notifEnabled ? 'bg-emerald-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${notifEnabled ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          )}
        </div>

        {notifEnabled && (
          <div className="space-y-4">
            {/* Channel selector */}
            <div>
              <label className="text-white/50 text-xs font-medium block mb-2">Canal de notification</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'emerald' },
                  { id: 'sms',      label: 'SMS',       icon: Phone,          color: 'blue' },
                ] as const).map(({ id, label, icon: Icon, color }) => (
                  <button key={id} type="button" onClick={() => setNotifChannel(id)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      notifChannel === id
                        ? color === 'emerald'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                        : 'bg-white/3 border-white/8 text-white/40 hover:border-white/15 hover:text-white/60'
                    }`}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone number */}
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">
                Numéro {notifChannel === 'whatsapp' ? 'WhatsApp' : 'de téléphone'}
              </label>
              <input
                type="tel"
                value={notifPhone}
                onChange={e => setNotifPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-white/20"
              />
              <p className="text-white/25 text-[10px] mt-1.5">Format international avec indicatif pays (+221 pour Sénégal)</p>
            </div>

            {/* Twilio setup instructions */}
            <div className="p-3.5 rounded-xl bg-amber-500/6 border border-amber-500/15 space-y-2.5">
              <div className="flex items-center gap-2">
                <Info size={13} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-300 text-xs font-semibold">Configuration requise — Twilio</p>
              </div>
              <p className="text-white/40 text-xs leading-relaxed">
                Les notifications utilisent Twilio. Ajoutez ces 3 secrets dans votre tableau de bord Supabase
                (Paramètres → Edge Functions → Secrets) :
              </p>
              <div className="space-y-1.5">
                {[
                  { key: 'TWILIO_ACCOUNT_SID', desc: 'Votre Account SID Twilio' },
                  { key: 'TWILIO_AUTH_TOKEN',  desc: 'Votre Auth Token Twilio' },
                  { key: 'TWILIO_FROM',        desc: notifChannel === 'whatsapp'
                    ? 'Numéro WhatsApp Twilio (ex: +14155238886 pour sandbox)'
                    : 'Votre numéro Twilio (ex: +12025551234)' },
                ].map(({ key, desc }) => (
                  <div key={key} className="flex items-start gap-2">
                    <code className="text-emerald-400 text-[10px] font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded flex-shrink-0">{key}</code>
                    <span className="text-white/30 text-[10px]">{desc}</span>
                  </div>
                ))}
              </div>
              <a
                href="https://www.twilio.com/try-twilio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
              >
                <ExternalLink size={10} /> Créer un compte Twilio gratuit
              </a>
              {notifChannel === 'whatsapp' && (
                <p className="text-white/30 text-[10px] leading-relaxed border-t border-white/6 pt-2">
                  Pour WhatsApp, activez d'abord le Sandbox Twilio en envoyant <span className="text-white/50 font-mono">"join [mot-clé]"</span> au +1 415 523 8886 depuis votre WhatsApp.
                </p>
              )}
            </div>

            {/* Test button */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleTest} disabled={testing || !notifPhone.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Envoyer un test
              </button>
              {testResult && (
                <span className={`text-xs flex items-center gap-1.5 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {testResult.msg}
                </span>
              )}
            </div>
          </div>
        )}

        {!notifEnabled && notifLoaded && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/6">
            <BellOff size={15} className="text-white/20 flex-shrink-0" />
            <p className="text-white/30 text-xs">Activez le toggle pour recevoir des alertes lors des nouvelles inscriptions.</p>
          </div>
        )}

        {notifError && <Feedback type="error" msg={notifError} />}
        {notifSuccess && <Feedback type="success" msg={notifSuccess} />}

        <button type="submit" disabled={notifSaving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {notifSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer les notifications
        </button>
      </motion.form>
    </div>
  );
}

function Feedback({ type, msg }: { type: 'error' | 'success'; msg: string }) {
  const isError = type === 'error';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isError ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
      {isError
        ? <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
        : <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />}
      <span className={`text-xs ${isError ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</span>
    </div>
  );
}
