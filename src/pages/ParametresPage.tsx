import { useState, useEffect, useRef } from 'react';
import { Save, Plus, Pencil, Trash2, Check, X, Upload, Users, Building2, BookOpen, Image, Wallet, Database, AlertTriangle, KeyRound, Shield, Calendar, Briefcase } from 'lucide-react';
import { supabase, getSessionToken } from '../lib/supabase';
import type { Caisse, CompteCharge, Profile } from '../types/database';

interface Organisation {
  id: string;
  nom: string;
  telephone: string;
  adresse: string;
  message_ticket: string;
  logo_url: string;
  created_at: string;
  updated_at: string;
}

interface PageProps {
  isSuperAdmin?: boolean;
  organisationId?: string;
  onSubscriptionUpdated?: () => void;
}

export default function ParametresPage({ isSuperAdmin, organisationId, onSubscriptionUpdated }: PageProps) {
  const [tab, setTab] = useState<'caisses' | 'societe' | 'utilisateurs' | 'comptes' | 'donnees' | 'securite' | 'abonnement' | 'organisations'>('caisses');

  const tabs = [
    { id: 'caisses' as const, label: 'Caisses', icon: Wallet, superOnly: false },
    { id: 'societe' as const, label: 'Societe', icon: Building2, superOnly: false },
    { id: 'utilisateurs' as const, label: 'Utilisateurs', icon: Users, superOnly: false },
    { id: 'comptes' as const, label: 'Comptes', icon: BookOpen, superOnly: false },
    { id: 'organisations' as const, label: 'Organisations', icon: Briefcase, superOnly: true },
    { id: 'securite' as const, label: 'Securite', icon: KeyRound, superOnly: true },
    { id: 'abonnement' as const, label: 'Abonnement', icon: Shield, superOnly: true },
    { id: 'donnees' as const, label: 'Donnees', icon: Database, superOnly: false },
  ];

  const visibleTabs = tabs.filter(t => !t.superOnly || isSuperAdmin);

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
      <div className="shrink-0 bg-gray-50 px-4 pt-3 pb-2 border-b border-gray-100">
        <h1 className="text-lg font-black text-gray-900 mb-2">Parametres</h1>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                tab === t.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 max-w-3xl w-full mx-auto">
        {tab === 'caisses' && <CaissesForm organisationId={organisationId} />}
        {tab === 'societe' && <SocieteForm organisationId={organisationId} />}
        {tab === 'utilisateurs' && <UtilisateursForm isSuperAdmin={isSuperAdmin} organisationId={organisationId} />}
        {tab === 'comptes' && <ComptesForm organisationId={organisationId} />}
        {tab === 'organisations' && isSuperAdmin && <OrganisationsForm />}
        {tab === 'securite' && isSuperAdmin && <SecurityForm />}
        {tab === 'abonnement' && isSuperAdmin && <AbonnementForm onUpdated={onSubscriptionUpdated} />}
        {tab === 'donnees' && <DonneesForm />}
      </div>
    </div>
  );
}

