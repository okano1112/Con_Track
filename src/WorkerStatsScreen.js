// src/WorkerStatsScreen.js
// ============================================================
// หน้าสถิติและประเมินช่าง (อัปเดต: เพิ่มระบบ Normal Curve)
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, RefreshControl, Image, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C, Card, Badge, ProgressBar, Button, Input, Empty } from './Components';
import { getWorkersWithRecords, insertWorker, insertWorkerRecord, deleteWorker } from './db';

// 🌟 Import คอมโพเนนต์ Normal Curve
import {
  IndividualSkillCurve,
  CollectivePerformanceCurve,
  MiniSkillIndicator,
  calculateStats,
  calculateZScore,
  zScoreToPercentile,
  getSkillLevel
} from './NormalCurveComponents';

const ROLES = ['ช่างไม้', 'ช่างก่อ', 'ช่างฉาบ', 'ช่างเหล็ก/ผูกเหล็ก', 'ช่างปูน/เทปูน', 'ช่างไฟฟ้า', 'ช่างประปา', 'ช่างแอร์', 'ช่างฝ้าเพดาน', 'ช่างกระเบื้อง', 'ช่างทาสี', 'ช่างเชื่อม', 'คนงานทั่วไป', 'อื่นๆ'];
const GENDERS = ['ชาย', 'หญิง'];
const EMPLOYMENT_STATUSES = ['พนักงานประจำ', 'พนักงานรายวัน', 'ผู้รับเหมาช่วง'];
const OT_HOURS_OPTIONS = ['0', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '7', '8'];

// ============================================================
// 🌟 ค่ามาตรฐาน Productivity แรงงานก่อสร้างไทย
// ============================================================
// แหล่งอ้างอิง:
//   1. "สถิติการทำงานต่อวัน" โดย กลุ่มออกแบบและก่อสร้าง สำนักอำนวยการ สพฐ.
//      URL: http://design.obec.go.th/statwork.html
//   2. "บัญชีค่าแรงงาน/ดำเนินการ สำหรับการถอดแบบคำนวณราคากลางงานก่อสร้าง"
//      โดย กรมบัญชีกลาง กระทรวงการคลัง (ตุลาคม 2560)
//   3. "บัญชีราคาค่าวัสดุและค่าแรงงาน" โดย กลุ่มออกแบบและก่อสร้าง สพฐ. 
//      ปีงบประมาณ 2569
//
// หมายเหตุ:
//   - ค่า standard = ผลผลิตมาตรฐานต่อคน/วัน (8 ชม.)
//   - ค่า stdDev = ส่วนเบี่ยงเบนมาตรฐาน (ประมาณ 20-25% ของ standard)
//   - ค่าเหล่านี้เป็นค่าเฉลี่ยสำหรับช่างฝีมือระดับกลาง
// ============================================================

