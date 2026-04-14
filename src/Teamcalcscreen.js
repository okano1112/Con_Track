// src/TeamCalcScreen.js
// ============================================================
// หน้าจัดทีม + ทำนายผลผลิต
// ใช้ข้อมูลจาก workers ที่มีอยู่ใน DB
//
// 🔧 จุดที่แก้ Logic ทีหลัง → ค้นหาคำว่า "TODO-LOGIC"
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C, Card, Button, Badge, ProgressBar, Header, Empty } from './Components';
import { getWorkersWithRecords } from './db';

// ============================================================
// ประเภทงาน + หน่วยวัด
// 🔧 TODO-LOGIC #1: เพิ่ม/แก้ประเภทงานและหน่วยวัดตรงนี้
// ============================================================
const WORK_TYPES = [
  { id: 'rebar', name: 'ผูกเหล็ก', unit: 'กก./วัน', icon: 'construct-outline' },
  { id: 'brick', name: 'ก่ออิฐ', unit: 'ตร.ม./วัน', icon: 'grid-outline' },
  { id: 'plaster', name: 'ฉาบปูน', unit: 'ตร.ม./วัน', icon: 'layers-outline' },
  { id: 'tile', name: 'ปูกระเบื้อง', unit: 'ตร.ม./วัน', icon: 'apps-outline' },
  { id: 'formwork', name: 'ตั้งแบบ', unit: 'ตร.ม./วัน', icon: 'resize-outline' },
  { id: 'concrete', name: 'เทคอนกรีต', unit: 'ลบ.ม./วัน', icon: 'cube-outline' },
];

// ============================================================
// Helper: คำนวณสถิติช่างแต่ละคน ต่อประเภทงาน
// 🔧 TODO-LOGIC #2: แก้สูตรคำนวณเฉลี่ยตรงนี้
// ============================================================
function getWorkerStats(worker, workTypeId) {
  const recs = worker.records.filter(r => r.work_type === workTypeId);
  if (!recs.length) return null;

  // ─── สูตรคำนวณ (แก้ตรงนี้) ───
  const avgOutput = recs.reduce((s, r) => s + r.output, 0) / recs.length;
  const avgQuality = recs.reduce((s, r) => s + r.quality, 0) / recs.length;
  const maxOutput = Math.max(...recs.map(r => r.output));
  const minOutput = Math.min(...recs.map(r => r.output));

  return { avgOutput, avgQuality, maxOutput, minOutput, count: recs.length };
}

// ============================================================
// Helper: คำนวณศักยภาพทีม
// 🔧 TODO-LOGIC #3: แก้สูตรรวมกำลังผลิตทีมตรงนี้
// ============================================================
function calcTeamStats(members, workTypeId) {
  if (!members.length) return null;
  const stats = members.map(m => ({ ...m, stats: getWorkerStats(m, workTypeId) })).filter(m => m.stats);
  if (!stats.length) return null;

  // ─── สูตร: รวมผลผลิต + เฉลี่ยคุณภาพ (แก้ตรงนี้) ───
  const dailyCapacity = stats.reduce((s, m) => s + m.stats.avgOutput, 0);
  const avgQuality = stats.reduce((s, m) => s + m.stats.avgQuality, 0) / stats.length;

  return { dailyCapacity, avgQuality, count: stats.length, members: stats };
}

// ============================================================
// Helper: ทำนายจำนวนวัน
// 🔧 TODO-LOGIC #4: แก้สูตรทำนายตรงนี้
// ============================================================
function predictDays(dailyCapacity, totalWork) {
  if (!dailyCapacity || !totalWork || totalWork <= 0) return null;
  // ─── สูตร: ปริมาณงาน ÷ กำลังผลิต/วัน (แก้ตรงนี้) ───
  return Math.ceil(totalWork / dailyCapacity);
}

// สีตามคุณภาพ
function qualityColor(q) {
  if (q >= 90) return '#10B981';
  if (q >= 80) return '#F59E0B';
  return '#EF4444';
}

