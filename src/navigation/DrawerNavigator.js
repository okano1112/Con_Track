import 'react-native-gesture-handler'
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import BottomTabNavigator from './BottomTabNavigator'; // ตัวเมนูหลักด้านล่างของคุณ
import WorkerStatsScreen from '../screens/WorkerStatsScreen'; // หน้าใหม่ที่เราเพิ่งสร้าง

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  return (
    // กำหนดให้ Drawer ครอบการทำงานของแอปทั้งหมด
    <Drawer.Navigator screenOptions={{ headerShown: false }}>
      {/* 1. หน้าหลักของคุณ (ที่เคยเป็น Tab ด้านล่าง) */}
      <Drawer.Screen 
        name="MainTabs" 
        component={BottomTabNavigator} 
        options={{ drawerLabel: 'หน้าหลัก' }} 
      />
      
      {/* 2. หน้าสถิติช่างที่เรานำมาใส่เพิ่มในเมนูด้านข้าง */}
      <Drawer.Screen 
        name="WorkerStats" 
        component={WorkerStatsScreen} 
        options={{ 
          drawerLabel: 'สถิติและการประเมินช่าง',
          headerShown: true // เปิด Header เพื่อให้มีปุ่มแฮมเบอร์เกอร์ด้านซ้ายบน
        }} 
      />
    </Drawer.Navigator>
  );
}