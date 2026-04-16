// src/authService.js
// ============================================================
// ฟังก์ชัน Auth ทั้งหมด: register, login, logout, resetPassword
// ใช้ Supabase Auth ซึ่งจะ hash password และจัดการ session ให้อัตโนมัติ
// ============================================================

import { supabase } from './supabaseClient';

// ============================================================
// 🔍 ตรวจสอบรูปแบบ Custom ID (เหมือน Line ID)
// - ตัวพิมพ์เล็ก a-z
// - ตัวเลข 0-9
// - อักขระ . _ -
// - ความยาว 4-20 ตัว
// ============================================================
export function validateCustomId(customId) {
  const regex = /^[a-z0-9._-]{4,20}$/;
  if (!customId) return 'กรุณากรอก ID';
  if (!regex.test(customId)) {
    return 'ID ต้องเป็น a-z, 0-9, . _ - ความยาว 4-20 ตัว';
  }
  return null; // ผ่าน
}

// ============================================================
// 🔍 ตรวจสอบ email
// ============================================================
export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'กรุณากรอกอีเมล';
  if (!regex.test(email)) return 'รูปแบบอีเมลไม่ถูกต้อง (ต้องมี @ และ .com)';
  return null;
}

// ============================================================
// 🔍 ตรวจสอบ password ความแข็งแรง
// ============================================================
export function validatePassword(password) {
  if (!password) return 'กรุณากรอกรหัสผ่าน';
  if (password.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว';
  return null;
}

// ============================================================
// 🔍 เช็คว่า custom_id ซ้ำกับคนอื่นไหม (เรียลไทม์)
// ============================================================
export async function checkCustomIdAvailable(customId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('custom_id')
    .eq('custom_id', customId)
    .maybeSingle();

  if (error) throw error;
  return !data; // ถ้าไม่เจอ = ใช้ได้
}

// ============================================================
// 📝 สมัครสมาชิกใหม่
// ============================================================
export async function register({
  email,
  password,
  customId,
  fullName,
  phone,
  address,
  avatarUrl,
}) {
  // 1. เช็ค custom_id ว่าซ้ำไหม
  const available = await checkCustomIdAvailable(customId);
  if (!available) {
    throw new Error(`ID "${customId}" มีคนใช้แล้ว กรุณาเลือกใหม่`);
  }

  // 2. สมัครกับ Supabase Auth
  //    ส่งข้อมูลเพิ่มเติมผ่าน options.data → trigger จะเอาไปสร้าง profile อัตโนมัติ
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        custom_id: customId,
        full_name: fullName,
        phone: phone || '',
        address: address || '',
        avatar_url: avatarUrl || '',
      },
    },
  });

  if (error) {
    // แปล error message ให้เป็นภาษาไทย
    if (error.message.includes('already registered')) {
      throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
    }
    throw new Error(error.message);
  }

  return data.user;
}

// ============================================================
// 🔑 เข้าสู่ระบบ
// ============================================================
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    if (error.message.includes('Email not confirmed')) {
      throw new Error('กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
    }
    throw new Error(error.message);
  }

  return data.user;
}

// ============================================================
// 🚪 ออกจากระบบ
// ============================================================
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ============================================================
// 🔄 ขอรีเซ็ตรหัสผ่าน (Supabase ส่งอีเมลให้เอง ฟรี)
// ============================================================
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'contrack://reset-password', // deep link กลับเข้าแอป
  });

  if (error) throw new Error(error.message);
}

// ============================================================
// 🔐 ตั้งรหัสผ่านใหม่ (หลังคลิกลิงก์ในอีเมล)
// ============================================================
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw new Error(error.message);
}

// ============================================================
// 👤 ดึงข้อมูล profile ของผู้ใช้ปัจจุบัน
// ============================================================
export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return { ...data, email: user.email };
}

// ============================================================
// ✏️ อัปเดต profile
// ============================================================
export async function updateProfile({ fullName, phone, address, avatarUrl }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      address,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) throw error;
}

// ============================================================
// 📤 ส่งอีเมลยืนยันอีกครั้ง (กรณีไม่ได้รับครั้งแรก)
// ============================================================
export async function resendVerifyEmail(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
  });

  if (error) throw new Error(error.message);
}