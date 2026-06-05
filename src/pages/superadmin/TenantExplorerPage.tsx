import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, ChevronRight, ChevronDown, MapPin, Users,
  Shield, ShoppingCart, Package, Eye, EyeOff,
  RefreshCw, Search, Globe, Activity, XCircle, KeyRound,
  User, CheckCircle2, Phone, Mail, Lock, Pencil, X, Save,
  ChefHat, Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { Tenant, Site } from '../../types/database';

interface StaffUser {
  id: string;
  name: string;
  pin: string;
  email: string | null;
  is_active: boolean;
  avatar_url: string | null;
  site_id: string | null;
  tenant_id: string | null;
  created_at: string;
  role: { id: string; name: string; label: string; color: string } | null;
}

interface SiteWithUsers extends Site {
  users: StaffUser[];
  cashierEmail?: string | null;
  cashierAuthId?: string | null;
}

interface TenantFull extends Tenant {
  owner_email?: string;
  sites: SiteWithUsers[];
}

const ROLE_CONFIG: Record<string, { color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  admin:   { color: '#EF4444', icon: Shield },
  cashier: { color: '#F59E0B', icon: ShoppingCart },
};

function getRoleCfg(name?: string | null) {
  return ROLE_CONFIG[name ?? ''] ?? { color: '#3B82F6', icon: Package };
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

async function callSuperAdminFn(action: string, params: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

// ─── Reveal cell (PIN or password) ─────────────────────────────────────────

function RevealCell({ value, mono = true }: { value: string; mono?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      onClick={() => setRevealed(v => !v)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 transition-all group"
    >
      {revealed ? (
        <>
          <span className={`text-amber-300 text-xs font-bold ${mono ? 'font-mono tracking-[0.2em]' : ''}`}>{value}</span>
          <EyeOff size={11} className="text-white/30 group-hover:text-white/60 flex-shrink-0" />
        </>
      ) : (
        <>
          <span className="flex gap-0.5">
            {Array.from({ length: Math.min(value.length, 6) }).map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" />
            ))}
          </span>
          <Eye size={11} className="text-white/30 group-hover:text-white/60 flex-shrink-0" />
        </>
      )}
    </button>
  );
}

// ─── Edit modal ─────────────────────────────────────────────────────────────

interface EditTarget {
  type: 'pin' | 'password' | 'cashier_password';
  userId: string;
  userName: string;
  siteId?: string;
}

function EditModal({ target, onClose, onSaved }: {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPin = target.type === 'pin';
  const label = isPin ? 'Nouveau PIN (4 chiffres)' : 'Nouveau mot de passe (min. 6 car.)';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isPin && !/^\d{4}$/.test(value)) { toast('error', 'PIN : exactement 4 chiffres'); return; }
    if (!isPin && value.length < 6) { toast('error', 'Mot de passe trop court'); return; }

    setSaving(true);
    let result: { success?: boolean; error?: string };

    if (isPin) {
      result = await callSuperAdminFn('update_pin', { user_id: target.userId, new_pin: value });
    } else {
      result = await callSuperAdminFn('reset_password', { user_id: target.userId, new_password: value });
    }

    setSaving(false);
    if (!result.success) { toast('error', result.error ?? 'Erreur'); return; }
    toast('success', isPin ? 'PIN mis à jour' : 'Mot de passe mis à jour');
    onSaved();
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              {isPin ? <KeyRound size={15} className="text-amber-400" /> : <Lock size={15} className="text-blue-400" />}
              {isPin ? 'Modifier le PIN' : 'Réinitialiser le mot de passe'}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">{target.userName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">{label}</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => setValue(isPin ? e.target.value.replace(/\D/g, '').slice(0, 4) : e.target.value)}
                inputMode={isPin ? 'numeric' : undefined}
                maxLength={isPin ? 4 : undefined}
                placeholder={isPin ? '1234' : '••••••••'}
                className={`w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-all pr-10 ${isPin ? 'font-mono tracking-[0.4em]' : ''}`}
                autoFocus
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-sm font-medium transition-all">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? '' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── User Row ───────────────────────────────────────────────────────────────

function UserRowSA({
  user,
  authEmail,
  onEdit,
}: {
  user: StaffUser;
  authEmail?: string;
  onEdit: (target: EditTarget) => void;
}) {
  const cfg = getRoleCfg(user.role?.name);
  const Icon = cfg.icon;
  const isCashier = user.role?.name === 'cashier';
  const displayEmail = authEmail ?? user.email ?? '—';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/2 transition-colors"
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}12)`, border: `1.5px solid ${cfg.color}30` }}
      >
        {user.avatar_url
          ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
          : <span className="text-[11px] font-bold" style={{ color: cfg.color }}>{getInitials(user.name)}</span>
        }
      </div>

      {/* Name + role + email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white text-xs font-semibold truncate">{user.name}</p>
          {!user.is_active && (
            <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md flex-shrink-0">Inactif</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {user.role && (
            <div className="flex items-center gap-1">
              <Icon size={9} style={{ color: cfg.color }} />
              <span className="text-[10px]" style={{ color: cfg.color + 'bb' }}>{user.role.label}</span>
            </div>
          )}
          {displayEmail && displayEmail !== '—' && (
            <div className="flex items-center gap-1">
              <Mail size={9} className="text-white/25" />
              <span className="text-[10px] text-white/35 font-mono truncate max-w-[140px]">{displayEmail}</span>
            </div>
          )}
        </div>
      </div>

      {/* PIN */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <RevealCell value={user.pin} />
        <button
          onClick={() => onEdit({ type: 'pin', userId: user.id, userName: user.name })}
          className="w-6 h-6 rounded-lg bg-white/4 hover:bg-amber-500/15 flex items-center justify-center text-white/25 hover:text-amber-400 transition-all"
          title="Modifier le PIN"
        >
          <Pencil size={10} />
        </button>
      </div>

      {/* Password reset (non-cashier only) */}
      {!isCashier && (
        <button
          onClick={() => onEdit({ type: 'password', userId: user.id, userName: user.name })}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/4 hover:bg-blue-500/15 border border-white/8 hover:border-blue-500/25 text-white/30 hover:text-blue-400 text-[10px] font-medium transition-all flex-shrink-0"
          title="Réinitialiser le mot de passe"
        >
          <Lock size={9} /> MDP
        </button>
      )}

      {/* Status */}
      <div className="flex-shrink-0">
        {user.is_active
          ? <CheckCircle2 size={14} className="text-emerald-400" />
          : <XCircle size={14} className="text-white/20" />
        }
      </div>
    </motion.div>
  );
}

// ─── Cashier shared account row ─────────────────────────────────────────────

function CashierSharedRow({
  site,
  onEdit,
}: {
  site: SiteWithUsers;
  onEdit: (target: EditTarget) => void;
}) {
  if (!site.cashierAuthId && !site.cashierEmail) return null;
  const email = site.cashierEmail ?? `caisse@${site.slug}.app`;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-500/10 bg-amber-500/4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/15 border border-amber-500/25">
        <ChefHat size={14} className="text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-amber-300 text-xs font-semibold">Compte caissier partagé</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Mail size={9} className="text-amber-400/40" />
          <span className="text-[10px] text-amber-400/60 font-mono">{email}</span>
        </div>
      </div>
      {site.cashierAuthId && (
        <button
          onClick={() => onEdit({ type: 'cashier_password', userId: site.cashierAuthId!, userName: `Caissiers — ${site.name}`, siteId: site.id })}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400/60 hover:text-amber-400 text-[10px] font-medium transition-all flex-shrink-0"
        >
          <Lock size={9} /> MDP
        </button>
      )}
    </div>
  );
}

// ─── Site Panel ─────────────────────────────────────────────────────────────

function SitePanel({
  site,
  emailById,
  defaultOpen,
  onEdit,
}: {
  site: SiteWithUsers;
  emailById: Record<string, string>;
  defaultOpen: boolean;
  onEdit: (target: EditTarget) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const activeUsers = site.users.filter(u => u.is_active).length;

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white/2 hover:bg-white/4 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-blue-500/12 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Globe size={12} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{site.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {site.address && (
              <span className="text-white/25 text-[10px] flex items-center gap-0.5 truncate">
                <MapPin size={8} />{site.address}
              </span>
            )}
            {site.phone && (
              <span className="text-white/25 text-[10px] flex items-center gap-0.5">
                <Phone size={8} />{site.phone}
              </span>
            )}
            <span className="text-white/20 text-[9px] font-mono flex-shrink-0">/{site.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-white font-bold text-sm">{site.users.length}</p>
            <p className="text-white/30 text-[10px]">{activeUsers} actif{activeUsers !== 1 ? 's' : ''}</p>
          </div>
          {site.is_active
            ? <span className="hidden sm:flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20"><Activity size={7} />Actif</span>
            : <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/30">Inactif</span>
          }
          {open ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5">
              {/* Table header */}
              <div className="flex items-center gap-3 px-4 py-2 bg-white/2 border-b border-white/5">
                <div className="w-9 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Utilisateur / Email</p>
                </div>
                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider flex-shrink-0">PIN</p>
                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 hidden sm:block">MDP</p>
                <div className="w-[14px] flex-shrink-0" />
              </div>

              {/* Cashier shared account */}
              <CashierSharedRow site={site} onEdit={onEdit} />

              {/* Staff users */}
              {site.users.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <p className="text-white/20 text-xs">Aucun utilisateur sur ce site</p>
                </div>
              ) : (
                site.users.map(u => (
                  <UserRowSA
                    key={u.id}
                    user={u}
                    authEmail={emailById[u.id]}
                    onEdit={onEdit}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tenant Card ────────────────────────────────────────────────────────────

function OwnerRow({
  tenant,
  ownerEmail,
  onEdit,
}: {
  tenant: TenantFull;
  ownerEmail: string;
  onEdit: (target: EditTarget) => void;
}) {
  if (!tenant.owner_id) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-red-500/10 bg-red-500/3">
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
        <Shield size={14} className="text-red-400" />
      </div>

      {/* Label + email */}
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-xs font-semibold">Propriétaire du compte</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Mail size={9} className="text-red-400/40 flex-shrink-0" />
          {ownerEmail ? (
            <span className="text-red-300/70 text-[11px] font-mono truncate">{ownerEmail}</span>
          ) : (
            <span className="text-white/20 text-[10px] italic">email non disponible</span>
          )}
        </div>
      </div>

      {/* MDP reset button */}
      <button
        onClick={() => onEdit({
          type: 'password',
          userId: tenant.owner_id!,
          userName: `${tenant.name} — Propriétaire`,
        })}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400/70 hover:text-red-400 text-[10px] font-semibold transition-all flex-shrink-0"
      >
        <Lock size={10} /> Nouveau MDP
      </button>
    </div>
  );
}

function TenantCard({
  tenant,
  ownerEmail,
  onEdit,
}: {
  tenant: TenantFull;
  ownerEmail: string;
  onEdit: (target: EditTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [emailById, setEmailById] = useState<Record<string, string>>({});
  const [loadingEmails, setLoadingEmails] = useState(false);
  const totalUsers = tenant.sites.reduce((sum, s) => sum + s.users.length, 0);

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && Object.keys(emailById).length === 0) {
      setLoadingEmails(true);
      const result = await callSuperAdminFn('list_auth_users', { tenant_id: tenant.id });
      if (result.emailById) setEmailById(result.emailById);
      setLoadingEmails(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left"
      >
        <div className="w-11 h-11 rounded-xl bg-blue-500/12 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Building2 size={18} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-bold text-base">{tenant.name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${
              tenant.is_active
                ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
                : 'bg-white/6 text-white/30 border-white/10'
            }`}>
              {tenant.is_active ? 'Actif' : 'Inactif'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-sky-500/12 text-sky-400 border-sky-500/20 font-semibold capitalize">
              {tenant.plan}
            </span>
          </div>
          {/* Owner email always visible in header */}
          {ownerEmail && (
            <div className="flex items-center gap-1 mt-0.5">
              <Shield size={9} className="text-red-400/40" />
              <p className="text-white/35 text-xs font-mono">{ownerEmail}</p>
            </div>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
          <div className="text-right">
            <p className="text-white font-bold text-sm">{tenant.sites.length}</p>
            <p className="text-white/30 text-[10px]">site{tenant.sites.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-sm">{totalUsers}</p>
            <p className="text-white/30 text-[10px]">utilisateur{totalUsers !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {loadingEmails && <Loader2 size={13} className="animate-spin text-white/30" />}
          {expanded ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
        </div>
      </button>

      {/* Owner row — always visible when expanded */}
      {expanded && (
        <OwnerRow tenant={tenant} ownerEmail={ownerEmail} onEdit={onEdit} />
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8 p-4 space-y-3">
              {tenant.sites.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <p className="text-white/20 text-xs">Aucun site pour ce tenant</p>
                </div>
              ) : (
                tenant.sites.map((site, idx) => (
                  <SitePanel
                    key={site.id}
                    site={site}
                    emailById={emailById}
                    defaultOpen={idx === 0}
                    onEdit={onEdit}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function TenantExplorerPage() {
  const [tenants, setTenants] = useState<TenantFull[]>([]);
  const [ownerEmailByTenantId, setOwnerEmailByTenantId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [tenantsRes, sitesRes, usersRes, ownerEmailsRes] = await Promise.all([
      supabase.from('tenants').select('*').order('name'),
      supabase.from('sites').select('*').order('name'),
      supabase.from('users').select('*, role:roles(id, name, label, color)').order('name'),
      callSuperAdminFn('list_all_owner_emails', {}),
    ]);

    const allTenants = (tenantsRes.data ?? []) as Tenant[];
    const allSites   = (sitesRes.data  ?? []) as Site[];
    const allUsers   = (usersRes.data  ?? []) as StaffUser[];

    // Build ownerEmail map: tenantId -> email
    const emailByOwnerId: Record<string, string> = ownerEmailsRes.emailByOwnerId ?? {};
    const ownerIdByTenantId: Record<string, string> = ownerEmailsRes.ownerIdByTenantId ?? {};
    const emailByTenantId: Record<string, string> = {};
    for (const [tid, oid] of Object.entries(ownerIdByTenantId)) {
      if (emailByOwnerId[oid]) emailByTenantId[tid] = emailByOwnerId[oid];
    }
    setOwnerEmailByTenantId(emailByTenantId);

    const usersBySite: Record<string, StaffUser[]> = {};
    for (const u of allUsers) {
      if (u.site_id) {
        if (!usersBySite[u.site_id]) usersBySite[u.site_id] = [];
        usersBySite[u.site_id].push(u);
      }
    }

    const sitesByTenant: Record<string, SiteWithUsers[]> = {};
    for (const s of allSites) {
      if (!sitesByTenant[s.tenant_id]) sitesByTenant[s.tenant_id] = [];
      sitesByTenant[s.tenant_id].push({
        ...s,
        users: usersBySite[s.id] ?? [],
        cashierEmail: s.cashier_auth_user_id ? `caisse@${s.slug}.app` : null,
        cashierAuthId: s.cashier_auth_user_id ?? null,
      });
    }

    setTenants(allTenants.map(t => ({
      ...t,
      sites: sitesByTenant[t.id] ?? [],
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tenants.filter(t => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.slug.toLowerCase().includes(q)) return false;
    }
    if (filterStatus === 'active' && !t.is_active) return false;
    if (filterStatus === 'inactive' && t.is_active) return false;
    return true;
  });

  const totalUsers    = tenants.reduce((s, t) => s + t.sites.reduce((ss, si) => ss + si.users.length, 0), 0);
  const totalSites    = tenants.reduce((s, t) => s + t.sites.length, 0);
  const activeTenants = tenants.filter(t => t.is_active).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black">Explorer</h1>
          <p className="text-white/35 text-sm mt-0.5">Navigation tenants → sites → utilisateurs avec gestion des accès</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white text-sm transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tenants actifs', value: `${activeTenants}/${tenants.length}`, icon: Building2, color: 'text-blue-400',    bg: 'bg-blue-500/8 border-blue-500/15'     },
          { label: 'Sites totaux',   value: totalSites,                           icon: Globe,     color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15' },
          { label: 'Utilisateurs',   value: totalUsers,                           icon: Users,     color: 'text-amber-400',   bg: 'bg-amber-500/8 border-amber-500/15'   },
        ].map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`rounded-2xl border p-4 ${kpi.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={kpi.color} />
                <p className="text-white/40 text-xs">{kpi.label}</p>
              </div>
              <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un tenant..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/25 transition-all"
          />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/8">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === s ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {s === 'all' ? 'Tous' : s === 'active' ? 'Actifs' : 'Inactifs'}
            </button>
          ))}
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <Shield size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300/70 text-xs leading-relaxed">
          Accès super admin — codes PIN, emails et mots de passe visibles et modifiables. Ces informations sont strictement confidentielles.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-white/8 bg-white/2">
          <User size={32} className="text-white/15 mb-3" />
          <p className="text-white/40 text-sm">{search ? 'Aucun résultat' : 'Aucun tenant'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tenant => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              ownerEmail={ownerEmailByTenantId[tenant.id] ?? ''}
              onEdit={setEditTarget}
            />
          ))}
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editTarget && (
          <EditModal
            target={editTarget}
            onClose={() => setEditTarget(null)}
            onSaved={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
