import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Caisse } from '../types/database';

function storageKey(userId: string) {
  return `ma_caisse_active_${userId}`;
}

function loadCaisseFromStorage(userId: string): Caisse | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as Caisse;
  } catch {
    return null;
  }
}

function saveCaisseToStorage(userId: string, c: Caisse) {
  localStorage.setItem(storageKey(userId), JSON.stringify(c));
}

export function useCaisse(userId: string | null, userRole?: string, organisationId?: string) {
  const [caisses, setCaisses] = useState<Caisse[]>([]);
  const [caisseActive, setCaisseActive] = useState<Caisse | null>(null);

  useEffect(() => {
    if (!userId) {
      setCaisses([]);
      setCaisseActive(null);
      return;
    }
    loadCaisses(userId);
  }, [userId, organisationId]);

  const loadCaisses = async (uid: string) => {
    // First, get the user's assigned caisse_id from their profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('caisse_id')
      .eq('id', uid)
      .maybeSingle();

    // Load caisses visible via RLS, filtered by current organisation
    let query = supabase.from('caisses').select('*').order('ordre');
    if (organisationId) {
      query = query.eq('organisation_id', organisationId);
    }
    const { data } = await query;
    const list = data ?? [];
    setCaisses(list);

    if (!list.length) return;

    // Determine active caisse:
    // 1. For caissiers: always use their assigned caisse (no choice)
    // 2. For admins: use their assigned caisse, or cached selection, or first in list
    let resolved: Caisse | null = null;

    if (profile?.caisse_id) {
      resolved = list.find(c => c.id === profile.caisse_id) ?? null;
    }

    if (!resolved && userRole === 'admin') {
      const cached = loadCaisseFromStorage(uid);
      resolved = (cached ? list.find(c => c.id === cached.id) : null) ?? list[0];
    }

    if (!resolved) {
      resolved = list[0];
    }

    setCaisseActive(resolved);
    saveCaisseToStorage(uid, resolved);
  };

  const selectCaisse = (caisse: Caisse) => {
    if (!userId) return;
    setCaisseActive(caisse);
    saveCaisseToStorage(userId, caisse);
  };

  const reload = () => { if (userId) loadCaisses(userId); };

  return { caisses, caisseActive, selectCaisse, reload };
}
