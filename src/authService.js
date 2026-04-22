// authService.js — FIX: เพิ่ม validatePhone + profile fallback
import { supabase } from './supabaseClient';

export function validateCustomId(customId) {
  const regex = /^[a-z0-9._-]{4,20}$/;
  if (!customId) return 'กรุณากรอก ID';
  if (!regex.test(customId)) return 'ID ต้องเป็น a-z, 0-9, . _ - ความยาว 4-20 ตัว';
  return null;
}

export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'กรุณากรอกอีเมล';
  if (!regex.test(email)) return 'รูปแบบอีเมลไม่ถูกต้อง';
  return null;
}

export function validatePassword(password) {
  if (!password) return 'กรุณากรอกรหัสผ่าน';
  if (password.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว';
  return null;
}

// ✅ FIX BUG: ฟังก์ชันนี้ขาดหายไปทำให้ RegisterScreen crash
export function validatePhone(phone) {
  if (!phone || !phone.trim()) return 'กรุณากรอกเบอร์โทร';
  const cleaned = phone.replace(/[-\s()]/g, '');
  if (!/^0[0-9]{8,9}$/.test(cleaned)) return 'เบอร์โทรไม่ถูกต้อง (ขึ้นต้น 0 มี 9-10 หลัก)';
  return null;
}

export async function checkCustomIdAvailable(customId) {
  const { data, error } = await supabase.from('profiles').select('custom_id').eq('custom_id', customId).maybeSingle();
  if (error) throw error;
  return !data;
}

export async function register({ email, password, customId, fullName, phone, address, avatarUrl }) {
  const available = await checkCustomIdAvailable(customId);
  if (!available) throw new Error(`ID "${customId}" มีคนใช้แล้ว`);

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { custom_id: customId, full_name: fullName, phone: phone || '', address: address || '', avatar_url: avatarUrl || '' } },
  });
  if (error) {
    if (error.message.includes('already registered')) throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
    throw new Error(error.message);
  }
  return data.user;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('Invalid login credentials')) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    throw new Error(error.message);
  }
  return data.user;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'contrack://reset-password' });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) {
    const meta = user.user_metadata || {};
    return { id: user.id, email: user.email, full_name: meta.full_name || '', custom_id: meta.custom_id || '', phone: meta.phone || '', address: meta.address || '', avatar_url: meta.avatar_url || '' };
  }
  return { ...data, email: user.email };
}

export async function updateProfile({ fullName, phone, address, avatarUrl }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const updates = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) updates.full_name = fullName;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) throw error;
}