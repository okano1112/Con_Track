// App.js
// ============================================================
// Root ของแอป — แยก flow: ถ้ายัง login อยู่โชว์ AuthNavigator
// ถ้า login แล้วโชว์ MainNavigator (drawer เดิมของ Sky)
// ============================================================

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';

import { AuthProvider, useAuth } from './src/AuthContext';
import AuthNavigator from './src/AuthNavigator';
// import MainNavigator from './src/MainNavigator'; // drawer เดิมของ Sky
import { C } from './src/Components';

// ============================================================
// Deep linking config - สำหรับลิงก์ reset password จากอีเมล
// ============================================================
const linking = {
  prefixes: ['contrack://', Linking.createURL('/')],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      VerifyEmail: 'verify-email',
    },
  },
};

// ============================================================
// เลือก navigator ตามสถานะ login
// ============================================================
function RootNavigator() {
  const { user, loading } = useAuth();

  // กำลังเช็ค session
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // ยังไม่ login → auth flow
  if (!user) {
    return <AuthNavigator />;
  }

  // login แล้ว → main app (drawer เดิมของ Sky)
  // return <MainNavigator />;
  return <AuthNavigator />; // placeholder - เปลี่ยนเป็น MainNavigator ของ Sky
}

// ============================================================
// App root
// ============================================================
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer linking={linking}>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}