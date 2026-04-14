// src/TeamCalcScreen.js
// ============================================================
// หน้าจัดทีม + ทำนายผลผลิต (อ้างอิงมาตรฐานภาระงานก่อสร้าง พ.ศ. 2562)
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C, Card, Header, Empty } from './Components';
import { getWorkersWithRecords } from './db';

// ============================================================
// ประเภทงาน — อ้างอิงมาตรฐานภาระงานก่อสร้าง พ.ศ. 2562
// ============================================================
const WORK_TYPES = [
  { id: 'โครงสร้าง คสล.', unit: 'ตร.ม./วัน', icon: 'construct-outline', standard: 27 }, 
  { id: 'เทปูน', unit: 'ลบ.ม./วัน', icon: 'cube-outline', standard: 3 },
  { id: 'ก่ออิฐ', unit: 'ตร.ม./วัน', icon: 'grid-outline', standard: 24 },
  { id: 'ฉาบปูน', unit: 'ตร.ม./วัน', icon: 'layers-outline', standard: 14 },
  { id: 'งานไม้', unit: 'ตร.ม./วัน', icon: 'hammer-outline', standard: 20 },
  { id: 'งานไฟฟ้า', unit: 'จุด/วัน', icon: 'flash-outline', standard: 10 },
  { id: 'งานประปา', unit: 'จุด/วัน', icon: 'water-outline', standard: 10 },
  { id: 'งานทาสี', unit: 'ตร.ม./วัน', icon: 'color-palette-outline', standard: 85 }, 
  { id: 'งานกระเบื้อง', unit: 'ตร.ม./วัน', icon: 'apps-outline', standard: 25 }, 
  { id: 'งานฝ้า', unit: 'ตร.ม./วัน', icon: 'resize-outline', standard: 35 },
  { id: 'งานเชื่อม', unit: 'จุด/วัน', icon: 'flame-outline', standard: 10 },
  { id: 'อื่นๆ', unit: 'หน่วย/วัน', icon: 'ellipsis-horizontal-outline', standard: 0 },
];

// ============================================================
// Helpers
// ============================================================
function getAvgOutput(worker, workTypeId) {
  const recs = (worker.records || []).filter(r => r.work_type === workTypeId);
  if (recs.length === 0) return 0;
  return recs.reduce((sum, r) => sum + (r.output || 0), 0) / recs.length;
}

function getAvgQuality(worker, workTypeId) {
  const recs = (worker.records || []).filter(r => r.work_type === workTypeId);
  if (recs.length === 0) return 0;
  return recs.reduce((sum, r) => sum + (r.quality || 0), 0) / recs.length;
}

function hasRecordsFor(worker, workTypeId) {
  return (worker.records || []).some(r => r.work_type === workTypeId);
}

