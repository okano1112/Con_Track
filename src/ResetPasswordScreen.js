// ResetPasswordScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, Button, Input } from './Components';
import { validatePassword, updatePassword } from './authService';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const { clearRecovery } = useAuth();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        return;
      }

      // รอ PASSWORD_RECOVERY event จาก deep link handler ใน App.js
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setReady(true);
          subscription.unsubscribe();
        }
      });
      return () => subscription.unsubscribe();
    };
    checkSession();
  }, []);

  const handleReset = async () => {
    const err = validatePassword(password);
    if (err) { Alert.alert('แจ้งเตือน', err); return; }
    if (password !== confirm) { Alert.alert('แจ้งเตือน', 'รหัสผ่านไม่ตรงกัน'); return; }

    setLoading(true);
    try {
      await updatePassword(password);
      clearRecovery();
      Alert.alert('สำเร็จ! 🎉', 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่', [
        { text: 'เข้าสู่ระบบ', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: C.danger + '15',
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Ionicons name="alert-circle-outline" size={40} color={C.danger} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 12 }}>
          ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว
        </Text>
        <Text style={{ fontSize: 14, color: C.textSec, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
          ลิงก์รีเซ็ตรหัสผ่านใช้ได้ครั้งเดียวและมีอายุ 1 ชั่วโมง{'\n'}
          กรุณาขอลิงก์ใหม่อีกครั้ง
        </Text>
        <Button title="ขอลิงก์ใหม่" icon="refresh-outline"
          onPress={() => navigation.navigate('ForgotPassword')}
          style={{ width: '100%', marginBottom: 8 }} />
        <Button title="กลับหน้า Login" variant="outline"
          onPress={() => navigation.navigate('Login')}
          style={{ width: '100%' }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">

        <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: C.primary + '15',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Ionicons name="lock-open-outline" size={40} color={C.primary} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>
            ตั้งรหัสผ่านใหม่
          </Text>
          <Text style={{ fontSize: 13, color: C.textSec, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            กรอกรหัสผ่านใหม่ที่ต้องการ{'\n'}อย่างน้อย 6 ตัวและมีตัวอักษร
          </Text>
        </View>

        <Input
          label="รหัสผ่านใหม่"
          value={password}
          onChangeText={setPassword}
          placeholder="อย่างน้อย 6 ตัว และมีตัวอักษร"
          secureTextEntry
          icon="lock-closed-outline"
        />
        <Input
          label="ยืนยันรหัสผ่านใหม่"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="กรอกอีกครั้ง"
          secureTextEntry
          icon="lock-closed-outline"
        />

        <Button title="บันทึกรหัสผ่านใหม่" onPress={handleReset}
          loading={loading} icon="checkmark-circle-outline" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline"
          onPress={() => { clearRecovery(); navigation.navigate('Login'); }}
          style={{ marginTop: 8 }} />

      </ScrollView>
    </KeyboardAvoidingView>
  );
}