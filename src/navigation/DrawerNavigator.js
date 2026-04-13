import 'react-native-gesture-handler';
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import BottomTabNavigator from './BottomTabNavigator';
import WorkerStatsScreen from '../screens/WorkerStatsScreen';

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator screenOptions={{ headerShown: false }}>
      {/* 1. หน้าหลัก (Bottom Tab) — เปลี่ยนชื่อจาก MainTabs เป็น HomeTabs เพื่อไม่ให้ซ้ำกับ Stack */}
      <Drawer.Screen
        name="HomeTabs"
        component={BottomTabNavigator}
        options={{ drawerLabel: 'หน้าหลัก' }}
      />

      {/* 2. หน้าสถิติช่าง */}
      <Drawer.Screen
        name="WorkerStats"
        component={WorkerStatsScreen}
        options={{
          drawerLabel: 'สถิติและการประเมินช่าง',
          headerShown: false,  // ปิด header เพราะ WorkerStatsScreen มี header เอง
        }}
      />
    </Drawer.Navigator>
  );
}