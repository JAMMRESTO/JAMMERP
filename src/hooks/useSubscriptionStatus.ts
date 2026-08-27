import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Subscription } from '../lib/types';

const RESTAURANT_ID = '00000000-0000-0000-0000-000000000001';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface SubscriptionStatus {
  subscription: Subscription | null;
  isBlocked: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

function computeBlocked(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.plan?.name === 'FREE') return false;
  if (sub.status === 'expired') return true;
  if (sub.status === 'active' && sub.expires_at && new Date(sub.expires_at).getTime() < Date.now()) return true;
  return false;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    await supabase.rpc('check_expired_subscriptions');

    const { data } = await supabase
      .from('subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('restaurant_id', RESTAURANT_ID)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!mounted.current) return;
    setSubscription(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return {
    subscription,
    isBlocked: computeBlocked(subscription),
    loading,
    refresh,
  };
}
