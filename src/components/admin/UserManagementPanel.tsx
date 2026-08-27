import { useState, useEffect } from 'react';
import {
  ArrowLeft, Plus, X, UserCheck, UserX, Eye, EyeOff,
  KeyRound, Shield, ShieldCheck, ShieldAlert, ChevronDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company, Role } from '../../types';
import { formatDate } from '../../lib/utils';

interface CompanyUser {
  id: string;
  company_id: string;
  full_name: string;
  role: string;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  email: string | null;
}

interface Props {
  company: Company;
  onBack: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrateur',
  manager: 'Manager',
  salesperson: 'Commercial',
  accountant: 'Comptable',
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-amber-100 text-amber-700',
  admin: 'bg-blue-100 text-blue-700',
  manager: 'bg-emerald-100 text-emerald-700',
  salesperson: 'bg-cyan-100 text-cyan-700',
  accountant: 'bg-slate-100 text-slate-700',
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  superadmin: ShieldAlert,
  admin: ShieldCheck,
  manager: Shield,
  salesperson: Shield,
  accountant: Shield,
};

const ASSIGNABLE_ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'manager', label: 'Manager' },
  { value: 'salesperson', label: 'Commercial' },
  { value: 'accountant', label: 'Comptable' },
];

const ROLE_NAME_TO_SYSTEM_ROLE: Record<string, string> = {
  'Admin': 'admin',
  'Manager': 'manager',
  'Superviseur': 'manager',
  'Commercial': 'salesperson',
  'Comptable': 'accountant',
  'Caissier': 'salesperson',
  'Vendeur': 'salesperson',
};

function inferSystemRole(roleName: string): string {
  return ROLE_NAME_TO_SYSTEM_ROLE[roleName] || 'salesperson';
}

const PERMISSION_LABELS: Record<string, string> = {
  all: 'Tous les acces',
  pos: 'Point de Vente',
  clients: 'Clients',
  fournisseurs: 'Fournisseurs',
  factures: 'Factures',
  devis: 'Devis',
  paiements: 'Paiements',
  inventaire: 'Inventaire',
  produits: 'Produits',
  depenses: 'Depenses',
  statistiques: 'Statistiques',
  parametres: 'Parametres',
  import_export: 'Import / Export',
  admin: 'Admin',
};

