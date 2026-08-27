import { useState, useEffect } from 'react';
import { Building2, Plus, Pencil, Trash2, Check, X, Users, Shield, Calendar, ChevronDown, ChevronRight, LogIn } from 'lucide-react';
import { supabase, getSessionToken } from '../lib/supabase';

interface Organisation {
  id: string;
  nom: string;
  created_at: string;
}

interface Societe {
  id: string;
  nom: string;
  telephone: string;
  adresse: string;
  message_ticket: string;
  logo_url: string;
  organisation_id: string;
}

interface SubRow {
  id: string;
  plan: string;
  date_debut: string;
  date_fin: string;
  actif: boolean;
  organisation_id: string;
}

interface ProfileRow {
  id: string;
  nom: string;
  role: string;
  actif: boolean;
  organisation_id: string;
  pin_code: string;
  email: string;
  is_super_admin: boolean;
}

const PLAN_OPTIONS = [
  { value: 'mensuel', label: '1 mois' },
  { value: 'trimestriel', label: '3 mois' },
  { value: 'annuel', label: '12 mois' },
];

interface SocietesPageProps {
  currentOrgId?: string;
  onSwitchOrg?: (orgId: string, orgName: string) => void;
}

export default function SocietesPage({ currentOrgId, onSwitchOrg }: SocietesPageProps) {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [societes, setSocietes] = useState<Societe[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, 'info' | 'users' | 'abonnement'>>({});

  // Add org form
  const [addingOrg, setAddingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  // Edit societe
  const [editingSociete, setEditingSociete] = useState<string | null>(null);
  const [societeForm, setSocieteForm] = useState({ nom: '', telephone: '', adresse: '', message_ticket: '', format_ticket: '80mm' as '80mm' | '55mm' });

  // Add user
  const [addingUser, setAddingUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ nom: '', email: '', role: 'caissier', pin_code: '' });

  // Subscription
  const [subForm, setSubForm] = useState({ plan: 'mensuel', date_debut: new Date().toISOString().slice(0, 10) });
  const [subLoading, setSubLoading] = useState(false);
  const [subResult, setSubResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [orgsRes, socRes, subRes, profRes] = await Promise.all([
      supabase.from('organisations').select('*').order('nom'),
      supabase.from('societe').select('*'),
      supabase.from('subscription').select('*').eq('actif', true),
      supabase.from('profiles').select('*').order('nom'),
    ]);
    setOrgs(orgsRes.data || []);
    setSocietes(socRes.data || []);
    setSubscriptions(subRes.data || []);
    setProfiles((profRes.data || []).filter(p => !p.is_super_admin));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getTab = (orgId: string) => activeTab[orgId] || 'info';
  const setTab = (orgId: string, tab: 'info' | 'users' | 'abonnement') => setActiveTab(prev => ({ ...prev, [orgId]: tab }));

  const getSociete = (orgId: string) => societes.find(s => s.organisation_id === orgId);
  const getSub = (orgId: string) => subscriptions.find(s => s.organisation_id === orgId);
  const getOrgProfiles = (orgId: string) => profiles.filter(p => p.organisation_id === orgId);

  const handleAddOrg = async () => {
    setError('');
    if (!newOrgName.trim()) { setError('Le nom est obligatoire.'); return; }
    const { data: newOrg, error: e } = await supabase.from('organisations').insert({ nom: newOrgName.trim() }).select().maybeSingle();
    if (e) { setError(e.message); return; }
    if (newOrg) {
      await supabase.from('societe').insert({ nom: newOrgName.trim(), organisation_id: newOrg.id, message_ticket: 'Merci de votre visite !' });
    }
    setNewOrgName('');
    setAddingOrg(false);
    load();
  };

  const handleDeleteOrg = async (id: string) => {
    if (!window.confirm('Supprimer cette organisation et toutes ses donnees ?')) return;
    await supabase.from('societe').delete().eq('organisation_id', id);
    await supabase.from('subscription').delete().eq('organisation_id', id);
    const { error: e } = await supabase.from('organisations').delete().eq('id', id);
    if (e) { setError(e.message); return; }
    if (expandedOrg === id) setExpandedOrg(null);
    load();
  };

  const startEditSociete = (orgId: string) => {
    const s = getSociete(orgId);
    const o = orgs.find(x => x.id === orgId);
    setEditingSociete(orgId);
    setSocieteForm({
      nom: s?.nom || o?.nom || '',
      telephone: s?.telephone || '',
      adresse: s?.adresse || '',
      message_ticket: s?.message_ticket || 'Merci de votre visite !',
      format_ticket: (s as any)?.format_ticket || '80mm',
    });
  };

  const handleSaveSociete = async (orgId: string) => {
    setError('');
    const existing = getSociete(orgId);
    if (existing) {
      const { error: e } = await supabase.from('societe').update({
        nom: societeForm.nom.trim(),
        telephone: societeForm.telephone.trim(),
        adresse: societeForm.adresse.trim(),
        message_ticket: societeForm.message_ticket.trim(),
        format_ticket: societeForm.format_ticket,
      }).eq('id', existing.id);
      if (e) { setError(e.message); return; }
    } else {
      const { error: e } = await supabase.from('societe').insert({
        nom: societeForm.nom.trim(),
        telephone: societeForm.telephone.trim(),
        adresse: societeForm.adresse.trim(),
        message_ticket: societeForm.message_ticket.trim() || 'Merci de votre visite !',
        format_ticket: societeForm.format_ticket,
        organisation_id: orgId,
      });
      if (e) { setError(e.message); return; }
    }
    setEditingSociete(null);
    load();
  };

  const handleAddUser = async (orgId: string) => {
    setError('');
    if (!userForm.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    if (!/^\d{4}$/.test(userForm.pin_code)) { setError('Le code PIN doit etre 4 chiffres.'); return; }
    const dup = profiles.find(p => p.pin_code === userForm.pin_code);
    if (dup) { setError('Ce code PIN est deja utilise.'); return; }

    const { error: e } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      nom: userForm.nom.trim(),
      email: userForm.email.trim(),
      role: userForm.role,
      pin_code: userForm.pin_code,
      actif: true,
      organisation_id: orgId,
    });
    if (e) { setError(e.message); return; }
    setUserForm({ nom: '', email: '', role: 'caissier', pin_code: '' });
    setAddingUser(null);
    load();
  };

  const toggleUserActive = async (u: ProfileRow) => {
    await supabase.from('profiles').update({ actif: !u.actif }).eq('id', u.id);
    load();
  };

  const deleteUser = async (u: ProfileRow) => {
    if (!window.confirm(`Supprimer "${u.nom}" ?`)) return;
    await supabase.from('profiles').delete().eq('id', u.id);
    load();
  };

  const handleActivateSub = async (orgId: string) => {
    setSubLoading(true);
    setSubResult(null);
    try {
      const token = getSessionToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin/manage-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, plan: subForm.plan, date_debut: subForm.date_debut, organisation_id: orgId }),
      });
      const data = await res.json();
      if (data?.error) {
        setSubResult({ ok: false, message: data.error });
      } else {
        setSubResult({ ok: true, message: `Abonnement active pour ${orgs.find(o => o.id === orgId)?.nom}.` });
        load();
      }
    } catch (err) {
      setSubResult({ ok: false, message: String(err) });
    } finally {
      setSubLoading(false);
    }
  };

  const fmtDate = (d: string) => {
    if (!d) return '-';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-gray-900">Gestion des Societes</h1>
            <p className="text-sm text-gray-500 mt-0.5">{orgs.length} organisation{orgs.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setAddingOrg(!addingOrg)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition active:scale-95"
          >
            <Plus size={16} /> Nouvelle organisation
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* Add org form */}
        {addingOrg && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Nom de l'organisation</label>
              <input
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder="Ex: Ma Societe SARL"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                onKeyDown={e => e.key === 'Enter' && handleAddOrg()}
              />
            </div>
            <button onClick={handleAddOrg} className="px-4 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition">Creer</button>
            <button onClick={() => { setAddingOrg(false); setNewOrgName(''); }} className="px-4 py-2.5 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-100 transition">Annuler</button>
          </div>
        )}

        {/* Organisations list */}
        <div className="space-y-3">
          {orgs.map(org => {
            const societe = getSociete(org.id);
            const sub = getSub(org.id);
            const orgProfiles = getOrgProfiles(org.id);
            const isExpanded = expandedOrg === org.id;
            const now = new Date().toISOString().slice(0, 10);
            const isExpired = sub ? sub.date_fin < now : false;
            const daysLeft = sub && !isExpired ? Math.ceil((new Date(sub.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
            const tab = getTab(org.id);

            return (
              <div key={org.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Org header */}
                <div className="px-5 py-4 flex items-center justify-between">
                  <button
                    onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <Building2 size={20} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 truncate">{org.nom}</p>
                        {currentOrgId === org.id && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold shrink-0">ACTIVE</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Users size={11} /> {orgProfiles.length}</span>
                        {sub && (
                          <span className={`text-xs font-medium flex items-center gap-1 ${isExpired ? 'text-red-500' : 'text-emerald-600'}`}>
                            <Shield size={11} />
                            {isExpired ? 'Expire' : `${daysLeft}j`}
                          </span>
                        )}
                        {!sub && <span className="text-xs text-gray-400">Pas d'abonnement</span>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400 ml-auto" /> : <ChevronRight size={16} className="text-gray-400 ml-auto" />}
                  </button>
                  {onSwitchOrg && currentOrgId !== org.id && (
                    <button
                      onClick={() => onSwitchOrg(org.id, org.nom)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl transition ml-1"
                      title="Acceder a cette organisation"
                    >
                      <LogIn size={14} /> Acceder
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteOrg(org.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition ml-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Tabs */}
                    <div className="flex gap-1 px-5 pt-3 pb-2">
                      {(['info', 'users', 'abonnement'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setTab(org.id, t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            tab === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {t === 'info' ? 'Infos societe' : t === 'users' ? 'Utilisateurs' : 'Abonnement'}
                        </button>
                      ))}
                    </div>

                    <div className="px-5 pb-5 pt-2">
                      {/* INFO TAB */}
                      {tab === 'info' && (
                        <div>
                          {editingSociete === org.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-gray-600 block mb-1">Nom commercial</label>
                                  <input value={societeForm.nom} onChange={e => setSocieteForm(f => ({ ...f, nom: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-gray-600 block mb-1">Telephone</label>
                                  <input value={societeForm.telephone} onChange={e => setSocieteForm(f => ({ ...f, telephone: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Adresse</label>
                                <input value={societeForm.adresse} onChange={e => setSocieteForm(f => ({ ...f, adresse: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Message ticket</label>
                                <input value={societeForm.message_ticket} onChange={e => setSocieteForm(f => ({ ...f, message_ticket: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-600 block mb-1">Format ticket</label>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => setSocieteForm(f => ({ ...f, format_ticket: '80mm' }))} className={`flex-1 px-3 py-2 rounded-xl border text-center text-sm font-bold transition ${societeForm.format_ticket === '80mm' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>80mm</button>
                                  <button type="button" onClick={() => setSocieteForm(f => ({ ...f, format_ticket: '55mm' }))} className={`flex-1 px-3 py-2 rounded-xl border text-center text-sm font-bold transition ${societeForm.format_ticket === '55mm' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>55mm</button>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveSociete(org.id)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition"><Check size={14} /> Enregistrer</button>
                                <button onClick={() => setEditingSociete(null)} className="px-4 py-2 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-100 transition">Annuler</button>
                              </div>
                            </div>
                          ) : societe ? (
                            <div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><p className="text-xs text-gray-500 mb-0.5">Nom commercial</p><p className="font-medium text-gray-900">{societe.nom || '-'}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Telephone</p><p className="font-medium text-gray-900">{societe.telephone || '-'}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Adresse</p><p className="font-medium text-gray-900">{societe.adresse || '-'}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Message ticket</p><p className="font-medium text-gray-900">{societe.message_ticket || '-'}</p></div>
                                <div><p className="text-xs text-gray-500 mb-0.5">Format ticket</p><p className="font-medium text-gray-900">{(societe as any).format_ticket || '80mm'}</p></div>
                              </div>
                              <button onClick={() => startEditSociete(org.id)} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition"><Pencil size={13} /> Modifier</button>
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-400 mb-2">Societe non configuree</p>
                              <button onClick={() => startEditSociete(org.id)} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">Configurer</button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* USERS TAB */}
                      {tab === 'users' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-gray-700">{orgProfiles.length} utilisateur{orgProfiles.length > 1 ? 's' : ''}</p>
                            <button
                              onClick={() => setAddingUser(addingUser === org.id ? null : org.id)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition"
                            >
                              <Plus size={13} /> Ajouter
                            </button>
                          </div>

                          {addingUser === org.id && (
                            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input value={userForm.nom} onChange={e => setUserForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom *" className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                <input value={userForm.pin_code} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setUserForm(f => ({ ...f, pin_code: v })); }} placeholder="PIN 4 chiffres *" maxLength={4} inputMode="numeric" className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                <input value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                                <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                                  <option value="caissier">Caissier</option>
                                  <option value="admin">Administrateur</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleAddUser(org.id)} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition">Creer</button>
                                <button onClick={() => setAddingUser(null)} className="px-3 py-1.5 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-100 transition">Annuler</button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1">
                            {orgProfiles.map(u => (
                              <div key={u.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition ${!u.actif ? 'opacity-50' : ''}`}>
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                  <span className="text-emerald-700 font-bold text-xs">{u.nom.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900 truncate">{u.nom}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                      {u.role === 'admin' ? 'Admin' : 'Caissier'}
                                    </span>
                                    {!u.actif && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactif</span>}
                                  </div>
                                  <span className="text-xs text-gray-400 font-mono">PIN: {u.pin_code}</span>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => toggleUserActive(u)} className={`px-2 py-1 rounded-lg text-[10px] font-medium ${u.actif ? 'text-orange-600 hover:bg-orange-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                                    {u.actif ? 'Desactiver' : 'Activer'}
                                  </button>
                                  <button onClick={() => deleteUser(u)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={13} /></button>
                                </div>
                              </div>
                            ))}
                            {!orgProfiles.length && <p className="text-sm text-gray-400 text-center py-3">Aucun utilisateur</p>}
                          </div>
                        </div>
                      )}

                      {/* ABONNEMENT TAB */}
                      {tab === 'abonnement' && (
                        <div className="space-y-4">
                          {sub ? (
                            <div className={`rounded-xl p-4 border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-bold uppercase ${isExpired ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {isExpired ? 'EXPIRE' : 'ACTIF'}
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  Plan {sub.plan}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><p className="text-[10px] text-gray-500 uppercase font-semibold">Debut</p><p className="font-bold text-gray-900">{fmtDate(sub.date_debut)}</p></div>
                                <div><p className="text-[10px] text-gray-500 uppercase font-semibold">Fin</p><p className="font-bold text-gray-900">{fmtDate(sub.date_fin)}</p></div>
                              </div>
                              {!isExpired && (
                                <p className="text-xs font-semibold text-emerald-700 mt-2 flex items-center gap-1"><Calendar size={11} />{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</p>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                              <Shield size={24} className="text-gray-300 mx-auto mb-1" />
                              <p className="text-sm text-gray-500 font-medium">Aucun abonnement</p>
                            </div>
                          )}

                          <div className="border-t border-gray-100 pt-3 space-y-3">
                            <p className="text-sm font-bold text-gray-900">{sub ? 'Renouveler' : 'Activer un abonnement'}</p>
                            <div className="grid grid-cols-3 gap-2">
                              {PLAN_OPTIONS.map(p => (
                                <button
                                  key={p.value}
                                  onClick={() => setSubForm(f => ({ ...f, plan: p.value }))}
                                  className={`px-3 py-2.5 rounded-xl border text-center transition ${
                                    subForm.plan === p.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  <p className="text-xs font-bold">{p.label}</p>
                                </button>
                              ))}
                            </div>
                            <input
                              type="date"
                              value={subForm.date_debut}
                              onChange={e => setSubForm(f => ({ ...f, date_debut: e.target.value }))}
                              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                            <button
                              onClick={() => handleActivateSub(org.id)}
                              disabled={subLoading}
                              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2.5 rounded-xl transition text-sm"
                            >
                              <Shield size={14} />
                              {subLoading ? 'Activation...' : 'Activer'}
                            </button>
                            {subResult && (
                              <div className={`text-xs rounded-xl px-3 py-2 ${subResult.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                                {subResult.message}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!orgs.length && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <Building2 size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Aucune organisation configuree</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
