// GanttTasksScreen.js
// ============================================================
// ตาราง Gantt Tasks สไตล์ MS Project
// - เลขลำดับงาน (#) เป็น ID ที่ user เห็น (ไม่ใช่ UUID)
// - กรอก Duration → End Date คำนวณอัตโนมัติ (Read-only สีเขียว)
// - Predecessors พิมพ์เป็น "1, 2" (แปลง UUID ตอน save)
// - Calendar Picker สำหรับเลือกวัน
// - แนบรูป/ไฟล์ระดับ Task (📎)
// - Thumbnail แสดงใน row
// - ลิงก์กับ Worker (assign ทีม) + Weather (เตือนฝน)
// ============================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
  Modal, KeyboardAvoidingView, Platform, Image, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C, Card, Badge, Empty, Header } from './Components';
import {
  getProjectById, getGanttTasks, createGanttTask, updateRow, deleteRow,
  getAllDocuments, createDocument, deleteDocument, getWorkersWithRecords,
} from './db';
import { getWeatherForecast } from './WeatherScreen';
import {
  isOutdoorTask, addDays, formatDate, daysBetween,
  teamProductivity, countRainyDays
} from './criticalPath';

// ============================================================
// Helpers
// ============================================================

// แปลง ISO → dd/mm/yy สั้น (พ.ศ.)
function fmtShort(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const yy = String(d.getFullYear() + 543).slice(-2);
  return `${d.getDate()}/${d.getMonth() + 1}/${yy}`;
}

// แปลง Date object → ISO 'YYYY-MM-DD' (เลี่ยง timezone bug)
function toISO(date) {
  if (!date) return null;
  const d = new Date(date);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().split('T')[0];
}

// คำนวณ end_date = start + (duration - 1)  (end inclusive เหมือน MSP)
function calcEnd(startISO, durationDays) {
  if (!startISO || !durationDays) return null;
  const d = new Date(startISO);
  const dur = parseInt(durationDays);
  if (isNaN(dur) || dur < 1) return null;
  d.setDate(d.getDate() + dur - 1);
  return toISO(d);
}

// แปลง predecessors text "1, 2" → comma-separated UUIDs
function parsePredecessors(text, tasks, currentSortOrder) {
  if (!text || !text.trim()) return '';
  const nums = text.split(/[,\s]+/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n > 0 && n !== currentSortOrder);
  const ids = nums
    .map(n => tasks.find(t => t.sort_order === n)?.id)
    .filter(Boolean);
  return ids.join(',');
}

// แปลง depends_on UUIDs → "1, 2" สำหรับแสดงผล
function formatPredecessors(dependsOn, tasks) {
  if (!dependsOn) return '';
  const ids = String(dependsOn).split(',').map(s => s.trim()).filter(Boolean);
  const nums = ids
    .map(id => tasks.find(t => t.id === id)?.sort_order)
    .filter(n => n !== undefined && n !== null);
  return nums.join(', ');
}

