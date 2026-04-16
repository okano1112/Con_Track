import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, DrawerActions } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { getDashboardStats } from './db';
import { C, Card, ProgressBar, STATUS } from './Components';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setStats(await getDashboardStats()); } catch (e) { console.log(e); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.primary, paddingTop: 50, paddingBottom: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>สวัสดีครับ</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{user?.full_name || 'ผู้ใช้'}</Text>
          </View>
        </View>

        {stats && (
          <View style={{ flexDirection: 'row', marginTop: 20, gap: 10 }}>
            {[
              { label: 'โครงการ', value: stats.projects?.total || 0, color: '#3B82F6' },
              { label: 'กำลังทำ', value: stats.projects?.active || 0, color: '#F59E0B' },
              { label: 'เสร็จแล้ว', value: stats.projects?.completed || 0, color: '#10B981' },
              { label: 'งานด่วน', value: stats.tasks?.urgent || 0, color: '#EF4444' },
            ].map((item, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: item.color, fontSize: 22, fontWeight: '800' }}>{item.value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>

        {/* Menu Grid */}
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 }}>เมนูหลัก</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'โครงการ', icon: 'business', color: '#3B82F6', tab: 'ProjectsTab' },
            { label: 'เอกสาร', icon: 'document-text', color: '#8B5CF6', tab: 'DocumentsTab' },
            { label: 'โปรไฟล์', icon: 'person-circle', color: '#F59E0B', tab: 'ProfileTab' },
          ].map((m) => (
            <TouchableOpacity key={m.label} activeOpacity={0.7} onPress={() => navigation.navigate(m.tab)}
              style={{ width: '31%', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 18, alignItems: 'center', elevation: 2 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: m.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.text, marginTop: 8 }}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Projects */}
        <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 }}>โครงการล่าสุด</Text>
        {stats?.recentProjects?.length > 0 ? stats.recentProjects.map((p) => {
          const st = STATUS[p.status] || STATUS.planning;
          return (
            <Card key={p.id} onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, flex: 1 }}>{p.name}</Text>
                <View style={{ backgroundColor: st.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: st.color }}>{st.label}</Text>
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: C.textSec }}>ความคืบหน้า</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600' }}>{p.progress}%</Text>
                </View>
                <ProgressBar progress={p.progress} />
              </View>
            </Card>
          );
        }) : (
          <Card><View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Ionicons name="folder-open-outline" size={40} color={C.textLight} />
            <Text style={{ color: C.textSec, marginTop: 8 }}>ยังไม่มีโครงการ</Text>
          </View></Card>
        )}
      </ScrollView>
    </View>
  );
}