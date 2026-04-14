import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as dbLogin, register as dbRegister, getUserById } from './db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ตอนเปิดแอป → เช็คว่าเคย login ไว้ไหม
  useEffect(() => {
    AsyncStorage.getItem('userId').then(async (id) => {
      if (id) {
        const u = await getUserById(parseInt(id));
        if (u) setUser(u);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const u = await dbLogin(username, password);
    setUser(u);
    await AsyncStorage.setItem('userId', String(u.id));
    return u;
  };

  const register = async (data) => {
    const result = await dbRegister(data.username, data.password, data.fullName, data.position, data.department, data.phone);
    const u = await getUserById(result.id);
    setUser(u);
    await AsyncStorage.setItem('userId', String(u.id));
    return u;
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('userId');
  };

  const refreshUser = async () => {
    if (user?.id) {
      const u = await getUserById(user.id);
      setUser(u);
    }
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