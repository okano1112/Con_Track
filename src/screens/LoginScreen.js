// src/screens/LoginScreen.js

import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { Button, FormInput } from '../components';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
      // AuthContext จะจัดการ navigation อัตโนมัติ
    } catch (e) {
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: COLORS.primary }}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', paddingTop: 80, paddingBottom: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Ionicons name="construct" size={40} color="#F59E0B" />
          </View>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>OTS MANAGER</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>
            ระบบจัดการงานก่อสร้าง
          </Text>
        </View>

        {/* Form */}
        <View style={{
          flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30,
          paddingHorizontal: 24, paddingTop: 32,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 24 }}>
            เข้าสู่ระบบ
          </Text>

          <FormInput
            label="ชื่อผู้ใช้"
            value={username}
            onChangeText={setUsername}
            placeholder="กรอกชื่อผู้ใช้"
            icon="person-outline"
          />

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 }}>
              รหัสผ่าน
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1,
              borderColor: COLORS.border, paddingHorizontal: 12,
            }}>
              <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <FormInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="กรอกรหัสผ่าน"
                  secureTextEntry={!showPassword}
                />
              </View>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          </View>

          <Button title="เข้าสู่ระบบ" onPress={handleLogin} loading={loading} icon="log-in-outline" />

          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            style={{ alignItems: 'center', marginTop: 20 }}
          >
            <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
              ยังไม่มีบัญชี? <Text style={{ color: COLORS.primary, fontWeight: '600' }}>สมัครสมาชิก</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
