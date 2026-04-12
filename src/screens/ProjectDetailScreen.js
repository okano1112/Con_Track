// src/screens/ProjectDetailScreen.js

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, STATUS_MAP, TASK_STATUS_MAP, PRIORITY_MAP, DOC_CATEGORY_MAP } from '../constants';
import { Header, Card, Badge, Button, EmptyState, ProgressBar } from '../components';
import { getProjectById, deleteProject, toggleTaskStatus, deleteTask } from '../db';

export default function ProjectDetailScreen({ route, navigation }) {
  const { projectId } = route.params;
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');

  const load = async () => {
    try {
      const data = await getProjectById(projectId);
      setProject(data);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleDelete = () => {
    Alert.alert('ลบโครงการ', `ต้องการลบ "${project.name}" หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive',
        onPress: async () => {
          await deleteProject(projectId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleToggleTask = async (taskId) => {
    await toggleTaskStatus(taskId);
    load();
  };

  const handleDeleteTask = (taskId, title) => {
    Alert.alert('ลบงาน', `ลบ "${title}"?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await deleteTask(taskId); load(); } },
    ]);
  };

  if (!project) return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;

  const st = STATUS_MAP[project.status] || STATUS_MAP.planning;
  const tabs = [
    { key: 'info', label: 'ข้อมูล', icon: 'information-circle-outline' },
    { key: 'tasks', label: `งาน (${project.tasks?.length || 0})`, icon: 'checkbox-outline' },
    { key: 'docs', label: `เอกสาร (${project.documents?.length || 0})`, icon: 'document-outline' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Header
        title={project.name}
        subtitle={st.label}
        onBack={() => navigation.goBack()}
        rightIcon="trash-outline"
        onRightPress={handleDelete}
      />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 12,
                borderBottomWidth: 2, borderBottomColor: active ? COLORS.primary : 'transparent',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={t.icon} size={16} color={active ? COLORS.primary : COLORS.textLight} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: active ? COLORS.primary : COLORS.textSecondary }}>
                  {t.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {/* INFO TAB */}
        {tab === 'info' && (
          <>
            <Card>
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>ความคืบหน้า</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{project.progress}%</Text>
                </View>
                <ProgressBar progress={project.progress} height={10} />
              </View>

              {[
                { icon: 'location-outline', label: 'สถานที่', value: project.location },
                { icon: 'person-outline', label: 'ผู้จัดการ', value: project.manager_name },
                { icon: 'cash-outline', label: 'งบประมาณ', value: project.budget ? `฿${Number(project.budget).toLocaleString()}` : null },
                { icon: 'calendar-outline', label: 'วันเริ่มต้น', value: project.start_date },
                { icon: 'calendar-outline', label: 'วันสิ้นสุด', value: project.end_date },
              ].filter(r => r.value).map((row, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: COLORS.borderLight }}>
                  <Ionicons name={row.icon} size={18} color={COLORS.textLight} style={{ width: 28 }} />
                  <Text style={{ fontSize: 13, color: COLORS.textSecondary, width: 80 }}>{row.label}</Text>
                  <Text style={{ fontSize: 14, color: COLORS.text, flex: 1 }}>{row.value}</Text>
                </View>
              ))}
            </Card>

            {project.description ? (
              <Card>
                <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 }}>รายละเอียด</Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>{project.description}</Text>
              </Card>
            ) : null}
          </>
        )}

        {/* TASKS TAB */}
        {tab === 'tasks' && (
          <>
            <Button
              title="เพิ่มงาน"
              icon="add-circle-outline"
              onPress={() => navigation.navigate('AddTask', { projectId })}
              style={{ marginBottom: 16 }}
            />
            {project.tasks?.length > 0 ? (
              project.tasks.map((task) => {
                const ts = TASK_STATUS_MAP[task.status] || TASK_STATUS_MAP.todo;
                const pr = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                return (
                  <Card key={task.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <TouchableOpacity onPress={() => handleToggleTask(task.id)} style={{ marginRight: 10, marginTop: 2 }}>
                        <Ionicons
                          name={task.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={task.status === 'done' ? COLORS.success : COLORS.textLight}
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 15, fontWeight: '600', color: COLORS.text,
                          textDecorationLine: task.status === 'done' ? 'line-through' : 'none',
                        }}>
                          {task.title}
                        </Text>
                        {task.assignee_name && (
                          <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 3 }}>
                            มอบหมาย: {task.assignee_name}
                          </Text>
                        )}
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                          <Badge label={ts.label} color={ts.color} bg={ts.bg} icon={ts.icon} />
                          <Badge label={pr.label} color={pr.color} bg={pr.bg} />
                          {task.due_date ? <Badge label={task.due_date} color={COLORS.textSecondary} icon="calendar-outline" /> : null}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteTask(task.id, task.title)}>
                        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              })
            ) : (
              <EmptyState icon="checkbox-outline" title="ยังไม่มีงาน" subtitle="กดปุ่มด้านบนเพื่อเพิ่มงานใหม่" />
            )}
          </>
        )}

        {/* DOCS TAB */}
        {tab === 'docs' && (
          <>
            <Button
              title="เพิ่มเอกสาร"
              icon="add-circle-outline"
              onPress={() => navigation.navigate('AddDocument', { projectId })}
              style={{ marginBottom: 16 }}
            />
            {project.documents?.length > 0 ? (
              project.documents.map((doc) => {
                const cat = DOC_CATEGORY_MAP[doc.category] || DOC_CATEGORY_MAP.other;
                return (
                  <Card key={doc.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 40, height: 40, borderRadius: 10,
                        backgroundColor: cat.color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                      }}>
                        <Ionicons name={cat.icon} size={20} color={cat.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text }}>{doc.name}</Text>
                        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                          {cat.label} • {doc.created_at?.split(' ')[0] || ''}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })
            ) : (
              <EmptyState icon="document-outline" title="ยังไม่มีเอกสาร" subtitle="กดปุ่มด้านบนเพื่อเพิ่มเอกสาร" />
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
