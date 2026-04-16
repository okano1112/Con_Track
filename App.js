// App.js
// ============================================================
// Root ของแอป
// ============================================================

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/AuthContext';
import AuthNavigator from './src/AuthNavigator';
import MainNavigator from './src/MainNavigator';
import { startAutoSync, stopAutoSync } from './src/syncEngine';
import { C } from './src/Components';

function RootNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
    return () => stopAutoSync();
  }, [user]);

  if (loading) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.primary
      }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return user ? <MainNavigator /> : <AuthNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}