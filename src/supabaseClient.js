// supabaseClient.js
// ============================================================
// ตั้งค่า Supabase สำหรับ React Native
// ============================================================

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vpozmjbsjqvpbjsfrdkg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Cg_qjYhLVnKSJUl_nNS0ig_-pxlP4FK';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});