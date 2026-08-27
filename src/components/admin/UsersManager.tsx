import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, User, Shield, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { User as UserType, UserRole, UserPermissions } from '../../lib/types';

interface UserForm {
  nom: string;
  pin: string;
  role: UserRole;
  actif: boolean;
}

const emptyForm: UserForm = { nom: '', pin: '', role: 'SERVEUR', actif: true };

const defaultPermissions: Omit<UserPermissions, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  can_view_orders: true,
  can_create_orders: false,
  can_edit_orders: false,
  can_cancel_orders: false,
  can_process_payments: false,
  can_view_sales_history: false,
  can_manage_products: false,
  can_manage_tables: false,
  can_manage_printers: false,
  can_manage_users: false,
  can_access_settings: false,
  can_print_tickets: true,
};

const PERMISSION_GROUPS = [
  {
    label: 'Commandes',
    items: [
      { key: 'can_view_orders', label: 'Voir les commandes' },
      { key: 'can_create_orders', label: 'Créer des commandes' },
      { key: 'can_edit_orders', label: 'Modifier les commandes' },
      { key: 'can_cancel_orders', label: 'Annuler des commandes' },
    ],
  },
  {
    label: 'Caisse & Paiements',
    items: [
      { key: 'can_process_payments', label: 'Encaisser / Traiter paiements' },
      { key: 'can_view_sales_history', label: 'Voir historique des ventes' },
    ],
  },
  {
    label: 'Impression',
    items: [
      { key: 'can_print_tickets', label: 'Imprimer des tickets' },
      { key: 'can_manage_printers', label: 'Gérer les imprimantes' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'can_manage_products', label: 'Gérer produits & catégories' },
      { key: 'can_manage_tables', label: 'Gérer zones & tables' },
      { key: 'can_manage_users', label: 'Gérer les utilisateurs' },
      { key: 'can_access_settings', label: 'Accéder aux paramètres' },
    ],
  },
] as const;

type PermKey = keyof Omit<UserPermissions, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

const roleColors: Record<UserRole, string> = {
  SUPERADMIN: 'bg-red-100 text-red-700',
  ADMIN: 'bg-amber-100 text-amber-700',
  SERVEUR: 'bg-blue-100 text-blue-700',
  CAISSIER: 'bg-green-100 text-green-700',
};

