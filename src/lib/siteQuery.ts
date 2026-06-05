// Utility to always filter Supabase queries by the current site_id
// Import and use getSiteId() before every query in pages/components

import { useTenant } from '../context/TenantContext';

export function useSiteId(): string | null {
  const { currentSite } = useTenant();
  return currentSite?.id ?? null;
}
