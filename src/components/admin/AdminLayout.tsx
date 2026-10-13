import { useState, useEffect } from 'react';
import {
  UtensilsCrossed, Users, Map, LayoutGrid, Package, LogOut,
  BarChart3, Printer, History, Settings,
  Database, CreditCard, AlertTriangle,
  Boxes, ShoppingCart, ArrowLeftRight, ClipboardCheck, Home,
  TrendingUp, Wrench,
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
import InventoryManager from './InventoryManager';
import PurchasesView from './PurchasesView';
import MovementsView from './MovementsView';
import InventoryCountView from './InventoryCountView';

type AdminTab = 'statistics' | 'users' | 'zones' | 'categories' | 'products' | 'printers' | 'printjobs' | 'settings' | 'data' | 'subscription' | 'inventory' | 'purchases' | 'movements' | 'invcount';
type View = AdminTab | 'home';

interface TileDef {
  id: AdminTab;
  label: string;
  desc: string;
  icon: typeof BarChart3;
  color: string;
  span?: boolean;
}

export default function AdminLayout({ blocked }: { blocked?: boolean }) {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'SUPERADMIN';
  const [view, setView] = useState<View>('home');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tiles: TileDef[] = [
    { id: 'statistics', label: 'Statistiques', desc: 'Ventes & chiffres', icon: BarChart3, color: 'from-sky-500 to-blue-600', span: true },
    { id: 'products', label: 'Produits', desc: 'Carte & prix', icon: Package, color: 'from-amber-500 to-orange-600', span: true },
    { id: 'categories', label: 'Catégories', desc: 'Organiser la carte', icon: LayoutGrid, color: 'from-teal-500 to-cyan-600' },
    { id: 'users', label: 'Équipe', desc: 'Serveurs & rôles', icon: Users, color: 'from-rose-500 to-red-600' },
    { id: 'zones', label: 'Zones & Tables', desc: 'Salle & terrasse', icon: Map, color: 'from-emerald-500 to-green-600' },
    { id: 'printers', label: 'Imprimantes', desc: 'USB & formats', icon: Printer, color: 'from-slate-600 to-gray-700' },
    { id: 'inventory', label: 'Stock', desc: 'Inventaire', icon: Boxes, color: 'from-lime-500 to-green-600', span: true },
    { id: 'purchases', label: 'Achats', desc: 'Fournisseurs', icon: ShoppingCart, color: 'from-orange-500 to-amber-600' },
    { id: 'movements', label: 'Mouvements', desc: 'Entrées/Sorties', icon: ArrowLeftRight, color: 'from-cyan-500 to-sky-600' },
    { id: 'invcount', label: 'Inventaire', desc: 'Comptage stock', icon: ClipboardCheck, color: 'from-green-600 to-teal-700' },
    { id: 'settings', label: 'Paramètres', desc: 'Configuration', icon: Settings, color: 'from-blue-500 to-indigo-600' },
    { id: 'printjobs', label: 'Impressions', desc: 'File & historique', icon: History, color: 'from-gray-500 to-slate-600' },
    ...(isSuperAdmin ? [{ id: 'subscription' as AdminTab, label: 'Abonnement', desc: 'Facturation', icon: CreditCard, color: 'from-red-500 to-rose-600' }] : []),
    ...(isSuperAdmin ? [{ id: 'data' as AdminTab, label: 'Données', desc: 'Export & reset', icon: Database, color: 'from-zinc-600 to-gray-700' }] : []),
  ];

  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dayName = days[now.getDay()];
  const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (view !== 'home') {
    const tabLabels: Record<AdminTab, string> = {
      statistics: 'Statistiques', users: 'Équipe', zones: 'Zones & Tables', categories: 'Catégories',
      products: 'Produits', printers: 'Imprimantes', printjobs: 'Impressions', settings: 'Paramètres',
      data: 'Données', subscription: 'Abonnement', inventory: 'Stock', purchases: 'Achats',
      movements: 'Mouvements', invcount: 'Inventaire',
    };
    return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setView('home')} className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all flex-shrink-0">
              <Home size={16} /><span className="text-xs font-semibold hidden sm:inline">Accueil</span>
            </button>
            <div className="w-px h-6 bg-gray-200 flex-shrink-0" />
            <h1 className="font-bold text-gray-800 text-sm sm:text-base truncate">{tabLabels[view as AdminTab]}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
              <div className="w-7 h-7 bg-amber-500/20 rounded-full flex items-center justify-center"><span className="text-amber-600 text-xs font-bold">{user?.nom?.charAt(0)}</span></div>
              <div><p className="text-xs font-medium text-gray-700 leading-none">{user?.nom}</p><p className="text-[10px] text-gray-400 leading-none mt-0.5">{user?.role}</p></div>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all">
              <LogOut size={16} /><span className="text-xs font-semibold hidden sm:inline">Quitter</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6">
          {blocked && isSuperAdmin && view !== 'subscription' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={18} className="flex-shrink-0" />
                <span className="text-sm font-semibold">Abonnement expiré — renouvelez pour déverrouiller l'accès</span>
              </div>
              <button onClick={() => setView('subscription')} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all whitespace-nowrap">Renouveler</button>
            </div>
          )}
          {view === 'statistics' && <AdminStatistics />}
          {view === 'users' && <UsersManager />}
          {view === 'zones' && <ZonesTablesManager />}
          {view === 'categories' && <CategoriesManager />}
          {view === 'products' && <ProductsManager />}
          {view === 'printers' && <PrintersManager />}
          {view === 'printjobs' && <PrintJobsManager />}
          {view === 'settings' && <SettingsManager />}
          {view === 'subscription' && isSuperAdmin && <SubscriptionManager />}
          {view === 'data' && isSuperAdmin && <DataManagerView />}
          {view === 'inventory' && <InventoryManager />}
          {view === 'purchases' && <PurchasesView />}
          {view === 'movements' && <MovementsView />}
          {view === 'invcount' && <InventoryCountView />}
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 flex-shrink-0">
              <UtensilsCrossed size={22} className="text-white sm:hidden" />
              <UtensilsCrossed size={24} className="text-white hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-xl text-white leading-tight truncate">THE WEST AFRICAN</h1>
              <p className="text-xs sm:text-sm text-blue-300/70">Administration</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="text-right hidden xs:block">
              <p className="text-lg sm:text-2xl font-bold text-white tabular-nums tracking-tight leading-none">{timeStr}</p>
              <p className="text-[10px] sm:text-sm text-blue-300/70 capitalize mt-0.5">{dayName}, {dateStr}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur rounded-xl border border-white/10">
              <div className="w-8 h-8 bg-amber-500/30 rounded-full flex items-center justify-center"><span className="text-amber-300 text-sm font-bold">{user?.nom?.charAt(0)}</span></div>
              <div><p className="text-xs font-medium text-white leading-none">{user?.nom}</p><p className="text-[10px] text-blue-300/60 leading-none mt-0.5">{user?.role}</p></div>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 px-2.5 sm:px-3 h-9 sm:h-10 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-all border border-red-500/20">
              <LogOut size={16} /><span className="text-xs font-semibold hidden sm:inline">Quitter</span>
            </button>
          </div>
        </div>

        {blocked && isSuperAdmin && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between gap-3 backdrop-blur">
            <div className="flex items-center gap-2 text-red-200">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <span className="text-sm font-semibold">Abonnement expiré — renouvelez pour déverrouiller l'accès</span>
            </div>
            <button onClick={() => setView('subscription')} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all whitespace-nowrap">Renouveler</button>
          </div>
        )}

        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-blue-400" />
          <h2 className="text-sm font-bold text-blue-200 uppercase tracking-widest">Modules</h2>
        </div>

        {/* Tile grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {tiles.map(tile => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                onClick={() => setView(tile.id)}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${tile.color} ${tile.span ? 'col-span-2' : ''} p-3 sm:p-5 text-left transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] shadow-lg min-h-[100px] sm:min-h-[140px] flex flex-col justify-between`}
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
                <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-black/10 rounded-full blur-xl" />
                <div className="relative flex items-start justify-between">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <Icon size={18} className="text-white sm:hidden" />
                    <Icon size={24} className="text-white hidden sm:block" />
                  </div>
                </div>
                <div className="relative">
                  <p className="font-bold text-white text-xs sm:text-base leading-tight">{tile.label}</p>
                  <p className="text-[10px] sm:text-xs text-white/70 mt-0.5">{tile.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-blue-300/40">
          <Wrench size={14} />
          <p className="text-xs">Système de gestion — {tiles.length} modules disponibles</p>
        </div>
      </div>
      </div>
    </div>
  );
}
