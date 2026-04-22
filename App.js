import 'react-native-gesture-handler'
import React, { useState, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/AuthContext';
import AuthNavigator from './src/AuthNavigator';
import MainNavigator from './src/MainNavigator';
import { getDB } from './src/db';
import { startAutoSync } from './src/syncEngine';

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#0F2654" />
    </View>
  );
  return user ? <MainNavigator /> : <AuthNavigator />;
}

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDB()
      .then(() => {
        setDbReady(true);
        startAutoSync(); // เริ่ม sync หลัง DB พร้อม
      })
      .catch(err => console.error('DB init failed:', err));
  }, []);

  if (!dbReady) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#0F2654" />
    </View>
  );

  return (
    <GestureHandlerRootView style = {{flex : 1}}>
    <NavigationContainer>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </NavigationContainer>
    </GestureHandlerRootView>
  );
}