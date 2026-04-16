// src/AuthContext.js
// ============================================================
// AuthContext - จัดการสถานะ login ทั้งแอป
// ใช้ Supabase Auth ที่จำ session ให้อัตโนมัติ
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as auth from './authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // ข้อมูล user + profile
  const [loading, setLoading] = useState(true); // กำลังโหลด session แรก

  // ============================================================
  // โหลดข้อมูล profile เมื่อ user เปลี่ยน
  // ============================================================
  const loadProfile = async () => {
    try {
      const profile = await auth.getMyProfile();
      setUser(profile);
    } catch (e) {
      console.log('Load profile error:', e);
      setUser(null);
    }
  };

  // ============================================================
  // ตอนเปิดแอป → เช็คว่ามี session ค้างไหม
  // ============================================================
  useEffect(() => {
    // เช็ค session ครั้งแรก
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // ฟัง event การเปลี่ยน auth state (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadProfile();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ============================================================
  // ฟังก์ชันให้ screen เรียกใช้
  // ============================================================
  const login = async (email, password) => {
    await auth.login(email, password);
    await loadProfile();
  };

  const register = async (formData) => {
    await auth.register(formData);
    // หลัง register แล้วต้องให้ user ยืนยันอีเมลก่อน (ขึ้นอยู่กับ setting)
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    await loadProfile();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Hook สำหรับใช้ใน component
// ============================================================
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ต้องใช้ภายใน AuthProvider');
  return ctx;
}