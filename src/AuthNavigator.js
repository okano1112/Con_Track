// src/AuthNavigator.js
// ============================================================
// Stack Navigator สำหรับหน้า Auth
// วางไว้ใน App.js ตอน user ยังไม่ login
// ============================================================

import React from 'react';
import { createStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './screen/auth/LoginScreen';
import RegisterScreen from './screen/auth/RegisterScreen';
import ForgotPasswordScreen from './screen/auth/ForgotPasswordScreen';
import VerifyEmailScreen from './screen/auth/VerifyEmailScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    </Stack.Navigator>
  );
}