import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

type Row = Record<string, unknown>;

interface Options<T extends Row> {
  table: string;
  siteId: string | null;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T) => void;
  onDelete?: (row: T) => void;
  /**
   * Called when the realtime subscription needs to re-sync after a
   * reconnection (app returned to foreground, network restored, or
   * channel error). Use this to reload full table data from the server
   * so changes missed during the disconnection are recovered.
   */
  onReconnect?: () => void;
}

/**
 * Subscribes to Supabase Realtime changes on a table filtered by site_id.
 * Calls the appropriate handler on INSERT / UPDATE / DELETE events.
 *
 * Automatically re-syncs when:
 *  - The app returns to the foreground (visibilitychange)
 *  - The browser regains network access (online event)
 *  - The websocket channel errors or closes unexpectedly
 */
export function useRealtimeTable<T extends Row>({
  table,
  siteId,
  onInsert,
  onUpdate,
  onDelete,
  onReconnect,
}: Options<T>) {
  const handlersRef = useRef({ onInsert, onUpdate, onDelete, onReconnect });
  handlersRef.current = { onInsert, onUpdate, onDelete, onReconnect };

  const reconnectRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!siteId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let destroyed = false;

    function subscribe() {
      if (destroyed) return;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      channel = supabase
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
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setTimeout(() => {
              if (destroyed) return;
              subscribe();
              handlersRef.current.onReconnect?.();
            }, 1500);
          }
        });
    }

    function resync() {
      if (destroyed || !channel) return;
      subscribe();
      handlersRef.current.onReconnect?.();
    }

    reconnectRef.current = resync;

    subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };
    const handleOnline = () => resync();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      destroyed = true;
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [table, siteId]);
}
