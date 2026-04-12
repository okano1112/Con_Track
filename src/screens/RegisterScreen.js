// src/screens/RegisterScreen.js

import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { COLORS } from '../constants';
import { Button, FormInput, Header } from '../components';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm] = useState({
    username: '', password: '', confirmPassword: '',
    fullName: '', position: '', department: '', phone: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleRegister = async () => {
    if (!form.username.trim() || !form.password || !form.fullName.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อผู้ใช้ รหัสผ่าน และชื่อ-นามสกุล');
      return;
    }
    if (form.password.length < 4) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: form.username,
        password: form.password,
        fullName: form.fullName,
        position: form.position,
        department: form.department,
        phone: form.phone,
      });
      // AuthContext จัดการ navigation อัตโนมัติ
    } catch (e) {
      Alert.alert('สมัครไม่สำเร็จ', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="สมัครสมาชิก" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <FormInput label="ชื่อผู้ใช้ *" value={form.username} onChangeText={v => update('username', v)} placeholder="username" icon="person-outline" />
        <FormInput label="รหัสผ่าน *" value={form.password} onChangeText={v => update('password', v)} placeholder="อย่างน้อย 4 ตัวอักษร" secureTextEntry icon="lock-closed-outline" />
        <FormInput label="ยืนยันรหัสผ่าน *" value={form.confirmPassword} onChangeText={v => update('confirmPassword', v)} placeholder="กรอกรหัสผ่านอีกครั้ง" secureTextEntry icon="lock-closed-outline" />
        
        <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 12 }} />

        <FormInput label="ชื่อ-นามสกุล *" value={form.fullName} onChangeText={v => update('fullName', v)} placeholder="ชื่อจริง นามสกุล" icon="id-card-outline" />
        <FormInput label="ตำแหน่ง" value={form.position} onChangeText={v => update('position', v)} placeholder="เช่น ผู้จัดการโครงการ" icon="briefcase-outline" />
        <FormInput label="แผนก" value={form.department} onChangeText={v => update('department', v)} placeholder="เช่น ฝ่ายก่อสร้าง" icon="business-outline" />
        <FormInput label="เบอร์โทร" value={form.phone} onChangeText={v => update('phone', v)} placeholder="08x-xxx-xxxx" keyboardType="phone-pad" icon="call-outline" />

        <Button title="สมัครสมาชิก" onPress={handleRegister} loading={loading} icon="person-add-outline" style={{ marginTop: 8 }} />
        <Button title="กลับเข้าสู่ระบบ" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
