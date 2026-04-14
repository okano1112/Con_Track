// src/WorkerStatsScreen.js
// ============================================================
// หน้าสถิติช่าง — เพิ่มช่าง, เพิ่มสถิติ, ดูรายละเอียด, จัดอันดับ
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, RefreshControl, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { C, Card, Badge, ProgressBar, Button, Input, Empty } from './Components';
import { getWorkersWithRecords, insertWorker, insertWorkerRecord, deleteWorker } from './db';

// ============================================================
// ตำแหน่งช่าง (สำหรับ picker ตอนเพิ่มช่าง)
// ============================================================
const ROLES = [
  { key: 'ช่างไม้', icon: 'hammer-outline', color: '#8B4513' },
  { key: 'ช่างก่อ', icon: 'grid-outline', color: '#F59E0B' },
  { key: 'ช่างฉาบ', icon: 'layers-outline', color: '#A3A3A3' },
  { key: 'ช่างเหล็ก/ผูกเหล็ก', icon: 'construct-outline', color: '#3B82F6' },
  { key: 'ช่างปูน/เทปูน', icon: 'cube-outline', color: '#8B5CF6' },
  { key: 'ช่างไฟฟ้า', icon: 'flash-outline', color: '#F97316' },
  { key: 'ช่างประปา', icon: 'water-outline', color: '#06B6D4' },
  { key: 'ช่างแอร์', icon: 'snow-outline', color: '#38BDF8' },
  { key: 'ช่างฝ้าเพดาน', icon: 'resize-outline', color: '#A855F7' },
  { key: 'ช่างกระเบื้อง', icon: 'apps-outline', color: '#EC4899' },
  { key: 'ช่างทาสี', icon: 'color-palette-outline', color: '#10B981' },
  { key: 'ช่างเชื่อม', icon: 'flame-outline', color: '#EF4444' },
  { key: 'ช่างกระจก/อลูมิเนียม', icon: 'browsers-outline', color: '#64748B' },
  { key: 'ช่างหลังคา', icon: 'home-outline', color: '#B45309' },
  { key: 'ช่างสำรวจ', icon: 'navigate-outline', color: '#7C3AED' },
  { key: 'คนงานทั่วไป', icon: 'body-outline', color: '#6B7280' },
  { key: 'ผู้ควบคุมเครื่องจักร', icon: 'settings-outline', color: '#475569' },
  { key: 'อื่นๆ', icon: 'ellipsis-horizontal-circle-outline', color: '#9CA3AF' },
];

// ประเภทงาน (สำหรับบันทึกสถิติ) — ค่าที่เก็บใน DB คือ key ภาษาไทย
const WORK_TYPES = [
  { key: 'ผูกเหล็ก', icon: 'construct-outline', color: '#3B82F6' },
  { key: 'เทปูน', icon: 'cube-outline', color: '#8B5CF6' },
  { key: 'ก่ออิฐ', icon: 'grid-outline', color: '#F59E0B' },
  { key: 'ฉาบปูน', icon: 'layers-outline', color: '#10B981' },
  { key: 'งานไม้', icon: 'hammer-outline', color: '#EC4899' },
  { key: 'งานไฟฟ้า', icon: 'flash-outline', color: '#F97316' },
  { key: 'งานประปา', icon: 'water-outline', color: '#06B6D4' },
  { key: 'งานทาสี', icon: 'color-palette-outline', color: '#10B981' },
  { key: 'งานกระเบื้อง', icon: 'apps-outline', color: '#EC4899' },
  { key: 'งานฝ้า', icon: 'resize-outline', color: '#A855F7' },
  { key: 'งานเชื่อม', icon: 'flame-outline', color: '#EF4444' },
  { key: 'อื่นๆ', icon: 'ellipsis-horizontal-outline', color: '#6B7280' },
];

// ============================================================
// Helpers
// ============================================================
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

