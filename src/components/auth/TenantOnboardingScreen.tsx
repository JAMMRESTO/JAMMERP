import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChefHat, Building2, Users, Rocket, Check, ArrowRight, ArrowLeft,
  Loader2, Plus, Trash2, Eye, EyeOff, Phone, MapPin,
  ShieldCheck, CreditCard, UtensilsCrossed, Truck, FlaskConical,
  BarChart3, BookOpen, LayoutDashboard, LogOut, Mail, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../ui/Toast';

// ─── Types ──────────────────────────────────────────────────

interface NewUser {
  id: string;
  name: string;
  email: string;
  password: string;
  pin: string;
  role: 'admin' | 'cashier';
  showPin: boolean;
  showPassword: boolean;
}

interface WizardData {
  restaurantName: string;
  address: string;
  phone: string;
  modules: Record<string, boolean>;
}

// ─── Email utils ─────────────────────────────────────────────

function slugify(str: string): string {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function generateEmail(name: string, siteSlug: string): string {
  const part = slugify(name) || 'user';
  const domain = slugify(siteSlug) || 'site';
  return `${part}@${domain}.app`;
}

// ─── Plan features map ───────────────────────────────────────

const PLAN_MODULES: Record<string, string[]> = {
  starter: ['pos', 'reports'],
  pro: ['pos', 'delivery', 'kitchen', 'inventory', 'reports'],
  enterprise: ['pos', 'delivery', 'kitchen', 'inventory', 'reports', 'reservations', 'production'],
};

interface ModuleDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  desc: string;
}

const ALL_MODULES: ModuleDef[] = [
  { key: 'pos',          label: 'Caisse (POS)',     icon: <CreditCard size={16} />,      desc: 'Encaissement, tickets, paiements' },
  { key: 'kitchen',      label: 'Cuisine',          icon: <UtensilsCrossed size={16} />, desc: 'Affichage commandes en cuisine' },
  { key: 'delivery',     label: 'Livraisons',       icon: <Truck size={16} />,           desc: 'Gestion des livreurs et courses' },
  { key: 'inventory',    label: 'Inventaire',       icon: <FlaskConical size={16} />,    desc: 'Stock, produits, mouvements' },
  { key: 'reports',      label: 'Rapports',         icon: <BarChart3 size={16} />,       desc: 'Chiffre d\'affaires, statistiques' },
  { key: 'reservations', label: 'Réservations',     icon: <BookOpen size={16} />,        desc: 'Tables et réservations clients' },
  { key: 'production',   label: 'Production',       icon: <LayoutDashboard size={16} />, desc: 'Recettes, fabrication, entrepôts' },
];

