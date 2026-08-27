import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtimeRefresh(
  tables: string[],
  companyId: string,
  onRefresh: () => void,
  pollingInterval = 60000
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function debouncedRefresh() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onRefreshRef.current();
    }, 800);
  }

  useEffect(() => {
    if (!companyId) return;

    const tablesKey = tables.join('-');
    const channel = supabase.channel(`rt-${companyId}-${tablesKey}`);

    for (const table of tables) {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter: `company_id=eq.${companyId}` },
        () => { debouncedRefresh(); }
      );
    }

    channel.subscribe();

    const timer = setInterval(() => {
      onRefreshRef.current();
    }, pollingInterval);

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        onRefreshRef.current();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyId, tables.join(','), pollingInterval]);
}
