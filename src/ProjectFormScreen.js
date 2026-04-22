// src/ProjectFormScreen.js
// ============================================================
// หน้าสร้าง/แก้ไขโครงการ รองรับ field ครบชุด v6
// - project_code (รหัสโครงการ) พร้อม auto-suggest + validation ไม่ซ้ำ
// - ประเภทโครงการ (อาคาร, ถนน, สะพาน, ระบบ, อื่นๆ)
// - เลขสัญญา, มูลค่าสัญญา, advance%, retention%
// - วันลงนาม, NTP, ระยะเวลา (auto-calc end date)
// - ชื่อผู้ว่าจ้าง, ที่อยู่, scope of work
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C, Card, Button, Header } from './Components';
import {
  createProject, updateProject, getProjectById,
  checkProjectCodeExists,
} from './db';

// ประเภทโครงการ ตามที่ใช้จริงในวงการ
const PROJECT_TYPES = [
  { key: 'building',     label: 'อาคาร',        prefix: 'BLD' },
  { key: 'education',    label: 'อาคารเรียน',   prefix: 'EDU' },
  { key: 'road',         label: 'ถนน',         prefix: 'RD' },
  { key: 'bridge',       label: 'สะพาน',       prefix: 'BRD' },
  { key: 'utility',      label: 'งานระบบ',     prefix: 'UTL' },
  { key: 'renovation',   label: 'ปรับปรุง',    prefix: 'RNV' },
  { key: 'other',        label: 'อื่นๆ',        prefix: 'OTH' },
];

// คำนวณวันสิ้นสุดจาก NTP + duration
function calcEndDate(ntpDate, days) {
  if (!ntpDate || !days) return '';
  const d = new Date(ntpDate);
  d.setDate(d.getDate() + parseInt(days, 10) - 1);
  return d.toISOString().split('T')[0];
}

// สร้างรหัสแนะนำ เช่น EDU-68-001
function suggestCode(type, nextSeq = 1) {
  const meta = PROJECT_TYPES.find(t => t.key === type) || PROJECT_TYPES[0];
  const yearBE = String(new Date().getFullYear() + 543).slice(-2);
  return `${meta.prefix}-${yearBE}-${String(nextSeq).padStart(3, '0')}`;
}

// Format number with comma
const fmt = (n) => {
  if (n === null || n === undefined || n === '') return '';
  const num = typeof n === 'string' ? parseFloat(n.replace(/,/g, '')) : n;
  if (isNaN(num)) return '';
  return num.toLocaleString('th-TH', { maximumFractionDigits: 2 });
};
const parseNum = (s) => {
  if (typeof s !== 'string') return s;
  const v = parseFloat(s.replace(/,/g, ''));
  return isNaN(v) ? 0 : v;
};

