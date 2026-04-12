// src/screens/ProjectsScreen.js

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, STATUS_MAP } from '../constants';
import { Card, ProgressBar, EmptyState } from '../components';
import { getAllProjects, searchProjects } from '../db';

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'active', label: 'กำลังทำ' },
  { key: 'planning', label: 'วางแผน' },
  { key: 'on_hold', label: 'ชะลอ' },
  { key: 'completed', label: 'เสร็จ' },
];

export default function ProjectsScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      if (search.trim()) {
        const results = await searchProjects(search.trim());
        setProjects(results);
      } else {
        const data = await getAllProjects(filter);
        setProjects(data);
      }
    } catch (e) {
      console.log('Load projects error:', e);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter, search]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>โครงการ</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddProject')}
            style={{
              backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center',
            }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 4 }}>เพิ่ม</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 10, paddingHorizontal: 12, marginTop: 14,
        }}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ค้นหาโครงการ..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={{ flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10, marginLeft: 8 }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => { setFilter(f.key); setSearch(''); }}
              style={{
                backgroundColor: active ? COLORS.primary : '#fff',
                borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
                borderWidth: active ? 0 : 1, borderColor: COLORS.border,
              }}
            >
              <Text style={{ color: active ? '#fff' : COLORS.textSecondary, fontWeight: '600', fontSize: 13 }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Project List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {projects.length > 0 ? (
          projects.map((p) => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.planning;
            return (
              <Card key={p.id} onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text }}>{p.name}</Text>
                    {p.location ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
                        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginLeft: 3 }}>{p.location}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ backgroundColor: st.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: st.color }}>{st.label}</Text>
                  </View>
                </View>

                {p.manager_name ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Ionicons name="person-outline" size={13} color={COLORS.textLight} />
                    <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginLeft: 4 }}>{p.manager_name}</Text>
                  </View>
                ) : null}

                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>ความคืบหน้า</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.text }}>{p.progress}%</Text>
                  </View>
                  <ProgressBar progress={p.progress} />
                </View>

                <View style={{ flexDirection: 'row', marginTop: 10, gap: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkbox-outline" size={14} color={COLORS.textLight} />
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 }}>
                      {p.done_count || 0}/{p.task_count || 0} งาน
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="document-outline" size={14} color={COLORS.textLight} />
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 }}>
                      {p.doc_count || 0} เอกสาร
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={14} color={COLORS.textLight} />
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 }}>
                      {p.member_count || 0} คน
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon="business-outline"
            title="ยังไม่มีโครงการ"
            subtitle="กดปุ่ม + เพิ่ม เพื่อสร้างโครงการแรก"
            actionTitle="เพิ่มโครงการ"
            onAction={() => navigation.navigate('AddProject')}
          />
        )}
      </ScrollView>
    </View>
  );
}
