// RainAlternativesScreen.js
// ============================================================
// หน้าแสดงงานทดแทนเมื่อฝนตก + ผลกระทบต่อ Critical Path
// - ดึง gantt_tasks ของโครงการ
// - เช็คสภาพอากาศ (จาก cache ของ WeatherScreen)
// - เลือกงานที่ถูกบล็อก (ที่เป็นงานกลางแจ้ง)
// - คำนวณวันที่โครงการจะเลื่อนไป
// - แสดงงานทางเลือกพร้อมเหตุผล
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C, Card, Button, Badge, Empty, Header } from './Components';
import { getProjectById, getAllProjects, getGanttTasks } from './db';
import { getWeatherForecast } from './WeatherScreen';
import {
  calculateCPM, analyzeBlockImpact, suggestAlternativeTasks,
  isOutdoorTask, buildDemoTasksFromProject, formatDate, daysBetween, addDays,
} from './criticalPath';

export default function RainAlternativesScreen({ navigation, route }) {
  const initialProjectId = route?.params?.projectId;

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(initialProjectId || null);
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [weather, setWeather] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // งานที่ "ถูกบล็อก" วันนี้ (user เลือก หรือระบบ auto detect)
  const [blockedTaskIds, setBlockedTaskIds] = useState([]);
  const [rainDays, setRainDays] = useState(1);

  const load = async () => {
    try {
      const all = await getAllProjects('all');
      setProjects(all);

      const pid = projectId || all[0]?.id;
      if (!pid) return;
      setProjectId(pid);

      const p = await getProjectById(pid);
      setProject(p);

      let gtasks = [];
      try { gtasks = await getGanttTasks(pid); } catch (e) { gtasks = []; }

      // ถ้ายังไม่มี gantt_tasks → สร้าง demo จากโครงสร้างมาตรฐาน
      if (!gtasks || gtasks.length === 0) {
        gtasks = buildDemoTasksFromProject(p);
      }
      setTasks(gtasks);

      const w = await getWeatherForecast();
      setWeather(w);

      // Auto detect: ถ้าวันนี้ฝนตก → เลือกงานกลางแจ้งที่ยังไม่เสร็จให้อัตโนมัติ
      const todayRainProb = w?.forecast?.[0]?.rainProb ?? 0;
      if (todayRainProb >= 70 && blockedTaskIds.length === 0) {
        const outdoor = gtasks
          .filter(t => isOutdoorTask(t) && (t.progress || 0) < 100)
          .map(t => t.id);
        setBlockedTaskIds(outdoor);

        // ประมาณจำนวนวันฝน (นับต่อเนื่องจากวันนี้)
        let rd = 0;
        for (const day of w.forecast) {
          if (day.rainProb >= 60) rd++;
          else break;
        }
        if (rd > 0) setRainDays(rd);
      }
    } catch (e) {
      console.log('Load RainAlternatives error:', e);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [projectId]));

  const projectStart = project?.ntp_date || project?.start_date ||
    new Date().toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // CPM + ผลวิเคราะห์
  const analysis = useMemo(() => {
    if (!project || tasks.length === 0) return null;
    return analyzeBlockImpact(blockedTaskIds, tasks, rainDays, projectStart);
  }, [project, tasks, blockedTaskIds, rainDays, projectStart]);

  const alternatives = useMemo(() => {
    if (!project || tasks.length === 0) return [];
    return suggestAlternativeTasks(blockedTaskIds, tasks, projectStart, today)
      .slice(0, 8); // เอาแค่ top 8
  }, [project, tasks, blockedTaskIds, projectStart, today]);

  const toggleBlocked = (id) => {
    setBlockedTaskIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const todayWeather = weather?.forecast?.[0];

  if (!project) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Header title="งานทดแทนเมื่อฝนตก" onBack={() => navigation.goBack()} />
        <Empty icon="business-outline" title="ยังไม่มีโครงการ"
          subtitle="สร้างโครงการก่อนใช้งานฟีเจอร์นี้" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="งานทดแทนเมื่อฝนตก"
        subtitle={project.name}
        onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>

        {/* เลือกโครงการ (ถ้ามีหลายโครงการ) */}
        {projects.length > 1 && (
          <Card>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8 }}>
              เลือกโครงการ
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {projects.map(p => {
                  const sel = projectId === p.id;
                  return (
                    <TouchableOpacity key={p.id} onPress={() => {
                      setProjectId(p.id); setBlockedTaskIds([]);
                    }}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
                        backgroundColor: sel ? C.primary : '#F3F4F6',
                        borderWidth: sel ? 0 : 1, borderColor: C.border
                      }}>
                      <Text style={{
                        color: sel ? '#fff' : C.textSec,
                        fontWeight: '600', fontSize: 12
                      }}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Card>
        )}

        {/* Weather Summary */}
        {todayWeather && (
          <Card style={{
            backgroundColor: todayWeather.rainProb >= 60 ? '#FEE2E2' : '#EFF6FF',
            borderWidth: 1,
            borderColor: todayWeather.rainProb >= 60 ? '#FCA5A5' : '#BFDBFE'
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={todayWeather.rainProb >= 60 ? 'rainy' : 'partly-sunny'}
                size={28}
                color={todayWeather.rainProb >= 60 ? C.danger : '#3B82F6'} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                  วันนี้ — โอกาสฝนตก {todayWeather.rainProb}%
                </Text>
                <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                  อุณหภูมิ {Math.round(todayWeather.tempMax)}° / {Math.round(todayWeather.tempMin)}°
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* เลือกจำนวนวันฝน */}
        <Card>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>
            🌧️ คาดว่าฝนจะตกกี่วัน?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 5, 7].map(d => (
              <TouchableOpacity key={d} onPress={() => setRainDays(d)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                  backgroundColor: rainDays === d ? C.primary : '#F3F4F6',
                  borderWidth: 1, borderColor: rainDays === d ? C.primary : C.border
                }}>
                <Text style={{
                  fontSize: 14, fontWeight: '700',
                  color: rainDays === d ? '#fff' : C.textSec
                }}>
                  {d} วัน
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* เลือกงานที่ถูกบล็อก */}
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16, marginBottom: 8 }}>
          📋 งานที่ถูกบล็อก (กดเพื่อเลือก/ยกเลิก)
        </Text>
        {tasks.filter(t => isOutdoorTask(t)).map(t => {
          const sel = blockedTaskIds.includes(t.id);
          return (
            <Card key={t.id} onPress={() => toggleBlocked(t.id)}
              style={{
                borderWidth: 2,
                borderColor: sel ? C.danger : 'transparent',
                backgroundColor: sel ? '#FEF2F2' : C.white
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons
                  name={sel ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={sel ? C.danger : C.textLight}
                  style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>
                    {t.name}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                    ระยะเวลา {t.duration_days} วัน • ความคืบหน้า {t.progress || 0}%
                  </Text>
                </View>
                <Badge label="กลางแจ้ง" color="#9A3412" bg="#FED7AA" />
              </View>
            </Card>
          );
        })}

        {tasks.filter(t => isOutdoorTask(t)).length === 0 && (
          <Card>
            <Text style={{ fontSize: 13, color: C.textSec, textAlign: 'center' }}>
              ไม่พบงานกลางแจ้งในแผนงาน
            </Text>
          </Card>
        )}

        {/* ผลกระทบต่อโครงการ */}
        {analysis && blockedTaskIds.length > 0 && (
          <>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 20, marginBottom: 8 }}>
              📊 ผลกระทบต่อโครงการ
            </Text>
            <Card style={{
              backgroundColor: analysis.projectDelayDays > 0 ? C.primary : '#065F46'
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    แผนเดิม
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>
                    {analysis.originalDurationDays} วัน
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>
                    เสร็จ {formatDate(analysis.originalEndDate)}
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    แผนใหม่ (หลังฝนตก)
                  </Text>
                  <Text style={{
                    color: analysis.projectDelayDays > 0 ? C.accent : '#34D399',
                    fontSize: 24, fontWeight: '800'
                  }}>
                    {analysis.newDurationDays} วัน
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>
                    เสร็จ {formatDate(analysis.newEndDate)}
                  </Text>
                </View>
              </View>

              <View style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 10, padding: 12, alignItems: 'center'
              }}>
                {analysis.projectDelayDays > 0 ? (
                  <>
                    <Text style={{ color: C.accent, fontSize: 32, fontWeight: '900' }}>
                      +{analysis.projectDelayDays}
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>
                      โครงการจะยืดออกไป {analysis.projectDelayDays} วัน
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={32} color="#34D399" />
                    <Text style={{ color: '#fff', fontSize: 13, marginTop: 4, fontWeight: '600' }}>
                      ไม่กระทบ — ใช้ slack รองรับได้
                    </Text>
                  </>
                )}
              </View>
            </Card>

            {/* เหตุผลที่มาของตัวเลข */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginTop: 12, marginBottom: 8 }}>
              🔍 ที่มาของตัวเลข
            </Text>
            {analysis.details.map(d => (
              <Card key={d.taskId}
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: d.isCritical ? C.danger : d.effectiveDelay > 0 ? C.accent : C.success
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, flex: 1 }}>
                    {d.taskName}
                  </Text>
                  {d.isCritical && (
                    <Badge label="⭐ Critical Path" color="#991B1B" bg="#FEE2E2" />
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1, backgroundColor: '#F9FAFB', padding: 8, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, color: C.textSec }}>Slack</Text>
                    <Text style={{
                      fontSize: 16, fontWeight: '800',
                      color: d.slack === 0 ? C.danger : d.slack < 3 ? C.accent : C.success
                    }}>
                      {d.slack} วัน
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#F9FAFB', padding: 8, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, color: C.textSec }}>บล็อก</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>
                      {d.daysBlocked} วัน
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: '#F9FAFB', padding: 8, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, color: C.textSec }}>เลื่อน</Text>
                    <Text style={{
                      fontSize: 16, fontWeight: '800',
                      color: d.effectiveDelay > 0 ? C.danger : C.success
                    }}>
                      +{d.effectiveDelay} วัน
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: C.textSec, lineHeight: 18 }}>
                  {d.reasoning}
                </Text>
              </Card>
            ))}
          </>
        )}

        {/* งานทดแทนแนะนำ */}
        {alternatives.length > 0 && blockedTaskIds.length > 0 && (
          <>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 20, marginBottom: 8 }}>
              💡 งานทดแทนแนะนำ (ทำได้วันนี้)
            </Text>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 12 }}>
              งานในร่มที่ dependency พร้อม + เรียงตามความสำคัญ
            </Text>

            {alternatives.map((t, i) => (
              <Card key={t.id}
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: t.isCritical ? C.danger : t.slack <= 2 ? C.accent : C.success
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: t.isCritical ? '#FEE2E2' : '#F3F4F6',
                    alignItems: 'center', justifyContent: 'center', marginRight: 10
                  }}>
                    <Text style={{
                      fontWeight: '800', fontSize: 13,
                      color: t.isCritical ? C.danger : C.textSec
                    }}>
                      {i + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>
                      {t.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                      {t.duration_days} วัน • slack {t.slack} วัน • เสร็จ {formatDate(t.efDate)}
                    </Text>
                  </View>
                </View>
                <View style={{
                  backgroundColor: t.isCritical ? '#FEE2E2' : t.slack <= 2 ? '#FEF3C7' : '#D1FAE5',
                  padding: 8, borderRadius: 6
                }}>
                  <Text style={{
                    fontSize: 12,
                    color: t.isCritical ? '#991B1B' : t.slack <= 2 ? '#92400E' : '#065F46'
                  }}>
                    {t.reason}
                  </Text>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* คำอธิบาย CPM */}
        <Card style={{ marginTop: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="bulb-outline" size={22} color="#2563EB" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 6 }}>
                ทำไมตัวเลขถึงออกมาเป็นแบบนี้?
              </Text>
              <Text style={{ fontSize: 12, color: '#1E40AF', lineHeight: 20 }}>
                ระบบใช้หลัก <Text style={{ fontWeight: '700' }}>CPM (Critical Path Method)</Text>{'\n\n'}
                • <Text style={{ fontWeight: '700' }}>Critical Path</Text> คือเส้นทางของงานที่ slack = 0 วัน → ถ้างานเหล่านี้ช้า 1 วัน โครงการช้า 1 วันทันที{'\n\n'}
                • <Text style={{ fontWeight: '700' }}>Slack</Text> คือเวลาสำรองของงาน — งานมี slack 3 วัน ถ้าเลื่อนไม่เกิน 3 วัน โครงการยังเสร็จตรงเวลา{'\n\n'}
                • <Text style={{ fontWeight: '700' }}>เลื่อน = max(daysBlocked − slack, 0)</Text> คำนวณจากงานทุกตัวที่ถูกบล็อก แล้วเอาค่าสูงสุด
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}