import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, RefreshCw, X, Save, Building2,
  Mail, User, Shield, Loader2, Eye, EyeOff, AlertTriangle,
  CheckCircle2, Key,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { useTenant } from '../../context/TenantContext';

interface SiteManager {
  id: string;
  site_id: string;
  tenant_id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface SiteManagerWithSiteName extends SiteManager {
  site_name?: string;
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateManagerForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { sites, tenant } = useTenant();
  const toast = useToast();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    site_id: sites[0]?.id ?? '',
  });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setError('');
    if (!form.email.trim() || !form.password.trim() || !form.name.trim()) {
      setError('Tous les champs sont obligatoires');
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (!form.site_id) {
      setError('Choisissez un site');
      return;
    }
    setSaving(true);

    // Use edge function with service_role to create auth user without affecting the current session
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-site-manager`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          site_id: form.site_id,
          tenant_id: tenant!.id,
        }),
      }
    );

    const result = await res.json();
    setSaving(false);

    if (!res.ok || result.error) {
      setError(result.error ?? 'Erreur lors de la création du compte');
      return;
    }
    toast('success', `Gestionnaire "${form.name}" créé avec succès`);
    onCreated();
  }

  const selectedSite = sites.find(s => s.id === form.site_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Shield size={14} className="text-blue-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Nouveau gestionnaire de site</p>
            <p className="text-white/35 text-xs">Accès email/mot de passe limité à un site</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all">
          <X size={14} />
        </button>
      </div>

      {/* Alert */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-300/70 text-xs leading-relaxed">
          Le gestionnaire pourra se connecter avec son email et accéder uniquement aux données du site assigné. Il ne peut pas changer de site.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Name */}
        <div>
          <label className="flex items-center gap-1.5 text-white/50 text-xs font-medium mb-1.5">
            <User size={11} /> Nom complet
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Marie Dupont"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* Site */}
        <div>
          <label className="flex items-center gap-1.5 text-white/50 text-xs font-medium mb-1.5">
            <Building2 size={11} /> Site assigné
          </label>
          <select
            value={form.site_id}
            onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          >
            {sites.map(s => (
              <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>
            ))}
          </select>
          {selectedSite?.address && (
            <p className="text-white/25 text-[10px] mt-1">{selectedSite.address}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="flex items-center gap-1.5 text-white/50 text-xs font-medium mb-1.5">
            <Mail size={11} /> Email de connexion
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="gestionnaire@site.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* Password */}
        <div>
          <label className="flex items-center gap-1.5 text-white/50 text-xs font-medium mb-1.5">
            <Key size={11} /> Mot de passe
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 caractères"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 pr-10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 text-white/60 hover:text-white text-sm font-medium transition-all">
          Annuler
        </button>
        <motion.button
          onClick={handleCreate}
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 transition-all"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Création...' : 'Créer le gestionnaire'}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Manager Row ──────────────────────────────────────────────────────────────

function ManagerRow({ manager, onDelete }: { manager: SiteManagerWithSiteName; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  async function handleDelete() {
    setDeleting(true);
    // Remove from site_managers (auth user remains but loses site manager access)
    const { error } = await supabase.from('site_managers').delete().eq('id', manager.id);
    setDeleting(false);
    if (error) { toast('error', error.message); return; }
    toast('success', 'Gestionnaire supprimé');
    onDelete();
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors border-b border-white/5 last:border-0"
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
        <Shield size={14} className="text-blue-400" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white font-semibold text-sm truncate">{manager.name}</p>
          {manager.is_active
            ? <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 flex-shrink-0"><CheckCircle2 size={8} />Actif</span>
            : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/30 flex-shrink-0">Inactif</span>
          }
        </div>
        <p className="text-white/35 text-xs mt-0.5 truncate">{manager.email}</p>
        {manager.site_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <Building2 size={9} className="text-white/25" />
            <p className="text-white/25 text-[10px]">{manager.site_name}</p>
          </div>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </motion.div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function SiteManagersPanel() {
  const { sites, tenant } = useTenant();
  const toast = useToast();
  const [managers, setManagers] = useState<SiteManagerWithSiteName[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('site_managers')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('name');

    const siteMap: Record<string, string> = {};
    for (const s of sites) siteMap[s.id] = s.name;

    setManagers(
      (data ?? []).map((m: SiteManager) => ({
        ...m,
        site_name: siteMap[m.site_id] ?? 'Site inconnu',
      }))
    );
    setLoading(false);
  }, [tenant, sites]);

  useEffect(() => { load(); }, [load]);

  // Group by site
  const bySite: Record<string, SiteManagerWithSiteName[]> = {};
  for (const m of managers) {
    if (!bySite[m.site_id]) bySite[m.site_id] = [];
    bySite[m.site_id].push(m);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-base">Gestionnaires de sites</h3>
          <p className="text-white/35 text-xs mt-0.5">
            Comptes email dédiés par site — accès restreint au site assigné
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
            onClick={() => setShowCreate(true)}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/25 transition-all"
          >
            <Plus size={13} /> Nouveau
          </motion.button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <CreateManagerForm
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); load(); }}
          />
        )}
      </AnimatePresence>

      {/* Info card */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/3 border border-white/8">
        <Shield size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-white/60 text-xs font-medium">Comment ça fonctionne</p>
          <p className="text-white/30 text-xs mt-0.5 leading-relaxed">
            Un gestionnaire se connecte via son email sur la même URL. Il arrive directement sur son site assigné, voit les utilisateurs (staff PIN) de ce site uniquement, et ne peut pas changer de site.
          </p>
        </div>
      </div>

      {/* List grouped by site */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        </div>
      ) : managers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-white/8 bg-white/2">
          <Shield size={28} className="text-white/15 mb-3" />
          <p className="text-white/30 text-sm font-medium">Aucun gestionnaire de site</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
          >
            <Plus size={12} /> Créer un gestionnaire
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map(site => {
            const siteManagers = bySite[site.id] ?? [];
            if (siteManagers.length === 0) return null;
            return (
              <div key={site.id} className="rounded-2xl border border-white/8 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-white/3 border-b border-white/8">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/12 border border-blue-500/20 flex items-center justify-center">
                    <Building2 size={12} className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{site.name}</p>
                    {site.address && <p className="text-white/25 text-[10px]">{site.address}</p>}
                  </div>
                  <span className="text-white/30 text-xs">{siteManagers.length} gestionnaire{siteManagers.length !== 1 ? 's' : ''}</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {siteManagers.map(m => (
                    <ManagerRow key={m.id} manager={m} onDelete={load} />
                  ))}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
