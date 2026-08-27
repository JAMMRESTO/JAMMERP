import { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Building2, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company, Role, Permission } from '../../types';

const PERMISSION_KEYS: { key: keyof Permission; label: string }[] = [
  { key: 'pos', label: 'Point de Vente' },
  { key: 'clients', label: 'Clients' },
  { key: 'fournisseurs', label: 'Fournisseurs' },
  { key: 'factures', label: 'Factures' },
  { key: 'devis', label: 'Devis' },
  { key: 'paiements', label: 'Paiements' },
  { key: 'inventaire', label: 'Inventaire' },
  { key: 'produits', label: 'Produits' },
  { key: 'depenses', label: 'Depenses' },
  { key: 'statistiques', label: 'Statistiques' },
  { key: 'parametres', label: 'Parametres' },
  { key: 'import_export', label: 'Import / Export' },
  { key: 'admin', label: 'Admin' },
];

interface Props {
  companies: Company[];
}

export default function RolesManagement({ companies }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.id || '');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [newName, setNewName] = useState('');
  const [permissions, setPermissions] = useState<Permission>({});
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedCompanyId) loadRoles();
  }, [selectedCompanyId]);

  async function loadRoles() {
    setLoading(true);
    const { data } = await supabase
      .from('roles')
      .select('*')
      .eq('company_id', selectedCompanyId)
      .order('nom');
    setRoles(data || []);
    setLoading(false);
  }

  function startEdit(r: Role) {
    setEditing(r);
    setNewName(r.nom);
    setPermissions(r.permissions_json as Permission);
    setShowForm(true);
  }

  function startNew() {
    setEditing(null);
    setNewName('');
    setPermissions({});
    setShowForm(true);
  }

  function togglePermission(key: keyof Permission) {
    setPermissions(p => ({ ...p, [key]: !p[key] }));
  }

  async function saveRole() {
    if (!newName.trim()) return;
    setSaving(true);
    const data = { company_id: selectedCompanyId, nom: newName.trim(), permissions_json: permissions };
    if (editing) {
      await supabase.from('roles').update(data).eq('id', editing.id);
    } else {
      await supabase.from('roles').insert(data);
    }
    setSaving(false);
    setShowForm(false);
    loadRoles();
  }

  async function deleteRole(id: string) {
    if (!confirm('Supprimer ce role ?')) return;
    await supabase.from('roles').delete().eq('id', id);
    loadRoles();
  }

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[200px]"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {selectedCompany && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 className="w-4 h-4" />
              {roles.length} role{roles.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-400 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nouveau role
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom du role</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Ex: Superviseur, Vendeur..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Permissions</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 cursor-pointer col-span-full p-2 bg-amber-50 rounded-lg mb-1">
                <input type="checkbox" checked={!!permissions.all} onChange={() => togglePermission('all')} className="w-4 h-4 rounded accent-amber-500" />
                <span className="text-sm font-semibold text-amber-700">Tous les acces (Admin)</span>
              </label>
              {PERMISSION_KEYS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={!!(permissions as Record<string, boolean>)[key] || !!permissions.all}
                    onChange={() => togglePermission(key)}
                    disabled={!!permissions.all}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={saveRole} disabled={saving} className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-amber-400 disabled:opacity-60 transition-colors">
              {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Creer'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Aucun role defini pour cette societe</p>
          <p className="text-xs mt-1">Creez un role pour definir les permissions des utilisateurs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map(r => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start justify-between shadow-sm">
              <div>
                <div className="font-semibold text-slate-900">{r.nom}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.permissions_json.all ? (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Tous les acces</span>
                  ) : (
                    Object.entries(r.permissions_json).filter(([, v]) => v).map(([k]) => (
                      <span key={k} className="text-xs bg-gray-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{k}</span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(r)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                  <Save className="w-4 h-4" />
                </button>
                <button onClick={() => deleteRole(r.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
