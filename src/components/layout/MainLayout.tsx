import { useState, useEffect } from 'react';
import { Sidebar, MobileSidebar, isPageAllowed, navConfig } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Dashboard } from '../../pages/Dashboard';
import { SettingsPage } from '../../pages/SettingsPage';
import { POSPage } from '../../pages/POSPage';
import { InventoryPage } from '../../pages/InventoryPage';
import { ProductsPage } from '../../pages/ProductsPage';
import { CategoriesPage } from '../../pages/CategoriesPage';
import { TablesPage } from '../../pages/TablesPage';
import { KitchenPage } from '../../pages/KitchenPage';
import { DeliveryPage } from '../../pages/DeliveryPage';
import { ProductionPage } from '../../pages/ProductionPage';
import { ReportsPage } from '../../pages/ReportsPage';
import { OnlineOrdersPage } from '../../pages/OnlineOrdersPage';
import { CashSessionsPage } from '../../pages/CashSessionsPage';
import { PurchasingPage } from '../../pages/PurchasingPage';
import { ExpensesPage } from '../../pages/ExpensesPage';
import { ComingSoon } from '../ui/ComingSoon';

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

  // If the active page becomes forbidden (role change or module disabled), redirect to dashboard
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
      {/* Desktop sidebar - full width */}
      <div className="hidden lg:flex">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      </div>

      {/* Tablet sidebar - collapsed icons only */}
      <div className="hidden md:flex lg:hidden">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} collapsed />
      </div>

      {/* Mobile sidebar - drawer */}
      <MobileSidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!isPOS && <Header activePage={activePage} onMenuToggle={() => setMobileMenuOpen(true)} />}
        <main className={`flex-1 ${isPOS || isFullHeight ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <ErrorBoundary key={activePage} onReset={() => setActivePage('dashboard')}>
            {renderPage()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
