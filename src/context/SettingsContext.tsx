import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from './TenantContext';
import type { RestaurantSettings } from '../types/database';

export const defaultSettings: RestaurantSettings = {
  restaurant_name: 'Mon Restaurant',
  currency: 'XOF',
  currency_symbol: 'FCFA',
  tax_rate: 18,
  timezone: 'Africa/Dakar',
  primary_color: '#3B82F6',
  accent_color: '#F59E0B',
  logo_url: null,
  active_modules: {
    pos: true,
    delivery: true,
    kitchen: true,
    inventory: true,
    reports: true,
    reservations: true,
    production: false,
  },
  dashboard_widgets: {
    live_orders: true,
    alerts: true,
  },
  receipt_footer: 'Merci pour votre visite!',
  auto_print_receipt: false,
  address: '',
  phone: '',
  siret: '',
  vat_number: '',
  legal_form: '',
  capital: '',
};

interface SettingsContextType {
  settings: RestaurantSettings;
  isLoading: boolean;
  updateSetting: <K extends keyof RestaurantSettings>(key: K, value: RestaurantSettings[K]) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentSite, allowedModules } = useTenant();
  const [rawSettings, setRawSettings] = useState<RestaurantSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Intersect the site's active_modules with what the super admin allows for this tenant
  const settings = useMemo<RestaurantSettings>(() => ({
    ...rawSettings,
    active_modules: {
      pos:          rawSettings.active_modules.pos          && allowedModules.pos,
      delivery:     rawSettings.active_modules.delivery     && allowedModules.delivery,
      kitchen:      rawSettings.active_modules.kitchen      && allowedModules.kitchen,
      inventory:    rawSettings.active_modules.inventory    && allowedModules.inventory,
      reports:      rawSettings.active_modules.reports      && allowedModules.reports,
      reservations: rawSettings.active_modules.reservations && allowedModules.reservations,
      production:   rawSettings.active_modules.production   && allowedModules.production,
    },
  }), [rawSettings, allowedModules]);

  useEffect(() => {
    if (currentSite) {
      refreshSettings();
    } else {
      setRawSettings(defaultSettings);
      applyColorVars(defaultSettings);
      setIsLoading(false);
    }
  }, [currentSite?.id]);

  function applyColorVars(s: RestaurantSettings) {
    document.documentElement.style.setProperty('--color-primary', s.primary_color ?? '#3B82F6');
    document.documentElement.style.setProperty('--color-accent', s.accent_color ?? '#F59E0B');
  }

  async function refreshSettings() {
    if (!currentSite) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .eq('site_id', currentSite.id);

    const merged = { ...defaultSettings };
    if (data) {
      for (const row of data) {
        const key = row.key as keyof RestaurantSettings;
        if (key in merged) {
          (merged as Record<string, unknown>)[key] = row.value;
        }
      }
    }
    setRawSettings(merged);
    applyColorVars(merged);
    setIsLoading(false);
  }

  async function updateSetting<K extends keyof RestaurantSettings>(key: K, value: RestaurantSettings[K]) {
    if (!currentSite) return;
    setRawSettings(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'primary_color' || key === 'accent_color') applyColorVars(next);
      return next;
    });
    await supabase
      .from('settings')
      .upsert(
        { site_id: currentSite.id, key, value: value as unknown, updated_at: new Date().toISOString() },
        { onConflict: 'site_id,key' }
      );
  }

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSetting, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
