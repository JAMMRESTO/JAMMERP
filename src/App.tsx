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
import { SetPinModal } from './components/pos/SetPinModal';
import { AdminResetPage } from './pages/AdminResetPage';
import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePWA } from './lib/usePWA';
import { useSettings } from './context/SettingsContext';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';

function isSubscriptionExpired(tenant: { subscription_expires_at: string | null }): boolean {
  if (!tenant.subscription_expires_at) return false;
  return new Date(tenant.subscription_expires_at) < new Date();
}

function AppContent() {
  const {
    authUser, isAuthLoading, isSuperAdmin, isSiteManager, tenant,
    currentSite, isLoadingTenant, isOnboardingDone, ownerPin,
  } = useTenant();
  const { currentUser, isLoading: isAuthPINLoading } = useAuth();
  const { settings } = useSettings();
  const [pinDismissed, setPinDismissed] = useState(false);

  const resolvedName = settings.restaurant_name && settings.restaurant_name !== 'Mon Restaurant'
    ? settings.restaurant_name
    : tenant?.name || null;

  const { showBanner, promptInstall, dismiss } = usePWA({
    tenantName: resolvedName,
    logoUrl: settings.logo_url,
  });

  const installBanner = showBanner ? (
    <PWAInstallBanner
      tenantName={resolvedName || 'SENRESTO'}
      logoUrl={settings.logo_url}
      onInstall={promptInstall}
      onDismiss={dismiss}
    />
  ) : null;

  // 1. Supabase Auth loading
  if (isAuthLoading) return <>{installBanner}<LoadingScreen /></>;

  // 2. Not logged in → login/signup screen
  if (!authUser) return <>{installBanner}<TenantLoginScreen /></>;

  // 3. Tenant data loading
  if (isLoadingTenant) return <>{installBanner}<LoadingScreen /></>;

  // 4. Super admin → bypass tenant flow
  if (isSuperAdmin) return <>{installBanner}<SuperAdminLayout /></>;

  // 5. Tenant exists but not yet active (pending/approved/rejected/suspended)
  if (tenant && tenant.status !== 'active') return <>{installBanner}<TenantPendingScreen /></>;

  // 5b. Tenant active but subscription expired → blocked
  if (tenant && isSubscriptionExpired(tenant)) return <>{installBanner}<TenantExpiredScreen /></>;

  // 6. Active tenant but no site → site picker
  if (!tenant || !currentSite) return <>{installBanner}<SitePicker /></>;

  // 7. Site exists but onboarding not done → onboarding wizard
  if (!isOnboardingDone) return <>{installBanner}<TenantOnboardingScreen /></>;

  // 8. Tenant owner (not a site manager) → bypass PIN screen, enter app directly
  //    But first, prompt them to set a PIN if they haven't yet
  if (!isSiteManager) {
    return (
      <>
        {installBanner}
        {!ownerPin && !pinDismissed && <SetPinModal onDone={() => setPinDismissed(true)} />}
        <MainLayout />
      </>
    );
  }

  // 9. Site manager: PIN auth loading
  if (isAuthPINLoading) return <>{installBanner}<LoadingScreen /></>;

  // 10. Site manager: no staff PIN logged in → PIN login screen
  if (!currentUser) return <>{installBanner}<LoginScreen /></>;

  // 11. Everything ready → main app
  //     Prompt site manager to set their admin PIN if missing
  return (
    <>
      {installBanner}
      {!ownerPin && !pinDismissed && <SetPinModal onDone={() => setPinDismissed(true)} />}
      <MainLayout />
    </>
  );
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
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (hash === '#admin-reset') {
    return <AdminResetPage />;
  }

  return (
    <ToastProvider>
      <TenantProvider>
        <ProvidersTree />
      </TenantProvider>
    </ToastProvider>
  );
}
