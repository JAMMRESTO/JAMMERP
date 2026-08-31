import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, CheckCircle2, XCircle, Eye, EyeOff,
  Shield, ShoppingCart, Package,
  Save, X, User, KeyRound, Image, ToggleLeft, ToggleRight,
  Search, RefreshCw, Building2, ChevronDown, ChevronRight, Users, Mail,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useTenant } from '../../context/TenantContext';
import type { UserWithRole, Role, Site } from '../../types/database';

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const ROLE_CONFIG: Record<string, {
  color: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = {
  admin:   { color: '#EF4444', icon: Shield },
  cashier: { color: '#F59E0B', icon: ShoppingCart },
};

function getRoleCfg(name?: string) {
  return ROLE_CONFIG[name ?? ''] ?? { color: '#3B82F6', icon: Package };
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── User Form ────────────────────────────────────────────────────────────────

interface UserFormData {
  name: string;
  pin: string;
  role_id: string;
  avatar_url: string;
  is_active: boolean;
  site_id: string;
}

function UserForm({
  user,
  roles,
  sites,
  defaultSiteId,
  tenantId,
  onSave,
  onCancel,
}: {
  user: UserWithRole | null;
  roles: Role[];
  sites: Site[];
  defaultSiteId: string | null;
  tenantId: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<UserFormData>({
    name: user?.name ?? '',
    pin: '',
    role_id: user?.role_id ?? (roles[0]?.id ?? ''),
    avatar_url: user?.avatar_url ?? '',
    is_active: user?.is_active ?? true,
    site_id: user?.site_id ?? defaultSiteId ?? (sites[0]?.id ?? ''),
  });
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinError, setPinError] = useState('');

  // If roles load after form initialization, update the default role_id
  useEffect(() => {
    if (!form.role_id && roles.length > 0) {
      const cashierRole = roles.find(r => r.name === 'cashier');
      setForm(f => ({ ...f, role_id: cashierRole?.id ?? roles[0].id }));
    }
  }, [roles]);

  const selectedRole = roles.find(r => r.id === form.role_id);
  const selectedSite = sites.find(s => s.id === form.site_id);
  const sharedEmail = selectedSite ? `caisse@${slugify(selectedSite.slug)}.app` : 'caisse@site.app';

  function validatePin(p: string) {
    if (!p) return '';
    if (!/^\d{4}$/.test(p)) return 'Le PIN doit contenir exactement 4 chiffres';
    return '';
  }

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name }));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('error', 'Le nom est requis'); return; }
    if (!user && !form.pin) { toast('error', 'Le PIN est requis'); return; }
    const pinErr = form.pin ? validatePin(form.pin) : '';
    if (pinErr) { setPinError(pinErr); return; }
    if (!form.role_id) { toast('error', 'Aucun rôle disponible. Veuillez contacter le super administrateur.'); return; }
    if (!form.site_id) { toast('error', 'Le site est requis'); return; }

    setSaving(true);

    if (!user) {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          role: selectedRole?.name ?? 'cashier',
          name: form.name.trim(),
          pin: form.pin,
          role_id: form.role_id || null,
          site_id: form.site_id,
          tenant_id: tenantId,
        }),
      });
      const result = await res.json();
      setSaving(false);
      if (!result.success) { toast('error', result.error ?? 'Erreur création'); return; }
      toast('success', 'Utilisateur créé');
      onSave();
      return;
    }

    // Update existing user
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      role_id: form.role_id || null,
      avatar_url: form.avatar_url.trim() || null,
      is_active: form.is_active,
      site_id: form.site_id,
    };
    if (form.pin) payload.pin = form.pin;

    const { error } = await supabase.from('users').update(payload).eq('id', user.id).select().maybeSingle();

    setSaving(false);
    if (error) { toast('error', `Erreur : ${error.message}`); return; }
    toast('success', 'Utilisateur modifié');
    onSave();
  }

  const cfg = getRoleCfg(selectedRole?.name);
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      className="flex flex-col h-full bg-gray-900/80 border-l border-white/8"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
        <div>
          <h3 className="text-white font-bold text-base">
            {user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </h3>
          <p className="text-white/35 text-xs mt-0.5">
            {user ? `Édition de ${user.name}` : 'Créer un nouveau compte'}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
        >
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>

        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg"
            style={{ background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}10)`, border: `2px solid ${cfg.color}40` }}
          >
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="" className="w-full h-full object-cover" onError={() => setForm(f => ({ ...f, avatar_url: '' }))} />
            ) : (
              <span className="text-xl font-bold" style={{ color: cfg.color }}>
                {form.name ? getInitials(form.name) : <User size={24} className="opacity-40" />}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{form.name || 'Nouveau compte'}</p>
            {selectedRole && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Icon size={11} style={{ color: cfg.color }} />
                <span className="text-xs" style={{ color: cfg.color }}>{selectedRole.label}</span>
              </div>
            )}
            {selectedSite && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 size={10} className="text-white/30" />
                <span className="text-[10px] text-white/30">{selectedSite.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-2">
            <User size={12} /> Nom complet
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Ex: Jean Dupont"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
          />
        </div>

        {/* Shared login info for all roles */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
          <Mail size={13} className="text-blue-400/70 flex-shrink-0" />
          <div>
            <p className="text-blue-400/80 text-xs font-medium">Email de connexion partagé</p>
            <p className="text-blue-400/50 text-[10px] font-mono mt-0.5">{sharedEmail}</p>
            <p className="text-white/30 text-[10px] mt-1">Tous les utilisateurs partagent cet email et un mot de passe commun. Chacun a son propre code PIN.</p>
          </div>
        </div>
        {/* Site assignment */}
        <div>
          <label className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-2">
            <Building2 size={12} /> Site d'affectation
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {sites.map(site => {
              const active = form.site_id === site.id;
              return (
                <button
                  key={site.id}
                  onClick={() => setForm(f => ({ ...f, site_id: site.id }))}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-blue-500/40 bg-blue-500/10'
                      : 'border-white/8 bg-white/3 hover:bg-white/6'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${active ? 'bg-blue-500/20' : 'bg-white/8'}`}>
                    <Building2 size={13} className={active ? 'text-blue-400' : 'text-white/30'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{site.name}</p>
                    {site.address && <p className="text-white/30 text-[10px] truncate">{site.address}</p>}
                  </div>
                  {active && <CheckCircle2 size={14} className="text-blue-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-2">
            <Shield size={12} /> Rôle
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {roles.map(role => {
              const rc = getRoleCfg(role.name);
              const RIcon = rc.icon;
              const active = form.role_id === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setForm(f => ({ ...f, role_id: role.id }))}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${active ? 'border-opacity-60' : 'border-white/8 bg-white/3 hover:bg-white/6'}`}
                  style={active ? { backgroundColor: rc.color + '15', borderColor: rc.color + '50', boxShadow: `0 0 12px ${rc.color}10` } : {}}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: rc.color + (active ? '25' : '15'), border: `1px solid ${rc.color}30` }}
                  >
                    <RIcon size={13} style={{ color: rc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium">{role.label}</p>
                  </div>
                  {active && <CheckCircle2 size={14} style={{ color: rc.color }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN */}
        <div>
          <label className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-2">
            <KeyRound size={12} />
            {user ? 'Nouveau PIN (laisser vide pour conserver)' : 'Code PIN (4 chiffres)'}
          </label>
          <div className="relative">
            <input
              type={showPin ? 'text' : 'password'}
              value={form.pin}
              onChange={e => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setForm(f => ({ ...f, pin: v }));
                setPinError(validatePin(v));
              }}
              placeholder={user ? '••••' : '1234'}
              inputMode="numeric"
              maxLength={4}
              className={`w-full bg-white/5 border rounded-xl px-3.5 py-2.5 text-white text-sm tracking-[0.4em] font-mono placeholder-white/20 focus:outline-none transition-all pr-10 ${pinError ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/10 focus:border-blue-500/50 focus:bg-white/8'}`}
            />
            <button
              type="button"
              onClick={() => setShowPin(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {pinError && <p className="text-red-400 text-[10px] mt-1">{pinError}</p>}
          <div className="flex gap-1 mt-2">
            {[0,1,2,3].map(i => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-200"
                style={{ backgroundColor: i < form.pin.length ? cfg.color : 'rgba(255,255,255,0.1)' }}
              />
            ))}
          </div>
        </div>

        {/* Photo URL */}
        <div>
          <label className="flex items-center gap-1.5 text-white/60 text-xs font-medium mb-2">
            <Image size={12} /> URL de photo (optionnel)
          </label>
          <input
            type="url"
            value={form.avatar_url}
            onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))}
            placeholder="https://..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
          />
        </div>

        {/* Active toggle */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${form.is_active ? 'border-emerald-500/25 bg-emerald-500/8' : 'border-white/8 bg-white/3'}`}>
          <div>
            <p className="text-white text-sm font-medium">Compte actif</p>
            <p className="text-white/35 text-xs mt-0.5">L'utilisateur peut se connecter</p>
          </div>
          <button
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className="transition-transform hover:scale-105"
          >
            {form.is_active
              ? <ToggleRight size={28} className="text-emerald-400" />
              : <ToggleLeft size={28} className="text-white/25" />
            }
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-white/8 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 text-white/60 hover:text-white text-sm font-medium transition-all"
        >
          Annuler
        </button>
        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
        >
          {saving
            ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : <Save size={14} />
          }
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── PIN Badge (reveal on click) ─────────────────────────────────────────────

function PinBadge({ pin }: { pin: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); setRevealed(v => !v); }}
      className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 transition-all group flex-shrink-0"
      title={revealed ? 'Masquer le PIN' : 'Afficher le PIN'}
    >
      {revealed ? (
        <>
          <span className="text-amber-300 font-mono text-xs font-bold tracking-[0.25em]">{pin}</span>
          <EyeOff size={10} className="text-white/30 group-hover:text-white/60 flex-shrink-0" />
        </>
      ) : (
        <>
          <span className="flex gap-0.5">
            {[0,1,2,3].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" />)}
          </span>
          <Eye size={10} className="text-white/30 group-hover:text-white/60 flex-shrink-0" />
        </>
      )}
    </button>
  );
}

// ─── User Card Row ────────────────────────────────────────────────────────────

function UserRow({ user, onEdit, onDelete, onToggle }: {
  user: UserWithRole;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const cfg = getRoleCfg(user.role?.name);
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors border-b border-white/5 last:border-0 group"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md"
        style={{ background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}12)`, border: `1.5px solid ${cfg.color}35` }}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{getInitials(user.name)}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-medium text-sm truncate">{user.name}</p>
          {!user.is_active && (
            <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md flex-shrink-0">Inactif</span>
          )}
        </div>
        {user.role && (
          <div className="flex items-center gap-1 mt-0.5">
            <Icon size={10} style={{ color: cfg.color }} />
            <span className="text-[10px]" style={{ color: cfg.color + 'cc' }}>{user.role.label}</span>
          </div>
        )}
      </div>

      <PinBadge pin={user.pin} />

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onToggle}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${user.is_active ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-white/25 hover:bg-white/8'}`}
          title={user.is_active ? 'Désactiver' : 'Activer'}
        >
          {user.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        </button>
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Site Group ───────────────────────────────────────────────────────────────

function SiteGroup({
  site,
  users,
  onEdit,
  onDelete,
  onToggle,
  onAddUser,
  defaultExpanded,
}: {
  site: Site;
  users: UserWithRole[];
  onEdit: (u: UserWithRole) => void;
  onDelete: (id: string) => void;
  onToggle: (u: UserWithRole) => void;
  onAddUser: (siteId: string) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const activeCount = users.filter(u => u.is_active).length;
  const cashierEmail = `caisse@${slugify(site.slug) || 'site'}.app`;

  return (
    <div className="rounded-2xl border border-white/8 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-white/3 border-b border-white/5">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)' }}
          >
            <Building2 size={14} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{site.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-white/30 text-[10px]">
                {activeCount} actif{activeCount !== 1 ? 's' : ''} · {users.length} total
              </p>
              <span className="text-white/15 text-[10px]">·</span>
              <p className="text-amber-400/50 text-[10px] font-mono">{cashierEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {expanded
              ? <ChevronDown size={14} className="text-white/30" />
              : <ChevronRight size={14} className="text-white/30" />
            }
          </div>
        </button>
        <button
          onClick={e => { e.stopPropagation(); onAddUser(site.id); }}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-blue-600/20 flex items-center justify-center text-white/30 hover:text-blue-400 transition-all flex-shrink-0"
          title={`Ajouter un utilisateur sur ${site.name}`}
        >
          <Plus size={13} />
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {users.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-white/20 text-xs">
                Aucun utilisateur sur ce site
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {users.map(u => (
                  <UserRow
                    key={u.id}
                    user={u}
                    onEdit={() => onEdit(u)}
                    onDelete={() => onDelete(u.id)}
                    onToggle={() => onToggle(u)}
                  />
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UserManagement() {
  const toast = useToast();
  const { currentSite, sites, tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithRole | null | undefined>(undefined);
  const [newUserSiteId, setNewUserSiteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterSite, setFilterSite] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    // Load ALL users for this tenant (not just current site)
    const usersQ = tenantId
      ? supabase.from('users').select('*, role:roles(*)').eq('tenant_id', tenantId).order('name')
      : supabase.from('users').select('*, role:roles(*)').order('name');
    const rolesQ = tenantId
      ? supabase.from('roles').select('*').or(`tenant_id.eq.${tenantId},tenant_id.is.null`).order('name')
      : supabase.from('roles').select('*').order('name');
    const [usersRes, rolesRes] = await Promise.all([usersQ, rolesQ]);
    if (usersRes.data) setUsers(usersRes.data as UserWithRole[]);
    if (rolesRes.data) setRoles(rolesRes.data as Role[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Reset form state when the active site changes
  useEffect(() => {
    setEditingUser(undefined);
    setNewUserSiteId(null);
  }, [currentSite?.id]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) { toast('error', 'Impossible de supprimer cet utilisateur'); return; }
    toast('success', 'Utilisateur supprimé');
    load();
  }

  async function handleToggle(user: UserWithRole) {
    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id);
    if (error) { toast('error', 'Erreur'); return; }
    load();
  }

  function openNewUser(siteId?: string) {
    setNewUserSiteId(siteId ?? currentSite?.id ?? sites[0]?.id ?? null);
    setEditingUser(null);
  }

  const showingForm = editingUser !== undefined;

  // Filter users
  const filtered = users.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole && u.role?.name !== filterRole) return false;
    if (filterSite && u.site_id !== filterSite) return false;
    return true;
  });

  // Group by site
  const groupedBySite: { site: Site; users: UserWithRole[] }[] = sites.map(site => ({
    site,
    users: filtered.filter(u => u.site_id === site.id),
  }));

  // Users with no matching site (orphans)
  const knownSiteIds = new Set(sites.map(s => s.id));
  const orphans = filtered.filter(u => !u.site_id || !knownSiteIds.has(u.site_id));

  const activeCount = users.filter(u => u.is_active).length;
  const isFiltered = !!(search || filterRole || filterSite);

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* List panel */}
      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-all ${showingForm ? 'hidden lg:flex lg:max-w-md xl:max-w-lg' : ''}`}>
        {/* Toolbar */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-base">Utilisateurs</h3>
              <p className="text-white/35 text-xs mt-0.5">
                {activeCount} actif{activeCount !== 1 ? 's' : ''} sur {users.length} — {sites.length} site{sites.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={load}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
              <motion.button
                onClick={() => openNewUser()}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all"
              >
                <Plus size={13} /> Nouveau
              </motion.button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-blue-500/40 transition-all"
              />
            </div>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/60 text-xs focus:outline-none transition-all"
            >
              <option value="" className="bg-gray-900">Tous rôles</option>
              {roles.map(r => (
                <option key={r.id} value={r.name} className="bg-gray-900">{r.label}</option>
              ))}
            </select>
            {sites.length > 1 && (
              <select
                value={filterSite}
                onChange={e => setFilterSite(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/60 text-xs focus:outline-none transition-all"
              >
                <option value="" className="bg-gray-900">Tous sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex-shrink-0 flex gap-2 px-4 py-2.5 border-b border-white/5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {roles.map(role => {
            const cfg = getRoleCfg(role.name);
            const Icon = cfg.icon;
            const count = users.filter(u => u.role?.name === role.name).length;
            if (count === 0) return null;
            return (
              <button
                key={role.id}
                onClick={() => setFilterRole(filterRole === role.name ? '' : role.name)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border flex-shrink-0 transition-all text-[10px] font-medium"
                style={filterRole === role.name
                  ? { backgroundColor: cfg.color + '20', borderColor: cfg.color + '50', color: cfg.color }
                  : { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }
                }
              >
                <Icon size={10} />
                {role.label}
                <span className="font-bold">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mb-3" />
              <p className="text-white/30 text-xs">Chargement...</p>
            </div>
          ) : isFiltered ? (
            /* Flat list when filtering */
            filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <Users size={28} className="text-white/15 mb-3" />
                <p className="text-white/30 text-sm font-medium">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                <AnimatePresence mode="popLayout">
                  {filtered.map(u => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onEdit={() => setEditingUser(u)}
                      onDelete={() => handleDelete(u.id)}
                      onToggle={() => handleToggle(u)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )
          ) : (
            /* Grouped by site */
            <>
              {groupedBySite.map(({ site, users: siteUsers }, idx) => (
                <SiteGroup
                  key={site.id}
                  site={site}
                  users={siteUsers}
                  onEdit={u => setEditingUser(u)}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onAddUser={siteId => openNewUser(siteId)}
                  defaultExpanded={idx === 0 || site.id === currentSite?.id}
                />
              ))}
              {orphans.length > 0 && (
                <div className="rounded-2xl border border-amber-500/15 overflow-hidden">
                  <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/10">
                    <p className="text-amber-400 text-xs font-semibold">Sans site assigné</p>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {orphans.map(u => (
                      <UserRow
                        key={u.id}
                        user={u}
                        onEdit={() => setEditingUser(u)}
                        onDelete={() => handleDelete(u.id)}
                        onToggle={() => handleToggle(u)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
              {users.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Users size={28} className="text-white/15 mb-3" />
                  <p className="text-white/30 text-sm font-medium">Aucun utilisateur</p>
                  <button
                    onClick={() => openNewUser()}
                    className="mt-3 flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                  >
                    <Plus size={12} /> Créer un utilisateur
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Form panel */}
      <AnimatePresence>
        {showingForm && (
          <div className="flex-1 lg:flex-none lg:w-96 xl:w-[420px] flex-shrink-0 overflow-hidden">
            <UserForm
              user={editingUser ?? null}
              roles={roles}
              sites={sites}
              defaultSiteId={newUserSiteId ?? currentSite?.id ?? null}
              tenantId={tenantId}
              onSave={() => { setEditingUser(undefined); load(); }}
              onCancel={() => setEditingUser(undefined)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
