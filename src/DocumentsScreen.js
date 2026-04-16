// DocumentsScreen.js
// ============================================================
// หน้ารวมเอกสารทุกโครงการ + filter หมวด
// ============================================================

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C, Card, Empty, DOC_CAT } from './Components';
import { getAllDocuments, deleteDocument } from './db';

export default function DocumentsScreen() {
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setDocs(await getAllDocuments(filter)); }
    catch (e) { console.log('Load docs error:', e); }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter]));

  const FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    ...Object.entries(DOC_CAT).map(([k, v]) => ({ key: k, label: v.label }))
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        backgroundColor: C.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20
      }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>เอกสารทั้งหมด</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)}
              style={{
                backgroundColor: active ? C.primary : '#fff', borderRadius: 20,
                paddingHorizontal: 16, paddingVertical: 8,
                borderWidth: active ? 0 : 1, borderColor: C.border
              }}>
              <Text style={{
                color: active ? '#fff' : C.textSec,
                fontWeight: '600', fontSize: 13
              }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>
        {docs.length > 0 ? docs.map(doc => {
          const cat = DOC_CAT[doc.category] || DOC_CAT.other;
          return (
            <Card key={doc.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={cat.icon} size={22} color={cat.color}
                  style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>
                    {doc.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSec }}>
                    {doc.project_name || '-'} • {cat.label}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert('ลบ', `ลบ "${doc.name}"?`, [
                    { text: 'ยกเลิก' },
                    {
                      text: 'ลบ', style: 'destructive', onPress: async () => {
                        await deleteDocument(doc.id); load();
                      }
                    }
                  ])}>
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          );
        }) : <Empty icon="document-outline" title="ยังไม่มีเอกสาร" />}
      </ScrollView>
    </View>
  );
}