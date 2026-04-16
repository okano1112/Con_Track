// SyncStatusBar.js
// ============================================================
// แถบสถานะ sync ด้านบนของแอป
// ============================================================

import React, { useState, useEffect } from 'react';
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from './useNetwork';
import { getPendingCount, syncAll } from './syncEngine';

export default function SyncStatusBar() {
  const { isOnline } = useNetwork();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const update = async () => setPending(await getPendingCount());
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, []);

  const handleSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    await syncAll();
    setPending(await getPendingCount());
    setSyncing(false);
  };

  if (isOnline && pending === 0 && !syncing) return null;

  const bgColor = !isOnline ? '#F59E0B' : pending > 0 ? '#3B82F6' : '#10B981';
  const icon = !isOnline ? 'cloud-offline' : pending > 0 ? 'cloud-upload' : 'cloud-done';
  const text = !isOnline
    ? `ออฟไลน์ ${pending > 0 ? `(ข้อมูลค้าง ${pending})` : ''}`
    : syncing ? 'กำลัง sync...'
    : pending > 0 ? `มีข้อมูลรอ sync ${pending} รายการ`
    : 'sync เสร็จแล้ว';

  return (
    <TouchableOpacity
      onPress={handleSync}
      disabled={true}
      activeOpacity={0.7}
      style={{
        backgroundColor: bgColor,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        gap: 8,
      }}
    >
      {syncing
        ? <ActivityIndicator size="small" color="#fff" />
        : <Ionicons name={icon} size={14} color="#fff" />}
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </TouchableOpacity>
  );
}