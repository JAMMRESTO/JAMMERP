import { useState } from 'react';
import {
  UtensilsCrossed, Users, Map, LayoutGrid, Package, LogOut,
  ChevronRight, BarChart3, Printer, History, Settings,
  Database, Wrench, SlidersHorizontal, MoreHorizontal, X, CreditCard, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import UsersManager from './UsersManager';
import ZonesTablesManager from './ZonesTablesManager';
import CategoriesManager from './CategoriesManager';
import ProductsManager from './ProductsManager';
import AdminStatistics from './AdminStatistics';
import PrintersManager from './PrintersManager';
import PrintJobsManager from './PrintJobsManager';
import SettingsManager from './SettingsManager';
import DataManagerView from './DataManagerView';
import SubscriptionManager from './SubscriptionManager';

type AdminTab = 'statistics' | 'users' | 'zones' | 'categories' | 'products' | 'printers' | 'printjobs' | 'settings' | 'data' | 'subscription';

interface MenuSection {
  label: string;
  icon: typeof Wrench;
  items: { id: AdminTab; label: string; icon: typeof BarChart3 }[];
}

const bottomNavPrimary: { id: AdminTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'statistics', label: 'Stats', icon: BarChart3 },
  { id: 'products', label: 'Produits', icon: Package },
  { id: 'users', label: 'Equipe', icon: Users },
  { id: 'settings', label: 'Params', icon: Settings },
];

export default function AdminLayout({ blocked }: { blocked?: boolean }) {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const [activeTab, setActiveTab] = useState<AdminTab>('statistics');
  const [moreOpen, setMoreOpen] = useState(false);

  const sections: MenuSection[] = [
    {
      label: 'STATISTIQUES',
      icon: BarChart3,
      items: [
        { id: 'statistics', label: 'Statistiques', icon: BarChart3 },
      ],
    },
    {
      label: 'CONFIGURATION',
      icon: Wrench,
      items: [
        { id: 'users', label: 'Utilisateurs', icon: Users },
        { id: 'zones', label: 'Zones & Tables', icon: Map },
        { id: 'categories', label: 'Categories', icon: LayoutGrid },
        { id: 'products', label: 'Produits', icon: Package },
        { id: 'printers', label: 'Imprimantes', icon: Printer },
      ],
    },
    {
      label: 'PARAMETRES',
      icon: SlidersHorizontal,
      items: [
        { id: 'settings', label: 'Parametres', icon: Settings },
        ...(isSuperAdmin ? [{ id: 'subscription' as AdminTab, label: 'Abonnement', icon: CreditCard }] : []),
        { id: 'printjobs', label: 'Impressions', icon: History },
        ...(isSuperAdmin ? [{ id: 'data' as AdminTab, label: 'Donnees', icon: Database }] : []),
      ],
    },
  ];

  const allTabs = sections.flatMap(s => s.items);
  const moreItems = allTabs.filter(t => !bottomNavPrimary.find(p => p.id === t.id));

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen fixed top-0 left-0 z-30 shadow-xl hidden md:flex">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">THE WEST AFRICAN</h1>
              <p className="text-xs text-gray-400">Administration</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-5 overflow-y-auto scrollbar-dark">
          {sections.map(section => (
            <div key={section.label}>
              <div className="flex items-center gap-2 px-3 mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{section.label}</span>
              </div>
              <div className="space-y-0.5">
                {section.items.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${
                        activeTab === tab.id
                          ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <Icon size={17} />
                      <span className="text-sm font-medium">{tab.label}</span>
                      {activeTab === tab.id && <ChevronRight size={14} className="ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center">
              <span className="text-amber-400 text-sm font-bold">{user?.nom?.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{user?.nom}</p>
              <p className="text-xs text-gray-400">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all text-sm"
          >
            <LogOut size={16} />
            Deconnexion
          </button>
        </div>
      </aside>

      <div className="md:ml-64 flex-1 flex flex-col h-screen overflow-y-auto scrollbar-thin">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between md:hidden sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-800 text-sm">THE WEST AFRICAN</span>
              <p className="text-xs text-gray-400 leading-none">
                {allTabs.find(t => t.id === activeTab)?.label}
              </p>
            </div>
          </div>
          <button onClick={logout} className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all">
            <LogOut size={18} />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          {blocked && isSuperAdmin && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={18} className="flex-shrink-0" />
                <span className="text-sm font-semibold">Abonnement expire - renouvelez pour deverrouiller l'acces</span>
              </div>
              <button
                onClick={() => setActiveTab('subscription')}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all whitespace-nowrap"
              >
                Renouveler
              </button>
            </div>
          )}
          {activeTab === 'statistics' && <AdminStatistics />}
          {activeTab === 'users' && <UsersManager />}
          {activeTab === 'zones' && <ZonesTablesManager />}
          {activeTab === 'categories' && <CategoriesManager />}
          {activeTab === 'products' && <ProductsManager />}
          {activeTab === 'printers' && <PrintersManager />}
          {activeTab === 'printjobs' && <PrintJobsManager />}
          {activeTab === 'settings' && <SettingsManager />}
          {activeTab === 'subscription' && isSuperAdmin && <SubscriptionManager />}
          {activeTab === 'data' && isSuperAdmin && <DataManagerView />}
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
          <div className="flex items-stretch h-16">
            {bottomNavPrimary.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id && !moreOpen;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
                    isActive ? 'text-amber-500' : 'text-gray-400'
                  }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className={`text-[10px] font-semibold leading-none ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>
                    {tab.label}
                  </span>
                  {isActive && <div className="absolute bottom-0 w-8 h-0.5 bg-amber-500 rounded-t-full" />}
                </button>
              );
            })}
            <button
              onClick={() => setMoreOpen(o => !o)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
                moreOpen ? 'text-amber-500' : 'text-gray-400'
              }`}
            >
              {moreOpen ? <X size={22} strokeWidth={2} /> : <MoreHorizontal size={22} strokeWidth={1.8} />}
              <span className={`text-[10px] font-semibold leading-none ${moreOpen ? 'text-amber-500' : 'text-gray-400'}`}>
                Plus
              </span>
            </button>
          </div>
        </nav>

        {moreOpen && (
          <div
            className="md:hidden fixed inset-0 z-20 bg-black/30"
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="absolute bottom-16 left-0 right-0 bg-white border-t border-gray-200 shadow-xl rounded-t-2xl p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="grid grid-cols-3 gap-3">
                {moreItems.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setMoreOpen(false); }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                        isActive ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={24} strokeWidth={isActive ? 2.5 : 1.8} />
                      <span className="text-xs font-semibold text-center leading-tight">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
