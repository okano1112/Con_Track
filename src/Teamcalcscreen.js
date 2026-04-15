// src/Teamcalcscreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { C, Card, Header, Empty } from './Components';
import { getWorkersWithRecords, getAllProjects } from './db';

const screenWidth = Dimensions.get("window").width;

const WORK_TYPES = [
  { id: 'ผูกเหล็ก', unit: 'กก./วัน', icon: 'construct-outline', standard: 50 },
  { id: 'เทปูน', unit: 'ลบ.ม./วัน', icon: 'cube-outline', standard: 3 },
  { id: 'ก่ออิฐ', unit: 'ตร.ม./วัน', icon: 'grid-outline', standard: 24 },
  { id: 'ฉาบปูน', unit: 'ตร.ม./วัน', icon: 'layers-outline', standard: 14 },
  { id: 'งานไม้', unit: 'ตร.ม./วัน', icon: 'hammer-outline', standard: 20 },
  { id: 'งานไฟฟ้า', unit: 'จุด/วัน', icon: 'flash-outline', standard: 13 },
  { id: 'งานประปา', unit: 'จุด/วัน', icon: 'water-outline', standard: 10 },
  { id: 'งานทาสี', unit: 'ตร.ม./วัน', icon: 'color-palette-outline', standard: 85 },
  { id: 'งานกระเบื้อง', unit: 'ตร.ม./วัน', icon: 'apps-outline', standard: 25 },
  { id: 'งานฝ้า', unit: 'ตร.ม./วัน', icon: 'resize-outline', standard: 35 },
  { id: 'โครงสร้าง คสล.', unit: 'ตร.ม./วัน', icon: 'business-outline', standard: 27 },
  { id: 'มุงหลังคา', unit: 'ตร.ม./วัน', icon: 'home-outline', standard: 43 },
];

const OUTDOOR_JOBS = ['เทปูน', 'โครงสร้าง คสล.', 'มุงหลังคา', 'ผูกเหล็ก'];
const INDOOR_JOBS = ['ฉาบปูน', 'งานกระเบื้อง', 'งานทาสี', 'งานฝ้า', 'งานไฟฟ้า', 'งานประปา'];

function getEffectiveOutput(worker, workTypeId) {
  const recs = (worker.records || []).filter(r => r.work_type === workTypeId);
  if (recs.length > 0) return recs.reduce((sum, r) => sum + (r.output || 0), 0) / recs.length;
  return 0; 
}

function calculateScore(worker, workTypeId) {
  const recs = (worker.records || []).filter(r => r.work_type === workTypeId);
  if (recs.length === 0) return 0;
  const avgOut = recs.reduce((sum, r) => sum + (r.output || 0), 0) / recs.length;
  const avgQual = recs.reduce((sum, r) => sum + (r.quality || 0), 0) / recs.length;
  return (avgOut * 0.6) + (avgQual * 0.4); 
}

function calculateTeamQuality(team, workTypeId) {
  if (team.length === 0) return 0;
  let totalOutput = 0; let totalWeightedQuality = 0; let outputs = [];
  team.forEach(w => {
    const out = getEffectiveOutput(w, workTypeId);
    outputs.push(out);
    const recs = (w.records || []).filter(r => r.work_type === workTypeId);
    let q = 80; if (recs.length > 0) q = recs.reduce((sum, r) => sum + (r.quality || 0), 0) / recs.length;
    totalOutput += out; totalWeightedQuality += (q * out);
  });
  let baseQuality = totalOutput > 0 ? totalWeightedQuality / totalOutput : 0;
  if (team.length > 1 && totalOutput > 0) {
    const maxOut = Math.max(...outputs); const minOut = Math.min(...outputs);
    if (maxOut > 0) { const gapRatio = (maxOut - minOut) / maxOut; baseQuality -= gapRatio * 20; }
  }
  return Math.max(0, baseQuality); 
}

function qualityColor(q) {
  if (q >= 90) return '#10B981';
  if (q >= 75) return '#F59E0B';
  if (q === 0) return '#9CA3AF'; 
  return '#EF4444';
}

