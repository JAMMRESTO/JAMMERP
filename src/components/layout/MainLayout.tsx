import { useState, useEffect, lazy, Suspense } from 'react';
import { Sidebar, MobileSidebar, isPageAllowed, navConfig } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { ComingSoon } from '../ui/ComingSoon';
import { Loader2 } from 'lucide-react';

const Dashboard = lazy(() => import('../../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const SettingsPage = lazy(() => import('../../pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const POSPage = lazy(() => import('../../pages/POSPage').then(m => ({ default: m.POSPage })));
const InventoryPage = lazy(() => import('../../pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const ProductsPage = lazy(() => import('../../pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CategoriesPage = lazy(() => import('../../pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const TablesPage = lazy(() => import('../../pages/TablesPage').then(m => ({ default: m.TablesPage })));
const KitchenPage = lazy(() => import('../../pages/KitchenPage').then(m => ({ default: m.KitchenPage })));
const DeliveryPage = lazy(() => import('../../pages/DeliveryPage').then(m => ({ default: m.DeliveryPage })));
const ProductionPage = lazy(() => import('../../pages/ProductionPage').then(m => ({ default: m.ProductionPage })));
const ReportsPage = lazy(() => import('../../pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const OnlineOrdersPage = lazy(() => import('../../pages/OnlineOrdersPage').then(m => ({ default: m.OnlineOrdersPage })));
const CashSessionsPage = lazy(() => import('../../pages/CashSessionsPage').then(m => ({ default: m.CashSessionsPage })));
const PurchasingPage = lazy(() => import('../../pages/PurchasingPage').then(m => ({ default: m.PurchasingPage })));
const ExpensesPage = lazy(() => import('../../pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-white/30" />
    </div>
  );
}

export function MainLayout() {
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const { isSiteManager } = useTenant();
  const isTenantOwner = !isSiteManager;
  const roleName = currentUser?.role?.name;
  const activeModules = settings.active_modules;
  const [activePage, setActivePage] = useState(() => {
    const roleName = currentUser?.role?.name;
    return (!isSiteManager || roleName === 'admin') ? 'dashboard' : 'pos';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const item = navConfig.find(n => n.id === activePage);
    if (item && !isPageAllowed(item, roleName, activeModules, isTenantOwner)) {
      setActivePage(isTenantOwner ? 'dashboard' : 'pos');
    }
  }, [roleName, activeModules, activePage, isTenantOwner]);

  function handleNavigate(page: string) {
    const item = navConfig.find(n => n.id === page);
    if (!item || !isPageAllowed(item, roleName, activeModules, isTenantOwner)) return;
    setActivePage(page);
  }

  const isPOS = activePage === 'pos';
  const isFullHeight = ['products', 'categories', 'inventory', 'tables', 'kitchen', 'delivery', 'production', 'purchasing', 'reports', 'online_orders', 'cash_sessions', 'expenses'].includes(activePage);

  function renderPage() {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'settings': return <SettingsPage />;
      case 'pos': return <POSPage />;
      case 'products': return <ProductsPage />;
      case 'categories': return <CategoriesPage />;
      case 'inventory': return <InventoryPage />;
      case 'tables': return <TablesPage />;
      case 'kitchen': return <KitchenPage />;
      case 'delivery': return <DeliveryPage />;
      case 'production': return <ProductionPage />;
      case 'purchasing': return <PurchasingPage />;
      case 'expenses':   return <ExpensesPage />;
      case 'reports':       return <ReportsPage />;
      case 'online_orders': return <OnlineOrdersPage />;
      case 'cash_sessions': return <CashSessionsPage />;
      default: return <ComingSoon page={activePage} />;
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <div className="hidden lg:flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      </div>

      <div className="hidden md:flex lg:hidden">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} collapsed />
      </div>

      <MobileSidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isPOS && <Header activePage={activePage} onMenuToggle={() => setMobileMenuOpen(true)} />}
        <main className={`flex-1 ${isPOS || isFullHeight ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <ErrorBoundary key={activePage} onReset={() => setActivePage('dashboard')}>
            <Suspense fallback={<PageLoader />}>
              {renderPage()}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
