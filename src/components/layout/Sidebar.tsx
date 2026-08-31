import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, Utensils, Truck, Package,
  BarChart2, Calendar, Settings, LogOut, ChefHat,
  FlaskConical, Building2, Tag, Lock, Receipt, Wallet,
  type LucideIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTenant } from '../../context/TenantContext';
import { useState } from 'react';

import type { RestaurantSettings } from '../../types/database';

type ActiveModules = RestaurantSettings['active_modules'];

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
  module?: keyof ActiveModules;
}

export const navConfig: NavItem[] = [
  { id: 'dashboard',    label: 'Tableau de bord',      icon: LayoutDashboard, roles: ['admin'] },
  { id: 'pos',          label: 'Point de vente',       icon: ShoppingCart,    module: 'pos' },
  { id: 'expenses',     label: 'Depenses',             icon: Wallet,          module: 'pos' },
  { id: 'products',     label: 'Produits',             icon: Package,         roles: ['admin'] },
  { id: 'categories',   label: 'Categories',           icon: Tag,             roles: ['admin'] },
  { id: 'tables',       label: 'Tables',               icon: Building2,       roles: ['admin'] },
  { id: 'kitchen',      label: 'Commandes',            icon: Utensils,        roles: ['admin', 'cashier'], module: 'kitchen' },
  { id: 'delivery',     label: 'Livraisons',           icon: Truck,           roles: ['admin'],            module: 'delivery' },
  { id: 'inventory',    label: 'Inventaire',           icon: FlaskConical,    roles: ['admin'],            module: 'inventory' },
  { id: 'production',   label: 'Production',           icon: FlaskConical,    roles: ['admin'],            module: 'production' },
  { id: 'purchasing',   label: 'Achats & Fournisseurs', icon: Receipt,         roles: ['admin'],            module: 'inventory' },
  { id: 'reports',      label: 'Rapports',             icon: BarChart2,       roles: ['admin'],            module: 'reports' },
  { id: 'online_orders', label: 'Commandes en ligne',  icon: Calendar,        roles: ['admin'],            module: 'reservations' },
  { id: 'cash_sessions', label: 'Fermetures de caisse', icon: Lock,           roles: ['admin'],            module: 'pos' },
  { id: 'settings',     label: 'Parametres',           icon: Settings,        roles: ['admin'] },
];

export function isPageAllowed(
  item: NavItem,
  roleName: string | undefined,
  activeModules?: ActiveModules,
  isTenantOwner?: boolean
): boolean {
  // Tenant owner bypasses all role restrictions (equivalent to admin)
  if (!isTenantOwner && item.roles && (!roleName || !item.roles.includes(roleName))) return false;
  if (item.module && activeModules && !activeModules[item.module]) return false;
  return true;
}

const roleColors: Record<string, string> = {
  admin: '#EF4444',
  cashier: '#F59E0B',
};

