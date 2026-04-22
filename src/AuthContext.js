// AuthContext.js
// ============================================================
// AuthContext - จัดการสถานะ login ทั้งแอป
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as auth from './authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const profile = await auth.getMyProfile();
      setUser(profile);
    } catch (e) {
      console.log('Load profile error:', e);
      setUser(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadProfile();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    await auth.login(email, password);
    await loadProfile();
  };

  const register = async (formData) => {
    await auth.register(formData);
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth ต้องใช้ภายใน AuthProvider');
  return ctx;
}