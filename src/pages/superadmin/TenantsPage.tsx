import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Search, Globe, CheckCircle2, XCircle,
  Pencil, Trash2, Save, X, Loader2, RefreshCw, MapPin,
  ChevronDown, ChevronUp, Activity, Clock, Check, Ban,
  AlertCircle, ShieldCheck, Users, Calendar, Zap, AlertTriangle,
  RotateCcw, CalendarClock, ShoppingCart, Truck, Utensils,
  FlaskConical, BarChart2, BookOpen, Package, AlertOctagon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { Tenant, Site, TenantStatus } from '../../types/database';

interface TenantWithSites extends Tenant {
  sites: Site[];
  owner_email?: string;
}

const PLANS = ['starter', 'pro', 'enterprise'];

// Duration in months per plan
const PLAN_DURATIONS: Record<string, number> = {
  starter: 1,
  pro: 3,
  enterprise: 12,
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter — 1 mois',
  pro: 'Pro — 3 mois',
  enterprise: 'Enterprise — 12 mois',
};

const PLAN_COLORS: Record<string, string> = {
  starter: 'text-sky-400 bg-sky-500/12 border-sky-500/20',
  pro: 'text-amber-400 bg-amber-500/12 border-amber-500/20',
  enterprise: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/20',
};

