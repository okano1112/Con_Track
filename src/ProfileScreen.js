// ProfileScreen.js
// ============================================================
// หน้าโปรไฟล์ - แก้ไขข้อมูล, เปลี่ยนรูป, ออกจากระบบ
// ============================================================

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './AuthContext';
import { updateProfile } from './authService';
import { supabase } from './supabaseClient';
import { C, Card, Button, Input } from './Components';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.full_name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์เข้าถึงรูปภาพ');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploading(true);
    try {
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const filePath = `${user.id}/avatar-${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await updateProfile({ avatarUrl: data.publicUrl });
      await refreshUser();
      Alert.alert('สำเร็จ', 'เปลี่ยนรูปโปรไฟล์เรียบร้อย');
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.fullName.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ');
    setLoading(true);
    try {
      await updateProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
      await refreshUser();
      setEditing(false);
      Alert.alert('สำเร็จ', 'อัปเดตข้อมูลเรียบร้อย');
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        backgroundColor: C.primary, paddingTop: 50, paddingBottom: 30, alignItems: 'center'
      }}>
        <TouchableOpacity onPress={changeAvatar} disabled={uploading} activeOpacity={0.7}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }}
              style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }} />
          ) : (
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 12
            }}>
              <Ionicons name="person" size={40} color={C.accent} />
            </View>
          )}
          <View style={{
            position: 'absolute', bottom: 12, right: -4,
            backgroundColor: C.accent, borderRadius: 10,
            width: 24, height: 24, alignItems: 'center', justifyContent: 'center'
          }}>
            <Ionicons name={uploading ? 'hourglass' : 'camera'} size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
          {user?.full_name || '-'}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>
          @{user?.custom_id || '-'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {editing ? (
          <>
            <Card>
              <Input label="ชื่อ-นามสกุล" value={form.fullName}
                onChangeText={v => u('fullName', v)} icon="person-outline" />
              <Input label="เบอร์โทร" value={form.phone}
                onChangeText={v => u('phone', v)}
                keyboardType="phone-pad" icon="call-outline" />
              <Input label="ที่อยู่" value={form.address}
                onChangeText={v => u('address', v)}
                multiline icon="location-outline" />
            </Card>
            <Button title="บันทึก" onPress={save} loading={loading} icon="checkmark-circle" />
            <Button title="ยกเลิก" variant="outline" onPress={() => {
              setForm({
                fullName: user?.full_name || '',
                phone: user?.phone || '',
                address: user?.address || '',
              });
              setEditing(false);
            }} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Card>
              {[
                { label: 'ชื่อ', value: user?.full_name, icon: 'person-outline' },
                { label: 'ID', value: user?.custom_id ? `@${user.custom_id}` : '-', icon: 'at-outline' },
                { label: 'อีเมล', value: user?.email, icon: 'mail-outline' },
                { label: 'เบอร์โทร', value: user?.phone || '-', icon: 'call-outline' },
                { label: 'ที่อยู่', value: user?.address || '-', icon: 'location-outline' },
              ].map((r, i, arr) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                  borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                  borderBottomColor: '#F3F4F6'
                }}>
                  <Ionicons name={r.icon} size={18} color={C.textLight} style={{ width: 28 }} />
                  <Text style={{ width: 70, color: C.textSec, fontSize: 13 }}>{r.label}</Text>
                  <Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: '500' }}
                    numberOfLines={2}>
                    {r.value}
                  </Text>
                </View>
              ))}
            </Card>

            <Card>
              <TouchableOpacity onPress={() => setEditing(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
                }}>
                <Ionicons name="create-outline" size={20} color={C.primary} style={{ width: 32 }} />
                <Text style={{ flex: 1, fontSize: 15, color: C.text }}>แก้ไขข้อมูล</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textLight} />
              </TouchableOpacity>

             <TouchableOpacity 
  onPress={async () => {
    try {
      const { syncAll, getPendingCount, getFailedCount, retryFailed } = require('./syncEngine');
      const pending = await getPendingCount();
      const failed = await getFailedCount();
      
      Alert.alert(
        'สถานะ Sync',
        `รอ sync: ${pending} รายการ\nล้มเหลว: ${failed} รายการ\n\nต้องการบังคับ sync ทั้งหมดเลยมั้ย?`,
        [
          { text: 'ยกเลิก' },
          {
            text: 'Retry รายการล้มเหลว',
            onPress: async () => {
              const r = await retryFailed();
              Alert.alert('ผลลัพธ์', `push: ${r.pushed}\nfailed: ${r.failed}`);
            }
          },
          {
            text: 'Force Sync ทั้งหมด',
            onPress: async () => {
              const r = await syncAll();
              Alert.alert('ผลลัพธ์', JSON.stringify(r, null, 2));
            }
          }
        ]
      );
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    }
  }}
  style={{
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
  }}>
  <Ionicons name="cloud-upload-outline" size={20} color={C.info} style={{ width: 32 }} />
  <Text style={{ flex: 1, fontSize: 15, color: C.text }}>🔧 ตรวจสอบ Sync</Text>
  <Ionicons name="chevron-forward" size={18} color={C.textLight} />
</TouchableOpacity>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}