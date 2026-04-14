// src/screens/WorkerStatsScreen.js

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, RefreshControl, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { C } from './Components';
import { Card, Badge, ProgressBar, Button, Input, Empty, WORKER_ROLES as ROLES_LIST } from './Components';
import {
  getWorkersWithRecords, insertWorker, insertWorkerRecord, deleteWorker,
} from './db';

// ============================================================
// ตำแหน่งช่างในไซต์ก่อสร้างจริง
// ============================================================
const WORKER_ROLES = [
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
// Helper Functions
// ============================================================
function calcAvg(records, field) {
  if (!records || records.length === 0) return 0;
  const sum = records.reduce((a, r) => a + (r[field] || 0), 0);
  return Math.round((sum / records.length) * 10) / 10;
}

function getGrade(avg) {
  if (avg >= 90) return { label: 'A', color: '#10B981', bg: '#D1FAE5' };
  if (avg >= 75) return { label: 'B', color: '#3B82F6', bg: '#DBEAFE' };
  if (avg >= 60) return { label: 'C', color: '#F59E0B', bg: '#FEF3C7' };
  if (avg >= 40) return { label: 'D', color: '#F97316', bg: '#FFEDD5' };
  return { label: 'F', color: '#EF4444', bg: '#FEE2E2' };
}

function getOverallScore(worker) {
  const avgOutput = calcAvg(worker.records, 'output');
  const avgQuality = calcAvg(worker.records, 'quality');
  return Math.round((avgOutput + avgQuality) / 2);
}

// ============================================================
// Main Component
// ============================================================
export default function WorkerStatsScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [activeTab, setActiveTab] = useState('individual');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  // Modals
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Forms
  const [workerForm, setWorkerForm] = useState({
    name: '', role: '', customRole: '', age: '', phone: '', avatarUri: '',
  });
  const [recordForm, setRecordForm] = useState({
    workType: 'ผูกเหล็ก', date: '', output: '', quality: '',
  });
  const [saving, setSaving] = useState(false);

  // ============================================================
  // Data Loading
  // ============================================================
  const loadData = async () => {
    try {
      const data = await getWorkersWithRecords();
      setWorkers(data);
    } catch (error) {
      console.error('โหลดข้อมูลล้มเหลว:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ============================================================
  // Image Picker — ขอสิทธิ์กล้อง/คลังรูป
  // ============================================================
  const pickImageFromGallery = async () => {
    // ขอ permission คลังรูป
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'ต้องการสิทธิ์เข้าถึงคลังรูป',
        'กรุณาเปิดสิทธิ์ในการตั้งค่าเพื่อเลือกรูปภาพ',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          { text: 'เปิดตั้งค่า', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setWorkerForm(prev => ({ ...prev, avatarUri: result.assets[0].uri }));
    }
  };

  const takePhotoFromCamera = async () => {
    // ขอ permission กล้อง
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'ต้องการสิทธิ์เข้าถึงกล้อง',
        'กรุณาเปิดสิทธิ์กล้องในการตั้งค่าเพื่อถ่ายรูป',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          { text: 'เปิดตั้งค่า', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setWorkerForm(prev => ({ ...prev, avatarUri: result.assets[0].uri }));
    }
  };

  const showImagePickerOptions = () => {
    Alert.alert('เลือกรูปภาพ', 'ต้องการเพิ่มรูปช่างอย่างไร?', [
      { text: 'ถ่ายรูป', onPress: takePhotoFromCamera },
      { text: 'เลือกจากคลังรูป', onPress: pickImageFromGallery },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  };

  // ============================================================
  // Add Worker
  // ============================================================
  const handleAddWorker = async () => {
    if (!workerForm.name.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อช่าง');
      return;
    }
    if (!workerForm.role) {
      Alert.alert('แจ้งเตือน', 'กรุณาเลือกตำแหน่งงาน');
      return;
    }

    const finalRole = workerForm.role === 'อื่นๆ'
      ? (workerForm.customRole.trim() || 'อื่นๆ')
      : workerForm.role;

    const age = parseInt(workerForm.age);
    if (workerForm.age && (isNaN(age) || age < 15 || age > 80)) {
      Alert.alert('แจ้งเตือน', 'อายุต้องอยู่ระหว่าง 15 - 80 ปี');
      return;
    }

    setSaving(true);
    try {
      await insertWorker({
        name: workerForm.name.trim(),
        role: finalRole,
        avatar: '👷',
        age: age || 0,
        phone: workerForm.phone.trim(),
        avatarUri: workerForm.avatarUri,
      });
      setWorkerForm({ name: '', role: '', customRole: '', age: '', phone: '', avatarUri: '' });
      setShowAddWorker(false);
      await loadData();
      Alert.alert('สำเร็จ', 'เพิ่มช่างเรียบร้อย');
    } catch (error) {
      Alert.alert('ผิดพลาด', error.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Add Record
  // ============================================================
  const handleAddRecord = async () => {
    if (!selectedWorker) return;
    const output = parseFloat(recordForm.output);
    const quality = parseFloat(recordForm.quality);

    if (isNaN(output) || isNaN(quality)) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกคะแนนผลผลิตและคุณภาพเป็นตัวเลข');
      return;
    }
    if (output < 0 || output > 100 || quality < 0 || quality > 100) {
      Alert.alert('แจ้งเตือน', 'คะแนนต้องอยู่ระหว่าง 0 - 100');
      return;
    }

    setSaving(true);
    try {
      const today = recordForm.date.trim() || new Date().toISOString().split('T')[0];
      await insertWorkerRecord(selectedWorker.id, recordForm.workType, today, output, quality);
      setRecordForm({ workType: 'ผูกเหล็ก', date: '', output: '', quality: '' });
      setShowAddRecord(false);
      await loadData();
      Alert.alert('สำเร็จ', `บันทึกสถิติของ ${selectedWorker.name} เรียบร้อย`);
    } catch (error) {
      Alert.alert('ผิดพลาด', error.message);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Delete Worker
  // ============================================================
  const handleDeleteWorker = (worker) => {
    Alert.alert('ลบช่าง', `ต้องการลบ "${worker.name}" และสถิติทั้งหมดหรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive',
        onPress: async () => {
          await deleteWorker(worker.id);
          setShowDetail(false);
          setSelectedWorker(null);
          await loadData();
        },
      },
    ]);
  };

  // ============================================================
  // Sorted / Ranked workers
  // ============================================================
  const rankedWorkers = [...workers]
    .map(w => ({ ...w, overall: getOverallScore(w) }))
    .sort((a, b) => b.overall - a.overall);

  // ============================================================
  // Render: Worker Avatar (รูปถ่าย หรือ emoji)
  // ============================================================
  const renderAvatar = (worker, size = 48) => {
    if (worker.avatar_uri) {
      return (
        <Image
          source={{ uri: worker.avatar_uri }}
          style={{
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: '#F3F4F6',
          }}
        />
      );
    }
    return (
      <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={{ fontSize: size * 0.5 }}>{worker.avatar || '👷'}</Text>
      </View>
    );
  };

  // ============================================================
  // Render: Individual Tab
  // ============================================================
  const renderIndividualTab = () => (
    <View>
      <Button
        title="เพิ่มช่างใหม่"
        icon="person-add-outline"
        onPress={() => {
          setWorkerForm({ name: '', role: '', customRole: '', age: '', phone: '', avatarUri: '' });
          setShowAddWorker(true);
        }}
        style={{ marginBottom: 16 }}
      />

      {workers.length > 0 ? (
        workers.map((worker) => {
          const avgOutput = calcAvg(worker.records, 'output');
          const avgQuality = calcAvg(worker.records, 'quality');
          const overall = getOverallScore(worker);
          const grade = getGrade(overall);

          return (
            <Card
              key={worker.id}
              onPress={() => { setSelectedWorker(worker); setShowDetail(true); }}
            >
              {/* Header Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                {renderAvatar(worker, 48)}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>
                    {worker.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
                    {worker.role || 'ไม่ระบุตำแหน่ง'}
                    {worker.age ? ` • ${worker.age} ปี` : ''}
                  </Text>
                </View>
                <Badge label={`เกรด ${grade.label}`} color={grade.color} bg={grade.bg} />
              </View>

              {/* Stats Bars */}
              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.statLabel}>ผลผลิต</Text>
                  <Text style={styles.statValue}>{avgOutput}%</Text>
                </View>
                <ProgressBar progress={avgOutput} height={8} color="#3B82F6" />
              </View>

              <View style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.statLabel}>คุณภาพ</Text>
                  <Text style={styles.statValue}>{avgQuality}%</Text>
                </View>
                <ProgressBar progress={avgQuality} height={8} color="#10B981" />
              </View>

              {/* Footer */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: C.textLight }}>
                  สถิติทั้งหมด {worker.records.length} รายการ
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedWorker(worker);
                    setRecordForm({ workType: 'ผูกเหล็ก', date: '', output: '', quality: '' });
                    setShowAddRecord(true);
                  }}
                  style={styles.addRecordBtn}
                >
                  <Ionicons name="add-circle-outline" size={16} color={C.primary} />
                  <Text style={{ fontSize: 12, color: C.primary, fontWeight: '600', marginLeft: 4 }}>
                    เพิ่มสถิติ
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })
      ) : (
        <Empty
          icon="people-outline"
          title="ยังไม่มีข้อมูลช่าง"
          subtitle="กดปุ่มด้านบนเพื่อเพิ่มช่างคนแรก"
        />
      )}
    </View>
  );

  // ============================================================
  // Render: Team / Ranking Tab
  // ============================================================
  const renderTeamTab = () => (
    <View>
      {/* Summary Cards */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={[styles.summaryCard, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="people" size={24} color="#3B82F6" />
          <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>{workers.length}</Text>
          <Text style={styles.summaryLabel}>ช่างทั้งหมด</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="stats-chart" size={24} color="#10B981" />
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            {workers.reduce((sum, w) => sum + w.records.length, 0)}
          </Text>
          <Text style={styles.summaryLabel}>สถิติทั้งหมด</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="trophy" size={24} color="#F59E0B" />
          <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
            {rankedWorkers.length > 0 ? `${rankedWorkers[0].overall}%` : '-'}
          </Text>
          <Text style={styles.summaryLabel}>คะแนนสูงสุด</Text>
        </View>
      </View>

      {/* Ranking */}
      <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 }}>
        จัดอันดับช่าง
      </Text>

      {rankedWorkers.length > 0 ? (
        rankedWorkers.map((worker, index) => {
          const grade = getGrade(worker.overall);
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
          const isTop3 = index < 3;

          return (
            <Card key={worker.id} onPress={() => { setSelectedWorker(worker); setShowDetail(true); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.rankBadge, isTop3 && { backgroundColor: grade.bg }]}>
                  <Text style={{ fontSize: isTop3 ? 20 : 14, fontWeight: '700', color: isTop3 ? grade.color : C.textSecondary }}>
                    {medal}
                  </Text>
                </View>
                <View style={{ marginLeft: 10, marginRight: 8 }}>
                  {renderAvatar(worker, 36)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>
                    {worker.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                    {worker.role} • {worker.records.length} งาน
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: grade.color }}>
                    {worker.overall}
                  </Text>
                  <Badge label={`เกรด ${grade.label}`} color={grade.color} bg={grade.bg} />
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <ProgressBar progress={worker.overall} height={6} color={grade.color} />
              </View>
            </Card>
          );
        })
      ) : (
        <Empty icon="trophy-outline" title="ยังไม่มีข้อมูล" subtitle="เพิ่มช่างและสถิติการทำงานก่อน" />
      )}

      {/* Work Type Breakdown */}
      {workers.length > 0 && (
        <>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginTop: 20, marginBottom: 12 }}>
            สรุปตามประเภทงาน
          </Text>
          {WORK_TYPES.map((wt) => {
            const allRecords = workers.flatMap(w => w.records).filter(r => r.workType === wt.key);
            if (allRecords.length === 0) return null;
            const avg = calcAvg(allRecords, 'output');
            return (
              <Card key={wt.key}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: wt.color + '15', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={wt.icon} size={20} color={wt.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{wt.key}</Text>
                    <Text style={{ fontSize: 12, color: C.textSecondary }}>
                      {allRecords.length} รายการ • เฉลี่ย {avg}%
                    </Text>
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
  // Modal: Add Worker (ฟอร์มเพิ่มช่างใหม่)
  // ============================================================
  const renderAddWorkerModal = () => (
    <Modal visible={showAddWorker} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>เพิ่มช่างใหม่</Text>
            <TouchableOpacity onPress={() => setShowAddWorker(false)}>
              <Ionicons name="close" size={24} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ==================== รูปถ่ายช่าง ==================== */}
            <Text style={styles.fieldLabel}>รูปถ่ายช่าง</Text>
            <TouchableOpacity onPress={showImagePickerOptions} style={styles.photoUploadArea}>
              {workerForm.avatarUri ? (
                <View style={{ alignItems: 'center' }}>
                  <Image
                    source={{ uri: workerForm.avatarUri }}
                    style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 8 }}
                  />
                  <Text style={{ fontSize: 13, color: C.primary, fontWeight: '600' }}>
                    แตะเพื่อเปลี่ยนรูป
                  </Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <View style={{
                    width: 80, height: 80, borderRadius: 40,
                    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name="camera-outline" size={32} color={C.textLight} />
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSecondary }}>
                    ถ่ายรูปหรือเลือกจากคลัง
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                    (ไม่บังคับ — สามารถเพิ่มทีหลังได้)
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ==================== ชื่อช่าง ==================== */}
            <Input
              label="ชื่อ-นามสกุล *"
              value={workerForm.name}
              onChangeText={v => setWorkerForm(prev => ({ ...prev, name: v }))}
              placeholder="เช่น สมชาย ใจดี"
              icon="person-outline"
            />

            {/* ==================== ตำแหน่ง (Picker) ==================== */}
            <Text style={styles.fieldLabel}>ตำแหน่งงาน *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {WORKER_ROLES.map((r) => {
                const selected = workerForm.role === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setWorkerForm(prev => ({ ...prev, role: r.key }))}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: selected ? r.color : '#F3F4F6',
                      borderWidth: selected ? 0 : 1, borderColor: C.border,
                    }}
                  >
                    <Ionicons name={r.icon} size={14} color={selected ? '#fff' : r.color} />
                    <Text style={{
                      color: selected ? '#fff' : C.textSecondary,
                      fontWeight: '600', fontSize: 12,
                    }}>
                      {r.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ช่องกรอกเองถ้าเลือก "อื่นๆ" */}
            {workerForm.role === 'อื่นๆ' && (
              <Input
                label="ระบุตำแหน่ง"
                value={workerForm.customRole}
                onChangeText={v => setWorkerForm(prev => ({ ...prev, customRole: v }))}
                placeholder="กรอกตำแหน่งที่ต้องการ"
                icon="create-outline"
              />
            )}

            {/* ==================== อายุ ==================== */}
            <Input
              label="อายุ (ปี)"
              value={workerForm.age}
              onChangeText={v => setWorkerForm(prev => ({ ...prev, age: v }))}
              placeholder="เช่น 35"
              keyboardType="numeric"
              icon="calendar-outline"
            />

            {/* ==================== เบอร์โทร ==================== */}
            <Input
              label="เบอร์โทรติดต่อ (ไม่บังคับ)"
              value={workerForm.phone}
              onChangeText={v => setWorkerForm(prev => ({ ...prev, phone: v }))}
              placeholder="08x-xxx-xxxx"
              keyboardType="phone-pad"
              icon="call-outline"
            />

            {/* ==================== Buttons ==================== */}
            <Button title="บันทึกช่าง" onPress={handleAddWorker} loading={saving} icon="checkmark-circle" style={{ marginTop: 8 }} />
            <Button title="ยกเลิก" variant="outline" onPress={() => setShowAddWorker(false)} style={{ marginTop: 8, marginBottom: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // Modal: Add Record
  // ============================================================
  const renderAddRecordModal = () => (
    <Modal visible={showAddRecord} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              เพิ่มสถิติ — {selectedWorker?.name}
            </Text>
            <TouchableOpacity onPress={() => setShowAddRecord(false)}>
              <Ionicons name="close" size={24} color={C.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Work Type Picker */}
            <Text style={styles.fieldLabel}>ประเภทงาน</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {WORK_TYPES.map((wt) => {
                const selected = recordForm.workType === wt.key;
                return (
                  <TouchableOpacity
                    key={wt.key}
                    onPress={() => setRecordForm(prev => ({ ...prev, workType: wt.key }))}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: selected ? wt.color : '#F3F4F6',
                      borderWidth: selected ? 0 : 1, borderColor: C.border,
                    }}
                  >
                    <Ionicons name={wt.icon} size={14} color={selected ? '#fff' : wt.color} />
                    <Text style={{ color: selected ? '#fff' : C.textSecondary, fontWeight: '600', fontSize: 12 }}>
                      {wt.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input label="วันที่" value={recordForm.date}
              onChangeText={v => setRecordForm(prev => ({ ...prev, date: v }))}
              placeholder="YYYY-MM-DD (เว้นว่าง = วันนี้)" icon="calendar-outline" />

            <Input label="คะแนนผลผลิต (0-100) *" value={recordForm.output}
              onChangeText={v => setRecordForm(prev => ({ ...prev, output: v }))}
              placeholder="เช่น 85" keyboardType="numeric" icon="trending-up-outline" />

            <Input label="คะแนนคุณภาพ (0-100) *" value={recordForm.quality}
              onChangeText={v => setRecordForm(prev => ({ ...prev, quality: v }))}
              placeholder="เช่น 90" keyboardType="numeric" icon="star-outline" />

            <Button title="บันทึกสถิติ" onPress={handleAddRecord} loading={saving} icon="checkmark-circle" />
            <Button title="ยกเลิก" variant="outline" onPress={() => setShowAddRecord(false)} style={{ marginTop: 8, marginBottom: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================================
  // Modal: Worker Detail
  // ============================================================
  const renderDetailModal = () => {
    if (!selectedWorker) return null;

    const avgOutput = calcAvg(selectedWorker.records, 'output');
    const avgQuality = calcAvg(selectedWorker.records, 'quality');
    const overall = getOverallScore(selectedWorker);
    const grade = getGrade(overall);

    // Group records by workType
    const byType = {};
    selectedWorker.records.forEach(r => {
      if (!byType[r.workType]) byType[r.workType] = [];
      byType[r.workType].push(r);
    });

    return (
      <Modal visible={showDetail} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>รายละเอียดช่าง</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Profile Header */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                {renderAvatar(selectedWorker, 80)}
                <Text style={{ fontSize: 20, fontWeight: '700', color: C.text, marginTop: 10 }}>
                  {selectedWorker.name}
                </Text>
                <Text style={{ fontSize: 14, color: C.textSecondary, marginTop: 2 }}>
                  {selectedWorker.role || 'ไม่ระบุตำแหน่ง'}
                  {selectedWorker.age ? ` • ${selectedWorker.age} ปี` : ''}
                </Text>
                {selectedWorker.phone ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="call-outline" size={14} color={C.textLight} />
                    <Text style={{ fontSize: 13, color: C.textSecondary, marginLeft: 4 }}>
                      {selectedWorker.phone}
                    </Text>
                  </View>
                ) : null}
                <Badge
                  label={`เกรด ${grade.label} • คะแนนรวม ${overall}%`}
                  color={grade.color} bg={grade.bg}
                  style={{ marginTop: 8 }}
                />
              </View>

              {/* Overall Stats */}
              <Card>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>
                  สรุปภาพรวม
                </Text>
                <View style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.statLabel}>ผลผลิตเฉลี่ย</Text>
                    <Text style={[styles.statValue, { color: '#3B82F6' }]}>{avgOutput}%</Text>
                  </View>
                  <ProgressBar progress={avgOutput} height={10} color="#3B82F6" />
                </View>
                <View style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.statLabel}>คุณภาพเฉลี่ย</Text>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>{avgQuality}%</Text>
                  </View>
                  <ProgressBar progress={avgQuality} height={10} color="#10B981" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={styles.statLabel}>คะแนนรวม</Text>
                    <Text style={[styles.statValue, { color: grade.color }]}>{overall}%</Text>
                  </View>
                  <ProgressBar progress={overall} height={10} color={grade.color} />
                </View>
              </Card>

              {/* Records by Type */}
              {Object.entries(byType).length > 0 && (
                <Card>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>
                    สถิติแยกตามประเภทงาน
                  </Text>
                  {Object.entries(byType).map(([type, records]) => {
                    const wt = WORK_TYPES.find(w => w.key === type) || WORK_TYPES[WORK_TYPES.length - 1];
                    const typeAvg = calcAvg(records, 'output');
                    return (
                      <View key={type} style={{
                        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
                        borderBottomWidth: 1, borderBottomColor: C.borderLight,
                      }}>
                        <Ionicons name={wt.icon} size={18} color={wt.color} style={{ width: 28 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{type}</Text>
                          <Text style={{ fontSize: 11, color: C.textLight }}>{records.length} รายการ</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: wt.color }}>{typeAvg}%</Text>
                      </View>
                    );
                  })}
                </Card>
              )}

              {/* Recent Records */}
              <Card>
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 }}>
                  ประวัติล่าสุด
                </Text>
                {selectedWorker.records.length > 0 ? (
                  selectedWorker.records.slice(0, 10).map((rec, i) => (
                    <View key={rec.id || i} style={{
                      flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                      borderBottomWidth: i < Math.min(selectedWorker.records.length - 1, 9) ? 1 : 0,
                      borderBottomColor: C.borderLight,
                    }}>
                      <Text style={{ fontSize: 12, color: C.textLight, width: 80 }}>{rec.date || '-'}</Text>
                      <Text style={{ flex: 1, fontSize: 13, color: C.text }}>{rec.workType}</Text>
                      <Badge label={`${rec.output}`} color="#3B82F6" bg="#DBEAFE" icon="trending-up-outline" style={{ marginRight: 6 }} />
                      <Badge label={`${rec.quality}`} color="#10B981" bg="#D1FAE5" icon="star-outline" />
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 13, color: C.textLight, textAlign: 'center', paddingVertical: 16 }}>
                    ยังไม่มีข้อมูล
                  </Text>
                )}
              </Card>

              {/* Actions */}
              <Button
                title="เพิ่มสถิติให้ช่างคนนี้"
                icon="add-circle-outline"
                onPress={() => {
                  setShowDetail(false);
                  setRecordForm({ workType: 'ผูกเหล็ก', date: '', output: '', quality: '' });
                  setTimeout(() => setShowAddRecord(true), 300);
                }}
                style={{ marginTop: 4 }}
              />
              <Button
                title="ลบช่างคนนี้"
                variant="danger"
                icon="trash-outline"
                onPress={() => handleDeleteWorker(selectedWorker)}
                style={{ marginTop: 8, marginBottom: 20 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ============================================================
  // Main Render
  // ============================================================
  const TABS = [
    { key: 'individual', label: 'รายบุคคล', icon: 'person-outline' },
    { key: 'team', label: 'ภาพรวมทีม', icon: 'people-outline' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
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

        {/* Tab Switcher */}
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.1)',
                }}
              >
                <Ionicons name={t.icon} size={16} color={active ? C.primary : '#fff'} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? C.primary : '#fff' }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'individual' ? renderIndividualTab() : renderTeamTab()}
      </ScrollView>

      {/* Modals */}
      {renderAddWorkerModal()}
      {renderAddRecordModal()}
      {renderDetailModal()}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { fontSize: 13, color: C.textSecondary },
  statValue: { fontSize: 13, fontWeight: '700', color: C.text },
  addRecordBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: C.primary + '10',
  },
  summaryCard: {
    flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', ...{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  },
  summaryValue: { fontSize: 24, fontWeight: '800', marginTop: 6 },
  summaryLabel: { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  rankBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8,
  },
  photoUploadArea: {
    alignItems: 'center', paddingVertical: 20, marginBottom: 16,
    borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, borderRadius: 16,
    backgroundColor: '#FAFAFA',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18, fontWeight: '700', color: C.text, flex: 1,
  },
});