// src/LoginScreen.js — รวม Login + Register ไว้หน้าเดียว

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { C, Button, Input } from './Components';

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกให้ครบ');
    setLoading(true);
    try { await login(username, password); }
    catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" style={{ backgroundColor: C.primary }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', paddingTop: 80, paddingBottom: 40 }}>
          <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="construct" size={40} color={C.accent} />
          </View>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>OTS MANAGER</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>ระบบจัดการงานก่อสร้าง</Text>
        </View>

        {/* Form */}
        <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 32 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 24 }}>เข้าสู่ระบบ</Text>
          <Input label="ชื่อผู้ใช้" value={username} onChangeText={setUsername} placeholder="กรอกชื่อผู้ใช้" icon="person-outline" />
          <Input label="รหัสผ่าน" value={password} onChangeText={setPassword} placeholder="กรอกรหัสผ่าน" secureTextEntry icon="lock-closed-outline" />
          <Button title="เข้าสู่ระบบ" onPress={handleLogin} loading={loading} icon="log-in-outline" />
          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: C.textSec }}>ยังไม่มีบัญชี? <Text style={{ color: C.primary, fontWeight: '600' }}>สมัครสมาชิก</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', confirm: '', fullName: '', position: '', department: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleRegister = async () => {
    if (!form.username.trim() || !form.password || !form.fullName.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกให้ครบ');
    if (form.password.length < 4) return Alert.alert('แจ้งเตือน', 'รหัสผ่านอย่างน้อย 4 ตัว');
    if (form.password !== form.confirm) return Alert.alert('แจ้งเตือน', 'รหัสผ่านไม่ตรงกัน');
    setLoading(true);
    try { await register(form); }
    catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>สมัครสมาชิก</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Input label="ชื่อผู้ใช้ *" value={form.username} onChangeText={v => u('username', v)} placeholder="username" icon="person-outline" />
        <Input label="รหัสผ่าน *" value={form.password} onChangeText={v => u('password', v)} placeholder="อย่างน้อย 4 ตัว" secureTextEntry icon="lock-closed-outline" />
        <Input label="ยืนยันรหัสผ่าน *" value={form.confirm} onChangeText={v => u('confirm', v)} placeholder="กรอกอีกครั้ง" secureTextEntry icon="lock-closed-outline" />
        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
        <Input label="ชื่อ-นามสกุล *" value={form.fullName} onChangeText={v => u('fullName', v)} placeholder="ชื่อจริง นามสกุล" icon="id-card-outline" />
        <Input label="ตำแหน่ง" value={form.position} onChangeText={v => u('position', v)} placeholder="เช่น ผู้จัดการ" icon="briefcase-outline" />
        <Input label="แผนก" value={form.department} onChangeText={v => u('department', v)} placeholder="เช่น ฝ่ายก่อสร้าง" icon="business-outline" />
        <Input label="เบอร์โทร" value={form.phone} onChangeText={v => u('phone', v)} placeholder="08x-xxx-xxxx" keyboardType="phone-pad" icon="call-outline" />
        <Button title="สมัครสมาชิก" onPress={handleRegister} loading={loading} icon="person-add-outline" style={{ marginTop: 8 }} />
        <Button title="กลับ" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}