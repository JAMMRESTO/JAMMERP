import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Globe, Users, ShieldCheck,
  LogOut, ChevronRight, Menu, X, Search,
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { TenantsPage } from './TenantsPage';
import { SuperAdminUsersPage } from './SuperAdminUsersPage';
import { TenantExplorerPage } from './TenantExplorerPage';

type SAPage = 'dashboard' | 'tenants' | 'explorer' | 'users';

const navItems: { id: SAPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: 'tenants',   label: 'Tenants',          icon: Building2 },
  { id: 'explorer',  label: 'Explorer',          icon: Search },
  { id: 'users',     label: 'Super Admins',      icon: ShieldCheck },
];

export function SuperAdminLayout() {
  const { authUser, signOut } = useTenant();
  const [page, setPage] = useState<SAPage>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  function renderPage() {
    switch (page) {
      case 'dashboard': return <SuperAdminDashboard />;
      case 'tenants':   return <TenantsPage />;
      case 'explorer':  return <TenantExplorerPage />;
      case 'users':     return <SuperAdminUsersPage />;
    }
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-gray-900 border-r border-white/8 flex-shrink-0">
        <SidebarContent
          page={page}
          setPage={setPage}
          email={authUser?.email ?? ''}
          onSignOut={signOut}
        />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-white/8 z-50 md:hidden flex flex-col"
            >
              <SidebarContent
                page={page}
                setPage={p => { setPage(p); setMobileOpen(false); }}
                email={authUser?.email ?? ''}
                onSignOut={signOut}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center gap-3 px-4 bg-gray-900/60 backdrop-blur-xl border-b border-white/8 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:text-white"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-white font-semibold text-sm">{navItems.find(n => n.id === page)?.label}</span>
            <ChevronRight size={13} className="text-white/25" />
            <span className="text-white/35 text-xs">Super Admin</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
            <ShieldCheck size={13} className="text-red-400" />
            <span className="text-red-400 text-xs font-semibold hidden sm:block">Mode Super Admin</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  page, setPage, email, onSignOut,
}: {
  page: SAPage;
  setPage: (p: SAPage) => void;
  email: string;
  onSignOut: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
            <ShieldCheck size={17} className="text-white" />
          </div>
          <div>
            <p className="text-white font-black text-sm leading-tight">Super Admin</p>
            <p className="text-red-400/70 text-[10px] font-semibold uppercase tracking-widest">Plateforme</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = page === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => setPage(item.id)}
              whileTap={{ scale: 0.97 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'text-white bg-red-600/20 border border-red-500/25'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} className={active ? 'text-red-400' : ''} />
              {item.label}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/8 space-y-1">
        <div className="px-3 py-2 rounded-xl bg-white/3">
          <p className="text-white/60 text-[10px] font-medium truncate">{email}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Globe size={9} className="text-red-400" />
            <span className="text-red-400 text-[9px] font-semibold uppercase tracking-wider">Accès global</span>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/8 text-sm font-medium transition-all"
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>
    </>
  );
}
