// src/screens/AddDocumentScreen.js

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, DOC_CATEGORY_MAP } from '../constants';
import { Header, Card, FormInput, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { createDocument } from '../db';

export default function AddDocumentScreen({ route, navigation }) {
  const { projectId } = route.params;
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', category: 'other', notes: '', fileType: 'pdf',
  });
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อเอกสาร');
      return;
    }
    setLoading(true);
    try {
      await createDocument({
        projectId,
        uploadedBy: user?.id,
        name: form.name,
        category: form.category,
        fileUri: '', // จะเพิ่ม file picker ทีหลัง
        fileSize: 0,
        fileType: form.fileType,
        notes: form.notes,
      });
      Alert.alert('สำเร็จ', 'เพิ่มเอกสารเรียบร้อย', [
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
      <Header title="เพิ่มเอกสาร" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <FormInput label="ชื่อเอกสาร *" value={form.name} onChangeText={v => update('name', v)}
          placeholder="เช่น แบบแปลน ชั้น 1" icon="document-text-outline" />

        <FormInput label="หมายเหตุ" value={form.notes} onChangeText={v => update('notes', v)}
          placeholder="รายละเอียดเพิ่มเติม" multiline icon="chatbubble-outline" />

        <FormInput label="ประเภทไฟล์" value={form.fileType} onChangeText={v => update('fileType', v)}
          placeholder="เช่น pdf, jpg, dwg" icon="attach-outline" />

        {/* Category Picker */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>หมวดหมู่</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(DOC_CATEGORY_MAP).map(([key, val]) => {
              const selected = form.category === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => update('category', key)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: selected ? val.color : '#F3F4F6',
                    borderWidth: selected ? 0 : 1, borderColor: COLORS.border,
                  }}
                >
                  <Ionicons name={val.icon} size={14} color={selected ? '#fff' : val.color} />
                  <Text style={{ color: selected ? '#fff' : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                    {val.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Placeholder for file picker */}
        <Card style={{ marginBottom: 16 }}>
          <TouchableOpacity
            style={{ alignItems: 'center', paddingVertical: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 12 }}
            onPress={() => Alert.alert('แจ้งเตือน', 'ฟีเจอร์เลือกไฟล์จะเพิ่มเร็วๆ นี้\n(ต้องใช้ expo-document-picker)')}
          >
            <Ionicons name="cloud-upload-outline" size={36} color={COLORS.textLight} />
            <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 8 }}>แตะเพื่อเลือกไฟล์</Text>
            <Text style={{ color: COLORS.textLight, fontSize: 12, marginTop: 4 }}>PDF, JPG, DWG (เร็วๆ นี้)</Text>
          </TouchableOpacity>
        </Card>

        <Button title="บันทึกเอกสาร" onPress={handleSave} loading={loading} icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
