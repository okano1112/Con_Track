// TeamCalcScreen.js
// ============================================================
// หน้าจัดทีมและทำนายผลผลิต + เชื่อมระบบสภาพอากาศ
// (ปรับปรุง: เอาคำว่า "ทักษะ" ออก เปลี่ยนเป็น "คะแนน/ผลงาน")
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { C, Card, Header, Empty, Badge } from './Components';
import { getWorkersWithRecords } from './db';
import { getWeatherForecast } from './WeatherScreen';

const screenWidth = Dimensions.get("window").width;

// ============================================================
// WORK_TYPES (ตรงกับ WorkerStatsScreen)
// ============================================================
const WORK_TYPES = [
  { id: 'ผูกเหล็ก', unit: 'กก./วัน', icon: 'construct-outline', standard: 175, outdoor: true },
  { id: 'เทปูน', unit: 'ลบ.ม./วัน', icon: 'cube-outline', standard: 4, outdoor: true },
  { id: 'โครงสร้าง คสล.', unit: 'ลบ.ม./วัน', icon: 'business-outline', standard: 2.8, outdoor: true },
  { id: 'มุงหลังคา', unit: 'ตร.ม./วัน', icon: 'home-outline', standard: 25, outdoor: true },
  { id: 'ก่ออิฐ', unit: 'ตร.ม./วัน', icon: 'grid-outline', standard: 10, outdoor: false },
  { id: 'ฉาบปูน', unit: 'ตร.ม./วัน', icon: 'layers-outline', standard: 10, outdoor: false },
  { id: 'งานไม้', unit: 'ตร.ม./วัน', icon: 'hammer-outline', standard: 5, outdoor: false },
  { id: 'งานไฟฟ้า', unit: 'จุด/วัน', icon: 'flash-outline', standard: 10, outdoor: false },
  { id: 'งานประปา', unit: 'จุด/วัน', icon: 'water-outline', standard: 8, outdoor: false },
  { id: 'งานทาสี', unit: 'ตร.ม./วัน', icon: 'color-palette-outline', standard: 40, outdoor: false },
  { id: 'งานกระเบื้อง', unit: 'ตร.ม./วัน', icon: 'apps-outline', standard: 8, outdoor: false },
  { id: 'งานฝ้า', unit: 'ตร.ม./วัน', icon: 'resize-outline', standard: 12, outdoor: false },
];

const OUTDOOR_JOBS = ['เทปูน', 'โครงสร้าง คสล.', 'มุงหลังคา', 'ผูกเหล็ก'];

// ============================================================
// Helpers
// ============================================================
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
  let totalOutput = 0, totalWeightedQuality = 0, outputs = [];

  team.forEach(w => {
    const out = getEffectiveOutput(w, workTypeId);
    outputs.push(out);
    const recs = (w.records || []).filter(r => r.work_type === workTypeId);
    let q = 80;
    if (recs.length > 0) q = recs.reduce((sum, r) => sum + (r.quality || 0), 0) / recs.length;
    totalOutput += out;
    totalWeightedQuality += (q * out);
  });

  let baseQuality = totalOutput > 0 ? totalWeightedQuality / totalOutput : 0;
  if (team.length > 1 && totalOutput > 0) {
    const maxOut = Math.max(...outputs);
    const minOut = Math.min(...outputs);
    if (maxOut > 0) {
      const gapRatio = (maxOut - minOut) / maxOut;
      baseQuality -= gapRatio * 20;
    }
  }
  return Math.max(0, baseQuality);
}

function qualityColor(q) {
  if (q >= 90) return '#10B981';
  if (q >= 75) return '#F59E0B';
  if (q === 0) return '#9CA3AF';
  return '#EF4444';
}

function getWeatherStatus(rainProb) {
  if (rainProb >= 70) return { status: 'ฝนตกหนัก', color: '#EF4444', canOutdoor: false };
  if (rainProb >= 40) return { status: 'อาจมีฝน', color: '#F59E0B', canOutdoor: true };
  return { status: 'แจ่มใส', color: '#10B981', canOutdoor: true };
}

