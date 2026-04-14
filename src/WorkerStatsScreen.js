// src/WorkerStatsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, RefreshControl, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C, Card, Button, Input, Empty } from './Components';
import { getWorkersWithRecords, insertWorker, insertWorkerRecord } from './db';

// ============================================================
// 1. ฐานข้อมูลประเภทงาน + อัตราการทำงานมาตรฐาน (ครอบคลุมทุกสายงาน)
// ============================================================
export const WORK_TYPES = [
  // 🏗️ หมวดงานโครงสร้าง
  { id: 'โครงสร้าง คสล. (ตั้งแบบ/ผูกเหล็ก/เท)', unit: 'ตร.ม.', standardPerDay: 27, icon: 'construct-outline', color: '#3B82F6', ref: 'มาตรฐาน สธ. ลำดับ 50 (ช่าง 1 ชุด)' },
  { id: 'ผูกเหล็ก (เฉพาะงาน)', unit: 'กก.', standardPerDay: 50, icon: 'analytics-outline', color: '#2563EB', ref: 'อัตรากรมบัญชีกลาง (ไม่มีในมาตรฐาน สธ.)' },
  { id: 'เทคอนกรีต (ผสมโม่)', unit: 'ลบ.ม.', standardPerDay: 3, icon: 'cube-outline', color: '#8B5CF6', ref: 'มาตรฐาน สธ. ลำดับ 25 (ช่าง 1 ชุด)' },
  { id: 'ติดตั้งแบบหล่อพื้น', unit: 'ตร.ม.', standardPerDay: 15, icon: 'hardware-chip-outline', color: '#B45309', ref: 'มาตรฐาน สธ. ลำดับ 21 (ช่าง 1 ชุด)' },
  
  // 🧱 หมวดงานสถาปัตยกรรม (ก่อ-ฉาบ-ปู-ทา)
  { id: 'ก่ออิฐมอญครึ่งแผ่น', unit: 'ตร.ม.', standardPerDay: 24, icon: 'grid-outline', color: '#F59E0B', ref: 'มาตรฐาน สธ. ลำดับ 72 (ช่าง 1 ชุด)' },
  { id: 'ก่ออิฐมวลเบา', unit: 'ตร.ม.', standardPerDay: 36, icon: 'grid-outline', color: '#D97706', ref: 'มาตรฐาน สธ. ลำดับ 74 (ช่าง 1 ชุด)' },
  { id: 'ฉาบปูนเรียบผนังทั่วไป', unit: 'ตร.ม.', standardPerDay: 14, icon: 'layers-outline', color: '#10B981', ref: 'มาตรฐาน สธ. ลำดับ 80 (ช่าง 1 ชุด)' },
  { id: 'ปูพื้นกระเบื้องแกรนิตโต้ 60x60', unit: 'ตร.ม.', standardPerDay: 25, icon: 'apps-outline', color: '#EC4899', ref: 'มาตรฐาน สธ. ลำดับ 98 (ช่าง 1 ชุด)' },
  { id: 'บุกระเบื้องผนังแกรนิตโต้', unit: 'ตร.ม.', standardPerDay: 13, icon: 'stop-outline', color: '#BE185D', ref: 'มาตรฐาน สธ. ลำดับ 89 (ช่าง 1 ชุด)' },
  { id: 'ทาสีภายใน (ต่อเที่ยว)', unit: 'ตร.ม.', standardPerDay: 85, icon: 'color-palette-outline', color: '#10B981', ref: 'มาตรฐาน สธ. ลำดับ 120 (ช่าง 1 ชุด)' },
  { id: 'ทาสีภายนอก (ต่อเที่ยว)', unit: 'ตร.ม.', standardPerDay: 60, icon: 'color-palette-outline', color: '#059669', ref: 'มาตรฐาน สธ. ลำดับ 121 (ช่าง 1 ชุด)' },
  
  // 🏠 หมวดงานฝ้าและหลังคา
  { id: 'ทำฝ้าเพดานยิปซั่มฉาบเรียบ', unit: 'ตร.ม.', standardPerDay: 35, icon: 'resize-outline', color: '#A855F7', ref: 'มาตรฐาน สธ. ลำดับ 67 (ช่าง 1 ชุด)' },
  { id: 'ทำฝ้าเพดานทีบาร์', unit: 'ตร.ม.', standardPerDay: 52, icon: 'grid', color: '#9333EA', ref: 'มาตรฐาน สธ. ลำดับ 70 (ช่าง 1 ชุด)' },
  { id: 'มุงหลังคากระเบื้องลอนคู่', unit: 'ตร.ม.', standardPerDay: 43, icon: 'home-outline', color: '#F97316', ref: 'มาตรฐาน สธ. ลำดับ 56 (ช่าง 2 คน)' },
  { id: 'มุงหลังคาเมทัลชีท', unit: 'ตร.ม.', standardPerDay: 123, icon: 'home', color: '#EA580C', ref: 'มาตรฐาน สธ. ลำดับ 60 (ช่าง 3 คน)' },

  // ⚡ หมวดงานระบบประกอบอาคาร (ไฟฟ้า-ประปา)
  { id: 'ติดตั้งสุขภัณฑ์ (ใช้น้ำ)', unit: 'ชุด', standardPerDay: 5, icon: 'water-outline', color: '#06B6D4', ref: 'มาตรฐาน สธ. ลำดับ 117 (ช่าง 1 ชุด)' },
  { id: 'ติดตั้งสวิทซ์/ปลั๊กไฟ', unit: 'จุด', standardPerDay: 13, icon: 'flash-outline', color: '#F97316', ref: 'มาตรฐาน สธ. ลำดับ 149 (ช่าง 1 ชุด)' },
  { id: 'เดินสายไฟร้อยท่อ', unit: 'จุด', standardPerDay: 3, icon: 'git-commit-outline', color: '#D946EF', ref: 'มาตรฐาน สธ. ลำดับ 152 (ช่าง 1 ชุด)' },
  { id: 'ติดตั้งโคมดาวน์ไลท์', unit: 'ชุด', standardPerDay: 11, icon: 'bulb-outline', color: '#FBBF24', ref: 'มาตรฐาน สธ. ลำดับ 143 (ช่าง 1 ชุด)' },
  { id: 'เดินท่อประปา/สุขาภิบาล', unit: 'จุด', standardPerDay: 10, icon: 'git-network-outline', color: '#0891B2', ref: 'ทั่วไป (ไม่มีในอ้างอิง สธ.)' },

  // 🛠️ หมวดงานทั่วไป/อื่นๆ
  { id: 'งานเชื่อมโครงเหล็ก', unit: 'จุด', standardPerDay: 10, icon: 'flame-outline', color: '#EF4444', ref: 'ทั่วไป (ไม่มีในอ้างอิง สธ.)' },
  { id: 'งานไม้/ประกอบตู้บิวท์อิน', unit: 'ม.', standardPerDay: 1, icon: 'hammer-outline', color: '#78350F', ref: 'เทียบเคียง มาตรฐาน สธ. ลำดับ 129' },
  { id: 'ทำความสะอาด/เก็บขยะ', unit: 'ตร.ม.', standardPerDay: 100, icon: 'trash-outline', color: '#6B7280', ref: 'ทั่วไป (ไม่มีในอ้างอิง สธ.)' },
  { id: 'ขุดดิน/ปรับระดับด้วยแรงงาน', unit: 'ลบ.ม.', standardPerDay: 2, icon: 'earth-outline', color: '#4B5563', ref: 'ทั่วไป (ไม่มีในอ้างอิง สธ.)' },
  { id: 'อื่นๆ', unit: 'หน่วย', standardPerDay: 1, icon: 'ellipsis-horizontal-outline', color: '#9CA3AF', ref: 'ผู้ใช้กำหนดปริมาณเอง' },
];

