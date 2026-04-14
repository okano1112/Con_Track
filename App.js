// App.js
// ============================================================
// Navigation ทั้งหมดรวมไว้ที่นี่
// ถ้าจะเพิ่มหน้าจอใหม่ → เพิ่ม Stack.Screen ใน MainStack
// ============================================================

import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/AuthContext';

// Screens
import { LoginScreen, RegisterScreen } from './src/LoginScreen';
import HomeScreen from './src/HomeScreen';
import { ProjectsListScreen, AddProjectScreen, ProjectDetailScreen, AddTaskScreen, AddDocumentScreen } from './src/ProjectsScreen';
import DocumentsScreen from './src/DocumentsScreen';
import ProfileScreen from './src/ProfileScreen';
import WorkerStatsScreen from './src/WorkerStatsScreen';
import TeamCalcScreen from './src/Teamcalcscreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// สี
const PRIMARY = '#0F2654';

// ============================================================
// Bottom Tabs (หน้าหลัก, โครงการ, เอกสาร, โปรไฟล์)
// ============================================================
function BottomTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color, size }) => {
        const icons = {
          HomeTab: focused ? 'home' : 'home-outline',
          ProjectsTab: focused ? 'business' : 'business-outline',
          DocumentsTab: focused ? 'document-text' : 'document-text-outline',
          ProfileTab: focused ? 'person-circle' : 'person-circle-outline',
        };
        return <Ionicons name={icons[route.name]} size={size} color={color} />;
      },
      tabBarActiveTintColor: PRIMARY,
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarStyle: { height: 85, paddingBottom: 25, paddingTop: 8 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    })}>
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'หน้าหลัก' }} />
      <Tab.Screen name="ProjectsTab" component={ProjectsListScreen} options={{ tabBarLabel: 'โครงการ' }} />
      <Tab.Screen name="DocumentsTab" component={DocumentsScreen} options={{ tabBarLabel: 'เอกสาร' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'โปรไฟล์' }} />
    </Tab.Navigator>
  );
}

// ============================================================
// Drawer (Bottom Tabs + สถิติช่าง)
// ============================================================
function DrawerNav() {
  return (
    <Drawer.Navigator screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="HomeTabs" component={BottomTabs} options={{ drawerLabel: 'หน้าหลัก' }} />
      <Drawer.Screen name="WorkerStats" component={WorkerStatsScreen} options={{ drawerLabel: 'สถิติช่าง' }} />
    </Drawer.Navigator>
  );
}

// ============================================================
// Main Stack (Drawer + หน้าจอย่อย)
// ============================================================
function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DrawerMain" component={DrawerNav} />
      <Stack.Screen name="AddProject" component={AddProjectScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="AddTask" component={AddTaskScreen} />
      <Stack.Screen name="AddDocument" component={AddDocumentScreen} />
      <Stack.Screen name="TeamCalc" component={TeamCalcScreen} />
      {/* ถ้าจะเพิ่มหน้าจอใหม่ → เพิ่ม Stack.Screen ตรงนี้ */}
    </Stack.Navigator>
  );
}

// ============================================================
// Auth Stack (Login + Register)
// ============================================================
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// ============================================================
// Root — เช็ค login แล้วเลือก Stack
// ============================================================
function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PRIMARY }}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

// ============================================================
// App — ครอบทั้งหมด
// ============================================================
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}