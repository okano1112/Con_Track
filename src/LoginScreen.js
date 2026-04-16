// LoginScreen.js
// ============================================================
// หน้าเข้าสู่ระบบ
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { C, Button, Input } from './Components';
import { validateEmail, validatePassword } from './authService';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleLogin = async () => {
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr || passErr) {
      setErrors({ email: emailErr, password: passErr });
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: C.primary }}>

        {/* Logo */}
        <View style={{ alignItems: 'center', paddingTop: 80, paddingBottom: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Ionicons name="construct" size={40} color={C.accent} />
          </View>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>ConTrack</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>
            ระบบจัดการงานก่อสร้าง
          </Text>
        </View>

        {/* Form */}
        <View style={{
          flex: 1, backgroundColor: '#fff',
          borderTopLeftRadius: 30, borderTopRightRadius: 30,
          paddingHorizontal: 24, paddingTop: 32,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 24 }}>
            เข้าสู่ระบบ
          </Text>

          <Input label="อีเมล" value={email} onChangeText={setEmail}
            placeholder="example@email.com" icon="mail-outline"
            keyboardType="email-address" error={errors.email} />

          <Input label="รหัสผ่าน" value={password} onChangeText={setPassword}
            placeholder="อย่างน้อย 6 ตัว" secureTextEntry
            icon="lock-closed-outline" error={errors.password} />

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={{ alignSelf: 'flex-end', marginBottom: 16 }}>
            <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>
              ลืมรหัสผ่าน?
            </Text>
          </TouchableOpacity>

          <Button title="เข้าสู่ระบบ" onPress={handleLogin}
            loading={loading} icon="log-in-outline" />

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: C.textSec }}>
              ยังไม่มีบัญชี?{' '}
              <Text style={{ color: C.primary, fontWeight: '600' }}>สมัครสมาชิก</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}