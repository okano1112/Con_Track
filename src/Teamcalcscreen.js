// src/Teamcalcscreen.js
// ============================================================
// หน้าจัดทีมและทำนายผลผลิต (อัปเกรด: เชื่อมต่อระบบพยากรณ์อากาศ)
// - ดึงข้อมูลสภาพอากาศจาก WeatherScreen
// - แนะนำช่างอัตโนมัติตามสภาพอากาศ
// - แจ้งเตือนหากพรุ่งนี้/สัปดาห์หน้าฝนตก
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, Dimensions, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { C, Card, Header, Empty, Badge } from './Components';
import { getWorkersWithRecords, getAllProjects } from './db';
import { getWeatherForecast } from './WeatherScreen';

const screenWidth = Dimensions.get("window").width;

// ============================================================
// ค่าคงที่
// ============================================================
const WORK_TYPES = [
  { id: 'ผูกเหล็ก', unit: 'กก./วัน', icon: 'construct-outline', standard: 50, outdoor: true },
  { id: 'เทปูน', unit: 'ลบ.ม./วัน', icon: 'cube-outline', standard: 3, outdoor: true },
  { id: 'ก่ออิฐ', unit: 'ตร.ม./วัน', icon: 'grid-outline', standard: 24, outdoor: false },
  { id: 'ฉาบปูน', unit: 'ตร.ม./วัน', icon: 'layers-outline', standard: 14, outdoor: false },
  { id: 'งานไม้', unit: 'ตร.ม./วัน', icon: 'hammer-outline', standard: 20, outdoor: false },
  { id: 'งานไฟฟ้า', unit: 'จุด/วัน', icon: 'flash-outline', standard: 13, outdoor: false },
  { id: 'งานประปา', unit: 'จุด/วัน', icon: 'water-outline', standard: 10, outdoor: false },
  { id: 'งานทาสี', unit: 'ตร.ม./วัน', icon: 'color-palette-outline', standard: 85, outdoor: false },
  { id: 'งานกระเบื้อง', unit: 'ตร.ม./วัน', icon: 'apps-outline', standard: 25, outdoor: false },
  { id: 'งานฝ้า', unit: 'ตร.ม./วัน', icon: 'resize-outline', standard: 35, outdoor: false },
  { id: 'โครงสร้าง คสล.', unit: 'ตร.ม./วัน', icon: 'business-outline', standard: 27, outdoor: true },
  { id: 'มุงหลังคา', unit: 'ตร.ม./วัน', icon: 'home-outline', standard: 43, outdoor: true },
];

const OUTDOOR_JOBS = ['เทปูน', 'โครงสร้าง คสล.', 'มุงหลังคา', 'ผูกเหล็ก'];
const INDOOR_JOBS = ['ฉาบปูน', 'งานกระเบื้อง', 'งานทาสี', 'งานฝ้า', 'งานไฟฟ้า', 'งานประปา', 'ก่ออิฐ', 'งานไม้'];

// ============================================================
// Helper Functions
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
  let totalOutput = 0;
  let totalWeightedQuality = 0;
  let outputs = [];
  
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

// ============================================================
// Weather Helper Functions
// ============================================================
function getWeatherStatus(rainProb) {
  if (rainProb >= 70) return { status: 'ฝนตกหนัก', color: '#EF4444', canOutdoor: false };
  if (rainProb >= 40) return { status: 'อาจมีฝน', color: '#F59E0B', canOutdoor: true };
  return { status: 'แจ่มใส', color: '#10B981', canOutdoor: true };
}

function formatForecastDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return days[date.getDay()] + ' ' + date.getDate();
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

