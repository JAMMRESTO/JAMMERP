import { useState, useEffect } from 'react';
import { Shield, Plus, Building2, KeyRound, Database, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company } from '../../types';
import CompanyCard from './CompanyCard';
import CreateCompanyModal from './CreateCompanyModal';
import UserManagementPanel from './UserManagementPanel';
import RolesManagement from './RolesManagement';
import BackupRestorePage from './BackupRestorePage';
import ResetDataPage from './ResetDataPage';

interface Props {
  currentCompanyId: string;
  onSwitchCompany: (companyId: string) => void;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  duration_days: number;
  price: number;
  features: string[];
}

interface UserCountMap {
  [companyId: string]: number;
}

type AdminTab = 'societes' | 'roles' | 'backup' | 'reset';

export default function AdminPage({ currentCompanyId, onSwitchCompany }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [managingCompany, setManagingCompany] = useState<Company | null>(null);
  const [userCounts, setUserCounts] = useState<UserCountMap>({});
  const [activeTab, setActiveTab] = useState<AdminTab>('societes');

  useEffect(() => {
    load();
    supabase.from('subscription_plans').select('*').eq('is_active', true).order('duration_days')
      .then(({ data }) => setPlans(data || []));
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    setCompanies(data || []);
    setLoading(false);
    loadUserCounts();
  }

  async function loadUserCounts() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users?action=list`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const counts: UserCountMap = {};
      for (const u of data.users || []) {
        counts[u.company_id] = (counts[u.company_id] || 0) + 1;
      }
      setUserCounts(counts);
    }
  }

  async function toggleActive(company: Company) {
    await supabase.from('companies').update({ is_active: !company.is_active }).eq('id', company.id);
    load();
  }

  async function updatePlan(companyId: string, planSlug: string, customDays?: number) {
    const days = customDays ?? plans.find(p => p.slug === planSlug)?.duration_days ?? 30;
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('companies').update({
      subscription_plan: planSlug,
      subscription_status: 'active',
      subscription_end_date: endDate,
    }).eq('id', companyId);
    load();
  }

  const activeCount = companies.filter(c => c.is_active).length;
  const expiredCount = companies.filter(c => {
    const endDate = c.subscription_end_date;
    if (!endDate) return false;
    return new Date(endDate).getTime() - Date.now() <= 0;
  }).length;

  if (managingCompany) {
    return (
      <div className="p-4 lg:p-6">
        <UserManagementPanel
          company={managingCompany}
          onBack={() => { setManagingCompany(null); load(); }}
        />
      </div>
    );
  }

  const TABS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'societes', label: 'Societes', icon: Building2 },
    { id: 'roles', label: 'Roles & Permissions', icon: KeyRound },
    { id: 'backup', label: 'Sauvegarde', icon: Database },
    { id: 'reset', label: 'Reinitialisation', icon: Trash2 },
  ];

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Admin SaaS</h2>
            <p className="text-sm text-slate-500">{companies.length} societe(s) enregistree(s)</p>
          </div>
        </div>
        {activeTab === 'societes' && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-500 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle societe
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === id
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {activeTab === 'societes' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <div className="text-2xl font-bold text-slate-900">{companies.length}</div>
              <div className="text-xs text-slate-500">Total</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
              <div className="text-xs text-slate-500">Actives</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{expiredCount}</div>
              <div className="text-xs text-slate-500">Expirees</div>
            </div>
          </div>

          {showCreateForm && (
            <CreateCompanyModal
              plans={plans}
              onClose={() => setShowCreateForm(false)}
              onCreated={load}
            />
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid gap-3">
              {companies.map(c => (
                <CompanyCard
                  key={c.id}
                  company={c}
                  plans={plans}
                  isCurrent={c.id === currentCompanyId}
                  onToggleActive={toggleActive}
                  onUpdatePlan={updatePlan}
                  onManageUsers={(id) => {
                    const comp = companies.find(x => x.id === id);
                    if (comp) setManagingCompany(comp);
                  }}
                  onSwitchTo={onSwitchCompany}
                  userCount={userCounts[c.id] || 0}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'roles' && (
        <RolesManagement companies={companies} />
      )}

      {activeTab === 'backup' && (
        <BackupRestorePage companies={companies} />
      )}

      {activeTab === 'reset' && (
        <ResetDataPage companies={companies} />
      )}
    </div>
  );
}