// ─── Site Tabs (shown in sidebar when tenant owner has multiple sites) ─────────
function SiteSelectorInSidebar({ collapsed }: { collapsed?: boolean }) {
  const { sites, currentSite, selectSite } = useTenant();
  const [tooltipSite, setTooltipSite] = useState<string | null>(null);

  if (!currentSite || sites.length < 2) return null;

  if (collapsed) {
    return (
      <div className="px-2 mb-1 space-y-0.5">
        <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest text-center mb-1">Sites</p>
        {sites.map(site => {
          const active = currentSite.id === site.id;
          return (
            <div key={site.id} className="relative" onMouseEnter={() => setTooltipSite(site.id)} onMouseLeave={() => setTooltipSite(null)}>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={() => selectSite(site)}
                className="w-full flex justify-center items-center p-2 rounded-xl transition-all"
                style={active ? {
                  backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                  color: 'var(--color-primary)',
                } : undefined}
                title={site.name}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black ${active ? '' : 'bg-white/6 text-white/40'}`}
                  style={active ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' } : undefined}
                >
                  {site.name.slice(0, 2).toUpperCase()}
                </div>
              </motion.button>
              <AnimatePresence>
                {tooltipSite === site.id && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.1 }}
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-gray-800 border border-white/10 rounded-lg shadow-lg z-50 whitespace-nowrap pointer-events-none"
                  >
                    <p className="text-white text-xs font-semibold">{site.name}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-2 mb-1">
      <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-1 mb-1.5">Sites</p>
      <div className="space-y-0.5">
        {sites.map(site => {
          const active = currentSite.id === site.id;
          return (
            <motion.button
              key={site.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => selectSite(site)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left relative overflow-hidden"
              style={active ? {
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                color: 'var(--color-primary)',
              } : undefined}
            >
              {active && (
                <motion.div
                  layoutId="site-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                />
              )}
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0"
                style={active
                  ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' }
                  : { backgroundColor: 'rgba(255,255,255,0.07)' }
                }
              >
                <span className={active ? '' : 'text-white/40'}>
                  {site.name.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className={`text-[11px] font-semibold truncate flex-1 ${active ? '' : 'text-white/45 hover:text-white/70'}`}>
                {site.name}
              </span>
              {active && (
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  collapsed?: boolean;
}

export function Sidebar({ activePage, onNavigate, collapsed = false }: SidebarProps) {
  const { currentUser, fullLogout } = useAuth();
  const { settings } = useSettings();
  const { isSiteManager, authUser } = useTenant();
  const isTenantOwner = !isSiteManager;
  const showSitePicker = isTenantOwner;

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  const userColor = currentUser?.role ? (roleColors[currentUser.role.name] || '#3B82F6') : '#3B82F6';
  const displayName = currentUser?.name ?? authUser?.email ?? '';
  const displayRole = currentUser?.role?.label ?? (isTenantOwner ? 'Propriétaire' : '');
  const displayInitials = currentUser ? getInitials(currentUser.name) : (authUser?.email?.[0] ?? '?').toUpperCase();

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-[168px]'} h-screen flex flex-col bg-gray-900 border-r border-white/8 flex-shrink-0 z-40 transition-all duration-300`}>
      {/* Logo */}
      <div className={`flex items-center ${collapsed ? 'justify-center px-3' : 'gap-2.5 px-4'} py-4 border-b border-white/8`}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden"
          style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 30%, transparent)' }}
        >
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <ChefHat size={16} className="text-white" />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{settings.restaurant_name}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>POS</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5" style={{ scrollbarWidth: 'none' }}>
        {navConfig.filter(item => isPageAllowed(item, currentUser?.role?.name, settings.active_modules, isTenantOwner)).map(item => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              whileTap={{ scale: 0.97 }}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2.5 rounded-xl transition-all duration-150 relative text-left
                ${active ? '' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
              style={active ? {
                backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                color: 'var(--color-primary)',
              } : undefined}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                />
              )}
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="text-[13px] font-medium truncate">{item.label}</span>}
            </motion.button>
          );
        })}
      </nav>

      {/* Site selector (tenant owner only, multi-site) */}
      {showSitePicker && <SiteSelectorInSidebar collapsed={collapsed} />}

      {/* Bottom: logout + user */}
      <div className="flex-shrink-0 border-t border-white/8 p-2 space-y-0.5">
        <button
          onClick={fullLogout}
          title={collapsed ? 'Déconnexion' : undefined}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/8 transition-all text-[13px] font-medium`}
        >
          <LogOut size={15} className="flex-shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>

        {(currentUser || isTenantOwner) && (
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'} px-2 pt-2 pb-1`}>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: userColor + '25', color: userColor, border: `1px solid ${userColor}40` }}
              title={collapsed ? displayName : undefined}
            >
              {displayInitials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{displayName}</p>
                <p className="text-white/30 text-[10px] truncate">{displayRole}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export function MobileSidebar({ activePage, onNavigate, open, onClose }: SidebarProps & { open: boolean; onClose: () => void }) {
  const { currentUser, fullLogout } = useAuth();
  const { settings } = useSettings();
  const { isSiteManager, authUser } = useTenant();
  const isTenantOwner = !isSiteManager;
  const userColor = currentUser?.role ? (roleColors[currentUser.role.name] || '#3B82F6') : '#3B82F6';
  const showSitePicker = isTenantOwner;
  const displayName = currentUser?.name ?? authUser?.email ?? '';
  const displayRole = currentUser?.role?.label ?? (isTenantOwner ? 'Propriétaire' : '');

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  const displayInitials = currentUser ? getInitials(currentUser.name) : (authUser?.email?.[0] ?? '?').toUpperCase();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed left-0 top-0 h-full w-[168px] bg-gray-900 border-r border-white/8 z-50 flex flex-col safe-pt"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/8">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg overflow-hidden"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <ChefHat size={16} className="text-white" />
                )}
              </div>
              <div>
                <p className="text-white font-bold text-sm">{settings.restaurant_name}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>POS</p>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5" style={{ scrollbarWidth: 'none' }}>
              {navConfig.filter(item => isPageAllowed(item, currentUser?.role?.name, settings.active_modules, isTenantOwner)).map(item => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-[13px] font-medium
                      ${active ? '' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
                    style={active ? {
                      backgroundColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                      color: 'var(--color-primary)',
                    } : undefined}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            {showSitePicker && <SiteSelectorInSidebar />}
            <div className="border-t border-white/8 p-2 space-y-0.5">
              <button onClick={fullLogout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/8 transition-all text-[13px] font-medium">
                <LogOut size={15} /> Déconnexion
              </button>
              {(currentUser || isTenantOwner) && (
                <div className="flex items-center gap-2 px-2 pt-2 pb-1">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: userColor + '25', color: userColor, border: `1px solid ${userColor}40` }}>
                    {displayInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium truncate">{displayName}</p>
                    <p className="text-white/30 text-[10px] truncate">{displayRole}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
