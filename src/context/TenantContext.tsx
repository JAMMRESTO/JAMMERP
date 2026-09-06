import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';
import type { Tenant, Site, RestaurantSettings } from '../types/database';

type AllowedModules = RestaurantSettings['active_modules'];

interface SiteManager {
  id: string;
  site_id: string;
  tenant_id: string;
  email: string;
  name: string;
  pin: string;
  is_active: boolean;
}

interface TenantContextType {
  authUser: SupabaseUser | null;
  authSession: SupabaseSession | null;
  isAuthLoading: boolean;

  isSuperAdmin: boolean;
  isSiteManager: boolean;
  siteManager: SiteManager | null;

  tenant: Tenant | null;
  sites: Site[];
  isLoadingTenant: boolean;
  allowedModules: AllowedModules;

  isOnboardingDone: boolean;

  ownerPin: string;
  setOwnerPin: (pin: string) => Promise<{ error?: string }>;

  currentSite: Site | null;
  selectSite: (site: Site) => void;
  clearSite: () => void;

  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, tenantName: string, plan?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;

  createSite: (name: string, slug: string) => Promise<{ site?: Site; error?: string }>;
  updateSite: (siteId: string, data: Partial<Pick<Site, 'name' | 'address' | 'phone' | 'timezone'>>) => Promise<{ error?: string }>;