// ============================================================
// Main
// ============================================================
export default function WorkerStatsScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [activeTab, setActiveTab] = useState('individual');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [workerForm, setWorkerForm] = useState({ name: '', role: '', customRole: '', age: '', phone: '', avatarUri: '' });
  const [recordForm, setRecordForm] = useState({ workType: 'ผูกเหล็ก', date: '', output: '', quality: '' });
  const [saving, setSaving] = useState(false);

  // ── Load ──
  const loadData = async () => {
    try { setWorkers(await getWorkersWithRecords()); }
    catch (e) { console.log('Load error:', e); }
  };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  // ── Image Picker ──
  const pickImage = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์ในตั้งค่า', [
        { text: 'ยกเลิก' },
        { text: 'เปิดตั้งค่า', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await fn({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setWorkerForm(p => ({ ...p, avatarUri: result.assets[0].uri }));
    }
  };

  const showImageOptions = () => {
    Alert.alert('เลือกรูปภาพ', '', [
      { text: 'ถ่ายรูป', onPress: () => pickImage(true) },
      { text: 'เลือกจากคลัง', onPress: () => pickImage(false) },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  };

  // ── Add Worker ──
  const handleAddWorker = async () => {
    if (!workerForm.name.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อช่าง');
    if (!workerForm.role) return Alert.alert('แจ้งเตือน', 'กรุณาเลือกตำแหน่งงาน');
    const finalRole = workerForm.role === 'อื่นๆ' ? (workerForm.customRole.trim() || 'อื่นๆ') : workerForm.role;
    const age = parseInt(workerForm.age) || 0;
    setSaving(true);
    try {
      await insertWorker({
        name: workerForm.name.trim(),
        role: finalRole,
        age,
        phone: workerForm.phone.trim(),
        avatarUri: workerForm.avatarUri,
      });
      setWorkerForm({ name: '', role: '', customRole: '', age: '', phone: '', avatarUri: '' });
      setShowAddWorker(false);
      await loadData();
      Alert.alert('สำเร็จ', 'เพิ่มช่างเรียบร้อย');
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setSaving(false); }
  };

  // ── Add Record ──
  const handleAddRecord = async () => {
    if (!selectedWorker) return;
    const output = parseFloat(recordForm.output);
    const quality = parseFloat(recordForm.quality);
    if (isNaN(output) || isNaN(quality)) return Alert.alert('แจ้งเตือน', 'กรุณากรอกตัวเลข');
    if (output < 0 || output > 100 || quality < 0 || quality > 100) return Alert.alert('แจ้งเตือน', 'คะแนน 0-100');
    setSaving(true);
    try {
      const today = recordForm.date.trim() || new Date().toISOString().split('T')[0];
      await insertWorkerRecord(selectedWorker.id, recordForm.workType, today, output, quality);
      setRecordForm({ workType: 'ผูกเหล็ก', date: '', output: '', quality: '' });
      setShowAddRecord(false);
      await loadData();
      Alert.alert('สำเร็จ', `บันทึกสถิติ ${selectedWorker.name} เรียบร้อย`);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setSaving(false); }
  };

  // ── Delete Worker ──
  const handleDelete = (w) => {
    Alert.alert('ลบช่าง', `ลบ "${w.name}" และสถิติทั้งหมด?`, [
      { text: 'ยกเลิก' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
        await deleteWorker(w.id); setShowDetail(false); setSelectedWorker(null); await loadData();
      }},
    ]);
  };

  // ── Avatar ──
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

  // ── Ranked workers ──
  const ranked = [...workers].map(w => ({ ...w, score: getScore(w) })).sort((a, b) => b.score - a.score);

  // ============================================================
  // TAB: รายบุคคล
  // ============================================================
  const renderIndividual = () => (
    <View>
      <Button title="เพิ่มช่างใหม่" icon="person-add-outline" onPress={() => {
        setWorkerForm({ name: '', role: '', customRole: '', age: '', phone: '', avatarUri: '' });
        setShowAddWorker(true);
      }} style={{ marginBottom: 16 }} />

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
                <Text style={{ fontSize: 13, color: C.textSec }}>{w.role || '-'}{w.age ? ` • ${w.age} ปี` : ''}</Text>
              </View>
              <Badge label={`เกรด ${grade.label}`} color={grade.color} bg={grade.bg} />
            </View>
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 12, color: C.textSec }}>ผลผลิต</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{avgOut}%</Text>
              </View>
              <ProgressBar progress={avgOut} height={7} color="#3B82F6" />
            </View>
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 12, color: C.textSec }}>คุณภาพ</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{avgQ}%</Text>
              </View>
              <ProgressBar progress={avgQ} height={7} color="#10B981" />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: C.textLight }}>สถิติ {w.records.length} รายการ</Text>
              <TouchableOpacity onPress={() => { setSelectedWorker(w); setRecordForm({ workType: 'ผูกเหล็ก', date: '', output: '', quality: '' }); setShowAddRecord(true); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary + '10', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <Ionicons name="add-circle-outline" size={14} color={C.primary} />
                <Text style={{ fontSize: 11, color: C.primary, fontWeight: '600', marginLeft: 4 }}>เพิ่มสถิติ</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ยังไม่มีช่าง" subtitle="กดเพิ่มช่างใหม่ด้านบน" />}
    </View>
  );

  // ============================================================
  // TAB: ภาพรวมทีม
  // ============================================================
  const renderTeam = () => (
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

      {/* สรุปตามประเภทงาน */}
      {workers.length > 0 && (
        <>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginTop: 20, marginBottom: 12 }}>สรุปตามประเภทงาน</Text>
          {WORK_TYPES.map(wt => {
            // ใช้ r.work_type (ชื่อจาก DB)
            const recs = workers.flatMap(w => w.records).filter(r => r.work_type === wt.key);
            if (!recs.length) return null;
            const avg = calcAvg(recs, 'output');
            return (
              <Card key={wt.key}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: wt.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={wt.icon} size={20} color={wt.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{wt.key}</Text>
                    <Text style={{ fontSize: 12, color: C.textSec }}>{recs.length} รายการ • เฉลี่ย {avg}%</Text>
                  </View>
                  <ProgressBar progress={avg} height={6} color={wt.color} style={{ width: 80 }} />
                </View>
              </Card>
            );
          })}
        </>
      )}
    </View>
  );

  // ============================================================
  // MODAL: เพิ่มช่าง
  // ============================================================
  const renderAddWorkerModal = () => (
    <Modal visible={showAddWorker} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={[s.modal, { maxHeight: '90%' }]}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>เพิ่มช่างใหม่</Text>
            <TouchableOpacity onPress={() => setShowAddWorker(false)}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* รูปถ่าย */}
            <Text style={s.label}>รูปถ่ายช่าง</Text>
            <TouchableOpacity onPress={showImageOptions} style={s.photoArea}>
              {workerForm.avatarUri ? (
                <View style={{ alignItems: 'center' }}>
                  <Image source={{ uri: workerForm.avatarUri }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 8 }} />
                  <Text style={{ fontSize: 13, color: C.primary, fontWeight: '600' }}>แตะเพื่อเปลี่ยนรูป</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Ionicons name="camera-outline" size={32} color={C.textLight} />
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSec }}>ถ่ายรูปหรือเลือกจากคลัง</Text>
                  <Text style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>(ไม่บังคับ)</Text>
                </View>
              )}
            </TouchableOpacity>

            <Input label="ชื่อ-นามสกุล *" value={workerForm.name} onChangeText={v => setWorkerForm(p => ({ ...p, name: v }))} placeholder="เช่น สมชาย ใจดี" icon="person-outline" />

            {/* ตำแหน่ง picker */}
            <Text style={s.label}>ตำแหน่งงาน *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {ROLES.map(r => {
                const sel = workerForm.role === r.key;
                return (
                  <TouchableOpacity key={r.key} onPress={() => setWorkerForm(p => ({ ...p, role: r.key }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? r.color : '#F3F4F6', borderWidth: sel ? 0 : 1, borderColor: C.border }}>
                    <Ionicons name={r.icon} size={14} color={sel ? '#fff' : r.color} />
                    <Text style={{ color: sel ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{r.key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {workerForm.role === 'อื่นๆ' && (
              <Input label="ระบุตำแหน่ง" value={workerForm.customRole} onChangeText={v => setWorkerForm(p => ({ ...p, customRole: v }))} placeholder="กรอกตำแหน่ง" icon="create-outline" />
            )}

            <Input label="อายุ (ปี)" value={workerForm.age} onChangeText={v => setWorkerForm(p => ({ ...p, age: v }))} placeholder="เช่น 35" keyboardType="numeric" icon="calendar-outline" />
            <Input label="เบอร์โทร (ไม่บังคับ)" value={workerForm.phone} onChangeText={v => setWorkerForm(p => ({ ...p, phone: v }))} placeholder="08x-xxx-xxxx" keyboardType="phone-pad" icon="call-outline" />

            <Button title="บันทึกช่าง" onPress={handleAddWorker} loading={saving} icon="checkmark-circle" style={{ marginTop: 8 }} />
            <Button title="ยกเลิก" variant="outline" onPress={() => setShowAddWorker(false)} style={{ marginTop: 8, marginBottom: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // MODAL: เพิ่มสถิติ
  // ============================================================
  const renderAddRecordModal = () => (
    <Modal visible={showAddRecord} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>เพิ่มสถิติ — {selectedWorker?.name}</Text>
            <TouchableOpacity onPress={() => setShowAddRecord(false)}><Ionicons name="close" size={24} color={C.textSec} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.label}>ประเภทงาน</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {WORK_TYPES.map(wt => {
                const sel = recordForm.workType === wt.key;
                return (
                  <TouchableOpacity key={wt.key} onPress={() => setRecordForm(p => ({ ...p, workType: wt.key }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? wt.color : '#F3F4F6', borderWidth: sel ? 0 : 1, borderColor: C.border }}>
                    <Ionicons name={wt.icon} size={14} color={sel ? '#fff' : wt.color} />
                    <Text style={{ color: sel ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{wt.key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Input label="วันที่" value={recordForm.date} onChangeText={v => setRecordForm(p => ({ ...p, date: v }))} placeholder="YYYY-MM-DD (เว้น = วันนี้)" icon="calendar-outline" />
            <Input label="คะแนนผลผลิต (0-100) *" value={recordForm.output} onChangeText={v => setRecordForm(p => ({ ...p, output: v }))} placeholder="เช่น 85" keyboardType="numeric" icon="trending-up-outline" />
            <Input label="คะแนนคุณภาพ (0-100) *" value={recordForm.quality} onChangeText={v => setRecordForm(p => ({ ...p, quality: v }))} placeholder="เช่น 90" keyboardType="numeric" icon="star-outline" />
            <Button title="บันทึกสถิติ" onPress={handleAddRecord} loading={saving} icon="checkmark-circle" />
            <Button title="ยกเลิก" variant="outline" onPress={() => setShowAddRecord(false)} style={{ marginTop: 8, marginBottom: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // MODAL: รายละเอียดช่าง
  // ============================================================
  const renderDetailModal = () => {
    if (!selectedWorker) return null;
    const avgO = calcAvg(selectedWorker.records, 'output');
    const avgQ = calcAvg(selectedWorker.records, 'quality');
    const score = getScore(selectedWorker);
    const grade = getGrade(score);

    // จัดกลุ่มตาม work_type (field จาก DB)
    const byType = {};
    selectedWorker.records.forEach(r => {
      const t = r.work_type || 'อื่นๆ';
      if (!byType[t]) byType[t] = [];
      byType[t].push(r);
    });

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
                <Text style={{ fontSize: 14, color: C.textSec }}>{selectedWorker.role}{selectedWorker.age ? ` • ${selectedWorker.age} ปี` : ''}</Text>
                {selectedWorker.phone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="call-outline" size={14} color={C.textLight} />
                    <Text style={{ fontSize: 13, color: C.textSec, marginLeft: 4 }}>{selectedWorker.phone}</Text>
                  </View>
                ) : null}
                <Badge label={`เกรด ${grade.label} • ${score}%`} color={grade.color} bg={grade.bg} />
              </View>

              <Card>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>สรุปภาพรวม</Text>
                {[
                  { label: 'ผลผลิตเฉลี่ย', val: avgO, color: '#3B82F6' },
                  { label: 'คุณภาพเฉลี่ย', val: avgQ, color: '#10B981' },
                  { label: 'คะแนนรวม', val: score, color: grade.color },
                ].map((d, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ fontSize: 13, color: C.textSec }}>{d.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: d.color }}>{d.val}%</Text>
                    </View>
                    <ProgressBar progress={d.val} height={8} color={d.color} />
                  </View>
                ))}
              </Card>

              {Object.keys(byType).length > 0 && (
                <Card>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>สถิติแยกประเภทงาน</Text>
                  {Object.entries(byType).map(([type, recs]) => {
                    const wt = WORK_TYPES.find(w => w.key === type) || { icon: 'ellipsis-horizontal-outline', color: '#6B7280' };
                    return (
                      <View key={type} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                        <Ionicons name={wt.icon} size={18} color={wt.color} style={{ width: 28 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{type}</Text>
                          <Text style={{ fontSize: 11, color: C.textLight }}>{recs.length} รายการ</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: wt.color }}>{calcAvg(recs, 'output')}%</Text>
                      </View>
                    );
                  })}
                </Card>
              )}

              <Card>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>ประวัติล่าสุด</Text>
                {selectedWorker.records.length > 0 ? selectedWorker.records.slice(0, 10).map((rec, i) => (
                  <View key={rec.id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < 9 ? 1 : 0, borderBottomColor: C.border }}>
                    <Text style={{ fontSize: 12, color: C.textLight, width: 80 }}>{rec.date || '-'}</Text>
                    <Text style={{ flex: 1, fontSize: 13, color: C.text }}>{rec.work_type}</Text>
                    <Badge label={`${rec.output}`} color="#3B82F6" bg="#DBEAFE" />
                    <View style={{ width: 6 }} />
                    <Badge label={`${rec.quality}`} color="#10B981" bg="#D1FAE5" />
                  </View>
                )) : <Text style={{ fontSize: 13, color: C.textLight, textAlign: 'center', paddingVertical: 16 }}>ยังไม่มีข้อมูล</Text>}
              </Card>

              <Button title="เพิ่มสถิติ" icon="add-circle-outline" onPress={() => {
                setShowDetail(false);
                setRecordForm({ workType: 'ผูกเหล็ก', date: '', output: '', quality: '' });
                setTimeout(() => setShowAddRecord(true), 300);
              }} style={{ marginTop: 4 }} />
              <Button title="ลบช่าง" variant="danger" icon="trash-outline" onPress={() => handleDelete(selectedWorker)} style={{ marginTop: 8, marginBottom: 20 }} />
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
        {activeTab === 'individual' ? renderIndividual() : renderTeam()}
      </ScrollView>

      {renderAddWorkerModal()}
      {renderAddRecordModal()}
      {renderDetailModal()}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text, flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 },
  photoArea: { alignItems: 'center', paddingVertical: 20, marginBottom: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 16, backgroundColor: '#FAFAFA' },
});