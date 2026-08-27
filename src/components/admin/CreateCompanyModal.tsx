import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  duration_days: number;
  price: number;
  features: string[];
}

interface NewCompanyForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  currency_symbol: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
  plan: string;
  customDays: number;
}

const EMPTY_FORM: NewCompanyForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  currency: 'XOF',
  currency_symbol: 'F CFA',
  adminEmail: '',
  adminPassword: '',
  adminFullName: '',
  plan: 'trial',
  customDays: 30,
};

interface Props {
  plans: SubscriptionPlan[];
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateCompanyModal({ plans, onClose, onCreated }: Props) {
  const [form, setForm] = useState<NewCompanyForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.name || !form.adminEmail || !form.adminPassword || !form.adminFullName) {
      setError('Remplissez tous les champs obligatoires (*)');
      return;
    }
    if (form.adminPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }
    setCreating(true);

    const selectedPlan = plans.find(p => p.slug === form.plan);
    const days = form.plan === 'custom' ? form.customDays : (selectedPlan?.duration_days ?? 14);
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError('Session expiree. Veuillez vous reconnecter.');
      setCreating(false);
      return;
    }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-company`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          currency: form.currency,
          currency_symbol: form.currency_symbol,
          subscription_plan: form.plan,
          subscription_end_date: endDate,
          admin_email: form.adminEmail,
          admin_password: form.adminPassword,
          admin_full_name: form.adminFullName,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Erreur lors de la creation de la societe');
      setCreating(false);
      return;
    }

    setSuccess(`Societe "${form.name}" creee avec succes !`);
    setForm(EMPTY_FORM);
    setCreating(false);
    onCreated();
    setTimeout(() => { onClose(); }, 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-slate-900">Creer une nouvelle societe</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="p-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl">{error}</div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm p-3 rounded-xl font-semibold">{success}</div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Informations societe</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la societe *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: ACME Senegal" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email societe</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="contact@acme.sn" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telephone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="+221 77 xxx xx xx" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Devise</label>
                  <select value={form.currency} onChange={e => {
                    const map: Record<string, string> = { XOF: 'F CFA', EUR: '€', USD: '$', MAD: 'DH', GNF: 'GF' };
                    setForm(f => ({ ...f, currency: e.target.value, currency_symbol: map[e.target.value] || e.target.value }));
                  }} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="XOF">XOF -- F CFA</option>
                    <option value="EUR">EUR -- EUR</option>
                    <option value="USD">USD -- $</option>
                    <option value="MAD">MAD -- DH</option>
                    <option value="GNF">GNF -- GF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Symbole</label>
                  <input value={form.currency_symbol} onChange={e => setForm(f => ({ ...f, currency_symbol: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Compte administrateur</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet *</label>
                <input value={form.adminFullName} onChange={e => setForm(f => ({ ...f, adminFullName: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Prenom Nom" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email de connexion *</label>
                <input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin@acme.sn" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 6 caracteres" />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Abonnement</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {plans.map(plan => (
                <button key={plan.slug} type="button" onClick={() => setForm(f => ({ ...f, plan: plan.slug }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${form.plan === plan.slug ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`text-xs font-bold ${form.plan === plan.slug ? 'text-blue-700' : 'text-slate-700'}`}>{plan.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{plan.duration_days} jours</div>
                </button>
              ))}
              <button type="button" onClick={() => setForm(f => ({ ...f, plan: 'custom' }))}
                className={`p-3 rounded-xl border-2 text-left transition-all ${form.plan === 'custom' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`text-xs font-bold ${form.plan === 'custom' ? 'text-blue-700' : 'text-slate-700'}`}>Personnalise</div>
                <div className="text-xs text-slate-500 mt-0.5">Duree libre</div>
              </button>
            </div>
            {form.plan === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de jours</label>
                <input type="number" min="1" value={form.customDays} onChange={e => setForm(f => ({ ...f, customDays: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={creating}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors">
              {creating ? 'Creation...' : 'Creer la societe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
