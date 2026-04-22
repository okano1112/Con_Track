// utils.js
// ============================================================
// ฟังก์ชันช่วยเหลือทั่วไป
// ============================================================

import * as Crypto from 'expo-crypto';

// สร้าง UUID v4
export function newUUID() {
  return Crypto.randomUUID();
}

// เวลาปัจจุบันเป็น ISO string
export function now() {
  return new Date().toISOString();
}

// เช็คว่า object แรกใหม่กว่าไหม
export function isNewer(a, b) {
  if (!a?.updated_at) return false;
  if (!b?.updated_at) return true;
  return new Date(a.updated_at) > new Date(b.updated_at);
}