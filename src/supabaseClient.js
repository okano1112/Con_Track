// src/supabaseClient.js
// ============================================================
// ตั้งค่า Supabase สำหรับ React Native
// ============================================================

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// 🔑 ใส่ค่าจาก Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://vpozmjbsjqvpbjsfrdkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb3ptamJzanF2cGJqc2ZyZGtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTE2NjksImV4cCI6MjA5MTkyNzY2OX0.77qRijKrVQc3vD2cW6FLmgAM5giHJ4HSC8Q1qXx3cjY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});