const STATUS_CONFIG: Record<TenantStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'En attente',  color: 'text-amber-400 bg-amber-500/12 border-amber-500/20',   icon: <Clock size={9} /> },
  approved:  { label: 'Approuvé',   color: 'text-sky-400 bg-sky-500/12 border-sky-500/20',          icon: <ShieldCheck size={9} /> },
  active:    { label: 'Actif',       color: 'text-emerald-400 bg-emerald-500/12 border-emerald-500/20', icon: <Activity size={9} /> },
  rejected:  { label: 'Rejeté',     color: 'text-red-400 bg-red-500/12 border-red-500/20',          icon: <Ban size={9} /> },
  suspended: { label: 'Suspendu',   color: 'text-orange-400 bg-orange-500/12 border-orange-500/20', icon: <XCircle size={9} /> },
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function daysUntilExpiry(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// ─── Approve Modal ──────────────────────────────────────────

function ApproveModal({
  tenant, onClose, onDone,
}: {
  tenant: TenantWithSites; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [plan, setPlan] = useState('starter');
  const [saving, setSaving] = useState(false);

  const expiryDate = addMonths(new Date(), PLAN_DURATIONS[plan] ?? 1);

  async function handleApprove() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error: tenantErr } = await supabase
      .from('tenants')
      .update({
        status: 'active',
        plan,
        is_active: true,
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
        subscription_expires_at: expiryDate.toISOString(),
        suspended_at: null,
        suspension_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenant.id);

    if (tenantErr) { toast('error', tenantErr.message); setSaving(false); return; }

    if (tenant.sites.length === 0) {
      const slug = tenant.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await supabase.from('sites').insert({ tenant_id: tenant.id, name: tenant.name, slug: slug || 'principal' });
    }

    toast('success', `"${tenant.name}" approuvé — plan ${plan}, expire le ${formatExpiry(expiryDate.toISOString())}`);
    setSaving(false);
    onDone();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Approuver le compte</h3>
            <p className="text-white/35 text-xs">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/3 border border-white/8 space-y-2">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Informations</p>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs">Établissement</span>
              <span className="text-white text-xs font-semibold">{tenant.name}</span>
            </div>
            {tenant.owner_email && (
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">Email</span>
                <span className="text-white text-xs">{tenant.owner_email}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs">Inscription</span>
              <span className="text-white text-xs">{new Date(tenant.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
          </div>

          <div>
            <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Choisir un plan</label>
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  className={`py-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                    plan === p
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-white/3 border-white/8 text-white/40 hover:border-white/15 hover:text-white/60'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-xl bg-white/3 border border-white/6 space-y-1.5">
              <p className="text-white/50 text-[10px] leading-relaxed">
                {plan === 'starter' && 'Fonctionnalités essentielles — POS, caisse, rapports de base.'}
                {plan === 'pro' && 'Tout Starter + livraisons, cuisine, stock, production.'}
                {plan === 'enterprise' && 'Tout Pro + multi-sites illimités, API, support prioritaire.'}
              </p>
              <div className="flex items-center gap-1.5 pt-1 border-t border-white/6">
                <CalendarClock size={11} className="text-emerald-400 flex-shrink-0" />
                <span className="text-white/40 text-[10px]">
                  Durée : <span className="text-white/70 font-semibold">{PLAN_LABELS[plan]}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={11} className="text-sky-400 flex-shrink-0" />
                <span className="text-white/40 text-[10px]">
                  Expiration : <span className="text-sky-300 font-semibold">{formatExpiry(expiryDate.toISOString())}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Annuler</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleApprove} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} />Approuver</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Reject Modal ───────────────────────────────────────────

function RejectModal({
  tenant, onClose, onDone,
}: {
  tenant: TenantWithSites; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleReject() {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      status: 'rejected',
      rejection_reason: reason.trim() || null,
      is_active: false,
      updated_at: new Date().toISOString(),
    }).eq('id', tenant.id);
    if (error) { toast('error', error.message); setSaving(false); return; }
    toast('success', `Demande de "${tenant.name}" rejetée`);
    setSaving(false);
    onDone();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <Ban size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Rejeter la demande</h3>
            <p className="text-white/35 text-xs">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <X size={14} />
          </button>
        </div>
        <div>
          <label className="block text-white/50 text-xs font-medium mb-1.5">Motif de refus <span className="text-white/20">(optionnel)</span></label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Ex: Informations insuffisantes, secteur non éligible..."
            className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25 resize-none"
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Annuler</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleReject} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <><Ban size={14} />Rejeter</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Manual Suspend Modal ────────────────────────────────────

function SuspendModal({
  tenant, onClose, onDone,
}: {
  tenant: TenantWithSites; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSuspend() {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      status: 'suspended',
      is_active: false,
      suspended_at: new Date().toISOString(),
      suspension_reason: reason.trim() || 'Suspension manuelle par l\'administrateur',
      updated_at: new Date().toISOString(),
    }).eq('id', tenant.id);
    if (error) { toast('error', error.message); setSaving(false); return; }
    toast('success', `"${tenant.name}" suspendu`);
    setSaving(false);
    onDone();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <XCircle size={18} className="text-orange-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Suspendre le compte</h3>
            <p className="text-white/35 text-xs">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <X size={14} />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/20 mb-4">
          <p className="text-orange-300 text-xs leading-relaxed">
            La suspension bloque immédiatement l'accès du tenant à la plateforme. Cette action est réversible.
          </p>
        </div>

        <div>
          <label className="block text-white/50 text-xs font-medium mb-1.5">Motif <span className="text-white/20">(optionnel)</span></label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Ex: Non-paiement, violation des CGU..."
            className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25 resize-none"
          />
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Annuler</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSuspend} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} />Suspendre</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Reactivate Modal ────────────────────────────────────────

function ReactivateModal({
  tenant, onClose, onDone,
}: {
  tenant: TenantWithSites; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [plan, setPlan] = useState(tenant.plan || 'starter');
  const [saving, setSaving] = useState(false);

  const expiryDate = addMonths(new Date(), PLAN_DURATIONS[plan] ?? 1);

  async function handleReactivate() {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      status: 'active',
      is_active: true,
      plan,
      subscription_expires_at: expiryDate.toISOString(),
      suspended_at: null,
      suspension_reason: null,
      updated_at: new Date().toISOString(),
    }).eq('id', tenant.id);
    if (error) { toast('error', error.message); setSaving(false); return; }
    toast('success', `"${tenant.name}" réactivé jusqu'au ${formatExpiry(expiryDate.toISOString())}`);
    setSaving(false);
    onDone();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <RotateCcw size={18} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Réactiver le compte</h3>
            <p className="text-white/35 text-xs">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <X size={14} />
          </button>
        </div>

        {tenant.suspension_reason && (
          <div className="p-3 rounded-xl bg-orange-500/8 border border-orange-500/20 mb-4">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-1">Motif de suspension</p>
            <p className="text-orange-300 text-xs">{tenant.suspension_reason}</p>
          </div>
        )}

        <div>
          <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Nouveau plan</label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PLANS.map(p => (
              <button key={p} onClick={() => setPlan(p)}
                className={`py-3 rounded-xl border text-xs font-bold capitalize transition-all ${
                  plan === p
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/3 border-white/8 text-white/40 hover:border-white/15 hover:text-white/60'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="p-3 rounded-xl bg-white/3 border border-white/6 flex items-center gap-2">
            <Calendar size={12} className="text-sky-400 flex-shrink-0" />
            <span className="text-white/40 text-xs">
              Expire le : <span className="text-sky-300 font-semibold">{formatExpiry(expiryDate.toISOString())}</span>
              <span className="text-white/25 ml-1">({PLAN_LABELS[plan]})</span>
            </span>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Annuler</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleReactivate} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <><RotateCcw size={14} />Réactiver</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Tenant Edit Form ───────────────────────────────────────

function TenantForm({
  tenant, onSave, onCancel,
}: {
  tenant: TenantWithSites; onSave: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: tenant.name,
    slug: tenant.slug,
    plan: tenant.plan,
    is_active: tenant.is_active,
    subscription_expires_at: tenant.subscription_expires_at
      ? tenant.subscription_expires_at.slice(0, 10)
      : '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) { toast('error', 'Le nom est requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('tenants').update({
      name: form.name,
      slug: form.slug,
      plan: form.plan,
      is_active: form.is_active,
      subscription_expires_at: form.subscription_expires_at
        ? new Date(form.subscription_expires_at).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }).eq('id', tenant.id);
    if (error) { toast('error', error.message); setSaving(false); return; }
    toast('success', 'Tenant modifié');
    setSaving(false);
    onSave();
  }

  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold">Modifier le tenant</h3>
        <button onClick={onCancel} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-white/50 text-xs font-medium mb-1.5">Nom</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25"
          />
        </div>
        <div>
          <label className="block text-white/50 text-xs font-medium mb-1.5">Slug</label>
          <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 font-mono"
          />
        </div>
        <div>
          <label className="block text-white/50 text-xs font-medium mb-1.5">Plan</label>
          <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
            className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 bg-gray-900"
          >
            {PLANS.map(p => <option key={p} value={p} className="bg-gray-800">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-white/50 text-xs font-medium mb-1.5">Date d'expiration</label>
          <input type="date" value={form.subscription_expires_at}
            onChange={e => setForm(f => ({ ...f, subscription_expires_at: e.target.value }))}
            className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25"
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <div className="flex items-center gap-3 pt-4">
          <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-emerald-500' : 'bg-white/15'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : ''}`} />
          </button>
          <span className="text-white/60 text-sm">{form.is_active ? 'Actif' : 'Inactif'}</span>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/80 text-sm transition-all">Annuler</button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} />Enregistrer</>}
        </motion.button>
      </div>
    </div>
  );
}

// ─── Add Site Modal ─────────────────────────────────────────

function AddSiteModal({
  tenantId, onClose, onCreated,
}: {
  tenantId: string; onClose: () => void; onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleName(v: string) {
    setName(v);
    if (!slugEdited) setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  }

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) { toast('error', 'Nom et identifiant requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('sites').insert({ tenant_id: tenantId, name, slug, address });
    setSaving(false);
    if (error) { toast('error', error.message); return; }
    toast('success', 'Site créé');
    onCreated();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold">Ajouter un site</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-white/50 text-xs font-medium mb-1">Nom du site</label>
            <input type="text" value={name} onChange={e => handleName(e.target.value)} placeholder="Dakar Centre"
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25" autoFocus
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs font-medium mb-1">Identifiant</label>
            <input type="text" value={slug} onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 font-mono"
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs font-medium mb-1">Adresse (optionnel)</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 rue du Commerce"
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Annuler</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Créer'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Subscription Badge ─────────────────────────────────────

function SubscriptionBadge({ tenant }: { tenant: TenantWithSites }) {
  if (tenant.status !== 'active' && tenant.status !== 'suspended') return null;
  const days = daysUntilExpiry(tenant.subscription_expires_at);

  if (tenant.subscription_expires_at === null) {
    return (
      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 border border-white/10 text-white/30">
        <Calendar size={8} /> Pas d'expiration
      </span>
    );
  }

  if (days === null) return null;

  if (days < 0) {
    return (
      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-semibold">
        <AlertTriangle size={8} /> Expiré il y a {Math.abs(days)}j
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-semibold">
        <AlertCircle size={8} /> Expire dans {days}j
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white/4 border border-white/8 text-white/25">
      <Calendar size={8} /> {formatExpiry(tenant.subscription_expires_at)}
    </span>
  );
}

// ─── Pending Request Card ───────────────────────────────────

function PendingCard({
  tenant, onApprove, onReject,
}: {
  tenant: TenantWithSites; onApprove: () => void; onReject: () => void;
}) {
  const daysAgo = Math.floor((Date.now() - new Date(tenant.created_at).getTime()) / 86400000);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-2xl border border-amber-500/20 bg-amber-500/4 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Building2 size={16} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-bold text-sm">{tenant.name}</p>
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-500/12 text-amber-400 border-amber-500/20">
              <Clock size={8} /> En attente
            </span>
          </div>
          {tenant.owner_email && <p className="text-white/40 text-xs mt-0.5">{tenant.owner_email}</p>}
          <p className="text-white/25 text-[10px] mt-0.5">
            Inscrit {daysAgo === 0 ? "aujourd'hui" : `il y a ${daysAgo} jour${daysAgo > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onApprove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
          >
            <Check size={12} /> Approuver
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400 text-xs font-semibold transition-all"
          >
            <Ban size={12} /> Rejeter
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Modules config ─────────────────────────────────────────

type ModuleKey = 'pos' | 'delivery' | 'kitchen' | 'inventory' | 'reports' | 'reservations' | 'production';

const MODULE_CONFIG: { key: ModuleKey; label: string; description: string; icon: React.ReactNode }[] = [
  { key: 'pos',          label: 'Point de vente',      description: 'Caisse, ventes, tickets',            icon: <ShoppingCart size={13} /> },
  { key: 'delivery',     label: 'Livraisons',          description: 'Gestion des livraisons',             icon: <Truck size={13} /> },
  { key: 'kitchen',      label: 'Commandes cuisine',   description: 'Écran cuisine, préparation',         icon: <Utensils size={13} /> },
  { key: 'inventory',    label: 'Inventaire',          description: 'Stock, mouvements',                  icon: <Package size={13} /> },
  { key: 'reports',      label: 'Rapports',            description: 'Statistiques et analyses',           icon: <BarChart2 size={13} /> },
  { key: 'reservations', label: 'Commandes en ligne',  description: 'Menu en ligne, commandes client',    icon: <BookOpen size={13} /> },
  { key: 'production',   label: 'Production',          description: 'Recettes, ingrédients, entrepôts',   icon: <FlaskConical size={13} /> },
];

function ModulesPanel({ tenant, onSaved }: { tenant: TenantWithSites; onSaved: () => void }) {
  const toast = useToast();
  const defaultModules: Record<ModuleKey, boolean> = {
    pos: true, delivery: true, kitchen: true,
    inventory: true, reports: true, reservations: true, production: true,
  };
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    ...defaultModules,
    ...(tenant.allowed_modules ?? {}),
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('tenants')
      .update({ allowed_modules: modules, updated_at: new Date().toISOString() })
      .eq('id', tenant.id);
    setSaving(false);
    if (error) { toast('error', error.message); return; }
    toast('success', 'Modules mis à jour');
    onSaved();
  }

  function toggle(key: ModuleKey) {
    setModules(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="p-3 rounded-xl bg-white/3 border border-white/6 space-y-2">
      <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider mb-2">Modules autorisés</p>
      <div className="grid grid-cols-1 gap-1.5">
        {MODULE_CONFIG.map(mod => {
          const enabled = modules[mod.key] ?? true;
          return (
            <button
              key={mod.key}
              onClick={() => toggle(mod.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                enabled
                  ? 'bg-emerald-500/8 border-emerald-500/20 hover:bg-emerald-500/12'
                  : 'bg-white/3 border-white/8 hover:bg-white/5'
              }`}
            >
              <div className={`flex-shrink-0 transition-colors ${enabled ? 'text-emerald-400' : 'text-white/20'}`}>
                {mod.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${enabled ? 'text-white' : 'text-white/35'}`}>{mod.label}</p>
                <p className={`text-[10px] ${enabled ? 'text-white/35' : 'text-white/20'}`}>{mod.description}</p>
              </div>
              <div className={`w-8 h-4.5 rounded-full relative transition-colors flex-shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-white/15'}`}
                style={{ height: '18px', width: '32px' }}
              >
                <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[14px]' : 'left-0.5'}`} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end pt-1">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <><Save size={12} />Enregistrer</>}
        </motion.button>
      </div>
    </div>
  );
}

// ─── Tenant Row ─────────────────────────────────────────────

function TenantRow({
  tenant, onEdit, onRefresh, onSuspend, onReactivate, onDelete,
}: {
  tenant: TenantWithSites;
  onEdit: () => void;
  onRefresh: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showAddSite, setShowAddSite] = useState(false);
  const [deletingSite, setDeletingSite] = useState<string | null>(null);
  const statusCfg = STATUS_CONFIG[tenant.status] ?? STATUS_CONFIG.active;
  const expired = isExpired(tenant.subscription_expires_at);
  const days = daysUntilExpiry(tenant.subscription_expires_at);

  async function handleDeleteSite(siteId: string) {
    setDeletingSite(siteId);
    const { error } = await supabase.from('sites').update({ is_active: false }).eq('id', siteId);
    setDeletingSite(null);
    if (error) { toast('error', error.message); return; }
    toast('success', 'Site désactivé');
    onRefresh();
  }

  async function handleToggleSite(site: Site) {
    const { error } = await supabase.from('sites').update({ is_active: !site.is_active }).eq('id', site.id);
    if (error) { toast('error', error.message); return; }
    onRefresh();
  }

  const isSuspended = tenant.status === 'suspended';
  const isActive = tenant.status === 'active';

  return (
    <>
      <div className={`rounded-2xl border transition-all overflow-hidden ${
        expired && isActive
          ? 'border-red-500/25 bg-red-500/3'
          : isSuspended
          ? 'border-orange-500/20 bg-orange-500/3'
          : 'border-white/8 bg-white/3 hover:border-white/12'
      }`}>
        <div className="flex items-center gap-4 p-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isSuspended ? 'bg-orange-500/12 border border-orange-500/20' : 'bg-blue-500/12 border border-blue-500/20'
          }`}>
            <Building2 size={16} className={isSuspended ? 'text-orange-400' : 'text-blue-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-bold text-sm">{tenant.name}</p>
              <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${statusCfg.color}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PLAN_COLORS[tenant.plan] ?? 'text-white/40 bg-white/6 border-white/10'}`}>
                {tenant.plan}
              </span>
              <SubscriptionBadge tenant={tenant} />
            </div>
            <p className="text-white/25 text-[10px] font-mono mt-0.5">{tenant.slug}</p>
            {tenant.owner_email && <p className="text-white/30 text-[10px] mt-0.5">{tenant.owner_email}</p>}
            {isSuspended && tenant.suspension_reason && (
              <p className="text-orange-300/60 text-[10px] mt-0.5 flex items-center gap-1">
                <XCircle size={8} />{tenant.suspension_reason}
              </p>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-right">
            <div>
              <p className="text-white font-bold text-sm">{tenant.sites.length}</p>
              <p className="text-white/30 text-[10px]">sites</p>
            </div>
            {days !== null && !isSuspended && (
              <div>
                <p className={`font-bold text-sm ${days < 0 ? 'text-red-400' : days <= 7 ? 'text-amber-400' : 'text-white/60'}`}>
                  {days < 0 ? 'Expiré' : `${days}j`}
                </p>
                <p className="text-white/30 text-[10px]">abonnement</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={onEdit} title="Modifier"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-blue-500/15 text-white/40 hover:text-blue-400 flex items-center justify-center transition-all"
            >
              <Pencil size={13} />
            </button>
            {isSuspended ? (
              <button onClick={onReactivate} title="Réactiver"
                className="w-8 h-8 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition-all"
              >
                <RotateCcw size={13} />
              </button>
            ) : isActive ? (
              <button onClick={onSuspend} title="Suspendre manuellement"
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-orange-500/15 text-white/40 hover:text-orange-400 flex items-center justify-center transition-all"
              >
                <XCircle size={13} />
              </button>
            ) : null}
            <button onClick={() => setExpanded(v => !v)}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <button onClick={onDelete} title="Supprimer définitivement"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/25 hover:text-red-400 flex items-center justify-center transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="border-t border-white/8 p-4 space-y-2">
                {/* Subscription details */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/6 space-y-1.5 mb-3">
                  <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider">Abonnement</p>
                  <div className="flex items-center justify-between">
                    <span className="text-white/35 text-xs">Plan</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PLAN_COLORS[tenant.plan] ?? 'text-white/40 bg-white/6 border-white/10'}`}>
                      {tenant.plan}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/35 text-xs">Expiration</span>
                    <span className={`text-xs font-medium ${expired ? 'text-red-400' : days !== null && days <= 7 ? 'text-amber-400' : 'text-white/60'}`}>
                      {formatExpiry(tenant.subscription_expires_at)}
                    </span>
                  </div>
                  {tenant.approved_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/35 text-xs">Approuvé le</span>
                      <span className="text-white/40 text-xs">{formatExpiry(tenant.approved_at)}</span>
                    </div>
                  )}
                  {isSuspended && tenant.suspended_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/35 text-xs">Suspendu le</span>
                      <span className="text-orange-400 text-xs">{formatExpiry(tenant.suspended_at)}</span>
                    </div>
                  )}
                </div>

                <ModulesPanel tenant={tenant} onSaved={onRefresh} />

                <div className="flex items-center justify-between mb-3">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Sites ({tenant.sites.length})</p>                  <button onClick={() => setShowAddSite(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/12 hover:bg-blue-500/20 text-blue-400 text-xs font-medium transition-all"
                  >
                    <Plus size={11} /> Ajouter
                  </button>
                </div>
                {tenant.sites.length === 0 ? (
                  <p className="text-white/25 text-xs text-center py-4">Aucun site</p>
                ) : (
                  tenant.sites.map(site => (
                    <div key={site.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/6">
                      <div className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center flex-shrink-0">
                        <Globe size={12} className="text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{site.name}</p>
                        {site.address && <p className="text-white/30 text-[10px] flex items-center gap-0.5 truncate"><MapPin size={8} />{site.address}</p>}
                        <p className="text-white/20 text-[9px] font-mono">{site.slug}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {site.is_active
                          ? <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400"><Activity size={7} />Actif</span>
                          : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/30">Inactif</span>
                        }
                        <button onClick={() => handleToggleSite(site)}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white flex items-center justify-center transition-all"
                        >
                          {site.is_active ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
                        </button>
                        <button onClick={() => handleDeleteSite(site.id)} disabled={deletingSite === site.id}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/15 text-white/30 hover:text-red-400 flex items-center justify-center transition-all disabled:opacity-50"
                        >
                          {deletingSite === site.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAddSite && (
          <AddSiteModal tenantId={tenant.id} onClose={() => setShowAddSite(false)} onCreated={() => { setShowAddSite(false); onRefresh(); }} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Auto-Suspend Confirmation Modal ────────────────────────

function AutoSuspendConfirmModal({
  expiredTenants, onClose, onDone,
}: {
  expiredTenants: TenantWithSites[]; onClose: () => void; onDone: (count: number) => void;
}) {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleRun() {
    setRunning(true);
    let count = 0;
    for (const t of expiredTenants) {
      const { error } = await supabase.from('tenants').update({
        status: 'suspended',
        is_active: false,
        suspended_at: new Date().toISOString(),
        suspension_reason: 'subscription_expired',
        updated_at: new Date().toISOString(),
      }).eq('id', t.id);
      if (!error) count++;
      setProgress(p => p + 1);
    }
    setRunning(false);
    toast('success', `${count} compte${count > 1 ? 's' : ''} suspendu${count > 1 ? 's' : ''} pour abonnement expiré`);
    onDone(count);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !running) onClose(); }}
    >
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <Zap size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-bold">Suspension automatique</h3>
            <p className="text-white/35 text-xs">{expiredTenants.length} compte{expiredTenants.length > 1 ? 's' : ''} concerné{expiredTenants.length > 1 ? 's' : ''}</p>
          </div>
          {!running && (
            <button onClick={onClose} className="ml-auto w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="p-3 rounded-xl bg-red-500/8 border border-red-500/20 mb-4">
          <p className="text-red-300 text-xs leading-relaxed">
            Les comptes dont l'abonnement est expiré vont être suspendus automatiquement. Leur accès sera bloqué immédiatement.
          </p>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto mb-5" style={{ scrollbarWidth: 'thin' }}>
          {expiredTenants.map(t => {
            const d = daysUntilExpiry(t.subscription_expires_at);
            return (
              <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3 border border-white/6">
                <Building2 size={13} className="text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{t.name}</p>
                  <p className="text-white/30 text-[10px]">{t.plan} — {t.owner_email ?? t.slug}</p>
                </div>
                <span className="text-red-400 text-[10px] font-semibold flex-shrink-0">
                  {d !== null ? `Expiré il y a ${Math.abs(d)}j` : 'Expiré'}
                </span>
              </div>
            );
          })}
        </div>

        {running && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
              <span>Traitement en cours...</span>
              <span>{progress}/{expiredTenants.length}</span>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-500 rounded-full"
                animate={{ width: `${(progress / expiredTenants.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          {!running && (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Annuler</button>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleRun} disabled={running}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-70"
          >
            {running
              ? <><Loader2 size={14} className="animate-spin" />Traitement...</>
              : <><Zap size={14} />Suspendre {expiredTenants.length} compte{expiredTenants.length > 1 ? 's' : ''}</>
            }
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Tenant Modal ─────────────────────────────────────

function DeleteTenantModal({
  tenant, onClose, onDone,
}: {
  tenant: TenantWithSites; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const isConfirmed = confirmName.trim().toLowerCase() === tenant.name.trim().toLowerCase();

  async function handleDelete() {
    if (!isConfirmed) return;
    setDeleting(true);
    setLog([]);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast('error', 'Session expirée'); setDeleting(false); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    const res = await fetch(`${supabaseUrl}/functions/v1/delete-tenant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tenantId: tenant.id }),
    });

    const data = await res.json();
    setDeleting(false);

    if (!res.ok || data.error) {
      toast('error', data.error ?? 'Erreur lors de la suppression');
      return;
    }

    setLog(data.log ?? []);
    toast('success', `"${tenant.name}" supprimé définitivement`);
    setTimeout(() => onDone(), 1200);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-gray-900 border border-red-500/25 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
            <AlertOctagon size={18} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold">Supprimer définitivement</h3>
            <p className="text-white/35 text-xs truncate">{tenant.name}</p>
          </div>
          {!deleting && (
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-red-500/8 border border-red-500/20 mb-5 space-y-2">
          <p className="text-red-300 text-xs font-semibold">Cette action est irréversible et supprimera :</p>
          <ul className="space-y-1">
            {[
              `Le tenant "${tenant.name}" et ses ${tenant.sites.length} site(s)`,
              'Toutes les ventes, produits, commandes, stocks',
              'Tous les utilisateurs et comptes associés',
              'Toutes les données opérationnelles',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-red-400/80">
                <span className="text-red-500 mt-0.5 flex-shrink-0">•</span> {item}
              </li>
            ))}
          </ul>
        </div>

        {log.length > 0 ? (
          <div className="p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 space-y-1 mb-4">
            {log.map((line, i) => (
              <p key={i} className="flex items-center gap-2 text-xs text-emerald-400">
                <Check size={11} className="flex-shrink-0" /> {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-white/50 text-xs font-medium mb-2">
              Tapez <span className="text-white font-bold font-mono">{tenant.name.trim()}</span> pour confirmer
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={tenant.name}
              disabled={deleting}
              className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-red-500/40 transition-all disabled:opacity-50"
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-3">
          {!deleting && log.length === 0 && (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">
              Annuler
            </button>
          )}
          {log.length === 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleDelete}
              disabled={!isConfirmed || deleting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting
                ? <><Loader2 size={14} className="animate-spin" />Suppression...</>
                : <><Trash2 size={14} />Supprimer définitivement</>
              }
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

type Tab = 'pending' | 'all';

export function TenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState<TenantWithSites[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('pending');
  const [editingTenant, setEditingTenant] = useState<TenantWithSites | null>(null);
  const [approvingTenant, setApprovingTenant] = useState<TenantWithSites | null>(null);
  const [rejectingTenant, setRejectingTenant] = useState<TenantWithSites | null>(null);
  const [suspendingTenant, setSuspendingTenant] = useState<TenantWithSites | null>(null);
  const [reactivatingTenant, setReactivatingTenant] = useState<TenantWithSites | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<TenantWithSites | null>(null);
  const [showAutoSuspend, setShowAutoSuspend] = useState(false);

  async function load() {
    setRefreshing(true);
    const [tenantsRes, sitesRes] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('sites').select('*').order('name'),
    ]);
    const allTenants = (tenantsRes.data ?? []) as Tenant[];
    const allSites = (sitesRes.data ?? []) as Site[];
    const sitesByTenant: Record<string, Site[]> = {};
    for (const s of allSites) {
      if (!sitesByTenant[s.tenant_id]) sitesByTenant[s.tenant_id] = [];
      sitesByTenant[s.tenant_id].push(s);
    }
    setTenants(allTenants.map(t => ({ ...t, sites: sitesByTenant[t.id] ?? [] })));
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  const pendingTenants = tenants.filter(t => t.status === 'pending');
  const activeTenants = tenants.filter(t => t.status !== 'pending');
  const expiredActiveTenants = tenants.filter(t =>
    t.status === 'active' && isExpired(t.subscription_expires_at)
  );

  const filteredActive = activeTenants.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = pendingTenants.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black">Tenants</h1>
          <p className="text-white/35 text-sm mt-0.5">{tenants.length} compte{tenants.length > 1 ? 's' : ''} enregistré{tenants.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {expiredActiveTenants.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAutoSuspend(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/12 hover:bg-red-500/20 border border-red-500/25 text-red-400 hover:text-red-300 text-sm font-semibold transition-all"
            >
              <Zap size={13} />
              Suspendre expirés
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {expiredActiveTenants.length}
              </span>
            </motion.button>
          )}
          <button onClick={load} disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white text-sm transition-all"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Expired banner */}
      <AnimatePresence>
        {expiredActiveTenants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-500/8 border border-red-500/20"
          >
            <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-300 text-sm font-semibold">
                {expiredActiveTenants.length} compte{expiredActiveTenants.length > 1 ? 's' : ''} avec abonnement expiré
              </p>
              <p className="text-red-400/60 text-xs mt-0.5">
                Ces comptes sont encore actifs — utilisez la suspension automatique pour les bloquer.
              </p>
            </div>
            <button
              onClick={() => setShowAutoSuspend(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold transition-all flex-shrink-0"
            >
              <Zap size={11} /> Agir
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-2xl p-1 border border-white/8 w-fit">
        <button onClick={() => setTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/25' : 'text-white/40 hover:text-white/70'}`}
        >
          <Clock size={13} />
          Demandes
          {pendingCount > 0 && (
            <span className="ml-0.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'all' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          <Users size={13} />
          Tous les tenants
          {expiredActiveTenants.length > 0 && (
            <span className="ml-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
              {expiredActiveTenants.length}
            </span>
          )}
        </button>
      </div>

      {/* Edit form inline */}
      <AnimatePresence>
        {editingTenant && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <TenantForm
              tenant={editingTenant}
              onSave={() => { setEditingTenant(null); load(); }}
              onCancel={() => setEditingTenant(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : tab === 'pending' ? (
        <>
          {pendingTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-white/8 bg-white/3">
              <CheckCircle2 size={32} className="text-emerald-400/30 mb-3" />
              <p className="text-white/40 text-sm">Aucune demande en attente</p>
              <p className="text-white/20 text-xs mt-1">Toutes les demandes ont été traitées</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-white/30 text-xs flex items-center gap-2">
                <AlertCircle size={12} className="text-amber-400" />
                {pendingCount} demande{pendingCount > 1 ? 's' : ''} en attente de validation
              </p>
              <AnimatePresence>
                {pendingTenants.map(tenant => (
                  <PendingCard
                    key={tenant.id}
                    tenant={tenant}
                    onApprove={() => setApprovingTenant(tenant)}
                    onReject={() => setRejectingTenant(tenant)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un tenant..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25 transition-all"
            />
          </div>

          {filteredActive.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-white/8 bg-white/3">
              <Building2 size={32} className="text-white/15 mb-3" />
              <p className="text-white/40 text-sm">{search ? 'Aucun résultat' : 'Aucun tenant'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActive.map(tenant => (
                <TenantRow
                  key={tenant.id}
                  tenant={tenant}
                  onEdit={() => setEditingTenant(tenant)}
                  onRefresh={load}
                  onSuspend={() => setSuspendingTenant(tenant)}
                  onReactivate={() => setReactivatingTenant(tenant)}
                  onDelete={() => setDeletingTenant(tenant)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {approvingTenant && (
          <ApproveModal tenant={approvingTenant} onClose={() => setApprovingTenant(null)} onDone={() => { setApprovingTenant(null); load(); }} />
        )}
        {rejectingTenant && (
          <RejectModal tenant={rejectingTenant} onClose={() => setRejectingTenant(null)} onDone={() => { setRejectingTenant(null); load(); }} />
        )}
        {suspendingTenant && (
          <SuspendModal tenant={suspendingTenant} onClose={() => setSuspendingTenant(null)} onDone={() => { setSuspendingTenant(null); load(); }} />
        )}
        {reactivatingTenant && (
          <ReactivateModal tenant={reactivatingTenant} onClose={() => setReactivatingTenant(null)} onDone={() => { setReactivatingTenant(null); load(); }} />
        )}
        {deletingTenant && (
          <DeleteTenantModal tenant={deletingTenant} onClose={() => setDeletingTenant(null)} onDone={() => { setDeletingTenant(null); load(); }} />
        )}
        {showAutoSuspend && (
          <AutoSuspendConfirmModal
            expiredTenants={expiredActiveTenants}
            onClose={() => setShowAutoSuspend(false)}
            onDone={() => { setShowAutoSuspend(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
