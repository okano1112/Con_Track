import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { getWorkersWithRecords, insertWorker, insertWorkerRecord } from '../db/workerRepo';

// กำหนด Theme สีตามต้นฉบับของคุณ
const T = {
  navy: "#1B2A4A", orange: "#F28C28", white: "#FFFFFF", 
  gray50: "#F8F9FC", gray200: "#D8DDE8", gray400: "#8892A8"
};

export default function WorkerStatsScreen() {
  // State เก็บข้อมูลช่าง (ดึงจาก SQLite แทน Mock data)
  const [workers, setWorkers] = useState([]);
  const [activeTab, setActiveTab] = useState('individual');

  // 1. ดึงข้อมูลจาก Database ทันทีที่โหลดหน้าจอ
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await getWorkersWithRecords();
      setWorkers(data);
    } catch (error) {
      console.error("โหลดข้อมูลล้มเหลว", error);
    }
  };

  // 2. ฟังก์ชันตัวอย่างการเพิ่มช่างลง DB
  const handleAddWorker = async () => {
    try {
      await insertWorker("ช่างสมชาย", "ช่างผูกเหล็ก", "👷");
      loadData(); // โหลดข้อมูลใหม่หลังจากเพิ่มเสร็จ
      Alert.alert("สำเร็จ", "เพิ่มช่างใหม่เรียบร้อย");
    } catch (error) {
      console.error(error);
    }
  };

  // 3. UI การเรนเดอร์แท็บ (แปลง div เป็น View)
  return (
    <View style={styles.container}>
      {/* Header และ Tabs */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📈 ระบบสถิติช่าง</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setActiveTab('individual')} style={[styles.tab, activeTab === 'individual' && styles.activeTab]}>
            <Text style={activeTab === 'individual' ? styles.tabTextActive : styles.tabText}>📊 รายบุคคล</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('team')} style={[styles.tab, activeTab === 'team' && styles.activeTab]}>
            <Text style={activeTab === 'team' ? styles.tabTextActive : styles.tabText}>👥 จัดทีม</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* เนื้อหาในแท็บ */}
      <ScrollView style={styles.content}>
        {activeTab === 'individual' && (
          <View>
            <TouchableOpacity onPress={handleAddWorker} style={styles.addButton}>
              <Text style={{color: T.white, fontWeight: 'bold'}}>+ เพิ่มช่างตัวอย่างลง Database</Text>
            </TouchableOpacity>
            
            {/* แสดงรายชื่อช่างจาก DB */}
            {workers.map(worker => (
              <View key={worker.id} style={styles.card}>
                <Text style={styles.workerName}>{worker.avatar} {worker.name} ({worker.role})</Text>
                <Text style={{color: T.gray400}}>มีสถิติงาน {worker.records.length} รายการ</Text>
              </View>
            ))}
          </View>
        )}
        
        {activeTab === 'team' && (
          <View><Text>หน้าต่างจัดทีมและทำนายผลผลิต (ใช้วิธีการส่ง State แบบเดียวกับด้านบน)</Text></View>
        )}
      </ScrollView>
    </View>
  );
}

// 4. แปลง CSS เป็น StyleSheet
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.gray50 },
  header: { backgroundColor: T.navy, padding: 20, paddingTop: 50 },
  headerTitle: { color: T.white, fontSize: 24, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', marginTop: 20, gap: 10 },
  tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  activeTab: { backgroundColor: T.white },
  tabText: { color: T.white },
  tabTextActive: { color: T.navy, fontWeight: 'bold' },
  content: { padding: 20 },
  card: { backgroundColor: T.white, padding: 15, borderRadius: 10, marginBottom: 15, elevation: 2 },
  workerName: { fontSize: 18, fontWeight: 'bold', color: T.navy },
  addButton: { backgroundColor: T.orange, padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 }
});