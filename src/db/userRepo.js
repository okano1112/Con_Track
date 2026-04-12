// src/db/userRepo.js
// ============================================================
// User CRUD + Auth (Local)
// ============================================================

import { getDatabase } from './database';
import * as Crypto from 'expo-crypto';

// ============================================================
// Password Hashing (SHA-256)
// ============================================================
async function hashPassword(password) {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + '_ots_salt_2024'
  );
}

// ============================================================
// Auth Functions
// ============================================================
export async function registerUser({ username, password, fullName, position, department, phone }) {
  const db = await getDatabase();

  // เช็ค username ซ้ำ
  const existing = await db.getFirstAsync(
    'SELECT id FROM users WHERE username = ?',
    [username.toLowerCase().trim()]
  );
  if (existing) {
    throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  }

  const passwordHash = await hashPassword(password);

  const result = await db.runAsync(
    `INSERT INTO users (username, password_hash, full_name, position, department, phone)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      username.toLowerCase().trim(),
      passwordHash,
      fullName.trim(),
      position?.trim() || '',
      department?.trim() || '',
      phone?.trim() || '',
    ]
  );

  return { id: result.lastInsertRowId, username: username.toLowerCase().trim(), fullName };
}

export async function loginUser(username, password) {
  const db = await getDatabase();
  const passwordHash = await hashPassword(password);

  const user = await db.getFirstAsync(
    'SELECT * FROM users WHERE username = ? AND password_hash = ?',
    [username.toLowerCase().trim(), passwordHash]
  );

  if (!user) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  return user;
}

export async function setPinForUser(userId, pin) {
  const db = await getDatabase();
  const pinHash = await hashPassword(pin);
  await db.runAsync(
    'UPDATE users SET pin_hash = ?, updated_at = datetime("now","localtime") WHERE id = ?',
    [pinHash, userId]
  );
}

export async function verifyPin(userId, pin) {
  const db = await getDatabase();
  const pinHash = await hashPassword(pin);
  const user = await db.getFirstAsync(
    'SELECT id FROM users WHERE id = ? AND pin_hash = ?',
    [userId, pinHash]
  );
  return !!user;
}

// ============================================================
// Profile CRUD
// ============================================================
export async function getUserById(userId) {
  const db = await getDatabase();
  return await db.getFirstAsync('SELECT * FROM users WHERE id = ?', [userId]);
}

export async function updateUserProfile(userId, { fullName, position, department, phone, avatarUri }) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE users SET 
      full_name = COALESCE(?, full_name),
      position = COALESCE(?, position),
      department = COALESCE(?, department),
      phone = COALESCE(?, phone),
      avatar_uri = COALESCE(?, avatar_uri),
      is_synced = 0,
      updated_at = datetime('now','localtime')
     WHERE id = ?`,
    [fullName, position, department, phone, avatarUri, userId]
  );
  return await getUserById(userId);
}

export async function getAllUsers() {
  const db = await getDatabase();
  return await db.getAllAsync('SELECT id, username, full_name, position, department, role FROM users ORDER BY full_name');
}

export async function changePassword(userId, oldPassword, newPassword) {
  const db = await getDatabase();
  const oldHash = await hashPassword(oldPassword);
  
  const user = await db.getFirstAsync(
    'SELECT id FROM users WHERE id = ? AND password_hash = ?',
    [userId, oldHash]
  );
  if (!user) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');

  const newHash = await hashPassword(newPassword);
  await db.runAsync(
    'UPDATE users SET password_hash = ?, updated_at = datetime("now","localtime") WHERE id = ?',
    [newHash, userId]
  );
}
