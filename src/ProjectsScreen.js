// src/ProjectsScreen.js
// รวม: ProjectsList + AddProject + ProjectDetail + AddTask + AddDocument

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { C, Card, Button, Input, Badge, ProgressBar, Empty, Header, STATUS, TASK_STATUS, PRIORITY, DOC_CAT } from './Components';
import * as DB from './db';

// ============================================================
// 1. รายการโครงการ
// ============================================================
export function ProjectsListScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      // ถ้ามีคำค้น ใช้ LIKE search, ถ้าไม่มีใช้ filter
      if (search.trim()) {
        const db = await DB.getDB();
        const term = `%${search}%`;
        setProjects(await db.getAllAsync(
          'SELECT p.*, u.full_name as manager_name FROM projects p LEFT JOIN users u ON p.manager_id=u.id WHERE p.name LIKE ? OR p.location LIKE ? ORDER BY p.created_at DESC',
          [term, term]
        ));
      } else {
        setProjects(await DB.getAllProjects(filter));
      }
    } catch (e) { console.log(e); }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter, search]));

  const FILTERS = [
    { key: 'all', label: 'ทั้งหมด' }, { key: 'active', label: 'กำลังทำ' },
    { key: 'planning', label: 'วางแผน' }, { key: 'completed', label: 'เสร็จ' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>โครงการ</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddProject')}
            style={{ backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 4 }}>เพิ่ม</Text>
          </TouchableOpacity>
        </View>
        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 12, marginTop: 14 }}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
          <TextInput value={search} onChangeText={setSearch} placeholder="ค้นหาโครงการ..." placeholderTextColor="rgba(255,255,255,0.4)"
            style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10, marginLeft: 8 }} />
        </View>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} onPress={() => { setFilter(f.key); setSearch(''); }}
              style={{ backgroundColor: active ? C.primary : '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: active ? 0 : 1, borderColor: C.border }}>
              <Text style={{ color: active ? '#fff' : C.textSec, fontWeight: '600', fontSize: 13 }}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {projects.length > 0 ? projects.map(p => {
          const st = STATUS[p.status] || STATUS.planning;
          return (
            <Card key={p.id} onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{p.name}</Text>
                  {p.location ? <Text style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>{p.location}</Text> : null}
                </View>
                <Badge label={st.label} color={st.color} bg={st.bg} />
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: C.textSec }}>ความคืบหน้า</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600' }}>{p.progress}%</Text>
                </View>
                <ProgressBar progress={p.progress} />
              </View>
              <Text style={{ fontSize: 12, color: C.textLight, marginTop: 8 }}>
                {p.done_count || 0}/{p.task_count || 0} งาน • {p.doc_count || 0} เอกสาร
              </Text>
            </Card>
          );
        }) : <Empty icon="business-outline" title="ยังไม่มีโครงการ" subtitle="กดปุ่ม + เพิ่ม เพื่อสร้างโครงการแรก" />}
      </ScrollView>
    </View>
  );
}

