import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Bell, Lock, Package, Truck, ChefHat, X, RefreshCw, Building2, LogOut, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { supabase } from '../../lib/supabase';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Tableau de bord', subtitle: 'Vue d\'ensemble du restaurant' },
  pos: { title: 'Point de vente', subtitle: 'Caisse et commandes' },
  tables: { title: 'Tables', subtitle: 'Gestion des tables' },
  delivery: { title: 'Livraisons', subtitle: 'Suivi des livraisons' },
  kitchen: { title: 'Cuisine', subtitle: 'Commandes en cuisine' },
  inventory: { title: 'Inventaire', subtitle: 'Stock et produits' },
  production: { title: 'Production', subtitle: 'Recettes et fabrication' },
  reports: { title: 'Rapports', subtitle: 'Statistiques et analyses' },
  reservations: { title: 'Réservations', subtitle: 'Gestion des réservations' },
  settings: { title: 'Paramètres', subtitle: 'Configuration du restaurant' },
};

interface Alert {
  id: string;
  type: 'stock' | 'order' | 'delivery' | 'ingredient';
  level: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
}

function useAlerts(siteId: string | null) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const results: Alert[] = [];

    const sf = (q: ReturnType<typeof supabase.from>) => siteId ? q.eq('site_id', siteId) : q;

    const [lowProducts, outIngredients, lowIngredients, pendingOrders, pendingDeliveries] = await Promise.all([
      sf(supabase.from('products').select('id, name, stock, low_stock_threshold')).eq('track_stock', true).gt('low_stock_threshold', 0).limit(50),
      sf(supabase.from('ingredients').select('id, name, stock, low_stock_threshold')).eq('is_active', true).lte('stock', 0).limit(20),
      sf(supabase.from('ingredients').select('id, name, stock, low_stock_threshold')).eq('is_active', true).gt('stock', 0).gt('low_stock_threshold', 0).limit(50),
      sf(supabase.from('orders').select('id, order_number, status, created_at')).eq('status', 'pending').order('created_at').limit(10),
      sf(supabase.from('deliveries').select('id, delivery_number, status, created_at')).in('status', ['pending', 'assigned']).order('created_at').limit(10),
    ]);

    // Low stock products
    if (lowProducts.data) {
      (lowProducts.data as { id: string; name: string; stock: number | null; low_stock_threshold: number }[])
        .filter(p => (p.stock ?? 0) <= p.low_stock_threshold)
        .forEach(p => {
          results.push({
            id: `product-${p.id}`,
            type: 'stock',
            level: (p.stock ?? 0) <= 0 ? 'error' : 'warning',
            title: `Stock ${(p.stock ?? 0) <= 0 ? 'épuisé' : 'bas'} : ${p.name}`,
            message: `${p.stock ?? 0} unités restantes (seuil: ${p.low_stock_threshold})`,
            time: new Date().toISOString(),
          });
        });
    }

    // Out of stock ingredients
    if (outIngredients.data) {
      (outIngredients.data as { id: string; name: string; stock: number }[]).forEach(i => {
        results.push({
          id: `ing-out-${i.id}`,
          type: 'ingredient',
          level: 'error',
          title: `Rupture ingrédient : ${i.name}`,
          message: 'Stock à zéro — production bloquée',
          time: new Date().toISOString(),
        });
      });
    }

    // Low stock ingredients
    if (lowIngredients.data) {
      (lowIngredients.data as { id: string; name: string; stock: number; low_stock_threshold: number }[])
        .filter(i => i.stock <= i.low_stock_threshold)
        .forEach(i => {
          results.push({
            id: `ing-low-${i.id}`,
            type: 'ingredient',
            level: 'warning',
            title: `Ingrédient bas : ${i.name}`,
            message: `${i.stock.toFixed(2)} restant (seuil: ${i.low_stock_threshold})`,
            time: new Date().toISOString(),
          });
        });
    }

    // Pending orders older than 20 min
    if (pendingOrders.data) {
      (pendingOrders.data as { id: string; order_number: number; created_at: string }[]).forEach(o => {
        const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
        if (mins >= 20) {
          results.push({
            id: `order-${o.id}`,
            type: 'order',
            level: mins >= 40 ? 'error' : 'warning',
            title: `Commande #${o.order_number} en attente`,
            message: `En attente depuis ${mins} minutes`,
            time: o.created_at,
          });
        }
      });
    }

    // Pending deliveries older than 30 min
    if (pendingDeliveries.data) {
      (pendingDeliveries.data as { id: string; delivery_number: number; status: string; created_at: string }[]).forEach(d => {
        const mins = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 60000);
        if (mins >= 30) {
          results.push({
            id: `delivery-${d.id}`,
            type: 'delivery',
            level: 'warning',
            title: `Livraison #${d.delivery_number} ${d.status === 'pending' ? 'non assignée' : 'en cours'}`,
            message: `Créée il y a ${mins} minutes`,
            time: d.created_at,
          });
        }
      });
    }

    setAlerts(results.slice(0, 20));
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return { alerts, loading, refresh: load };
}

const typeIcon: Record<Alert['type'], React.ComponentType<{ size?: number; className?: string }>> = {
  stock: Package,
  ingredient: Package,
  order: ChefHat,
  delivery: Truck,
};

