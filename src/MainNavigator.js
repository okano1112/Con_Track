// MainNavigator.js
// ============================================================
// Navigator หลักหลัง login
// v7: เพิ่ม GanttTasksScreen (MS Project-style) ใน Projects + Hub stacks
// ============================================================

import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import AppLayout from './AppLayout';
import { C } from './Components';

import ProjectHubScreen from './ProjectHubScreen';
import ProfileScreen from './ProfileScreen';
import {
  ProjectsListScreen, AddProjectScreen, ProjectDetailScreen,
  AddTaskScreen, AddDocumentScreen
} from './ProjectsScreen';
import JoinProjectScreen from './JoinProjectScreen';
import BOQScreen from './BOQScreen';
import DocumentsScreen from './DocumentsScreen';
import WorkerStatsScreen from './WorkerStatsScreen';
import TeamCalcScreen from './TeamCalcScreen';
import WeatherScreen from './WeatherScreen';
import RainAlternativesScreen from './RainAlternativesScreen';
import ProjectFormScreen from './ProjectFormScreen';
import GanttTasksScreen from './GanttTasksScreen';   // ✨ NEW v7

// ============================================================
// Stack: Projects
// ============================================================
const ProjectStack = createNativeStackNavigator();
function ProjectsStackNav() {
  return (
    <ProjectStack.Navigator screenOptions={{ headerShown: false }}>
      <ProjectStack.Screen name="ProjectsList" component={ProjectsListScreen} />
      <ProjectStack.Screen name="AddProject" component={AddProjectScreen} />
      <ProjectStack.Screen name="JoinProject" component={JoinProjectScreen} />
      <ProjectStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <ProjectStack.Screen name="AddTask" component={AddTaskScreen} />
      <ProjectStack.Screen name="AddDocument" component={AddDocumentScreen} />
      <ProjectStack.Screen name="BOQ" component={BOQScreen} />
      <ProjectStack.Screen name="GanttTasks" component={GanttTasksScreen} />
      <ProjectStack.Screen name="ProjectForm" component={ProjectFormScreen} />
    </ProjectStack.Navigator>
  );
}

// ============================================================
// Stack: Hub
// ============================================================
const HubStack = createNativeStackNavigator();
function HubStackNav() {
  return (
    <HubStack.Navigator screenOptions={{ headerShown: false }}>
      <HubStack.Screen name="ProjectHub" component={ProjectHubScreen} />
      <HubStack.Screen name="ProjectForm" component={ProjectFormScreen} />
      <HubStack.Screen name="AddProject" component={AddProjectScreen} />
      <HubStack.Screen name="JoinProject" component={JoinProjectScreen} />
      <HubStack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <HubStack.Screen name="AddTask" component={AddTaskScreen} />
      <HubStack.Screen name="AddDocument" component={AddDocumentScreen} />
      <HubStack.Screen name="BOQ" component={BOQScreen} />
      <HubStack.Screen name="GanttTasks" component={GanttTasksScreen} />
    </HubStack.Navigator>
  );
}

// ============================================================
// Stack: WorkerStats + TeamCalc
// ============================================================
const WorkerStatsStack = createNativeStackNavigator();
function WorkerStatsStackNav() {
  return (
    <WorkerStatsStack.Navigator screenOptions={{ headerShown: false }}>
      <WorkerStatsStack.Screen name="WorkerStats" component={WorkerStatsScreen} />
      <WorkerStatsStack.Screen name="TeamCalc" component={TeamCalcScreen} />
    </WorkerStatsStack.Navigator>
  );
}

// ============================================================
// Bottom Tabs
// ============================================================
const Tab = createBottomTabNavigator();
function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textLight,
        tabBarStyle: { paddingBottom: 4, paddingTop: 4, height: 56 },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            HubTab: 'home-outline',
            ProjectsTab: 'business-outline',
            DocumentsTab: 'document-text-outline',
            ProfileTab: 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HubTab" component={HubStackNav} options={{ title: 'หน้าหลัก' }} />
      <Tab.Screen name="ProjectsTab" component={ProjectsStackNav} options={{ title: 'โครงการ' }} />
      <Tab.Screen name="DocumentsTab" component={DocumentsScreen} options={{ title: 'เอกสาร' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'โปรไฟล์' }} />
    </Tab.Navigator>
  );
}

// ============================================================
// Drawer
// ============================================================
const Drawer = createDrawerNavigator();

function withLayout(Component) {
  return (props) => (
    <AppLayout>
      <Component {...props} />
    </AppLayout>
  );
}

export default function MainNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: C.primary,
        drawerActiveBackgroundColor: C.primary + '15',
      }}
    >
      <Drawer.Screen name="Main" component={withLayout(HomeTabs)}
        options={{
          title: 'หน้าหลัก',
          drawerIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }} />

      <Drawer.Screen name="WorkerStats" component={withLayout(WorkerStatsStackNav)}
        options={{
          title: 'สถิติช่าง',
          drawerIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }} />

      <Drawer.Screen name="WeatherScreen" component={withLayout(WeatherScreen)}
        options={{
          title: 'พยากรณ์อากาศ',
          drawerIcon: ({ color, size }) => <Ionicons name="cloudy" size={size} color={color} />,
        }} />
      <Drawer.Screen name="RainAlternatives" component={withLayout(RainAlternativesScreen)}
        options={{
          title: 'งานสำรอง (ฝนตก)',
          drawerIcon: ({ color, size }) => <Ionicons name="git-branch" size={size} color={color} />,
        }} />
    </Drawer.Navigator>
  );
}