import { useState, useRef } from 'react';
import { Save, Building2, Receipt, Users, Upload, X, Image, ShoppingCart, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company, Profile, TemplateStyle } from '../../types';
import { hasPermission } from '../../lib/permissions';
import TemplateSelector from './TemplateSelector';

interface Props { company: Company; profile: Profile; onCompanyUpdate: () => void; }

export default function ParametresPage({ company, profile, onCompanyUpdate }: Props) {
  const [tab, setTab] = useState<'societe' | 'tva' | 'documents' | 'modules' | 'utilisateurs'>('societe');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [form, setForm] = useState({
    name: company.name || '',
    address: company.address || '',
    phone: company.phone || '',
    email: company.email || '',
    tax_number: company.tax_number || '',
    currency: company.currency || 'XOF',
    currency_symbol: company.currency_symbol || 'F CFA',
    logo_url: company.logo_url || '',
    tva_enabled: company.tva_enabled || false,
    tva_rate: company.tva_rate || 18,
    pos_enabled: company.pos_enabled || false,
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>(company.logo_url || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string | boolean | number) { setForm(f => ({ ...f, [k]: v })); }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { alert('Le fichier ne doit pas dépasser 2 Mo'); return; }

    setLogoUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${company.id}/logo.${ext}`;

    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (error) { setLogoUploading(false); alert('Erreur lors de l\'upload'); return; }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    const publicUrl = urlData.publicUrl + '?t=' + Date.now();

    setLogoPreview(publicUrl);
    setForm(f => ({ ...f, logo_url: urlData.publicUrl }));
    setLogoUploading(false);
  }

  function removeLogo() {
    setLogoPreview('');
    setForm(f => ({ ...f, logo_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from('companies').update(form).eq('id', company.id);
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onCompanyUpdate();
  }

  async function saveTemplates(templateFacture: TemplateStyle, templateTicket: TemplateStyle) {
    setTemplateSaving(true);
    await supabase.from('companies').update({
      template_facture: templateFacture,
      template_ticket: templateTicket,
    }).eq('id', company.id);
    setTemplateSaving(false);
    onCompanyUpdate();
  }

  const isAdmin = hasPermission(profile, 'parametres');
  const isSuperadmin = profile.role === 'superadmin';

  const tabs = [
    { id: 'societe' as const, label: 'Société', icon: Building2 },
    { id: 'tva' as const, label: 'TVA & Facturation', icon: Receipt },
    ...((isAdmin || isSuperadmin) ? [{ id: 'documents' as const, label: 'Modèles documents', icon: FileText }] : []),
    ...(isSuperadmin ? [{ id: 'modules' as const, label: 'Modules', icon: ShoppingCart }] : []),
    { id: 'utilisateurs' as const, label: 'Mon profil', icon: Users },
  ];

  return (
    <div className="p-4 lg:p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Paramètres</h2>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${tab === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'societe' && (
        <form onSubmit={saveCompany} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 max-w-2xl">
          <h3 className="text-base font-semibold text-slate-900">Informations de la société</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la société *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required disabled={!isAdmin}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} disabled={!isAdmin}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={!isAdmin}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
              <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} disabled={!isAdmin}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">N° Fiscal / NINEA</label>
              <input type="text" value={form.tax_number} onChange={e => set('tax_number', e.target.value)} disabled={!isAdmin}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Devise</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={form.currency} onChange={e => set('currency', e.target.value)} placeholder="XOF" disabled={!isAdmin}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
                <input type="text" value={form.currency_symbol} onChange={e => set('currency_symbol', e.target.value)} placeholder="F CFA" disabled={!isAdmin}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Logo de la société</label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Image className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  {isAdmin && (
                    <>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload}
                        className="hidden" id="logo-upload" />
                      <label htmlFor="logo-upload"
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors cursor-pointer w-fit
                          ${logoUploading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
                        <Upload className="w-4 h-4" />
                        {logoUploading ? 'Envoi en cours...' : 'Choisir un fichier'}
                      </label>
                      {logoPreview && (
                        <button type="button" onClick={removeLogo}
                          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors">
                          <X className="w-3.5 h-3.5" /> Supprimer le logo
                        </button>
                      )}
                      <p className="text-xs text-slate-400">PNG, JPG, SVG — max 2 Mo</p>
                    </>
                  )}
                  {!isAdmin && !logoPreview && (
                    <p className="text-sm text-slate-400">Aucun logo configuré</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {isAdmin && (
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
              <Save className="w-4 h-4" />{saved ? 'Enregistré !' : loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          )}
        </form>
      )}

      {tab === 'tva' && (
        <form onSubmit={saveCompany} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 max-w-md">
          <h3 className="text-base font-semibold text-slate-900">Configuration TVA</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-12 h-6 rounded-full transition-colors ${form.tva_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={() => isAdmin && set('tva_enabled', !form.tva_enabled)}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.tva_enabled ? 'left-7' : 'left-1'}`} />
              </div>
              <span className="text-sm font-medium text-slate-700">
                TVA {form.tva_enabled ? 'activée' : 'désactivée'}
              </span>
            </label>
          </div>
          {form.tva_enabled && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Taux TVA (%)</label>
              <input type="number" value={form.tva_rate} onChange={e => set('tva_rate', Number(e.target.value))}
                min="0" max="100" step="0.5" disabled={!isAdmin}
                className="w-32 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
            </div>
          )}
          {isAdmin && (
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
              <Save className="w-4 h-4" />{saved ? 'Enregistré !' : 'Enregistrer'}
            </button>
          )}
        </form>
      )}

      {tab === 'documents' && (isAdmin || isSuperadmin) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Modèles de documents</h3>
          <TemplateSelector company={company} onSave={saveTemplates} saving={templateSaving} />
        </div>
      )}

      {tab === 'modules' && isSuperadmin && (
        <form onSubmit={saveCompany} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 max-w-md">
          <h3 className="text-base font-semibold text-slate-900">Modules optionnels</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 border border-gray-100 rounded-xl">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">Point de Vente (POS)</div>
                    <div className="text-xs text-slate-500 mt-0.5">Caisse enregistreuse, ventes directes, historique des ventes, encaissement des factures et gestion de session de caisse</div>
                  </div>
                  <div className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-4 cursor-pointer ${form.pos_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                    onClick={() => set('pos_enabled', !form.pos_enabled)}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.pos_enabled ? 'left-7' : 'left-1'}`} />
                  </div>
                </div>
                <div className={`mt-2 text-xs font-semibold ${form.pos_enabled ? 'text-blue-600' : 'text-slate-400'}`}>
                  {form.pos_enabled ? 'Activé' : 'Désactivé'}
                </div>
              </div>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
            <Save className="w-4 h-4" />{saved ? 'Enregistré !' : 'Enregistrer'}
          </button>
        </form>
      )}

      {tab === 'utilisateurs' && (
        <ProfileEditor profile={profile} />
      )}
    </div>
  );
}

function ProfileEditor({ profile }: { profile: Profile }) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id);
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 max-w-md">
      <h3 className="text-base font-semibold text-slate-900">Mon profil</h3>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Rôle</label>
        <div className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-slate-600 capitalize">{profile.role}</div>
      </div>
      <button type="submit" disabled={loading}
        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-60">
        <Save className="w-4 h-4" />{saved ? 'Enregistré !' : loading ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  );
}