// ============================================================
// MAIN SCREEN
// ============================================================
export default function GanttTasksScreen({ navigation, route }) {
  const projectId = route?.params?.projectId;
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [weather, setWeather] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [taskDocs, setTaskDocs] = useState({}); // { taskId: [docs] }

  const [editingTask, setEditingTask] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  const load = async () => {
    try {
      if (!projectId) return;
      const [p, ts, ws, w] = await Promise.all([
        getProjectById(projectId),
        getGanttTasks(projectId),
        getWorkersWithRecords(),
        getWeatherForecast(),
      ]);
      setProject(p);

      // เรียง + auto-assign sort_order ถ้าว่าง
      const sorted = [...(ts || [])].sort((a, b) =>
        (a.sort_order || 999) - (b.sort_order || 999) ||
        new Date(a.start_date || 0) - new Date(b.start_date || 0)
      );
      sorted.forEach((t, i) => {
        if (!t.sort_order || t.sort_order === 0) t.sort_order = i + 1;
      });
      setTasks(sorted);
      setWorkers(ws || []);
      setWeather(w);

      // โหลด documents ที่เป็น task-level (category = "task:{uuid}")
      const allDocs = await getAllDocuments('all', true);
      const docsByTask = {};
      for (const d of allDocs) {
        if (d.category && d.category.startsWith('task:')) {
          const tid = d.category.slice(5);
          if (!docsByTask[tid]) docsByTask[tid] = [];
          docsByTask[tid].push(d);
        }
      }
      setTaskDocs(docsByTask);
    } catch (e) {
      console.log('Load Gantt error:', e);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [projectId]));

  const openNewTask = () => {
    const nextOrder = tasks.length > 0
      ? Math.max(...tasks.map(t => t.sort_order || 0)) + 1 : 1;
    setEditingTask({
      id: null,
      sort_order: nextOrder,
      name: '',
      start_date: project?.ntp_date || project?.start_date || toISO(new Date()),
      duration_days: 1,
      end_date: null,
      depends_on: '',
      progress: 0,
      assigned_to: '',
      notes: '',
    });
    setShowEditor(true);
  };

  const openEditTask = (task) => {
    setEditingTask({ ...task });
    setShowEditor(true);
  };

  const handleDelete = (task) => {
    Alert.alert('ลบงาน', `ลบ "${task.name}"?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive',
        onPress: async () => {
          try {
            await deleteRow('gantt_tasks', task.id);
            // ลบ document ที่ผูกกับ task นี้ด้วย
            const docs = taskDocs[task.id] || [];
            for (const d of docs) {
              await deleteDocument(d.id).catch(() => {});
            }
            await load();
          } catch (e) { Alert.alert('ผิดพลาด', e.message); }
        }
      }
    ]);
  };

  if (!projectId) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Header title="แผนงาน (Gantt)" onBack={() => navigation.goBack()} />
        <Empty icon="alert-circle-outline" title="ไม่พบโครงการ"
          subtitle="กรุณาเปิดจากหน้ารายละเอียดโครงการ" />
      </View>
    );
  }

  const avgProgress = tasks.length > 0
    ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / tasks.length) : 0;
  const doneCount = tasks.filter(t => (t.progress || 0) >= 100).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="แผนงาน (Gantt)"
        subtitle={project?.name}
        onBack={() => navigation.goBack()}
        rightIcon="add-circle-outline"
        onRight={openNewTask} />

      <ScrollView
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>

        {/* Summary Card */}
        {tasks.length > 0 && (
          <Card style={{ backgroundColor: C.primary, marginBottom: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 6 }}>
              สรุปแผนงาน
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                  {tasks.length}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>งาน</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.accent, fontSize: 22, fontWeight: '800' }}>
                  {avgProgress}%
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                  คืบหน้าเฉลี่ย
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#34D399', fontSize: 22, fontWeight: '800' }}>
                  {doneCount}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>เสร็จแล้ว</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Table header (MS Project style) */}
        {tasks.length > 0 && (
          <View style={{
            flexDirection: 'row', backgroundColor: C.primary,
            borderTopLeftRadius: 10, borderTopRightRadius: 10,
            paddingHorizontal: 8, paddingVertical: 10
          }}>
            <Text style={hStyle(28)}>#</Text>
            <Text style={[hStyle(), { flex: 3 }]}>ชื่องาน</Text>
            <Text style={hStyle(42, 'center')}>วัน</Text>
            <Text style={hStyle(55, 'center')}>เริ่ม</Text>
            <Text style={hStyle(55, 'center')}>สิ้นสุด</Text>
            <Text style={hStyle(38, 'center')}>ก่อน</Text>
          </View>
        )}

        {/* Task rows */}
        {tasks.length > 0 ? tasks.map((t, idx) => {
          const isOutdoor = isOutdoorTask(t);
          const rainyDays = (isOutdoor && weather)
            ? countRainyDays(t.start_date, t.end_date, weather) : 0;
          const predText = formatPredecessors(t.depends_on, tasks);
          const docs = taskDocs[t.id] || [];
          const done = (t.progress || 0) >= 100;

          return (
            <TouchableOpacity key={t.id}
              onPress={() => openEditTask(t)} activeOpacity={0.7}
              style={{
                flexDirection: 'row', backgroundColor: '#fff',
                paddingHorizontal: 8, paddingVertical: 10,
                borderBottomWidth: 1, borderBottomColor: C.border,
                alignItems: 'flex-start',
                opacity: done ? 0.6 : 1,
              }}>
              <Text style={cellStyle(28, { fontWeight: '700', color: C.primary, marginTop: 2 })}>
                {t.sort_order || idx + 1}
              </Text>
              <View style={{ flex: 3, paddingRight: 4 }}>
                <Text style={{
                  fontSize: 13, fontWeight: '600', color: C.text,
                  textDecorationLine: done ? 'line-through' : 'none'
                }} numberOfLines={2}>
                  {t.name}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {isOutdoor && (
                    <MiniBadge bg="#FED7AA" color="#9A3412">กลางแจ้ง</MiniBadge>
                  )}
                  {rainyDays > 0 && (
                    <MiniBadge bg="#FEE2E2" color="#991B1B" icon="rainy">
                      ฝน {rainyDays}d
                    </MiniBadge>
                  )}
                  {docs.length > 0 && (
                    <MiniBadge bg="#DBEAFE" color="#1E40AF" icon="attach">
                      {docs.length}
                    </MiniBadge>
                  )}
                  {(t.progress || 0) > 0 && (t.progress || 0) < 100 && (
                    <MiniBadge bg="#FEF3C7" color="#92400E">{t.progress}%</MiniBadge>
                  )}
                </View>
                {/* Thumbnail (up to 3 images) */}
                {docs.length > 0 && docs.some(d => d.file_url) && (
                  <View style={{ flexDirection: 'row', marginTop: 4, gap: 4 }}>
                    {docs.slice(0, 3).filter(d => d.file_url).map((d, i) =>
                      <Image key={i} source={{ uri: d.file_url }}
                        style={{
                          width: 28, height: 28, borderRadius: 4,
                          backgroundColor: C.bg
                        }} />
                    )}
                  </View>
                )}
              </View>
              <Text style={cellStyle(42, { fontSize: 12, color: C.text, textAlign: 'center' })}>
                {t.duration_days || 1}d
              </Text>
              <Text style={cellStyle(55, { fontSize: 11, color: C.textSec, textAlign: 'center' })}>
                {fmtShort(t.start_date)}
              </Text>
              <Text style={cellStyle(55, { fontSize: 11, color: C.textSec, textAlign: 'center' })}>
                {fmtShort(t.end_date)}
              </Text>
              <Text style={cellStyle(38, {
                fontSize: 11, color: C.primary, textAlign: 'center', fontWeight: '600'
              })}>
                {predText || '-'}
              </Text>
            </TouchableOpacity>
          );
        }) : (
          <Empty icon="calendar-outline" title="ยังไม่มีงาน"
            subtitle="กดปุ่ม + ด้านบนเพื่อเพิ่มงานแรก" />
        )}

        {/* Add task button */}
        {tasks.length > 0 && (
          <TouchableOpacity onPress={openNewTask}
            style={{
              backgroundColor: '#fff', padding: 14, borderRadius: 10,
              marginTop: 8, alignItems: 'center',
              borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed'
            }}>
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>
              + เพิ่มงานใหม่
            </Text>
          </TouchableOpacity>
        )}

        {tasks.length === 0 && (
          <TouchableOpacity onPress={openNewTask}
            style={{
              backgroundColor: C.primary, padding: 14, borderRadius: 10,
              alignItems: 'center', marginTop: 16
            }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              + เริ่มสร้างงานแรก
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TaskEditorModal
        visible={showEditor}
        task={editingTask}
        tasks={tasks}
        workers={workers}
        weather={weather}
        projectId={projectId}
        taskDocs={editingTask?.id ? (taskDocs[editingTask.id] || []) : []}
        onClose={() => { setShowEditor(false); setEditingTask(null); }}
        onSaved={async () => { setShowEditor(false); setEditingTask(null); await load(); }}
        onReload={load}
        onDelete={handleDelete} />
    </View>
  );
}

// Header cell style
function hStyle(width = null, align = 'left') {
  return {
    width,
    color: '#fff', fontSize: 11, fontWeight: '700',
    textAlign: align,
  };
}

function cellStyle(width, extra = {}) {
  return { width, marginTop: 2, ...extra };
}

function MiniBadge({ bg, color, icon, children }) {
  return (
    <View style={{
      backgroundColor: bg, borderRadius: 4,
      paddingHorizontal: 5, paddingVertical: 1,
      flexDirection: 'row', alignItems: 'center', gap: 3
    }}>
      {icon && <Ionicons name={icon} size={9} color={color} />}
      <Text style={{ fontSize: 9, color, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

// ============================================================
// TASK EDITOR MODAL — MS Project-style edit form
// ============================================================
function TaskEditorModal({
  visible, task, tasks, workers, weather, projectId, taskDocs,
  onClose, onSaved, onReload, onDelete
}) {
  const [form, setForm] = useState({
    name: '', start_date: '', duration_days: '1',
    predText: '', progress: '0', notes: '',
    assigned_worker_ids: [], work_type: '',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWorkerPicker, setShowWorkerPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        name: task.name || '',
        start_date: task.start_date || toISO(new Date()),
        duration_days: String(task.duration_days || 1),
        predText: formatPredecessors(task.depends_on, tasks),
        progress: String(task.progress || 0),
        notes: task.notes || '',
        assigned_worker_ids: task.assigned_to
          ? String(task.assigned_to).split(',').filter(Boolean) : [],
        work_type: task.work_type || '',
      });
    }
  }, [task?.id, visible]);

  const endDate = useMemo(() => {
    return calcEnd(form.start_date, form.duration_days);
  }, [form.start_date, form.duration_days]);

  const isOutdoor = useMemo(() => {
    return isOutdoorTask({ name: form.name, notes: form.notes });
  }, [form.name, form.notes]);

  // เตือนถ้าช่วงนี้ฝนตก (เช็คจาก weather forecast)
  const rainyDaysInRange = useMemo(() => {
    if (!isOutdoor || !weather) return 0;
    return countRainyDays(form.start_date, endDate, weather);
  }, [form.start_date, endDate, weather, isOutdoor]);

  // ทีมที่เลือกและ productivity
  const assignedTeam = workers.filter(w => form.assigned_worker_ids.includes(w.id));

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleWorker = (id) => {
    setForm(f => ({
      ...f,
      assigned_worker_ids: f.assigned_worker_ids.includes(id)
        ? f.assigned_worker_ids.filter(x => x !== id)
        : [...f.assigned_worker_ids, id]
    }));
  };

  const handleAttach = async () => {
    if (!task?.id) {
      Alert.alert('บันทึกงานก่อน',
        'กรุณากด "บันทึก" งานใหม่ก่อน 1 ครั้ง แล้วจึงเปิดงานขึ้นมาแนบไฟล์');
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์เข้าถึงรูปภาพในเครื่อง');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      await createDocument({
        projectId,
        name: `งาน #${task.sort_order} ${task.name} - ${new Date().toLocaleDateString('th-TH')}`,
        category: `task:${task.id}`,
        fileUrl: result.assets[0].uri,
        notes: `ไฟล์แนบของงานที่ ${task.sort_order}: ${task.name}`,
      });
      Alert.alert('สำเร็จ', 'แนบไฟล์เรียบร้อย');
      if (onReload) await onReload();
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    }
  };

  const removeDoc = (doc) => {
    Alert.alert('ลบไฟล์แนบ', `ลบ "${doc.name}"?`, [
      { text: 'ยกเลิก' },
      {
        text: 'ลบ', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDocument(doc.id);
            if (onReload) await onReload();
          } catch (e) { Alert.alert('ผิดพลาด', e.message); }
        }
      }
    ]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่องาน'); return;
    }
    if (!form.start_date) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกวันเริ่ม'); return;
    }
    const dur = parseInt(form.duration_days);
    if (!dur || dur <= 0) {
      Alert.alert('ข้อมูลไม่ถูกต้อง', 'ระยะเวลาต้องมากกว่า 0 วัน'); return;
    }

    setSaving(true);
    try {
      const deps = parsePredecessors(form.predText, tasks, task.sort_order);

      if (task.id) {
        await updateRow('gantt_tasks', task.id, {
          name: form.name.trim(),
          start_date: form.start_date,
          end_date: endDate,
          duration_days: dur,
          depends_on: deps,
          progress: parseInt(form.progress) || 0,
          notes: form.notes.trim(),
          assigned_to: form.assigned_worker_ids.join(','),
          sort_order: task.sort_order,
        });
      } else {
        await createGanttTask({
          projectId,
          name: form.name.trim(),
          startDate: form.start_date,
          endDate: endDate,
          durationDays: dur,
          dependsOn: deps,
          progress: parseInt(form.progress) || 0,
          notes: form.notes.trim(),
          assignedTo: form.assigned_worker_ids.join(','),
          sortOrder: task.sort_order,
        });
      }
      onSaved();
    } catch (e) {
      console.log('Save task error:', e);
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28,
          maxHeight: '92%'
        }}>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 14
          }}>
            <View>
              <Text style={{ fontSize: 12, color: C.textSec }}>
                งานลำดับที่ #{task.sort_order}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>
                {task.id ? 'แก้ไขงาน' : 'งานใหม่'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={C.textSec} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* ชื่องาน */}
            <Label required>ชื่องาน</Label>
            <TextInput
              value={form.name}
              onChangeText={v => update('name', v)}
              placeholder="เช่น เทฐานราก"
              placeholderTextColor={C.textLight}
              style={inputStyle} />

            {/* วันเริ่ม + Duration */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 2 }}>
                <Label required>วันเริ่ม</Label>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}
                  style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={16} color={C.primary}
                    style={{ marginRight: 6 }} />
                  <Text style={{
                    color: form.start_date ? C.text : C.textLight, fontSize: 14
                  }}>
                    {form.start_date ? fmtShort(form.start_date) : 'เลือก'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Label required>ระยะเวลา</Label>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    value={form.duration_days}
                    onChangeText={v => update('duration_days', v.replace(/[^\d]/g, ''))}
                    keyboardType="number-pad"
                    placeholderTextColor={C.textLight}
                    style={inputStyle} />
                  <Text style={{
                    position: 'absolute', right: 10, top: 12,
                    color: C.textLight, fontSize: 12
                  }}>วัน</Text>
                </View>
              </View>
            </View>

            {/* Finish date (read-only สีเขียว) */}
            <View style={{
              marginTop: 10, padding: 12, borderRadius: 8,
              backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC',
              flexDirection: 'row', alignItems: 'center'
            }}>
              <Ionicons name="flag-outline" size={16} color="#059669" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ fontSize: 10, color: '#047857' }}>
                  วันสิ้นสุด (คำนวณอัตโนมัติ)
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#047857' }}>
                  {endDate ? fmtShort(endDate) : '-'}
                </Text>
              </View>
            </View>

            {/* Predecessors */}
            <Label>งานก่อนหน้า (Predecessors)</Label>
            <TextInput
              value={form.predText}
              onChangeText={v => update('predText', v)}
              placeholder='เช่น "1, 2" หมายถึงต้องรองานที่ 1 และ 2 เสร็จก่อน'
              placeholderTextColor={C.textLight}
              style={inputStyle} />
            <Text style={{ fontSize: 10, color: C.textSec, marginTop: 4 }}>
              💡 ใส่เลขลำดับงาน (#) คั่นด้วยคอมมา
            </Text>

            {/* Progress */}
            <Label>ความคืบหน้า (%)</Label>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[0, 25, 50, 75, 100].map(p => (
                <TouchableOpacity key={p}
                  onPress={() => update('progress', String(p))}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center',
                    backgroundColor: parseInt(form.progress) === p ? C.primary : '#F3F4F6'
                  }}>
                  <Text style={{
                    fontSize: 12, fontWeight: '700',
                    color: parseInt(form.progress) === p ? '#fff' : C.textSec
                  }}>{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Warning: rain detected */}
            {isOutdoor && rainyDaysInRange > 0 && (
              <View style={{
                marginTop: 12, padding: 12, borderRadius: 8,
                backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5',
                flexDirection: 'row', alignItems: 'flex-start'
              }}>
                <Ionicons name="rainy" size={18} color="#991B1B" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#991B1B' }}>
                    ⚠️ คาดว่ามีฝนตก {rainyDaysInRange} วัน ในช่วงงานนี้
                  </Text>
                  <Text style={{ fontSize: 11, color: '#B91C1C', marginTop: 2, lineHeight: 16 }}>
                    งานกลางแจ้งอาจต้องเลื่อน — ดูหน้า "งานสำรอง (ฝนตก)"
                    เพื่อหาทางเลือก หรือเพิ่มระยะเวลาอีก {rainyDaysInRange} วัน
                  </Text>
                </View>
              </View>
            )}

            {/* Assigned team */}
            <Label>ผู้รับผิดชอบ (ทีม)</Label>
            <TouchableOpacity onPress={() => setShowWorkerPicker(true)}
              style={{ ...inputStyle, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={16} color={C.primary}
                style={{ marginRight: 6 }} />
              <Text style={{
                flex: 1, color: assignedTeam.length > 0 ? C.text : C.textLight, fontSize: 14
              }}>
                {assignedTeam.length > 0
                  ? `เลือก ${assignedTeam.length} คน: ${assignedTeam.slice(0, 2).map(w => w.name).join(', ')}${assignedTeam.length > 2 ? '...' : ''}`
                  : 'กดเพื่อเลือก (ไม่บังคับ)'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={C.textSec} />
            </TouchableOpacity>

            {/* Attachments */}
            <Label>
              ไฟล์แนบ {taskDocs.length > 0 ? `(${taskDocs.length})` : ''}
            </Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {taskDocs.map(d => (
                <TouchableOpacity key={d.id} onLongPress={() => removeDoc(d)}
                  style={{
                    width: 72, height: 72, borderRadius: 8,
                    backgroundColor: C.bg, overflow: 'hidden',
                    borderWidth: 1, borderColor: C.border
                  }}>
                  {d.file_url && (d.file_url.startsWith('file:') || d.file_url.startsWith('http')) ? (
                    <Image source={{ uri: d.file_url }}
                      style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="document-outline" size={24} color={C.textLight} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={handleAttach}
                style={{
                  width: 72, height: 72, borderRadius: 8,
                  borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                <Ionicons name="camera-outline" size={22} color={C.primary} />
                <Text style={{ fontSize: 10, color: C.primary, marginTop: 2 }}>แนบ</Text>
              </TouchableOpacity>
            </View>
            {taskDocs.length > 0 && (
              <Text style={{ fontSize: 10, color: C.textSec, marginTop: 4 }}>
                💡 กดค้างที่รูปเพื่อลบ
              </Text>
            )}

            {/* Notes */}
            <Label>หมายเหตุ</Label>
            <TextInput
              value={form.notes}
              onChangeText={v => update('notes', v)}
              placeholder="รายละเอียดเพิ่มเติม / สรุปสเปคงาน"
              multiline numberOfLines={3}
              placeholderTextColor={C.textLight}
              style={{ ...inputStyle, minHeight: 70, textAlignVertical: 'top' }} />

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
              {task.id && (
                <TouchableOpacity onPress={() => { onDelete(task); onClose(); }}
                  style={{
                    paddingHorizontal: 14, backgroundColor: '#FEE2E2',
                    borderRadius: 10, justifyContent: 'center'
                  }}>
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose}
                style={{
                  flex: 1, backgroundColor: '#F3F4F6', padding: 14,
                  borderRadius: 10, alignItems: 'center'
                }}>
                <Text style={{ fontWeight: '700', color: C.textSec }}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving}
                style={{
                  flex: 2, backgroundColor: saving ? '#9CA3AF' : C.primary,
                  padding: 14, borderRadius: 10, alignItems: 'center'
                }}>
                <Text style={{ fontWeight: '700', color: '#fff', fontSize: 15 }}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {showDatePicker && (
            <DateTimePicker
              value={form.start_date ? new Date(form.start_date) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) update('start_date', toISO(selectedDate));
              }} />
          )}

          {/* Worker picker modal */}
          <Modal visible={showWorkerPicker} transparent animationType="fade">
            <View style={{
              flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center', alignItems: 'center', padding: 20
            }}>
              <View style={{
                backgroundColor: '#fff', width: '100%', maxHeight: '75%',
                borderRadius: 16, padding: 16
              }}>
                <Text style={{
                  fontSize: 16, fontWeight: '700', color: C.text,
                  marginBottom: 12, textAlign: 'center'
                }}>
                  เลือกทีม ({form.assigned_worker_ids.length})
                </Text>
                <ScrollView>
                  {workers.length > 0 ? workers.map(w => {
                    const sel = form.assigned_worker_ids.includes(w.id);
                    return (
                      <TouchableOpacity key={w.id} onPress={() => toggleWorker(w.id)}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 10, paddingHorizontal: 4,
                          borderBottomWidth: 1, borderBottomColor: C.border
                        }}>
                        <Ionicons
                          name={sel ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={sel ? C.primary : C.textLight} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>
                            {w.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: C.textSec }}>
                            {w.role || '-'} • {w.records?.length || 0} สถิติ
                            {w.daily_wage > 0 ? ` • ฿${w.daily_wage}/วัน` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }) : (
                    <Text style={{
                      textAlign: 'center', color: C.textSec,
                      paddingVertical: 20, fontSize: 13
                    }}>
                      ยังไม่มีพนักงาน{'\n'}เพิ่มพนักงานได้ที่เมนู "สถิติช่าง"
                    </Text>
                  )}
                </ScrollView>
                <TouchableOpacity onPress={() => setShowWorkerPicker(false)}
                  style={{
                    backgroundColor: C.primary, padding: 12,
                    borderRadius: 10, alignItems: 'center', marginTop: 10
                  }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>เสร็จ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================
// Subcomponents
// ============================================================
function Label({ children, required }) {
  return (
    <Text style={{
      fontSize: 12, fontWeight: '600',
      color: C.textSec, marginBottom: 4, marginTop: 12,
    }}>
      {children}{required && <Text style={{ color: C.danger }}> *</Text>}
    </Text>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: C.border, borderRadius: 8,
  paddingHorizontal: 10, paddingVertical: 10,
  fontSize: 14, color: C.text, backgroundColor: '#fff',
  minHeight: 42,
};