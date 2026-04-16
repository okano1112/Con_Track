// AppLayout.js
// ============================================================
// Layout กลาง - ใส่ SyncStatusBar ด้านบนทุกหน้า
// ============================================================

import React from 'react';
import { View } from 'react-native';
import SyncStatusBar from './SyncStatusBar';

export default function AppLayout({ children }) {
  return (
    <View style={{ flex: 1 }}>
      <SyncStatusBar />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}