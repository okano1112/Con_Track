// src/screens/HomeScreen.js

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, DrawerActions } from '@react-navigation/native';
import { COLORS, SHADOWS, STATUS_MAP } from '../constants';
import { Card, ProgressBar } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { getDashboardStats } from '../db';

const MENU_ITEMS = [
  { key: 'projects', label: 'โครงการ', icon: 'business', color: '#3B82F6', screen: 'ProjectsTab' },
  { key: 'tasks', label: 'งาน', icon: 'checkbox', color: '#10B981', screen: 'ProjectsTab' },
  { key: 'docs', label: 'เอกสาร', icon: 'document-text', color: '#8B5CF6', screen: 'DocumentsTab' },
  { key: 'team', label: 'ทีมงาน', icon: 'people', color: '#F59E0B', screen: 'ProfileTab' },
  { key: 'reports', label: 'รายงาน', icon: 'bar-chart', color: '#EC4899', screen: 'ProjectsTab' },
  { key: 'settings', label: 'ตั้งค่า', icon: 'settings', color: '#6B7280', screen: 'ProfileTab' },
];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      console.log('Stats error:', e);
    }
  };

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* ปุ่มเปิด Drawer */}
            <TouchableOpacity
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center', justifyContent: 'center', marginRight: 12,
              }}
            >
              <Ionicons name="menu" size={22} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>สวัสดีครับ</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 }}>
                {user?.full_name || 'ผู้ใช้'}
              </Text>
            </View>
          </View>
          <View style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </View>
        </View>

        {/* Stats Row */}
        {stats && (
          <View style={{ flexDirection: 'row', marginTop: 20, gap: 10 }}>
            {[
              { label: 'โครงการ', value: stats.projects?.total || 0, color: '#3B82F6' },
              { label: 'กำลังทำ', value: stats.projects?.active || 0, color: '#F59E0B' },
              { label: 'เสร็จแล้ว', value: stats.projects?.completed || 0, color: '#10B981' },
              { label: 'งานด่วน', value: stats.tasks?.urgent || 0, color: '#EF4444' },
            ].map((item, i) => (
              <View key={i} style={{
                flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
                padding: 12, alignItems: 'center',
              }}>
                <Text style={{ color: item.color, fontSize: 22, fontWeight: '800' }}>{item.value}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Menu Grid */}
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 }}>เมนูหลัก</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              onPress={() => {
                if (item.screen.includes('Tab')) {
                  navigation.navigate(item.screen);
                }
              }}
              style={{
                width: '31%', backgroundColor: '#fff', borderRadius: 14,
                paddingVertical: 18, alignItems: 'center', ...SHADOWS.sm,
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: item.color + '15', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 8 }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Projects */}
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 }}>โครงการล่าสุด</Text>
        {stats?.recentProjects?.length > 0 ? (
          stats.recentProjects.map((p) => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.planning;
            return (
              <Card
                key={p.id}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>{p.name}</Text>
                    {p.location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
                        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginLeft: 3 }}>{p.location}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{
                    backgroundColor: st.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: st.color }}>{st.label}</Text>
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>ความคืบหน้า</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text }}>{p.progress}%</Text>
                  </View>
                  <ProgressBar progress={p.progress} />
                </View>
              </Card>
            );
          })
        ) : (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="folder-open-outline" size={40} color={COLORS.textLight} />
              <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>ยังไม่มีโครงการ</Text>
            </View>
          </Card>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}