// ============================================================
// MAIN SCREEN
// ============================================================
export default function TeamCalcScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('team'); // 'team' | 'predict'

  const load = async () => {
    try { setWorkers(await getWorkersWithRecords()); }
    catch (e) { console.log(e); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="จัดทีมและทำนายผลผลิต" onBack={() => navigation.goBack()} />

      {/* Tab switcher */}
      <View style={{ flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
        {[
          { key: 'team', label: 'จัดทีม', icon: 'people-outline' },
          { key: 'predict', label: 'ทำนายผลผลิต', icon: 'calculator-outline' },
        ].map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: active ? C.primary : 'transparent' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={t.icon} size={16} color={active ? C.primary : C.textLight} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? C.primary : C.textSec }}>{t.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {tab === 'team' ? <TeamTab workers={workers} /> : <PredictTab workers={workers} />}
      </ScrollView>
    </View>
  );
}

// ============================================================
// TAB: จัดทีม
// ============================================================
function TeamTab({ workers }) {
  const [workType, setWorkType] = useState('rebar');
  const [selectedIds, setSelectedIds] = useState([]);
  const wt = WORK_TYPES.find(w => w.id === workType);

  // ช่างที่มีสถิติงานประเภทนี้
  const candidates = useMemo(() => {
    return workers.map(w => ({ ...w, stats: getWorkerStats(w, workType) })).filter(c => c.stats);
  }, [workers, workType]);

  // สรุปทีม
  const selected = workers.filter(w => selectedIds.includes(w.id));
  const teamStats = useMemo(() => calcTeamStats(selected, workType), [selected, workType]);

  const toggle = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <View>
      {/* เลือกประเภทงาน */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>เลือกประเภทงาน</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => {
              const active = workType === w.id;
              return (
                <TouchableOpacity key={w.id} onPress={() => { setWorkType(w.id); setSelectedIds([]); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: active ? C.accent : '#F3F4F6',
                    borderWidth: active ? 0 : 1, borderColor: C.border,
                  }}>
                  <Ionicons name={w.icon} size={14} color={active ? '#fff' : C.textSec} />
                  <Text style={{ color: active ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{w.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Card>

      {/* รายชื่อช่าง — กดเลือกเข้าทีม */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 10 }}>
        เลือกช่างเข้าทีม ({wt?.name})
      </Text>
      {candidates.length > 0 ? candidates.map(c => {
        const active = selectedIds.includes(c.id);
        return (
          <Card key={c.id} onPress={() => toggle(c.id)} style={{
            borderWidth: 2, borderColor: active ? C.accent : 'transparent',
            backgroundColor: active ? '#FEF3C7' : C.white,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>{c.avatar_uri ? '📷' : '👷'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{c.name}</Text>
                <Text style={{ fontSize: 12, color: C.textSec }}>{c.role}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
                  {c.stats.avgOutput.toFixed(1)}
                </Text>
                <Text style={{ fontSize: 10, color: C.textLight }}>{wt?.unit}</Text>
              </View>
              <View style={{
                width: 32, height: 32, borderRadius: 8,
                backgroundColor: active ? C.accent : '#E5E7EB',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={active ? 'checkmark' : 'add'} size={18} color="#fff" />
              </View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ไม่มีช่างที่มีสถิติงานนี้" />}

      {/* สรุปศักยภาพทีม */}
      {teamStats && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 }}>
            สรุปศักยภาพทีม
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{teamStats.count}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>สมาชิก</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>
                {teamStats.dailyCapacity.toFixed(1)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{wt?.unit}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: qualityColor(teamStats.avgQuality), fontSize: 24, fontWeight: '800' }}>
                {teamStats.avgQuality.toFixed(1)}%
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>คุณภาพเฉลี่ย</Text>
            </View>
          </View>

          {/* สัดส่วนแต่ละคน */}
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>
            สัดส่วนผลผลิตแต่ละคน
          </Text>
          {teamStats.members.map(m => {
            const pct = (m.stats.avgOutput / teamStats.dailyCapacity) * 100;
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', width: 70 }}>{m.name}</Text>
                <View style={{ flex: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.accent, borderRadius: 6 }} />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, width: 60, textAlign: 'right' }}>
                  {m.stats.avgOutput.toFixed(1)} ({pct.toFixed(0)}%)
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

// ============================================================
// TAB: ทำนายผลผลิต
// ============================================================
function PredictTab({ workers }) {
  const [workType, setWorkType] = useState('rebar');
  const [selectedIds, setSelectedIds] = useState([]);
  const [totalWork, setTotalWork] = useState('');
  const wt = WORK_TYPES.find(w => w.id === workType);

  const candidates = useMemo(() => {
    return workers.map(w => ({ ...w, stats: getWorkerStats(w, workType) })).filter(c => c.stats);
  }, [workers, workType]);

  const selected = workers.filter(w => selectedIds.includes(w.id));
  const teamStats = useMemo(() => calcTeamStats(selected, workType), [selected, workType]);

  const tw = parseFloat(totalWork) || 0;
  const daysNeeded = teamStats ? predictDays(teamStats.dailyCapacity, tw) : null;

  const toggle = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <View>
      {/* เลือกประเภทงาน */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>ประเภทงาน</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => {
              const active = workType === w.id;
              return (
                <TouchableOpacity key={w.id} onPress={() => { setWorkType(w.id); setSelectedIds([]); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: active ? C.accent : '#F3F4F6',
                    borderWidth: active ? 0 : 1, borderColor: C.border,
                  }}>
                  <Ionicons name={w.icon} size={14} color={active ? '#fff' : C.textSec} />
                  <Text style={{ color: active ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{w.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Card>

      {/* เลือกทีม */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 10 }}>
        เลือกทีม
      </Text>
      {candidates.map(c => {
        const active = selectedIds.includes(c.id);
        return (
          <Card key={c.id} onPress={() => toggle(c.id)} style={{
            borderWidth: 2, borderColor: active ? C.accent : 'transparent',
            backgroundColor: active ? '#FEF3C7' : C.white,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 24, marginRight: 10 }}>👷</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{c.name}</Text>
                <Text style={{ fontSize: 11, color: C.textSec }}>
                  {c.stats.avgOutput.toFixed(1)} {wt?.unit}
                </Text>
              </View>
              <View style={{
                width: 28, height: 28, borderRadius: 7,
                backgroundColor: active ? C.accent : '#E5E7EB',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={active ? 'checkmark' : 'add'} size={16} color="#fff" />
              </View>
            </View>
          </Card>
        );
      })}
      {candidates.length === 0 && <Empty icon="people-outline" title={`ไม่มีช่างที่มีสถิติ ${wt?.name}`} />}

      {/* ปริมาณงานทั้งหมด */}
      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>
          ปริมาณงานทั้งหมด ({wt?.unit?.replace('/วัน', '') || ''})
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
          borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12,
        }}>
          <Ionicons name="calculator-outline" size={18} color={C.textLight} style={{ marginRight: 8 }} />
          <TextInput
            value={totalWork}
            onChangeText={setTotalWork}
            placeholder="เช่น 5000"
            keyboardType="numeric"
            style={{ flex: 1, fontSize: 18, fontWeight: '700', color: C.text, paddingVertical: 14 }}
          />
        </View>
      </Card>

      {/* ผลการทำนาย */}
      {teamStats && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 14 }}>
            ผลการทำนาย
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>กำลังผลิตทีม/วัน</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.accent, marginTop: 4 }}>
                {teamStats.dailyCapacity.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{wt?.unit}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>คุณภาพเฉลี่ย</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: qualityColor(teamStats.avgQuality), marginTop: 4 }}>
                {teamStats.avgQuality.toFixed(1)}%
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>ของทีม</Text>
            </View>
          </View>

          {/* จำนวนวัน */}
          {daysNeeded && (
            <View style={{
              marginTop: 16, padding: 20, alignItems: 'center',
              backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10,
              borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
            }}>
              <Text style={{ fontSize: 11, color: C.accent, fontWeight: '600' }}>จำนวนวันที่ต้องใช้</Text>
              <Text style={{ fontSize: 48, fontWeight: '900', color: C.accent, marginTop: 4 }}>{daysNeeded}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'center' }}>
                วันทำงาน ({tw.toLocaleString()} ÷ {teamStats.dailyCapacity.toFixed(1)} {wt?.unit})
              </Text>
            </View>
          )}

          {!tw && (
            <View style={{ marginTop: 14, alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="arrow-up-outline" size={24} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
                กรอกปริมาณงานด้านบนเพื่อทำนายจำนวนวัน
              </Text>
            </View>
          )}
        </Card>
      )}
    </View>
  );
}