export default function ProjectFormScreen({ navigation, route }) {
  const editingId = route?.params?.projectId;
  const isEdit = !!editingId;

  const [form, setForm] = useState({
    // ข้อมูลหลัก
    name: '',
    project_code: '',
    project_type: 'building',
    description: '',

    // สัญญา
    contract_no: '',
    contract_value: '',
    advance_percent: '15',
    retention_percent: '5',
    contract_date: '',

    // ระยะเวลา
    ntp_date: '',
    duration_days: '',
    start_date: '', // alias ntp_date สำหรับ backward compat
    end_date: '',

    // ผู้ว่าจ้าง / ตำแหน่ง
    client_name: '',
    address: '',
    scope_of_work: '',

    // อื่นๆ
    status: 'active',
  });

  const [codeError, setCodeError] = useState('');
  const [saving, setSaving] = useState(false);

  // State สำหรับ DatePicker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerField, setPickerField] = useState(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  // ฟังก์ชันเปิด DatePicker
  const openDatePicker = (field, currentDateStr) => {
    setPickerField(field);
    let d = new Date();
    if (currentDateStr) {
      const parsed = new Date(currentDateStr);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
    setPickerDate(d);
    setShowPicker(true);
  };

  // ฟังก์ชันจัดการเมื่อเลือกวันที่
  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android' || event.type === 'dismissed') {
      setShowPicker(false);
    }
    if (selectedDate) {
      setPickerDate(selectedDate);
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      update(pickerField, dateString);

      if (Platform.OS === 'ios') {
        setShowPicker(false);
      }
    }
  };

  // โหลดข้อมูลเดิมถ้าเป็นโหมดแก้ไข
  useEffect(() => {
    if (isEdit) {
      (async () => {
        try {
          const p = await getProjectById(editingId);
          if (p) {
            setForm(f => ({
              ...f,
              name: p.name || '',
              project_code: p.project_code || '',
              project_type: p.project_type || 'building',
              description: p.description || '',
              contract_no: p.contract_no || '',
              contract_value: p.contract_value ? String(p.contract_value) : '',
              advance_percent: p.advance_percent !== undefined ? String(p.advance_percent) : '15',
              retention_percent: p.retention_percent !== undefined ? String(p.retention_percent) : '5',
              contract_date: p.contract_date || '',
              ntp_date: p.ntp_date || p.start_date || '',
              duration_days: p.duration_days ? String(p.duration_days) : '',
              start_date: p.ntp_date || p.start_date || '',
              end_date: p.end_date || '',
              client_name: p.client_name || '',
              address: p.address || '',
              scope_of_work: p.scope_of_work || '',
              status: p.status || 'active',
            }));
          }
        } catch (e) {
          console.log('Load project error:', e);
        }
      })();
    }
  }, [editingId]);

  // Auto-calc end_date เมื่อเปลี่ยน NTP หรือ duration
  useEffect(() => {
    if (form.ntp_date && form.duration_days) {
      const newEnd = calcEndDate(form.ntp_date, form.duration_days);
      setForm(f => ({ ...f, end_date: newEnd, start_date: f.ntp_date }));
    }
  }, [form.ntp_date, form.duration_days]);

  // ตรวจว่ารหัสซ้ำหรือไม่ (debounced)
  const checkCode = useCallback(async (code) => {
    if (!code || code.trim().length < 3) { setCodeError(''); return; }
    try {
      const exists = await checkProjectCodeExists(code.trim(), isEdit ? editingId : null);
      setCodeError(exists ? 'รหัสนี้มีอยู่แล้ว กรุณาใช้รหัสอื่น' : '');
    } catch (e) {
      // db อาจยังไม่รองรับ — ไม่ถือว่า error
      setCodeError('');
    }
  }, [isEdit, editingId]);

  useEffect(() => {
    const t = setTimeout(() => checkCode(form.project_code), 500);
    return () => clearTimeout(t);
  }, [form.project_code, checkCode]);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // สร้างรหัสอัตโนมัติ
  const autoGenerateCode = async () => {
    const suggested = suggestCode(form.project_type, 1);
    // ลอง 999 ลำดับ
    for (let i = 1; i <= 999; i++) {
      const candidate = suggestCode(form.project_type, i);
      try {
        const exists = await checkProjectCodeExists(candidate, isEdit ? editingId : null);
        if (!exists) { update('project_code', candidate); return; }
      } catch (e) {
        update('project_code', suggested);
        return;
      }
    }
    update('project_code', suggested);
  };

  // Validation
  const validate = () => {
    if (!form.name.trim()) { Alert.alert('กรุณากรอก', 'ชื่อโครงการ'); return false; }
    if (!form.project_code.trim()) { Alert.alert('กรุณากรอก', 'รหัสโครงการ'); return false; }
    if (codeError) { Alert.alert('รหัสโครงการซ้ำ', codeError); return false; }
    if (form.contract_value && parseNum(form.contract_value) < 0) {
      Alert.alert('ข้อมูลไม่ถูกต้อง', 'มูลค่าสัญญาต้องเป็นจำนวนบวก'); return false;
    }
    const adv = parseNum(form.advance_percent);
    if (adv < 0 || adv > 100) {
      Alert.alert('ข้อมูลไม่ถูกต้อง', 'เปอร์เซ็นต์เงินล่วงหน้าต้องอยู่ระหว่าง 0-100'); return false;
    }
    const ret = parseNum(form.retention_percent);
    if (ret < 0 || ret > 100) {
      Alert.alert('ข้อมูลไม่ถูกต้อง', 'เปอร์เซ็นต์เงินประกันต้องอยู่ระหว่าง 0-100'); return false;
    }
    if (form.duration_days && parseInt(form.duration_days, 10) <= 0) {
      Alert.alert('ข้อมูลไม่ถูกต้อง', 'ระยะเวลาต้องมากกว่า 0 วัน'); return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        project_code: form.project_code.trim(),
        project_type: form.project_type,
        description: form.description.trim(),
        contract_no: form.contract_no.trim(),
        contract_value: parseNum(form.contract_value),
        advance_percent: parseNum(form.advance_percent),
        retention_percent: parseNum(form.retention_percent),
        contract_date: form.contract_date || null,
        ntp_date: form.ntp_date || null,
        start_date: form.ntp_date || null,
        duration_days: form.duration_days ? parseInt(form.duration_days, 10) : 0,
        end_date: form.end_date || null,
        client_name: form.client_name.trim(),
        address: form.address.trim(),
        scope_of_work: form.scope_of_work.trim(),
        status: form.status,
      };

      if (isEdit) {
        await updateProject(editingId, payload);
        Alert.alert('สำเร็จ', 'บันทึกการแก้ไขเรียบร้อย');
      } else {
        await createProject(payload);
        Alert.alert('สำเร็จ', 'สร้างโครงการใหม่เรียบร้อย');
      }
      navigation.goBack();
    } catch (e) {
      console.log('Save project error:', e);
      Alert.alert('ผิดพลาด', e.message || 'ไม่สามารถบันทึกข้อมูลได้');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={isEdit ? 'แก้ไขโครงการ' : 'สร้างโครงการใหม่'}
        onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>

        {/* ============ ส่วนที่ 1: ข้อมูลหลัก ============ */}
        <SectionTitle icon="business-outline" label="ข้อมูลโครงการ" />

        <Card>
          <Label required>ชื่อโครงการ</Label>
          <Input
            value={form.name}
            onChangeText={v => update('name', v)}
            placeholder="เช่น ก่อสร้างอาคารเรียน สปช.105/29" />

          <Label>รายละเอียดโครงการ</Label>
          <Input
            value={form.description}
            onChangeText={v => update('description', v)}
            placeholder="อธิบายสั้นๆ"
            multiline
            numberOfLines={3} />
        </Card>

        {/* ============ ส่วนที่ 2: รหัสและประเภท ============ */}
        <SectionTitle icon="barcode-outline" label="รหัสและประเภท" />

        <Card>
          <Label>ประเภทโครงการ</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {PROJECT_TYPES.map(t => {
              const sel = form.project_type === t.key;
              return (
                <TouchableOpacity key={t.key}
                  onPress={() => update('project_type', t.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: sel ? C.primary : '#F3F4F6',
                    borderWidth: 1, borderColor: sel ? C.primary : C.border,
                  }}>
                  <Text style={{
                    color: sel ? '#fff' : C.textSec,
                    fontWeight: '600', fontSize: 12,
                  }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Label required>รหัสโครงการ (Project Code)</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input
              value={form.project_code}
              onChangeText={v => update('project_code', v.toUpperCase())}
              placeholder="เช่น EDU-68-001"
              autoCapitalize="characters"
              style={{ flex: 1 }} />
            <TouchableOpacity onPress={autoGenerateCode}
              style={{
                paddingHorizontal: 14, justifyContent: 'center',
                backgroundColor: C.accent || '#F59E0B',
                borderRadius: 8,
              }}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {codeError ? (
            <Text style={{ color: C.danger, fontSize: 11, marginTop: 4 }}>
              ⚠️ {codeError}
            </Text>
          ) : (
            <Text style={{ color: C.textSec, fontSize: 11, marginTop: 4 }}>
              💡 รูปแบบแนะนำ: [ประเภท]-[ปี พ.ศ.2หลัก]-[ลำดับ] · กด ✨ สร้างอัตโนมัติ
            </Text>
          )}
        </Card>

        {/* ============ ส่วนที่ 3: สัญญา ============ */}
        <SectionTitle icon="document-text-outline" label="ข้อมูลสัญญา" />

        <Card>
          <Label>เลขที่สัญญา</Label>
          <Input
            value={form.contract_no}
            onChangeText={v => update('contract_no', v)}
            placeholder="เช่น สพฐ. 42/2568" />

          <Label>มูลค่าสัญญา (บาท)</Label>
          <Input
            value={form.contract_value}
            onChangeText={v => update('contract_value', v.replace(/[^\d.]/g, ''))}
            placeholder="0.00"
            keyboardType="decimal-pad" />
          {form.contract_value ? (
            <Text style={{ color: C.textSec, fontSize: 11, marginTop: 4 }}>
              = {fmt(form.contract_value)} บาท
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Label>เงินล่วงหน้า (%)</Label>
              <Input
                value={form.advance_percent}
                onChangeText={v => update('advance_percent', v.replace(/[^\d.]/g, ''))}
                placeholder="15"
                keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Label>เงินประกัน (%)</Label>
              <Input
                value={form.retention_percent}
                onChangeText={v => update('retention_percent', v.replace(/[^\d.]/g, ''))}
                placeholder="5"
                keyboardType="decimal-pad" />
            </View>
          </View>

          <Label>วันที่ลงนามสัญญา</Label>
          <DateInput
            value={form.contract_date}
            placeholder="YYYY-MM-DD (เช่น 2026-03-10)"
            onPress={() => openDatePicker('contract_date', form.contract_date)}
          />
        </Card>

        {/* ============ ส่วนที่ 4: ระยะเวลา ============ */}
        <SectionTitle icon="calendar-outline" label="ระยะเวลาก่อสร้าง" />

        <Card>
          <Label>วันเริ่มงาน (NTP - Notice to Proceed)</Label>
          <DateInput
            value={form.ntp_date}
            placeholder="YYYY-MM-DD"
            onPress={() => openDatePicker('ntp_date', form.ntp_date)}
          />

          <Label>ระยะเวลา (วัน)</Label>
          <Input
            value={form.duration_days}
            onChangeText={v => update('duration_days', v.replace(/[^\d]/g, ''))}
            placeholder="เช่น 240"
            keyboardType="number-pad" />

          {form.end_date ? (
            <View style={{
              marginTop: 14, padding: 12, borderRadius: 8,
              backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
            }}>
              <Text style={{ fontSize: 11, color: '#1E40AF', marginBottom: 2 }}>
                📅 วันสิ้นสุดโครงการ (คำนวณอัตโนมัติ)
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E40AF' }}>
                {form.end_date}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* ============ ส่วนที่ 5: ผู้ว่าจ้าง / ที่อยู่ ============ */}
        <SectionTitle icon="people-outline" label="ผู้ว่าจ้าง / สถานที่" />

        <Card>
          <Label>ชื่อผู้ว่าจ้าง</Label>
          <Input
            value={form.client_name}
            onChangeText={v => update('client_name', v)}
            placeholder="เช่น โรงเรียนบ้านหนองตะคลอง" />

          <Label>ที่อยู่โครงการ</Label>
          <Input
            value={form.address}
            onChangeText={v => update('address', v)}
            placeholder="ที่อยู่เต็ม (ใช้กับพยากรณ์อากาศด้วย)"
            multiline
            numberOfLines={2} />

          <Label>ขอบเขตงาน (Scope of Work)</Label>
          <Input
            value={form.scope_of_work}
            onChangeText={v => update('scope_of_work', v)}
            placeholder="สรุปงานที่ต้องทำ"
            multiline
            numberOfLines={4} />
        </Card>

        {/* ============ ปุ่มบันทึก ============ */}
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !!codeError}
            style={{
              backgroundColor: saving || codeError ? '#9CA3AF' : C.primary,
              padding: 16, borderRadius: 12, alignItems: 'center',
            }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้างโครงการ'}
            </Text>
          </TouchableOpacity>
        </View>

        {showPicker && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============ Subcomponents ============
function SectionTitle({ icon, label }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      marginTop: 20, marginBottom: 8,
    }}>
      <Ionicons name={icon} size={18} color={C.primary} />
      <Text style={{
        fontSize: 13, fontWeight: '700',
        color: C.text, marginLeft: 8,
      }}>
        {label}
      </Text>
    </View>
  );
}

function Label({ children, required }) {
  return (
    <Text style={{
      fontSize: 12, fontWeight: '600',
      color: C.textSec, marginBottom: 4, marginTop: 10,
    }}>
      {children}{required && <Text style={{ color: C.danger }}> *</Text>}
    </Text>
  );
}

function Input({ style, multiline, ...props }) {
  return (
    <TextInput
      style={[{
        borderWidth: 1, borderColor: C.border,
        borderRadius: 8, padding: 10,
        fontSize: 14, color: C.text,
        backgroundColor: '#fff',
        minHeight: multiline ? 70 : 44,
        textAlignVertical: multiline ? 'top' : 'center',
      }, style]}
      multiline={multiline}
      placeholderTextColor={C.textLight}
      {...props}
    />
  );
}

function DateInput({ value, placeholder, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderWidth: 1, borderColor: C.border,
        borderRadius: 8, padding: 10,
        backgroundColor: '#fff', minHeight: 44,
        justifyContent: 'center'
      }}
    >
      <Text style={{ color: value ? C.text : C.textLight, fontSize: 14 }}>
        {value || placeholder}
      </Text>
    </TouchableOpacity>
  );
}