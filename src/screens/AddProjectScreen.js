// src/screens/AddProjectScreen.js

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, STATUS_MAP } from '../constants';
import { Header, Card, FormInput, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { createProject } from '../db';

const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([key, val]) => ({ key, ...val }));

export default function AddProjectScreen({ navigation }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', description: '', location: '', budget: '',
    startDate: '', endDate: '', status: 'planning',
  });
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อโครงการ');
      return;
    }

    setLoading(true);
    try {
      await createProject({
        name: form.name,
        description: form.description,
        location: form.location,
        budget: parseFloat(form.budget) || 0,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        managerId: user?.id,
      });
      Alert.alert('สำเร็จ', 'เพิ่มโครงการเรียบร้อย', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เพิ่มโครงการ" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <FormInput label="ชื่อโครงการ *" value={form.name} onChangeText={v => update('name', v)}
          placeholder="เช่น อาคารพาณิชย์ เฟส 2" icon="business-outline" />

        <FormInput label="รายละเอียด" value={form.description} onChangeText={v => update('description', v)}
          placeholder="รายละเอียดโครงการ" multiline icon="document-text-outline" />

        <FormInput label="สถานที่" value={form.location} onChangeText={v => update('location', v)}
          placeholder="เช่น ถ.พหลโยธิน กรุงเทพฯ" icon="location-outline" />

        <FormInput label="งบประมาณ (บาท)" value={form.budget} onChangeText={v => update('budget', v)}
          placeholder="0" keyboardType="numeric" icon="cash-outline" />

        <FormInput label="วันเริ่มต้น" value={form.startDate} onChangeText={v => update('startDate', v)}
          placeholder="YYYY-MM-DD" icon="calendar-outline" />

        <FormInput label="วันสิ้นสุด" value={form.endDate} onChangeText={v => update('endDate', v)}
          placeholder="YYYY-MM-DD" icon="calendar-outline" />

        {/* Status Picker */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>สถานะ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {STATUS_OPTIONS.map((st) => {
              const selected = form.status === st.key;
              return (
                <TouchableOpacity
                  key={st.key}
                  onPress={() => update('status', st.key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: selected ? st.color : '#F3F4F6',
                    borderWidth: selected ? 0 : 1, borderColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: selected ? '#fff' : COLORS.textSecondary, fontWeight: '600', fontSize: 13 }}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="บันทึกโครงการ" onPress={handleSave} loading={loading} icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
