import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// เปลี่ยน 2 บรรทัดนี้เป็นค่าจากโปรเจกต์ Supabase ของคุณ (ในหน้า Project Settings -> API)
const supabaseUrl = 'https://igielyrjpnqycxvpwfsn.supabase.co';
const supabaseAnonKey = 'sb_publishable_0IjqGh-DPidwxne4VlW3hw_DcEIGvok';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});