  refreshOnboardingStatus: () => Promise<void>;
  reloadTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | null>(null);

const SITE_KEY = 'resto_current_site';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [authSession, setAuthSession] = useState<SupabaseSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSiteManager, setIsSiteManager] = useState(false);
  const [siteManager, setSiteManager] = useState<SiteManager | null>(null);
  const [ownerPin, setOwnerPinState] = useState('');

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [currentSite, setCurrentSite] = useState<Site | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);
  const [isOnboardingDone, setIsOnboardingDone] = useState(false);
  const lastInitUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthSession(session);
      setAuthUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthSession(session);
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authUser) {
      // Skip re-init on token refresh if same user
      if (lastInitUserId.current === authUser.id) return;
      lastInitUserId.current = authUser.id;
      initUser(authUser.id);
    } else {
      lastInitUserId.current = null;
      setIsSuperAdmin(false);
      setIsSiteManager(false);
      setSiteManager(null);
      setTenant(null);
      setSites([]);
      setCurrentSite(null);
      setIsOnboardingDone(false);
    }
  }, [authUser]);


  async function checkOnboardingStatus(siteId: string) {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'restaurant_name')
      .maybeSingle();
    setIsOnboardingDone(!!data?.value);
  }

  async function refreshOnboardingStatus() {
    if (currentSite) await checkOnboardingStatus(currentSite.id);
  }

  async function reloadTenant() {
    if (authUser) await loadTenantData(authUser.id);
  }

  async function initUser(userId: string) {
    setIsLoadingTenant(true);

    // Run role checks in parallel to cut round-trips
    const [{ data: saRow }, { data: smRow }] = await Promise.all([
      supabase.from('super_admins').select('id').eq('id', userId).maybeSingle(),
      supabase.from('site_managers').select('*').eq('id', userId).maybeSingle(),
    ]);

    if (saRow) {
      setIsSuperAdmin(true);
      setIsLoadingTenant(false);
      return;
    }
    setIsSuperAdmin(false);

    if (smRow) {
      const sm = smRow as SiteManager;
      setIsSiteManager(true);
      setSiteManager(sm);
      setOwnerPinState(sm.pin ?? '');
      await loadTenantDataForSiteManager(sm);
      setIsLoadingTenant(false);
      return;
    }
    setIsSiteManager(false);
    setSiteManager(null);

    // Check if this is a staff user (in public.users) — treat as site manager
    const { data: staffRow } = await supabase
      .from('users')
      .select('id, site_id, tenant_id, name, email')
      .eq('id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (staffRow) {
      // Treat staff user as site manager (read-only access via PIN app)
      const syntheticSm: SiteManager = {
        id: staffRow.id,
        site_id: staffRow.site_id,
        tenant_id: staffRow.tenant_id,
        email: staffRow.email ?? '',
        name: staffRow.name,
        is_active: true,
      };
      setIsSiteManager(true);
      setSiteManager(syntheticSm);
      await loadTenantDataForSiteManager(syntheticSm);
      setIsLoadingTenant(false);
      return;
    }

    // Check if this is a shared cashier auth account (sites.cashier_auth_user_id)
    const { data: siteRow } = await supabase
      .from('sites')
      .select('id, tenant_id')
      .eq('cashier_auth_user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (siteRow) {
      const syntheticSm: SiteManager = {
        id: userId,
        site_id: siteRow.id,
        tenant_id: siteRow.tenant_id,
        email: '',
        name: 'Caissier',
        is_active: true,
      };
      setIsSiteManager(true);
      setSiteManager(syntheticSm);
      await loadTenantDataForSiteManager(syntheticSm);
      setIsLoadingTenant(false);
      return;
    }

    // Tenant owner
    await loadTenantData(userId);
  }

  async function loadTenantDataForSiteManager(sm: SiteManager) {
    const [{ data: tenantData }, { data: siteData }, { data: settingData }] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', sm.tenant_id).maybeSingle(),
      supabase.from('sites').select('*').eq('id', sm.site_id).maybeSingle(),
      supabase.from('settings').select('value').eq('site_id', sm.site_id).eq('key', 'restaurant_name').maybeSingle(),
    ]);
    if (!tenantData || !siteData) return;
    setTenant(tenantData as Tenant);
    const site = siteData as Site;
    setSites([site]);
    setCurrentSite(site);
    // Site managers and cashiers cannot complete the onboarding wizard.
    // Consider onboarding done as long as a site exists; fall back to the
    // site name for the restaurant name until the owner fills in settings.
    if (!settingData?.value && site.name) {
      await supabase.from('settings').upsert(
        { site_id: site.id, key: 'restaurant_name', value: site.name, updated_at: new Date().toISOString() },
        { onConflict: 'site_id,key' }
      );
    }
    setIsOnboardingDone(true);
  }

  async function loadTenantData(ownerId: string) {
    setIsLoadingTenant(true);
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!tenantData) {
      setIsLoadingTenant(false);
      return;
    }
    setTenant(tenantData as Tenant);
    setOwnerPinState((tenantData as any).owner_pin ?? '');

    if (tenantData.status === 'active' && tenantData.is_active) {
      const { data: sitesData } = await supabase
        .from('sites').select('*').eq('tenant_id', tenantData.id).eq('is_active', true).order('name');

      const loadedSites = (sitesData ?? []) as Site[];
      setSites(loadedSites);

      // Always auto-select: restore last saved site or default to first
      const savedSiteId = localStorage.getItem(SITE_KEY);
      const saved = loadedSites.find(s => s.id === savedSiteId);
      const activeSite = saved ?? loadedSites[0] ?? null;
      setCurrentSite(activeSite);

      if (activeSite) {
        await checkOnboardingStatus(activeSite.id);
      }
    }

    setIsLoadingTenant(false);
  }

  function selectSite(site: Site) {
    if (isSiteManager) return;
    setCurrentSite(site);
    localStorage.setItem(SITE_KEY, site.id);
    checkOnboardingStatus(site.id);
  }

  function clearSite() {
    if (isSiteManager) return;
    setCurrentSite(null);
    setIsOnboardingDone(false);
    localStorage.removeItem(SITE_KEY);
  }

  async function signIn(email: string, password: string): Promise<{ error?: string }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }

  async function signUp(email: string, password: string, tenantName: string, plan?: string): Promise<{ error?: string }> {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-tenant-account`;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password, tenantName, plan: plan ?? 'starter' }),
    });
    const result = await res.json();
    if (!res.ok || result.error) return { error: result.error ?? 'Erreur lors de la creation du compte' };

    // Sign in immediately after account creation
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) return { error: signInErr.message };
    return {};
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch {
      // Network failure — clear locally regardless
    }
    localStorage.removeItem(SITE_KEY);
    localStorage.removeItem('resto_session_user');
    localStorage.removeItem('resto_session_locked');
    setAuthUser(null);
    setAuthSession(null);
    setIsSuperAdmin(false);
    setIsSiteManager(false);
    setSiteManager(null);
    setTenant(null);
    setSites([]);
    setCurrentSite(null);
    setIsOnboardingDone(false);
  }

  async function createSite(name: string, slug: string): Promise<{ site?: Site; error?: string }> {
    if (!tenant) return { error: 'Aucun tenant actif' };
    const { data, error } = await supabase
      .from('sites')
      .insert({ tenant_id: tenant.id, name, slug })
      .select()
      .single();
    if (error) return { error: error.message };
    const newSite = data as Site;
    // Seed a minimal restaurant_name setting so onboarding is considered done
    await supabase.from('settings').upsert(
      { site_id: newSite.id, key: 'restaurant_name', value: name, updated_at: new Date().toISOString() },
      { onConflict: 'site_id,key' }
    );
    setSites(prev => [...prev, newSite]);
    return { site: newSite };
  }

  async function updateSite(siteId: string, updates: Partial<Pick<Site, 'name' | 'address' | 'phone' | 'timezone'>>): Promise<{ error?: string }> {
    const { error } = await supabase
      .from('sites')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', siteId);
    if (error) return { error: error.message };
    setSites(prev => prev.map(s => s.id === siteId ? { ...s, ...updates } : s));
    if (currentSite?.id === siteId) setCurrentSite(prev => prev ? { ...prev, ...updates } : prev);
    return {};
  }

  async function setOwnerPin(pin: string): Promise<{ error?: string }> {
    if (isSiteManager && siteManager) {
      const { error } = await supabase
        .from('site_managers')
        .update({ pin })
        .eq('id', siteManager.id);
      if (error) return { error: error.message };
      setSiteManager(prev => prev ? { ...prev, pin } : prev);
    } else if (tenant) {
      const { error } = await supabase
        .from('tenants')
        .update({ owner_pin: pin })
        .eq('id', tenant.id);
      if (error) return { error: error.message };
    }
    setOwnerPinState(pin);
    return {};
  }

  const allowedModules = useMemo<AllowedModules>(() => {
    const defaults: AllowedModules = {
      pos: true, delivery: true, kitchen: true,
      inventory: true, reports: true, reservations: true, production: true,
    };
    if (!tenant?.allowed_modules) return defaults;
    return { ...defaults, ...tenant.allowed_modules };
  }, [tenant]);

  return (
    <TenantContext.Provider value={{
      authUser, authSession, isAuthLoading,
      isSuperAdmin, isSiteManager, siteManager,
      tenant, sites, isLoadingTenant, allowedModules,
      isOnboardingDone,
      ownerPin, setOwnerPin,
      currentSite, selectSite, clearSite,
      signIn, signUp, signOut,
      createSite, updateSite,
      refreshOnboardingStatus, reloadTenant,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