export default function UsersManager() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SUPERADMIN';
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserType | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [perms, setPerms] = useState<typeof defaultPermissions>({ ...defaultPermissions });
  const [saving, setSaving] = useState(false);
  const [expandedPermUser, setExpandedPermUser] = useState<string | null>(null);
  const [permLoading, setPermLoading] = useState<string | null>(null);
  const [userPerms, setUserPerms] = useState<Record<string, UserPermissions>>({});
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set());

  useEffect(() => { fetchUsers(); }, []);

  const togglePinReveal = (userId: string) => {
    setRevealedPins(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('nom');
    const all = (data || []) as UserType[];
    // Non-superadmins never see superadmin accounts.
    const visible = isSuperAdmin ? all : all.filter(u => u.role !== 'SUPERADMIN');
    setUsers(visible);
    setLoading(false);
  };

  const fetchPermsForUser = async (userId: string) => {
    setPermLoading(userId);
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      setUserPerms(prev => ({ ...prev, [userId]: data }));
    }
    setPermLoading(null);
  };

  const toggleExpandPerms = async (userId: string) => {
    if (expandedPermUser === userId) {
      setExpandedPermUser(null);
      return;
    }
    setExpandedPermUser(userId);
    if (!userPerms[userId]) {
      await fetchPermsForUser(userId);
    }
  };

  const handlePermToggle = async (userId: string, key: PermKey, currentValue: boolean) => {
    const existing = userPerms[userId];
    if (existing) {
      const updated = { ...existing, [key]: !currentValue };
      setUserPerms(prev => ({ ...prev, [userId]: updated }));
      await supabase.from('user_permissions').update({ [key]: !currentValue, updated_at: new Date().toISOString() }).eq('user_id', userId);
    } else {
      const newPerms = { ...defaultPermissions, [key]: !currentValue };
      const { data } = await supabase
        .from('user_permissions')
        .insert({ user_id: userId, ...newPerms })
        .select()
        .maybeSingle();
      if (data) setUserPerms(prev => ({ ...prev, [userId]: data }));
    }
  };

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setPerms({ ...defaultPermissions });
    setShowModal(true);
  };

  const openEdit = async (u: UserType) => {
    if (u.role === 'SUPERADMIN' && !isSuperAdmin) return;
    setEditUser(u);
    setForm({ nom: u.nom, pin: u.pin || '', role: u.role, actif: u.actif });
    setPerms({ ...defaultPermissions });
    setShowModal(true);
    if (u.role !== 'ADMIN' && u.role !== 'SUPERADMIN') {
      const { data } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', u.id)
        .maybeSingle();
      if (data) {
        setUserPerms(prev => ({ ...prev, [u.id]: data }));
        setPerms({ ...data });
      }
    }
  };

  const closeModal = () => { setShowModal(false); setEditUser(null); };

  const handleSave = async () => {
    if (!form.nom || !form.pin) return;
    setSaving(true);
    let userId = editUser?.id;
    if (editUser) {
      await supabase.from('users').update(form).eq('id', editUser.id);
    } else {
      const { data } = await supabase.from('users').insert(form).select().maybeSingle();
      userId = data?.id;
    }
    if (userId && form.role !== 'ADMIN' && form.role !== 'SUPERADMIN') {
      const { data } = await supabase
        .from('user_permissions')
        .upsert({ user_id: userId, ...perms, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .maybeSingle();
      if (data) setUserPerms(prev => ({ ...prev, [userId!]: data }));
    }
    await fetchUsers();
    setSaving(false);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (target?.role === 'SUPERADMIN' && !isSuperAdmin) return;
    if (target?.role === 'SUPERADMIN' && currentUser?.id === id) {
      alert('Vous ne pouvez pas supprimer votre propre compte superadmin.');
      return;
    }
    if (!confirm('Supprimer cet utilisateur ?')) return;
    await supabase.from('users').delete().eq('id', id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Utilisateurs</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} compte(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {users.length === 0 ? (
            <div className="p-10 text-center text-gray-400">Aucun utilisateur</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map(u => (
                <div key={u.id}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-600 font-semibold text-sm">{u.nom.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{u.nom}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs text-gray-500">
                          PIN: {isSuperAdmin && revealedPins.has(u.id)
                            ? (u.pin || '—')
                            : '•'.repeat(u.pin?.length || 0)}
                        </p>
                        {isSuperAdmin && (
                          <button
                            onClick={() => togglePinReveal(u.id)}
                            className="text-gray-400 hover:text-amber-500 transition-colors"
                            title={revealedPins.has(u.id) ? 'Masquer le PIN' : 'Afficher le PIN'}
                          >
                            {revealedPins.has(u.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleColors[u.role]}`}>{u.role}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                    <div className="flex gap-2">
                      {(u.role !== 'ADMIN' && u.role !== 'SUPERADMIN') && (
                        <button
                          onClick={() => toggleExpandPerms(u.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${expandedPermUser === u.id ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                          title="Gérer les permissions"
                        >
                          <Shield size={14} />
                        </button>
                      )}
                      {!(u.role === 'SUPERADMIN' && !isSuperAdmin) && (
                        <>
                          <button onClick={() => openEdit(u)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 transition-all">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(u.id)} className="w-8 h-8 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-500 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {expandedPermUser === u.id && u.role !== 'ADMIN' && u.role !== 'SUPERADMIN' && (
                    <div className="bg-gray-50 border-t border-gray-100 px-5 py-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield size={15} className="text-amber-500" />
                        <span className="text-sm font-semibold text-gray-700">Permissions de {u.nom}</span>
                      </div>
                      {permLoading === u.id ? (
                        <div className="flex justify-center py-4">
                          <div className="w-6 h-6 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                          {PERMISSION_GROUPS.map(group => (
                            <div key={group.label} className="mb-3">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
                              <div className="space-y-1.5">
                                {group.items.map(item => {
                                  const p = userPerms[u.id];
                                  const val = p ? p[item.key as PermKey] as boolean : defaultPermissions[item.key as PermKey];
                                  return (
                                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                                      <button
                                        onClick={() => handlePermToggle(u.id, item.key as PermKey, val)}
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${val ? 'bg-amber-500 border-amber-500' : 'bg-white border-gray-300 group-hover:border-amber-400'}`}
                                      >
                                        {val && <Check size={12} className="text-white" strokeWidth={3} />}
                                      </button>
                                      <span className="text-sm text-gray-700">{item.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <User size={18} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">{editUser ? 'Modifier' : 'Nouvel'} utilisateur</h3>
              </div>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom complet</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" placeholder="Ex: Marie Dupont" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">PIN (4-6 chiffres)</label>
                <input type="password" value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" placeholder="Ex: 1234" maxLength={6} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Rôle</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20">
                  {isSuperAdmin && <option value="SUPERADMIN">Super Admin</option>}
                  <option value="ADMIN">Admin</option>
                  <option value="SERVEUR">Serveur</option>
                  <option value="CAISSIER">Caissier</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, actif: !f.actif }))} className={`w-12 h-6 rounded-full transition-colors flex items-center ${form.actif ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.actif ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-gray-700">{form.actif ? 'Compte actif' : 'Compte inactif'}</span>
              </div>

              {form.role !== 'ADMIN' && form.role !== 'SUPERADMIN' && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <Shield size={15} className="text-amber-500" />
                    <span className="text-sm font-semibold text-gray-700">Permissions</span>
                    <span className="text-xs text-gray-400 ml-auto">Applicable au rôle {form.role}</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.label} className="mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
                        <div className="space-y-2">
                          {group.items.map(item => {
                            const val = perms[item.key as PermKey] as boolean;
                            return (
                              <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                                <button
                                  type="button"
                                  onClick={() => setPerms(p => ({ ...p, [item.key]: !val }))}
                                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${val ? 'bg-amber-500 border-amber-500' : 'bg-white border-gray-300 group-hover:border-amber-400'}`}
                                >
                                  {val && <Check size={12} className="text-white" strokeWidth={3} />}
                                </button>
                                <span className="text-sm text-gray-700">{item.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(form.role === 'ADMIN' || form.role === 'SUPERADMIN') && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${form.role === 'SUPERADMIN' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                  <Shield size={15} className={form.role === 'SUPERADMIN' ? 'text-red-500' : 'text-amber-500'} />
                  <span className={`text-sm ${form.role === 'SUPERADMIN' ? 'text-red-700' : 'text-amber-700'}`}>
                    {form.role === 'SUPERADMIN' ? "Le superadmin a un contrôle total sur toute l'application." : 'Les administrateurs ont toutes les permissions par défaut.'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium transition-all">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.nom || !form.pin} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                <Check size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
