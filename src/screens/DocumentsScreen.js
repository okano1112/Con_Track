// src/screens/DocumentsScreen.js

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, DOC_CATEGORY_MAP } from '../constants';
import { Card, EmptyState } from '../components';
import { getAllDocuments, deleteDocument } from '../db';

const FILTER_TABS = [
  { key: 'all', label: 'ทั้งหมด' },
  ...Object.entries(DOC_CATEGORY_MAP).map(([key, val]) => ({ key, label: val.label })),
];

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getAllDocuments(filter);
      setDocuments(data);
    } catch (e) {
      console.log('Load docs error:', e);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [filter]));

  const handleDelete = (docId, name) => {
    Alert.alert('ลบเอกสาร', `ต้องการลบ "${name}"?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => { await deleteDocument(docId); load(); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ backgroundColor: COLORS.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20 }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>เอกสาร</Text>
      </View>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {FILTER_TABS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
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

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {documents.length > 0 ? (
          documents.map((doc) => {
            const cat = DOC_CATEGORY_MAP[doc.category] || DOC_CATEGORY_MAP.other;
            return (
              <Card key={doc.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: cat.color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.text }}>{doc.name}</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                      {doc.project_name || 'ไม่ระบุโครงการ'} • {cat.label}
                    </Text>
                    {doc.uploader_name && (
                      <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 2 }}>
                        โดย {doc.uploader_name} • {doc.created_at?.split(' ')[0] || ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(doc.id, doc.name)}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            icon="document-outline"
            title="ยังไม่มีเอกสาร"
            subtitle="เพิ่มเอกสารจากหน้ารายละเอียดโครงการ"
          />
        )}
      </ScrollView>
    </View>
  );
}
