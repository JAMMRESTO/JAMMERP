import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Store, DollarSign, Palette, Puzzle, Receipt, Save, Check, Users, Phone, MapPin, FileText, Building2, LayoutDashboard, Upload, X, ShoppingCart, Copy, Lock, Eye, EyeOff, Shield, type LucideIcon
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../components/ui/Toast';
import { UserManagement } from '../components/auth/UserManagement';
import { SiteManagersPanel } from '../components/auth/SiteManagersPanel';
import { useTenant } from '../context/TenantContext';
import { supabase } from '../lib/supabase';

type TabId = 'general' | 'financial' | 'appearance' | 'modules' | 'users' | 'managers';

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'general',   label: 'Général',        icon: Store },
  { id: 'financial', label: 'Finances',        icon: DollarSign },
  { id: 'appearance',label: 'Apparence',       icon: Palette },
  { id: 'modules',   label: 'Modules',         icon: Puzzle },
  { id: 'users',     label: 'Utilisateurs',    icon: Users },
  { id: 'managers',  label: 'Gestionnaires',   icon: Building2 },
];

const currencies = [
  { code: 'XOF', symbol: 'FCFA', label: 'Franc CFA (BCEAO)' },
  { code: 'XAF', symbol: 'FCFA', label: 'Franc CFA (BEAC)' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'USD', symbol: '$', label: 'Dollar américain' },
  { code: 'MAD', symbol: 'DH', label: 'Dirham marocain' },
  { code: 'TND', symbol: 'DT', label: 'Dinar tunisien' },
];

const timezones = [
  'Africa/Dakar', 'Africa/Abidjan', 'Africa/Douala', 'Africa/Lagos',
  'Africa/Casablanca', 'Africa/Tunis', 'Europe/Paris', 'America/New_York',
];

const themes: { name: string; primary: string; accent: string }[] = [
  { name: 'Océan',      primary: '#3B82F6', accent: '#06B6D4' },
  { name: 'Forêt',      primary: '#10B981', accent: '#84CC16' },
  { name: 'Feu',        primary: '#EF4444', accent: '#F97316' },
  { name: 'Or',         primary: '#F59E0B', accent: '#FBBF24' },
  { name: 'Rose',       primary: '#EC4899', accent: '#F43F5E' },
  { name: 'Ardoise',    primary: '#64748B', accent: '#94A3B8' },
  { name: 'Ciel',       primary: '#0EA5E9', accent: '#38BDF8' },
  { name: 'Saphir',     primary: '#1D4ED8', accent: '#3B82F6' },
  { name: 'Jade',       primary: '#059669', accent: '#10B981' },
  { name: 'Rouille',    primary: '#B45309', accent: '#D97706' },
  { name: 'Framboise',  primary: '#BE123C', accent: '#E11D48' },
  { name: 'Nuit',       primary: '#334155', accent: '#64748B' },
];