export default function UserManagementPanel({ company, onBack }: Props) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [companyRoles, setCompanyRoles] = useState<Role[]>([]);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    loadUsers();
    loadCompanyRoles();
  }, [company.id]);

  async function loadCompanyRoles() {
    const { data } = await supabase
      .from('roles')
      .select('*')
      .eq('company_id', company.id)
      .order('nom');
    setCompanyRoles(data || []);
  }

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  function apiHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  }

  async function loadUsers() {
    setLoading(true);
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users?action=list&company_id=${company.id}`,
      { headers: apiHeaders(token) }
    );
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  async function toggleActive(userId: string, isActive: boolean) {
    setActionLoading(userId);
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users?action=toggle-active`,
      {
        method: 'PUT',
        headers: apiHeaders(token),
        body: JSON.stringify({ user_id: userId, is_active: !isActive }),
      }
    );

    if (res.ok) {
      loadUsers();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Erreur');
    }
    setActionLoading(null);
  }

  async function updateUserRole(userId: string, roleId: string | null, systemRole: string) {
    setActionLoading(userId);
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users?action=update-role`,
      {
        method: 'PUT',
        headers: apiHeaders(token),
        body: JSON.stringify({ user_id: userId, role: systemRole, role_id: roleId }),
      }
    );

    if (res.ok) {
      loadUsers();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Erreur');
    }
    setActionLoading(null);
  }

  function handleRoleChange(userId: string, newRoleId: string) {
    const selectedRole = companyRoles.find(r => r.id === newRoleId);
    if (!selectedRole) return;
    const systemRole = inferSystemRole(selectedRole.nom);
    updateUserRole(userId, newRoleId, systemRole);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError('');
    if (!resetUserId || !newPassword) return;
    if (newPassword.length < 6) {
      setResetError('Min. 6 caracteres');
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users?action=reset-password`,
      {
        method: 'PUT',
        headers: apiHeaders(token),
        body: JSON.stringify({ user_id: resetUserId, new_password: newPassword }),
      }
    );

    if (res.ok) {
      setResetUserId(null);
      setNewPassword('');
    } else {
      const err = await res.json().catch(() => ({}));
      setResetError(err.error || 'Erreur');
    }
  }

  function getPermissionBadges(roleId: string | null) {
    const role = companyRoles.find(r => r.id === roleId);
    if (!role) return null;
    const perms = role.permissions_json;
    if (perms.all) {
      return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Tous les acces</span>;
    }
    const active = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);
    if (active.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {active.map(k => (
          <span key={k} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
            {PERMISSION_LABELS[k] || k}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-900 truncate">{company.name}</h3>
          <p className="text-sm text-slate-500">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowCreateForm(true); setError(''); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouvel utilisateur
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl mb-4">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">x</button>
        </div>
      )}

      {showCreateForm && (
        <CreateUserForm
          companyId={company.id}
          companyRoles={companyRoles}
          onClose={() => setShowCreateForm(false)}
          onCreated={() => { setShowCreateForm(false); loadUsers(); }}
        />
      )}

      {resetUserId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-slate-900">Reinitialiser le mot de passe</h4>
              <button onClick={() => { setResetUserId(null); setNewPassword(''); setResetError(''); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            {resetError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-2 rounded-xl mb-3">{resetError}</div>
            )}
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="relative">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe (min. 6)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowNewPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setResetUserId(null); setNewPassword(''); }}
                  className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-500">
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">Aucun utilisateur pour cette societe</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map(u => {
            const RoleIcon = ROLE_ICONS[u.role] || Shield;
            const isSuperadmin = u.role === 'superadmin';
            const permRole = companyRoles.find(r => r.id === u.role_id);

            return (
              <div key={u.id} className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                !u.is_active ? 'border-red-200 opacity-70' : 'border-gray-100'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    u.is_active ? 'bg-blue-50' : 'bg-red-50'
                  }`}>
                    <RoleIcon className={`w-5 h-5 ${u.is_active ? 'text-blue-600' : 'text-red-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 text-sm truncate">{u.full_name}</div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                      {permRole && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700">
                          {permRole.nom}
                        </span>
                      )}
                      {!permRole && !isSuperadmin && u.role !== 'admin' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-600">
                          Aucun profil
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{formatDate(u.created_at)}</span>
                      {!u.is_active && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Desactive</span>
                      )}
                    </div>

                    {permRole && getPermissionBadges(u.role_id)}

                    {!isSuperadmin && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <div className="relative">
                          <select
                            value={u.role_id || ''}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                            disabled={actionLoading === u.id}
                            className="text-xs border border-teal-200 rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-teal-50 appearance-none font-medium"
                          >
                            <option value="">-- Choisir un profil --</option>
                            {companyRoles.map(r => (
                              <option key={r.id} value={r.id}>{r.nom}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 text-teal-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <button
                          onClick={() => { setResetUserId(u.id); setNewPassword(''); setResetError(''); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 text-amber-500 transition-colors"
                          title="Reinitialiser le mot de passe"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          disabled={actionLoading === u.id}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl font-semibold transition-colors ${
                            u.is_active
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {u.is_active ? <><UserX className="w-3 h-3" /> Bloquer</> : <><UserCheck className="w-3 h-3" /> Activer</>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateUserForm({ companyId, companyRoles, onClose, onCreated }: {
  companyId: string;
  companyRoles: Role[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [showPwd, setShowPwd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const selectedPermRole = companyRoles.find(r => r.id === selectedRoleId);
  const activePermissions = selectedPermRole
    ? Object.entries(selectedPermRole.permissions_json).filter(([, v]) => v).map(([k]) => k)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName || !email || !password) {
      setError('Remplissez tous les champs');
      return;
    }
    if (!selectedRoleId) {
      setError('Veuillez choisir un profil de permissions');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }

    const systemRole = selectedPermRole ? inferSystemRole(selectedPermRole.nom) : 'salesperson';

    setCreating(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError('Session expiree');
      setCreating(false);
      return;
    }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users?action=create`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          company_id: companyId,
          email,
          password,
          full_name: fullName,
          role: systemRole,
          role_id: selectedRoleId,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Erreur lors de la creation');
      setCreating(false);
      return;
    }

    setCreating(false);
    onCreated();
  }

  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-slate-900 text-sm">Nouvel utilisateur</h4>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-2 rounded-xl mb-3">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom complet *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="Prenom Nom" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Profil *</label>
            <div className="relative">
              <select
                value={selectedRoleId}
                onChange={e => setSelectedRoleId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
              >
                <option value="">-- Choisir un profil --</option>
                {companyRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.nom}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder="user@societe.sn" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe *</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder="Min. 6 car." />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {selectedPermRole && (
          <div className="p-3 bg-white border border-gray-100 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500">
                Permissions du profil "{selectedPermRole.nom}" :
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                Niveau : {ROLE_LABELS[inferSystemRole(selectedPermRole.nom)] || 'Utilisateur'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activePermissions.length === 0 ? (
                <span className="text-xs text-slate-400">Aucune permission</span>
              ) : activePermissions.includes('all') ? (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Tous les acces (Admin)
                </span>
              ) : (
                activePermissions.map(k => (
                  <span key={k} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                    {PERMISSION_LABELS[k] || k}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-slate-600 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50">
            Annuler
          </button>
          <button type="submit" disabled={creating}
            className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {creating ? 'Creation...' : 'Creer'}
          </button>
        </div>
      </form>
    </div>
  );
}
