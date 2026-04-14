import React from 'react';
import { TouchableOpacity, Text, View, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// สีหลักของแอป — แก้ตรงนี้ที่เดียว
export const C = {
  primary: '#0F2654',    // navy
  accent: '#F59E0B',     // orange
  success: '#10B981',
  danger: '#EF4444',
  info: '#3B82F6',
  text: '#1F2937',
  textLight: '#9CA3AF',
  textSec: '#6B7280',
  bg: '#F3F4F6',
  white: '#FFFFFF',
  border: '#E5E7EB',
};

// ============================================================
// Button — ปุ่มหลัก
// variant: 'primary' | 'outline' | 'danger'
// ============================================================
export function Button({ title, onPress, variant = 'primary', icon, loading, style }) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const bg = isPrimary ? C.primary : isDanger ? C.danger : 'transparent';
  const txt = isPrimary || isDanger ? '#fff' : C.primary;
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} activeOpacity={0.7}
      style={[{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: bg, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20,
        borderWidth: variant === 'outline' ? 1.5 : 0, borderColor: C.primary,
        opacity: loading ? 0.6 : 1,
      }, style]}>
      {loading ? <ActivityIndicator color={txt} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={txt} style={{ marginRight: 8 }} />}
          <Text style={{ color: txt, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// Card — กล่องขาวมีเงา
// ============================================================
export function Card({ children, style, onPress }) {
  const W = onPress ? TouchableOpacity : View;
  return (
    <W onPress={onPress} activeOpacity={0.7} style={[{
      backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08,
      shadowRadius: 2, elevation: 2,
    }, style]}>
      {children}
    </W>
  );
}

// ============================================================
// Header — แถบด้านบนสีน้ำเงิน
// ============================================================
export function Header({ title, onBack, rightIcon, onRight, subtitle }) {
  return (
    <View style={{
      backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
      flexDirection: 'row', alignItems: 'center',
    }}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12, padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{title}</Text>
        {subtitle && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {rightIcon && (
        <TouchableOpacity onPress={onRight} style={{ padding: 4 }}>
          <Ionicons name={rightIcon} size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================
// Input — ช่องกรอกข้อมูล
// ============================================================
export function Input({ label, value, onChangeText, placeholder, multiline, keyboardType, secureTextEntry, icon, error }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>{label}</Text>}
      <View style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
        borderRadius: 10, borderWidth: 1, borderColor: error ? C.danger : C.border, paddingHorizontal: 12,
      }}>
        {icon && <Ionicons name={icon} size={18} color={C.textLight} style={{ marginRight: 8 }} />}
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={C.textLight} multiline={multiline} keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          style={{
            flex: 1, fontSize: 15, color: C.text, paddingVertical: multiline ? 12 : 14,
            minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : 'center',
          }} />
      </View>
      {error && <Text style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

// ============================================================
// Badge — ป้ายเล็กๆ แสดงสถานะ
// ============================================================
export function Badge({ label, color, bg }) {
  return (
    <View style={{ backgroundColor: bg || '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: color || C.textSec }}>{label}</Text>
    </View>
  );
}

// ============================================================
// ProgressBar — แถบความคืบหน้า
// ============================================================
export function ProgressBar({ progress = 0, color, height = 8, style }) {
  const c = color || (progress >= 80 ? C.success : progress >= 40 ? C.accent : C.info);
  return (
    <View style={[{ height, backgroundColor: '#E5E7EB', borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <View style={{ width: `${Math.min(progress, 100)}%`, height: '100%', backgroundColor: c, borderRadius: height / 2 }} />
    </View>
  );
}

// ============================================================
// Empty — แสดงเมื่อไม่มีข้อมูล
// ============================================================
export function Empty({ icon, title, subtitle }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Ionicons name={icon || 'file-tray-outline'} size={48} color={C.textLight} />
      <Text style={{ fontSize: 16, fontWeight: '600', color: C.textSec, marginTop: 12 }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 13, color: C.textLight, marginTop: 6, textAlign: 'center' }}>{subtitle}</Text>}
    </View>
  );
}

// ============================================================
// Maps สถานะ — ใช้แปลงค่าจาก DB เป็นภาษาไทย + สี
// ============================================================
export const STATUS = {
  planning: { label: 'วางแผน', color: '#6B7280', bg: '#F3F4F6' },
  active: { label: 'กำลังดำเนินการ', color: '#3B82F6', bg: '#DBEAFE' },
  on_hold: { label: 'ชะลอ', color: '#F59E0B', bg: '#FEF3C7' },
  completed: { label: 'เสร็จสิ้น', color: '#10B981', bg: '#D1FAE5' },
};

export const TASK_STATUS = {
  todo: { label: 'รอดำเนินการ', color: '#6B7280', bg: '#F3F4F6' },
  in_progress: { label: 'กำลังทำ', color: '#3B82F6', bg: '#DBEAFE' },
  review: { label: 'รอตรวจสอบ', color: '#F59E0B', bg: '#FEF3C7' },
  done: { label: 'เสร็จแล้ว', color: '#10B981', bg: '#D1FAE5' },
};

export const PRIORITY = {
  low: { label: 'ต่ำ', color: '#6B7280', bg: '#F3F4F6' },
  medium: { label: 'ปานกลาง', color: '#3B82F6', bg: '#DBEAFE' },
  high: { label: 'สูง', color: '#F59E0B', bg: '#FEF3C7' },
  urgent: { label: 'เร่งด่วน', color: '#EF4444', bg: '#FEE2E2' },
};

export const DOC_CAT = {
  blueprint: { label: 'แบบแปลน', icon: 'map-outline', color: '#3B82F6' },
  contract: { label: 'สัญญา', icon: 'document-text-outline', color: '#8B5CF6' },
  report: { label: 'รายงาน', icon: 'bar-chart-outline', color: '#10B981' },
  invoice: { label: 'ใบแจ้งหนี้', icon: 'receipt-outline', color: '#F59E0B' },
  photo: { label: 'รูปถ่าย', icon: 'camera-outline', color: '#EC4899' },
  other: { label: 'อื่นๆ', icon: 'folder-outline', color: '#6B7280' },
};

// ตำแหน่งช่างในไซต์ก่อสร้าง
export const WORKER_ROLES = [
  'ช่างไม้', 'ช่างก่อ', 'ช่างฉาบ', 'ช่างเหล็ก/ผูกเหล็ก', 'ช่างปูน/เทปูน',
  'ช่างไฟฟ้า', 'ช่างประปา', 'ช่างแอร์', 'ช่างฝ้าเพดาน', 'ช่างกระเบื้อง',
  'ช่างทาสี', 'ช่างเชื่อม', 'ช่างกระจก/อลูมิเนียม', 'ช่างหลังคา',
  'ช่างสำรวจ', 'คนงานทั่วไป', 'ผู้ควบคุมเครื่องจักร', 'อื่นๆ',
];