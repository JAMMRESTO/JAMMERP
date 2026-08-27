import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, CreditCard as Edit2, Save, Users, Monitor, BookOpen } from 'lucide-react';

const api = () => window.electronAPI;

export default function ParametresPage() {
  const [tab, setTab] = useState<'societe' | 'caisses' | 'users' | 'comptes'>('societe');
  const [societe, setSociete] = useState<any>(null);
  const [caisses, setCaisses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [comptes, setComptes] = useState<any[]>([]);
  const [editSociete, setEditSociete] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // New item forms
  const [newCaisse, setNewCaisse] = useState('');
  const [newProfile, setNewProfile] = useState({ nom: '', pin_code: '', role: 'caissier', caisse_id: '' });
  const [newCompte, setNewCompte] = useState({ numero: '', libelle: '' });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [s, c, p, co] = await Promise.all([
      api().societe.get(),
      api().caisses.getAll(),
      api().profiles.getAll(),
      api().comptes.getAll(),
    ]);
    setSociete(s);
    setEditSociete(s);
    setCaisses(c);
    setProfiles(p);
    setComptes(co);
  };

  const saveSociete = async () => {
    if (!editSociete) return;
    setSaving(true);
    await api().societe.update(editSociete);
    setSaving(false);
  };

  const addCaisse = async () => {
    if (!newCaisse.trim()) return;
    await api().caisses.create({ nom: newCaisse.trim() });
    setNewCaisse('');
    setCaisses(await api().caisses.getAll());
  };

  const deleteCaisse = async (id: string) => {
    await api().caisses.delete(id);
    setCaisses(await api().caisses.getAll());
  };

  const addProfile = async () => {
    if (!newProfile.nom.trim() || !newProfile.pin_code.trim()) return;
    await api().profiles.create(newProfile);
    setNewProfile({ nom: '', pin_code: '', role: 'caissier', caisse_id: '' });
    setProfiles(await api().profiles.getAll());
  };

  const deleteProfile = async (id: string) => {
    await api().profiles.delete(id);
    setProfiles(await api().profiles.getAll());
  };

  const addCompte = async () => {
    if (!newCompte.numero.trim() || !newCompte.libelle.trim()) return;
    await api().comptes.create(newCompte);
    setNewCompte({ numero: '', libelle: '' });
    setComptes(await api().comptes.getAll());
  };

  const deleteCompte = async (id: string) => {
    await api().comptes.delete(id);
    setComptes(await api().comptes.getAll());
  };

  const tabs = [
    { key: 'societe', label: 'Societe', icon: Settings },
    { key: 'caisses', label: 'Caisses', icon: Monitor },
    { key: 'users', label: 'Utilisateurs', icon: Users },
    { key: 'comptes', label: 'Comptes', icon: BookOpen },
  ];

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-3 pb-2">
        <h1 className="text-lg font-black text-gray-900 mb-3">Parametres</h1>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                tab === t.key ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {tab === 'societe' && editSociete && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nom de la societe</label>
              <input value={editSociete.nom_societe || ''} onChange={e => setEditSociete({ ...editSociete, nom_societe: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nom affiche</label>
              <input value={editSociete.nom || ''} onChange={e => setEditSociete({ ...editSociete, nom: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Telephone</label>
                <input value={editSociete.telephone || ''} onChange={e => setEditSociete({ ...editSociete, telephone: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Format ticket</label>
                <select value={editSociete.format_ticket || '80mm'} onChange={e => setEditSociete({ ...editSociete, format_ticket: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none">
                  <option value="80mm">80mm</option>
                  <option value="55mm">55mm</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Adresse</label>
              <input value={editSociete.adresse || ''} onChange={e => setEditSociete({ ...editSociete, adresse: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Message ticket</label>
              <input value={editSociete.message_ticket || ''} onChange={e => setEditSociete({ ...editSociete, message_ticket: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <button onClick={saveSociete} disabled={saving}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2">
              <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}

        {tab === 'caisses' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-2">
                <input value={newCaisse} onChange={e => setNewCaisse(e.target.value)} placeholder="Nom de la nouvelle caisse"
                  className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <button onClick={addCaisse} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition text-sm">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {caisses.map((c: any) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{c.nom}</span>
                  <button onClick={() => deleteCaisse(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'users' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input value={newProfile.nom} onChange={e => setNewProfile({ ...newProfile, nom: e.target.value })} placeholder="Nom"
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <input value={newProfile.pin_code} onChange={e => setNewProfile({ ...newProfile, pin_code: e.target.value })} placeholder="Code PIN (4 chiffres)" maxLength={4}
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={newProfile.role} onChange={e => setNewProfile({ ...newProfile, role: e.target.value })}
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none">
                  <option value="caissier">Caissier</option>
                  <option value="admin">Admin</option>
                </select>
                <select value={newProfile.caisse_id} onChange={e => setNewProfile({ ...newProfile, caisse_id: e.target.value })}
                  className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none">
                  <option value="">Toutes les caisses</option>
                  {caisses.map((c: any) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <button onClick={addProfile} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl transition text-sm">
                Ajouter l'utilisateur
              </button>
            </div>
            <div className="space-y-2">
              {profiles.map((p: any) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">{p.nom}</span>
                    <span className="text-[10px] ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">{p.role}</span>
                  </div>
                  <button onClick={() => deleteProfile(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'comptes' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-2">
                <input value={newCompte.numero} onChange={e => setNewCompte({ ...newCompte, numero: e.target.value })} placeholder="N compte"
                  className="w-24 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <input value={newCompte.libelle} onChange={e => setNewCompte({ ...newCompte, libelle: e.target.value })} placeholder="Libelle"
                  className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                <button onClick={addCompte} className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition text-sm">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {comptes.map((c: any) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-gray-400 mr-2">{c.numero}</span>
                    <span className="text-sm font-semibold text-gray-800">{c.libelle}</span>
                  </div>
                  <button onClick={() => deleteCompte(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