const WORK_TYPES = [
  // === งานโครงสร้าง ===
  {
    key: 'โครงสร้าง คสล.',
    icon: 'business-outline',
    color: '#3B82F6',
    ref: 'สพฐ./กรมบัญชีกลาง: 2.4-3.2 ลบ.ม./คน/วัน',
    standard: 2.8,      // ลบ.ม./คน/วัน (รวมงานแบบ+เหล็ก+เท)
    stdDev: 0.6,
    unit: 'ลบ.ม./วัน'
  },
  {
    key: 'ผูกเหล็ก',
    icon: 'construct-outline',
    color: '#2563EB',
    ref: 'สพฐ.: 150-200 กก./คน/วัน',
    standard: 175,      // กก./คน/วัน
    stdDev: 35,
    unit: 'กก./วัน'
  },
  {
    key: 'เทปูน',
    icon: 'cube-outline',
    color: '#8B5CF6',
    ref: 'สพฐ.: 3-5 ลบ.ม./คน/วัน',
    standard: 4,        // ลบ.ม./คน/วัน
    stdDev: 0.8,
    unit: 'ลบ.ม./วัน'
  },
  {
    key: 'ตั้งแบบ',
    icon: 'copy-outline',
    color: '#1D4ED8',
    ref: 'สพฐ.: 4-6 ตร.ม./คน/วัน',
    standard: 5,        // ตร.ม./คน/วัน
    stdDev: 1,
    unit: 'ตร.ม./วัน'
  },

  // === งานก่อฉาบ ===
  {
    key: 'ก่ออิฐมอญ',
    icon: 'grid-outline',
    color: '#F59E0B',
    ref: 'สพฐ.: 6-8 ตร.ม./คน/วัน (ครึ่งแผ่น)',
    standard: 7,        // ตร.ม./คน/วัน (ก่ออิฐมอญครึ่งแผ่น)
    stdDev: 1.5,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'ก่ออิฐบล็อก',
    icon: 'grid-outline',
    color: '#D97706',
    ref: 'สพฐ.: 8-12 ตร.ม./คน/วัน',
    standard: 10,       // ตร.ม./คน/วัน (ก่ออิฐบล็อก)
    stdDev: 2,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'ก่ออิฐมวลเบา',
    icon: 'grid-outline',
    color: '#B45309',
    ref: 'สพฐ.: 10-15 ตร.ม./คน/วัน',
    standard: 12,       // ตร.ม./คน/วัน (ก่ออิฐมวลเบา Q-CON)
    stdDev: 2.5,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'ฉาบปูน',
    icon: 'layers-outline',
    color: '#10B981',
    ref: 'สพฐ.: 8-12 ตร.ม./คน/วัน (หนา 1.5 ซม.)',
    standard: 10,       // ตร.ม./คน/วัน (ฉาบหนา 1.5 ซม.)
    stdDev: 2,
    unit: 'ตร.ม./วัน'
  },

  // === งานไม้ ===
  {
    key: 'งานไม้แบบ',
    icon: 'hammer-outline',
    color: '#EC4899',
    ref: 'สพฐ.: 4-6 ตร.ม./คน/วัน',
    standard: 5,        // ตร.ม./คน/วัน
    stdDev: 1,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'งานไม้คร่าว/โครง',
    icon: 'hammer-outline',
    color: '#DB2777',
    ref: 'สพฐ.: 10-15 ตร.ม./คน/วัน',
    standard: 12,       // ตร.ม./คน/วัน
    stdDev: 2.5,
    unit: 'ตร.ม./วัน'
  },

  // === งานระบบ ===
  {
    key: 'งานไฟฟ้า',
    icon: 'flash-outline',
    color: '#F97316',
    ref: 'สพฐ.: 8-12 จุด/คน/วัน',
    standard: 10,       // จุด/คน/วัน
    stdDev: 2,
    unit: 'จุด/วัน'
  },
  {
    key: 'งานประปา',
    icon: 'water-outline',
    color: '#06B6D4',
    ref: 'สพฐ.: 6-10 จุด/คน/วัน',
    standard: 8,        // จุด/คน/วัน
    stdDev: 1.5,
    unit: 'จุด/วัน'
  },

  // === งานตกแต่ง ===
  {
    key: 'งานทาสี',
    icon: 'color-palette-outline',
    color: '#10B981',
    ref: 'สพฐ.: 35-50 ตร.ม./คน/วัน (รองพื้น+ทับหน้า 2 รอบ)',
    standard: 40,       // ตร.ม./คน/วัน (งานทาสี 2 รอบ)
    stdDev: 8,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'งานกระเบื้องพื้น',
    icon: 'apps-outline',
    color: '#EC4899',
    ref: 'สพฐ.: 6-10 ตร.ม./คน/วัน',
    standard: 8,        // ตร.ม./คน/วัน (ปูกระเบื้องพื้น)
    stdDev: 1.5,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'งานกระเบื้องผนัง',
    icon: 'apps-outline',
    color: '#BE185D',
    ref: 'สพฐ.: 4-7 ตร.ม./คน/วัน',
    standard: 5.5,      // ตร.ม./คน/วัน (ปูกระเบื้องผนัง)
    stdDev: 1,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'งานฝ้าเพดาน',
    icon: 'resize-outline',
    color: '#A855F7',
    ref: 'สพฐ.: 10-15 ตร.ม./คน/วัน',
    standard: 12,       // ตร.ม./คน/วัน
    stdDev: 2.5,
    unit: 'ตร.ม./วัน'
  },

  // === งานเหล็ก/เชื่อม ===
  {
    key: 'งานเชื่อม',
    icon: 'flame-outline',
    color: '#EF4444',
    ref: 'สพฐ.: 15-25 เมตร/คน/วัน (เชื่อมเหล็กโครงสร้าง)',
    standard: 20,       // เมตร/คน/วัน
    stdDev: 4,
    unit: 'ม./วัน'
  },

  // === งานหลังคา ===
  {
    key: 'มุงหลังคาเมทัลชีท',
    icon: 'home-outline',
    color: '#6366F1',
    ref: 'สพฐ.: 20-30 ตร.ม./คน/วัน',
    standard: 25,       // ตร.ม./คน/วัน
    stdDev: 5,
    unit: 'ตร.ม./วัน'
  },
  {
    key: 'มุงหลังคากระเบื้อง',
    icon: 'home-outline',
    color: '#4F46E5',
    ref: 'สพฐ.: 10-15 ตร.ม./คน/วัน',
    standard: 12,       // ตร.ม./คน/วัน
    stdDev: 2.5,
    unit: 'ตร.ม./วัน'
  },

  // === อื่นๆ ===
  {
    key: 'อื่นๆ',
    icon: 'ellipsis-horizontal-outline',
    color: '#6B7280',
    ref: 'กำหนดเอง',
    standard: 10,
    stdDev: 2,
    unit: 'หน่วย/วัน'
  },
];

