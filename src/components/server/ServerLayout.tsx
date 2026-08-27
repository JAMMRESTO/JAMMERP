import { useState, useEffect } from 'react';
import { UtensilsCrossed, TableProperties, ShoppingCart, ClipboardList, LogOut, WifiOff, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CartProvider, useCart } from '../../contexts/CartContext';
import TablesView from './TablesView';
import MenuView from './MenuView';
import CartSheet from './CartSheet';
import OrdersView from './OrdersView';
import LiveClock from '../shared/LiveClock';

type Tab = 'tables' | 'menu' | 'cart' | 'orders';

function ServerLayoutInner() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('tables');
  const { cartCount, activeTable, releaseTable } = useCart();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeTable && user) {
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tables?id=eq.${activeTable.id}&locked_by=eq.${user.id}`,
          {
            method: 'PATCH',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ locked_by: null }),
          }
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeTable, user]);

  const handleLogout = async () => {
    if (activeTable && user) {
      await releaseTable(user.id);
    }
    logout();
  };

  const tabs = [
    { id: 'tables' as Tab, label: 'Tables', icon: TableProperties },
    { id: 'cart' as Tab, label: 'Panier', icon: ShoppingCart, badge: cartCount },
    { id: 'orders' as Tab, label: 'Mes cmds', icon: ClipboardList },
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {!isOnline && (
        <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-center gap-2">
          <WifiOff size={13} className="flex-shrink-0" />
          <span className="text-xs font-semibold">Hors ligne — les commandes seront synchronisées au retour réseau</span>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed size={17} className="text-white" />
            </div>
            <div>
              <p className="font-black text-gray-900 leading-none text-sm">THE WEST AFRICAN</p>
              {activeTable ? (
                <button
                  onClick={() => {
                    if (['LIBRE'].includes(activeTable.statut)) {
                      if (user) releaseTable(user.id);
                      setActiveTab('tables');
                    } else {
                      setActiveTab('tables');
                    }
                  }}
                  className="flex items-center gap-1 mt-0.5 group"
                >
                  <span className="text-xs font-bold text-amber-600">{activeTable.nom}</span>
                  {activeTable.statut === 'LIBRE' && (
                    <X size={11} className="text-amber-400 group-hover:text-amber-600 transition-colors" />
                  )}
                </button>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">Serveur</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LiveClock />
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-700">{user?.nom}</p>
              <p className="text-xs text-gray-400">{user?.role === 'CAISSIER' ? 'Caissier' : 'Serveur'}</p>
            </div>
            <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-all">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full overflow-y-auto scrollbar-thin pb-20">
        <div className={activeTab === 'tables' ? undefined : 'hidden'}>
          <TablesView onTableSelect={() => setActiveTab('menu')} />
        </div>
        <div className={activeTab === 'menu' ? undefined : 'hidden'}>
          <MenuView onOrderPlaced={() => { if (user) releaseTable(user.id); setActiveTab('tables'); }} />
        </div>
        <div className={activeTab === 'cart' ? undefined : 'hidden'}>
          <CartSheet onOrderPlaced={() => { if (user) releaseTable(user.id); setActiveTab('tables'); }} />
        </div>
        <div className={activeTab === 'orders' ? undefined : 'hidden'}>
          <OrdersView />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
        <div className="flex max-w-2xl mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 relative transition-all min-h-[60px] ${isActive ? 'text-amber-500' : 'text-gray-400'}`}
              >
                <div className="relative">
                  <Icon size={23} strokeWidth={isActive ? 2.5 : 1.8} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-green-500 text-white text-xs min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-black px-0.5 leading-none">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-semibold leading-none mt-0.5 ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>{tab.label}</span>
                {isActive && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-amber-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function ServerLayout() {
  return (
    <CartProvider>
      <ServerLayoutInner />
    </CartProvider>
  );
}
