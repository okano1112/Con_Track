// RegisterScreen.js
// ============================================================
// หน้าสมัครสมาชิก (login auto หลังสมัคร)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  TextInput 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './AuthContext';
import { C, Button, Input } from './Components';
import {
  validateEmail, validatePassword, validateCustomId, validatePhone,
  checkCustomIdAvailable
} from './authService';
import { supabase } from './supabaseClient';

export default function RegisterScreen({ navigation }) {
  const { register, refreshUser } = useAuth();

  const [form, setForm] = useState({
    customId: '', email: '', password: '', confirm: '',
    fullName: '', phone: '', address: '', avatarUri: '', avatarBase64: '',  // ✅ เพิ่ม avatarBase64
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [customIdStatus, setCustomIdStatus] = useState('idle');

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!form.customId) { setCustomIdStatus('idle'); return; }
    const formatErr = validateCustomId(form.customId);
    if (formatErr) { setCustomIdStatus('invalid'); return; }

    setCustomIdStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await checkCustomIdAvailable(form.customId);
        setCustomIdStatus(available ? 'available' : 'taken');
      } catch (e) { setCustomIdStatus('idle'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.customId]);

  const pickImage = async () => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์เข้าถึงรูปภาพ');
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, 
    aspect: [1, 1], 
    quality: 0.7,
    base64: true,  // ✅ ขอ base64 มาด้วย
  });
  if (!result.canceled && result.assets?.[0]) {
    u('avatarUri', result.assets[0].uri);
    u('avatarBase64', result.assets[0].base64);  // ✅ เก็บ base64 ไว้ใช้
  }
};

  const uploadAvatar = async (userId) => {
    if (!form.avatarUri || !form.avatarBase64) return '';
    try {
      const filePath = `${userId}/avatar-${Date.now()}.jpg`;

      // ✅ ใช้ base64 แปลงเป็น binary (เหมือนที่แก้ใน ProfileScreen)
      const binaryString = atob(form.avatarBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes.buffer, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      return `${data.publicUrl}?t=${Date.now()}`;  // ✅ เพิ่ม cache busting
    } catch (e) {
      console.log('Upload avatar error:', e);
      return '';
    }
  };

  const validateForm = () => {
    const errs = {};
    errs.customId = validateCustomId(form.customId);
    if (customIdStatus === 'taken') errs.customId = 'ID นี้ถูกใช้แล้ว';
    errs.email = validateEmail(form.email);
    errs.password = validatePassword(form.password);
    if (form.password !== form.confirm) errs.confirm = 'รหัสผ่านไม่ตรงกัน';
    if (!form.fullName.trim()) errs.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    errs.phone = validatePhone(form.phone);  // ✅ ใช้ validatePhone แทน

    Object.keys(errs).forEach(k => !errs[k] && delete errs[k]);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาตรวจสอบฟอร์มอีกครั้ง');
      return;
    }

    setLoading(true);
    try {
      await register({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        customId: form.customId.trim().toLowerCase(),
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        avatarUrl: '',
      });

      if (form.avatarUri) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const avatarUrl = await uploadAvatar(user.id);
          if (avatarUrl) {
            await supabase.from('profiles')
              .update({ avatar_url: avatarUrl }).eq('id', user.id);
            // ✅ Refresh user หลัง upload รูปเสร็จ เพื่อให้ context ได้ avatar_url ล่าสุด
            await refreshUser();
          }
        }
      } else {
        // ไม่มีรูป ก็ refresh เพื่อโหลด profile ที่เพิ่งสร้าง
        await refreshUser();
      }
      // onAuthStateChange จะเปลี่ยน user → navigator เข้า Main เอง
    } catch (e) {
      Alert.alert('สมัครไม่สำเร็จ', e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCustomIdStatus = () => {
    if (customIdStatus === 'checking')
      return <ActivityIndicator size="small" color={C.primary} />;
    if (customIdStatus === 'available')
      return <Ionicons name="checkmark-circle" size={20} color={C.success} />;
    if (customIdStatus === 'taken' || customIdStatus === 'invalid')
      return <Ionicons name="close-circle" size={20} color={C.danger} />;
    return null;
  };

  const customIdError = customIdStatus === 'taken'
    ? `"${form.customId}" ถูกใช้แล้ว`
    : customIdStatus === 'invalid'
    ? 'ใช้ a-z, 0-9, . _ - (4-20 ตัว)'
    : errors.customId;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <View style={{
        backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>สมัครสมาชิก</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

        {/* รูปโปรไฟล์ */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
            {form.avatarUri ? (
              <Image source={{ uri: form.avatarUri }}
                style={{ width: 100, height: 100, borderRadius: 50 }} />
            ) : (
              <View style={{
                width: 100, height: 100, borderRadius: 50, backgroundColor: '#E5E7EB',
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

        {/* Custom ID */}
<View style={{ marginBottom: 16 }}>
  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>
    ID ของคุณ (เหมือน Line ID) *
  </Text>
  <View style={{
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1, 
    borderColor: customIdError ? C.danger : C.border,
    paddingHorizontal: 12,
    height: 50,  // กำหนดความสูงให้เท่าช่องอื่นๆ
  }}>
    <Text style={{ color: C.textLight, fontSize: 15, marginRight: 4 }}>@</Text>
    <TextInput
      style={{
        flex: 1,
        fontSize: 15,
        color: C.text,
        paddingVertical: 0,  // ลบ padding เพื่อให้ align ตรง
      }}
      value={form.customId}
      onChangeText={v => u('customId', v.toLowerCase().replace(/\s/g, ''))}
      placeholder="somchai_eng"
      placeholderTextColor={C.textLight}
      autoCapitalize="none"
      autoCorrect={false}
    />
    <View style={{ marginLeft: 8, width: 24, alignItems: 'center' }}>
      {renderCustomIdStatus()}
    </View>
  </View>
  {customIdError && (
    <Text style={{ color: C.danger, fontSize: 12, marginTop: 4 }}>{customIdError}</Text>
  )}
  {customIdStatus === 'available' && (
    <Text style={{ color: C.success, fontSize: 12, marginTop: 4 }}>✓ ใช้ได้! ID นี้ว่าง</Text>
  )}
</View>

        <Input label="อีเมล *" value={form.email} onChangeText={v => u('email', v)}
          placeholder="example@email.com" keyboardType="email-address"
          icon="mail-outline" error={errors.email} />

        <Input label="รหัสผ่าน *" value={form.password} onChangeText={v => u('password', v)}
          placeholder="อย่างน้อย 6 ตัว และมีตัวอักษร" secureTextEntry
          icon="lock-closed-outline" error={errors.password} />

        <Input label="ยืนยันรหัสผ่าน *" value={form.confirm}
          onChangeText={v => u('confirm', v)}
          placeholder="กรอกอีกครั้ง" secureTextEntry
          icon="lock-closed-outline" error={errors.confirm} />

        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 12 }} />

        <Input label="ชื่อ-นามสกุลจริง *" value={form.fullName}
          onChangeText={v => u('fullName', v)}
          placeholder="เช่น สมชาย ใจดี" icon="id-card-outline"
          error={errors.fullName} />

        <Input label="เบอร์โทร *" value={form.phone} 
          onChangeText={v => u('phone', v.replace(/[^0-9]/g, ''))}
          placeholder="08x-xxx-xxxx" keyboardType="phone-pad"
          icon="call-outline" error={errors.phone} maxLength={10} />

        <Input label="ที่อยู่" value={form.address} onChangeText={v => u('address', v)}
          placeholder="เช่น 99 ถ.สุขุมวิท กทม." icon="location-outline" multiline />

        <Button title="สมัครสมาชิก" onPress={handleRegister} loading={loading}
          icon="person-add-outline" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()}
          style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}