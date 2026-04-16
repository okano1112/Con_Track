// src/screens/auth/ForgotPasswordScreen.js
// ============================================================
// หน้าลืมรหัสผ่าน
// - user กรอก email
// - Supabase ส่งอีเมลพร้อมลิงก์รีเซ็ต (ฟรี ไม่ต้องหา SMTP เอง)
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, Button, Input } from '../../Components';
import { validateEmail, requestPasswordReset } from '../../authService';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // ============================================================
  // กดส่งอีเมลรีเซ็ต
  // ============================================================
  const handleSend = async () => {
    const err = validateEmail(email);
    if (err) {
      Alert.alert('แจ้งเตือน', err);
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (e) {
      Alert.alert('ส่งไม่สำเร็จ', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // UI: สถานะส่งแล้ว
  // ============================================================
  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{
          backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16,
          paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
        }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
            ลืมรหัสผ่าน
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: C.success + '20',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Ionicons name="mail" size={50} color={C.success} />
          </View>

          <Text style={{
            fontSize: 22, fontWeight: '700', color: C.text,
            textAlign: 'center', marginBottom: 12,
          }}>
            ส่งอีเมลแล้ว! 📧
          </Text>

          <Text style={{
            fontSize: 15, color: C.textSec,
            textAlign: 'center', lineHeight: 24, marginBottom: 32,
          }}>
            เราส่งลิงก์รีเซ็ตรหัสผ่านไปที่{'\n'}
            <Text style={{ color: C.text, fontWeight: '600' }}>{email}</Text>{'\n\n'}
            กรุณาตรวจสอบกล่องจดหมาย (รวมถึง Spam/Junk){'\n'}
            แล้วคลิกลิงก์เพื่อตั้งรหัสใหม่
          </Text>

          <Button
            title="กลับหน้า Login"
            onPress={() => navigation.navigate('Login')}
            icon="log-in-outline"
            style={{ width: '100%' }}
          />

          <TouchableOpacity
            onPress={() => { setSent(false); setEmail(''); }}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: C.primary, fontSize: 13 }}>
              ส่งอีกครั้งด้วยอีเมลอื่น
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================================
  // UI: ฟอร์มกรอกอีเมล
  // ============================================================
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{
        backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16,
        paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
          ลืมรหัสผ่าน
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 20 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: C.primary + '15',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Ionicons name="key-outline" size={40} color={C.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' }}>
            กรอกอีเมลที่ใช้สมัคร
          </Text>
          <Text style={{
            fontSize: 13, color: C.textSec,
            textAlign: 'center', marginTop: 8, lineHeight: 20,
          }}>
            เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่าน{'\n'}ไปยังอีเมลของคุณ
          </Text>
        </View>

        <Input
          label="อีเมล"
          value={email}
          onChangeText={setEmail}
          placeholder="example@email.com"
          keyboardType="email-address"
          icon="mail-outline"
        />

        <Button
          title="ส่งลิงก์รีเซ็ต"
          onPress={handleSend}
          loading={loading}
          icon="send-outline"
          style={{ marginTop: 8 }}
        />

        <Button
          title="ยกเลิก"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}