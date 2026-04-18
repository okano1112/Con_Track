// ProjectHubScreen.js
// ============================================================
// หน้าแรกหลัง Login - เลือกเข้าร่วม/สร้างโครงการ
// + แสดงโครงการล่าสุดที่เข้าร่วมไว้ + สรุปสถิติ
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, DrawerActions } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { getAllProjects, getDashboardStats } from './db';
import { C, Card, ProgressBar, STATUS } from './Components';

export default function ProjectHubScreen({ navigation }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [all, s] = await Promise.all([
        getAllProjects('all'),
        getDashboardStats()
      ]);
      setProjects(all.slice(0, 3));
      setStats(s);
    } catch (e) { console.log('Load hub error:', e); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const openDrawer = () => {
    const parent = navigation.getParent();
    if (parent) parent.dispatch(DrawerActions.openDrawer());
  };

  // ไปที่แท็บโครงการ (เพราะ ProjectsList อยู่คนละ stack)
  const goToProjectsTab = () => {
    const parent = navigation.getParent();
    if (parent) parent.navigate('ProjectsTab');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.primary, paddingTop: 50, paddingBottom: 24, paddingHorizontal: 20
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={openDrawer}
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center', marginRight: 12
            }}>
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>สวัสดีครับ 👋</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
              {user?.full_name || 'ผู้ใช้'}
            </Text>
            {user?.custom_id && (
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                @{user.custom_id}
              </Text>
            )}
          </View>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }}
              style={{ width: 44, height: 44, borderRadius: 22 }} />
          ) : (
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Ionicons name="person" size={22} color={C.accent} />
            </View>
          )}
        </View>

        {/* Stats เต็มในส่วน header เพื่อทดแทนแดชบอร์ดเก่า */}
        {stats && (
          <View style={{ flexDirection: 'row', marginTop: 20, gap: 8 }}>
            {[
              { label: 'โครงการ', value: stats.projects?.total || 0, color: '#60A5FA' },
              { label: 'กำลังทำ', value: stats.projects?.active || 0, color: '#FBBF24' },
              { label: 'เสร็จแล้ว', value: stats.projects?.completed || 0, color: '#34D399' },
              { label: 'งานด่วน', value: stats.tasks?.urgent || 0, color: '#F87171' },
            ].map((item, i) => (
              <View key={i} style={{
                flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 12, padding: 10, alignItems: 'center'
              }}>
                <Text style={{ color: item.color, fontSize: 20, fontWeight: '800' }}>
                  {item.value}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>

        {/* 2 ปุ่มใหญ่หลัก */}
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 }}>
          เริ่มต้นใช้งาน
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          {/* เข้าร่วมโครงการ */}
          <TouchableOpacity activeOpacity={0.8}
            onPress={() => navigation.navigate('JoinProject')}
            style={{
              flex: 1, backgroundColor: '#3B82F6', borderRadius: 16,
              padding: 18, minHeight: 160,
              shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
            }}>
            <View style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 12
            }}>
              <Ionicons name="enter-outline" size={26} color="#fff" />
            </View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 }}>
              เข้าร่วมโครงการ
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 18 }}>
              ใช้รหัสที่ได้รับจาก{'\n'}วิศวกรหรือเจ้าของโครงการ
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: 10,
              alignSelf: 'flex-start'
            }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>ใส่รหัส</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>

          {/* สร้างโครงการ */}
          <TouchableOpacity activeOpacity={0.8}
            onPress={() => navigation.navigate('AddProject')}
            style={{
              flex: 1, backgroundColor: C.accent, borderRadius: 16,
              padding: 18, minHeight: 160,
              shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
            }}>
            <View style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 12
            }}>
              <Ionicons name="add-circle-outline" size={26} color="#fff" />
            </View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 }}>
              สร้างโครงการ
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 18 }}>
              กรอกรายละเอียดสัญญา{'\n'}และเริ่มบริหารจัดการ
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', marginTop: 10,
              alignSelf: 'flex-start'
            }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>เริ่มเลย</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Projects */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 12
        }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>
            โครงการของคุณ
          </Text>
          {projects.length > 0 && (
            <TouchableOpacity onPress={goToProjectsTab}>
              <Text style={{ color: C.primary, fontSize: 13, fontWeight: '600' }}>
                ดูทั้งหมด →
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {projects.length > 0 ? projects.map(p => {
          const st = STATUS[p.status] || STATUS.planning;
          return (
            <Card key={p.id}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>
                    {p.name}
                  </Text>
                  {p.project_code ? (
                    <Text style={{ fontSize: 11, color: C.primary, fontWeight: '600', marginTop: 2 }}>
                      🔖 {p.project_code}
                    </Text>
                  ) : null}
                  {p.location ? (
                    <Text style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>
                      📍 {p.location}
                    </Text>
                  ) : null}
                </View>
                <View style={{
                  backgroundColor: st.bg, borderRadius: 20,
                  paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start'
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: st.color }}>
                    {st.label}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4
                }}>
                  <Text style={{ fontSize: 12, color: C.textSec }}>ความคืบหน้า</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600' }}>{p.progress}%</Text>
                </View>
                <ProgressBar progress={p.progress} />
              </View>
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 12 }}>
                <Text style={{ fontSize: 11, color: C.textLight }}>
                  📋 {p.done_count || 0}/{p.task_count || 0} งาน
                </Text>
                <Text style={{ fontSize: 11, color: C.textLight }}>
                  📄 {p.doc_count || 0} เอกสาร
                </Text>
                {p.boq_count > 0 && (
                  <Text style={{ fontSize: 11, color: C.textLight }}>
                    💰 {p.boq_count} BOQ
                  </Text>
                )}
              </View>
            </Card>
          );
        }) : (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="folder-open-outline" size={48} color={C.textLight} />
              <Text style={{ color: C.textSec, marginTop: 10, fontWeight: '600' }}>
                ยังไม่มีโครงการ
              </Text>
              <Text style={{ color: C.textLight, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                กดปุ่มด้านบนเพื่อเข้าร่วมหรือสร้างโครงการแรก
              </Text>
            </View>
          </Card>
        )}

        {/* เมนูลัด */}
        <Text style={{
          fontSize: 17, fontWeight: '700', color: C.text,
          marginTop: 20, marginBottom: 12
        }}>
          เมนูลัด
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'เอกสาร', icon: 'document-text', color: '#8B5CF6', tab: 'DocumentsTab' },
            { label: 'สถิติช่าง', icon: 'bar-chart', color: '#10B981', drawer: 'WorkerStats' },
            { label: 'จัดทีม', icon: 'calculator', color: '#F59E0B', drawer: 'TeamCalc' },
            { label: 'สภาพอากาศ', icon: 'cloudy', color: '#3B82F6', drawer: 'WeatherScreen' },
          ].map((m) => (
            <TouchableOpacity key={m.label} activeOpacity={0.7}
              onPress={() => {
                const parent = navigation.getParent();
                if (m.drawer && parent) {
                  // drawer-level screens
                  const grandparent = parent.getParent?.();
                  if (grandparent) grandparent.navigate(m.drawer);
                  else parent.navigate(m.drawer);
                } else if (m.tab && parent) {
                  parent.navigate(m.tab);
                }
              }}
              style={{
                width: '23%', backgroundColor: '#fff', borderRadius: 14,
                paddingVertical: 14, alignItems: 'center', elevation: 2
              }}>
              <View style={{
                width: 38, height: 38, borderRadius: 10,
                backgroundColor: m.color + '15',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Ionicons name={m.icon} size={20} color={m.color} />
              </View>
              <Text style={{
                fontSize: 11, fontWeight: '600', color: C.text, marginTop: 6,
                textAlign: 'center'
              }}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}