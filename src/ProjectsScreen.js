// ProjectsScreen.js
// ============================================================
// รวมหน้าโครงการ (List + Add + Detail + AddTask + AddDocument)
// v6: ขยายฟอร์มสร้างโครงการ 4 section + BOQ + invite code
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, KeyboardAvoidingView, Platform,
  Modal, Share, Clipboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from './AuthContext';
import {
  C, Card, Button, Input, Badge, ProgressBar, Empty, Header,
  STATUS, TASK_STATUS, PRIORITY, DOC_CAT
} from './Components';
import * as DB from './db';

// ประเภทโครงการ
const PROJECT_TYPES = [
  { key: 'building', label: 'อาคาร', icon: 'business-outline' },
  { key: 'road', label: 'ถนน', icon: 'car-outline' },
  { key: 'utility', label: 'สาธารณูปโภค', icon: 'water-outline' },
  { key: 'bridge', label: 'สะพาน', icon: 'git-branch-outline' },
  { key: 'renovation', label: 'ปรับปรุง/รีโนเวท', icon: 'construct-outline' },
  { key: 'other', label: 'อื่นๆ', icon: 'ellipsis-horizontal' },
];

// ============================================================
// 1. ProjectsListScreen
// ============================================================
export function ProjectsListScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const all = await DB.getAllProjects(filter);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        setProjects(all.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.location || '').toLowerCase().includes(q) ||
          (p.project_code || '').toLowerCase().includes(q)
        ));
      } else {
        setProjects(all);
      }
    } catch (e) { console.log('Load projects error:', e); }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter, search]));

  const FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'active', label: 'กำลังทำ' },
    { key: 'planning', label: 'วางแผน' },
    { key: 'completed', label: 'เสร็จ' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>โครงการ</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => navigation.navigate('JoinProject')}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 8,
                flexDirection: 'row', alignItems: 'center'
              }}>
              <Ionicons name="enter-outline" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 4, fontSize: 13 }}>
                ร่วม
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('AddProject')}
              style={{
                backgroundColor: C.accent, borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 8,
                flexDirection: 'row', alignItems: 'center'
              }}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 4 }}>สร้าง</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 10, paddingHorizontal: 12, marginTop: 14
        }}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
          <TextInput value={search} onChangeText={setSearch}
            placeholder="ค้นหาชื่อ/รหัสโครงการ..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={{
              flex: 1, color: '#fff', fontSize: 15,
              paddingVertical: 10, marginLeft: 8
            }} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key}
              onPress={() => { setFilter(f.key); setSearch(''); }}
              style={{
                backgroundColor: active ? C.primary : '#fff', borderRadius: 20,
                paddingHorizontal: 16, paddingVertical: 8,
                borderWidth: active ? 0 : 1, borderColor: C.border
              }}>
              <Text style={{
                color: active ? '#fff' : C.textSec,
                fontWeight: '600', fontSize: 13
              }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>
        {projects.length > 0 ? projects.map(p => {
          const st = STATUS[p.status] || STATUS.planning;
          return (
            <Card key={p.id}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>
                    {p.name}
                  </Text>
                  {p.project_code ? (
                    <Text style={{ fontSize: 11, color: C.primary, fontWeight: '600', marginTop: 2 }}>
                      🔖 {p.project_code}
                    </Text>
                  ) : null}
                  {p.location ? (
                    <Text style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>
                      📍 {p.location}
                    </Text>
                  ) : null}
                </View>
                <Badge label={st.label} color={st.color} bg={st.bg} />
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4
                }}>
                  <Text style={{ fontSize: 12, color: C.textSec }}>ความคืบหน้า</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600' }}>{p.progress}%</Text>
                </View>
                <ProgressBar progress={p.progress} />
              </View>
              <Text style={{ fontSize: 12, color: C.textLight, marginTop: 8 }}>
                {p.done_count || 0}/{p.task_count || 0} งาน • {p.doc_count || 0} เอกสาร
                {p.boq_count > 0 ? ` • ${p.boq_count} BOQ` : ''}
              </Text>
            </Card>
          );
        }) : (
          <Empty icon="business-outline" title="ยังไม่มีโครงการ"
            subtitle="กดปุ่ม + สร้าง หรือ + ร่วม เพื่อเริ่มต้น" />
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// 2. AddProjectScreen - 4 sections ตาม spec
// ============================================================
export function AddProjectScreen({ navigation }) {
  const { user } = useAuth();
  const [section, setSection] = useState(1); // 1-4
  const [form, setForm] = useState({
    // 1. ข้อมูลพื้นฐาน
    name: '',
    projectType: 'building',
    status: 'planning',
    location: '',
    latitude: null,
    longitude: null,
    scopeOfWork: '',
    // 2. สัญญาและงบประมาณ
    contractNo: '',
    contractValue: '',
    advancePercent: '',
    retentionPercent: '5',
    // 3. แผนเวลา
    contractDate: '',
    ntpDate: '',
    durationDays: '',
    endDate: '',
    // 4. ผู้เกี่ยวข้อง
    clientName: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [pickingGPS, setPickingGPS] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState({ visible: false, field: '' });

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-calc endDate เมื่อมี ntpDate + durationDays
  React.useEffect(() => {
    if (form.ntpDate && form.durationDays) {
      try {
        const start = new Date(form.ntpDate);
        const days = parseInt(form.durationDays) || 0;
        if (days > 0 && !isNaN(start.getTime())) {
          const end = new Date(start.getTime() + days * 86400000);
          const endStr = end.toISOString().split('T')[0];
          if (endStr !== form.endDate) {
            setForm(p => ({ ...p, endDate: endStr }));
          }
        }
      } catch {}
    }
  }, [form.ntpDate, form.durationDays]);

  const pickGPS = async () => {
    setPickingGPS(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์ GPS');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [address] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const addrStr = [address?.name, address?.street, address?.subregion, address?.region]
        .filter(Boolean).join(', ');
      setForm(p => ({
        ...p,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        location: addrStr || `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
      }));
      Alert.alert('สำเร็จ', 'ปักหมุดตำแหน่งเรียบร้อย');
    } catch (e) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึง GPS ได้');
    } finally {
      setPickingGPS(false);
    }
  };

  const openDatePicker = (field) => setShowDatePicker({ visible: true, field });

  const handleDateChange = (event, selectedDate) => {
    const field = showDatePicker.field;
    setShowDatePicker({ visible: false, field: '' });
    if (selectedDate && field) {
      const iso = selectedDate.toISOString().split('T')[0];
      u(field, iso);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อโครงการ');
      setSection(1);
      return;
    }
    setLoading(true);
    try {
      const project = await DB.createProject({
        name: form.name.trim(),
        description: form.description.trim(),
        projectType: form.projectType,
        location: form.location.trim(),
        latitude: form.latitude,
        longitude: form.longitude,
        scopeOfWork: form.scopeOfWork.trim(),
        contractNo: form.contractNo.trim(),
        contractValue: parseFloat(form.contractValue) || 0,
        budget: parseFloat(form.contractValue) || 0,
        advancePercent: parseFloat(form.advancePercent) || 0,
        retentionPercent: parseFloat(form.retentionPercent) || 5,
        contractDate: form.contractDate || null,
        ntpDate: form.ntpDate || null,
        durationDays: parseInt(form.durationDays) || 0,
        startDate: form.ntpDate || null,
        endDate: form.endDate || null,
        clientName: form.clientName.trim(),
        status: form.status,
        ownerId: user?.id,
      });

      Alert.alert(
        'สร้างโครงการสำเร็จ 🎉',
        `รหัสโครงการของคุณ:\n\n${project.project_code}\n\nนำรหัสนี้ไปแชร์เพื่อเชิญคนอื่นเข้าร่วม`,
        [{ text: 'ไปที่โครงการ', onPress: () => navigation.replace('ProjectDetail', { projectId: project.id }) }]
      );
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setLoading(false);
    }
  };

  const SectionHeader = ({ num, title, active }) => (
    <TouchableOpacity onPress={() => setSection(num)}
      style={{
        flex: 1, alignItems: 'center', paddingVertical: 10,
        borderBottomWidth: 2, borderBottomColor: active ? C.primary : 'transparent'
      }}>
      <View style={{
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: active ? C.primary : '#E5E7EB',
        alignItems: 'center', justifyContent: 'center', marginBottom: 4
      }}>
        <Text style={{ color: active ? '#fff' : C.textSec, fontWeight: '700', fontSize: 13 }}>
          {num}
        </Text>
      </View>
      <Text style={{
        fontSize: 10, color: active ? C.primary : C.textSec,
        fontWeight: active ? '700' : '500', textAlign: 'center'
      }}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="สร้างโครงการใหม่"
        subtitle={`ส่วนที่ ${section} จาก 4`}
        onBack={() => navigation.goBack()} />

      {/* Section Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff' }}>
        <SectionHeader num={1} title="ข้อมูล" active={section === 1} />
        <SectionHeader num={2} title="สัญญา" active={section === 2} />
        <SectionHeader num={3} title="เวลา" active={section === 3} />
        <SectionHeader num={4} title="ผู้เกี่ยวข้อง" active={section === 4} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled">

        {/* Section 1: ข้อมูลพื้นฐาน */}
        {section === 1 && (
          <>
            <View style={{
              backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, marginBottom: 16,
              borderWidth: 1, borderColor: '#BFDBFE'
            }}>
              <Text style={{ fontSize: 12, color: '#1E40AF' }}>
                ℹ️ รหัสโครงการจะถูกสร้างอัตโนมัติ (รูปแบบ CT-YYMM-XXX){'\n'}
                สามารถใช้เป็นรหัสเชิญผู้อื่นเข้าร่วมได้
              </Text>
            </View>

            <Input label="ชื่อโครงการ *" value={form.name}
              onChangeText={v => u('name', v)}
              placeholder="เช่น อาคารพาณิชย์ 4 ชั้น เฟส 2"
              icon="business-outline" />

            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>
              ประเภทโครงการ
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PROJECT_TYPES.map(pt => {
                const sel = form.projectType === pt.key;
                return (
                  <TouchableOpacity key={pt.key} onPress={() => u('projectType', pt.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: sel ? C.primary : '#F3F4F6',
                      borderWidth: sel ? 0 : 1, borderColor: C.border
                    }}>
                    <Ionicons name={pt.icon} size={14} color={sel ? '#fff' : C.textSec} />
                    <Text style={{
                      color: sel ? '#fff' : C.textSec,
                      fontWeight: '600', fontSize: 13
                    }}>
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>
              สถานะ
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {Object.entries(STATUS).map(([k, v]) => {
                const sel = form.status === k;
                return (
                  <TouchableOpacity key={k} onPress={() => u('status', k)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: sel ? v.color : '#F3F4F6',
                      borderWidth: sel ? 0 : 1, borderColor: C.border
                    }}>
                    <Text style={{
                      color: sel ? '#fff' : C.textSec,
                      fontWeight: '600', fontSize: 13
                    }}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input label="สถานที่ตั้ง" value={form.location}
              onChangeText={v => u('location', v)}
              placeholder="เช่น 99 ถ.สุขุมวิท กทม."
              icon="location-outline" multiline />

            <Button title={pickingGPS ? 'กำลังดึงพิกัด...' : 'ปักหมุดตำแหน่งปัจจุบัน (GPS)'}
              onPress={pickGPS} loading={pickingGPS}
              icon="navigate-outline" variant="outline"
              style={{ marginBottom: 16 }} />

            {form.latitude && form.longitude && (
              <View style={{
                backgroundColor: '#D1FAE5', padding: 10, borderRadius: 8, marginBottom: 16
              }}>
                <Text style={{ fontSize: 12, color: '#047857', fontWeight: '600' }}>
                  📍 {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </Text>
              </View>
            )}

            <Input label="รายละเอียดงานเบื้องต้น (Scope of Work)"
              value={form.scopeOfWork}
              onChangeText={v => u('scopeOfWork', v)}
              placeholder="คำอธิบายสั้นๆ เกี่ยวกับงานที่จะทำ"
              multiline icon="clipboard-outline" />

            <Button title="ถัดไป — สัญญาและงบประมาณ →"
              onPress={() => setSection(2)}
              style={{ marginTop: 8, marginBottom: 40 }} />
          </>
        )}

        {/* Section 2: สัญญา */}
        {section === 2 && (
          <>
            <Input label="เลขที่สัญญา" value={form.contractNo}
              onChangeText={v => u('contractNo', v)}
              placeholder="เช่น CT-2026-001"
              icon="document-outline" />

            <Input label="มูลค่าโครงการ (บาท)" value={form.contractValue}
              onChangeText={v => u('contractValue', v)}
              placeholder="0.00" keyboardType="numeric"
              icon="cash-outline" />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input label="เงินเบิกล่วงหน้า (%)"
                  value={form.advancePercent}
                  onChangeText={v => u('advancePercent', v)}
                  placeholder="15" keyboardType="numeric"
                  icon="arrow-up-outline" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="เงินประกันผลงาน (%)"
                  value={form.retentionPercent}
                  onChangeText={v => u('retentionPercent', v)}
                  placeholder="5" keyboardType="numeric"
                  icon="shield-checkmark-outline" />
              </View>
            </View>

            {parseFloat(form.contractValue) > 0 && (
              <View style={{
                backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 16
              }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 }}>
                  สรุปเงิน
                </Text>
                {parseFloat(form.advancePercent) > 0 && (
                  <Text style={{ fontSize: 12, color: C.textSec }}>
                    • เบิกล่วงหน้า {form.advancePercent}% ={' '}
                    <Text style={{ color: C.text, fontWeight: '600' }}>
                      ฿{(parseFloat(form.contractValue) * parseFloat(form.advancePercent) / 100).toLocaleString()}
                    </Text>
                  </Text>
                )}
                {parseFloat(form.retentionPercent) > 0 && (
                  <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                    • ประกันผลงาน {form.retentionPercent}% ={' '}
                    <Text style={{ color: C.text, fontWeight: '600' }}>
                      ฿{(parseFloat(form.contractValue) * parseFloat(form.retentionPercent) / 100).toLocaleString()}
                    </Text>
                  </Text>
                )}
              </View>
            )}

            <View style={{
              backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10, marginBottom: 16,
              borderWidth: 1, borderColor: '#FCD34D'
            }}>
              <Text style={{ fontSize: 12, color: '#92400E' }}>
                💡 ข้อมูล BOQ (Bill of Quantities) สามารถเพิ่มได้หลังสร้างโครงการแล้ว{'\n'}
                ในหน้ารายละเอียดโครงการ → แท็บ "BOQ"
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="← ย้อนกลับ" variant="outline"
                onPress={() => setSection(1)} style={{ flex: 1 }} />
              <Button title="ถัดไป →" onPress={() => setSection(3)}
                style={{ flex: 1 }} />
            </View>
            <View style={{ height: 40 }} />
          </>
        )}

        {/* Section 3: แผนเวลา */}
        {section === 3 && (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>
              วันที่ลงนามสัญญา
            </Text>
            <TouchableOpacity onPress={() => openDatePicker('contractDate')}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#F9FAFB', borderRadius: 10,
                borderWidth: 1, borderColor: C.border,
                paddingHorizontal: 12, paddingVertical: 14, marginBottom: 16
              }}>
              <Ionicons name="calendar-outline" size={18} color={C.textLight}
                style={{ marginRight: 10 }} />
              <Text style={{ flex: 1, fontSize: 15, color: form.contractDate ? C.text : C.textLight }}>
                {form.contractDate || 'YYYY-MM-DD'}
              </Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>
              วันเข้าพื้นที่ / เริ่มงาน (NTP) *
            </Text>
            <TouchableOpacity onPress={() => openDatePicker('ntpDate')}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#F9FAFB', borderRadius: 10,
                borderWidth: 1, borderColor: C.border,
                paddingHorizontal: 12, paddingVertical: 14, marginBottom: 16
              }}>
              <Ionicons name="play-outline" size={18} color={C.primary}
                style={{ marginRight: 10 }} />
              <Text style={{ flex: 1, fontSize: 15, color: form.ntpDate ? C.text : C.textLight }}>
                {form.ntpDate || 'YYYY-MM-DD'}
              </Text>
            </TouchableOpacity>

            <Input label="ระยะเวลาทำงาน (วัน)"
              value={form.durationDays}
              onChangeText={v => u('durationDays', v)}
              placeholder="เช่น 365" keyboardType="numeric"
              icon="time-outline" />

            <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>
              วันสิ้นสุดสัญญา (คำนวณอัตโนมัติ)
            </Text>
            <TouchableOpacity onPress={() => openDatePicker('endDate')}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: form.endDate ? '#F0FDF4' : '#F9FAFB', borderRadius: 10,
                borderWidth: 1, borderColor: form.endDate ? '#86EFAC' : C.border,
                paddingHorizontal: 12, paddingVertical: 14, marginBottom: 16
              }}>
              <Ionicons name="flag-outline" size={18}
                color={form.endDate ? C.success : C.textLight}
                style={{ marginRight: 10 }} />
              <Text style={{ flex: 1, fontSize: 15, color: form.endDate ? C.text : C.textLight }}>
                {form.endDate || 'กรอก NTP + ระยะเวลาก่อน'}
              </Text>
            </TouchableOpacity>

            {form.ntpDate && form.endDate && (
              <View style={{
                backgroundColor: '#D1FAE5', padding: 10, borderRadius: 8, marginBottom: 16
              }}>
                <Text style={{ fontSize: 12, color: '#047857' }}>
                  ⏱️ โครงการจะกินเวลา {form.durationDays || '?'} วัน{'\n'}
                  จาก {form.ntpDate} → {form.endDate}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="← ย้อนกลับ" variant="outline"
                onPress={() => setSection(2)} style={{ flex: 1 }} />
              <Button title="ถัดไป →" onPress={() => setSection(4)}
                style={{ flex: 1 }} />
            </View>
            <View style={{ height: 40 }} />
          </>
        )}

        {/* Section 4: ผู้เกี่ยวข้อง */}
        {section === 4 && (
          <>
            <Input label="เจ้าของโครงการ (Client/Owner)"
              value={form.clientName}
              onChangeText={v => u('clientName', v)}
              placeholder="เช่น บจก. ABC Construction"
              icon="business-outline" />

            <Input label="ผู้จัดการโครงการ (PM)"
              value={user?.full_name || ''}
              onChangeText={() => {}}
              placeholder="คุณเป็น PM เริ่มต้น"
              icon="person-outline" />
            <Text style={{ fontSize: 11, color: C.textLight, marginTop: -12, marginBottom: 16 }}>
              * เริ่มต้นคุณจะเป็น PM — สามารถเปลี่ยนได้ภายหลัง
            </Text>

            <Input label="รายละเอียดเพิ่มเติม"
              value={form.description}
              onChangeText={v => u('description', v)}
              placeholder="หมายเหตุอื่นๆ"
              multiline icon="chatbubble-outline" />

            <View style={{
              backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, marginBottom: 16,
              borderWidth: 1, borderColor: '#BFDBFE'
            }}>
              <Text style={{ fontSize: 12, color: '#1E40AF' }}>
                ℹ️ ทีมงาน (วิศวกร, โฟร์แมน) สามารถเพิ่มได้หลังสร้างโครงการ{'\n'}
                โดยการ "สร้างรหัสเชิญ" ในหน้ารายละเอียดโครงการ
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="← ย้อนกลับ" variant="outline"
                onPress={() => setSection(3)} style={{ flex: 1 }} />
              <Button title="บันทึกและสร้างโครงการ" onPress={save}
                loading={loading} icon="checkmark-circle"
                style={{ flex: 1.4 }} />
            </View>
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {showDatePicker.visible && (
        <DateTimePicker
          value={form[showDatePicker.field] ? new Date(form[showDatePicker.field]) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange} />
      )}
    </KeyboardAvoidingView>
  );
}

// ============================================================
// 3. ProjectDetailScreen + ปุ่ม BOQ และ invite code
// ============================================================
export function ProjectDetailScreen({ route, navigation }) {
  const { user } = useAuth();
  const { projectId } = route.params;
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('info');
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newInvite, setNewInvite] = useState(null);
  const [inviteRole, setInviteRole] = useState('member');
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    try {
      const p = await DB.getProjectById(projectId);
      if (!p) {
        Alert.alert('ไม่พบโครงการ', 'โครงการนี้อาจถูกลบไปแล้ว');
        navigation.goBack();
        return;
      }
      setProject(p);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
      navigation.goBack();
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleGenerateInvite = async () => {
    setGenerating(true);
    try {
      const invite = await DB.createInviteCode({
        projectId,
        createdBy: user?.id,
        role: inviteRole,
        expiresInDays: 30,
      });
      setNewInvite(invite);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setGenerating(false);
    }
  };

  const shareCode = async (code) => {
    try {
      await Share.share({
        message: `มาร่วมโครงการ "${project.name}" ใน ConTrack\n\nรหัสเชิญ: ${code}\n\nเข้าแอป ConTrack → เข้าร่วมโครงการ → ใส่รหัสนี้`,
      });
    } catch (e) { /* user cancelled */ }
  };

  const copyCode = (code) => {
    try {
      Clipboard.setString(code);
      Alert.alert('คัดลอกแล้ว', `รหัส ${code} ถูกคัดลอกเรียบร้อย`);
    } catch {}
  };

  if (!project) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const st = STATUS[project.status] || STATUS.planning;
  const projectTypeLabel = PROJECT_TYPES.find(t => t.key === project.project_type)?.label || '-';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={project.name}
        subtitle={`${st.label}${project.project_code ? ' • ' + project.project_code : ''}`}
        onBack={() => navigation.goBack()}
        rightIcon="share-social-outline"
        onRight={() => setShowInviteModal(true)} />

      <View style={{
        flexDirection: 'row', backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: C.border
      }}>
        {[
          { key: 'info', label: 'ข้อมูล' },
          { key: 'tasks', label: `งาน (${project.tasks?.length || 0})` },
          { key: 'boq', label: `BOQ (${project.boqItems?.length || 0})` },
          { key: 'docs', label: `เอกสาร (${project.documents?.length || 0})` },
        ].map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key}
              onPress={() => {
                if (t.key === 'boq') {
                  navigation.navigate('BOQ', { projectId });
                } else {
                  setTab(t.key);
                }
              }}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: active ? C.primary : 'transparent'
              }}>
              <Text style={{
                fontSize: 12, fontWeight: '600',
                color: active ? C.primary : C.textSec
              }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>

        {tab === 'info' && (
          <>
            {project.project_code ? (
              <Card style={{ backgroundColor: C.primary, marginBottom: 12 }}>
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                      รหัสโครงการ
                    </Text>
                    <Text style={{
                      color: '#fff', fontSize: 22, fontWeight: '800',
                      letterSpacing: 2, marginTop: 2
                    }}>
                      {project.project_code}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => copyCode(project.project_code)}
                    style={{
                      backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 10,
                      borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6
                    }}>
                    <Ionicons name="copy-outline" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                      คัดลอก
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}

            <Card>
              <View style={{ marginBottom: 12 }}>
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6
                }}>
                  <Text style={{ color: C.textSec }}>ความคืบหน้า</Text>
                  <Text style={{ fontWeight: '700' }}>{project.progress}%</Text>
                </View>
                <ProgressBar progress={project.progress} height={10} />
              </View>
              {[
                { label: 'ประเภท', value: projectTypeLabel },
                { label: 'เลขสัญญา', value: project.contract_no },
                { label: 'มูลค่า', value: project.contract_value > 0 ? `฿${Number(project.contract_value).toLocaleString()}` : null },
                { label: 'เจ้าของ', value: project.client_name },
                { label: 'สถานที่', value: project.location },
                { label: 'NTP', value: project.ntp_date },
                { label: 'สิ้นสุด', value: project.end_date },
                { label: 'ระยะเวลา', value: project.duration_days > 0 ? `${project.duration_days} วัน` : null },
                { label: 'เบิกล่วงหน้า', value: project.advance_percent > 0 ? `${project.advance_percent}%` : null },
                { label: 'ประกันผลงาน', value: project.retention_percent > 0 ? `${project.retention_percent}%` : null },
              ].filter(r => r.value).map((r, i) => (
                <View key={i} style={{
                  flexDirection: 'row', paddingVertical: 8,
                  borderTopWidth: 1, borderTopColor: '#F3F4F6'
                }}>
                  <Text style={{ width: 110, color: C.textSec, fontSize: 13 }}>{r.label}</Text>
                  <Text style={{ flex: 1, color: C.text, fontSize: 14 }}>{r.value}</Text>
                </View>
              ))}
              {project.scope_of_work ? (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                  <Text style={{ color: C.textSec, fontSize: 12, marginBottom: 4 }}>
                    Scope of Work:
                  </Text>
                  <Text style={{ color: C.text, lineHeight: 20 }}>{project.scope_of_work}</Text>
                </View>
              ) : null}
            </Card>

            <Button title="จัดการ BOQ และเทียบผลงาน"
              onPress={() => navigation.navigate('BOQ', { projectId })}
              icon="calculator-outline" style={{ marginTop: 8 }} />

            <Button title="สร้างรหัสเชิญ" variant="outline"
              onPress={() => setShowInviteModal(true)}
              icon="share-social-outline" style={{ marginTop: 8 }} />

            <Button title="ลบโครงการ" variant="danger"
              onPress={() => {
                Alert.alert('ลบโครงการ', `ลบ "${project.name}"?`, [
                  { text: 'ยกเลิก', style: 'cancel' },
                  {
                    text: 'ลบ', style: 'destructive', onPress: async () => {
                      await DB.deleteProject(projectId);
                      navigation.goBack();
                    }
                  },
                ]);
              }}
              icon="trash-outline" style={{ marginTop: 8, marginBottom: 20 }} />
          </>
        )}

        {tab === 'tasks' && (
          <>
            <Button title="เพิ่มงาน" icon="add-circle-outline"
              onPress={() => navigation.navigate('AddTask', { projectId })}
              style={{ marginBottom: 16 }} />
            {project.tasks?.length > 0 ? project.tasks.map(task => {
              const ts = TASK_STATUS[task.status] || TASK_STATUS.todo;
              const pr = PRIORITY[task.priority] || PRIORITY.medium;
              return (
                <Card key={task.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <TouchableOpacity
                      onPress={async () => { await DB.toggleTask(task.id); load(); }}
                      style={{ marginRight: 10, marginTop: 2 }}>
                      <Ionicons
                        name={task.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={task.status === 'done' ? C.success : C.textLight} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15, fontWeight: '600', color: C.text,
                        textDecorationLine: task.status === 'done' ? 'line-through' : 'none'
                      }}>
                        {task.title}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <Badge label={ts.label} color={ts.color} bg={ts.bg} />
                        <Badge label={pr.label} color={pr.color} bg={pr.bg} />
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => Alert.alert('ลบงาน', `ลบ "${task.title}"?`, [
                        { text: 'ยกเลิก' },
                        {
                          text: 'ลบ', style: 'destructive', onPress: async () => {
                            await DB.deleteTask(task.id); load();
                          }
                        }
                      ])}>
                      <Ionicons name="trash-outline" size={18} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            }) : <Empty icon="checkbox-outline" title="ยังไม่มีงาน" />}
          </>
        )}

        {tab === 'docs' && (
          <>
            <Button title="เพิ่มเอกสาร" icon="add-circle-outline"
              onPress={() => navigation.navigate('AddDocument', { projectId })}
              style={{ marginBottom: 16 }} />
            {project.documents?.length > 0 ? project.documents.map(doc => {
              const cat = DOC_CAT[doc.category] || DOC_CAT.other;
              return (
                <Card key={doc.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name={cat.icon} size={22} color={cat.color}
                      style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>
                        {doc.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.textSec }}>{cat.label}</Text>
                    </View>
                  </View>
                </Card>
              );
            }) : <Empty icon="document-outline" title="ยังไม่มีเอกสาร" />}
          </>
        )}
      </ScrollView>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>
                เชิญเข้าร่วมโครงการ
              </Text>
              <TouchableOpacity onPress={() => { setShowInviteModal(false); setNewInvite(null); }}>
                <Ionicons name="close" size={24} color={C.textSec} />
              </TouchableOpacity>
            </View>

            {!newInvite ? (
              <>
                <Text style={{ fontSize: 13, color: C.textSec, marginBottom: 16, lineHeight: 20 }}>
                  สร้างรหัสเชิญเพื่อให้คนอื่นนำไปใส่ในหน้า "เข้าร่วมโครงการ"{'\n'}
                  รหัสมีอายุ 30 วัน
                </Text>

                <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>
                  บทบาทของผู้ถูกเชิญ
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {[
                    { key: 'engineer', label: 'วิศวกร' },
                    { key: 'foreman', label: 'โฟร์แมน' },
                    { key: 'owner', label: 'เจ้าของร่วม' },
                    { key: 'member', label: 'สมาชิกทั่วไป' },
                  ].map(r => {
                    const sel = inviteRole === r.key;
                    return (
                      <TouchableOpacity key={r.key} onPress={() => setInviteRole(r.key)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                          backgroundColor: sel ? C.primary : '#F3F4F6',
                          borderWidth: sel ? 0 : 1, borderColor: C.border
                        }}>
                        <Text style={{
                          color: sel ? '#fff' : C.textSec,
                          fontWeight: '600', fontSize: 13
                        }}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Button title="สร้างรหัสเชิญ" onPress={handleGenerateInvite}
                  loading={generating} icon="ticket-outline" />

                {project.project_code && (
                  <>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10
                    }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                      <Text style={{ paddingHorizontal: 10, color: C.textLight, fontSize: 11 }}>
                        หรือใช้รหัสโครงการ
                      </Text>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                    </View>
                    <View style={{
                      backgroundColor: C.primary, padding: 16, borderRadius: 12,
                      alignItems: 'center', marginBottom: 10
                    }}>
                      <Text style={{
                        color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 2
                      }}>
                        {project.project_code}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button title="คัดลอก" variant="outline"
                        icon="copy-outline"
                        onPress={() => copyCode(project.project_code)}
                        style={{ flex: 1 }} />
                      <Button title="แชร์" variant="outline"
                        icon="share-social-outline"
                        onPress={() => shareCode(project.project_code)}
                        style={{ flex: 1 }} />
                    </View>
                  </>
                )}
              </>
            ) : (
              <View>
                <View style={{
                  backgroundColor: '#D1FAE5', padding: 12, borderRadius: 10, marginBottom: 16
                }}>
                  <Text style={{ fontSize: 13, color: '#047857', fontWeight: '600' }}>
                    ✓ สร้างรหัสเชิญเรียบร้อย
                  </Text>
                  <Text style={{ fontSize: 11, color: '#047857', marginTop: 4 }}>
                    หมดอายุ: {new Date(newInvite.expires_at).toLocaleDateString('th-TH')}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: C.accent, padding: 24, borderRadius: 16,
                  alignItems: 'center', marginBottom: 16
                }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 8 }}>
                    รหัสเชิญ
                  </Text>
                  <Text style={{
                    color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: 4
                  }}>
                    {newInvite.code}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="คัดลอก" variant="outline"
                    icon="copy-outline"
                    onPress={() => copyCode(newInvite.code)}
                    style={{ flex: 1 }} />
                  <Button title="แชร์" icon="share-social-outline"
                    onPress={() => shareCode(newInvite.code)}
                    style={{ flex: 1 }} />
                </View>
                <Button title="ปิด" variant="outline"
                  onPress={() => { setShowInviteModal(false); setNewInvite(null); }}
                  style={{ marginTop: 8 }} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// 4. AddTaskScreen (เหมือนเดิม)
// ============================================================
export function AddTaskScreen({ route, navigation }) {
  const { projectId } = route.params;
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', status: 'todo', dueDate: ''
  });
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่องาน');
    setLoading(true);
    try {
      await DB.createTask({
        projectId,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate || null,
      });
      Alert.alert('สำเร็จ', 'เพิ่มงานเรียบร้อย',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เพิ่มงาน" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Input label="ชื่องาน *" value={form.title} onChangeText={v => u('title', v)}
          placeholder="เช่น เทฐานราก" icon="checkbox-outline" />
        <Input label="รายละเอียด" value={form.description}
          onChangeText={v => u('description', v)}
          multiline icon="document-text-outline" />
        <Input label="กำหนดเสร็จ" value={form.dueDate} onChangeText={v => u('dueDate', v)}
          placeholder="YYYY-MM-DD" icon="calendar-outline" />

        <Card>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>
            ความสำคัญ
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Object.entries(PRIORITY).map(([k, v]) => {
              const sel = form.priority === k;
              return (
                <TouchableOpacity key={k} onPress={() => u('priority', k)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                    backgroundColor: sel ? v.color : '#F3F4F6',
                    borderWidth: sel ? 0 : 1, borderColor: C.border
                  }}>
                  <Text style={{
                    color: sel ? '#fff' : C.textSec,
                    fontWeight: '600', fontSize: 12
                  }}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="บันทึก" onPress={save} loading={loading}
          icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()}
          style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// 5. AddDocumentScreen (เหมือนเดิม)
// ============================================================
export function AddDocumentScreen({ route, navigation }) {
  const { projectId } = route.params;
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', category: 'other', notes: '' });
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อเอกสาร');
    setLoading(true);
    try {
      await DB.createDocument({
        projectId,
        uploadedBy: user?.id,
        name: form.name.trim(),
        category: form.category,
        notes: form.notes.trim(),
      });
      Alert.alert('สำเร็จ', 'เพิ่มเอกสารเรียบร้อย',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เพิ่มเอกสาร" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Input label="ชื่อเอกสาร *" value={form.name} onChangeText={v => u('name', v)}
          placeholder="เช่น แบบแปลน ชั้น 1" icon="document-text-outline" />
        <Input label="หมายเหตุ" value={form.notes} onChangeText={v => u('notes', v)}
          multiline icon="chatbubble-outline" />

        <Card>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>
            หมวดหมู่
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(DOC_CAT).map(([k, v]) => {
              const sel = form.category === k;
              return (
                <TouchableOpacity key={k} onPress={() => u('category', k)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: sel ? v.color : '#F3F4F6',
                    borderWidth: sel ? 0 : 1, borderColor: C.border
                  }}>
                  <Ionicons name={v.icon} size={14} color={sel ? '#fff' : v.color} />
                  <Text style={{
                    color: sel ? '#fff' : C.textSec,
                    fontWeight: '600', fontSize: 12
                  }}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="บันทึก" onPress={save} loading={loading}
          icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()}
          style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}