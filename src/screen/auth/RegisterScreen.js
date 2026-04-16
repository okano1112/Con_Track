// src/screens/auth/RegisterScreen.js
// ============================================================
// หน้าสมัครสมาชิก (ข้อมูล 8 อย่างตามที่ Sky ต้องการ)
// 1. Custom ID (เช็คซ้ำ real-time)
// 2. Username (email)
// 3. Password + Confirm
// 4. เบอร์โทร
// 5. ชื่อ-นามสกุลจริง
// 6. ที่อยู่
// 7. รูปถ่าย (optional)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../AuthContext';
import { C, Button, Input } from '../../Components';
import {
  validateEmail, validatePassword, validateCustomId,
  checkCustomIdAvailable
} from '../../authService';
import { supabase } from '../../supabaseClient';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();

  // ============================================================
  // State สำหรับแต่ละฟิลด์
  // ============================================================
  const [form, setForm] = useState({
    customId: '',
    email: '',
    password: '',
    confirm: '',
    fullName: '',
    phone: '',
    address: '',
    avatarUri: '',  // path ในมือถือ (จะ upload ตอนกดสมัคร)
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // ============================================================
  // State สำหรับเช็ค custom_id ซ้ำ (real-time)
  // ============================================================
  const [customIdStatus, setCustomIdStatus] = useState('idle');
  // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

  // helper: แก้ field
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ============================================================
  // เช็ค custom_id real-time (delay 500ms หลังหยุดพิมพ์)
  // ============================================================
  useEffect(() => {
    if (!form.customId) {
      setCustomIdStatus('idle');
      return;
    }

    // ตรวจรูปแบบก่อน
    const formatErr = validateCustomId(form.customId);
    if (formatErr) {
      setCustomIdStatus('invalid');
      return;
    }

    // รอ 500ms ก่อนยิง API
    setCustomIdStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await checkCustomIdAvailable(form.customId);
        setCustomIdStatus(available ? 'available' : 'taken');
      } catch (e) {
        setCustomIdStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [form.customId]);

  // ============================================================
  // เลือกรูปโปรไฟล์
  // ============================================================
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์เข้าถึงรูปภาพ');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      u('avatarUri', result.assets[0].uri);
    }
  };

  // ============================================================
  // Upload รูปไป Supabase Storage
  // คืนค่า public URL (หรือ '' ถ้าไม่มีรูป)
  // ============================================================
  const uploadAvatar = async (userId) => {
    if (!form.avatarUri) return '';

    try {
      // อ่านไฟล์เป็น blob
      const response = await fetch(form.avatarUri);
      const blob = await response.blob();

      const fileExt = form.avatarUri.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // upload
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (error) throw error;

      // ดึง public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e) {
      console.log('Upload avatar error:', e);
      return ''; // ถ้า upload ไม่ได้ก็ข้ามไป (ไม่ blocker)
    }
  };

  // ============================================================
  // ตรวจสอบฟอร์มก่อนส่ง
  // ============================================================
  const validateForm = () => {
    const errs = {};

    errs.customId = validateCustomId(form.customId);
    if (customIdStatus === 'taken') errs.customId = 'ID นี้ถูกใช้แล้ว';

    errs.email = validateEmail(form.email);
    errs.password = validatePassword(form.password);

    if (form.password !== form.confirm) {
      errs.confirm = 'รหัสผ่านไม่ตรงกัน';
    }

    if (!form.fullName.trim()) errs.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    if (!form.phone.trim()) errs.phone = 'กรุณากรอกเบอร์โทร';

    // ลบคีย์ที่ไม่มี error
    Object.keys(errs).forEach(k => !errs[k] && delete errs[k]);

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ============================================================
  // กดสมัคร
  // ============================================================
  const handleRegister = async () => {
    if (!validateForm()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาตรวจสอบฟอร์มอีกครั้ง');
      return;
    }

    setLoading(true);
    try {
      // 1. สมัครก่อน (ยังไม่มีรูป)
      await register({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        customId: form.customId.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        avatarUrl: '', // จะอัปโหลดทีหลัง
      });

      // 2. ถ้ามีรูป → upload แล้ว update profile
      if (form.avatarUri) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const avatarUrl = await uploadAvatar(user.id);
          if (avatarUrl) {
            await supabase.from('profiles')
              .update({ avatar_url: avatarUrl })
              .eq('id', user.id);
          }
        }
      }

      // 3. แจ้งสำเร็จ → ไปหน้า verify
      Alert.alert(
        'สมัครสำเร็จ',
        `ส่งอีเมลยืนยันไปที่ ${form.email} แล้ว กรุณาตรวจสอบและคลิกลิงก์ยืนยัน`,
        [{
          text: 'ตกลง',
          onPress: () => navigation.navigate('VerifyEmail', { email: form.email })
        }]
      );
    } catch (e) {
      Alert.alert('สมัครไม่สำเร็จ', e.message);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // สถานะ custom_id (แสดงข้างช่อง)
  // ============================================================
  const renderCustomIdStatus = () => {
    if (customIdStatus === 'checking') {
      return <ActivityIndicator size="small" color={C.primary} />;
    }
    if (customIdStatus === 'available') {
      return <Ionicons name="checkmark-circle" size={20} color={C.success} />;
    }
    if (customIdStatus === 'taken' || customIdStatus === 'invalid') {
      return <Ionicons name="close-circle" size={20} color={C.danger} />;
    }
    return null;
  };

  const customIdError = customIdStatus === 'taken'
    ? `"${form.customId}" ถูกใช้แล้ว`
    : customIdStatus === 'invalid'
    ? 'ใช้ a-z, 0-9, . _ - (4-20 ตัว)'
    : errors.customId;

  // ============================================================
  // UI
  // ============================================================
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
          สมัครสมาชิก
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

        {/* ================== รูปโปรไฟล์ ================== */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
            {form.avatarUri ? (
              <Image
                source={{ uri: form.avatarUri }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            ) : (
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: '#E5E7EB',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: C.border, borderStyle: 'dashed',
              }}>
                <Ionicons name="camera" size={32} color={C.textLight} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: C.textSec, marginTop: 8 }}>
            รูปโปรไฟล์ (ไม่บังคับ)
          </Text>
        </View>

        {/* ================== Custom ID ================== */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>
            ID ของคุณ (เหมือน Line ID) *
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#F9FAFB', borderRadius: 10,
            borderWidth: 1, borderColor: customIdError ? C.danger : C.border,
            paddingHorizontal: 12,
          }}>
            <Text style={{ color: C.textLight, fontSize: 15, marginRight: 4 }}>@</Text>
            <View style={{ flex: 1 }}>
              <Input
                value={form.customId}
                onChangeText={v => u('customId', v.toLowerCase().replace(/\s/g, ''))}
                placeholder="somchai_eng"
              />
            </View>
            <View style={{ marginLeft: 8 }}>
              {renderCustomIdStatus()}
            </View>
          </View>
          {customIdError && (
            <Text style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>
              {customIdError}
            </Text>
          )}
          {customIdStatus === 'available' && (
            <Text style={{ color: C.success, fontSize: 12, marginTop: 4 }}>
              ✓ ใช้ได้! ID นี้ว่าง
            </Text>
          )}
        </View>

        {/* ================== Email ================== */}
        <Input
          label="อีเมล *"
          value={form.email}
          onChangeText={v => u('email', v)}
          placeholder="example@email.com"
          keyboardType="email-address"
          icon="mail-outline"
          error={errors.email}
        />

        {/* ================== Password ================== */}
        <Input
          label="รหัสผ่าน *"
          value={form.password}
          onChangeText={v => u('password', v)}
          placeholder="อย่างน้อย 6 ตัว"
          secureTextEntry
          icon="lock-closed-outline"
          error={errors.password}
        />

        <Input
          label="ยืนยันรหัสผ่าน *"
          value={form.confirm}
          onChangeText={v => u('confirm', v)}
          placeholder="กรอกอีกครั้ง"
          secureTextEntry
          icon="lock-closed-outline"
          error={errors.confirm}
        />

        {/* เส้นแบ่ง */}
        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12 }} />

        {/* ================== ข้อมูลส่วนตัว ================== */}
        <Input
          label="ชื่อ-นามสกุลจริง *"
          value={form.fullName}
          onChangeText={v => u('fullName', v)}
          placeholder="เช่น สมชาย ใจดี"
          icon="id-card-outline"
          error={errors.fullName}
        />

        <Input
          label="เบอร์โทร *"
          value={form.phone}
          onChangeText={v => u('phone', v)}
          placeholder="08x-xxx-xxxx"
          keyboardType="phone-pad"
          icon="call-outline"
          error={errors.phone}
        />

        <Input
          label="ที่อยู่"
          value={form.address}
          onChangeText={v => u('address', v)}
          placeholder="เช่น 99 ถ.สุขุมวิท กทม."
          icon="location-outline"
          multiline
        />

        <Button
          title="สมัครสมาชิก"
          onPress={handleRegister}
          loading={loading}
          icon="person-add-outline"
          style={{ marginTop: 8 }}
        />

        <Button
          title="ยกเลิก"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8, marginBottom: 40 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}