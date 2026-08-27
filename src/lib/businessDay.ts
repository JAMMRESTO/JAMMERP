import { supabase } from './supabase';

let _cachedOpenHour: number | null = null;
let _cachedCloseHour: number | null = null;

export async function loadBusinessHours(): Promise<{ openHour: number; closeHour: number }> {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['business_open_hour', 'business_close_hour']);

  let openHour = 8;
  let closeHour = 3;

  if (data) {
    for (const row of data) {
      const val = parseInt(row.value, 10);
      if (!isNaN(val)) {
        if (row.key === 'business_open_hour') openHour = val;
        if (row.key === 'business_close_hour') closeHour = val;
      }
    }
  }

  _cachedOpenHour = openHour;
  _cachedCloseHour = closeHour;
  return { openHour, closeHour };
}

export function getCachedBusinessHours(): { openHour: number; closeHour: number } {
  return {
    openHour: _cachedOpenHour ?? 8,
    closeHour: _cachedCloseHour ?? 3,
  };
}

export function getBusinessDayRange(
  now: Date = new Date(),
  openHour = getCachedBusinessHours().openHour,
  closeHour = getCachedBusinessHours().closeHour,
): { start: Date; end: Date } {
  const h = now.getHours();

  // In-gap: we're between closeHour and openHour (e.g. 03h-08h).
  // Extend previous business day end to now so nothing is missed.
  const inGap = closeHour > 0 && h >= closeHour && h < openHour;

  if (inGap) {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(openHour, 0, 0, 0);
    const end = new Date(now);
    return { start, end };
  }

  // Normal: if before openHour (and after midnight past closeHour), we're in previous day's session
  const base = new Date(now);
  if (closeHour === 0 && h < openHour) {
    base.setDate(base.getDate() - 1);
  }

  const start = new Date(base);
  start.setHours(openHour, 0, 0, 0);

  const end = new Date(base);
  end.setDate(end.getDate() + 1);
  end.setHours(closeHour, 0, 0, 0);

  return { start, end };
}

export function getBusinessDayStart(
  now: Date = new Date(),
  openHour = getCachedBusinessHours().openHour,
  closeHour = getCachedBusinessHours().closeHour,
): Date {
  return getBusinessDayRange(now, openHour, closeHour).start;
}

export function formatBusinessHour(hour: number): string {
  if (hour === 0) return '00h00';
  return `${String(hour).padStart(2, '0')}h00`;
}
