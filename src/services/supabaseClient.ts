import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://kfgsksteuyhqtsigvtyx.supabase.co';
const supabaseAnonKey: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_H7-1NDfaP9UOmiP2BFeLFA_H8ER3RLW';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')
);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

