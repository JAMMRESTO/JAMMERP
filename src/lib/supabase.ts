import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey);

export function forceCloseApp() {
  supabase.auth.signOut().catch(() => {});
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace('/');
}
