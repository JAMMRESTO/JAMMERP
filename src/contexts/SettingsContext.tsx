import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { loadBusinessHours } from '../lib/businessDay';

export interface AppSettings {
  highPerformanceMode: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoRetryPrinting: boolean;
  expressMode: boolean;
  autoDispatchCashier: boolean;
}

const defaults: AppSettings = {
  highPerformanceMode: false,
  soundEnabled: true,
  vibrationEnabled: true,
  autoRetryPrinting: true,
  expressMode: false,
  autoDispatchCashier: true,
};

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaults);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('key, value');
    if (data) {
      const parsed = { ...defaults };
      for (const row of data) {
        if (row.key in parsed) {
          (parsed as any)[row.key] = row.value === 'true';
        }
      }
      setSettings(parsed);
    }
    await loadBusinessHours();
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await supabase.from('app_settings')
      .upsert({ key: key as string, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
