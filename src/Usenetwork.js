// src/useNetwork.js
// ============================================================
// Hook สำหรับเช็คว่ามีเน็ตอยู่ไหม
// ใช้ใน component: const { isOnline } = useNetwork();
// ============================================================

import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // เช็คครั้งแรก
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected && state.isInternetReachable !== false);
    });

    // subscribe การเปลี่ยนสถานะ
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  return { isOnline };
}

// ============================================================
// ฟังก์ชันเช็คเน็ตแบบ one-shot (ไม่ใช่ hook)
// ใช้ใน syncEngine
// ============================================================
export async function checkOnline() {
  const state = await NetInfo.fetch();
  return state.isConnected && state.isInternetReachable !== false;
}