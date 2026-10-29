import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_KEY belum diisi di file .env');
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Login Google memakai PKCE; di web hasil login dibaca langsung dari alamat halaman
    flowType: 'pkce',
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Refresh token hanya saat app sedang dibuka
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
