// src/WorkerStatsScreen.js
// ============================================================
// หน้าสถิติช่าง (เพิ่ม Picker เลื่อนได้, สัญชาติพิมพ์เอง, อายุงาน)
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, RefreshControl, Image, Linking, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C, Card, Badge, ProgressBar, Button, Input, Empty } from './Components';
import { getWorkersWithRecords, insertWorker, insertWorkerRecord, deleteWorker } from './db';

const ROLES = ['ช่างไม้', 'ช่างก่อ', 'ช่างฉาบ', 'ช่างเหล็ก/ผูกเหล็ก', 'ช่างปูน/เทปูน', 'ช่างไฟฟ้า', 'ช่างประปา', 'ช่างแอร์', 'ช่างฝ้าเพดาน', 'ช่างกระเบื้อง', 'ช่างทาสี', 'ช่างเชื่อม', 'คนงานทั่วไป', 'อื่นๆ'];
const GENDERS = ['ชาย', 'หญิง'];
const EMPLOYMENT_STATUSES = ['พนักงานประจำ', 'พนักงานรายวัน', 'ผู้รับเหมาช่วง'];

const WORK_TYPES = [
  { key: 'โครงสร้าง คสล.', icon: 'business-outline', color: '#3B82F6', ref: 'มาตรฐาน 27 ตร.ม./วัน' },
  { key: 'ผูกเหล็ก', icon: 'construct-outline', color: '#2563EB', ref: 'มาตรฐาน 50 กก./วัน' },
  { key: 'เทปูน', icon: 'cube-outline', color: '#8B5CF6', ref: 'มาตรฐาน 3 ลบ.ม./วัน' },
  { key: 'ก่ออิฐ', icon: 'grid-outline', color: '#F59E0B', ref: 'มาตรฐาน 24 ตร.ม./วัน' },
  { key: 'ฉาบปูน', icon: 'layers-outline', color: '#10B981', ref: 'มาตรฐาน 14 ตร.ม./วัน' },
  { key: 'งานไม้', icon: 'hammer-outline', color: '#EC4899', ref: 'มาตรฐาน 20 ตร.ม./วัน' },
  { key: 'งานไฟฟ้า', icon: 'flash-outline', color: '#F97316', ref: 'มาตรฐาน 13 จุด/วัน' },
  { key: 'งานประปา', icon: 'water-outline', color: '#06B6D4', ref: 'มาตรฐาน 10 จุด/วัน' },
  { key: 'งานทาสี', icon: 'color-palette-outline', color: '#10B981', ref: 'มาตรฐาน 85 ตร.ม./วัน' },
  { key: 'งานกระเบื้อง', icon: 'apps-outline', color: '#EC4899', ref: 'มาตรฐาน 25 ตร.ม./วัน' },
  { key: 'งานฝ้า', icon: 'resize-outline', color: '#A855F7', ref: 'มาตรฐาน 35 ตร.ม./วัน' },
  { key: 'งานเชื่อม', icon: 'flame-outline', color: '#EF4444', ref: 'มาตรฐาน 10 จุด/วัน' },
  { key: 'อื่นๆ', icon: 'ellipsis-horizontal-outline', color: '#6B7280', ref: '' },
];

