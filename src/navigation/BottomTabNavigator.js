// src/navigation/BottomTabNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { HomeScreen, ProjectsScreen, DocumentsScreen, ProfileScreen } from '../screens';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = {
  HomeTab: { label: 'หน้าหลัก', active: 'home', inactive: 'home-outline' },
  ProjectsTab: { label: 'โครงการ', active: 'business', inactive: 'business-outline' },
  DocumentsTab: { label: 'เอกสาร', active: 'document-text', inactive: 'document-text-outline' },
  ProfileTab: { label: 'โปรไฟล์', active: 'person-circle', inactive: 'person-circle-outline' },
};

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const config = TAB_CONFIG[route.name];
          const iconName = focused ? config.active : config.inactive;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle: {
          height: 85,
          paddingBottom: 25,
          paddingTop: 8,
          borderTopColor: COLORS.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: TAB_CONFIG.HomeTab.label }} />
      <Tab.Screen name="ProjectsTab" component={ProjectsScreen} options={{ tabBarLabel: TAB_CONFIG.ProjectsTab.label }} />
      <Tab.Screen name="DocumentsTab" component={DocumentsScreen} options={{ tabBarLabel: TAB_CONFIG.DocumentsTab.label }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: TAB_CONFIG.ProfileTab.label }} />
    </Tab.Navigator>
  );
}