// ============================================================
// MAIN
// ============================================================
export default function TeamCalcScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('team');
  const [weatherData, setWeatherData] = useState(null);

  const load = async () => {
    try {
      setWorkers(await getWorkersWithRecords());
      const weather = await getWeatherForecast();
      setWeatherData(weather);
    } catch (e) { console.log('Load error:', e); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="จัดทีมและทำนายผลผลิต"
        onBack={() => navigation.openDrawer && navigation.openDrawer()} />

      <View style={{
        flexDirection: 'row', backgroundColor: C.white,
        borderBottomWidth: 1, borderBottomColor: C.border
      }}>
        {[
          { key: 'team', label: 'จัดทีม', icon: 'people-outline' },
          { key: 'predict', label: 'ทำนายผลผลิต', icon: 'calculator-outline' }
        ].map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: tab === t.key ? C.primary : 'transparent'
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? C.primary : C.textLight} />
              <Text style={{
                fontSize: 14, fontWeight: '600',
                color: tab === t.key ? C.primary : C.textSec
              }}>{t.label}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>
        {tab === 'team' ? (
          <TeamTab workers={workers} weatherData={weatherData} navigation={navigation} />
        ) : (
          <PredictTab workers={workers} weatherData={weatherData} />
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// TAB: Team (จัดทีม)
// ============================================================
function TeamTab({ workers, weatherData, navigation }) {
  const [workType, setWorkType] = useState('ผูกเหล็ก');
  const [selectedIds, setSelectedIds] = useState([]);
  const [otHours, setOtHours] = useState(0);

  const wt = WORK_TYPES.find(w => w.id === workType) || WORK_TYPES[0];
  const isOutdoorJob = OUTDOOR_JOBS.includes(workType);

  const todayForecast = weatherData?.forecast?.[0];
  const todayWeather = todayForecast ? getWeatherStatus(todayForecast.rainProb) : null;

  const candidates = [...workers].map(w => ({
    ...w, aiScore: calculateScore(w, workType)
  })).sort((a, b) => b.aiScore - a.aiScore);

  const team = candidates.filter(w => selectedIds.includes(w.id));

  const baseTeamOutput = team.reduce((sum, w) => sum + getEffectiveOutput(w, workType), 0);
  const extraOTOutput = (baseTeamOutput / 8) * otHours;
  const teamOutput = baseTeamOutput + extraOTOutput;

  const baseWage = team.reduce((sum, w) => sum + (parseFloat(w.daily_wage) || 300), 0);
  const otWage = (baseWage / 8) * 1.5 * otHours;
  const totalDailyWage = baseWage + otWage;

  const teamQuality = calculateTeamQuality(team, workType);

  const toggle = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const weatherAffectsWork = isOutdoorJob && todayWeather && !todayWeather.canOutdoor;

  return (
    <View>
      {/* Weather Card */}
      {weatherData && (
        <Card style={{ marginBottom: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="cloudy" size={24} color="#3B82F6" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E40AF', marginLeft: 10 }}>
                สภาพอากาศหน้างาน
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('WeatherScreen')}>
              <Text style={{ fontSize: 12, color: '#3B82F6', fontWeight: '600' }}>ดูเพิ่มเติม →</Text>
            </TouchableOpacity>
          </View>
          {todayForecast && todayWeather && (
            <View style={{
              marginTop: 10,
              backgroundColor: todayWeather.canOutdoor ? '#D1FAE5' : '#FEE2E2',
              padding: 12, borderRadius: 10
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={todayWeather.canOutdoor ? 'sunny' : 'rainy'}
                  size={24} color={todayWeather.color} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: todayWeather.color, marginLeft: 10 }}>
                  วันนี้: {todayWeather.status}
                </Text>
                <Text style={{ fontSize: 12, color: '#374151', marginLeft: 10 }}>
                  🌧️ {todayForecast.rainProb}% • {Math.round(todayForecast.tempMax)}°/{Math.round(todayForecast.tempMin)}°
                </Text>
              </View>
            </View>
          )}
        </Card>
      )}

      {/* Work Type Selection */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>
          1. เลือกประเภทงาน
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => {
              const isSelected = workType === w.id;
              return (
                <TouchableOpacity key={w.id}
                  onPress={() => { setWorkType(w.id); setSelectedIds([]); setOtHours(0); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: isSelected ? C.accent : '#F3F4F6',
                    borderWidth: isSelected ? 0 : 1, borderColor: C.border
                  }}>
                  <Ionicons name={w.icon} size={14} color={isSelected ? '#fff' : C.textSec} />
                  <Text style={{
                    color: isSelected ? '#fff' : C.textSec,
                    fontWeight: '600', fontSize: 12
                  }}>
                    {w.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Card>

      {weatherAffectsWork && (
        <Card style={{ marginTop: 16, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning" size={24} color="#D97706" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>
                ⚠️ อากาศไม่เหมาะกับ "{workType}"
              </Text>
              <Text style={{ fontSize: 12, color: '#B45309', marginTop: 4 }}>
                วันนี้มีโอกาสฝนตก {todayForecast.rainProb}% ควรสลับทำงานในร่ม
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Select Team */}
      <View style={{ marginTop: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>2. เลือกช่างเข้าทีม</Text>
          {team.length > 0 && (
            <Badge label={`เลือกแล้ว ${team.length} คน`} color={C.accent} bg={C.accent + '20'} />
          )}
        </View>
      </View>

      {candidates.length > 0 ? candidates.map((worker, index) => {
        const isSelected = selectedIds.includes(worker.id);
        const hasData = worker.aiScore > 0;
        const effectiveOutput = getEffectiveOutput(worker, workType);
        const isRecommended = hasData && index < 3;

        return (
          <Card key={worker.id} onPress={() => toggle(worker.id)}
            style={{
              borderWidth: 2,
              borderColor: isSelected ? C.accent : 'transparent',
              backgroundColor: isSelected ? '#FEF3C7' : C.white
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#F3F4F6',
                alignItems: 'center', justifyContent: 'center', marginRight: 12
              }}>
                <Text style={{ fontSize: 22 }}>👷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{worker.name}</Text>
                  {isRecommended && (
                    <View style={{
                      backgroundColor: '#ECFDF5',
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
                      borderWidth: 1, borderColor: '#10B981'
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#10B981' }}>⭐ แนะนำ</Text>
                    </View>
                  )}
                </View>
                <Text style={{
                  fontSize: 12, color: hasData ? C.textSec : '#EF4444', marginTop: 2
                }}>
                  {hasData ? `คะแนนผลงาน: ${(worker.aiScore).toFixed(1)}/100` : 'ยังไม่มีสถิติ'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
                  {effectiveOutput.toFixed(1)}
                </Text>
                <Text style={{ fontSize: 10, color: C.textLight }}>{wt.unit}</Text>
              </View>
              <View style={{
                width: 32, height: 32, borderRadius: 8,
                backgroundColor: isSelected ? C.accent : '#E5E7EB',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Ionicons name={isSelected ? 'checkmark' : 'add'} size={18} color="#fff" />
              </View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ไม่มีข้อมูลพนักงาน" />}

      {/* OT */}
      {team.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="time" size={20} color="#F59E0B" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>จำลองการเพิ่ม OT</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(h => (
              <TouchableOpacity key={h} onPress={() => setOtHours(h)}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8,
                  backgroundColor: otHours === h ? '#F59E0B' : '#F3F4F6',
                  borderWidth: 1, borderColor: otHours === h ? '#D97706' : '#D1D5DB'
                }}>
                <Text style={{
                  fontWeight: 'bold', fontSize: 13,
                  color: otHours === h ? '#fff' : C.textSec
                }}>
                  {h > 0 ? `+${h} ชม.` : 'ปกติ'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {otHours > 0 && (
            <View style={{
              marginTop: 12, backgroundColor: '#FEF3C7',
              padding: 10, borderRadius: 8, alignItems: 'center'
            }}>
              <Text style={{ fontSize: 13, color: '#B45309' }}>
                📈 ได้ผลผลิตเพิ่ม <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                  +{extraOTOutput.toFixed(1)}</Text> {wt.unit.replace('/วัน', '')}
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* Team Summary */}
      {team.length > 0 && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 }}>
            สรุปศักยภาพทีม
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 14, alignItems: 'center'
            }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{team.length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>สมาชิก</Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 14, alignItems: 'center'
            }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>
                {teamOutput.toFixed(1)}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                {wt.unit} {otHours > 0 ? '(รวม OT)' : ''}
              </Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 14, alignItems: 'center'
            }}>
              <Text style={{
                color: qualityColor(teamQuality), fontSize: 24, fontWeight: '800'
              }}>
                {teamQuality > 0 ? `${teamQuality.toFixed(1)}%` : '-'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>คุณภาพ</Text>
            </View>
          </View>

          <View style={{
            backgroundColor: '#ECFCCB', padding: 12, borderRadius: 10, marginTop: 14
          }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4D7C0F', marginBottom: 5 }}>
              💰 ค่าแรงต่อวัน
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534' }}>
                รวมทั้งหมด:
              </Text>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#166534' }}>
                {totalDailyWage.toLocaleString()} บาท
              </Text>
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

// ============================================================
// TAB: Predict (ทำนายผลผลิต)
// ============================================================
function PredictTab({ workers, weatherData }) {
  const [workType, setWorkType] = useState('ผูกเหล็ก');
  const [selectedIds, setSelectedIds] = useState([]);
  const [totalWork, setTotalWork] = useState('');
  const [targetDays, setTargetDays] = useState('');
  const [otHours, setOtHours] = useState(0);

  const wt = WORK_TYPES.find(w => w.id === workType) || WORK_TYPES[0];

  const candidates = [...workers].map(w => ({
    ...w, aiScore: calculateScore(w, workType)
  })).sort((a, b) => b.aiScore - a.aiScore);

  const team = candidates.filter(w => selectedIds.includes(w.id));
  const baseTeamOutput = team.reduce((sum, w) => sum + getEffectiveOutput(w, workType), 0);
  const extraOTOutput = (baseTeamOutput / 8) * otHours;
  const teamOutput = baseTeamOutput + extraOTOutput;

  const tw = parseFloat(totalWork) || 0;
  const tDays = parseInt(targetDays) || 0;
  const daysNeeded = (teamOutput > 0 && tw > 0) ? Math.ceil((tw * 1.1) / teamOutput) : 0;

  const toggle = (id) => setSelectedIds(p =>
    p.includes(id) ? p.filter(x => x !== id) : [...p, id]
  );

  let chartData = null;
  if (tw > 0 && tDays > 0 && teamOutput > 0) {
    const maxDays = Math.max(tDays, daysNeeded);
    const steps = 4;
    const labels = [], planLine = [], actualLine = [];
    for (let i = 0; i <= steps; i++) {
      const currentDay = Math.round((maxDays / steps) * i);
      labels.push(`D${currentDay}`);
      let pVal = (tw / tDays) * currentDay;
      planLine.push(pVal > tw ? tw : pVal);
      let aVal = teamOutput * currentDay;
      actualLine.push(aVal > tw ? tw : aVal);
    }
    chartData = {
      labels,
      datasets: [
        { data: planLine, color: () => `rgba(59, 130, 246, 1)`, strokeWidth: 2 },
        { data: actualLine, color: () => `rgba(16, 185, 129, 1)`, strokeWidth: 3 }
      ],
      legend: ["แผนงาน", "ทีมปัจจุบัน"]
    };
  }

  return (
    <View>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>
          ประเภทงาน
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => (
              <TouchableOpacity key={w.id}
                onPress={() => { setWorkType(w.id); setSelectedIds([]); setOtHours(0); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: workType === w.id ? C.accent : '#F3F4F6',
                  borderWidth: workType === w.id ? 0 : 1, borderColor: C.border
                }}>
                <Ionicons name={w.icon} size={14} color={workType === w.id ? '#fff' : C.textSec} />
                <Text style={{
                  color: workType === w.id ? '#fff' : C.textSec,
                  fontWeight: '600', fontSize: 12
                }}>{w.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 10 }}>
        เลือกทีม
      </Text>
      {candidates.length > 0 ? candidates.map((worker) => {
        const isSelected = selectedIds.includes(worker.id);
        const outputVal = getEffectiveOutput(worker, workType);
        return (
          <Card key={worker.id} onPress={() => toggle(worker.id)}
            style={{
              borderWidth: 2,
              borderColor: isSelected ? C.accent : 'transparent',
              backgroundColor: isSelected ? '#FEF3C7' : C.white
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: '#F3F4F6',
                alignItems: 'center', justifyContent: 'center', marginRight: 10
              }}>
                <Text style={{ fontSize: 18 }}>👷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{worker.name}</Text>
                <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                  ผลผลิต: {outputVal.toFixed(1)} {wt.unit}
                </Text>
              </View>
              <View style={{
                width: 28, height: 28, borderRadius: 7,
                backgroundColor: isSelected ? C.accent : '#E5E7EB',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Ionicons name={isSelected ? 'checkmark' : 'add'} size={16} color="#fff" />
              </View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ไม่มีพนักงาน" />}

      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>
          เป้าหมายแผนงาน
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.5 }}>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>ปริมาณงานทั้งหมด</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F9FAFB', borderRadius: 10,
              borderWidth: 1, borderColor: C.border, paddingHorizontal: 12
            }}>
              <TextInput value={totalWork} onChangeText={setTotalWork}
                placeholder="เช่น 100" keyboardType="numeric"
                style={{ flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 }} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>เวลา (วัน)</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#F9FAFB', borderRadius: 10,
              borderWidth: 1, borderColor: C.border, paddingHorizontal: 12
            }}>
              <TextInput value={targetDays} onChangeText={setTargetDays}
                placeholder="เช่น 10" keyboardType="numeric"
                style={{ flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 }} />
            </View>
          </View>
        </View>
      </Card>

      {team.length > 0 && totalWork !== '' && (
        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>
            🕒 จำลอง OT
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(h => (
              <TouchableOpacity key={h} onPress={() => setOtHours(h)}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8,
                  backgroundColor: otHours === h ? '#F59E0B' : '#F3F4F6',
                  borderWidth: 1, borderColor: otHours === h ? '#D97706' : '#D1D5DB'
                }}>
                <Text style={{
                  fontWeight: 'bold', fontSize: 13,
                  color: otHours === h ? '#fff' : C.textSec
                }}>
                  {h > 0 ? `+${h} ชม.` : 'ปกติ'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      )}

      {team.length > 0 && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 14 }}>
            สรุปผลประเมินทีม
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>กำลังผลิต/วัน</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.accent, marginTop: 4 }}>
                {teamOutput.toFixed(1)}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{wt.unit}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>วันที่ต้องใช้</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.accent, marginTop: 4 }}>
                {daysNeeded || '-'}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>วัน</Text>
            </View>
          </View>

          {chartData && (
            <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 10, padding: 12 }}>
              <Text style={{
                fontSize: 14, fontWeight: '700', color: C.text,
                marginBottom: 10, textAlign: 'center'
              }}>
                📊 กราฟเนื้องานสะสม
              </Text>
              <LineChart data={chartData} width={screenWidth - 80} height={200} bezier
                chartConfig={{
                  backgroundColor: '#fff',
                  backgroundGradientFrom: '#fff',
                  backgroundGradientTo: '#fff',
                  decimalPlaces: 0,
                  color: (o = 1) => `rgba(0, 0, 0, ${o})`,
                  labelColor: (o = 1) => `rgba(0, 0, 0, ${o})`,
                  propsForDots: { r: "3" }
                }}
                style={{ borderRadius: 10 }} />

              <View style={{
                marginTop: 12, padding: 12, borderRadius: 8,
                backgroundColor: daysNeeded <= tDays ? '#D1FAE5' : '#FEE2E2'
              }}>
                <Text style={{
                  fontSize: 13, fontWeight: '700',
                  color: daysNeeded <= tDays ? '#059669' : '#DC2626',
                  textAlign: 'center'
                }}>
                  {daysNeeded <= tDays
                    ? '✅ ทีมนี้ทำงานเสร็จทันตามแผน!'
                    : '⚠️ ทีมนี้อาจทำงานล่าช้ากว่าแผน'}
                </Text>
              </View>
            </View>
          )}
        </Card>
      )}
    </View>
  );
}