export default function TeamCalcScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('team');

  const load = async () => {
    try {
      setWorkers(await getWorkersWithRecords());
      setProjects(await getAllProjects());
    } catch (e) { console.log('Load error:', e); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="จัดทีมและทำนายผลผลิต" onBack={() => navigation.goBack()} />

      <View style={{ flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
        {[{ key: 'team', label: 'จัดทีม', icon: 'people-outline' }, { key: 'predict', label: 'ทำนายผลผลิต', icon: 'calculator-outline' }].map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: tab === t.key ? C.primary : 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? C.primary : C.textLight} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: tab === t.key ? C.primary : C.textSec }}>{t.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {tab === 'team' ? <TeamTab workers={workers} /> : <PredictTab workers={workers} projects={projects} />}
      </ScrollView>
    </View>
  );
}

// ==========================================
// แท็บ 1: จัดทีม
// ==========================================
function TeamTab({ workers }) {
  const [workType, setWorkType] = useState('ผูกเหล็ก');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isRaining, setIsRaining] = useState(false);
  const [otHours, setOtHours] = useState(0);

  const wt = WORK_TYPES.find(w => w.id === workType) || WORK_TYPES[0];
  
  const candidates = [...workers].map(w => ({
    ...w, aiScore: calculateScore(w, workType)
  })).sort((a, b) => b.aiScore - a.aiScore);

  const team = candidates.filter(w => selectedIds.includes(w.id));
  
  const baseTeamOutput = team.reduce((sum, w) => sum + getEffectiveOutput(w, workType), 0);
  const extraOTOutput = (baseTeamOutput / 8) * otHours; 
  const teamOutput = baseTeamOutput + extraOTOutput;

  // 🌟 คำนวณค่าแรงรายวัน
  const baseWage = team.reduce((sum, w) => sum + (parseFloat(w.daily_wage) || 300), 0);
  const otWage = (baseWage / 8) * 1.5 * otHours; // เรท OT 1.5 เท่า
  const totalDailyWage = baseWage + otWage;

  const teamQuality = calculateTeamQuality(team, workType);

  const minExpected = Math.round(teamOutput * 0.95);
  const maxExpected = Math.round(teamOutput * 1.05);

  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const getAlternativeIndoorTask = (worker) => {
    const skills = [...new Set((worker.records || []).map(r => r.work_type))];
    const indoorSkills = skills.filter(s => INDOOR_JOBS.includes(s));
    return indoorSkills.length > 0 ? indoorSkills[0] : null;
  };

  return (
    <View>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>1. เลือกประเภทงานที่ต้องการ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => (
              <TouchableOpacity key={w.id} onPress={() => { setWorkType(w.id); setSelectedIds([]); setIsRaining(false); setOtHours(0); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: workType === w.id ? C.accent : '#F3F4F6', borderWidth: workType === w.id ? 0 : 1, borderColor: C.border }}>
                <Ionicons name={w.icon} size={14} color={workType === w.id ? '#fff' : C.textSec} />
                <Text style={{ color: workType === w.id ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{w.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>2. เลือกช่างเข้าทีม</Text>
        {OUTDOOR_JOBS.includes(workType) && (
          <TouchableOpacity onPress={() => setIsRaining(!isRaining)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isRaining ? '#FEE2E2' : '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: isRaining ? '#FCA5A5' : '#D1D5DB' }}>
            <Ionicons name="rainy" size={16} color={isRaining ? '#EF4444' : '#6B7280'} />
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: isRaining ? '#EF4444' : '#6B7280', marginLeft: 5 }}>{isRaining ? 'ฝนตกหนัก' : 'จำลองฝนตก'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isRaining && OUTDOOR_JOBS.includes(workType) && (
        <View style={{ backgroundColor: '#FFFBEB', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#FDE68A' }}>
          <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#D97706', marginBottom: 5 }}>⚠️ ฝนตก! งาน {workType} ไม่สามารถทำได้</Text>
          {team.length === 0 ? (
            <Text style={{ fontSize: 12, color: '#92400E' }}>กรุณาเลือกช่างเพื่อดูคำแนะนำการสลับงาน</Text>
          ) : (
            team.map(w => {
              const altTask = getAlternativeIndoorTask(w);
              return (
                <Text key={w.id} style={{ fontSize: 12, color: '#92400E', marginTop: 3 }}>
                  • {w.name} 👉 {altTask ? `ย้ายไปทำ "งาน${altTask}" ได้` : 'ไม่มีทักษะในร่ม (แนะนำให้พักงาน)'}
                </Text>
              )
            })
          )}
        </View>
      )}

      {candidates.length > 0 ? candidates.map((worker, index) => {
        const isSelected = selectedIds.includes(worker.id);
        const hasData = worker.aiScore > 0;
        const effectiveOutput = getEffectiveOutput(worker, workType);
        const isRecommended = hasData && index < 3;

        return (
          <Card key={worker.id} onPress={() => toggle(worker.id)} style={{ borderWidth: 2, borderColor: isSelected ? C.accent : 'transparent', backgroundColor: isSelected ? '#FEF3C7' : C.white }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Text style={{ fontSize: 22 }}>👷</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{worker.name}</Text>
                  {isRecommended && (
                    <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, borderWidth: 1, borderColor: '#10B981' }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#10B981' }}>⭐ แนะนำ</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: hasData ? C.textSec : '#EF4444', marginTop: 2 }}>
                  {hasData ? `ทักษะประเมิน: ${(worker.aiScore).toFixed(1)}/100` : 'ยังไม่มีสถิติ (รองาน)'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>{effectiveOutput.toFixed(1)}</Text>
                <Text style={{ fontSize: 10, color: C.textLight }}>{wt.unit}</Text>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isSelected ? C.accent : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={isSelected ? 'checkmark' : 'add'} size={18} color="#fff" /></View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ไม่มีข้อมูลพนักงาน" />}

      {team.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="time" size={20} color="#F59E0B" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>จำลองการเพิ่มโอที (OT)</Text>
          </View>
          <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>เลือกจำนวนชั่วโมง OT เพื่อดูปริมาณงานที่จะได้เพิ่มขึ้นจากช่างในทีม</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(h => (
              <TouchableOpacity key={h} onPress={() => setOtHours(h)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: otHours === h ? '#F59E0B' : '#F3F4F6', borderWidth: 1, borderColor: otHours === h ? '#D97706' : '#D1D5DB' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: otHours === h ? '#fff' : C.textSec }}>{h > 0 ? `+${h} ชม.` : 'ปกติ'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {otHours > 0 && (
            <View style={{ marginTop: 12, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, alignItems: 'center' }}>
               <Text style={{ fontSize: 13, color: '#B45309' }}>
                 📈 จะได้ผลผลิตเพิ่มอีกประมาณ <Text style={{fontWeight: 'bold', fontSize: 15}}>+{extraOTOutput.toFixed(1)}</Text> {wt.unit.replace('/วัน', '')}
               </Text>
            </View>
          )}
        </Card>
      )}

      {team.length > 0 && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 }}>สรุปศักยภาพทีมที่จัด</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{team.length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>สมาชิก (คน)</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{teamOutput.toFixed(1)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{wt.unit} {otHours > 0 ? '(รวม OT)' : ''}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: qualityColor(teamQuality), fontSize: 24, fontWeight: '800' }}>{teamQuality > 0 ? `${teamQuality.toFixed(1)}%` : '-'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>คุณภาพรวม</Text>
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', padding: 12, borderRadius: 10, marginTop: 14, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="analytics" size={20} color={C.accent} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>โอกาสได้ผลงานจริง (±5%)</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.accent }}>
                {minExpected} - {maxExpected} {wt.unit.replace('/วัน', '')} / วัน
              </Text>
            </View>
          </View>

          {/* 🌟 แสดงส่วนสรุปต้นทุนค่าแรง */}
          <View style={{ backgroundColor: '#ECFCCB', padding: 12, borderRadius: 10, marginTop: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4D7C0F', marginBottom: 5 }}>💰 ประมาณการต้นทุนค่าแรงต่อวัน</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#3F6212' }}>ค่าแรงปกติ ({team.length} คน):</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#3F6212' }}>{baseWage.toLocaleString()} บาท</Text>
            </View>
            {otHours > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                <Text style={{ fontSize: 12, color: '#3F6212' }}>ค่าโอที (+{otHours} ชม. เรท 1.5):</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#3F6212' }}>{otWage.toLocaleString()} บาท</Text>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: '#84CC16', marginVertical: 6 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534' }}>รวมจ่ายทั้งสิ้นต่อวัน:</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534' }}>{totalDailyWage.toLocaleString()} บาท/วัน</Text>
            </View>
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>สัดส่วนผลผลิตแต่ละคน (รวมโอทีแล้ว)</Text>
          {team.map(w => {
            const baseOutput = getEffectiveOutput(w, workType);
            const outputVal = baseOutput + ((baseOutput / 8) * otHours); 
            const pct = teamOutput > 0 ? (outputVal / teamOutput) * 100 : 0;
            return (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', width: 80 }} numberOfLines={1}>{w.name}</Text>
                <View style={{ flex: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.accent, borderRadius: 6 }} />
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, width: 70, textAlign: 'right' }}>{outputVal.toFixed(1)} ({pct.toFixed(0)}%)</Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

// ==========================================
// แท็บ 2: ทำนายผลผลิต
// ==========================================
function PredictTab({ workers, projects }) {
  const [workType, setWorkType] = useState('ผูกเหล็ก');
  const [selectedIds, setSelectedIds] = useState([]);
  const [totalWork, setTotalWork] = useState('');
  const [targetDays, setTargetDays] = useState(''); 
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [otHours, setOtHours] = useState(0);

  const wt = WORK_TYPES.find(w => w.id === workType) || WORK_TYPES[0];
  
  const candidates = [...workers].map(w => ({
    ...w, aiScore: calculateScore(w, workType)
  })).sort((a, b) => b.aiScore - a.aiScore);

  const team = candidates.filter(w => selectedIds.includes(w.id));
  
  const baseTeamOutput = team.reduce((sum, w) => sum + getEffectiveOutput(w, workType), 0);
  const extraOTOutput = (baseTeamOutput / 8) * otHours; 
  const teamOutput = baseTeamOutput + extraOTOutput;

  // 🌟 คำนวณค่าแรงรายวัน สำหรับแท็บทำนาย
  const baseWage = team.reduce((sum, w) => sum + (parseFloat(w.daily_wage) || 300), 0);
  const otWage = (baseWage / 8) * 1.5 * otHours; 
  const totalDailyWage = baseWage + otWage;

  const teamQuality = calculateTeamQuality(team, workType);

  const tw = parseFloat(totalWork) || 0;
  const tDays = parseInt(targetDays) || 0;
  const daysNeeded = (teamOutput > 0 && tw > 0) ? Math.ceil((tw * 1.1) / teamOutput) : 0; 

  const toggle = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  let chartData1 = null;
  if (tw > 0 && tDays > 0 && teamOutput > 0) {
    const maxDays = Math.max(tDays, daysNeeded);
    const steps = 4; const labels = []; const planLine = []; const actualLine = [];
    for (let i = 0; i <= steps; i++) {
      const currentDay = Math.round((maxDays / steps) * i);
      labels.push(`D${currentDay}`);
      let pVal = (tw / tDays) * currentDay; planLine.push(pVal > tw ? tw : pVal); 
      let aVal = teamOutput * currentDay; actualLine.push(aVal > tw ? tw : aVal);
    }
    chartData1 = { labels, datasets: [{ data: planLine, color: () => `rgba(59, 130, 246, 1)`, strokeWidth: 2 }, { data: actualLine, color: () => `rgba(16, 185, 129, 1)`, strokeWidth: 3 }], legend: ["แผนงาน (Plan)", "ทีมปัจจุบัน (Actual)"] };
  }

  const selProject = projects.find(p => p.id === selectedProjectId);
  let chartDataProject = null;
  if (selProject && tw > 0 && teamOutput > 0) {
    let pDuration = tDays || 30; 
    if (selProject.start_date && selProject.end_date) {
       const s = new Date(selProject.start_date); const e = new Date(selProject.end_date);
       if (!isNaN(s) && !isNaN(e)) pDuration = Math.max(1, Math.ceil((e - s) / 86400000));
    }
    const currentProg = selProject.progress || 0; 
    const teamSpeedPct = (teamOutput / (tw * 1.1)) * 100; 
    const daysToFinishRemaining = Math.ceil((100 - currentProg) / teamSpeedPct);
    const maxGraphDays = Math.max(pDuration, daysToFinishRemaining);
    const pSteps = 4; const pLabels = []; const pPlanLine = []; const pForecastLine = [];
    for (let i = 0; i <= pSteps; i++) {
      const dayMark = Math.round((maxGraphDays / pSteps) * i);
      pLabels.push(`D${dayMark}`);
      let pVal = (100 / pDuration) * dayMark; pPlanLine.push(pVal > 100 ? 100 : pVal);
      let fVal = currentProg + (teamSpeedPct * dayMark); pForecastLine.push(fVal > 100 ? 100 : fVal);
    }
    chartDataProject = { labels: pLabels, datasets: [{ data: pPlanLine, color: () => `rgba(99, 102, 241, 1)`, strokeWidth: 2 }, { data: pForecastLine, color: () => `rgba(245, 158, 11, 1)`, strokeWidth: 3 }], legend: ["แผนแม่บท (100%)", "คาดการณ์ (ทีมนี้)"] };
  }

  return (
    <View>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>ประเภทงาน</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => (
              <TouchableOpacity key={w.id} onPress={() => { setWorkType(w.id); setSelectedIds([]); setOtHours(0); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: workType === w.id ? C.accent : '#F3F4F6', borderWidth: workType === w.id ? 0 : 1, borderColor: C.border }}>
                <Ionicons name={w.icon} size={14} color={workType === w.id ? '#fff' : C.textSec} />
                <Text style={{ color: workType === w.id ? '#fff' : C.textSec, fontWeight: '600', fontSize: 12 }}>{w.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 10 }}>เลือกทีม</Text>
      {candidates.length > 0 ? candidates.map((worker, index) => {
        const isSelected = selectedIds.includes(worker.id);
        const hasData = worker.aiScore > 0;
        const outputVal = getEffectiveOutput(worker, workType);
        const isRecommended = hasData && index < 3;

        return (
          <Card key={worker.id} onPress={() => toggle(worker.id)} style={{ borderWidth: 2, borderColor: isSelected ? C.accent : 'transparent', backgroundColor: isSelected ? '#FEF3C7' : C.white }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ fontSize: 18 }}>👷</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{worker.name}</Text>
                  {isRecommended && (
                    <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8, borderWidth: 1, borderColor: '#10B981' }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#10B981' }}>⭐ แนะนำ</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: hasData ? C.textSec : '#EF4444', marginTop: 2 }}>
                  กำลังผลิต: {outputVal.toFixed(1)} {wt.unit} {hasData ? ` | ทักษะ: ${(worker.aiScore).toFixed(1)}/100` : '(ยังไม่มีสถิติ)'}
                </Text>
              </View>
              <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: isSelected ? C.accent : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={isSelected ? 'checkmark' : 'add'} size={16} color="#fff" /></View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ไม่มีพนักงานในระบบ" />}

      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>เป้าหมายแผนงาน (Plan)</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.5 }}>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>ปริมาณงานทั้งหมด</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 }}><TextInput value={totalWork} onChangeText={setTotalWork} placeholder="เช่น 100" keyboardType="numeric" style={{ flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 }} /></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>เวลาที่กำหนด (วัน)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 }}><TextInput value={targetDays} onChangeText={setTargetDays} placeholder="เช่น 10" keyboardType="numeric" style={{ flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 }} /></View>
          </View>
        </View>
      </Card>

      {team.length > 0 && totalWork !== '' && (
        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>🕒 จำลองการเร่งงานด้วย OT</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(h => (
              <TouchableOpacity key={h} onPress={() => setOtHours(h)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: otHours === h ? '#F59E0B' : '#F3F4F6', borderWidth: 1, borderColor: otHours === h ? '#D97706' : '#D1D5DB' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: otHours === h ? '#fff' : C.textSec }}>{h > 0 ? `+${h} ชม.` : 'ปกติ'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {team.length > 0 && (
        <View>
          <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 14 }}>สรุปผลประเมินทีม {otHours > 0 && '(รวม OT แล้ว)'}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>กำลังผลิตทีม/วัน</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: C.accent, marginTop: 4 }}>{teamOutput.toFixed(1)}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{wt.unit}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>คุณภาพทีม (หักลบแล้ว)</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: qualityColor(teamQuality), marginTop: 4 }}>{teamQuality > 0 ? `${teamQuality.toFixed(1)}%` : '-'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>เปอร์เซ็นต์</Text>
              </View>
            </View>

            {/* 🌟 แสดงส่วนสรุปยอดจ่ายทั้งหมด (Grand Total) */}
            {daysNeeded > 0 && (
              <View style={{ backgroundColor: '#ECFCCB', padding: 12, borderRadius: 10, marginTop: 14 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4D7C0F', marginBottom: 5 }}>💰 ประมาณการต้นทุนโปรเจกต์นี้</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#3F6212' }}>ค่าแรงต่อวัน (รวม OT):</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#3F6212' }}>{totalDailyWage.toLocaleString()} ฿</Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#84CC16', marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#991B1B' }}>ยอดจ่ายรวม ({daysNeeded} วัน):</Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#991B1B' }}>{(totalDailyWage * daysNeeded).toLocaleString()} บาท</Text>
                </View>
              </View>
            )}

            {chartData1 && (
              <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: 'center' }}>📊 กราฟเนื้องานสะสม (ปริมาณ vs เวลา)</Text>
                <LineChart data={chartData1} width={screenWidth - 80} height={200} bezier chartConfig={{ backgroundColor: '#fff', backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff', decimalPlaces: 0, color: (o = 1) => `rgba(0, 0, 0, ${o})`, labelColor: (o = 1) => `rgba(0, 0, 0, ${o})`, propsForDots: { r: "3" } }} style={{ borderRadius: 10 }} />
                
                <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: daysNeeded <= tDays ? '#D1FAE5' : '#FEE2E2' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: daysNeeded <= tDays ? '#059669' : '#DC2626', textAlign: 'center' }}>
                    {daysNeeded <= tDays ? '✅ ทีมนี้ทำงานเสร็จทันตามแผน!' : '⚠️ ทีมนี้อาจทำงานล่าช้ากว่าแผน (Behind Schedule)'}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSec, marginTop: 4, textAlign: 'center' }}>
                    ทีมใช้เวลาจริงประมาณ {daysNeeded} วัน {otHours > 0 && `(ประหยัดเวลาลงเพราะ OT)`}
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {chartData1 && (
            <Card style={{ marginTop: 16 }}>
              {projects.length > 0 && (
                <View>
                  <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 8 }}>เลือกโปรเจกต์ที่ต้องการวิเคราะห์ (S-Curve)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {projects.map(p => (
                        <TouchableOpacity key={p.id} onPress={() => setSelectedProjectId(p.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: selectedProjectId === p.id ? '#EDE9FE' : '#F3F4F6', borderWidth: 1, borderColor: selectedProjectId === p.id ? '#8B5CF6' : C.border }}>
                          <Text style={{ color: selectedProjectId === p.id ? '#6D28D9' : C.text, fontWeight: '700', fontSize: 13 }}>{p.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              {chartDataProject && (
                <View style={{ backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: 'center' }}>📈 S-Curve วิเคราะห์ความคืบหน้าโปรเจกต์ (%)</Text>
                  <LineChart data={chartDataProject} width={screenWidth - 80} height={200} bezier chartConfig={{ backgroundColor: '#F9FAFB', backgroundGradientFrom: '#F9FAFB', backgroundGradientTo: '#F9FAFB', decimalPlaces: 0, color: (o = 1) => `rgba(0, 0, 0, ${o})`, labelColor: (o = 1) => `rgba(0, 0, 0, ${o})`, propsForDots: { r: "3" } }} style={{ borderRadius: 10 }} />
                </View>
              )}
            </Card>
          )}
        </View>
      )}
    </View>
  );
}