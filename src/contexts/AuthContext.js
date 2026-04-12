// src/contexts/AuthContext.js

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loginUser, registerUser, getUserById } from '../db';

const AuthContext = createContext(null);

const SESSION_KEY = 'ots_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ตรวจ session ตอนเปิดแอป
  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const stored = await SecureStore.getItemAsync(SESSION_KEY);
      if (stored) {
        const { userId } = JSON.parse(stored);
        const userData = await getUserById(userId);
        if (userData) {
          setUser(userData);
        } else {
          await SecureStore.deleteItemAsync(SESSION_KEY);
        }
      }
    } catch (e) {
      console.log('Session load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const userData = await loginUser(username, password);
    setUser(userData);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ userId: userData.id }));
    return userData;
  }

  async function register(data) {
    const newUser = await registerUser(data);
    // ล็อกอินอัตโนมัติหลังสมัคร
    const userData = await getUserById(newUser.id);
    setUser(userData);
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ userId: userData.id }));
    return userData;
  }

  async function logout() {
    setUser(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  async function refreshUser() {
    if (user?.id) {
      const updated = await getUserById(user.id);
      setUser(updated);
    }
  }

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
