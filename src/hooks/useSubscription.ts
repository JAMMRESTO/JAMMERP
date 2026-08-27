import { useState, useEffect, useCallback } from 'react';
import type { AppUser } from './useAuth';

const AUTH_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin`;

export interface Subscription {
  id: string;
  plan: string;
  date_debut: string;
  date_fin: string;
  actif: boolean;
  expired: boolean;
}

export function useSubscription(user: AppUser | null) {
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptionBlocked(false);
      setSubscription(null);
      return;
    }

    try {
      const res = await fetch(`${AUTH_FN_URL}/check-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ organisation_id: user.organisation_id || undefined }),
      });
      const data = await res.json();

      if (data?.subscription) {
        setSubscription(data.subscription);
        setSubscriptionBlocked(data.subscription.expired === true);
      } else {
        setSubscription(null);
        setSubscriptionBlocked(false);
      }
    } catch {
      setSubscriptionBlocked(false);
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return { subscriptionBlocked, subscription, refreshSubscription: checkSubscription };
}
