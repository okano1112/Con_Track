// src/screens/AddTaskScreen.js

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, PRIORITY_MAP, TASK_STATUS_MAP } from '../constants';
import { Header, Card, FormInput, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { createTask, getAllUsers } from '../db';

export default function AddTaskScreen({ route, navigation }) {
  const { projectId } = route.params;
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', status: 'todo',
    assignedTo: null, dueDate: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllUsers().then(setUsers).catch(console.log);
  }, []);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่องาน');
      return;
    }
    setLoading(true);
    try {
      await createTask({
        projectId,
        assignedTo: form.assignedTo,
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate,
      });
      Alert.alert('สำเร็จ', 'เพิ่มงานเรียบร้อย', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เพิ่มงาน" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <FormInput label="ชื่องาน *" value={form.title} onChangeText={v => update('title', v)}
          placeholder="เช่น เทฐานราก อาคาร A" icon="checkbox-outline" />

        <FormInput label="รายละเอียด" value={form.description} onChangeText={v => update('description', v)}
          placeholder="รายละเอียดเพิ่มเติม" multiline icon="document-text-outline" />

        <FormInput label="วันกำหนดเสร็จ" value={form.dueDate} onChangeText={v => update('dueDate', v)}
          placeholder="YYYY-MM-DD" icon="calendar-outline" />

        {/* Priority Picker */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>ความสำคัญ</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Object.entries(PRIORITY_MAP).map(([key, val]) => {
              const selected = form.priority === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => update('priority', key)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
                    backgroundColor: selected ? val.color : '#F3F4F6',
                    borderWidth: selected ? 0 : 1, borderColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: selected ? '#fff' : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                    {val.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Status Picker */}
        <Card style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>สถานะ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(TASK_STATUS_MAP).map(([key, val]) => {
              const selected = form.status === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => update('status', key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: selected ? val.color : '#F3F4F6',
                    borderWidth: selected ? 0 : 1, borderColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: selected ? '#fff' : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                    {val.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Assign To */}
        {users.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 10 }}>มอบหมายให้</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                onPress={() => update('assignedTo', null)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: !form.assignedTo ? COLORS.primary : '#F3F4F6',
                  borderWidth: !form.assignedTo ? 0 : 1, borderColor: COLORS.border,
                }}
              >
                <Text style={{ color: !form.assignedTo ? '#fff' : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                  ไม่ระบุ
                </Text>
              </TouchableOpacity>
              {users.map((u) => {
                const selected = form.assignedTo === u.id;
                return (
                  <TouchableOpacity
                    key={u.id}
                    onPress={() => update('assignedTo', u.id)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: selected ? COLORS.primary : '#F3F4F6',
                      borderWidth: selected ? 0 : 1, borderColor: COLORS.border,
                    }}
                  >
                    <Text style={{ color: selected ? '#fff' : COLORS.textSecondary, fontWeight: '600', fontSize: 12 }}>
                      {u.full_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        <Button title="บันทึกงาน" onPress={handleSave} loading={loading} icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
