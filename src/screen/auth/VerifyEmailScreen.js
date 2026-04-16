// src/screens/auth/VerifyEmailScreen.js
// ============================================================
// หน้าแจ้งให้ไปยืนยันอีเมล (หลังสมัครใหม่)
// ============================================================

import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, Button } from '../../Components';
import { resendVerifyEmail } from '../../authService';

export default function VerifyEmailScreen({ route, navigation }) {
  const email = route?.params?.email || '';
  const [loading, setLoading] = useState(false);

  // ============================================================
  // ส่งอีเมลยืนยันใหม่
  // ============================================================
  const handleResend = async () => {
    if (!email) {
      Alert.alert('แจ้งเตือน', 'ไม่มีข้อมูลอีเมล กรุณาสมัครใหม่');
      return;
    }

    setLoading(true);
    try {
      await resendVerifyEmail(email);
      Alert.alert('ส่งแล้ว', 'ตรวจสอบอีเมลอีกครั้ง');
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{
        width: 120, height: 120, borderRadius: 60,
        backgroundColor: C.accent + '20',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        <Ionicons name="mail-open" size={60} color={C.accent} />
      </View>

      <Text style={{ fontSize: 24, fontWeight: '700', color: C.text, marginBottom: 12 }}>
        ยืนยันอีเมลของคุณ
      </Text>

      <Text style={{
        fontSize: 15, color: C.textSec,
        textAlign: 'center', lineHeight: 24, marginBottom: 8,
      }}>
        เราส่งลิงก์ยืนยันไปที่
      </Text>
      <Text style={{
        fontSize: 16, fontWeight: '600', color: C.primary,
        marginBottom: 32, textAlign: 'center',
      }}>
        {email}
      </Text>

      <Text style={{
        fontSize: 13, color: C.textLight,
        textAlign: 'center', lineHeight: 20, marginBottom: 40,
      }}>
        กรุณาคลิกลิงก์ในอีเมลเพื่อยืนยัน{'\n'}
        แล้วกลับมา login อีกครั้ง{'\n\n'}
        (อย่าลืมเช็คกล่อง Spam/Junk ด้วย)
      </Text>

      <Button
        title="ไปหน้า Login"
        onPress={() => navigation.navigate('Login')}
        icon="log-in-outline"
        style={{ width: '100%' }}
      />

      <Button
        title="ส่งอีเมลอีกครั้ง"
        variant="outline"
        onPress={handleResend}
        loading={loading}
        icon="refresh-outline"
        style={{ width: '100%', marginTop: 8 }}
      />
    </View>
  );
}