import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    reconnectAfterMs: (tries: number) => Math.min(500 * (tries + 1), 10000),
    heartbeatIntervalMs: 15000,
    timeout: 20000,
  },
});
