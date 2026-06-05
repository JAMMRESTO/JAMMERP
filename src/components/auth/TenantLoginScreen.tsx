import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Eye, EyeOff, Building2, ArrowRight, ArrowLeft,
  Loader2, Check, CreditCard, UtensilsCrossed, Truck, FlaskConical,
  BarChart3, BookOpen, LayoutDashboard, Zap, Shield, Clock,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';

type Mode = 'signin' | 'signup';
type SignUpStep = 'plan' | 'form';

interface PlanDef {
  id: string;
  name: string;
  tagline: string;
  color: string;
  modules: string[];
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Essentiel pour demarrer',
    color: '#06B6D4',
    modules: ['pos', 'reports'],
    features: [
      'Point de vente complet',
      'Rapports de vente',
      'Gestion des produits',
      '1 site inclus',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Restaurants en croissance',
    color: '#F59E0B',
    modules: ['pos', 'delivery', 'kitchen', 'inventory', 'reports'],
    features: [
      'Tout du Starter',
      'Cuisine en temps reel',
      'Livraisons & inventaire',
      'Jusqu\'a 3 sites',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Solution complete',
    color: '#10B981',
    modules: ['pos', 'delivery', 'kitchen', 'inventory', 'reports', 'reservations', 'production'],
    features: [
      'Tout du Pro',
      'Production & recettes',
      'Reservations',
      'Sites illimites',
    ],
  },
];

const MODULE_ICONS: Record<string, React.ReactNode> = {
  pos: <CreditCard size={10} />,
  kitchen: <UtensilsCrossed size={10} />,
  delivery: <Truck size={10} />,
  inventory: <FlaskConical size={10} />,
  reports: <BarChart3 size={10} />,
  reservations: <BookOpen size={10} />,
  production: <LayoutDashboard size={10} />,
};

const MODULE_LABELS: Record<string, string> = {
  pos: 'Caisse', kitchen: 'Cuisine', delivery: 'Livraison',
  inventory: 'Inventaire', reports: 'Rapports', reservations: 'Reservations', production: 'Production',
};

export function TenantLoginScreen() {
  const { signIn, signUp } = useTenant();
  const [mode, setMode] = useState<Mode>('signin');
  const [signUpStep, setSignUpStep] = useState<SignUpStep>('plan');
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email.trim() || !password.trim()) { setError('Veuillez remplir tous les champs'); return; }
    if (mode === 'signup' && !tenantName.trim()) { setError('Veuillez entrer le nom de votre etablissement'); return; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caracteres'); return; }

    setIsLoading(true);
    if (mode === 'signin') {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    } else {
      const { error: err } = await signUp(email, password, tenantName, selectedPlan);
      if (err) setError(err);
      else setSuccessMsg('Compte cree ! Votre essai gratuit de 5 jours commence maintenant.');
    }
    setIsLoading(false);
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setSignUpStep('plan');
    setError('');
    setSuccessMsg('');
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-950">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.03]" style={{ backgroundColor: '#3B82F6' }} />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full blur-[100px] opacity-[0.03]" style={{ backgroundColor: '#10B981' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* Left branding panel - desktop only */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-col p-8 xl:p-10 relative border-r border-white/[0.04] flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-emerald-950/10" />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <img src="/Logo_restaurant.png" alt="JAMM ERP" className="h-32 xl:h-40 w-auto self-start mb-4" />

          {/* Text right after logo */}
          <h2 className="text-white text-2xl xl:text-3xl font-black leading-tight mb-2">
            La solution POS{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
              nouvelle generation
            </span>
          </h2>
          <p className="text-white/35 text-xs xl:text-sm leading-relaxed mb-6 max-w-xs">
            Gerez votre restaurant avec une plateforme complete : caisse, cuisine, livraisons, inventaire.
          </p>

          {/* Features */}
          <div className="space-y-3 mt-auto">
            {[
              { icon: Zap, title: 'Demarrage instantane', desc: 'Pret en moins de 5 minutes' },
              { icon: Shield, title: 'Essai gratuit 5 jours', desc: 'Sans carte bancaire' },
              { icon: Clock, title: 'Multi-sites', desc: 'Tous vos etablissements' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-blue-400/80" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-semibold">{title}</p>
                  <p className="text-white/30 text-[10px]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-4 self-start w-full flex-shrink-0">
          <img src="/Logo_restaurant.png" alt="JAMM ERP" className="h-8 w-auto" />
        </div>

        <div className="relative z-10 w-full max-w-md flex-shrink-0">
          {/* Mode tabs — only signin / signup */}
          <div className="flex bg-white/[0.03] rounded-xl p-0.5 mb-5 border border-white/[0.06]">
            {(['signin', 'signup'] as ('signin' | 'signup')[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
                  mode === m
                    ? 'bg-white/[0.08] text-white shadow-sm'
                    : 'text-white/35 hover:text-white/55'
                }`}
              >
                {m === 'signin' ? 'Connexion' : 'Creer un compte'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === 'signin' ? (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.15 }}
              >
                <SignInForm
                  email={email}
                  password={password}
                  showPass={showPass}
                  isLoading={isLoading}
                  error={error}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onTogglePass={() => setShowPass(v => !v)}
                  onSubmit={handleSubmit}
                />
              </motion.div>
            ) : signUpStep === 'plan' ? (
              <motion.div
                key="plan-selection"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
              >
                <PlanSelection
                  selectedPlan={selectedPlan}
                  onSelect={setSelectedPlan}
                  onNext={() => setSignUpStep('form')}
                />
              </motion.div>
            ) : (
              <motion.div
                key="signup-form"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
              >
                <SignUpForm
                  selectedPlan={selectedPlan}
                  tenantName={tenantName}
                  email={email}
                  password={password}
                  showPass={showPass}
                  isLoading={isLoading}
                  error={error}
                  successMsg={successMsg}
                  onTenantNameChange={setTenantName}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onTogglePass={() => setShowPass(v => !v)}
                  onSubmit={handleSubmit}
                  onBack={() => setSignUpStep('plan')}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── Sign In Form ────────────────────────────────────────────

function SignInForm({
  email, password, showPass, isLoading, error,
  onEmailChange, onPasswordChange, onTogglePass, onSubmit,
}: {
  email: string;
  password: string;
  showPass: boolean;
  isLoading: boolean;
  error: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onTogglePass: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-white text-xl sm:text-2xl font-black mb-1">Bon retour !</h1>
        <p className="text-white/35 text-xs sm:text-sm">Connectez-vous pour acceder a vos etablissements</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <InputField
          label="Email"
          icon={<Mail size={14} />}
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="admin@monrestaurant.com"
          autoComplete="email"
        />
        <InputField
          label="Mot de passe"
          icon={<Lock size={14} />}
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={onPasswordChange}
          placeholder="••••••••"
          autoComplete="current-password"
          rightAction={
            <button type="button" onClick={onTogglePass} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          }
        />
        <ErrorMessage error={error} />
        <SubmitButton isLoading={isLoading} label="Se connecter" />
      </form>
    </div>
  );
}

// ─── Plan Selection ──────────────────────────────────────────

function PlanSelection({
  selectedPlan,
  onSelect,
  onNext,
}: {
  selectedPlan: string;
  onSelect: (plan: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-white text-xl sm:text-2xl font-black mb-1">Choisissez votre plan</h1>
        <p className="text-white/35 text-xs sm:text-sm">
          Essai gratuit 5 jours, sans carte bancaire.
        </p>
      </div>

      <div className="space-y-2 mb-4">
        {PLANS.map(plan => {
          const isSelected = selectedPlan === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? ''
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]'
              }`}
              style={isSelected ? {
                borderColor: `${plan.color}50`,
                backgroundColor: `${plan.color}08`,
              } : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${plan.color}15`, border: `1px solid ${plan.color}30` }}
                  >
                    <span className="text-xs font-black" style={{ color: plan.color }}>
                      {plan.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-xs sm:text-sm">{plan.name}</p>
                    <p className="text-white/30 text-[10px]">{plan.tagline}</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? 'border-transparent' : 'border-white/15'
                }`} style={isSelected ? { backgroundColor: plan.color } : undefined}>
                  {isSelected && <Check size={9} className="text-white" />}
                </div>
              </div>

              {/* Modules row */}
              <div className="flex flex-wrap gap-1 mb-2">
                {plan.modules.map(mod => (
                  <span key={mod} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 border border-white/[0.05]">
                    {MODULE_ICONS[mod]} {MODULE_LABELS[mod]}
                  </span>
                ))}
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-1">
                    <Check size={8} style={{ color: isSelected ? plan.color : 'rgba(255,255,255,0.2)' }} />
                    <span className="text-white/45 text-[9px] sm:text-[10px]">{f}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Trial badge */}
      <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 mb-4">
        <div className="w-7 h-7 rounded-md bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <Clock size={12} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-emerald-300 text-[10px] sm:text-xs font-semibold">5 jours d'essai gratuit</p>
          <p className="text-emerald-400/50 text-[9px] sm:text-[10px]">Aucune carte bancaire requise</p>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20"
      >
        Continuer avec {PLANS.find(p => p.id === selectedPlan)?.name} <ArrowRight size={14} />
      </motion.button>
    </div>
  );
}

// ─── Sign Up Form ────────────────────────────────────────────

function SignUpForm({
  selectedPlan, tenantName, email, password, showPass, isLoading, error, successMsg,
  onTenantNameChange, onEmailChange, onPasswordChange, onTogglePass, onSubmit, onBack,
}: {
  selectedPlan: string;
  tenantName: string;
  email: string;
  password: string;
  showPass: boolean;
  isLoading: boolean;
  error: string;
  successMsg: string;
  onTenantNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onTogglePass: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const plan = PLANS.find(p => p.id === selectedPlan)!;

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-white/30 hover:text-white/60 text-[10px] sm:text-xs font-medium mb-3 transition-colors"
        >
          <ArrowLeft size={11} /> Changer de plan
        </button>
        <h1 className="text-white text-xl sm:text-2xl font-black mb-1">Creez votre espace</h1>
        <p className="text-white/35 text-xs sm:text-sm">
          Essai gratuit 5 jours - Plan {plan.name}
        </p>
      </div>

      {/* Plan badge */}
      <div
        className="flex items-center gap-2.5 p-2.5 rounded-lg border mb-4"
        style={{ borderColor: `${plan.color}30`, backgroundColor: `${plan.color}06` }}
      >
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${plan.color}20` }}>
          <span className="text-[10px] font-black" style={{ color: plan.color }}>{plan.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-xs font-semibold">Plan {plan.name}</p>
          <p className="text-white/30 text-[9px]">{plan.modules.length} modules - Essai 5 jours</p>
        </div>
        <Check size={12} style={{ color: plan.color }} />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <InputField
          label="Nom de l'etablissement"
          icon={<Building2 size={14} />}
          type="text"
          value={tenantName}
          onChange={onTenantNameChange}
          placeholder="Ex: Restaurant Le Baobab"
        />
        <InputField
          label="Email du responsable"
          icon={<Mail size={14} />}
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="admin@monrestaurant.com"
          autoComplete="email"
        />
        <InputField
          label="Mot de passe"
          icon={<Lock size={14} />}
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={onPasswordChange}
          placeholder="Min. 6 caracteres"
          autoComplete="new-password"
          rightAction={
            <button type="button" onClick={onTogglePass} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          }
        />

        <ErrorMessage error={error} />

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-medium"
          >
            {successMsg}
          </motion.div>
        )}

        <SubmitButton isLoading={isLoading} label="Demarrer mon essai gratuit" />
      </form>
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────

function InputField({
  label, icon, type, value, onChange, placeholder, autoComplete, rightAction,
}: {
  label: string;
  icon: React.ReactNode;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-white/40 text-[10px] sm:text-xs font-medium mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-9 py-2.5 text-white text-xs sm:text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06] transition-all"
        />
        {rightAction}
      </div>
    </div>
  );
}

function ErrorMessage({ error }: { error: string }) {
  if (!error) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] sm:text-xs font-medium"
    >
      {error}
    </motion.div>
  );
}

function SubmitButton({ isLoading, label }: { isLoading: boolean; label: string }) {
  return (
    <motion.button
      type="submit"
      whileTap={{ scale: 0.98 }}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition-all disabled:opacity-60 shadow-lg shadow-blue-600/20"
    >
      {isLoading ? (
        <Loader2 size={15} className="animate-spin" />
      ) : (
        <>{label} <ArrowRight size={14} /></>
      )}
    </motion.button>
  );
}
