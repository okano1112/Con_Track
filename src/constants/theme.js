// src/constants/theme.js

export const COLORS = {
  primary: '#0F2654',
  primaryLight: '#1A3A7A',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  text: '#1F2937',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  
  bg: '#F3F4F6',
  bgWhite: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  tabActive: '#0F2654',
  tabInactive: '#9CA3AF',
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
};

export const STATUS_MAP = {
  planning: { label: 'วางแผน', color: '#6B7280', bg: '#F3F4F6' },
  active: { label: 'กำลังดำเนินการ', color: '#3B82F6', bg: '#DBEAFE' },
  on_hold: { label: 'ชะลอ', color: '#F59E0B', bg: '#FEF3C7' },
  completed: { label: 'เสร็จสิ้น', color: '#10B981', bg: '#D1FAE5' },
};

export const TASK_STATUS_MAP = {
  todo: { label: 'รอดำเนินการ', color: '#6B7280', bg: '#F3F4F6', icon: 'ellipse-outline' },
  in_progress: { label: 'กำลังทำ', color: '#3B82F6', bg: '#DBEAFE', icon: 'time-outline' },
  review: { label: 'รอตรวจสอบ', color: '#F59E0B', bg: '#FEF3C7', icon: 'eye-outline' },
  done: { label: 'เสร็จแล้ว', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle' },
};

export const PRIORITY_MAP = {
  low: { label: 'ต่ำ', color: '#6B7280', bg: '#F3F4F6' },
  medium: { label: 'ปานกลาง', color: '#3B82F6', bg: '#DBEAFE' },
  high: { label: 'สูง', color: '#F59E0B', bg: '#FEF3C7' },
  urgent: { label: 'เร่งด่วน', color: '#EF4444', bg: '#FEE2E2' },
};

export const DOC_CATEGORY_MAP = {
  blueprint: { label: 'แบบแปลน', icon: 'map-outline', color: '#3B82F6' },
  contract: { label: 'สัญญา', icon: 'document-text-outline', color: '#8B5CF6' },
  report: { label: 'รายงาน', icon: 'bar-chart-outline', color: '#10B981' },
  invoice: { label: 'ใบแจ้งหนี้', icon: 'receipt-outline', color: '#F59E0B' },
  photo: { label: 'รูปถ่าย', icon: 'camera-outline', color: '#EC4899' },
  other: { label: 'อื่นๆ', icon: 'folder-outline', color: '#6B7280' },
};
