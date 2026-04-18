// JoinProjectScreen.js
// ============================================================
// เข้าร่วมโครงการด้วยรหัสเชิญ / รหัสโครงการ
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { C, Button, Card, Header, Badge } from './Components';
import { findProjectByCode, useInviteCode } from './db';

export default function JoinProjectScreen({ navigation }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [result, setResult] = useState(null); // { project, invite, error }

  const handleSearch = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัสโครงการ');
      return;
    }

    setSearching(true);
    setResult(null);
    try {
      const r = await findProjectByCode(trimmed);
      setResult(r);
    } catch (e) {
      setResult({ error: e.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setSearching(false);
    }
  };

  const handleJoin = async () => {
    if (!result?.project) return;
    setJoining(true);
    try {
      if (result.invite) {
        await useInviteCode(result.invite.id, user?.id);
      }
      Alert.alert('สำเร็จ 🎉', `เข้าร่วมโครงการ "${result.project.name}" แล้ว`, [
        {
          text: 'ดูโครงการ', onPress: () => {
            navigation.replace('ProjectDetail', { projectId: result.project.id });
          }
        }
      ]);
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message || 'เข้าร่วมไม่สำเร็จ');
    } finally {
      setJoining(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="เข้าร่วมโครงการ" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: 20 }}
        keyboardShouldPersistTaps="handled">

        {/* Icon header */}
        <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 10 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 20,
            backgroundColor: C.primary + '15',
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <Ionicons name="ticket-outline" size={40} color={C.primary} />
          </View>
          <Text style={{
            fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center',
          }}>
            กรอกรหัสโครงการ
          </Text>
          <Text style={{
            fontSize: 13, color: C.textSec, textAlign: 'center',
            marginTop: 8, lineHeight: 20
          }}>
            รหัสที่ได้รับจากวิศวกรหรือเจ้าของโครงการ{'\n'}
            (รูปแบบเช่น <Text style={{ fontWeight: '700', color: C.primary }}>A5K2BC</Text> หรือ{' '}
            <Text style={{ fontWeight: '700', color: C.primary }}>CT-2604-A5K</Text>)
          </Text>
        </View>

        {/* Code input */}
        <Card>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8 }}>
            รหัสโครงการ / รหัสเชิญ
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#F9FAFB', borderRadius: 12,
            borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14,
          }}>
            <Ionicons name="key-outline" size={20} color={C.primary} />
            <TextInput
              value={code}
              onChangeText={(v) => { setCode(v.toUpperCase().replace(/\s/g, '')); setResult(null); }}
              placeholder="เช่น A5K2BC"
              placeholderTextColor={C.textLight}
              autoCapitalize="characters"
              maxLength={20}
              style={{
                flex: 1, fontSize: 22, color: C.text,
                paddingVertical: 16, marginLeft: 10,
                fontWeight: '700', letterSpacing: 2
              }} />
          </View>
          <Button title="ค้นหาโครงการ" onPress={handleSearch}
            loading={searching} icon="search-outline"
            style={{ marginTop: 16 }} />
        </Card>

        {/* Result */}
        {result?.error && (
          <Card style={{ marginTop: 16, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="close-circle" size={24} color={C.danger} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#991B1B' }}>
                  ไม่พบโครงการ
                </Text>
                <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>
                  {result.error}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {result?.project && (
          <Card style={{ marginTop: 16, borderWidth: 2, borderColor: C.success }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="checkmark-circle" size={24} color={C.success} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.success, marginLeft: 8 }}>
                พบโครงการแล้ว!
              </Text>
            </View>

            <View style={{
              backgroundColor: C.bg, borderRadius: 10, padding: 14, marginBottom: 12
            }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
                {result.project.name}
              </Text>
              {result.project.project_code ? (
                <Text style={{
                  fontSize: 12, color: C.primary, fontWeight: '600', marginTop: 4
                }}>
                  🔖 รหัส: {result.project.project_code}
                </Text>
              ) : null}
              {result.project.location ? (
                <Text style={{ fontSize: 13, color: C.textSec, marginTop: 6 }}>
                  📍 {result.project.location}
                </Text>
              ) : null}
              {result.project.client_name ? (
                <Text style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>
                  🏢 เจ้าของ: {result.project.client_name}
                </Text>
              ) : null}
              {result.project.description ? (
                <Text style={{
                  fontSize: 13, color: C.textSec, marginTop: 8, lineHeight: 20
                }}>
                  {result.project.description}
                </Text>
              ) : null}
            </View>

            {result.invite && (
              <View style={{
                backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 12
              }}>
                <Text style={{ fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                  🎫 บทบาท: {result.invite.role === 'engineer' ? 'วิศวกร' :
                  result.invite.role === 'foreman' ? 'โฟร์แมน' :
                  result.invite.role === 'owner' ? 'เจ้าของ' : 'สมาชิก'}
                </Text>
                {result.invite.expires_at && (
                  <Text style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
                    หมดอายุ: {new Date(result.invite.expires_at).toLocaleDateString('th-TH')}
                  </Text>
                )}
              </View>
            )}

            <Button title="เข้าร่วมโครงการนี้" onPress={handleJoin}
              loading={joining} icon="enter-outline" />
          </Card>
        )}

        {/* Help section */}
        <Card style={{ marginTop: 16, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}>
          <View style={{ flexDirection: 'row' }}>
            <Ionicons name="information-circle" size={22} color="#3B82F6" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 6 }}>
                ยังไม่มีรหัส?
              </Text>
              <Text style={{ fontSize: 12, color: '#1E40AF', lineHeight: 20 }}>
                • ขอจาก<Text style={{ fontWeight: '700' }}>วิศวกร</Text>หรือ
                <Text style={{ fontWeight: '700' }}>เจ้าของโครงการ</Text>{'\n'}
                • หรือสร้างโครงการใหม่ด้วยตัวเอง
              </Text>
              <TouchableOpacity
                onPress={() => navigation.replace('AddProject')}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '700' }}>
                  สร้างโครงการใหม่ →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}