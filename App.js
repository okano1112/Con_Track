import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation';
import { getDatabase } from './src/db';

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Init database ก่อนแสดง UI
    getDatabase()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error('DB init error:', e);
        setDbReady(true); // แสดง UI ถึงจะ error เพื่อไม่ให้ค้าง
      });
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F2654' }}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
