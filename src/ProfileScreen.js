// ProfileScreen.js — Cloud Demo Seed
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from './AuthContext';
import { updateProfile } from './authService';
import { supabase } from './supabaseClient';
import { C, Card, Button, Input } from './Components';
import {
  seedToSupabase, deleteCloudDemoData, checkCloudDataExists,
  CLOUD_PROJECT_CODE, CLOUD_INVITE_CODE,
} from './seedSupabase';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing]           = useState(false);
  const [form, setForm]                 = useState({ fullName: user?.full_name || '', phone: user?.phone || '', address: user?.address || '' });
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [seeding, setSeeding]           = useState(false);
  const [cloudExists, setCloudExists]   = useState(null);

  useEffect(() => {
    checkCloudDataExists().then(setCloudExists).catch(() => setCloudExists(false));
  }, []);

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์เข้าถึงรูปภาพ'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const res = await fetch(result.assets[0].uri);
      const blob = await res.blob();
      const filePath = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await updateProfile({ avatarUrl: data.publicUrl });
      await refreshUser();
      Alert.alert('สำเร็จ', 'เปลี่ยนรูปโปรไฟล์เรียบร้อย');
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.fullName.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ');
    setLoading(true);
    try {
      await updateProfile({ fullName: form.fullName.trim(), phone: form.phone.trim(), address: form.address.trim() });
      await refreshUser(); setEditing(false); Alert.alert('สำเร็จ', 'อัปเดตข้อมูลเรียบร้อย');
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  const handleCloudSeed = () => {
    Alert.alert(
      `🌐 ${cloudExists ? 'อัปเดต' : 'สร้าง'}ข้อมูล Demo บน Cloud`,
      `Upsert ข้อมูลลง Supabase โดยตรง:\n\n🏗 โครงการอาคารเรียน สพฐ. 4.85 ล้านบาท\n📋 BOQ 15 รายการ (ราคาจริงปี 2568)\n📅 Gantt 12 งาน พร้อม dependencies\n✅ Tasks 8 รายการ\n👷 ช่าง 10 คน + สถิติ 39 records\n\nรหัสเชิญ: ${CLOUD_INVITE_CODE}\n\nใครก็ตาม Login แล้วใส่รหัสนี้ใน Join Project จะเห็นข้อมูลทันที`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: cloudExists ? 'อัปเดต' : 'สร้างเลย',
          onPress: async () => {
            setSeeding(true);
            try {
              const result = await seedToSupabase(user?.id);
              setCloudExists(true);
              Alert.alert('✅ สำเร็จ! ข้อมูลอยู่บน Cloud', `รหัสเชิญ: ${result.inviteCode}\n\nBOQ: ${result.stats.boq} | Gantt: ${result.stats.gantt} | ช่าง: ${result.stats.workers} | สถิติ: ${result.stats.records}\n\nทดสอบ: เปิดแอปเครื่องอื่น Login แล้วใส่ "${result.inviteCode}" ใน Join Project`);
            } catch (e) {
              Alert.alert('ผิดพลาด', e.message + '\n\nตรวจสอบ: ต้องรัน supabase_rls_fix.sql ก่อน');
            } finally { setSeeding(false); }
          },
        },
      ]
    );
  };

  const handleDeleteCloud = () => {
    Alert.alert('🗑 ลบ Demo จาก Cloud', 'ลบข้อมูลทดสอบทั้งหมดออกจาก Supabase (ถาวร)', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
        setSeeding(true);
        try { await deleteCloudDemoData(); setCloudExists(false); Alert.alert('✅ ลบแล้ว'); }
        catch (e) { Alert.alert('ผิดพลาด', e.message); }
        finally { setSeeding(false); }
      }},
    ]);
  };

  const handleSyncDebug = async () => {
    try {
      const { syncAll, getPendingCount, getFailedCount, retryFailed } = require('./syncEngine');
      const pending = await getPendingCount();
      const failed  = await getFailedCount();
      Alert.alert('🔧 Sync', `รอ sync: ${pending}\nล้มเหลว: ${failed}`, [
        { text: 'ยกเลิก' },
        { text: 'Retry ที่ล้มเหลว', onPress: async () => { const r = await retryFailed(); Alert.alert('ผลลัพธ์', `push: ${r.pushed} | failed: ${r.failed}`); }},
        { text: 'Force Sync', onPress: async () => { const r = await syncAll(); Alert.alert('Sync', `push: ${r.pushed} | pull: ${r.pulled} | failed: ${r.failed}`); }},
      ]);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 50, paddingBottom: 30, alignItems: 'center' }}>
        <TouchableOpacity onPress={changeAvatar} disabled={uploading} activeOpacity={0.7}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 12 }} />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="person" size={40} color={C.accent} />
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 12, right: -4, backgroundColor: C.accent, borderRadius: 10, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={uploading ? 'hourglass' : 'camera'} size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{user?.full_name || '-'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>@{user?.custom_id || '-'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {editing ? (
          <>
            <Card>
              <Input label="ชื่อ-นามสกุล" value={form.fullName} onChangeText={v => u('fullName', v)} icon="person-outline" />
              <Input label="เบอร์โทร"     value={form.phone}    onChangeText={v => u('phone', v)}    keyboardType="phone-pad" icon="call-outline" />
              <Input label="ที่อยู่"       value={form.address}  onChangeText={v => u('address', v)}  multiline icon="location-outline" />
            </Card>
            <Button title="บันทึก"  onPress={save} loading={loading} icon="checkmark-circle" />
            <Button title="ยกเลิก" variant="outline" onPress={() => { setForm({ fullName: user?.full_name || '', phone: user?.phone || '', address: user?.address || '' }); setEditing(false); }} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Card>
              {[
                { label: 'ชื่อ',    value: user?.full_name,                              icon: 'person-outline'   },
                { label: 'ID',      value: user?.custom_id ? `@${user.custom_id}` : '-', icon: 'at-outline'       },
                { label: 'อีเมล',   value: user?.email,                                  icon: 'mail-outline'     },
                { label: 'เบอร์',   value: user?.phone || '-',                           icon: 'call-outline'     },
                { label: 'ที่อยู่', value: user?.address || '-',                         icon: 'location-outline' },
              ].map((r, i, arr) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
                  <Ionicons name={r.icon} size={18} color={C.textLight} style={{ width: 28 }} />
                  <Text style={{ width: 70, color: C.textSec, fontSize: 13 }}>{r.label}</Text>
                  <Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: '500' }} numberOfLines={2}>{r.value}</Text>
                </View>
              ))}
            </Card>

            <Card>
              <TouchableOpacity onPress={() => setEditing(true)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Ionicons name="create-outline" size={20} color={C.primary} style={{ width: 32 }} />
                <Text style={{ flex: 1, fontSize: 15, color: C.text }}>แก้ไขข้อมูล</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textLight} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSyncDebug} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Ionicons name="cloud-upload-outline" size={20} color={C.info} style={{ width: 32 }} />
                <Text style={{ flex: 1, fontSize: 15, color: C.text }}>🔧 ตรวจสอบ Sync</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textLight} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('ออกจากระบบ', 'ยืนยัน?', [{ text: 'ยกเลิก' }, { text: 'ออก', style: 'destructive', onPress: logout }])} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                <Ionicons name="log-out-outline" size={20} color={C.danger} style={{ width: 32 }} />
                <Text style={{ flex: 1, fontSize: 15, color: C.danger }}>ออกจากระบบ</Text>
              </TouchableOpacity>
            </Card>

            {/* Cloud Demo Card */}
            <Card style={{ borderWidth: 1.5, borderColor: cloudExists ? '#86EFAC' : '#FCD34D', backgroundColor: cloudExists ? '#F0FDF4' : '#FFFBEB' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name={cloudExists ? 'cloud-done' : 'cloud-upload-outline'} size={20} color={cloudExists ? '#059669' : '#D97706'} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: cloudExists ? '#065F46' : '#92400E', marginLeft: 8 }}>
                  🧪 ข้อมูลทดสอบบน Cloud
                </Text>
                {cloudExists !== null && (
                  <View style={{ marginLeft: 'auto', backgroundColor: cloudExists ? '#D1FAE5' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: cloudExists ? '#059669' : '#B45309' }}>
                      {cloudExists ? '✓ อยู่บน Cloud แล้ว' : '✗ ยังไม่มี'}
                    </Text>
                  </View>
                )}
              </View>

              {/* รหัส */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 10, color: C.textSec }}>รหัสโครงการ</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.primary, letterSpacing: 1, marginTop: 2 }}>{CLOUD_PROJECT_CODE}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 10, color: C.textSec }}>รหัสเชิญ (ใส่ใน Join)</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#059669', letterSpacing: 1, marginTop: 2 }}>{CLOUD_INVITE_CODE}</Text>
                </View>
              </View>

              <Text style={{ fontSize: 12, color: cloudExists ? '#065F46' : '#92400E', marginBottom: 12, lineHeight: 18 }}>
                {cloudExists
                  ? `ข้อมูลอยู่บน Supabase แล้ว ✅\nใครก็ตาม Login แล้วใส่ "${CLOUD_INVITE_CODE}" ใน Join Project จะเห็นโครงการพร้อมข้อมูลทันที ไม่ต้อง sync`
                  : 'กดสร้างเพื่ออัปโหลดข้อมูลโครงการ BOQ Gantt ช่าง และสถิติขึ้น Supabase โดยตรง จากนั้นใครก็ Join ด้วยรหัสได้เลย'}
              </Text>

              <TouchableOpacity
                onPress={handleCloudSeed}
                disabled={seeding}
                style={{ backgroundColor: cloudExists ? '#059669' : '#F59E0B', padding: 13, borderRadius: 10, alignItems: 'center', marginBottom: cloudExists ? 8 : 0, opacity: seeding ? 0.6 : 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                <Ionicons name={cloudExists ? 'refresh' : 'cloud-upload'} size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                  {seeding ? '⏳ กำลังอัปโหลด...' : cloudExists ? '🔄 อัปเดตข้อมูลบน Cloud' : '🌐 สร้างข้อมูลบน Cloud'}
                </Text>
              </TouchableOpacity>

              {cloudExists && (
                <TouchableOpacity onPress={handleDeleteCloud} disabled={seeding} style={{ borderWidth: 1, borderColor: '#FCA5A5', padding: 10, borderRadius: 10, alignItems: 'center', opacity: seeding ? 0.6 : 1 }}>
                  <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 13 }}>🗑 ลบข้อมูล Demo ออกจาก Cloud</Text>
                </TouchableOpacity>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}