const moduleLabels: Record<string, { label: string; desc: string }> = {
  pos: { label: 'Point de vente', desc: 'Caisse et traitement des commandes' },
  delivery: { label: 'Livraisons', desc: 'Gestion des commandes à livrer' },
  kitchen: { label: 'Cuisine', desc: 'Affichage des commandes en cuisine' },
  inventory: { label: 'Inventaire', desc: 'Gestion du stock et des produits' },
  reports: { label: 'Rapports', desc: 'Statistiques et analyses de ventes' },
  reservations: { label: 'Commandes en ligne', desc: 'Gestion des commandes passées en ligne' },
  production: { label: 'Production', desc: 'Gestion des recettes et productions' },
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? '' : 'bg-white/10'}`}
      style={checked ? { backgroundColor: 'var(--color-primary)' } : undefined}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', damping: 20, stiffness: 400 }}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
      />
    </button>
  );
}

function InputField({ label, value, onChange, type = 'text', hint }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-white/60 text-sm font-medium block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
      />
      {hint && <p className="text-white/25 text-xs mt-1">{hint}</p>}
    </div>
  );
}

function slugify(str: string): string {
  return (str ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function CashierAccessCard({ siteSlug, siteId }: { siteSlug: string; siteId: string }) {
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const cashierEmail = `caisse@${slugify(siteSlug)}.app`;

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { toast('error', 'Mot de passe trop court (min. 6 caractères)'); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ update_cashier_password: true, cashier_password: newPassword, site_id: siteId, tenant_id: '' }),
    });
    const result = await res.json();
    setSaving(false);
    if (!result.success) { toast('error', result.error ?? 'Erreur'); return; }
    toast('success', 'Mot de passe caissier mis à jour');
    setSavedPassword(newPassword);
    setNewPassword('');
    setShowSaved(true);
  }

  return (
    <div className="glass-card rounded-2xl p-6 border border-amber-500/15 space-y-4">
      <h3 className="text-white font-semibold text-base flex items-center gap-2">
        <ShoppingCart size={16} className="text-amber-400/70" /> Accès caissier
      </h3>
      <p className="text-white/40 text-xs leading-relaxed">
        Partagez ces identifiants avec vos caissiers. Ils saisissent le code du site sur l'écran de connexion.
      </p>

      {/* Identifiants */}
      <div className="grid grid-cols-1 gap-2.5">
        {[
          { label: 'Code du site', value: siteSlug },
          { label: 'Email de connexion', value: cashierEmail },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-white/40 text-[10px] font-medium mb-0.5">{label}</p>
              <p className="text-white text-xs font-mono truncate">{value}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(value); toast('success', 'Copié !'); }}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/60 transition-all flex-shrink-0"
            >
              <Copy size={12} />
            </button>
          </div>
        ))}

        {/* Mot de passe actuel (affiché après save) */}
        {savedPassword && (
          <div className="flex items-center justify-between gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-amber-400/60 text-[10px] font-medium mb-0.5">Mot de passe actuel</p>
              <p className={`text-amber-300 text-xs font-mono ${showSaved ? '' : 'tracking-[0.3em]'}`}>
                {showSaved ? savedPassword : '••••••••'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowSaved(v => !v)}
                className="w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center text-amber-400/50 hover:text-amber-400 transition-all"
              >
                {showSaved ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(savedPassword); toast('success', 'Copié !'); }}
                className="w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center text-amber-400/50 hover:text-amber-400 transition-all"
              >
                <Copy size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Changer le mot de passe partagé */}
      <div className="pt-2 border-t border-white/8">
        <p className="text-white/50 text-xs font-medium mb-3 flex items-center gap-1.5">
          <Lock size={11} /> Modifier le mot de passe partagé
        </p>
        <form onSubmit={handlePasswordChange} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min. 6 car.)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-all pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
            >
              {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <button
            type="submit"
            disabled={saving || newPassword.length < 6}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold transition-all flex-shrink-0"
          >
            {saving
              ? <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <Save size={13} />
            }
            {saving ? '' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
}

function OwnerPinCard() {
  const { ownerPin, setOwnerPin } = useTenant();
  const toast = useToast();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPin.length < 4) { toast('error', 'Le PIN doit contenir au moins 4 chiffres'); return; }
    if (newPin !== confirmPin) { toast('error', 'Les codes PIN ne correspondent pas'); return; }
    setSaving(true);
    const result = await setOwnerPin(newPin);
    setSaving(false);
    if (result.error) { toast('error', result.error); return; }
    toast('success', 'Code PIN mis a jour');
    setNewPin('');
    setConfirmPin('');
  }

  return (
    <div className="glass-card rounded-2xl p-6 border border-blue-500/15 space-y-4">
      <h3 className="text-white font-semibold text-base flex items-center gap-2">
        <Shield size={16} className="text-blue-400/70" /> Code PIN administrateur
      </h3>
      <p className="text-white/40 text-xs">
        Ce code permet de valider les annulations de tickets depuis la caisse sans saisir de mot de passe.
        {ownerPin ? ' Votre PIN est actuellement configure.' : ' Aucun PIN configure.'}
      </p>
      <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-3">
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={newPin}
          onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
          placeholder="Nouveau PIN (4 chiffres)"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
        />
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={confirmPin}
          onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          placeholder="Confirmer PIN"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
        />
        <button
          type="submit"
          disabled={saving || newPin.length < 4}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-all flex-shrink-0"
        >
          {saving ? '...' : (ownerPin ? 'Modifier' : 'Definir')}
        </button>
      </form>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSetting } = useSettings();
  const { isSiteManager, sites, currentSite } = useTenant();
  // Site managers see users + general (for cashier password change)
  const visibleTabs = isSiteManager
    ? tabs.filter(t => t.id === 'users')
    : sites.length > 1
      ? tabs
      : tabs.filter(t => t.id !== 'managers');
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const isUsersTab = activeTab === 'users';
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    restaurant_name: settings.restaurant_name,
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    siret: settings.siret ?? '',
    vat_number: settings.vat_number ?? '',
    legal_form: settings.legal_form ?? '',
    capital: settings.capital ?? '',
    currency: settings.currency,
    currency_symbol: settings.currency_symbol,
    tax_rate: settings.tax_rate,
    timezone: settings.timezone,
    primary_color: settings.primary_color,
    accent_color: settings.accent_color,
    receipt_footer: settings.receipt_footer,
    auto_print_receipt: settings.auto_print_receipt ?? false,
    active_modules: { ...settings.active_modules },
    dashboard_widgets: { ...settings.dashboard_widgets },
  });

  useEffect(() => {
    setForm({
      restaurant_name: settings.restaurant_name,
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      siret: settings.siret ?? '',
      vat_number: settings.vat_number ?? '',
      legal_form: settings.legal_form ?? '',
      capital: settings.capital ?? '',
      currency: settings.currency,
      currency_symbol: settings.currency_symbol,
      tax_rate: settings.tax_rate,
      timezone: settings.timezone,
      primary_color: settings.primary_color,
      accent_color: settings.accent_color,
      receipt_footer: settings.receipt_footer,
      auto_print_receipt: settings.auto_print_receipt ?? false,
      active_modules: { ...settings.active_modules },
      dashboard_widgets: { ...settings.dashboard_widgets },
    });
  }, [settings]);

  async function handleSave() {
    await Promise.all([
      updateSetting('restaurant_name', form.restaurant_name),
      updateSetting('address', form.address),
      updateSetting('phone', form.phone),
      updateSetting('siret', form.siret),
      updateSetting('vat_number', form.vat_number),
      updateSetting('legal_form', form.legal_form),
      updateSetting('capital', form.capital),
      updateSetting('currency', form.currency),
      updateSetting('currency_symbol', form.currency_symbol),
      updateSetting('tax_rate', form.tax_rate),
      updateSetting('timezone', form.timezone),
      updateSetting('primary_color', form.primary_color),
      updateSetting('accent_color', form.accent_color),
      updateSetting('receipt_footer', form.receipt_footer),
      updateSetting('auto_print_receipt', form.auto_print_receipt),
      updateSetting('active_modules', form.active_modules),
      updateSetting('dashboard_widgets', form.dashboard_widgets),
    ]);
    setSaved(true);
    toast('success', 'Paramètres sauvegardés');
    setTimeout(() => setSaved(false), 2500);
  }

  function setCurrency(code: string) {
    const found = currencies.find(c => c.code === code);
    setForm(f => ({ ...f, currency: code, currency_symbol: found?.symbol ?? code }));
  }

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      toast('error', 'Fichier invalide — image uniquement');
      return;
    }
    setLogoUploading(true);
    const ext = file.name.split('.').pop();
    const path = `logo/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast('error', 'Erreur lors de l\'upload');
      setLogoUploading(false);
      return;
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    await updateSetting('logo_url', data.publicUrl);
    toast('success', 'Logo mis à jour');
    setLogoUploading(false);
  }

  async function handleLogoRemove() {
    await updateSetting('logo_url', null);
    toast('success', 'Logo supprimé');
  }

  const isFullHeightTab = activeTab === 'users';

  return (
    <div className={`${isFullHeightTab ? 'h-full flex flex-col overflow-hidden' : 'p-4 lg:p-6 max-w-4xl'}`}>
      {/* Tabs */}
      <div className={`flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/8 overflow-x-auto ${isFullHeightTab ? 'flex-shrink-0 mx-4 mt-4 mb-0' : 'mb-6'}`}>
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center
                ${active ? 'text-white shadow-lg' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              style={active ? {
                backgroundColor: 'var(--color-primary)',
                boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 25%, transparent)',
              } : undefined}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && (
        <div className="flex-1 overflow-hidden mt-4">
          <UserManagement />
        </div>
      )}

      {activeTab === 'managers' && (
        <div className="mt-4 px-0">
          <SiteManagersPanel />
        </div>
      )}

      {!isFullHeightTab && activeTab !== 'managers' && <><motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4 mt-6"
      >
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Site managers only see cashier access card */}
            {isSiteManager ? (
              currentSite && <CashierAccessCard siteSlug={currentSite.slug} siteId={currentSite.id} />
            ) : (
            <>
            {/* Identité */}
            <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-5">
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <Store size={16} className="text-blue-400" /> Identité
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Nom de l'établissement"
                  value={form.restaurant_name}
                  onChange={v => setForm(f => ({ ...f, restaurant_name: v }))}
                />
                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5">Fuseau horaire</label>
                  <select
                    value={form.timezone}
                    onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                  >
                    {timezones.map(tz => (
                      <option key={tz} value={tz} className="bg-gray-900">{tz}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Coordonnées */}
            <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-5">
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <MapPin size={16} className="text-emerald-400" /> Coordonnées
              </h3>
              <div>
                <label className="text-white/60 text-sm font-medium block mb-1.5">Adresse complète</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  rows={2}
                  placeholder="Rue, Quartier, Ville, Pays..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm resize-none placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/60 text-sm font-medium block mb-1.5 flex items-center gap-1.5">
                    <Phone size={12} /> Téléphone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+221 XX XXX XX XX"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Informations légales */}
            <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-5">
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <Building2 size={16} className="text-amber-400" /> Informations légales
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Forme juridique"
                  value={form.legal_form}
                  onChange={v => setForm(f => ({ ...f, legal_form: v }))}
                  hint="Ex: SARL, SAS, EI..."
                />
                <InputField
                  label="Capital social"
                  value={form.capital}
                  onChange={v => setForm(f => ({ ...f, capital: v }))}
                  hint="Ex: 1 000 000 FCFA"
                />
                <InputField
                  label="SIRET / RCCM / Registre"
                  value={form.siret}
                  onChange={v => setForm(f => ({ ...f, siret: v }))}
                  hint="Numéro d'immatriculation"
                />
                <InputField
                  label="Numéro TVA / NIF"
                  value={form.vat_number}
                  onChange={v => setForm(f => ({ ...f, vat_number: v }))}
                  hint="Identifiant fiscal"
                />
              </div>
            </div>

            {/* Ticket */}
            <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-5">
              <h3 className="text-white font-semibold text-base flex items-center gap-2">
                <FileText size={16} className="text-white/50" /> Ticket de caisse
              </h3>
              <div>
                <label className="text-white/60 text-sm font-medium block mb-1.5">Pied de page ticket</label>
                <textarea
                  value={form.receipt_footer}
                  onChange={e => setForm(f => ({ ...f, receipt_footer: e.target.value }))}
                  rows={2}
                  placeholder="Message affiché en bas du ticket..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm resize-none placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              <div
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${form.auto_print_receipt ? '' : 'border-white/8 bg-white/3'}`}
                style={form.auto_print_receipt ? {
                  borderColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">Impression automatique</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    Imprime le ticket dès la confirmation du paiement, sans afficher l'aperçu.
                  </p>
                </div>
                <Toggle
                  checked={form.auto_print_receipt}
                  onChange={v => setForm(f => ({ ...f, auto_print_receipt: v }))}
                />
              </div>
            </div>

            {/* Cashier credentials */}
            {currentSite && (
              <CashierAccessCard siteSlug={currentSite.slug} siteId={currentSite.id} />
            )}

            {/* Owner PIN */}
            <OwnerPinCard />
            </>
            )}
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-5">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-400" /> Configuration financière
            </h3>
            <div>
              <label className="text-white/60 text-sm font-medium block mb-1.5">Devise</label>
              <select
                value={form.currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all"
              >
                {currencies.map(c => (
                  <option key={c.code} value={c.code} className="bg-gray-900">
                    {c.label} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Symbole de devise"
                value={form.currency_symbol}
                onChange={v => setForm(f => ({ ...f, currency_symbol: v }))}
                hint="Ex: FCFA, €, $"
              />
              <InputField
                label="Taux de TVA (%)"
                value={form.tax_rate}
                onChange={v => setForm(f => ({ ...f, tax_rate: parseFloat(v) || 0 }))}
                type="number"
                hint="Pourcentage appliqué"
              />
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={15} className="text-blue-400" />
                <span className="text-white/70 text-sm font-medium">Aperçu ticket</span>
              </div>
              <p className="text-white/40 text-xs">
                Montant HT: 10 000 {form.currency_symbol} &bull; TVA ({form.tax_rate}%): {(10000 * form.tax_rate / 100).toFixed(0)} {form.currency_symbol} &bull; TTC: {(10000 * (1 + form.tax_rate / 100)).toFixed(0)} {form.currency_symbol}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-4">
          <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-5">
            <h3 className="text-white font-semibold text-base flex items-center gap-2">
              <Store size={16} className="text-orange-400" /> Logo de l'entreprise
            </h3>
            <div className="flex items-center gap-5">
              {/* Preview */}
              <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Store size={28} className="text-white/20" />
                )}
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-white/50 text-xs">Format recommandé : PNG ou SVG, fond transparent, min 200×200 px</p>
                <div className="flex gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/70 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {logoUploading ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    {logoUploading ? 'Upload...' : 'Choisir un logo'}
                  </button>
                  {settings.logo_url && (
                    <button
                      onClick={handleLogoRemove}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-all"
                    >
                      <X size={14} /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-5">
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              <Palette size={18} className="text-orange-400" /> Thème de couleurs
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {themes.map(theme => {
                const active = form.primary_color === theme.primary && form.accent_color === theme.accent;
                return (
                  <button
                    key={theme.name}
                    onClick={() => setForm(f => ({ ...f, primary_color: theme.primary, accent_color: theme.accent }))}
                    className={`relative flex flex-col items-center gap-2.5 p-3 rounded-2xl border transition-all group
                      ${active
                        ? 'border-white/30 bg-white/8 shadow-lg'
                        : 'border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15'}`}
                  >
                    {/* Swatch */}
                    <div className="flex gap-1.5">
                      <div className="w-7 h-7 rounded-lg shadow-md" style={{ backgroundColor: theme.primary }} />
                      <div className="w-7 h-7 rounded-lg shadow-md" style={{ backgroundColor: theme.accent }} />
                    </div>
                    <span className="text-white/60 text-xs font-medium group-hover:text-white/80 transition-colors">
                      {theme.name}
                    </span>
                    {active && (
                      <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                        <Check size={9} className="text-gray-900" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Live preview */}
            <div className="p-4 rounded-xl border border-white/8 bg-white/3 space-y-3">
              <p className="text-white/40 text-xs uppercase tracking-wider font-medium">Aperçu</p>
              <div className="flex gap-3 flex-wrap">
                <div className="px-4 py-2 rounded-xl text-white text-sm font-medium shadow-lg" style={{ backgroundColor: form.primary_color }}>
                  Bouton principal
                </div>
                <div className="px-4 py-2 rounded-xl text-gray-900 text-sm font-medium shadow-lg" style={{ backgroundColor: form.accent_color }}>
                  Accent
                </div>
                <div className="px-4 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: form.primary_color, color: form.primary_color }}>
                  Contour
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.primary_color }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.accent_color }} />
                <span className="text-white/30 text-xs font-mono">{form.primary_color} · {form.accent_color}</span>
              </div>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'modules' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-4">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <Puzzle size={18} className="text-amber-400" /> Modules actifs
              </h3>
              <p className="text-white/30 text-sm">Activez ou désactivez les modules selon vos besoins.</p>
              <div className="space-y-3">
                {Object.entries(moduleLabels).map(([key, { label, desc }]) => {
                  const modKey = key as keyof typeof form.active_modules;
                  const enabled = form.active_modules[modKey];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${enabled ? '' : 'border-white/8 bg-white/3'}`}
                      style={enabled ? {
                        borderColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                      } : undefined}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{label}</p>
                        <p className="text-white/30 text-xs mt-0.5">{desc}</p>
                      </div>
                      <Toggle
                        checked={enabled}
                        onChange={v => setForm(f => ({
                          ...f,
                          active_modules: { ...f.active_modules, [modKey]: v }
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/8 space-y-4">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <LayoutDashboard size={18} className="text-blue-400" /> Widgets du tableau de bord
              </h3>
              <p className="text-white/30 text-sm">Choisissez les widgets affichés sur le tableau de bord.</p>
              <div className="space-y-3">
                {([
                  { key: 'live_orders' as const, label: 'Commandes en cours', desc: 'Affiche les commandes actives en temps réel' },
                  { key: 'alerts' as const, label: 'Alertes & notifications', desc: 'Affiche les alertes de stock et notifications' },
                ] as const).map(({ key, label, desc }) => {
                  const enabled = form.dashboard_widgets[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${enabled ? '' : 'border-white/8 bg-white/3'}`}
                      style={enabled ? {
                        borderColor: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
                        backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, transparent)',
                      } : undefined}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{label}</p>
                        <p className="text-white/30 text-xs mt-0.5">{desc}</p>
                      </div>
                      <Toggle
                        checked={enabled}
                        onChange={v => setForm(f => ({
                          ...f,
                          dashboard_widgets: { ...f.dashboard_widgets, [key]: v }
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Save button */}
      <div className="mt-6">
        <motion.button
          onClick={handleSave}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg text-white
            ${saved ? 'bg-emerald-600 shadow-emerald-600/25' : ''}`}
          style={!saved ? { backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 25%, transparent)' } : undefined}
        >
          {saved ? <Check size={16} /> : <Save size={16} />}
          <span className="text-white">{saved ? 'Sauvegardé!' : 'Sauvegarder'}</span>
        </motion.button>
      </div>
      </>}
    </div>
  );
}
