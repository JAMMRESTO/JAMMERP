import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Globe, Users, ShieldCheck,
  LogOut, ChevronRight, Menu, X, Search, Database, UserCog,
  Bell, Clock, ArrowRight, CheckCircle2, Volume2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { SuperAdminDashboard } from './SuperAdminDashboard';
import { TenantsPage } from './TenantsPage';
import { SuperAdminUsersPage } from './SuperAdminUsersPage';
import { TenantExplorerPage } from './TenantExplorerPage';
import { SuperAdminBackupsPage } from './SuperAdminBackupsPage';
import { SuperAdminProfilePage } from './SuperAdminProfilePage';

type SAPage = 'dashboard' | 'tenants' | 'explorer' | 'users' | 'backups' | 'profile';

const navItems: { id: SAPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { id: 'tenants',   label: 'Tenants',          icon: Building2 },
  { id: 'explorer',  label: 'Explorer',          icon: Search },
  { id: 'users',     label: 'Super Admins',      icon: ShieldCheck },
  { id: 'backups',   label: 'Sauvegardes',       icon: Database },
  { id: 'profile',   label: 'Mon Profil',        icon: UserCog },
];

// ─── Notification hook ───────────────────────────────────────

interface PendingTenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

function useNotifications(userId: string | undefined) {
  const [pending, setPending] = useState<PendingTenant[]>([]);
  const [unread, setUnread] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const previousCountRef = useRef<number | null>(null);

  const speechUnlocked = useRef(false);

  const unlockSpeech = useCallback(() => {
    if (speechUnlocked.current || !('speechSynthesis' in window)) return;
    const unlock = new SpeechSynthesisUtterance('');
    unlock.volume = 0;
    window.speechSynthesis.speak(unlock);
    speechUnlocked.current = true;
  }, []);

  useEffect(() => {
    const handler = () => { unlockSpeech(); };
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, [unlockSpeech]);

  const speakNotification = useCallback((tenantName?: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const msg = new SpeechSynthesisUtterance(
        `Vous avez reçu une nouvelle demande de création de compte${tenantName ? `, de la part de ${tenantName}` : ''}`
      );
      msg.lang = 'fr-FR';
      msg.rate = 0.95;
      msg.pitch = 1.0;
      msg.volume = 1.0;
      window.speechSynthesis.speak(msg);
    }, 100);
  }, []);

  async function load() {
    if (!userId) return;
    const [tenantsRes, adminRes] = await Promise.all([
      supabase
        .from('tenants')
        .select('id, name, slug, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('super_admins')
        .select('last_notifications_seen_at')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    const tenants = (tenantsRes.data ?? []) as PendingTenant[];
    const seenAt  = (adminRes.data as { last_notifications_seen_at: string | null } | null)
      ?.last_notifications_seen_at ?? null;

    setPending(tenants);
    setLastSeenAt(seenAt);

    const newCount = seenAt
      ? tenants.filter(t => new Date(t.created_at) > new Date(seenAt)).length
      : tenants.length;
    setUnread(newCount);

    return { tenants, newCount };
  }

  useEffect(() => {
    if (!userId) return;
    load().then(result => {
      if (result) previousCountRef.current = result.newCount;
    });

    // Realtime subscription
    const channel = supabase
      .channel('sa-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tenants' }, (payload) => {
        const newTenant = payload.new as { name?: string; status?: string };
        if (newTenant.status === 'pending') {
          speakNotification(newTenant.name);
        }
        load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenants' }, () => load())
      .subscribe();

    // Polling fallback every 30s (in case realtime is blocked by RLS)
    const poll = setInterval(async () => {
      const result = await load();
      if (result && previousCountRef.current !== null && result.newCount > previousCountRef.current) {
        speakNotification();
      }
      if (result) previousCountRef.current = result.newCount;
    }, 30000);

    return () => { supabase.removeChannel(channel); clearInterval(poll); };
  }, [userId]);

  async function markAsSeen() {
    if (!userId) return;
    const now = new Date().toISOString();
    await supabase
      .from('super_admins')
      .update({ last_notifications_seen_at: now })
      .eq('id', userId);
    setLastSeenAt(now);
    setUnread(0);
  }

  return { pending, unread, lastSeenAt, markAsSeen, reload: load, speakNotification };
}

// ─── Time ago helper ─────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

// ─── Notification Bell ───────────────────────────────────────

function NotificationBell({
  userId,
  onViewAll,
}: {
  userId: string | undefined;
  onViewAll: () => void;
}) {
  const { pending, unread, lastSeenAt, markAsSeen, speakNotification } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    if (!open) markAsSeen();
    setOpen(v => !v);
  }

  function handleViewAll() {
    setOpen(false);
    onViewAll();
  }

  const isNew = (iso: string) => lastSeenAt ? new Date(iso) > new Date(lastSeenAt) : true;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
          open
            ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
            : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
        }`}
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-amber-500 text-white text-[10px] font-black rounded-full shadow-lg shadow-amber-500/40"
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-amber-400" />
                <span className="text-white font-bold text-sm">Nouvelles demandes</span>
              </div>
              {pending.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-semibold">
                  {pending.length} en attente
                </span>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <CheckCircle2 size={28} className="text-emerald-400/30 mb-2" />
                  <p className="text-white/30 text-sm font-medium">Aucune demande en attente</p>
                  <p className="text-white/20 text-xs mt-0.5">Tout est traité</p>
                </div>
              ) : (
                pending.map(t => {
                  const fresh = isNew(t.created_at);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                        fresh ? 'bg-amber-500/4' : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        fresh ? 'bg-amber-500/15 border border-amber-500/25' : 'bg-white/6 border border-white/8'
                      }`}>
                        <Building2 size={13} className={fresh ? 'text-amber-400' : 'text-white/30'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-white text-xs font-semibold truncate">{t.name}</p>
                          {fresh && (
                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                          )}
                        </div>
                        <p className="text-white/30 text-[10px] font-mono truncate mt-0.5">{t.slug}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock size={9} className="text-white/25" />
                          <span className="text-white/25 text-[10px]">{timeAgo(t.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/8">
              {pending.length > 0 && (
                <button
                  onClick={handleViewAll}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-amber-400 hover:text-amber-300 hover:bg-amber-500/5 text-xs font-semibold transition-all"
                >
                  Voir toutes les demandes <ArrowRight size={12} />
                </button>
              )}
              <button
                onClick={() => speakNotification()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-t border-white/5 text-white/30 hover:text-white/60 hover:bg-white/3 text-[10px] font-medium transition-all"
              >
                <Volume2 size={11} /> Tester la notification vocale
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Layout ─────────────────────────────────────────────

export function SuperAdminLayout() {
  const { authUser, signOut } = useTenant();
  const [page, setPage] = useState<SAPage>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);

  function goToTenants() {
    setPage('tenants');
    setMobileOpen(false);
  }

  function renderPage() {
    switch (page) {
      case 'dashboard': return <SuperAdminDashboard />;
      case 'tenants':   return <TenantsPage />;
      case 'explorer':  return <TenantExplorerPage />;
      case 'users':     return <SuperAdminUsersPage />;
      case 'backups':   return <SuperAdminBackupsPage />;
      case 'profile':   return <SuperAdminProfilePage />;
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
          <NotificationBell userId={authUser?.id} onViewAll={goToTenants} />
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
