import { useState, useEffect, useCallback, useRef } from 'react';
import { CartItem, Table } from '../lib/types';

export interface PendingOrder {
  id: string;
  table: Table;
  cart: CartItem[];
  userId: string;
  createdAt: string;
  retries: number;
}

const STORAGE_KEY = 'restobar_offline_queue';

function loadQueue(): PendingOrder[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingOrder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useOfflineQueue(onSync: (order: PendingOrder) => Promise<boolean>) {
  const [queue, setQueue] = useState<PendingOrder[]>(loadQueue);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const syncRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const enqueue = useCallback((order: Omit<PendingOrder, 'id' | 'createdAt' | 'retries'>) => {
    const newOrder: PendingOrder = {
      ...order,
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    setQueue(prev => {
      const next = [...prev, newOrder];
      saveQueue(next);
      return next;
    });
    return newOrder.id;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => {
      const next = prev.filter(o => o.id !== id);
      saveQueue(next);
      return next;
    });
  }, []);

  const syncAll = useCallback(async () => {
    if (syncRef.current || !isOnline) return;
    const current = loadQueue();
    if (current.length === 0) return;
    syncRef.current = true;
    setSyncing(true);
    for (const order of current) {
      try {
        const success = await onSync(order);
        if (success) {
          setQueue(prev => {
            const next = prev.filter(o => o.id !== order.id);
            saveQueue(next);
            return next;
          });
        } else {
          setQueue(prev => {
            const next = prev.map(o => o.id === order.id ? { ...o, retries: o.retries + 1 } : o);
            saveQueue(next);
            return next;
          });
        }
      } catch {
        setQueue(prev => {
          const next = prev.map(o => o.id === order.id ? { ...o, retries: o.retries + 1 } : o);
          saveQueue(next);
          return next;
        });
      }
    }
    syncRef.current = false;
    setSyncing(false);
  }, [isOnline, onSync]);

  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncAll();
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline || queue.length === 0) return;
    const interval = setInterval(syncAll, 10000);
    return () => clearInterval(interval);
  }, [isOnline, queue.length, syncAll]);

  return { queue, isOnline, syncing, enqueue, removeFromQueue, syncAll };
}