// ============================================================
// Helper Functions
// ============================================================
function calcAvg(records, field) {
  if (!records?.length) return 0;
  return Math.round((records.reduce((s, r) => s + (r[field] || 0), 0) / records.length) * 10) / 10;
}

// 🌟 ใหม่: คำนวณค่าเฉลี่ยตามประเภทงาน
function calcAvgByWorkType(records, workType, field) {
  const filtered = (records || []).filter(r => r.work_type === workType);
  if (!filtered.length) return 0;
  return Math.round((filtered.reduce((s, r) => s + (r[field] || 0), 0) / filtered.length) * 10) / 10;
}

function getGrade(avg) {
  if (avg >= 90) return { label: 'A', color: '#10B981', bg: '#D1FAE5' };
  if (avg >= 75) return { label: 'B', color: '#3B82F6', bg: '#DBEAFE' };
  if (avg >= 60) return { label: 'C', color: '#F59E0B', bg: '#FEF3C7' };
  if (avg >= 40) return { label: 'D', color: '#F97316', bg: '#FFEDD5' };
  return { label: 'F', color: '#EF4444', bg: '#FEE2E2' };
}

function getScore(worker) {
  return Math.round((calcAvg(worker.records, 'output') + calcAvg(worker.records, 'quality')) / 2);
}

