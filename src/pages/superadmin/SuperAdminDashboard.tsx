import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Globe, Users, TrendingUp, ShoppingBag,
  Activity, RefreshCw, ChevronRight, CheckCircle2, XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Tenant, Site } from '../../types/database';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalSites: number;
  totalSales: number;
  totalRevenue: number;
  todayRevenue: number;
}

interface TenantWithStats extends Tenant {
  sites: Site[];
  salesCount: number;
  revenue: number;
}

export function SuperAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<TenantWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    const today = new Date().toISOString().slice(0, 10);

    const [tenantsRes, sitesRes, salesRes, todaySalesRes] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('sites').select('*'),
      supabase.from('sales').select('total, site_id').eq('status', 'paid'),
      supabase.from('sales').select('total').eq('status', 'paid').gte('created_at', today + 'T00:00:00'),
    ]);

    const allTenants = (tenantsRes.data ?? []) as Tenant[];
    const allSites = (sitesRes.data ?? []) as Site[];
    const allSales = (salesRes.data ?? []) as { total: number; site_id: string | null }[];
    const todaySales = (todaySalesRes.data ?? []) as { total: number }[];

    const sitesByTenant: Record<string, Site[]> = {};
    for (const s of allSites) {
      if (!sitesByTenant[s.tenant_id]) sitesByTenant[s.tenant_id] = [];
      sitesByTenant[s.tenant_id].push(s);
    }

    const siteToTenant: Record<string, string> = {};
    for (const s of allSites) siteToTenant[s.id] = s.tenant_id;

    const revenueByTenant: Record<string, number> = {};
    const countByTenant: Record<string, number> = {};
    for (const sale of allSales) {
      if (!sale.site_id) continue;
      const tid = siteToTenant[sale.site_id];
      if (!tid) continue;
      revenueByTenant[tid] = (revenueByTenant[tid] ?? 0) + sale.total;
      countByTenant[tid] = (countByTenant[tid] ?? 0) + 1;
    }

    const tenantsWithStats: TenantWithStats[] = allTenants.map(t => ({
      ...t,
      sites: sitesByTenant[t.id] ?? [],
      salesCount: countByTenant[t.id] ?? 0,
      revenue: revenueByTenant[t.id] ?? 0,
    }));

    setTenants(tenantsWithStats);
    setStats({
      totalTenants: allTenants.length,
      activeTenants: allTenants.filter(t => t.is_active).length,
      totalSites: allSites.length,
      totalSales: allSales.length,
      totalRevenue: allSales.reduce((s, r) => s + r.total, 0),
      todayRevenue: todaySales.reduce((s, r) => s + r.total, 0),
    });
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: 'Tenants actifs', value: `${stats?.activeTenants ?? 0} / ${stats?.totalTenants ?? 0}`, icon: Building2, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
    { label: 'Sites total', value: stats?.totalSites ?? 0, icon: Globe, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    { label: 'Ventes (all time)', value: stats?.totalSales?.toLocaleString('fr-FR') ?? 0, icon: ShoppingBag, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    { label: 'CA aujourd\'hui', value: `${(stats?.todayRevenue ?? 0).toLocaleString('fr-FR')} FCFA`, icon: TrendingUp, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-black">Vue d'ensemble</h1>
          <p className="text-white/35 text-sm mt-0.5">Statistiques globales de la plateforme</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={load}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white/60 hover:text-white text-sm transition-all"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Actualiser
        </motion.button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-white/8 bg-white/3 p-5 hover:border-white/14 transition-all"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: kpi.bg }}>
                <Icon size={18} style={{ color: kpi.color }} />
              </div>
              <p className="text-white text-xl font-black leading-tight">{kpi.value}</p>
              <p className="text-white/40 text-xs mt-1">{kpi.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Tenant list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-base">Tous les tenants</h2>
          <span className="text-white/30 text-xs">{tenants.length} tenant{tenants.length > 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-3">
          {tenants.length === 0 ? (
            <div className="flex items-center justify-center py-16 rounded-2xl border border-white/8 bg-white/3">
              <div className="text-center">
                <Building2 size={32} className="mx-auto mb-3 text-white/15" />
                <p className="text-white/40 text-sm">Aucun tenant enregistré</p>
              </div>
            </div>
          ) : (
            tenants.map((tenant, i) => (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.04 }}
                className="rounded-2xl border border-white/8 bg-white/3 p-4 hover:border-white/14 transition-all"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-blue-500/12 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-blue-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{tenant.name}</p>
                      {tenant.is_active
                        ? <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20"><CheckCircle2 size={9} />Actif</span>
                        : <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/12 text-red-400 border border-red-500/20"><XCircle size={9} />Inactif</span>
                      }
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/40 border border-white/8">{tenant.plan}</span>
                    </div>
                    <p className="text-white/30 text-xs mt-0.5 font-mono">{tenant.slug}</p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-white font-bold text-sm">{tenant.sites.length}</p>
                      <p className="text-white/30 text-[10px]">sites</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-sm">{tenant.salesCount.toLocaleString('fr-FR')}</p>
                      <p className="text-white/30 text-[10px]">ventes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-sm">{(tenant.revenue / 1000).toFixed(0)}k</p>
                      <p className="text-white/30 text-[10px]">FCFA</p>
                    </div>
                  </div>

                  <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
                </div>

                {/* Sites badges */}
                {tenant.sites.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pl-[60px]">
                    {tenant.sites.map(site => (
                      <span key={site.id} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-white/4 text-white/40 border border-white/6">
                        <Activity size={8} className="text-emerald-400" />
                        {site.name}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