const levelColor: Record<Alert['level'], string> = {
  error: 'text-red-400 bg-red-500/10 border-red-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

interface HeaderProps {
  activePage: string;
  onMenuToggle: () => void;
}

export function Header({ activePage, onMenuToggle }: HeaderProps) {
  const { lockSession, currentUser } = useAuth();
  const { currentSite, sites, selectSite, isSiteManager, signOut, tenant, clearSite } = useTenant();
  const { alerts, loading, refresh } = useAlerts(currentSite?.id ?? null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const page = pageTitles[activePage] ?? { title: activePage, subtitle: '' };
  const now = new Date();
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const visible = alerts.filter(a => !dismissed.has(a.id));
  const errorCount = visible.filter(a => a.level === 'error').length;
  const totalCount = visible.length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="h-14 sm:h-16 flex items-center gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6 bg-gray-900/60 backdrop-blur-xl border-b border-white/8 flex-shrink-0 relative z-30 safe-pt" style={{ paddingLeft: 'max(env(safe-area-inset-left, 0px), 0.75rem)', paddingRight: 'max(env(safe-area-inset-right, 0px), 0.75rem)' }}>
      <button
        onClick={onMenuToggle}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <motion.div
          key={activePage}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-w-0 hidden sm:block"
        >
          <h1 className="text-white font-semibold text-sm sm:text-base leading-tight truncate">{page.title}</h1>
          <p className="text-white/30 text-[10px] sm:text-xs hidden sm:block">{page.subtitle}</p>
        </motion.div>

        {/* Site tabs — only for tenant owner (no PIN session) — always show all sites by name */}
        {!currentUser && currentSite && sites.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 bg-white/4 border border-white/8 rounded-xl p-1 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none', maxWidth: '360px' }}>
            {sites.map(site => {
              const active = currentSite.id === site.id;
              return (
                <motion.button
                  key={site.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => selectSite(site)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    active ? '' : 'text-white/40 hover:text-white/70'
                  }`}
                  style={active ? {
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 18%, transparent)',
                    color: 'var(--color-primary)',
                  } : undefined}
                >
                  <Building2 size={11} className="flex-shrink-0" />
                  {site.name}
                </motion.button>
              );
            })}
            {(tenant?.plan === 'enterprise' || tenant?.plan === 'pro') && (
              <button
                onClick={() => clearSite()}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-all flex-shrink-0"
                title="Ajouter un site"
              >
                <Plus size={13} />
              </button>
            )}
          </div>
        )}

        {/* Site badge — read-only when staff PIN session is active */}
        {currentSite && currentUser && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/8 flex-shrink-0">
            <Building2 size={11} style={{ color: 'var(--color-primary)' }} />
            <span className="text-white/60 text-xs font-medium truncate max-w-[120px]">{currentSite.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:flex flex-col items-end mr-1 sm:mr-2">
          <span className="text-white text-xs sm:text-sm font-medium">{timeStr}</span>
          <span className="text-white/30 text-[9px] sm:text-[10px] capitalize hidden md:block">{dateStr}</span>
        </div>

        {/* Notification bell */}
        <div ref={panelRef} className="relative">
          <button
            onClick={() => setPanelOpen(v => !v)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
          >
            <Bell size={16} />
            {totalCount > 0 && (
              <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1 ${errorCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}>
                {totalCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {panelOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <Bell size={13} className="text-white/50" />
                    <span className="text-white font-semibold text-sm">Alertes</span>
                    {totalCount > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${errorCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {totalCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={refresh}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-all"
                    >
                      <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                    {totalCount > 0 && (
                      <button
                        onClick={() => setDismissed(new Set(alerts.map(a => a.id)))}
                        className="text-white/30 hover:text-white/60 text-[10px] px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                      >
                        Tout effacer
                      </button>
                    )}
                  </div>
                </div>

                {/* Alert list */}
                <div className="max-h-[360px] overflow-y-auto">
                  {visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                        <Bell size={18} className="text-emerald-400" />
                      </div>
                      <p className="text-white/50 text-sm font-medium">Aucune alerte</p>
                      <p className="text-white/25 text-xs mt-1">Tout est en ordre</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1.5">
                      {visible.map(alert => {
                        const Icon = typeIcon[alert.type];
                        return (
                          <motion.div
                            key={alert.id}
                            layout
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${levelColor[alert.level]}`}
                          >
                            <Icon size={13} className="flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-medium leading-snug">{alert.title}</p>
                              <p className="text-white/40 text-[10px] mt-0.5 leading-snug">{alert.message}</p>
                            </div>
                            <button
                              onClick={() => setDismissed(d => new Set([...d, alert.id]))}
                              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md hover:bg-white/10 text-white/20 hover:text-white/50 transition-all"
                            >
                              <X size={10} />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Lock for site manager PIN session, sign-out for tenant owner */}
        {isSiteManager ? (
          <button
            onClick={lockSession}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-amber-500/20 text-white/40 hover:text-amber-400 transition-all"
            title="Verrouiller la session"
          >
            <Lock size={16} />
          </button>
        ) : (
          <button
            onClick={signOut}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
            title="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  );
}
