// src/ProfileScreen.js

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { updateProfile } from './db';
import { C, Card, Button, Input } from './Components';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.full_name || '', position: user?.position || '',
    department: user?.department || '', phone: user?.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.fullName.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ');
    setLoading(true);
    try {
      await updateProfile(user.id, form.fullName, form.position, form.department, form.phone);
      await refreshUser();
      setEditing(false);
      Alert.alert('สำเร็จ', 'อัปเดตข้อมูลเรียบร้อย');
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 50, paddingBottom: 30, alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Ionicons name="person" size={40} color={C.accent} />
        </View>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{user?.full_name || '-'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>
          {user?.position || 'ไม่ระบุตำแหน่ง'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {editing ? (
          <>
            <Card>
              <Input label="ชื่อ-นามสกุล" value={form.fullName} onChangeText={v => u('fullName', v)} icon="person-outline" />
              <Input label="ตำแหน่ง" value={form.position} onChangeText={v => u('position', v)} icon="briefcase-outline" />
              <Input label="แผนก" value={form.department} onChangeText={v => u('department', v)} icon="business-outline" />
              <Input label="เบอร์โทร" value={form.phone} onChangeText={v => u('phone', v)} keyboardType="phone-pad" icon="call-outline" />
            </Card>
            <Button title="บันทึก" onPress={save} loading={loading} icon="checkmark-circle" />
            <Button title="ยกเลิก" variant="outline" onPress={() => setEditing(false)} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Card>
              {[
                { label: 'ชื่อ', value: user?.full_name },
                { label: 'ชื่อผู้ใช้', value: user?.username },
                { label: 'ตำแหน่ง', value: user?.position || '-' },
                { label: 'แผนก', value: user?.department || '-' },
                { label: 'เบอร์โทร', value: user?.phone || '-' },
              ].map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
                  <Text style={{ width: 80, color: C.textSec, fontSize: 13 }}>{r.label}</Text>
                  <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: '500' }}>{r.value}</Text>
                </View>
              ))}
            </Card>
            <Card>
              <TouchableOpacity onPress={() => setEditing(true)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Ionicons name="create-outline" size={20} color={C.primary} style={{ width: 32 }} />
                <Text style={{ flex: 1, fontSize: 15, color: C.text }}>แก้ไขข้อมูล</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textLight} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('ออกจากระบบ', 'ต้องการออกหรือไม่?', [
                { text: 'ยกเลิก' }, { text: 'ออก', style: 'destructive', onPress: logout }
              ])} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                <Ionicons name="log-out-outline" size={20} color={C.danger} style={{ width: 32 }} />
                <Text style={{ flex: 1, fontSize: 15, color: C.danger }}>ออกจากระบบ</Text>
                <Ionicons name="chevron-forward" size={18} color={C.textLight} />
              </TouchableOpacity>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}