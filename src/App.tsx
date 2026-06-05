import { ToastProvider } from './components/ui/Toast';
import { TenantProvider, useTenant } from './context/TenantContext';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantLoginScreen } from './components/auth/TenantLoginScreen';
import { TenantPendingScreen } from './components/auth/TenantPendingScreen';
import { TenantExpiredScreen } from './components/auth/TenantExpiredScreen';
import { TenantOnboardingScreen } from './components/auth/TenantOnboardingScreen';
import { SitePicker } from './components/auth/SitePicker';
import { LoginScreen } from './components/auth/LoginScreen';
import { MainLayout } from './components/layout/MainLayout';
import { SuperAdminLayout } from './pages/superadmin/SuperAdminLayout';
import { Loader2 } from 'lucide-react';

function isSubscriptionExpired(tenant: { subscription_expires_at: string | null }): boolean {
  if (!tenant.subscription_expires_at) return false;
  return new Date(tenant.subscription_expires_at) < new Date();
}

function AppContent() {
  const {
    authUser, isAuthLoading, isSuperAdmin, isSiteManager, tenant,
    currentSite, isLoadingTenant, isOnboardingDone,
  } = useTenant();
  const { currentUser, isLoading: isAuthPINLoading } = useAuth();

  // 1. Supabase Auth loading
  if (isAuthLoading) return <LoadingScreen />;

  // 2. Not logged in → login/signup screen
  if (!authUser) return <TenantLoginScreen />;

  // 3. Tenant data loading
  if (isLoadingTenant) return <LoadingScreen />;

  // 4. Super admin → bypass tenant flow
  if (isSuperAdmin) return <SuperAdminLayout />;

  // 5. Tenant exists but not yet active (pending/approved/rejected/suspended)
  if (tenant && tenant.status !== 'active') return <TenantPendingScreen />;

  // 5b. Tenant active but subscription expired → blocked
  if (tenant && isSubscriptionExpired(tenant)) return <TenantExpiredScreen />;

  // 6. Active tenant but no site → site picker
  if (!tenant || !currentSite) return <SitePicker />;

  // 7. Site exists but onboarding not done → onboarding wizard
  if (!isOnboardingDone) return <TenantOnboardingScreen />;

  // 8. Tenant owner (not a site manager) → bypass PIN screen, enter app directly
  if (!isSiteManager) return <MainLayout />;

  // 9. Site manager: PIN auth loading
  if (isAuthPINLoading) return <LoadingScreen />;

  // 10. Site manager: no staff PIN logged in → PIN login screen
  if (!currentUser) return <LoginScreen />;

  // 11. Everything ready → main app
  return <MainLayout />;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary, #3B82F6)' }} />
        <p className="text-white/30 text-sm">Chargement...</p>
      </div>
    </div>
  );
}

function ProvidersTree() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <TenantProvider>
        <ProvidersTree />
      </TenantProvider>
    </ToastProvider>
  );
}