function CaissesForm({ organisationId }: { organisationId?: string }) {
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [error, setError] = useState('');

  const loadAll = async () => {
    const [{ data: c }, { data: u }] = await Promise.all([
      supabase.from('caisses').select('*').order('ordre'),
      supabase.from('profiles').select('*').order('created_at'),
    ]);
    setCaisses(c ?? []);
    setUsers((u ?? []).filter(p => p.nom !== 'Super Admin'));
  };

  useEffect(() => { loadAll(); }, []);

  const resetForm = () => { setNom(''); setAdding(false); setEditId(null); setError(''); };

  const handleAdd = async () => {
    setError('');
    if (!nom.trim()) { setError('Le nom est obligatoire.'); return; }
    const ordre = caisses.length ? Math.max(...caisses.map(c => c.ordre)) + 1 : 1;
    const { error: e } = await supabase.from('caisses').insert({ nom: nom.trim(), ordre, organisation_id: organisationId });
    if (e) { setError(e.message); return; }
    resetForm();
    loadAll();
  };

  const handleUpdate = async () => {
    setError('');
    if (!nom.trim()) { setError('Le nom est obligatoire.'); return; }
    const { error: e } = await supabase.from('caisses').update({ nom: nom.trim() }).eq('id', editId!);
    if (e) { setError(e.message); return; }
    resetForm();
    loadAll();
  };

  const handleDelete = async (c: Caisse) => {
    if (!window.confirm(`Supprimer la caisse "${c.nom}" ? Les transactions liees seront conservees.`)) return;
    const { error: e } = await supabase.from('caisses').delete().eq('id', c.id);
    if (e) { setError(e.message); return; }
    loadAll();
  };

  const assignCaisse = async (userId: string, caisseId: string | null) => {
    await supabase.from('profiles').update({ caisse_id: caisseId }).eq('id', userId);
    loadAll();
  };

  const getUsersForCaisse = (caisseId: string) =>
    users.filter(u => u.caisse_id === caisseId);

  const unassignedUsers = users.filter(u => !u.caisse_id);

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* Caisses list */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Caisses enregistreuses</h3>
          <button
            onClick={() => { setAdding(!adding); setEditId(null); setNom(''); setError(''); }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition active:scale-95"
          >
            <Plus size={15} /> Nouvelle caisse
          </button>
        </div>

        {(adding || editId) && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Nom de la caisse *</label>
              <input
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="ex: Caisse principale, Caisse 2..."
                onKeyDown={e => e.key === 'Enter' && (editId ? handleUpdate() : handleAdd())}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={editId ? handleUpdate : handleAdd}
                className="flex items-center gap-1.5 bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition active:scale-95"
              >
                <Check size={14} /> {editId ? 'Modifier' : 'Creer'}
              </button>
              <button onClick={resetForm} className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {caisses.map(c => {
            const assigned = getUsersForCaisse(c.id);
            return (
              <div key={c.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <Wallet size={16} className="text-emerald-600" />
                    </div>
                    <span className="font-bold text-gray-900">{c.nom}</span>
                    {assigned.length > 0 && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                        {assigned.length} utilisateur{assigned.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditId(c.id); setNom(c.nom); setAdding(false); setError(''); }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Users assigned to this caisse */}
                <div className="pl-12 space-y-1.5">
                  {assigned.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                          <span className="text-gray-600 font-bold text-[10px]">{u.nom.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">{u.nom}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'}`}>
                          {u.role === 'admin' ? 'Admin' : 'Caissier'}
                        </span>
                      </div>
                      <button
                        onClick={() => assignCaisse(u.id, null)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium transition"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}

                  {/* Assign unassigned user to this caisse */}
                  {unassignedUsers.length > 0 && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) { assignCaisse(e.target.value, c.id); e.target.value = ''; } }}
                        className="flex-1 text-xs px-3 py-1.5 bg-white border border-dashed border-gray-300 rounded-xl text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                      >
                        <option value="">+ Assigner un utilisateur...</option>
                        {unassignedUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.nom} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {assigned.length === 0 && unassignedUsers.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Aucun utilisateur disponible a assigner</p>
                  )}
                </div>
              </div>
            );
          })}
          {!caisses.length && (
            <div className="px-6 py-10 text-center">
              <Wallet size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-400">Aucune caisse configuree</p>
              <p className="text-xs text-gray-300 mt-1">Creez une caisse pour commencer a enregistrer des transactions</p>
            </div>
          )}
        </div>
      </div>

      {/* Unassigned users reminder */}
      {unassignedUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Utilisateurs sans caisse assignee</p>
          <p className="text-xs text-amber-600 mb-2">Ces utilisateurs verront "Aucune caisse selectionnee" en se connectant :</p>
          <div className="flex flex-wrap gap-2">
            {unassignedUsers.map(u => (
              <span key={u.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg font-medium">{u.nom}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SocieteForm({ organisationId }: { organisationId?: string }) {
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [adresse, setAdresse] = useState('');
  const [messageTicket, setMessageTicket] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [formatTicket, setFormatTicket] = useState<'80mm' | '55mm'>('80mm');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('societe').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setId(data.id);
        setNom(data.nom);
        setTelephone(data.telephone);
        setAdresse(data.adresse);
        setMessageTicket(data.message_ticket);
        setLogoUrl(data.logo_url);
        setFormatTicket(data.format_ticket || '80mm');
      }
    });
  }, []);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      alert('Format non supporte. Utilisez PNG, JPG, WebP ou SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Le fichier est trop volumineux (max 2 Mo).');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('logos').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      alert('Erreur lors de l\'upload: ' + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
    setLogoUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    if (id) {
      await supabase.from('societe').update({
        nom, telephone, adresse,
        message_ticket: messageTicket,
        logo_url: logoUrl,
        format_ticket: formatTicket,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    } else {
      const { data } = await supabase.from('societe').insert({
        nom, telephone, adresse,
        message_ticket: messageTicket,
        logo_url: logoUrl,
        format_ticket: formatTicket,
        organisation_id: organisationId,
      }).select().maybeSingle();
      if (data) setId(data.id);
    }
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <form onSubmit={handleSave} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3">Parametres sauvegardes avec succes.</div>}

      <InputField label="Nom de la societe" value={nom} onChange={setNom} required />
      <InputField label="Telephone" value={telephone} onChange={setTelephone} />
      <InputField label="Adresse" value={adresse} onChange={setAdresse} />
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message sur ticket</label>
        <textarea
          value={messageTicket}
          onChange={e => setMessageTicket(e.target.value)}
          rows={2}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none transition"
        />
      </div>

      {/* Format ticket */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Format du ticket d'impression</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormatTicket('80mm')}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition ${
              formatTicket === '80mm' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`w-12 h-16 rounded border-2 ${formatTicket === '80mm' ? 'border-emerald-400' : 'border-gray-300'}`} />
            <span className={`text-sm font-bold ${formatTicket === '80mm' ? 'text-emerald-700' : 'text-gray-600'}`}>80mm</span>
            <span className="text-[10px] text-gray-400">Standard</span>
          </button>
          <button
            type="button"
            onClick={() => setFormatTicket('55mm')}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition ${
              formatTicket === '55mm' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className={`w-8 h-16 rounded border-2 ${formatTicket === '55mm' ? 'border-emerald-400' : 'border-gray-300'}`} />
            <span className={`text-sm font-bold ${formatTicket === '55mm' ? 'text-emerald-700' : 'text-gray-600'}`}>55mm</span>
            <span className="text-[10px] text-gray-400">Compact</span>
          </button>
        </div>
      </div>

      {/* Logo upload */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Logo de l'entreprise</label>
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Image size={28} className="text-gray-300" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleUploadLogo}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 disabled:text-gray-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition active:scale-95"
            >
              <Upload size={15} />
              {uploading ? 'Upload en cours...' : 'Choisir un fichier'}
            </button>
            <p className="text-xs text-gray-400">PNG, JPG, WebP ou SVG. Max 2 Mo.</p>
            {logoUrl && (
              <button
                type="button"
                onClick={() => setLogoUrl('')}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Supprimer le logo
              </button>
            )}
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving} className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-bold px-6 py-3 rounded-xl transition active:scale-[0.98]">
        <Save size={16} /> {saving ? 'Enregistrement...' : 'Sauvegarder'}
      </button>
    </form>
  );
}

function UtilisateursForm({ isSuperAdmin, organisationId }: { isSuperAdmin?: boolean; organisationId?: string }) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom: '', email: '', role: 'caissier', pin_code: '', organisation_id: organisationId || '' });
  const [error, setError] = useState('');
  const [orgs, setOrgs] = useState<{ id: string; nom: string }[]>([]);
  const [filterOrg, setFilterOrg] = useState<string>(isSuperAdmin ? 'all' : (organisationId || ''));
  const [generatingPin, setGeneratingPin] = useState(false);

  const generateUniquePin = async (): Promise<string> => {
    setGeneratingPin(true);
    try {
      const { data: allProfiles } = await supabase.from('profiles').select('pin_code');
      const usedPins = new Set((allProfiles ?? []).map(p => p.pin_code).filter(Boolean));
      let pin = '';
      let attempts = 0;
      do {
        pin = String(Math.floor(1000 + Math.random() * 9000));
        attempts++;
      } while (usedPins.has(pin) && attempts < 100);
      return pin;
    } finally {
      setGeneratingPin(false);
    }
  };

  const loadOrgs = async () => {
    if (!isSuperAdmin) return;
    const { data } = await supabase.from('organisations').select('id, nom').order('nom');
    setOrgs(data || []);
  };

  const load = async () => {
    let query = supabase.from('profiles').select('*').order('created_at');
    if (!isSuperAdmin && organisationId) {
      query = query.eq('organisation_id', organisationId);
    } else if (isSuperAdmin && filterOrg !== 'all') {
      query = query.eq('organisation_id', filterOrg);
    }
    const { data } = await query;
    setUsers((data ?? []).filter(p => !p.is_super_admin));
  };

  useEffect(() => { loadOrgs(); }, []);
  useEffect(() => { load(); }, [filterOrg]);

  const resetForm = () => {
    setForm({ nom: '', email: '', role: 'caissier', pin_code: '', organisation_id: filterOrg !== 'all' ? filterOrg : (organisationId || '') });
    setAdding(false);
    setEditId(null);
    setError('');
  };

  const validatePin = (pin: string) => /^\d{4}$/.test(pin);

  const handleAdd = async () => {
    setError('');
    if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    if (!form.pin_code || !validatePin(form.pin_code)) { setError('Le code PIN doit etre exactement 4 chiffres.'); return; }
    if (isSuperAdmin && !form.organisation_id) { setError('Veuillez selectionner une organisation.'); return; }

    const { data: dup } = await supabase.from('profiles').select('id').eq('pin_code', form.pin_code).limit(1);
    if (dup && dup.length > 0) { setError('Ce code PIN est deja utilise. Veuillez regenerer.'); return; }

    const { error: e } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      nom: form.nom.trim(),
      email: form.email.trim(),
      role: form.role,
      pin_code: form.pin_code,
      actif: true,
      organisation_id: form.organisation_id || organisationId,
    });

    if (e) { setError(e.message); return; }
    resetForm();
    load();
  };

  const startEdit = (u: Profile) => {
    setEditId(u.id);
    setForm({ nom: u.nom, email: u.email, role: u.role, pin_code: u.pin_code || '', organisation_id: (u as any).organisation_id || '' });
    setAdding(false);
    setError('');
  };

  const handleUpdate = async () => {
    setError('');
    if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }

    const updateData: any = {
      nom: form.nom.trim(),
      email: form.email.trim(),
      role: form.role,
    };

    if (isSuperAdmin) {
      if (!form.pin_code || !validatePin(form.pin_code)) { setError('Le code PIN doit etre exactement 4 chiffres.'); return; }
      const { data: dup } = await supabase.from('profiles').select('id').eq('pin_code', form.pin_code).neq('id', editId!).limit(1);
      if (dup && dup.length > 0) { setError('Ce code PIN est deja utilise par un autre utilisateur.'); return; }
      updateData.pin_code = form.pin_code;
      if (form.organisation_id) {
        updateData.organisation_id = form.organisation_id;
      }
    }

    const { error: e } = await supabase.from('profiles').update(updateData).eq('id', editId!);

    if (e) { setError(e.message); return; }
    resetForm();
    load();
  };

  const toggleActive = async (u: Profile) => {
    await supabase.from('profiles').update({ actif: !u.actif }).eq('id', u.id);
    load();
  };

  const deleteUser = async (u: Profile) => {
    if (!window.confirm(`Supprimer l'utilisateur "${u.nom}" ?`)) return;
    await supabase.from('profiles').delete().eq('id', u.id);
    load();
  };

  const getOrgName = (orgId: string) => orgs.find(o => o.id === orgId)?.nom || '';

  const roles = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'caissier', label: 'Caissier' },
  ];

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {isSuperAdmin && orgs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Filtrer par organisation</label>
          <select
            value={filterOrg}
            onChange={e => setFilterOrg(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <option value="all">Toutes les organisations</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Utilisateurs</h3>
          <button
            onClick={async () => {
              setEditId(null);
              setError('');
              const pin = await generateUniquePin();
              setForm({ nom: '', email: '', role: 'caissier', pin_code: pin, organisation_id: filterOrg !== 'all' ? filterOrg : (organisationId || '') });
              setAdding(true);
            }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition active:scale-95"
          >
            <Plus size={15} /> Ajouter
          </button>
        </div>

        {(adding || editId) && (
          <div className="px-6 py-5 bg-gray-50 border-b border-gray-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Nom *</label>
                <input
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Nom complet"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Email</label>
                <input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@exemple.com"
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Code PIN (4 chiffres) *</label>
                {adding ? (
                  <div className="w-full px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-mono tracking-widest text-emerald-800 font-bold">
                    {generatingPin ? '...' : form.pin_code}
                    <span className="text-[10px] font-normal text-emerald-600 ml-2 tracking-normal">Auto-genere</span>
                  </div>
                ) : isSuperAdmin ? (
                  <input
                    value={form.pin_code}
                    onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setForm(f => ({ ...f, pin_code: v })); }}
                    placeholder="0000"
                    maxLength={4}
                    inputMode="numeric"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                ) : (
                  <div className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-mono tracking-widest text-gray-700 font-bold">
                    {form.pin_code}
                    <span className="text-[10px] font-normal text-gray-500 ml-2 tracking-normal">Non modifiable</span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {isSuperAdmin && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Organisation *</label>
                  <select
                    value={form.organisation_id}
                    onChange={e => setForm(f => ({ ...f, organisation_id: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">-- Selectionner --</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={editId ? handleUpdate : handleAdd}
                className="flex items-center gap-1.5 bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition active:scale-95"
              >
                <Check size={14} /> {editId ? 'Modifier' : 'Creer'}
              </button>
              <button
                onClick={resetForm}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100 transition"
              >
                <X size={14} /> Annuler
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {users.map(u => (
            <div key={u.id} className={`flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition ${!u.actif ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-emerald-700 font-bold text-sm">{u.nom.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{u.nom}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                  }`}>
                    {u.role === 'admin' ? 'Admin' : 'Caissier'}
                  </span>
                  {!u.actif && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Inactif</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {u.email && <span className="text-xs text-gray-400 truncate">{u.email}</span>}
                  <span className="text-xs text-gray-300 font-mono">PIN: {u.pin_code || '----'}</span>
                  {isSuperAdmin && (u as any).organisation_id && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{getOrgName((u as any).organisation_id)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActive(u)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    u.actif
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {u.actif ? 'Desactiver' : 'Activer'}
                </button>
                <button onClick={() => startEdit(u)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                  <Pencil size={15} />
                </button>
                <button onClick={() => deleteUser(u)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {!users.length && <div className="px-6 py-8 text-sm text-gray-400 text-center">Aucun utilisateur configure</div>}
        </div>
      </div>
    </div>
  );
}

function ComptesForm({ organisationId }: { organisationId?: string }) {
  const [comptes, setComptes] = useState<CompteCharge[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumero, setEditNumero] = useState('');
  const [editLibelle, setEditLibelle] = useState('');
  const [newNumero, setNewNumero] = useState('');
  const [newLibelle, setNewLibelle] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = () => supabase.from('comptes_charges').select('*').order('numero').then(({ data }) => setComptes(data ?? []));
  useEffect(() => { load(); }, []);

  const startEdit = (c: CompteCharge) => { setEditId(c.id); setEditNumero(c.numero); setEditLibelle(c.libelle); };
  const cancelEdit = () => { setEditId(null); setEditNumero(''); setEditLibelle(''); };

  const saveEdit = async () => {
    if (!editNumero.trim() || !editLibelle.trim()) { setError('Champs obligatoires.'); return; }
    await supabase.from('comptes_charges').update({ numero: editNumero, libelle: editLibelle }).eq('id', editId!);
    cancelEdit(); load();
  };

  const deleteCompte = async (id: string) => {
    if (!window.confirm('Supprimer ce compte ?')) return;
    await supabase.from('comptes_charges').delete().eq('id', id);
    load();
  };

  const addCompte = async () => {
    setError('');
    if (!newNumero.trim() || !newLibelle.trim()) { setError('Numero et libelle obligatoires.'); return; }
    const { error: e } = await supabase.from('comptes_charges').insert({ numero: newNumero.trim(), libelle: newLibelle.trim(), organisation_id: organisationId });
    if (e) { setError(e.message); return; }
    setNewNumero(''); setNewLibelle(''); setAdding(false); load();
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Plan comptable des charges</h3>
          <button onClick={() => setAdding(!adding)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition active:scale-95">
            <Plus size={15} /> Ajouter
          </button>
        </div>

        {adding && (
          <div className="px-6 py-4 bg-emerald-50 border-b border-gray-100 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[100px]">
              <label className="text-xs font-semibold text-gray-600 block mb-1">N Compte</label>
              <input value={newNumero} onChange={e => setNewNumero(e.target.value)} placeholder="ex: 615000" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="flex-[2] min-w-[180px]">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Libelle</label>
              <input value={newLibelle} onChange={e => setNewLibelle(e.target.value)} placeholder="ex: Eau et electricite" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="flex gap-2">
              <button onClick={addCompte} className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-600 transition">
                <Check size={14} /> Ajouter
              </button>
              <button onClick={() => { setAdding(false); setNewNumero(''); setNewLibelle(''); }} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-50">
          {comptes.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition">
              {editId === c.id ? (
                <>
                  <input value={editNumero} onChange={e => setEditNumero(e.target.value)} className="w-24 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  <input value={editLibelle} onChange={e => setEditLibelle(e.target.value)} className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  <button onClick={saveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Check size={16} /></button>
                  <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"><X size={16} /></button>
                </>
              ) : (
                <>
                  <span className="w-20 font-mono text-xs text-gray-500 shrink-0">{c.numero}</span>
                  <span className="flex-1 text-sm font-medium text-gray-800">{c.libelle}</span>
                  <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"><Pencil size={15} /></button>
                  <button onClick={() => deleteCompte(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))}
          {!comptes.length && <div className="px-6 py-8 text-sm text-gray-400 text-center">Aucun compte configure</div>}
        </div>
      </div>
    </div>
  );
}

function OrganisationsForm() {
  interface Societe {
    id: string;
    nom: string;
    telephone: string;
    adresse: string;
    message_ticket: string;
    logo_url: string;
    organisation_id: string;
  }
  interface OrgWithSociete extends Organisation {
    societe?: Societe | null;
    profiles_count?: number;
  }

  const [organisations, setOrganisations] = useState<OrgWithSociete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [editingSociete, setEditingSociete] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({ nom: '' });
  const [societeForm, setSocieteForm] = useState({ nom: '', telephone: '', adresse: '', message_ticket: '', logo_url: '' });

  const load = async () => {
    setLoading(true);
    const [orgsRes, societesRes, profilesRes] = await Promise.all([
      supabase.from('organisations').select('*').order('nom'),
      supabase.from('societe').select('*'),
      supabase.from('profiles').select('id, organisation_id'),
    ]);
    if (orgsRes.error) { setError(orgsRes.error.message); setLoading(false); return; }
    const societes = societesRes.data || [];
    const profiles = profilesRes.data || [];

    const enriched: OrgWithSociete[] = (orgsRes.data || []).map(o => ({
      ...o,
      societe: societes.find(s => s.organisation_id === o.id) || null,
      profiles_count: profiles.filter(p => p.organisation_id === o.id).length,
    }));
    setOrganisations(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddOrg = async () => {
    setError('');
    if (!orgForm.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    const { data: newOrg, error: e } = await supabase.from('organisations').insert({
      nom: orgForm.nom.trim(),
    }).select().maybeSingle();
    if (e) { setError(e.message); return; }
    if (newOrg) {
      await supabase.from('societe').insert({
        nom: orgForm.nom.trim(),
        organisation_id: newOrg.id,
        message_ticket: 'Merci de votre visite !',
      });
    }
    setOrgForm({ nom: '' });
    setAdding(false);
    load();
  };

  const handleUpdateOrg = async (id: string) => {
    setError('');
    if (!orgForm.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    const { error: e } = await supabase.from('organisations').update({ nom: orgForm.nom.trim() }).eq('id', id);
    if (e) { setError(e.message); return; }
    setEditingOrg(null);
    setOrgForm({ nom: '' });
    load();
  };

  const handleDeleteOrg = async (id: string) => {
    if (!window.confirm('Supprimer cette organisation ? Toutes les donnees associees seront perdues.')) return;
    await supabase.from('societe').delete().eq('organisation_id', id);
    const { error: e } = await supabase.from('organisations').delete().eq('id', id);
    if (e) { setError(e.message); return; }
    load();
  };

  const startEditSociete = (o: OrgWithSociete) => {
    setEditingSociete(o.id);
    setSocieteForm({
      nom: o.societe?.nom || o.nom || '',
      telephone: o.societe?.telephone || '',
      adresse: o.societe?.adresse || '',
      message_ticket: o.societe?.message_ticket || 'Merci de votre visite !',
      logo_url: o.societe?.logo_url || '',
    });
  };

  const handleSaveSociete = async (orgId: string, societeId?: string) => {
    setError('');
    if (!societeForm.nom.trim()) { setError('Le nom de la societe est obligatoire.'); return; }
    if (societeId) {
      const { error: e } = await supabase.from('societe').update({
        nom: societeForm.nom.trim(),
        telephone: societeForm.telephone.trim(),
        adresse: societeForm.adresse.trim(),
        message_ticket: societeForm.message_ticket.trim(),
        logo_url: societeForm.logo_url.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', societeId);
      if (e) { setError(e.message); return; }
    } else {
      const { error: e } = await supabase.from('societe').insert({
        nom: societeForm.nom.trim(),
        telephone: societeForm.telephone.trim(),
        adresse: societeForm.adresse.trim(),
        message_ticket: societeForm.message_ticket.trim() || 'Merci de votre visite !',
        logo_url: societeForm.logo_url.trim(),
        organisation_id: orgId,
      });
      if (e) { setError(e.message); return; }
    }
    setEditingSociete(null);
    setSocieteForm({ nom: '', telephone: '', adresse: '', message_ticket: '', logo_url: '' });
    load();
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Chargement...</div>;

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Organisations</h3>
          <button onClick={() => { setAdding(!adding); setEditingOrg(null); }} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition active:scale-95">
            <Plus size={15} /> Nouvelle organisation
          </button>
        </div>

        {adding && (
          <div className="px-6 py-4 bg-emerald-50 border-b border-gray-100 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Nom de l'organisation *</label>
              <input value={orgForm.nom} onChange={e => setOrgForm({ nom: e.target.value })} placeholder="Ex: Ma Societe SARL" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAdding(false); setOrgForm({ nom: '' }); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Annuler</button>
              <button onClick={handleAddOrg} className="px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition">Creer</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {organisations.map(o => (
            <div key={o.id}>
              <div className="px-6 py-4">
                {editingOrg === o.id ? (
                  <div className="flex items-center gap-3">
                    <input value={orgForm.nom} onChange={e => setOrgForm({ nom: e.target.value })} className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <button onClick={() => handleUpdateOrg(o.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition"><Check size={16} /></button>
                    <button onClick={() => { setEditingOrg(null); setOrgForm({ nom: '' }); }} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <button onClick={() => setExpandedOrg(expandedOrg === o.id ? null : o.id)} className="flex items-center gap-3 text-left flex-1">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <Building2 size={18} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{o.nom}</p>
                        <p className="text-xs text-gray-500">
                          {o.profiles_count} utilisateur{(o.profiles_count || 0) > 1 ? 's' : ''}
                          {o.societe ? ` - ${o.societe.telephone || 'Pas de tel.'}` : ' - Societe non configuree'}
                        </p>
                      </div>
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingOrg(o.id); setOrgForm({ nom: o.nom }); setAdding(false); }} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"><Pencil size={15} /></button>
                      <button onClick={() => handleDeleteOrg(o.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"><Trash2 size={15} /></button>
                    </div>
                  </div>
                )}
              </div>

              {expandedOrg === o.id && (
                <div className="px-6 pb-4 ml-6 border-l-2 border-emerald-100">
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-700">Infos societe</h4>
                      {editingSociete !== o.id && (
                        <button onClick={() => startEditSociete(o)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                          {o.societe ? 'Modifier' : 'Configurer'}
                        </button>
                      )}
                    </div>

                    {editingSociete === o.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Nom commercial *</label>
                            <input value={societeForm.nom} onChange={e => setSocieteForm({ ...societeForm, nom: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Telephone</label>
                            <input value={societeForm.telephone} onChange={e => setSocieteForm({ ...societeForm, telephone: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Adresse</label>
                          <input value={societeForm.adresse} onChange={e => setSocieteForm({ ...societeForm, adresse: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 block mb-1">Message ticket</label>
                          <input value={societeForm.message_ticket} onChange={e => setSocieteForm({ ...societeForm, message_ticket: e.target.value })} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingSociete(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Annuler</button>
                          <button onClick={() => handleSaveSociete(o.id, o.societe?.id)} className="px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition">Enregistrer</button>
                        </div>
                      </div>
                    ) : o.societe ? (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Nom commercial</p>
                          <p className="font-medium text-gray-900">{o.societe.nom || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Telephone</p>
                          <p className="font-medium text-gray-900">{o.societe.telephone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Adresse</p>
                          <p className="font-medium text-gray-900">{o.societe.adresse || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Message ticket</p>
                          <p className="font-medium text-gray-900">{o.societe.message_ticket || '-'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Societe non configuree. Cliquez "Configurer" pour ajouter les infos.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {!organisations.length && <div className="px-6 py-8 text-sm text-gray-400 text-center">Aucune organisation configuree</div>}
        </div>
      </div>
    </div>
  );
}

function DonneesForm() {
  const [counts, setCounts] = useState({ encaissements: 0, decaissements: 0, sessions: 0 });
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadCounts = async () => {
    const [enc, dec, sess] = await Promise.all([
      supabase.from('encaissements').select('id', { count: 'exact', head: true }),
      supabase.from('decaissements').select('id', { count: 'exact', head: true }),
      supabase.from('app_sessions').select('token', { count: 'exact', head: true }),
    ]);
    setCounts({
      encaissements: enc.count ?? 0,
      decaissements: dec.count ?? 0,
      sessions: sess.count ?? 0,
    });
  };

  useEffect(() => { loadCounts(); }, []);

  const handleReset = async () => {
    if (confirmText !== 'RESET') return;
    setLoading(true);
    setResult(null);

    try {
      const token = getSessionToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin/reset-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, confirmation: 'RESET' }),
      });
      const data = await res.json();

      if (data?.error) {
        setResult({ ok: false, message: data.error });
        return;
      }

      setResult({ ok: true, message: 'Toutes les donnees ont ete reinitialisees avec succes.' });
      setConfirming(false);
      setConfirmText('');
      loadCounts();
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const totalTransactions = counts.encaissements + counts.decaissements;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-bold text-gray-900 mb-4">Etat des donnees</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-emerald-700">{counts.encaissements}</p>
            <p className="text-xs font-medium text-emerald-600 mt-1">Encaissements</p>
          </div>
          <div className="bg-orange-50 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-orange-700">{counts.decaissements}</p>
            <p className="text-xs font-medium text-orange-600 mt-1">Decaissements</p>
          </div>
          <div className="bg-sky-50 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-sky-700">{counts.sessions}</p>
            <p className="text-xs font-medium text-sky-600 mt-1">Sessions</p>
          </div>
        </div>
      </div>

      {/* Reset section */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Reinitialisation complete</h3>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Action irreversible</p>
              <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                Cette operation supprimera definitivement tous les encaissements, decaissements et sessions.
                Les caisses, utilisateurs, societe et comptes de charges seront conserves.
              </p>
            </div>
          </div>

          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={totalTransactions === 0}
              className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
            >
              <Trash2 size={16} />
              {totalTransactions === 0 ? 'Aucune donnee a supprimer' : 'Reinitialiser toutes les donnees'}
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  Tapez <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">RESET</span> pour confirmer
                </label>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={confirmText !== 'RESET' || loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-200 disabled:text-red-300 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
                >
                  <Trash2 size={16} />
                  {loading ? 'Suppression en cours...' : 'Confirmer la reinitialisation'}
                </button>
                <button
                  onClick={() => { setConfirming(false); setConfirmText(''); }}
                  disabled={loading}
                  className="px-5 py-3 text-gray-500 hover:text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className={`mt-4 text-sm rounded-xl px-4 py-3 ${
              result.ok
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityForm() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [newPin, setNewPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at').then(({ data }) => {
      setUsers(data ?? []);
    });
  }, []);

  const handleResetPin = async () => {
    if (!selectedUser || !newPin || !/^\d{4}$/.test(newPin)) return;
    setLoading(true);
    setResult(null);

    try {
      const token = getSessionToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin/reset-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, target_user_id: selectedUser, new_pin: newPin }),
      });
      const data = await res.json();

      if (data?.error) {
        setResult({ ok: false, message: data.error });
      } else {
        setResult({ ok: true, message: 'Code PIN reinitialise avec succes.' });
        setNewPin('');
        setSelectedUser('');
      }
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const selectedProfile = users.find(u => u.id === selectedUser);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <KeyRound size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Reinitialisation des codes PIN</h3>
              <p className="text-xs text-gray-400">Reservee au super administrateur</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Cette action modifie immediatement le code PIN de l'utilisateur selectionne.
              Il devra utiliser le nouveau PIN pour se reconnecter.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Utilisateur</label>
            <select
              value={selectedUser}
              onChange={e => { setSelectedUser(e.target.value); setResult(null); }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <option value="">Selectionner un utilisateur...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nom} ({u.role}{u.is_super_admin ? ' - Super Admin' : ''})
                </option>
              ))}
            </select>
          </div>

          {selectedUser && (
            <>
              {selectedProfile && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <span className="text-emerald-700 font-bold text-sm">{selectedProfile.nom.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{selectedProfile.nom}</p>
                    <p className="text-xs text-gray-400">{selectedProfile.email || 'Pas d\'email'} - PIN actuel: {selectedProfile.pin_code}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Nouveau code PIN (4 chiffres)</label>
                <input
                  value={newPin}
                  onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setNewPin(v); }}
                  placeholder="0000"
                  maxLength={4}
                  inputMode="numeric"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>

              <button
                onClick={handleResetPin}
                disabled={!newPin || newPin.length !== 4 || loading}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
              >
                <KeyRound size={16} />
                {loading ? 'Reinitialisation...' : 'Reinitialiser le code PIN'}
              </button>
            </>
          )}

          {result && (
            <div className={`text-sm rounded-xl px-4 py-3 ${
              result.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PLAN_OPTIONS = [
  { value: 'mensuel', label: 'Mensuel (1 mois)', duration: '1 mois' },
  { value: 'trimestriel', label: 'Trimestriel (3 mois)', duration: '3 mois' },
  { value: 'annuel', label: 'Annuel (12 mois)', duration: '12 mois' },
];

function AbonnementForm({ onUpdated }: { onUpdated?: () => void }) {
  interface SubRow { id: string; plan: string; date_debut: string; date_fin: string; actif: boolean; organisation_id: string }
  const [orgs, setOrgs] = useState<{ id: string; nom: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [currentSub, setCurrentSub] = useState<SubRow | null>(null);
  const [plan, setPlan] = useState('mensuel');
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadOrgs = async () => {
    const { data } = await supabase.from('organisations').select('id, nom').order('nom');
    const list = data || [];
    setOrgs(list);
    if (list.length > 0 && !selectedOrg) setSelectedOrg(list[0].id);
  };

  const loadSubscription = async (orgId: string) => {
    if (!orgId) { setCurrentSub(null); return; }
    const { data } = await supabase
      .from('subscription')
      .select('*')
      .eq('organisation_id', orgId)
      .eq('actif', true)
      .order('date_fin', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrentSub(data);
  };

  useEffect(() => { loadOrgs(); }, []);
  useEffect(() => { if (selectedOrg) loadSubscription(selectedOrg); }, [selectedOrg]);

  const handleActivate = async () => {
    if (!selectedOrg) { setResult({ ok: false, message: 'Selectionnez une organisation.' }); return; }
    setLoading(true);
    setResult(null);

    try {
      const token = getSessionToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin/manage-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, plan, date_debut: dateDebut, organisation_id: selectedOrg }),
      });
      const data = await res.json();

      if (data?.error) {
        setResult({ ok: false, message: data.error });
      } else {
        setResult({ ok: true, message: `Abonnement ${plan} active avec succes pour ${orgs.find(o => o.id === selectedOrg)?.nom}.` });
        loadSubscription(selectedOrg);
        onUpdated?.();
      }
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const now = new Date().toISOString().slice(0, 10);
  const isExpired = currentSub ? currentSub.date_fin < now : false;
  const daysLeft = currentSub && !isExpired
    ? Math.ceil((new Date(currentSub.date_fin).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="space-y-4">
      {/* Organisation selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Organisation</label>
        <select
          value={selectedOrg}
          onChange={e => { setSelectedOrg(e.target.value); setResult(null); }}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          {orgs.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>

      {/* Current subscription status */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isExpired ? 'bg-red-100' : currentSub ? 'bg-emerald-100' : 'bg-gray-100'}`}>
              <Shield size={16} className={isExpired ? 'text-red-600' : currentSub ? 'text-emerald-600' : 'text-gray-400'} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Abonnement</h3>
              <p className="text-xs text-gray-400">
                {orgs.find(o => o.id === selectedOrg)?.nom || 'Selectionnez une organisation'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {currentSub ? (
            <div className={`rounded-2xl p-5 border ${
              isExpired ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold uppercase tracking-wide ${isExpired ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isExpired ? 'EXPIRE' : 'ACTIF'}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  Plan {currentSub.plan}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">Debut</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDate(currentSub.date_debut)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase">Expiration</p>
                  <p className="text-sm font-bold text-gray-900">{fmtDate(currentSub.date_fin)}</p>
                </div>
              </div>
              {!isExpired && (
                <div className="mt-3 flex items-center gap-2">
                  <Calendar size={12} className="text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700">{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</span>
                </div>
              )}
              {isExpired && (
                <p className="mt-3 text-xs font-semibold text-red-600">
                  L'application est bloquee pour les utilisateurs de cette organisation.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center">
              <Shield size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-500">Aucun abonnement configure</p>
              <p className="text-xs text-gray-400 mt-1">L'application fonctionne sans restriction pour cette organisation.</p>
            </div>
          )}

          {/* New subscription form */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-gray-900 mb-3">
              {currentSub ? 'Renouveler / Changer de plan' : 'Activer un abonnement'}
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLAN_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPlan(p.value)}
                      className={`px-3 py-3 rounded-xl border text-center transition ${
                        plan === p.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-xs font-bold">{p.value === 'mensuel' ? '1 mois' : p.value === 'trimestriel' ? '3 mois' : '12 mois'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{p.value}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Date de debut</label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={e => setDateDebut(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
              </div>

              <button
                onClick={handleActivate}
                disabled={loading || !selectedOrg}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
              >
                <Shield size={16} />
                {loading ? 'Activation...' : currentSub ? 'Renouveler l\'abonnement' : 'Activer l\'abonnement'}
              </button>
            </div>
          </div>

          {result && (
            <div className={`text-sm rounded-xl px-4 py-3 ${
              result.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}{required && ' *'}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
      />
    </div>
  );
}
