import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// The publishable key is public by design; row-level security guards the data.
export const supabase = createClient(
  'https://qzowucyfrsrtxwusymwe.supabase.co',
  'sb_publishable_JWaErkJVoe26Y8Zv_qMVrg_bPmcyD8v',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