function isTomorrow(dateStr) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateStr === tomorrow.toISOString().split('T')[0];
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TeamCalcScreen({ navigation }) {
  const [workers, setWorkers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('team');

  // 🌟 ข้อมูลสภาพอากาศ
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const load = async () => {
    try {
      setWorkers(await getWorkersWithRecords());
      setProjects(await getAllProjects());

      // ดึงข้อมูลสภาพอากาศ
      const weather = await getWeatherForecast();
      setWeatherData(weather);
      setWeatherLoading(false);
    } catch (e) {
      console.log('Load error:', e);
      setWeatherLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="จัดทีมและทำนายผลผลิต" onBack={() => navigation.goBack()} />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
        {[
          { key: 'team', label: 'จัดทีม', icon: 'people-outline' },
          { key: 'predict', label: 'ทำนายผลผลิต', icon: 'calculator-outline' }
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 12,
              borderBottomWidth: 2,
              borderBottomColor: tab === t.key ? C.primary : 'transparent'
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={t.icon} size={16} color={tab === t.key ? C.primary : C.textLight} />
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: tab === t.key ? C.primary : C.textSec
              }}>
                {t.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {tab === 'team' ? (
          <TeamTab
            workers={workers}
            weatherData={weatherData}
            navigation={navigation}
          />
        ) : (
          <PredictTab
            workers={workers}
            projects={projects}
            weatherData={weatherData}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// แท็บ 1: จัดทีม (🌟 เพิ่มระบบแนะนำตามสภาพอากาศ)
// ============================================================
function TeamTab({ workers, weatherData, navigation }) {
  const [workType, setWorkType] = useState('ผูกเหล็ก');
  const [selectedIds, setSelectedIds] = useState([]);
  const [otHours, setOtHours] = useState(0);
  const [showWeatherAlert, setShowWeatherAlert] = useState(true);

  const wt = WORK_TYPES.find(w => w.id === workType) || WORK_TYPES[0];
  const isOutdoorJob = OUTDOOR_JOBS.includes(workType);

  // 🌟 ตรวจสอบสภาพอากาศวันนี้และพรุ่งนี้
  const todayForecast = weatherData?.forecast?.[0];
  const tomorrowForecast = weatherData?.forecast?.[1];
  const todayWeather = todayForecast ? getWeatherStatus(todayForecast.rainProb) : null;
  const tomorrowWeather = tomorrowForecast ? getWeatherStatus(tomorrowForecast.rainProb) : null;

  // 🌟 หาช่างที่มีทักษะงานในร่ม (สำหรับแนะนำเมื่อฝนตก)
  const getWorkerIndoorSkills = (worker) => {
    const skills = [...new Set((worker.records || []).map(r => r.work_type))];
    return skills.filter(s => INDOOR_JOBS.includes(s));
  };

  // 🌟 แนะนำช่างสำหรับงานทดแทน (เมื่อฝนตก)
  const getAlternativeRecommendations = () => {
    if (!isOutdoorJob || (todayWeather?.canOutdoor && tomorrowWeather?.canOutdoor)) {
      return null;
    }

    const recommendations = [];

    INDOOR_JOBS.forEach(indoorJob => {
      const workersWithSkill = workers
        .filter(w => (w.records || []).some(r => r.work_type === indoorJob))
        .map(w => ({
          ...w,
          score: calculateScore(w, indoorJob),
          output: getEffectiveOutput(w, indoorJob)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      if (workersWithSkill.length > 0) {
        recommendations.push({
          workType: indoorJob,
          workers: workersWithSkill,
          icon: WORK_TYPES.find(wt => wt.id === indoorJob)?.icon || 'construct-outline'
        });
      }
    });

    return recommendations;
  };

  const alternativeRecs = getAlternativeRecommendations();

  const candidates = [...workers].map(w => ({
    ...w,
    aiScore: calculateScore(w, workType),
    indoorSkills: getWorkerIndoorSkills(w)
  })).sort((a, b) => b.aiScore - a.aiScore);

  const team = candidates.filter(w => selectedIds.includes(w.id));

  const baseTeamOutput = team.reduce((sum, w) => sum + getEffectiveOutput(w, workType), 0);
  const extraOTOutput = (baseTeamOutput / 8) * otHours;
  const teamOutput = baseTeamOutput + extraOTOutput;

  const baseWage = team.reduce((sum, w) => sum + (parseFloat(w.daily_wage) || 300), 0);
  const otWage = (baseWage / 8) * 1.5 * otHours;
  const totalDailyWage = baseWage + otWage;

  const teamQuality = calculateTeamQuality(team, workType);

  const minExpected = Math.round(teamOutput * 0.95);
  const maxExpected = Math.round(teamOutput * 1.05);

  const toggle = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  // 🌟 สถานะอากาศที่ส่งผลต่องาน
  const weatherAffectsWork = isOutdoorJob && (!todayWeather?.canOutdoor || !tomorrowWeather?.canOutdoor);

  return (
    <View>
      {/* 🌟 การ์ดสภาพอากาศ */}
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

          {weatherData.location && (
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
              📍 {weatherData.location.province}
            </Text>
          )}

          <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
            {/* วันนี้ */}
            {todayForecast && (
              <View style={{
                flex: 1,
                backgroundColor: todayWeather.canOutdoor ? '#D1FAE5' : '#FEE2E2',
                padding: 12,
                borderRadius: 10
              }}>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>วันนี้</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons
                    name={todayWeather.canOutdoor ? 'sunny' : 'rainy'}
                    size={20}
                    color={todayWeather.color}
                  />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: todayWeather.color,
                    marginLeft: 6
                  }}>
                    {todayWeather.status}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
                  🌧️ {todayForecast.rainProb}% • {Math.round(todayForecast.tempMax)}°/{Math.round(todayForecast.tempMin)}°
                </Text>
              </View>
            )}

            {/* พรุ่งนี้ */}
            {tomorrowForecast && (
              <View style={{
                flex: 1,
                backgroundColor: tomorrowWeather.canOutdoor ? '#D1FAE5' : '#FEE2E2',
                padding: 12,
                borderRadius: 10
              }}>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>พรุ่งนี้</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Ionicons
                    name={tomorrowWeather.canOutdoor ? 'sunny' : 'rainy'}
                    size={20}
                    color={tomorrowWeather.color}
                  />
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: tomorrowWeather.color,
                    marginLeft: 6
                  }}>
                    {tomorrowWeather.status}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
                  🌧️ {tomorrowForecast.rainProb}% • {Math.round(tomorrowForecast.tempMax)}°/{Math.round(tomorrowForecast.tempMin)}°
                </Text>
              </View>
            )}
          </View>

          {/* พยากรณ์ 7 วัน Mini */}
          {weatherData.forecast && weatherData.forecast.length > 2 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>พยากรณ์ 7 วัน</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {weatherData.forecast.slice(0, 7).map((day, idx) => {
                    const dayStatus = getWeatherStatus(day.rainProb);
                    return (
                      <View
                        key={day.date}
                        style={{
                          alignItems: 'center',
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: dayStatus.canOutdoor ? '#F0FDF4' : '#FEF2F2',
                          minWidth: 55
                        }}
                      >
                        <Text style={{ fontSize: 10, color: '#6B7280' }}>
                          {isToday(day.date) ? 'วันนี้' : isTomorrow(day.date) ? 'พรุ่งนี้' : formatForecastDate(day.date)}
                        </Text>
                        <Ionicons
                          name={dayStatus.canOutdoor ? 'sunny' : 'rainy'}
                          size={16}
                          color={dayStatus.color}
                          style={{ marginVertical: 4 }}
                        />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: dayStatus.color }}>
                          {day.rainProb}%
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </Card>
      )}

      {/* เลือกประเภทงาน */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>
          1. เลือกประเภทงานที่ต้องการ
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => {
              const isSelected = workType === w.id;
              const isOutdoor = w.outdoor;
              const weatherWarning = isOutdoor && weatherData && todayForecast && !todayWeather?.canOutdoor;

              return (
                <TouchableOpacity
                  key={w.id}
                  onPress={() => { setWorkType(w.id); setSelectedIds([]); setOtHours(0); }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isSelected ? C.accent : weatherWarning ? '#FEF3C7' : '#F3F4F6',
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: weatherWarning ? '#F59E0B' : C.border
                  }}
                >
                  <Ionicons name={w.icon} size={14} color={isSelected ? '#fff' : C.textSec} />
                  <Text style={{
                    color: isSelected ? '#fff' : C.textSec,
                    fontWeight: '600',
                    fontSize: 12
                  }}>
                    {w.id}
                  </Text>
                  {weatherWarning && !isSelected && (
                    <Ionicons name="warning" size={12} color="#F59E0B" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Card>

      {/* 🌟 แจ้งเตือนสภาพอากาศ + แนะนำงานทดแทน */}
      {weatherAffectsWork && showWeatherAlert && alternativeRecs && alternativeRecs.length > 0 && (
        <Card style={{ marginTop: 16, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="warning" size={24} color="#D97706" />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#92400E' }}>
                  ⚠️ สภาพอากาศไม่เหมาะกับงาน "{workType}"
                </Text>
                <Text style={{ fontSize: 12, color: '#B45309', marginTop: 4 }}>
                  {!todayWeather?.canOutdoor
                    ? `วันนี้มีโอกาสฝนตก ${todayForecast.rainProb}%`
                    : `พรุ่งนี้มีโอกาสฝนตก ${tomorrowForecast.rainProb}%`
                  }
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowWeatherAlert(false)}>
              <Ionicons name="close" size={20} color="#B45309" />
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 10 }}>
              💡 งานที่แนะนำให้ทำแทน (งานในร่ม)
            </Text>

            {alternativeRecs.slice(0, 3).map((rec, idx) => (
              <View key={rec.workType} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name={rec.icon} size={16} color="#0F2654" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F2654', marginLeft: 8 }}>
                    {rec.workType}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {rec.workers.map((w, wIdx) => (
                    <TouchableOpacity
                      key={w.id}
                      onPress={() => {
                        setWorkType(rec.workType);
                        setSelectedIds([w.id]);
                        setShowWeatherAlert(false);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#fff',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#E5E7EB'
                      }}
                    >
                      <Text style={{ fontSize: 16, marginRight: 6 }}>
                        {wIdx === 0 ? '🥇' : wIdx === 1 ? '🥈' : '🥉'}
                      </Text>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>{w.name}</Text>
                        <Text style={{ fontSize: 10, color: C.textSec }}>
                          ผลผลิต: {w.output.toFixed(1)} | ทักษะ: {w.score.toFixed(0)}/100
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* เลือกช่างเข้าทีม */}
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
        const hasIndoorSkills = worker.indoorSkills.length > 0;

        return (
          <Card
            key={worker.id}
            onPress={() => toggle(worker.id)}
            style={{
              borderWidth: 2,
              borderColor: isSelected ? C.accent : 'transparent',
              backgroundColor: isSelected ? '#FEF3C7' : C.white
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12
              }}>
                <Text style={{ fontSize: 22 }}>👷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{worker.name}</Text>
                  {isRecommended && (
                    <View style={{
                      backgroundColor: '#ECFDF5',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: '#10B981'
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#10B981' }}>⭐ แนะนำ</Text>
                    </View>
                  )}
                </View>
                <Text style={{
                  fontSize: 12,
                  color: hasData ? C.textSec : '#EF4444',
                  marginTop: 2
                }}>
                  {hasData ? `ทักษะประเมิน: ${(worker.aiScore).toFixed(1)}/100` : 'ยังไม่มีสถิติ (รองาน)'}
                </Text>

                {/* 🌟 แสดงทักษะงานในร่มเมื่อฝนตก */}
                {weatherAffectsWork && hasIndoorSkills && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    <Text style={{ fontSize: 10, color: '#6B7280' }}>งานในร่มได้:</Text>
                    {worker.indoorSkills.slice(0, 3).map(skill => (
                      <View
                        key={skill}
                        style={{
                          backgroundColor: '#DBEAFE',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4
                        }}
                      >
                        <Text style={{ fontSize: 9, color: '#1E40AF' }}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>{effectiveOutput.toFixed(1)}</Text>
                <Text style={{ fontSize: 10, color: C.textLight }}>{wt.unit}</Text>
              </View>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isSelected ? C.accent : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Ionicons name={isSelected ? 'checkmark' : 'add'} size={18} color="#fff" />
              </View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ไม่มีข้อมูลพนักงาน" />}

      {/* OT Simulation */}
      {team.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="time" size={20} color="#F59E0B" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>จำลองการเพิ่มโอที (OT)</Text>
          </View>
          <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
            เลือกจำนวนชั่วโมง OT เพื่อดูปริมาณงานที่จะได้เพิ่มขึ้นจากช่างในทีม
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(h => (
              <TouchableOpacity
                key={h}
                onPress={() => setOtHours(h)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: otHours === h ? '#F59E0B' : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: otHours === h ? '#D97706' : '#D1D5DB'
                }}
              >
                <Text style={{
                  fontWeight: 'bold',
                  fontSize: 13,
                  color: otHours === h ? '#fff' : C.textSec
                }}>
                  {h > 0 ? `+${h} ชม.` : 'ปกติ'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {otHours > 0 && (
            <View style={{
              marginTop: 12,
              backgroundColor: '#FEF3C7',
              padding: 10,
              borderRadius: 8,
              alignItems: 'center'
            }}>
              <Text style={{ fontSize: 13, color: '#B45309' }}>
                📈 จะได้ผลผลิตเพิ่มอีกประมาณ{' '}
                <Text style={{ fontWeight: 'bold', fontSize: 15 }}>+{extraOTOutput.toFixed(1)}</Text>{' '}
                {wt.unit.replace('/วัน', '')}
              </Text>
            </View>
          )}
        </Card>
      )}

      {/* Team Summary */}
      {team.length > 0 && (
        <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 14 }}>
            สรุปศักยภาพทีมที่จัด
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 14,
              alignItems: 'center'
            }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{team.length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>สมาชิก (คน)</Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 14,
              alignItems: 'center'
            }}>
              <Text style={{ color: C.accent, fontSize: 24, fontWeight: '800' }}>{teamOutput.toFixed(1)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                {wt.unit} {otHours > 0 ? '(รวม OT)' : ''}
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 14,
              alignItems: 'center'
            }}>
              <Text style={{
                color: qualityColor(teamQuality),
                fontSize: 24,
                fontWeight: '800'
              }}>
                {teamQuality > 0 ? `${teamQuality.toFixed(1)}%` : '-'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>คุณภาพรวม</Text>
            </View>
          </View>

          <View style={{
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderWidth: 1,
            borderColor: 'rgba(245, 158, 11, 0.3)',
            padding: 12,
            borderRadius: 10,
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'center'
          }}>
            <Ionicons name="analytics" size={20} color={C.accent} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>โอกาสได้ผลงานจริง (±5%)</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.accent }}>
                {minExpected} - {maxExpected} {wt.unit.replace('/วัน', '')} / วัน
              </Text>
            </View>
          </View>

          {/* Cost Estimation */}
          <View style={{
            backgroundColor: '#ECFCCB',
            padding: 12,
            borderRadius: 10,
            marginTop: 14
          }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4D7C0F', marginBottom: 5 }}>
              💰 ประมาณการต้นทุนค่าแรงต่อวัน
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 12, color: '#3F6212' }}>ค่าแรงปกติ ({team.length} คน):</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#3F6212' }}>
                {baseWage.toLocaleString()} บาท
              </Text>
            </View>
            {otHours > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                <Text style={{ fontSize: 12, color: '#3F6212' }}>ค่าโอที (+{otHours} ชม. เรท 1.5):</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#3F6212' }}>
                  {otWage.toLocaleString()} บาท
                </Text>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: '#84CC16', marginVertical: 6 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534' }}>รวมจ่ายทั้งสิ้นต่อวัน:</Text>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#166534' }}>
                {totalDailyWage.toLocaleString()} บาท/วัน
              </Text>
            </View>
          </View>

          {/* Team Members Breakdown */}
          <Text style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 12,
            fontWeight: '600',
            marginTop: 16,
            marginBottom: 8
          }}>
            สัดส่วนผลผลิตแต่ละคน (รวมโอทีแล้ว)
          </Text>
          {team.map(w => {
            const baseOutput = getEffectiveOutput(w, workType);
            const outputVal = baseOutput + ((baseOutput / 8) * otHours);
            const pct = teamOutput > 0 ? (outputVal / teamOutput) * 100 : 0;
            return (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: '600',
                  width: 80
                }} numberOfLines={1}>
                  {w.name}
                </Text>
                <View style={{
                  flex: 1,
                  height: 20,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  overflow: 'hidden'
                }}>
                  <View style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: C.accent,
                    borderRadius: 6
                  }} />
                </View>
                <Text style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  width: 70,
                  textAlign: 'right'
                }}>
                  {outputVal.toFixed(1)} ({pct.toFixed(0)}%)
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
// แท็บ 2: ทำนายผลผลิต
// ============================================================
function PredictTab({ workers, projects, weatherData }) {
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

  const baseWage = team.reduce((sum, w) => sum + (parseFloat(w.daily_wage) || 300), 0);
  const otWage = (baseWage / 8) * 1.5 * otHours;
  const totalDailyWage = baseWage + otWage;

  const teamQuality = calculateTeamQuality(team, workType);

  const tw = parseFloat(totalWork) || 0;
  const tDays = parseInt(targetDays) || 0;
  const daysNeededBase = (baseTeamOutput > 0 && tw > 0) ? Math.ceil((tw * 1.1) / baseTeamOutput) : 0;
  const daysNeeded = (teamOutput > 0 && tw > 0) ? Math.ceil((tw * 1.1) / teamOutput) : 0;
  const daysSaved = daysNeededBase - daysNeeded;

  let requiredOTText = null;
  if (tw > 0 && tDays > 0 && baseTeamOutput > 0) {
    const requiredDailyOutput = (tw * 1.1) / tDays;
    if (baseTeamOutput < requiredDailyOutput) {
      const deficit = requiredDailyOutput - baseTeamOutput;
      const outputPerHour = baseTeamOutput / 8;
      const otNeeded = deficit / outputPerHour;
      requiredOTText = otNeeded.toFixed(1);
    }
  }

  const toggle = (id) => setSelectedIds(p =>
    p.includes(id) ? p.filter(x => x !== id) : [...p, id]
  );

  // 🌟 คำนวณวันที่มีฝนในช่วงทำงาน
  const rainyDaysInPlan = weatherData?.forecast?.filter(d => {
    const status = getWeatherStatus(d.rainProb);
    return !status.canOutdoor;
  }).length || 0;

  let chartData1 = null;
  if (tw > 0 && tDays > 0 && teamOutput > 0) {
    const maxDays = Math.max(tDays, daysNeeded);
    const steps = 4;
    const labels = [];
    const planLine = [];
    const actualLine = [];
    for (let i = 0; i <= steps; i++) {
      const currentDay = Math.round((maxDays / steps) * i);
      labels.push(`D${currentDay}`);
      let pVal = (tw / tDays) * currentDay;
      planLine.push(pVal > tw ? tw : pVal);
      let aVal = teamOutput * currentDay;
      actualLine.push(aVal > tw ? tw : aVal);
    }
    chartData1 = {
      labels,
      datasets: [
        { data: planLine, color: () => `rgba(59, 130, 246, 1)`, strokeWidth: 2 },
        { data: actualLine, color: () => `rgba(16, 185, 129, 1)`, strokeWidth: 3 }
      ],
      legend: ["แผนงาน (Plan)", "ทีมปัจจุบัน (Actual)"]
    };
  }

  return (
    <View>
      {/* Weather Impact Warning */}
      {weatherData && rainyDaysInPlan > 0 && OUTDOOR_JOBS.includes(workType) && (
        <Card style={{ marginBottom: 16, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="warning" size={24} color="#D97706" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>
                ⚠️ พบ {rainyDaysInPlan} วันที่อาจมีฝนใน 7 วันข้างหน้า
              </Text>
              <Text style={{ fontSize: 12, color: '#B45309', marginTop: 4 }}>
                งาน "{workType}" เป็นงานกลางแจ้ง อาจต้องหยุดในวันฝนตก ควรเผื่อเวลาไว้
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Work Type Selection */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 10 }}>ประเภทงาน</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {WORK_TYPES.map(w => (
              <TouchableOpacity
                key={w.id}
                onPress={() => { setWorkType(w.id); setSelectedIds([]); setOtHours(0); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: workType === w.id ? C.accent : '#F3F4F6',
                  borderWidth: workType === w.id ? 0 : 1,
                  borderColor: C.border
                }}
              >
                <Ionicons name={w.icon} size={14} color={workType === w.id ? '#fff' : C.textSec} />
                <Text style={{
                  color: workType === w.id ? '#fff' : C.textSec,
                  fontWeight: '600',
                  fontSize: 12
                }}>{w.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </Card>

      {/* Team Selection */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 10 }}>เลือกทีม</Text>
      {candidates.length > 0 ? candidates.map((worker, index) => {
        const isSelected = selectedIds.includes(worker.id);
        const hasData = worker.aiScore > 0;
        const outputVal = getEffectiveOutput(worker, workType);
        const isRecommended = hasData && index < 3;

        return (
          <Card
            key={worker.id}
            onPress={() => toggle(worker.id)}
            style={{
              borderWidth: 2,
              borderColor: isSelected ? C.accent : 'transparent',
              backgroundColor: isSelected ? '#FEF3C7' : C.white
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10
              }}>
                <Text style={{ fontSize: 18 }}>👷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{worker.name}</Text>
                  {isRecommended && (
                    <View style={{
                      backgroundColor: '#ECFDF5',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      marginLeft: 8,
                      borderWidth: 1,
                      borderColor: '#10B981'
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#10B981' }}>⭐ แนะนำ</Text>
                    </View>
                  )}
                </View>
                <Text style={{
                  fontSize: 11,
                  color: hasData ? C.textSec : '#EF4444',
                  marginTop: 2
                }}>
                  กำลังผลิต: {outputVal.toFixed(1)} {wt.unit} {hasData ? ` | ทักษะ: ${(worker.aiScore).toFixed(1)}/100` : '(ยังไม่มีสถิติ)'}
                </Text>
              </View>
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                backgroundColor: isSelected ? C.accent : '#E5E7EB',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Ionicons name={isSelected ? 'checkmark' : 'add'} size={16} color="#fff" />
              </View>
            </View>
          </Card>
        );
      }) : <Empty icon="people-outline" title="ไม่มีพนักงานในระบบ" />}

      {/* Plan Target */}
      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>เป้าหมายแผนงาน (Plan)</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1.5 }}>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>ปริมาณงานทั้งหมด</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F9FAFB',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.border,
              paddingHorizontal: 12
            }}>
              <TextInput
                value={totalWork}
                onChangeText={setTotalWork}
                placeholder="เช่น 100"
                keyboardType="numeric"
                style={{ flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 }}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>เวลาที่กำหนด (วัน)</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F9FAFB',
              borderRadius: 10,
              borderWidth: 1,
              borderColor: C.border,
              paddingHorizontal: 12
            }}>
              <TextInput
                value={targetDays}
                onChangeText={setTargetDays}
                placeholder="เช่น 10"
                keyboardType="numeric"
                style={{ flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 }}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* OT Simulation */}
      {team.length > 0 && totalWork !== '' && (
        <Card style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>🕒 จำลองการเร่งงานด้วย OT</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(h => (
              <TouchableOpacity
                key={h}
                onPress={() => setOtHours(h)}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: otHours === h ? '#F59E0B' : '#F3F4F6',
                  borderWidth: 1,
                  borderColor: otHours === h ? '#D97706' : '#D1D5DB'
                }}
              >
                <Text style={{
                  fontWeight: 'bold',
                  fontSize: 13,
                  color: otHours === h ? '#fff' : C.textSec
                }}>
                  {h > 0 ? `+${h} ชม.` : 'ปกติ'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {requiredOTText && tDays > 0 && (
            <View style={{
              marginTop: 12,
              backgroundColor: '#F0F9FF',
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#BAE6FD',
              alignItems: 'center'
            }}>
              <Text style={{ fontSize: 13, color: '#0369A1' }}>
                🎯 เพื่อให้เสร็จทันแผน ({tDays} วัน) ต้องทำ OT วันละ{' '}
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{requiredOTText}</Text> ชม.
              </Text>
              {parseFloat(requiredOTText) > 4 && (
                <Text style={{ fontSize: 11, color: '#0284C7', marginTop: 4 }}>
                  *หมายเหตุ: จำนวนชั่วโมงสูงเกินไป แนะนำให้เพิ่มช่างเข้าทีมแทนการฝืนทำ OT
                </Text>
              )}
            </View>
          )}
        </Card>
      )}

      {/* Team Summary */}
      {team.length > 0 && (
        <View>
          <Card style={{ marginTop: 16, backgroundColor: C.primary }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginBottom: 14 }}>
              สรุปผลประเมินทีม {otHours > 0 && '(รวม OT แล้ว)'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 14
              }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>กำลังผลิตทีม/วัน</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: C.accent, marginTop: 4 }}>
                  {teamOutput.toFixed(1)}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{wt.unit}</Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 14
              }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>คุณภาพทีม</Text>
                <Text style={{
                  fontSize: 24,
                  fontWeight: '800',
                  color: qualityColor(teamQuality),
                  marginTop: 4
                }}>
                  {teamQuality > 0 ? `${teamQuality.toFixed(1)}%` : '-'}
                </Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>เปอร์เซ็นต์</Text>
              </View>
            </View>

            {daysNeeded > 0 && (
              <View style={{
                backgroundColor: '#ECFCCB',
                padding: 12,
                borderRadius: 10,
                marginTop: 14
              }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#4D7C0F', marginBottom: 5 }}>
                  💰 ประมาณการต้นทุนโปรเจกต์นี้
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#3F6212' }}>ค่าแรงต่อวัน (รวม OT):</Text>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#3F6212' }}>
                    {totalDailyWage.toLocaleString()} ฿
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: '#84CC16', marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#991B1B' }}>
                    ยอดจ่ายรวม ({daysNeeded} วัน):
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#991B1B' }}>
                    {(totalDailyWage * daysNeeded).toLocaleString()} บาท
                  </Text>
                </View>
              </View>
            )}

            {chartData1 && (
              <View style={{
                marginTop: 16,
                backgroundColor: '#fff',
                borderRadius: 10,
                padding: 12
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: C.text,
                  marginBottom: 10,
                  textAlign: 'center'
                }}>
                  📊 กราฟเนื้องานสะสม (ปริมาณ vs เวลา)
                </Text>
                <LineChart
                  data={chartData1}
                  width={screenWidth - 80}
                  height={200}
                  bezier
                  chartConfig={{
                    backgroundColor: '#fff',
                    backgroundGradientFrom: '#fff',
                    backgroundGradientTo: '#fff',
                    decimalPlaces: 0,
                    color: (o = 1) => `rgba(0, 0, 0, ${o})`,
                    labelColor: (o = 1) => `rgba(0, 0, 0, ${o})`,
                    propsForDots: { r: "3" }
                  }}
                  style={{ borderRadius: 10 }}
                />

                <View style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: daysNeeded <= tDays ? '#D1FAE5' : '#FEE2E2'
                }}>
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: daysNeeded <= tDays ? '#059669' : '#DC2626',
                    textAlign: 'center'
                  }}>
                    {daysNeeded <= tDays
                      ? '✅ ทีมนี้ทำงานเสร็จทันตามแผน!'
                      : '⚠️ ทีมนี้อาจทำงานล่าช้ากว่าแผน (Behind Schedule)'
                    }
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSec, marginTop: 4, textAlign: 'center' }}>
                    ทีมใช้เวลาจริงประมาณ {daysNeeded} วัน
                  </Text>

                  {otHours > 0 && daysSaved > 0 && (
                    <Text style={{
                      fontSize: 12,
                      color: '#059669',
                      marginTop: 2,
                      textAlign: 'center',
                      fontWeight: 'bold'
                    }}>
                      ⏳ ลดระยะเวลาลงได้ {daysSaved} วัน (จากการทำ OT)
                    </Text>
                  )}
                </View>
              </View>
            )}
          </Card>
        </View>
      )}
    </View>
  );
}