const ROLES = ['ช่างไม้', 'ช่างก่อ', 'ช่างฉาบ', 'ช่างเหล็ก', 'ช่างปูน', 'ช่างไฟฟ้า', 'ช่างประปา', 'ช่างเชื่อม', 'คนงานทั่วไป', 'ผู้ควบคุมงาน'];
const NATIONALITIES = ['ไทย', 'เมียนมา', 'กัมพูชา', 'ลาว', 'อื่นๆ'];
const GENDERS = ['ชาย', 'หญิง'];
const EMPLOYMENT_STATUSES = ['พนักงานประจำ', 'พนักงานรายวัน', 'ผู้รับเหมาช่วง', 'ทดลองงาน'];

// ============================================================
// Main Screen
// ============================================================
export default function WorkerStatsScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  
  // States สำหรับ Picker Modals
  const [pickerConfig, setPickerConfig] = useState({ visible: false, title: '', options: [], field: '', isMulti: false });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ฟอร์มเพิ่มพนักงาน
  const [workerForm, setWorkerForm] = useState({ 
    name: '', roles: [], nationality: 'ไทย', gender: 'ชาย', age: '', 
    dailyWage: '', experienceYears: '', employmentStatus: 'พนักงานรายวัน', phone: '', avatarUri: '' 
  });
  
  // ฟอร์มเพิ่มสถิติ (ค่าเริ่มต้นตรงกับ Array งานแรก)
  const [recordForm, setRecordForm] = useState({ workType: 'โครงสร้าง คสล. (ตั้งแบบ/ผูกเหล็ก/เท)', date: new Date(), output: '', quality: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try { setWorkers(await getWorkersWithRecords()); }
    catch (e) { console.log('Load error:', e); }
  };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  // --- Handlers ---
  const handleAddWorker = async () => {
    if (!workerForm.name.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อพนักงาน');
    if (workerForm.roles.length === 0) return Alert.alert('แจ้งเตือน', 'กรุณาเลือกตำแหน่งงานอย่างน้อย 1 ตำแหน่ง');
    setSaving(true);
    try {
      await insertWorker({
        name: workerForm.name.trim(),
        role: workerForm.roles.join(', '), 
        nationality: workerForm.nationality,
        gender: workerForm.gender,
        age: parseInt(workerForm.age) || 0,
        dailyWage: parseFloat(workerForm.dailyWage) || 0,
        experienceYears: parseInt(workerForm.experienceYears) || 0,
        employmentStatus: workerForm.employmentStatus,
        phone: workerForm.phone.trim(),
        avatarUri: workerForm.avatarUri,
      });
      setShowAddWorker(false);
      setWorkerForm({ name: '', roles: [], nationality: 'ไทย', gender: 'ชาย', age: '', dailyWage: '', experienceYears: '', employmentStatus: 'พนักงานรายวัน', phone: '', avatarUri: '' });
      await loadData();
      Alert.alert('สำเร็จ', 'เพิ่มข้อมูลพนักงานเรียบร้อย');
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setSaving(false); }
  };

  const handleAddRecord = async () => {
    if (!selectedWorker) return;
    const output = parseFloat(recordForm.output);
    const quality = parseFloat(recordForm.quality);
    if (isNaN(output) || isNaN(quality)) return Alert.alert('แจ้งเตือน', 'กรุณากรอกตัวเลขปริมาณและคุณภาพ');
    if (output < 0 || quality < 0 || quality > 100) return Alert.alert('แจ้งเตือน', 'ตรวจสอบตัวเลข (คุณภาพ 0-100)');
    
    setSaving(true);
    try {
      // ดึงวันที่จาก Date Object (แปลง Date Object เป็น YYYY-MM-DD แบบ Local Time)
      const formattedDate = new Date(recordForm.date.getTime() - (recordForm.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      await insertWorkerRecord(selectedWorker.id, recordForm.workType, formattedDate, output, quality);
      setShowAddRecord(false);
      setRecordForm({ workType: 'โครงสร้าง คสล. (ตั้งแบบ/ผูกเหล็ก/เท)', date: new Date(), output: '', quality: '' });
      await loadData();
      Alert.alert('สำเร็จ', `บันทึกสถิติงานเรียบร้อย`);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setSaving(false); }
  };

  // --- Custom Picker UI ---
  const openPicker = (title, options, field, isMulti = false) => {
    setPickerConfig({ visible: true, title, options, field, isMulti });
  };

  const onSelectPickerOption = (opt) => {
    if (pickerConfig.isMulti) {
      setWorkerForm(p => {
        const isSelected = p[pickerConfig.field].includes(opt);
        const newArr = isSelected ? p[pickerConfig.field].filter(x => x !== opt) : [...p[pickerConfig.field], opt];
        return { ...p, [pickerConfig.field]: newArr };
      });
    } else {
      setWorkerForm(p => ({ ...p, [pickerConfig.field]: opt }));
      setPickerConfig({ ...pickerConfig, visible: false });
    }
  };

  const CustomPickerModal = () => (
    <Modal visible={pickerConfig.visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.pickerContainer}>
          <Text style={s.modalTitle}>{pickerConfig.title}</Text>
          <ScrollView style={{ maxHeight: 300, width: '100%' }}>
            {pickerConfig.options.map(opt => {
              const isSelected = pickerConfig.isMulti 
                ? workerForm[pickerConfig.field].includes(opt) 
                : workerForm[pickerConfig.field] === opt;
              return (
                <TouchableOpacity key={opt} onPress={() => onSelectPickerOption(opt)} style={s.pickerItem}>
                  <Text style={{ fontSize: 16, color: isSelected ? C.primary : C.text }}>{opt}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Button title="ตกลง" onPress={() => setPickerConfig({ ...pickerConfig, visible: false })} style={{ marginTop: 10, width: '100%' }}/>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // MODAL: เพิ่มพนักงาน
  // ============================================================
  const renderAddWorkerModal = () => (
    <Modal visible={showAddWorker} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={[s.modal, { maxHeight: '90%' }]}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>เพิ่มพนักงาน/ช่างใหม่</Text>
            <TouchableOpacity onPress={() => setShowAddWorker(false)}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            
            <Input label="ชื่อ-นามสกุล *" value={workerForm.name} onChangeText={v => setWorkerForm(p => ({ ...p, name: v }))} placeholder="เช่น สมชาย ใจดี" />

            <Text style={s.label}>ตำแหน่งงาน (เลือกได้มากกว่า 1) *</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกตำแหน่งงาน', ROLES, 'roles', true)}>
              <Text style={s.dropdownTxt}>{workerForm.roles.length > 0 ? workerForm.roles.join(', ') : 'กดเพื่อเลือกตำแหน่ง'}</Text>
              <Ionicons name="chevron-down" size={18} color={C.textSec} />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>สัญชาติ</Text>
                <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกสัญชาติ', NATIONALITIES, 'nationality')}>
                  <Text style={s.dropdownTxt}>{workerForm.nationality}</Text>
                  <Ionicons name="chevron-down" size={18} color={C.textSec} />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>เพศ</Text>
                <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกเพศ', GENDERS, 'gender')}>
                  <Text style={s.dropdownTxt}>{workerForm.gender}</Text>
                  <Ionicons name="chevron-down" size={18} color={C.textSec} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input label="ค่าแรง (บาท/วัน)" value={workerForm.dailyWage} onChangeText={v => setWorkerForm(p => ({ ...p, dailyWage: v }))} keyboardType="numeric" placeholder="เช่น 350" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="ประสบการณ์ (ปี)" value={workerForm.experienceYears} onChangeText={v => setWorkerForm(p => ({ ...p, experienceYears: v }))} keyboardType="numeric" placeholder="เช่น 5" />
              </View>
            </View>

            <Text style={s.label}>สถานะการจ้างงาน</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกสถานะ', EMPLOYMENT_STATUSES, 'employmentStatus')}>
              <Text style={s.dropdownTxt}>{workerForm.employmentStatus}</Text>
              <Ionicons name="chevron-down" size={18} color={C.textSec} />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input label="อายุ (ปี)" value={workerForm.age} onChangeText={v => setWorkerForm(p => ({ ...p, age: v }))} keyboardType="numeric" placeholder="เช่น 35" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="เบอร์โทรศัพท์" value={workerForm.phone} onChangeText={v => setWorkerForm(p => ({ ...p, phone: v }))} keyboardType="phone-pad" placeholder="08x-xxx-xxxx" />
              </View>
            </View>

            <Button title="บันทึกข้อมูลพนักงาน" onPress={handleAddWorker} loading={saving} style={{ marginTop: 10, marginBottom: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // MODAL: เพิ่มสถิติ
  // ============================================================
  const renderAddRecordModal = () => {
    const selectedWorkData = WORK_TYPES.find(w => w.id === recordForm.workType) || WORK_TYPES[0];

    return (
      <Modal visible={showAddRecord} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modal, { maxHeight: '90%' }]}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>บันทึกงานรายวัน — {selectedWorker?.name}</Text>
              <TouchableOpacity onPress={() => setShowAddRecord(false)}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              
              <Text style={s.label}>ประเภทงาน</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {WORK_TYPES.map(wt => {
                  const sel = recordForm.workType === wt.id;
                  return (
                    <TouchableOpacity key={wt.id} onPress={() => setRecordForm(p => ({ ...p, workType: wt.id }))}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? wt.color : '#F3F4F6', borderWidth: sel ? 0 : 1, borderColor: '#E5E7EB' }}>
                      <Text style={{ color: sel ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{wt.id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.infoBox}>
                <Ionicons name="information-circle" size={20} color="#0284C7" />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={{ fontSize: 13, color: '#0369A1', fontWeight: 'bold', marginBottom: 2 }}>
                    มาตรฐาน: {selectedWorkData.standardPerDay} {selectedWorkData.unit} / คน / วัน
                  </Text>
                  <Text style={{ fontSize: 11, color: '#0284C7' }}>อ้างอิง: {selectedWorkData.ref}</Text>
                </View>
              </View>

              <Text style={s.label}>วันที่ปฏิบัติงาน</Text>
              <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={18} color={C.primary} />
                <Text style={{ fontSize: 15, color: C.text, marginLeft: 8 }}>{recordForm.date.toLocaleDateString('th-TH')}</Text>
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

              <Input label={`ปริมาณงานที่ทำได้จริง (${selectedWorkData.unit}) *`} value={recordForm.output} onChangeText={v => setRecordForm(p => ({ ...p, output: v }))} placeholder={`ควรได้ประมาณ ${selectedWorkData.standardPerDay}`} keyboardType="numeric" />
              <Input label="ประเมินคุณภาพงาน (0-100%) *" value={recordForm.quality} onChangeText={v => setRecordForm(p => ({ ...p, quality: v }))} placeholder="เช่น 90" keyboardType="numeric" />
              
              <Button title="บันทึกสถิติงาน" onPress={handleAddRecord} loading={saving} style={{ marginTop: 10, marginBottom: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>ฐานข้อมูลช่างก่อสร้าง</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>บันทึกสถิติและประเมินผลการทำงาน</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
        <Button title="เพิ่มพนักงานใหม่" icon="person-add-outline" onPress={() => setShowAddWorker(true)} style={{ marginBottom: 16 }} />
        
        {workers.length > 0 ? workers.map(w => (
          <Card key={w.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{w.name}</Text>
                <Text style={{ fontSize: 13, color: C.textSec }}>
                  {w.role} • {w.nationality} • {w.employmentStatus}
                </Text>
                {w.dailyWage > 0 && <Text style={{ fontSize: 12, color: C.primary, marginTop: 4 }}>ค่าแรง: {w.dailyWage} บ./วัน</Text>}
              </View>
              <TouchableOpacity onPress={() => { setSelectedWorker(w); setShowAddRecord(true); }}
                style={{ backgroundColor: '#F0F9FF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BAE6FD', alignItems: 'center' }}>
                <Ionicons name="add-circle" size={20} color={C.primary} />
                <Text style={{ fontSize: 11, color: C.primary, fontWeight: '700', marginTop: 2 }}>ลงสถิติ</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )) : (
          <Empty icon="people-outline" title="ยังไม่มีข้อมูลพนักงาน" subtitle="กดปุ่ม 'เพิ่มพนักงานใหม่' เพื่อเริ่มต้นใช้งาน" />
        )}
      </ScrollView>

      {renderAddWorkerModal()}
      {renderAddRecordModal()}
      {CustomPickerModal()}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: '100%', position: 'absolute', bottom: 0 },
  pickerContainer: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center' },
  pickerItem: { width: '100%', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB', marginBottom: 16 },
  dropdownTxt: { fontSize: 15, color: C.text },
  dateBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB', marginBottom: 16 },
  infoBox: { flexDirection: 'row', backgroundColor: '#E0F2FE', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'flex-start', borderWidth: 1, borderColor: '#BAE6FD' }
});