function getEfficiency(output, workTypeId) {
  const wt = WORK_TYPES.find(w => w.id === workTypeId);
  if (!wt || !wt.standard || wt.standard === 0) return 0;
  return (output / wt.standard) * 100;
}

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
  const [tab, setTab] = useState('team');

  const load = async () => {
    try {
      const data = await getWorkersWithRecords();
      setWorkers(data);
    } catch (e) { console.log('Load error:', e); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="จัดทีมและทำนายผลผลิต" onBack={() => navigation.goBack()} />

      {/* Tab */}
      <View style={{ flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
        {[
          { key: 'team', label: 'จัดทีม', icon: 'people-outline' },
          { key: 'predict', label: 'ทำนายผลผลิต', icon: 'calculator-outline' },
        ].map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: tab === t.key ? C.primary : 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? C.primary : C.textLight} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: tab === t.key ? C.primary : C.textSec }}>{t.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {tab === 'team'
          ? <TeamTab workers={workers} />
          : <PredictTab workers={workers} />
        }
      </ScrollView>
    </View>
  );
}

// ============================================================
// แท็บจัดทีม
// ============================================================
function TeamTab({ workers }) {
  const [workType, setWorkType] = useState('โครงสร้าง คสล.');
  const [selectedIds, setSelectedIds] = useState([]);

  const wt = WORK_TYPES.find(w => w.id === workType) || WORK_TYPES[0];
  const candidates = workers.filter(w => hasRecordsFor(w, workType));
  const team = candidates.filter(w => selectedIds.includes(w.id));

  const teamOutput = team.reduce((sum, w) => sum + getAvgOutput(w, workType), 0);
  
  const expectedStandardOutput = team.length * (wt.standard || 0);
  const teamEfficiency = expectedStandardOutput > 0 ? (teamOutput / expectedStandardOutput) * 100 : 0;

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <View>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>
          เลือกประเภทงาน
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => (
              <TouchableOpacity key={w.id}
                onPress={() => { setWorkType(w.id); setSelectedIds([]); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: workType === w.id ? C.accent : '#F3F4F6',
                  borderWidth: workType === w.id ? 0 : 1, borderColor: C.border,
                }}>
                <Ionicons name={w.icon} size={14} color={workType === w.id ? '#fff' : C.textSec} />
                <Text style={{ color: workType === w.id ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>
                  {w.id}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 10 }}>
        เลือกช่างเข้าทีม ({wt.id})
      </Text>

      {candidates.length > 0 ? candidates.map(worker => {
        const isSelected = selectedIds.includes(worker.id);
        const avg = getAvgOutput(worker, workType);
        const recCount = (worker.records || []).filter(r => r.work_type === workType).length;

        return (
          <Card key={worker.id} onPress={() => toggle(worker.id)} style={{
            borderWidth: 2,
            borderColor: isSelected ? C.accent : 'transparent',
            backgroundColor: isSelected ? '#FEF3C7' : C.white,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6',
                alignItems: 'center', justifyContent: 'center', marginRight: 12,
              }}>
                <Text style={{ fontSize: 22 }}>👷</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                  {worker.name || 'ไม่มีชื่อ'}
                </Text>
                <Text style={{ fontSize: 12, color: C.textSec }}>
                  {worker.role || '-'} • {recCount} บันทึก
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
                  {avg.toFixed(1)}
                </Text>
                <Text style={{ fontSize: 10, color: C.textLight }}>{wt.unit}</Text>
              </View>

              <View style={{
                width: 32, height: 32, borderRadius: 8,
                backgroundColor: isSelected ? C.accent : '#E5E7EB',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={isSelected ? 'checkmark' : 'add'} size={18} color="#fff" />
              </View>
            </View>
          </Card>
        );
      }) : (
        <Empty icon="people-outline" title={`ไม่มีช่างที่มีสถิติ "${wt.id}"`}
          subtitle="ให้เพิ่มสถิติงานประเภทนี้ให้ช่างก่อนในหน้าสถิติช่าง" />
      )}

      {team.length > 0 && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 }}>
            สรุปศักยภาพทีม
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{team.length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>สมาชิก</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{teamOutput.toFixed(1)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{wt.unit}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: teamEfficiency >= 100 ? '#10B981' : '#F59E0B', fontSize: 24, fontWeight: '800' }}>
                {wt.standard ? `${teamEfficiency.toFixed(0)}%` : '-'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>เทียบมาตรฐาน</Text>
            </View>
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>
            สัดส่วนผลผลิตแต่ละคน
          </Text>
          {team.map(w => {
            const avg = getAvgOutput(w, workType);
            const pct = teamOutput > 0 ? (avg / teamOutput) * 100 : 0;
            return (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', width: 80 }}>
                  {w.name}
                </Text>
                <View style={{ flex: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.accent, borderRadius: 6 }} />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, width: 70, textAlign: 'right' }}>
                  {avg.toFixed(1)} ({pct.toFixed(0)}%)
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
// แท็บทำนายผลผลิต
// ============================================================
function PredictTab({ workers }) {
  const [workType, setWorkType] = useState('โครงสร้าง คสล.');
  const [selectedIds, setSelectedIds] = useState([]);
  const [totalWork, setTotalWork] = useState('');

  const wt = WORK_TYPES.find(w => w.id === workType) || WORK_TYPES[0];
  const candidates = workers.filter(w => hasRecordsFor(w, workType));
  const team = candidates.filter(w => selectedIds.includes(w.id));

  const actualTeamOutput = team.reduce((sum, w) => sum + getAvgOutput(w, workType), 0);
  const standardExpectedOutput = team.length * (wt.standard || 0);
  
  const teamOutput = actualTeamOutput > 0 ? actualTeamOutput : standardExpectedOutput;
  
  const teamQuality = team.length > 0
    ? team.reduce((sum, w) => sum + getAvgQuality(w, workType), 0) / team.length
    : 0;
    
  const tw = parseFloat(totalWork) || 0;
  
  const safetyFactor = 1.1; 
  const daysNeeded = (teamOutput > 0 && tw > 0) ? Math.ceil((tw * safetyFactor) / teamOutput) : null;

  const toggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <View>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>ประเภทงาน</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => (
              <TouchableOpacity key={w.id}
                onPress={() => { setWorkType(w.id); setSelectedIds([]); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: workType === w.id ? C.accent : '#F3F4F6',
                  borderWidth: workType === w.id ? 0 : 1, borderColor: C.border,
                }}>
                <Ionicons name={w.icon} size={14} color={workType === w.id ? '#fff' : C.textSec} />
                <Text style={{ color: workType === w.id ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{w.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 10 }}>เลือกทีม</Text>
      {candidates.length > 0 ? candidates.map(worker => {
        const isSelected = selectedIds.includes(worker.id);
        const avg = getAvgOutput(worker, workType);
        return (
          <Card key={worker.id} onPress={() => toggle(worker.id)} style={{
            borderWidth: 2,
            borderColor: isSelected ? C.accent : 'transparent',
            backgroundColor: isSelected ? '#FEF3C7' : C.white,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Text style={{ fontSize: 18 }}>👷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{worker.name}</Text>
                <Text style={{ fontSize: 11, color: C.textSec }}>{avg.toFixed(1)} {wt.unit}</Text>
              </View>
              <View style={{
                width: 28, height: 28, borderRadius: 7,
                backgroundColor: isSelected ? C.accent : '#E5E7EB',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={isSelected ? 'checkmark' : 'add'} size={16} color="#fff" />
              </View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title={`ไม่มีช่างที่มีสถิติ "${wt.id}"`} />}

      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>
          ปริมาณงานทั้งหมด ({wt.unit.replace('/วัน', '')})
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
          borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12,
        }}>
          <Ionicons name="calculator-outline" size={18} color={C.textLight} style={{ marginRight: 8 }} />
          <TextInput value={totalWork} onChangeText={setTotalWork}
            placeholder="เช่น 5000" keyboardType="numeric"
            style={{ flex: 1, fontSize: 18, fontWeight: '700', color: C.text, paddingVertical: 14 }} />
        </View>
      </Card>

      {team.length > 0 && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 14 }}>
            ผลการทำนาย
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>กำลังผลิตทีม/วัน</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.accent, marginTop: 4 }}>{teamOutput.toFixed(1)}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{wt.unit}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>คุณภาพเฉลี่ย</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: qualityColor(teamQuality), marginTop: 4 }}>{teamQuality.toFixed(1)}%</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>ของทีม</Text>
            </View>
          </View>

          {daysNeeded ? (
            <View style={{
              marginTop: 16, padding: 20, alignItems: 'center',
              backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10,
              borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
            }}>
              <Text style={{ fontSize: 11, color: C.accent, fontWeight: '600' }}>จำนวนวันที่ต้องใช้ (รวม Safety Factor 10%)</Text>
              <Text style={{ fontSize: 48, fontWeight: '900', color: C.accent, marginTop: 4 }}>{daysNeeded}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'center' }}>
                วันทำงาน ({tw.toLocaleString()} × 1.1 ÷ {teamOutput.toFixed(1)} {wt.unit})
              </Text>
            </View>
          ) : (
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