import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

type Row = Record<string, unknown>;

interface Options<T extends Row> {
  table: string;
  siteId: string | null;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T) => void;
  onDelete?: (row: T) => void;
}

/**
 * Subscribes to Supabase Realtime changes on a table filtered by site_id.
 * Calls the appropriate handler on INSERT / UPDATE / DELETE events.
 */
export function useRealtimeTable<T extends Row>({
  table,
  siteId,
  onInsert,
  onUpdate,
  onDelete,
}: Options<T>) {
  const handlersRef = useRef({ onInsert, onUpdate, onDelete });
  handlersRef.current = { onInsert, onUpdate, onDelete };

  useEffect(() => {
    if (!siteId) return;

    const channel = supabase
      .channel(`realtime:${table}:${siteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `site_id=eq.${siteId}` },
        (payload) => handlersRef.current.onInsert?.(payload.new as T),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `site_id=eq.${siteId}` },
        (payload) => handlersRef.current.onUpdate?.(payload.new as T),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table, filter: `site_id=eq.${siteId}` },
        (payload) => handlersRef.current.onDelete?.(payload.old as T),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, siteId]);
}
