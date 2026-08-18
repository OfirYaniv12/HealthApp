import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return null;
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      // Ignore
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