// ============================================================
// 2. เพิ่มโครงการ
// ============================================================
export function AddProjectScreen({ navigation }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', location: '', budget: '', startDate: '', endDate: '', status: 'planning' });
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อโครงการ');
    setLoading(true);
    try {
      await DB.createProject(form.name, form.description, form.location, parseFloat(form.budget) || 0, form.startDate, form.endDate, form.status, user?.id);
      Alert.alert('สำเร็จ', 'เพิ่มโครงการเรียบร้อย', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เพิ่มโครงการ" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Input label="ชื่อโครงการ *" value={form.name} onChangeText={v => u('name', v)} placeholder="เช่น อาคารพาณิชย์ เฟส 2" icon="business-outline" />
        <Input label="รายละเอียด" value={form.description} onChangeText={v => u('description', v)} placeholder="รายละเอียดโครงการ" multiline icon="document-text-outline" />
        <Input label="สถานที่" value={form.location} onChangeText={v => u('location', v)} placeholder="เช่น กรุงเทพฯ" icon="location-outline" />
        <Input label="งบประมาณ (บาท)" value={form.budget} onChangeText={v => u('budget', v)} placeholder="0" keyboardType="numeric" icon="cash-outline" />
        <Input label="วันเริ่ม" value={form.startDate} onChangeText={v => u('startDate', v)} placeholder="YYYY-MM-DD" icon="calendar-outline" />
        <Input label="วันสิ้นสุด" value={form.endDate} onChangeText={v => u('endDate', v)} placeholder="YYYY-MM-DD" icon="calendar-outline" />

        {/* Status Picker */}
        <Card><Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>สถานะ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(STATUS).map(([k, v]) => {
              const sel = form.status === k;
              return (
                <TouchableOpacity key={k} onPress={() => u('status', k)}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? v.color : '#F3F4F6', borderWidth: sel ? 0 : 1, borderColor: C.border }}>
                  <Text style={{ color: sel ? '#fff' : C.textSec, fontWeight: '600', fontSize: 13 }}>{v.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="บันทึก" onPress={save} loading={loading} icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// 3. รายละเอียดโครงการ (info + tasks + docs)
// ============================================================
export function ProjectDetailScreen({ route, navigation }) {
  const { projectId } = route.params;
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('info');

  const load = async () => {
    try { setProject(await DB.getProjectById(projectId)); }
    catch (e) { Alert.alert('ผิดพลาด', e.message); navigation.goBack(); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  if (!project) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const st = STATUS[project.status] || STATUS.planning;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title={project.name} subtitle={st.label} onBack={() => navigation.goBack()}
        rightIcon="trash-outline" onRight={() => {
          Alert.alert('ลบโครงการ', `ลบ "${project.name}"?`, [
            { text: 'ยกเลิก', style: 'cancel' },
            { text: 'ลบ', style: 'destructive', onPress: async () => { await DB.deleteProject(projectId); navigation.goBack(); } },
          ]);
        }} />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.border }}>
        {[
          { key: 'info', label: 'ข้อมูล' },
          { key: 'tasks', label: `งาน (${project.tasks?.length || 0})` },
          { key: 'docs', label: `เอกสาร (${project.documents?.length || 0})` },
        ].map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: active ? C.primary : 'transparent' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? C.primary : C.textSec }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {/* INFO */}
        {tab === 'info' && (
          <Card>
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: C.textSec }}>ความคืบหน้า</Text>
                <Text style={{ fontWeight: '700' }}>{project.progress}%</Text>
              </View>
              <ProgressBar progress={project.progress} height={10} />
            </View>
            {[
              { label: 'สถานที่', value: project.location },
              { label: 'ผู้จัดการ', value: project.manager_name },
              { label: 'งบประมาณ', value: project.budget ? `฿${Number(project.budget).toLocaleString()}` : null },
              { label: 'เริ่ม', value: project.start_date },
              { label: 'สิ้นสุด', value: project.end_date },
            ].filter(r => r.value).map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ width: 80, color: C.textSec, fontSize: 13 }}>{r.label}</Text>
                <Text style={{ flex: 1, color: C.text, fontSize: 14 }}>{r.value}</Text>
              </View>
            ))}
            {project.description ? <Text style={{ color: C.textSec, marginTop: 8, lineHeight: 22 }}>{project.description}</Text> : null}
          </Card>
        )}

        {/* TASKS */}
        {tab === 'tasks' && (
          <>
            <Button title="เพิ่มงาน" icon="add-circle-outline" onPress={() => navigation.navigate('AddTask', { projectId })} style={{ marginBottom: 16 }} />
            {project.tasks?.length > 0 ? project.tasks.map(task => {
              const ts = TASK_STATUS[task.status] || TASK_STATUS.todo;
              const pr = PRIORITY[task.priority] || PRIORITY.medium;
              return (
                <Card key={task.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <TouchableOpacity onPress={async () => { await DB.toggleTask(task.id); load(); }} style={{ marginRight: 10, marginTop: 2 }}>
                      <Ionicons name={task.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={task.status === 'done' ? C.success : C.textLight} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, textDecorationLine: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <Badge label={ts.label} color={ts.color} bg={ts.bg} />
                        <Badge label={pr.label} color={pr.color} bg={pr.bg} />
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => Alert.alert('ลบงาน', `ลบ "${task.title}"?`, [
                      { text: 'ยกเลิก' }, { text: 'ลบ', style: 'destructive', onPress: async () => { await DB.deleteTask(task.id); load(); } }
                    ])}><Ionicons name="trash-outline" size={18} color={C.danger} /></TouchableOpacity>
                  </View>
                </Card>
              );
            }) : <Empty icon="checkbox-outline" title="ยังไม่มีงาน" />}
          </>
        )}

        {/* DOCS */}
        {tab === 'docs' && (
          <>
            <Button title="เพิ่มเอกสาร" icon="add-circle-outline" onPress={() => navigation.navigate('AddDocument', { projectId })} style={{ marginBottom: 16 }} />
            {project.documents?.length > 0 ? project.documents.map(doc => {
              const cat = DOC_CAT[doc.category] || DOC_CAT.other;
              return (
                <Card key={doc.id}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name={cat.icon} size={22} color={cat.color} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>{doc.name}</Text>
                      <Text style={{ fontSize: 12, color: C.textSec }}>{cat.label}</Text>
                    </View>
                  </View>
                </Card>
              );
            }) : <Empty icon="document-outline" title="ยังไม่มีเอกสาร" />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// 4. เพิ่มงาน
// ============================================================
export function AddTaskScreen({ route, navigation }) {
  const { projectId } = route.params;
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '' });
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่องาน');
    setLoading(true);
    try {
      await DB.createTask(projectId, null, form.title, form.description, form.priority, form.status, form.dueDate);
      Alert.alert('สำเร็จ', 'เพิ่มงานเรียบร้อย', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เพิ่มงาน" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Input label="ชื่องาน *" value={form.title} onChangeText={v => u('title', v)} placeholder="เช่น เทฐานราก" icon="checkbox-outline" />
        <Input label="รายละเอียด" value={form.description} onChangeText={v => u('description', v)} multiline icon="document-text-outline" />
        <Input label="กำหนดเสร็จ" value={form.dueDate} onChangeText={v => u('dueDate', v)} placeholder="YYYY-MM-DD" icon="calendar-outline" />

        <Card><Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>ความสำคัญ</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Object.entries(PRIORITY).map(([k, v]) => {
              const sel = form.priority === k;
              return (
                <TouchableOpacity key={k} onPress={() => u('priority', k)}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: sel ? v.color : '#F3F4F6', borderWidth: sel ? 0 : 1, borderColor: C.border }}>
                  <Text style={{ color: sel ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{v.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="บันทึก" onPress={save} loading={loading} icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// 5. เพิ่มเอกสาร
// ============================================================
export function AddDocumentScreen({ route, navigation }) {
  const { projectId } = route.params;
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', category: 'other', notes: '' });
  const [loading, setLoading] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อเอกสาร');
    setLoading(true);
    try {
      await DB.createDocument(projectId, user?.id, form.name, form.category, form.notes);
      Alert.alert('สำเร็จ', 'เพิ่มเอกสารเรียบร้อย', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เพิ่มเอกสาร" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Input label="ชื่อเอกสาร *" value={form.name} onChangeText={v => u('name', v)} placeholder="เช่น แบบแปลน ชั้น 1" icon="document-text-outline" />
        <Input label="หมายเหตุ" value={form.notes} onChangeText={v => u('notes', v)} multiline icon="chatbubble-outline" />

        <Card><Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>หมวดหมู่</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(DOC_CAT).map(([k, v]) => {
              const sel = form.category === k;
              return (
                <TouchableOpacity key={k} onPress={() => u('category', k)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: sel ? v.color : '#F3F4F6', borderWidth: sel ? 0 : 1, borderColor: C.border }}>
                  <Ionicons name={v.icon} size={14} color={sel ? '#fff' : v.color} />
                  <Text style={{ color: sel ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{v.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Button title="บันทึก" onPress={save} loading={loading} icon="checkmark-circle" style={{ marginTop: 8 }} />
        <Button title="ยกเลิก" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 8, marginBottom: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}