// ─── Step indicator ──────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
            i < current
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
              : i === current
              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
              : 'bg-white/5 border border-white/10 text-white/25'
          }`}>
            {i < current ? <Check size={12} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-px w-8 transition-all duration-500 ${i < current ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Restaurant info ─────────────────────────────────

function StepRestaurant({
  data,
  onChange,
  onNext,
}: {
  data: WizardData;
  onChange: (d: Partial<WizardData>) => void;
  onNext: () => void;
}) {
  const { tenant } = useTenant();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-xl font-black mb-1">Votre restaurant</h2>
        <p className="text-white/35 text-sm">Configurez les informations de base de votre établissement</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Nom de l'établissement</label>
          <div className="relative">
            <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={data.restaurantName}
              onChange={e => onChange({ restaurantName: e.target.value })}
              placeholder={tenant?.name ?? 'Nom du restaurant'}
              className="w-full bg-white/6 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Adresse <span className="text-white/20 normal-case font-normal">(optionnel)</span></label>
          <div className="relative">
            <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={data.address}
              onChange={e => onChange({ address: e.target.value })}
              placeholder="123 Avenue de la République, Dakar"
              className="w-full bg-white/6 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Téléphone <span className="text-white/20 normal-case font-normal">(optionnel)</span></label>
          <div className="relative">
            <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="tel"
              value={data.phone}
              onChange={e => onChange({ phone: e.target.value })}
              placeholder="+221 77 000 00 00"
              className="w-full bg-white/6 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onNext}
        disabled={!data.restaurantName.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
      >
        Continuer <ArrowRight size={15} />
      </motion.button>
    </div>
  );
}

// ─── Step 2: Plan & Modules ──────────────────────────────────

function StepModules({
  data,
  plan,
  onChange,
  onNext,
  onBack,
}: {
  data: WizardData;
  plan: string;
  onChange: (d: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const availableKeys = PLAN_MODULES[plan] ?? PLAN_MODULES.starter;
  const planColors: Record<string, string> = {
    starter: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    pro: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    enterprise: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  function toggle(key: string) {
    if (!availableKeys.includes(key)) return;
    onChange({ modules: { ...data.modules, [key]: !data.modules[key] } });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-xl font-black mb-1">Modules disponibles</h2>
        <p className="text-white/35 text-sm">Activez les fonctionnalités incluses dans votre plan</p>
      </div>

      <div className={`flex items-center gap-3 p-3 rounded-xl border ${planColors[plan] ?? planColors.starter}`}>
        <ShieldCheck size={16} />
        <div>
          <p className="text-xs font-bold capitalize">Plan {plan}</p>
          <p className="text-[10px] opacity-70">{availableKeys.length} module{availableKeys.length > 1 ? 's' : ''} inclus</p>
        </div>
      </div>

      <div className="space-y-2">
        {ALL_MODULES.map(mod => {
          const available = availableKeys.includes(mod.key);
          const enabled = data.modules[mod.key] ?? false;
          return (
            <button
              key={mod.key}
              onClick={() => toggle(mod.key)}
              disabled={!available}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                !available
                  ? 'opacity-30 cursor-not-allowed border-white/6 bg-white/2'
                  : enabled
                  ? 'border-blue-500/30 bg-blue-500/8 hover:bg-blue-500/12'
                  : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                enabled && available ? 'bg-blue-500/20 text-blue-400' : 'bg-white/8 text-white/30'
              }`}>
                {mod.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${enabled && available ? 'text-white' : 'text-white/50'}`}>{mod.label}</p>
                <p className="text-white/25 text-[10px]">{mod.desc}</p>
              </div>
              {!available && <span className="text-[9px] text-white/20 font-medium uppercase tracking-wider">Plan supérieur</span>}
              {available && (
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  enabled ? 'bg-blue-500 text-white' : 'border border-white/15'
                }`}>
                  {enabled && <Check size={10} />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-sm font-medium transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20"
        >
          Continuer <ArrowRight size={15} />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Step 3: Users ───────────────────────────────────────────

function StepUsers({
  users,
  siteSlug,
  onUsersChange,
  onNext,
  onBack,
}: {
  users: NewUser[];
  siteSlug: string;
  onUsersChange: (users: NewUser[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  function addUser() {
    onUsersChange([...users, {
      id: crypto.randomUUID(),
      name: '',
      email: '',
      password: '',
      pin: '',
      role: 'cashier',
      showPin: false,
      showPassword: false,
    }]);
  }

  function update(id: string, field: keyof NewUser, value: string | boolean) {
    onUsersChange(users.map(u => {
      if (u.id !== id) return u;
      const updated = { ...u, [field]: value };
      // Auto-generate email for admin when name changes
      if (field === 'name' && u.role === 'admin' && siteSlug) {
        updated.email = generateEmail(value as string, siteSlug);
      }
      return updated;
    }));
  }

  function remove(id: string) {
    onUsersChange(users.filter(u => u.id !== id));
  }

  const canProceed = users.every(u => {
    if (!u.name.trim() || u.pin.length !== 4) return false;
    if (u.role === 'admin') return u.email.trim() !== '' && u.password.length >= 6;
    return true; // cashier: name + pin only
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-xl font-black mb-1">Votre équipe</h2>
        <p className="text-white/35 text-sm">Ajoutez les membres du personnel avec leur code d'accès</p>
      </div>

      <div className="space-y-3">
        {users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-white/10 bg-white/2">
            <Users size={24} className="text-white/15 mb-2" />
            <p className="text-white/30 text-xs">Aucun utilisateur ajouté</p>
            <p className="text-white/15 text-[10px] mt-0.5">Vous pourrez en ajouter plus tard dans les paramètres</p>
          </div>
        )}

        <AnimatePresence>
          {users.map(user => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-xs font-semibold uppercase tracking-wider">Utilisateur</span>
                  <button onClick={() => remove(user.id)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/15 text-white/30 hover:text-red-400 flex items-center justify-center transition-all">
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Nom + Rôle */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-white/40 text-[10px] font-medium mb-1">Nom</label>
                    <input
                      type="text"
                      value={user.name}
                      onChange={e => update(user.id, 'name', e.target.value)}
                      placeholder="Prénom Nom"
                      className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-white/40 text-[10px] font-medium mb-1">Rôle</label>
                    <select
                      value={user.role}
                      onChange={e => update(user.id, 'role', e.target.value)}
                      className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/40 transition-all"
                    >
                      <option value="admin" className="bg-gray-800">Admin</option>
                      <option value="cashier" className="bg-gray-800">Caissier</option>
                    </select>
                  </div>
                </div>

                {/* Admin: email + mot de passe */}
                {user.role === 'admin' && (
                  <>
                    <div>
                      <label className="block text-white/40 text-[10px] font-medium mb-1 flex items-center gap-1">
                        <Mail size={9} /> Email de connexion
                      </label>
                      <input
                        type="email"
                        value={user.email}
                        onChange={e => update(user.id, 'email', e.target.value)}
                        placeholder={`prenom@${slugify(siteSlug) || 'site'}.app`}
                        className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-white/40 text-[10px] font-medium mb-1 flex items-center gap-1">
                        <Lock size={9} /> Mot de passe
                      </label>
                      <div className="relative">
                        <input
                          type={user.showPassword ? 'text' : 'password'}
                          value={user.password}
                          onChange={e => update(user.id, 'password', e.target.value)}
                          placeholder="Min. 6 caractères"
                          className={`w-full bg-white/6 border rounded-xl px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none transition-all pr-8 ${
                            user.password && user.password.length < 6 ? 'border-amber-500/40' : user.password.length >= 6 ? 'border-emerald-500/30' : 'border-white/10 focus:border-blue-500/40'
                          }`}
                        />
                        <button type="button" onClick={() => update(user.id, 'showPassword', !user.showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                          {user.showPassword ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Caissier: info email partagé */}
                {user.role === 'cashier' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
                    <Mail size={10} className="text-amber-400/70 flex-shrink-0" />
                    <p className="text-amber-400/70 text-[10px]">
                      Email partagé : <span className="font-mono">caisse@{slugify(siteSlug) || 'site'}.app</span>
                    </p>
                  </div>
                )}

                {/* PIN */}
                <div>
                  <label className="block text-white/40 text-[10px] font-medium mb-1">Code PIN caisse (4 chiffres)</label>
                  <div className="relative">
                    <input
                      type={user.showPin ? 'text' : 'password'}
                      value={user.pin}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        update(user.id, 'pin', v);
                      }}
                      placeholder="••••"
                      maxLength={4}
                      className={`w-full bg-white/6 border rounded-xl px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none transition-all font-mono tracking-widest pr-8 ${
                        user.pin && user.pin.length < 4 ? 'border-amber-500/40' : user.pin.length === 4 ? 'border-emerald-500/30' : 'border-white/10 focus:border-blue-500/40'
                      }`}
                    />
                    <button type="button" onClick={() => update(user.id, 'showPin', !user.showPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors">
                      {user.showPin ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          onClick={addUser}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/15 text-white/40 hover:text-white/70 hover:border-white/25 hover:bg-white/4 transition-all text-xs font-medium"
        >
          <Plus size={14} /> Ajouter un utilisateur
        </button>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-sm font-medium transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onNext}
          disabled={users.length > 0 && !canProceed}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-40 shadow-lg shadow-blue-600/20"
        >
          Continuer <ArrowRight size={15} />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Step 4: Confirm & Launch ────────────────────────────────

function StepConfirm({
  data,
  users,
  plan,
  onLaunch,
  onBack,
  launching,
}: {
  data: WizardData;
  users: NewUser[];
  plan: string;
  onLaunch: () => void;
  onBack: () => void;
  launching: boolean;
}) {
  const enabledModules = ALL_MODULES.filter(m => data.modules[m.key]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-xl font-black mb-1">Tout est prêt !</h2>
        <p className="text-white/35 text-sm">Vérifiez votre configuration avant de lancer</p>
      </div>

      <div className="space-y-3">
        {/* Restaurant */}
        <div className="p-4 rounded-2xl border border-white/8 bg-white/3 space-y-2">
          <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"><Building2 size={10} /> Restaurant</p>
          <p className="text-white font-bold">{data.restaurantName}</p>
          {data.address && <p className="text-white/40 text-xs flex items-center gap-1"><MapPin size={10} />{data.address}</p>}
          {data.phone && <p className="text-white/40 text-xs flex items-center gap-1"><Phone size={10} />{data.phone}</p>}
        </div>

        {/* Plan + modules */}
        <div className="p-4 rounded-2xl border border-white/8 bg-white/3 space-y-2">
          <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"><ShieldCheck size={10} /> Plan & Modules</p>
          <p className="text-white font-bold capitalize">Plan {plan}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {enabledModules.map(m => (
              <span key={m.key} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-blue-500/12 text-blue-300 border border-blue-500/20">
                {m.label}
              </span>
            ))}
            {enabledModules.length === 0 && <span className="text-white/25 text-xs">Aucun module actif</span>}
          </div>
        </div>

        {/* Users */}
        <div className="p-4 rounded-2xl border border-white/8 bg-white/3 space-y-2">
          <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"><Users size={10} /> Équipe</p>
          {users.length === 0 ? (
            <p className="text-white/30 text-xs">Aucun utilisateur — à configurer dans les paramètres</p>
          ) : (
            <div className="space-y-1.5">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between">
                  <span className="text-white text-xs font-medium">{u.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-red-500/12 text-red-400' : 'bg-orange-500/12 text-orange-400'}`}>
                    {u.role === 'admin' ? 'Admin' : 'Caissier'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} disabled={launching} className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-sm font-medium transition-all">
          <ArrowLeft size={14} /> Retour
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onLaunch}
          disabled={launching}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all disabled:opacity-60 shadow-lg shadow-emerald-600/20"
        >
          {launching ? (
            <><Loader2 size={15} className="animate-spin" /> Configuration en cours...</>
          ) : (
            <><Rocket size={15} /> Lancer mon restaurant</>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ─── Main wizard ─────────────────────────────────────────────

export function TenantOnboardingScreen() {
  const { tenant, sites, selectSite, signOut, refreshOnboardingStatus, reloadTenant } = useTenant();
  const toast = useToast();

  const plan = tenant?.plan ?? 'starter';
  const availableKeys = PLAN_MODULES[plan] ?? PLAN_MODULES.starter;

  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);

  const defaultModules = Object.fromEntries(ALL_MODULES.map(m => [m.key, availableKeys.includes(m.key)]));

  const [wizardData, setWizardData] = useState<WizardData>({
    restaurantName: tenant?.name ?? '',
    address: '',
    phone: '',
    modules: defaultModules,
  });
  const [users, setUsers] = useState<NewUser[]>([]);

  function patchData(patch: Partial<WizardData>) {
    setWizardData(prev => ({ ...prev, ...patch }));
  }

  const STEPS = ['Restaurant', 'Modules', 'Équipe', 'Lancer'];

  async function handleLaunch() {
    setLaunching(true);
    try {
      // Use the first existing site (created at approval time) or create one
      let site = sites[0] ?? null;

      if (!site) {
        const slug = wizardData.restaurantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'principal';
        const { data: newSite, error: siteErr } = await supabase
          .from('sites')
          .insert({
            tenant_id: tenant!.id,
            name: wizardData.restaurantName,
            slug,
            address: wizardData.address || null,
            phone: wizardData.phone || null,
          })
          .select()
          .single();
        if (siteErr) throw new Error(siteErr.message);
        site = newSite;
      } else {
        // Update existing site
        await supabase.from('sites').update({
          name: wizardData.restaurantName,
          address: wizardData.address || null,
          phone: wizardData.phone || null,
          updated_at: new Date().toISOString(),
        }).eq('id', site.id);
        site = { ...site, name: wizardData.restaurantName };
      }

      // Save settings
      const settingsToSave = [
        { site_id: site.id, key: 'restaurant_name', value: wizardData.restaurantName },
        { site_id: site.id, key: 'address', value: wizardData.address },
        { site_id: site.id, key: 'phone', value: wizardData.phone },
        { site_id: site.id, key: 'active_modules', value: wizardData.modules },
      ];
      await supabase.from('settings').upsert(settingsToSave, { onConflict: 'site_id,key' });

      // Resolve global roles
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, name')
        .is('tenant_id', null);
      const roleMap: Record<string, string> = {};
      for (const r of rolesData ?? []) roleMap[r.name] = r.id;

      // Create staff users via edge function (creates auth.users + public.users)
      if (users.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-staff-user`;

        for (const u of users) {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              role: u.role,
              email: u.role === 'admin' ? u.email.trim() : undefined,
              password: u.role === 'admin' ? u.password : undefined,
              name: u.name.trim(),
              pin: u.pin,
              role_id: roleMap[u.role] ?? null,
              site_id: site!.id,
              tenant_id: tenant!.id,
            }),
          });
          const result = await res.json();
          if (!result.success) throw new Error(result.error ?? `Erreur création utilisateur ${u.name}`);
        }
      }

      // Activate tenant as fully active
      await supabase.from('tenants').update({
        status: 'active',
        is_active: true,
        updated_at: new Date().toISOString(),
      }).eq('id', tenant!.id);

      toast('success', 'Configuration terminée ! Bienvenue.');
      await reloadTenant();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la configuration';
      toast('error', msg);
      setLaunching(false);
    }
  }

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050810 0%, #0a0f1e 50%, #060b14 100%)' }}
    >
      {/* Glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-5" style={{ backgroundColor: '#3B82F6' }} />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-4" style={{ backgroundColor: '#10B981' }} />
      </div>

      {/* Left panel — desktop */}
      <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col justify-between p-10 relative z-10 border-r border-white/5 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
              <ChefHat size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black text-base leading-tight">RestoBar POS</p>
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest">Configuration</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-white text-3xl font-black leading-tight mb-2">
              Configurez<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">votre espace</span>
            </h1>
            <p className="text-white/35 text-sm leading-relaxed">
              Quelques étapes pour préparer votre restaurant et démarrer.
            </p>
          </div>

          {/* Step nav */}
          <div className="space-y-2">
            {STEPS.map((label, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                i === step ? 'bg-white/6 border border-white/10' : ''
              }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  i < step ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : i === step ? 'bg-blue-500 text-white'
                  : 'bg-white/5 border border-white/10 text-white/25'
                }`}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${i === step ? 'text-white' : i < step ? 'text-emerald-400' : 'text-white/25'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {tenant && (
          <div className="p-3 rounded-xl bg-white/3 border border-white/8">
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-1">Compte</p>
            <p className="text-white text-sm font-bold">{tenant.name}</p>
            <p className="text-white/30 text-xs capitalize">Plan {tenant.plan}</p>
          </div>
        )}
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-start p-6 sm:p-10 overflow-y-auto relative z-10">
        {/* Mobile header */}
        <div className="w-full max-w-lg mb-6 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
                <ChefHat size={15} className="text-white" />
              </div>
              <span className="text-white font-black text-sm">RestoBar POS</span>
            </div>
            <button onClick={signOut} className="flex items-center gap-1.5 text-white/30 hover:text-red-400 text-xs transition-colors">
              <LogOut size={13} /> Quitter
            </button>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <StepIndicator current={step} total={STEPS.length} />
            <span className="text-white/30 text-xs">{STEPS[step]}</span>
          </div>
        </div>

        {/* Desktop sign out */}
        <div className="hidden lg:flex w-full max-w-lg justify-end mb-4">
          <button onClick={signOut} className="flex items-center gap-1.5 text-white/25 hover:text-red-400 text-xs transition-colors">
            <LogOut size={12} /> Se déconnecter
          </button>
        </div>

        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <StepRestaurant
                  data={wizardData}
                  onChange={patchData}
                  onNext={() => setStep(1)}
                />
              )}
              {step === 1 && (
                <StepModules
                  data={wizardData}
                  plan={plan}
                  onChange={patchData}
                  onNext={() => setStep(2)}
                  onBack={() => setStep(0)}
                />
              )}
              {step === 2 && (
                <StepUsers
                  users={users}
                  siteSlug={(sites[0]?.slug ?? slugify(wizardData.restaurantName)) || 'site'}
                  onUsersChange={setUsers}
                  onNext={() => setStep(3)}
                  onBack={() => setStep(1)}
                />
              )}
              {step === 3 && (
                <StepConfirm
                  data={wizardData}
                  users={users}
                  plan={plan}
                  onLaunch={handleLaunch}
                  onBack={() => setStep(2)}
                  launching={launching}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
