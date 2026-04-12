// src/screens/ProfileScreen.js

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';
import { Header, Card, FormInput, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../db';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.full_name || '',
    position: user?.position || '',
    department: user?.department || '',
    phone: user?.phone || '',
  });
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ');
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile(user.id, {
        fullName: form.fullName,
        position: form.position,
        department: form.department,
        phone: form.phone,
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

  const handleLogout = () => {
    Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ออกจากระบบ', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header with avatar */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 30, alignItems: 'center' }}>
        <View style={{
          width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>
          <Ionicons name="person" size={40} color="#F59E0B" />
        </View>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{user?.full_name || '-'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 }}>
          {user?.position || 'ไม่ระบุตำแหน่ง'} • {user?.department || 'ไม่ระบุแผนก'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {editing ? (
          <>
            <Card>
              <FormInput label="ชื่อ-นามสกุล" value={form.fullName} onChangeText={v => update('fullName', v)} icon="person-outline" />
              <FormInput label="ตำแหน่ง" value={form.position} onChangeText={v => update('position', v)} icon="briefcase-outline" />
              <FormInput label="แผนก" value={form.department} onChangeText={v => update('department', v)} icon="business-outline" />
              <FormInput label="เบอร์โทร" value={form.phone} onChangeText={v => update('phone', v)} keyboardType="phone-pad" icon="call-outline" />
            </Card>
            <Button title="บันทึก" onPress={handleSave} loading={loading} icon="checkmark-circle" />
            <Button title="ยกเลิก" variant="outline" onPress={() => setEditing(false)} style={{ marginTop: 8 }} />
          </>
        ) : (
          <>
            <Card>
              {[
                { icon: 'person-outline', label: 'ชื่อ', value: user?.full_name },
                { icon: 'at-outline', label: 'ชื่อผู้ใช้', value: user?.username },
                { icon: 'briefcase-outline', label: 'ตำแหน่ง', value: user?.position || '-' },
                { icon: 'business-outline', label: 'แผนก', value: user?.department || '-' },
                { icon: 'call-outline', label: 'เบอร์โทร', value: user?.phone || '-' },
                { icon: 'shield-outline', label: 'บทบาท', value: user?.role === 'admin' ? 'ผู้ดูแลระบบ' : user?.role === 'manager' ? 'ผู้จัดการ' : 'สมาชิก' },
              ].map((row, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                  borderBottomWidth: i < 5 ? 1 : 0, borderBottomColor: COLORS.borderLight,
                }}>
                  <Ionicons name={row.icon} size={20} color={COLORS.textLight} style={{ width: 32 }} />
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary, width: 80 }}>{row.label}</Text>
                  <Text style={{ fontSize: 15, color: COLORS.text, flex: 1, fontWeight: '500' }}>{row.value}</Text>
                </View>
              ))}
            </Card>

            {/* Menu */}
            <Card>
              {[
                { icon: 'create-outline', label: 'แก้ไขข้อมูล', onPress: () => setEditing(true), color: COLORS.primary },
                { icon: 'key-outline', label: 'เปลี่ยนรหัสผ่าน', onPress: () => Alert.alert('เร็วๆ นี้', 'ฟีเจอร์เปลี่ยนรหัสผ่านกำลังพัฒนา'), color: COLORS.primary },
                { icon: 'information-circle-outline', label: 'เกี่ยวกับแอป', onPress: () => Alert.alert('OTS Manager', 'เวอร์ชัน 2.0.0\nพัฒนาด้วย Expo + SQLite\n\nข้อมูลเก็บในเครื่อง\nพร้อม sync กับ server ทีหลัง'), color: COLORS.primary },
                { icon: 'log-out-outline', label: 'ออกจากระบบ', onPress: handleLogout, color: COLORS.danger },
              ].map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={item.onPress}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
                    borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: COLORS.borderLight,
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={item.color} style={{ width: 32 }} />
                  <Text style={{ flex: 1, fontSize: 15, color: item.color === COLORS.danger ? COLORS.danger : COLORS.text }}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              ))}
            </Card>
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}
