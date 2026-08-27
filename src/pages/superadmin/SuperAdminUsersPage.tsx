import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Plus, Trash2, Mail, X, Loader2, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../components/ui/Toast';

interface SuperAdmin {
  id: string;
  email: string;
  created_at: string;
}

function AddSuperAdminModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    setError('');
    if (!email.trim()) { setError('Email requis'); return; }
    setLoading(true);

    // Find the auth user by email via our own query on super_admins isn't possible
    // We need to check if this email has a Supabase auth account
    // Insert directly — the id must correspond to an existing auth.users
    // Best approach: use admin API via edge function. For now, display instructions.
    toast('warning', 'Pour ajouter un super admin, exécutez la commande SQL ci-dessous dans Supabase.');
    setError(`Commande SQL à exécuter dans Supabase :\n\nINSERT INTO super_admins (id, email)\nSELECT id, '${email}' FROM auth.users WHERE email = '${email}';`);
    setLoading(false);
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
          <h3 className="text-white font-bold">Ajouter un super admin</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"><X size={14} /></button>
        </div>

        <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-2.5 mb-4">
          <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-400/80 text-xs leading-relaxed">
            L'utilisateur doit d'abord avoir un compte Supabase Auth (email/password). La commande SQL ci-dessous permet de l'élever en super admin.
          </p>
        </div>

        <div>
          <label className="block text-white/50 text-xs font-medium mb-1.5">Email du compte</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@exemple.com"
              className="w-full bg-white/6 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-gray-800 border border-white/8">
            <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-2">Commande SQL à exécuter</p>
            <pre className="text-green-400 text-[11px] whitespace-pre-wrap font-mono leading-relaxed">{error.replace(/^[^\n]+\n\n/, '')}</pre>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all">Fermer</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleAdd} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><Mail size={13} />Générer SQL</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SuperAdminUsersPage() {
  const { authUser } = useTenant();
  const toast = useToast();
  const [admins, setAdmins] = useState<SuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from('super_admins').select('*').order('created_at');
    setAdmins((data ?? []) as SuperAdmin[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleRemove(admin: SuperAdmin) {
    if (admin.id === authUser?.id) {
      toast('error', 'Vous ne pouvez pas vous supprimer vous-même');
      return;
    }
    if (!confirm(`Révoquer les droits super admin de ${admin.email} ?`)) return;
    setDeleting(admin.id);
    const { error } = await supabase.from('super_admins').delete().eq('id', admin.id);
    setDeleting(null);
    if (error) { toast('error', error.message); return; }
    toast('success', 'Droits révoqués');
    load();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black">Super Admins</h1>
          <p className="text-white/35 text-sm mt-0.5">Comptes avec accès global à la plateforme</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center text-white/50 hover:text-white transition-all">
            <RefreshCw size={14} />
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all"
          >
            <Plus size={15} /> Ajouter
          </motion.button>
        </div>
      </div>

      {/* Warning */}
      <div className="p-4 rounded-2xl bg-red-500/6 border border-red-500/15 flex items-start gap-3">
        <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-semibold text-sm">Accès critique</p>
          <p className="text-red-400/60 text-xs mt-0.5">Les super admins ont un accès en lecture à TOUTES les données de TOUS les tenants. Accordez ce niveau d'accès avec la plus grande prudence.</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin, i) => (
            <motion.div
              key={admin.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/3 hover:border-white/12 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/12 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={16} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-sm truncate">{admin.email}</p>
                  {admin.id === authUser?.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 flex-shrink-0">Vous</span>
                  )}
                </div>
                <p className="text-white/25 text-[10px] font-mono mt-0.5">{admin.id.slice(0, 24)}…</p>
                <p className="text-white/20 text-[10px]">
                  Ajouté le {new Date(admin.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => handleRemove(admin)}
                disabled={deleting === admin.id || admin.id === authUser?.id}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-red-500/15 text-white/30 hover:text-red-400 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title={admin.id === authUser?.id ? 'Vous ne pouvez pas vous supprimer' : 'Révoquer'}
              >
                {deleting === admin.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* SQL helper */}
      <div className="p-4 rounded-2xl bg-gray-800/50 border border-white/6">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Bootstrap — Premier super admin</p>
        <p className="text-white/30 text-xs mb-3">Pour créer le tout premier super admin (via Supabase SQL Editor) :</p>
        <pre className="text-green-400 text-[11px] font-mono leading-relaxed bg-black/30 rounded-xl p-3 overflow-x-auto">
{`INSERT INTO super_admins (id, email)
SELECT id, email FROM auth.users
WHERE email = 'votre@email.com';`}
        </pre>
      </div>

      <AnimatePresence>
        {showAdd && (
          <AddSuperAdminModal
            onClose={() => setShowAdd(false)}
            onAdded={() => { setShowAdd(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