// 🌟 หาประเภทงานหลักของช่าง (งานที่ทำบ่อยที่สุด)
function getMainWorkType(records) {
  if (!records || records.length === 0) return null;
  const counts = {};
  records.forEach(r => {
    counts[r.work_type] = (counts[r.work_type] || 0) + 1;
  });
  let maxType = null;
  let maxCount = 0;
  Object.entries(counts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  });
  return maxType;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const StarRating = ({ rating, onRatingChange }) => {
  return (
    <View style={{ flexDirection: 'row', marginVertical: 10, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onRatingChange(star)}>
          <Ionicons
            name={rating >= star ? 'star' : 'star-outline'}
            size={36}
            color={rating >= star ? '#F59E0B' : '#D1D5DB'}
            style={{ marginRight: 8 }}
          />
        </TouchableOpacity>
      ))}
      <Text style={{ fontSize: 16, marginLeft: 10, fontWeight: '700', color: '#0F2654' }}>
        {rating * 20}%
      </Text>
    </View>
  );
};
export default function WorkerStatsScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [activeTab, setActiveTab] = useState('individual');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 🌟 State สำหรับเลือกประเภทงานใน Dashboard (กราฟภาพรวม)
  const [dashboardWorkType, setDashboardWorkType] = useState('ผูกเหล็ก');

  const [pickerConfig, setPickerConfig] = useState({ visible: false, title: '', options: [], field: '', isMulti: false });

  const [workerForm, setWorkerForm] = useState({
    name: '', roles: [], customRole: '', age: '', phone: '', avatarUri: '',
    nationality: '', gender: 'ชาย', dailyWage: '', experienceYears: '', employmentStatus: 'พนักงานรายวัน'
  });

  const [recordForm, setRecordForm] = useState({
    workType: 'ผูกเหล็ก',
    date: new Date(),
    output: '',
    qualityStar: 5, // เก็บเป็นจำนวนดาวแทนเปอร์เซ็นต์
    otHours: '0'
  });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try { setWorkers(await getWorkersWithRecords()); }
    catch (e) { console.log('Load error:', e); }
  };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  // 🌟 ฟังก์ชันเตรียมข้อมูลสำหรับกราฟภาพรวมทีม
  const getTeamCurveData = (workType) => {
    const wt = WORK_TYPES.find(w => w.key === workType) || WORK_TYPES[0];

    // รวบรวมช่างที่มีสถิติในประเภทงานนี้
    const workersWithData = workers
      .map(w => {
        const avgOutput = calcAvgByWorkType(w.records, workType, 'output');
        if (avgOutput > 0) {
          return { id: w.id, name: w.name, output: avgOutput };
        }
        return null;
      })
      .filter(w => w !== null);

    return {
      workersWithData,
      mean: wt.standard,
      stdDev: wt.stdDev,
      unit: wt.unit
    };
  };

  const openPicker = (title, options, field, isMulti = false) => {
    setPickerConfig({ visible: true, title, options, field, isMulti });
  };

  const handleSelectPickerOption = (opt) => {
    if (pickerConfig.field === 'otHours') {
      setRecordForm(p => ({ ...p, otHours: opt }));
      setPickerConfig(p => ({ ...p, visible: false }));
      return;
    }

    if (pickerConfig.isMulti) {
      setWorkerForm(p => {
        const currentArr = p[pickerConfig.field] || [];
        const isSelected = currentArr.includes(opt);
        const newArr = isSelected ? currentArr.filter(x => x !== opt) : [...currentArr, opt];
        return { ...p, [pickerConfig.field]: newArr };
      });
    } else {
      setWorkerForm(p => ({ ...p, [pickerConfig.field]: opt }));
      setPickerConfig(p => ({ ...p, visible: false }));
    }
  };

  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์ในตั้งค่า');
      return;
    }
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await fn({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setWorkerForm(p => ({ ...p, avatarUri: result.assets[0].uri }));
    }
  };

  const handleAddWorker = async () => {
    if (!workerForm.name.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อพนักงาน');
    if (!workerForm.roles || workerForm.roles.length === 0) return Alert.alert('แจ้งเตือน', 'กรุณาเลือกตำแหน่งงานอย่างน้อย 1 ตำแหน่ง');
    if (!workerForm.nationality.trim()) return Alert.alert('แจ้งเตือน', 'กรุณาระบุสัญชาติ (บังคับ)');

    let finalRole = workerForm.roles.join(', ');
    if (workerForm.roles.includes('อื่นๆ') && workerForm.customRole.trim()) {
      finalRole = finalRole.replace('อื่นๆ', workerForm.customRole.trim());
    }

    setSaving(true);
    try {
      await insertWorker({
        name: workerForm.name.trim(),
        role: finalRole,
        nationality: workerForm.nationality.trim(),
        gender: workerForm.gender,
        age: parseInt(workerForm.age) || 0,
        dailyWage: parseFloat(workerForm.dailyWage) || 0,
        experienceYears: parseInt(workerForm.experienceYears) || 0,
        employmentStatus: workerForm.employmentStatus,
        phone: workerForm.phone.trim(),
        avatarUri: workerForm.avatarUri,
      });
      setWorkerForm({ name: '', roles: [], customRole: '', age: '', phone: '', avatarUri: '', nationality: '', gender: 'ชาย', dailyWage: '', experienceYears: '', employmentStatus: 'พนักงานรายวัน' });
      setShowAddWorker(false);
      await loadData();
      Alert.alert('สำเร็จ', 'เพิ่มพนักงานเรียบร้อย');
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setSaving(false); }
  };

  const handleAddRecord = async () => {
    if (!selectedWorker) return;
    const output = parseFloat(recordForm.output);
    const qualityPercent = recordForm.qualityStar * 20; // 🌟 คลาสคำนวณแปลงดาวเป็นเปอเซ็นต์
    if (isNaN(output)) return Alert.alert('แจ้งเตือน', 'กรุณากรอกตัวเลขปริมาณผลผลิต');
    if (output < 0) return Alert.alert('แจ้งเตือน', 'ตรวจสอบตัวเลขผลผลิต');

    const otHrs = parseFloat(recordForm.otHours) || 0;
    const workerWage = parseFloat(selectedWorker.daily_wage) || 0;
    const otAmount = (workerWage / 8) * 1.5 * otHrs;

    setSaving(true);
    try {
      const formattedDate = new Date(recordForm.date.getTime() - (recordForm.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      await insertWorkerRecord(selectedWorker.id, recordForm.workType, formattedDate, output, qualityPercent, otHrs, otAmount);

      setRecordForm({ workType: 'ผูกเหล็ก', date: new Date(), output: '', qualityStar: 5, otHours: '0' });
      setShowAddRecord(false);
      await loadData();
      Alert.alert('สำเร็จ', `บันทึกสถิติเรียบร้อย`);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (w) => {
    Alert.alert('ลบข้อมูล', `ต้องการลบประวัติของ "${w.name}" ทั้งหมด?`, [
      { text: 'ยกเลิก' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          await deleteWorker(w.id); setShowDetail(false); setSelectedWorker(null); await loadData();
        }
      },
    ]);
  };

  const Avatar = ({ worker, size = 48 }) => {
    if (worker.avatar_uri) {
      return <Image source={{ uri: worker.avatar_uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F3F4F6' }} />;
    }
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.5 }}>👷</Text>
      </View>
    );
  };

  const ranked = [...workers].map(w => ({ ...w, score: getScore(w) })).sort((a, b) => b.score - a.score);

  // ============================================================
  // RENDER: Custom Picker Modal
  // ============================================================
  const renderCustomPicker = () => (
    <Modal visible={pickerConfig.visible} transparent animationType="fade">
      <View style={s.pickerOverlay}>
        <View style={s.pickerBox}>
          <Text style={s.modalTitle}>{pickerConfig.title}</Text>
          <ScrollView style={{ maxHeight: 300, width: '100%', marginVertical: 10 }}>
            {pickerConfig.options.map(opt => {
              const isSelected = pickerConfig.field === 'otHours'
                ? recordForm.otHours === opt
                : (pickerConfig.isMulti ? (workerForm[pickerConfig.field] || []).includes(opt) : workerForm[pickerConfig.field] === opt);

              return (
                <TouchableOpacity key={opt} onPress={() => handleSelectPickerOption(opt)} style={s.pickerItem}>
                  <Text style={{ fontSize: 16, color: isSelected ? C.primary : C.text, fontWeight: isSelected ? '700' : '400' }}>
                    {opt} {pickerConfig.field === 'otHours' ? 'ชั่วโมง' : ''}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Button title="ตกลง/ปิด" onPress={() => setPickerConfig({ ...pickerConfig, visible: false })} style={{ width: '100%' }} />
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // RENDER: Add Worker Modal
  // ============================================================
  const renderAddWorkerModal = () => (
    <Modal visible={showAddWorker} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={[s.modal, { maxHeight: '90%' }]}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>เพิ่มพนักงานใหม่</Text>
            <TouchableOpacity onPress={() => setShowAddWorker(false)}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>

            <Input label="ชื่อ-นามสกุล *" value={workerForm.name} onChangeText={v => setWorkerForm(p => ({ ...p, name: v }))} placeholder="เช่น สมชาย ใจดี" icon="person-outline" />

            <Text style={s.label}>ตำแหน่งงาน (เลือกได้มากกว่า 1) *</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกตำแหน่งงาน', ROLES, 'roles', true)}>
              <Text style={s.dropdownTxt}>{workerForm.roles.length > 0 ? workerForm.roles.join(', ') : 'กดเพื่อเลือกตำแหน่ง'}</Text>
              <Ionicons name="chevron-down" size={18} color={C.textSec} />
            </TouchableOpacity>
            {workerForm.roles.includes('อื่นๆ') && (
              <Input label="ระบุตำแหน่ง" value={workerForm.customRole} onChangeText={v => setWorkerForm(p => ({ ...p, customRole: v }))} placeholder="กรอกตำแหน่ง" icon="create-outline" />
            )}

            <Input label="สัญชาติ *" value={workerForm.nationality} onChangeText={v => setWorkerForm(p => ({ ...p, nationality: v }))} placeholder="เช่น ไทย, เมียนมา" icon="flag-outline" />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>เพศ</Text>
                <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกเพศ', GENDERS, 'gender')}>
                  <Text style={s.dropdownTxt}>{workerForm.gender}</Text>
                  <Ionicons name="chevron-down" size={18} color={C.textSec} />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>สถานะการจ้าง</Text>
                <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('สถานะการจ้าง', EMPLOYMENT_STATUSES, 'employmentStatus')}>
                  <Text style={s.dropdownTxt}>{workerForm.employmentStatus}</Text>
                  <Ionicons name="chevron-down" size={18} color={C.textSec} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="อายุ (ปี)" value={workerForm.age} onChangeText={v => setWorkerForm(p => ({ ...p, age: v }))} keyboardType="numeric" icon="calendar-outline" /></View>
              <View style={{ flex: 1 }}><Input label="อายุงาน (ปี)" value={workerForm.experienceYears} onChangeText={v => setWorkerForm(p => ({ ...p, experienceYears: v }))} keyboardType="numeric" icon="briefcase-outline" /></View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="ค่าแรง (บ./วัน)" value={workerForm.dailyWage} onChangeText={v => setWorkerForm(p => ({ ...p, dailyWage: v }))} keyboardType="numeric" icon="cash-outline" /></View>
              <View style={{ flex: 1 }}><Input label="เบอร์โทรศัพท์" value={workerForm.phone} onChangeText={v => setWorkerForm(p => ({ ...p, phone: v }))} keyboardType="phone-pad" icon="call-outline" /></View>
            </View>

            <Button title="บันทึกข้อมูล" onPress={handleAddWorker} loading={saving} icon="checkmark-circle" style={{ marginTop: 8 }} />
            <Button title="ยกเลิก" variant="outline" onPress={() => setShowAddWorker(false)} style={{ marginTop: 8, marginBottom: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // RENDER: Add Record Modal
  // ============================================================
  const renderAddRecordModal = () => {
    const activeWork = WORK_TYPES.find(w => w.key === recordForm.workType) || WORK_TYPES[0];

    const workerWage = parseFloat(selectedWorker?.daily_wage) || 0;
    const otHrs = parseFloat(recordForm.otHours) || 0;
    const otPay = (workerWage / 8) * 1.5 * otHrs;
    const totalPay = workerWage + otPay;

    return (
      <Modal visible={showAddRecord} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modal, { maxHeight: '90%' }]}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>เพิ่มสถิติ — {selectedWorker?.name}</Text>
              <TouchableOpacity onPress={() => setShowAddRecord(false)}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>ประเภทงาน</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {WORK_TYPES.map(wt => {
                  const sel = recordForm.workType === wt.key;
                  return (
                    <TouchableOpacity key={wt.key} onPress={() => setRecordForm(p => ({ ...p, workType: wt.key }))}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? wt.color : '#F3F4F6', borderWidth: sel ? 0 : 1, borderColor: C.border }}>
                      <Text style={{ color: sel ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{wt.key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 🌟 แสดงมาตรฐานอ้างอิง */}
              {activeWork.ref && (
                <View style={{ backgroundColor: '#EFF6FF', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#3B82F6' }}>📊 {activeWork.ref}</Text>
                </View>
              )}

              <Text style={s.label}>วันที่ปฏิบัติงาน</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={s.dateBtn}>
                <Ionicons name="calendar-outline" size={18} color={C.textLight} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16, color: C.text }}>{recordForm.date.toLocaleDateString('th-TH')}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={recordForm.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setRecordForm(p => ({ ...p, date: selectedDate }));
                  }}
                />
              )}

              <Input label={`ปริมาณผลผลิตที่ได้ (${activeWork.unit}) *`} value={recordForm.output} onChangeText={v => setRecordForm(p => ({ ...p, output: v }))} placeholder="เช่น 20" keyboardType="numeric" icon="trending-up-outline" />
              <Text style={s.label}>ประเมินคุณภาพงาน (ดาว) *</Text>
              <StarRating
                rating={recordForm.qualityStar}
                onRatingChange={(stars) => setRecordForm(prev => ({ ...prev, qualityStar: stars }))}
              />

              <Text style={s.label}>จำนวนชั่วโมง OT (ทำล่วงเวลา)</Text>
              <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกชั่วโมง OT', OT_HOURS_OPTIONS, 'otHours')}>
                <Text style={s.dropdownTxt}>{recordForm.otHours} ชั่วโมง</Text>
                <Ionicons name="chevron-down" size={18} color={C.textSec} />
              </TouchableOpacity>

              {workerWage > 0 ? (
                <View style={{ backgroundColor: '#FFF7ED', padding: 14, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#FED7AA' }}>
                  <Text style={{ fontSize: 12, color: '#C2410C', marginBottom: 6 }}>ฐานค่าแรง: {workerWage} บ./วัน ({(workerWage / 8).toFixed(1)} บ./ชม.)</Text>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, color: '#EA580C', fontWeight: '600' }}>ค่า OT สุทธิ (ยังไม่รวมค่าแรง)</Text>
                    <Text style={{ fontSize: 16, color: '#EA580C', fontWeight: '800' }}>+ {otPay.toFixed(2)} ฿</Text>
                  </View>

                  <View style={{ height: 1, backgroundColor: '#FDBA74', marginVertical: 6 }} />

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, color: '#9A3412', fontWeight: '700' }}>OT รวมค่าแรงทั้งหมด</Text>
                    <Text style={{ fontSize: 20, color: '#9A3412', fontWeight: '900' }}>{totalPay.toFixed(2)} ฿</Text>
                  </View>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: '#EF4444', marginBottom: 20 }}>* ไม่สามารถคำนวณ OT ได้ (ช่างไม่มีข้อมูลค่าแรง)</Text>
              )}

              <Button title="บันทึกสถิติ" onPress={handleAddRecord} loading={saving} icon="checkmark-circle" />
              <Button title="ยกเลิก" variant="outline" onPress={() => setShowAddRecord(false)} style={{ marginTop: 8, marginBottom: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // RENDER: Detail Modal (🌟 เพิ่ม Individual Skill Curve)
  // ============================================================
  const renderDetailModal = () => {
    if (!selectedWorker) return null;
    const avgO = calcAvg(selectedWorker.records, 'output');
    const avgQ = calcAvg(selectedWorker.records, 'quality');
    const score = getScore(selectedWorker);
    const grade = getGrade(score);

    // 🌟 หาประเภทงานหลักและข้อมูลสำหรับกราฟ
    const mainWorkType = getMainWorkType(selectedWorker.records);
    const mainWorkTypeData = mainWorkType ? WORK_TYPES.find(w => w.key === mainWorkType) : null;
    const mainWorkTypeAvgOutput = mainWorkType ? calcAvgByWorkType(selectedWorker.records, mainWorkType, 'output') : 0;

    return (
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modal, { maxHeight: '90%' }]}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>รายละเอียดช่าง</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Avatar worker={selectedWorker} size={80} />
                <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, marginTop: 10 }}>{selectedWorker.name}</Text>
                <Text style={{ fontSize: 14, color: C.textSec }}>
                  {selectedWorker.role} • {selectedWorker.nationality}
                </Text>
                {selectedWorker.experience_years > 0 && <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>ประสบการณ์: {selectedWorker.experience_years} ปี</Text>}
                {selectedWorker.daily_wage > 0 && <Text style={{ fontSize: 13, color: C.primary, marginTop: 4, fontWeight: 'bold' }}>ค่าแรง: {selectedWorker.daily_wage} บ./วัน</Text>}
                <Badge label={`เกรด ${grade.label} • ${score}%`} color={grade.color} bg={grade.bg} />
              </View>

              {/* 🌟 กราฟ Normal Curve รายบุคคล */}
              {mainWorkTypeData && mainWorkTypeAvgOutput > 0 && (
                <IndividualSkillCurve
                  currentWorkerOutput={mainWorkTypeAvgOutput}
                  workTypeMean={mainWorkTypeData.standard}
                  workTypeSD={mainWorkTypeData.stdDev}
                  workerName={selectedWorker.name}
                  workTypeName={mainWorkType}
                  unit={mainWorkTypeData.unit}
                />
              )}

              <Card>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>ประวัติล่าสุด</Text>
                {selectedWorker.records_text && selectedWorker.records_text !== 'ยังไม่มีประวัติการทำงาน' ? (
                  <Text style={{ fontSize: 13, color: C.textSec, lineHeight: 24 }}>{selectedWorker.records_text}</Text>
                ) : (
                  <Text style={{ fontSize: 13, color: C.textLight, textAlign: 'center', paddingVertical: 16 }}>ยังไม่มีข้อมูล</Text>
                )}
              </Card>

              <Button title="เพิ่มสถิติ" icon="add-circle-outline" onPress={() => {
                setShowDetail(false);
                setRecordForm({ workType: 'ผูกเหล็ก', date: new Date(), output: '', quality: '', otHours: '0' });
                setTimeout(() => setShowAddRecord(true), 300);
              }} style={{ marginTop: 4 }} />
              <Button title="ลบข้อมูล" variant="danger" icon="trash-outline" onPress={() => handleDelete(selectedWorker)} style={{ marginTop: 8, marginBottom: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {navigation?.openDrawer && (
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 12 }}>
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>สถิติและประเมินช่าง</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>ติดตามผลงานและจัดอันดับ</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('TeamCalc')}
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="calculator-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>จัดทีม</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          {[{ key: 'individual', label: 'รายบุคคล', icon: 'person-outline' }, { key: 'team', label: 'ภาพรวมทีม', icon: 'people-outline' }].map(t => {
            const act = activeTab === t.key;
            return (
              <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: act ? '#fff' : 'rgba(255,255,255,0.1)' }}>
                <Ionicons name={t.icon} size={16} color={act ? C.primary : '#fff'} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: act ? C.primary : '#fff' }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} />}>

        {/* ============================================================ */}
        {/* TAB: รายบุคคล (🌟 เพิ่ม MiniSkillIndicator) */}
        {/* ============================================================ */}
        {activeTab === 'individual' ? (
          <View>
            <Button title="เพิ่มพนักงานใหม่" icon="person-add-outline" onPress={() => setShowAddWorker(true)} style={{ marginBottom: 16 }} />
            {workers.length > 0 ? workers.map(w => {
              const avgOut = calcAvg(w.records, 'output');
              const avgQ = calcAvg(w.records, 'quality');
              const grade = getGrade(getScore(w));

              // 🌟 หาประเภทงานหลักสำหรับ Mini Indicator
              const mainWorkType = getMainWorkType(w.records);
              const mainWorkTypeData = mainWorkType ? WORK_TYPES.find(wt => wt.key === mainWorkType) : null;
              const mainWorkTypeAvgOutput = mainWorkType ? calcAvgByWorkType(w.records, mainWorkType, 'output') : 0;

              return (
                <Card key={w.id} onPress={() => { setSelectedWorker(w); setShowDetail(true); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Avatar worker={w} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{w.name}</Text>
                      <Text style={{ fontSize: 13, color: C.textSec }}>{w.role || '-'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Badge label={`เกรด ${grade.label}`} color={grade.color} bg={grade.bg} />
                      {/* 🌟 Mini Skill Indicator */}
                      {mainWorkTypeData && mainWorkTypeAvgOutput > 0 && (
                        <MiniSkillIndicator
                          output={mainWorkTypeAvgOutput}
                          mean={mainWorkTypeData.standard}
                          stdDev={mainWorkTypeData.stdDev}
                          width={70}
                        />
                      )}
                    </View>
                  </View>
                  <View style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ fontSize: 12, color: C.textSec }}>ผลผลิตเฉลี่ย</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{avgOut}</Text>
                    </View>
                    <ProgressBar progress={avgOut > 100 ? 100 : avgOut} height={7} color="#3B82F6" />
                  </View>
                  <View style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ fontSize: 12, color: C.textSec }}>คุณภาพเฉลี่ย</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{avgQ}%</Text>
                    </View>
                    <ProgressBar progress={avgQ} height={7} color="#10B981" />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: C.textLight }}>สถิติ {w.records.length} รายการ</Text>
                    <TouchableOpacity onPress={() => { setSelectedWorker(w); setRecordForm({ workType: 'ผูกเหล็ก', date: new Date(), output: '', quality: '', otHours: '0' }); setShowAddRecord(true); }}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary + '10', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                      <Ionicons name="add-circle-outline" size={14} color={C.primary} />
                      <Text style={{ fontSize: 11, color: C.primary, fontWeight: '600', marginLeft: 4 }}>เพิ่มสถิติ</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            }) : <Empty icon="people-outline" title="ยังไม่มีข้อมูลพนักงาน" subtitle="กดเพิ่มพนักงานใหม่ด้านบน" />}
          </View>
        ) : (
          /* ============================================================ */
          /* TAB: ภาพรวมทีม (🌟 เพิ่ม Collective Performance Curve) */
          /* ============================================================ */
          <View>
            {/* สรุปตัวเลข */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {[
                { val: workers.length, label: 'ช่างทั้งหมด', color: '#3B82F6', bg: '#DBEAFE' },
                { val: workers.reduce((s, w) => s + w.records.length, 0), label: 'สถิติทั้งหมด', color: '#10B981', bg: '#D1FAE5' },
                { val: ranked[0] ? `${ranked[0].score}%` : '-', label: 'คะแนนสูงสุด', color: '#F59E0B', bg: '#FEF3C7' },
              ].map((d, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: d.bg, borderRadius: 14, padding: 14, alignItems: 'center', elevation: 2 }}>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: d.color }}>{d.val}</Text>
                  <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{d.label}</Text>
                </View>
              ))}
            </View>

            {/* 🌟 กราฟภาพรวมทีม (Collective Performance Curve) */}
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="stats-chart-outline" size={20} color={C.primary} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginLeft: 8 }}>
                  วิเคราะห์ทักษะทีม (Normal Curve)
                </Text>
              </View>

              {/* เลือกประเภทงาน */}
              <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 8 }}>เลือกประเภทงานที่ต้องการวิเคราะห์</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {WORK_TYPES.filter(w => w.key !== 'อื่นๆ').map(wt => {
                    const isSelected = dashboardWorkType === wt.key;
                    return (
                      <TouchableOpacity
                        key={wt.key}
                        onPress={() => setDashboardWorkType(wt.key)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                          backgroundColor: isSelected ? wt.color : '#F3F4F6',
                          borderWidth: isSelected ? 0 : 1, borderColor: C.border,
                        }}
                      >
                        <Ionicons name={wt.icon} size={14} color={isSelected ? '#fff' : C.textSec} />
                        <Text style={{ color: isSelected ? '#fff' : C.textSec, fontWeight: '600', fontSize: 11 }}>
                          {wt.key}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </Card>

            {/* แสดงกราฟ */}
            {(() => {
              const { workersWithData, mean, stdDev, unit } = getTeamCurveData(dashboardWorkType);

              if (workersWithData.length === 0) {
                return (
                  <Card>
                    <Empty
                      icon="analytics-outline"
                      title={`ยังไม่มีข้อมูลงาน "${dashboardWorkType}"`}
                      subtitle="เพิ่มสถิติการทำงานให้กับช่างเพื่อดูการวิเคราะห์"
                    />
                  </Card>
                );
              }

              return (
                <CollectivePerformanceCurve
                  workersData={workersWithData}
                  workTypeMean={mean}
                  workTypeSD={stdDev}
                  workTypeName={dashboardWorkType}
                  unit={unit}
                  onWorkerPress={(w) => {
                    const fullWorker = workers.find(fw => fw.id === w.id);
                    if (fullWorker) {
                      setSelectedWorker(fullWorker);
                      setShowDetail(true);
                    }
                  }}
                />
              );
            })()}

            {/* จัดอันดับช่าง */}
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 12 }}>จัดอันดับช่าง</Text>
            {ranked.length > 0 ? ranked.map((w, i) => {
              const grade = getGrade(w.score);
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
              return (
                <Card key={w.id} onPress={() => { setSelectedWorker(w); setShowDetail(true); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: i < 3 ? grade.bg : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: i < 3 ? 18 : 14, fontWeight: '700', color: i < 3 ? grade.color : C.textSec }}>{medal}</Text>
                    </View>
                    <View style={{ marginLeft: 10 }}><Avatar worker={w} size={36} /></View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>{w.name}</Text>
                      <Text style={{ fontSize: 12, color: C.textSec }}>{w.role} • {w.records.length} งาน</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: grade.color }}>{w.score}</Text>
                      <Badge label={`เกรด ${grade.label}`} color={grade.color} bg={grade.bg} />
                    </View>
                  </View>
                  <ProgressBar progress={w.score} height={5} color={grade.color} style={{ marginTop: 10 }} />
                </Card>
              );
            }) : <Empty icon="trophy-outline" title="ยังไม่มีข้อมูล" />}
          </View>
        )}
      </ScrollView>

      {renderCustomPicker()}
      {renderAddWorkerModal()}
      {renderAddRecordModal()}
      {renderDetailModal()}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center' },
  pickerItem: { width: '100%', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB', marginBottom: 12 },
  dropdownTxt: { fontSize: 15, color: C.text },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
});