function calcAvg(records, field) {
  if (!records?.length) return 0;
  return Math.round((records.reduce((s, r) => s + (r[field] || 0), 0) / records.length) * 10) / 10;
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

export default function WorkerStatsScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [activeTab, setActiveTab] = useState('individual');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 🌟 Picker State
  const [pickerConfig, setPickerConfig] = useState({ visible: false, title: '', options: [], field: '', isMulti: false });

  const [workerForm, setWorkerForm] = useState({ 
    name: '', roles: [], customRole: '', age: '', phone: '', avatarUri: '',
    nationality: '', gender: 'ชาย', dailyWage: '', experienceYears: '', employmentStatus: 'พนักงานรายวัน'
  });
  
  const [recordForm, setRecordForm] = useState({ workType: 'ผูกเหล็ก', date: new Date(), output: '', quality: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try { setWorkers(await getWorkersWithRecords()); }
    catch (e) { console.log('Load error:', e); }
  };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  // 🌟 ฟังก์ชันจัดการ Custom Picker
  const openPicker = (title, options, field, isMulti = false) => {
    setPickerConfig({ visible: true, title, options, field, isMulti });
  };

  const handleSelectPickerOption = (opt) => {
    if (pickerConfig.isMulti) {
      setWorkerForm(p => {
        const currentArr = p[pickerConfig.field] || [];
        const isSelected = currentArr.includes(opt);
        const newArr = isSelected ? currentArr.filter(x => x !== opt) : [...currentArr, opt];
        return { ...p, [pickerConfig.field]: newArr };
      });
    } else {
      setWorkerForm(p => ({ ...p, [pickerConfig.field]: opt }));
      setPickerConfig(p => ({ ...p, visible: false })); // ปิด Picker เมื่อเลือกเสร็จ (แบบ Single)
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
    if (!workerForm.nationality.trim()) return Alert.alert('แจ้งเตือน', 'กรุณาระบุสัญชาติ (บังคับ)'); // 🌟 บังคับกรอกสัญชาติ
    
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
    const quality = parseFloat(recordForm.quality);
    if (isNaN(output) || isNaN(quality)) return Alert.alert('แจ้งเตือน', 'กรุณากรอกตัวเลข');
    if (output < 0 || quality < 0 || quality > 100) return Alert.alert('แจ้งเตือน', 'ตรวจสอบตัวเลข (คุณภาพ 0-100)');
    setSaving(true);
    try {
      const formattedDate = new Date(recordForm.date.getTime() - (recordForm.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      await insertWorkerRecord(selectedWorker.id, recordForm.workType, formattedDate, output, quality);
      setRecordForm({ workType: 'ผูกเหล็ก', date: new Date(), output: '', quality: '' });
      setShowAddRecord(false);
      await loadData();
      Alert.alert('สำเร็จ', `บันทึกสถิติเรียบร้อย`);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (w) => {
    Alert.alert('ลบข้อมูล', `ต้องการลบประวัติของ "${w.name}" ทั้งหมด?`, [
      { text: 'ยกเลิก' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
        await deleteWorker(w.id); setShowDetail(false); setSelectedWorker(null); await loadData();
      }},
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
  // CUSTOM PICKER MODAL (🌟 ตัวใหม่ที่เป็นแบบเลื่อนได้)
  // ============================================================
  const renderCustomPicker = () => (
    <Modal visible={pickerConfig.visible} transparent animationType="fade">
      <View style={s.pickerOverlay}>
        <View style={s.pickerBox}>
          <Text style={s.modalTitle}>{pickerConfig.title}</Text>
          <ScrollView style={{ maxHeight: 300, width: '100%', marginVertical: 10 }}>
            {pickerConfig.options.map(opt => {
              const isSelected = pickerConfig.isMulti 
                ? (workerForm[pickerConfig.field] || []).includes(opt) 
                : workerForm[pickerConfig.field] === opt;
              
              return (
                <TouchableOpacity key={opt} onPress={() => handleSelectPickerOption(opt)} style={s.pickerItem}>
                  <Text style={{ fontSize: 16, color: isSelected ? C.primary : C.text, fontWeight: isSelected ? '700' : '400' }}>{opt}</Text>
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
  // MODAL: เพิ่มช่าง (🌟 อัปเกรดฟอร์ม)
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

            {/* 🌟 Picker ตำแหน่งงาน (เลือกได้หลายอัน) */}
            <Text style={s.label}>ตำแหน่งงาน (เลือกได้มากกว่า 1) *</Text>
            <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกตำแหน่งงาน', ROLES, 'roles', true)}>
              <Text style={s.dropdownTxt}>{workerForm.roles.length > 0 ? workerForm.roles.join(', ') : 'กดเพื่อเลือกตำแหน่ง'}</Text>
              <Ionicons name="chevron-down" size={18} color={C.textSec} />
            </TouchableOpacity>
            {workerForm.roles.includes('อื่นๆ') && (
              <Input label="ระบุตำแหน่ง" value={workerForm.customRole} onChangeText={v => setWorkerForm(p => ({ ...p, customRole: v }))} placeholder="กรอกตำแหน่ง" icon="create-outline" />
            )}

            {/* 🌟 สัญชาติ (กรอกเอง + บังคับ) */}
            <Input label="สัญชาติ *" value={workerForm.nationality} onChangeText={v => setWorkerForm(p => ({ ...p, nationality: v }))} placeholder="เช่น ไทย, เมียนมา" icon="flag-outline" />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* 🌟 Picker เพศ */}
              <View style={{ flex: 1 }}>
                <Text style={s.label}>เพศ</Text>
                <TouchableOpacity style={s.dropdownBtn} onPress={() => openPicker('เลือกเพศ', GENDERS, 'gender')}>
                  <Text style={s.dropdownTxt}>{workerForm.gender}</Text>
                  <Ionicons name="chevron-down" size={18} color={C.textSec} />
                </TouchableOpacity>
              </View>
              {/* 🌟 Picker สถานะการจ้าง */}
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
  // MODAL: เพิ่มสถิติ (ใส่ DatePicker และคำแนะนำมาตรฐาน)
  // ============================================================
  const renderAddRecordModal = () => {
    const activeWork = WORK_TYPES.find(w => w.key === recordForm.workType) || WORK_TYPES[0];

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

              {activeWork.ref ? (
                <View style={{ backgroundColor: '#E0F2FE', padding: 10, borderRadius: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="information-circle" size={16} color="#0284C7" />
                  <Text style={{ fontSize: 12, color: '#0284C7', marginLeft: 6 }}>อ้างอิง: {activeWork.ref}</Text>
                </View>
              ) : null}

              {/* ปฏิทิน DatePicker */}
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

              <Input label="ปริมาณผลผลิตที่ได้ *" value={recordForm.output} onChangeText={v => setRecordForm(p => ({ ...p, output: v }))} placeholder="เช่น 20" keyboardType="numeric" icon="trending-up-outline" />
              <Input label="คะแนนคุณภาพ (0-100) *" value={recordForm.quality} onChangeText={v => setRecordForm(p => ({ ...p, quality: v }))} placeholder="เช่น 90" keyboardType="numeric" icon="star-outline" />
              
              <Button title="บันทึกสถิติ" onPress={handleAddRecord} loading={saving} icon="checkmark-circle" />
              <Button title="ยกเลิก" variant="outline" onPress={() => setShowAddRecord(false)} style={{ marginTop: 8, marginBottom: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // MODAL: รายละเอียดช่าง
  // ============================================================
  const renderDetailModal = () => {
    if (!selectedWorker) return null;
    const avgO = calcAvg(selectedWorker.records, 'output');
    const avgQ = calcAvg(selectedWorker.records, 'quality');
    const score = getScore(selectedWorker);
    const grade = getGrade(score);

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
                setRecordForm({ workType: 'ผูกเหล็ก', date: new Date(), output: '', quality: '' });
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
        {activeTab === 'individual' ? (
          <View>
            <Button title="เพิ่มพนักงานใหม่" icon="person-add-outline" onPress={() => setShowAddWorker(true)} style={{ marginBottom: 16 }} />
            {workers.length > 0 ? workers.map(w => {
              const avgOut = calcAvg(w.records, 'output');
              const avgQ = calcAvg(w.records, 'quality');
              const grade = getGrade(getScore(w));
              return (
                <Card key={w.id} onPress={() => { setSelectedWorker(w); setShowDetail(true); }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Avatar worker={w} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{w.name}</Text>
                      <Text style={{ fontSize: 13, color: C.textSec }}>{w.role || '-'}</Text>
                    </View>
                    <Badge label={`เกรด ${grade.label}`} color={grade.color} bg={grade.bg} />
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
                    <TouchableOpacity onPress={() => { setSelectedWorker(w); setRecordForm({ workType: 'ผูกเหล็ก', date: new Date(), output: '', quality: '' }); setShowAddRecord(true); }}
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
          <View>
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

            <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 }}>จัดอันดับช่าง</Text>
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