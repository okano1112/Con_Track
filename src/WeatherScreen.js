// src/WeatherScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';

// 🌟 ฐานข้อมูลพิกัด 77 จังหวัด (แก้ปัญหา API ค้นหาชื่อภาษาไทยไม่เจอ 100%)
const PROVINCE_COORDS = {
  'พิกัดปัจจุบัน (GPS)': null,
  'กรุงเทพมหานคร': { lat: 13.7563, lon: 100.5018 }, 'กระบี่': { lat: 8.0863, lon: 98.9063 }, 'กาญจนบุรี': { lat: 14.0041, lon: 99.5305 },
  'กาฬสินธุ์': { lat: 16.4333, lon: 103.5000 }, 'กำแพงเพชร': { lat: 16.4833, lon: 99.5167 }, 'ขอนแก่น': { lat: 16.4333, lon: 102.8333 },
  'จันทบุรี': { lat: 12.6167, lon: 102.1000 }, 'ฉะเชิงเทรา': { lat: 13.6833, lon: 101.0667 }, 'ชลบุรี': { lat: 13.3667, lon: 100.9833 },
  'ชัยนาท': { lat: 15.1833, lon: 100.1167 }, 'ชัยภูมิ': { lat: 15.8000, lon: 102.0333 }, 'ชุมพร': { lat: 10.5000, lon: 99.1833 },
  'เชียงราย': { lat: 19.9167, lon: 99.8333 }, 'เชียงใหม่': { lat: 18.7833, lon: 98.9833 }, 'ตรัง': { lat: 7.5500, lon: 99.6167 },
  'ตราด': { lat: 12.2333, lon: 102.5167 }, 'ตาก': { lat: 16.8833, lon: 99.1167 }, 'นครนายก': { lat: 14.2000, lon: 101.2167 },
  'นครปฐม': { lat: 13.8167, lon: 100.0667 }, 'นครพนม': { lat: 17.4000, lon: 104.7833 }, 'นครราชสีมา': { lat: 14.9667, lon: 102.1000 },
  'นครศรีธรรมราช': { lat: 8.4333, lon: 99.9667 }, 'นครสวรรค์': { lat: 15.7000, lon: 100.1333 }, 'นนทบุรี': { lat: 13.8667, lon: 100.5167 },
  'นราธิวาส': { lat: 6.4167, lon: 101.8167 }, 'น่าน': { lat: 18.7833, lon: 100.7667 }, 'บึงกาฬ': { lat: 18.3667, lon: 103.6500 },
  'บุรีรัมย์': { lat: 14.9833, lon: 103.1000 }, 'ปทุมธานี': { lat: 14.0167, lon: 100.5333 }, 'ประจวบคีรีขันธ์': { lat: 11.8000, lon: 99.8000 },
  'ปราจีนบุรี': { lat: 14.0500, lon: 101.3667 }, 'ปัตตานี': { lat: 6.8667, lon: 101.2500 }, 'พระนครศรีอยุธยา': { lat: 14.3500, lon: 100.5667 },
  'พะเยา': { lat: 19.1667, lon: 99.9000 }, 'พังงา': { lat: 8.4500, lon: 98.5333 }, 'พัทลุง': { lat: 7.6167, lon: 100.0833 },
  'พิจิตร': { lat: 16.4333, lon: 100.3500 }, 'พิษณุโลก': { lat: 16.8167, lon: 100.2667 }, 'เพชรบุรี': { lat: 13.1167, lon: 99.9333 },
  'เพชรบูรณ์': { lat: 16.4167, lon: 101.1500 }, 'แพร่': { lat: 18.1333, lon: 100.1333 }, 'ภูเก็ต': { lat: 7.9833, lon: 98.3333 },
  'มหาสารคาม': { lat: 16.1833, lon: 103.3000 }, 'มุกดาหาร': { lat: 16.5333, lon: 104.7167 }, 'แม่ฮ่องสอน': { lat: 19.3000, lon: 97.9667 },
  'ยโสธร': { lat: 15.8000, lon: 104.1333 }, 'ยะลา': { lat: 6.5333, lon: 101.2833 }, 'ร้อยเอ็ด': { lat: 16.0500, lon: 103.6500 },
  'ระนอง': { lat: 9.9667, lon: 98.6333 }, 'ระยอง': { lat: 12.6667, lon: 101.2833 }, 'ราชบุรี': { lat: 13.5333, lon: 99.8167 },
  'ลพบุรี': { lat: 14.8000, lon: 100.6167 }, 'ลำปาง': { lat: 18.2833, lon: 99.5000 }, 'ลำพูน': { lat: 18.5833, lon: 99.0167 },
  'เลย': { lat: 17.4833, lon: 101.7333 }, 'ศรีสะเกษ': { lat: 15.1167, lon: 104.3333 }, 'สกลนคร': { lat: 17.1667, lon: 104.1500 },
  'สงขลา': { lat: 7.2000, lon: 100.6000 }, 'สตูล': { lat: 6.6167, lon: 100.0667 }, 'สมุทรปราการ': { lat: 13.6000, lon: 100.6000 },
  'สมุทรสงคราม': { lat: 13.4167, lon: 100.0000 }, 'สมุทรสาคร': { lat: 13.5500, lon: 100.2833 }, 'สระแก้ว': { lat: 13.8167, lon: 102.0667 },
  'สระบุรี': { lat: 14.5333, lon: 100.9167 }, 'สิงห์บุรี': { lat: 14.8833, lon: 100.4000 }, 'สุโขทัย': { lat: 17.0167, lon: 99.8333 },
  'สุพรรณบุรี': { lat: 14.4667, lon: 100.1167 }, 'สุราษฎร์ธานี': { lat: 9.1333, lon: 99.3333 }, 'สุรินทร์': { lat: 14.8833, lon: 103.5000 },
  'หนองคาย': { lat: 17.8833, lon: 102.7333 }, 'หนองบัวลำภู': { lat: 17.2000, lon: 102.4333 }, 'อ่างทอง': { lat: 14.5833, lon: 100.4500 },
  'อำนาจเจริญ': { lat: 15.8667, lon: 104.6333 }, 'อุดรธานี': { lat: 17.4167, lon: 102.7833 }, 'อุตรดิตถ์': { lat: 17.6167, lon: 100.1000 },
  'อุทัยธานี': { lat: 15.3833, lon: 100.0333 }, 'อุบลราชธานี': { lat: 15.2333, lon: 104.8500 }
};

export default function WeatherScreen({ navigation }) {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('พิกัดปัจจุบัน (GPS)');
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locationName, setLocationName] = useState('พิกัดปัจจุบัน (GPS)');

  useEffect(() => { fetchWeatherByGPS(); }, []);

  const fetchWeatherByGPS = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        fetchWeatherByCoordinates(13.7563, 100.5018, 'กรุงเทพมหานคร (ค่าเริ่มต้น)');
        return;
      }
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      fetchWeatherByCoordinates(location.coords.latitude, location.coords.longitude, 'พิกัด GPS หน้างาน');
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ดึง GPS ไม่สำเร็จ กรุณาเลือกจังหวัดจากเมนู');
      setLoading(false);
    }
  };

  const processLocationSearch = () => {
    if (selectedProvince === 'พิกัดปัจจุบัน (GPS)') {
      fetchWeatherByGPS();
    } else {
      setLoading(true);
      const coords = PROVINCE_COORDS[selectedProvince];
      if (coords) {
        fetchWeatherByCoordinates(coords.lat, coords.lon, `จ.${selectedProvince}`);
      } else {
        setLoading(false);
      }
    }
  };

  const fetchWeatherByCoordinates = async (lat, lon, locName) => {
    try {
      setLocationName(locName);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,precipitation_probability_max&timezone=Asia%2FBangkok&start_date=${dateStr}&end_date=${dateStr}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.daily) {
        setWeatherData({ tempMax: data.daily.temperature_2m_max[0], rainProb: data.daily.precipitation_probability_max[0] });
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', 'เซิร์ฟเวอร์พยากรณ์อากาศไม่ตอบสนอง');
    } finally { setLoading(false); }
  };

  const getAdvice = (rainProb) => {
    if (rainProb >= 60) return { status: 'ฝนตกหนัก', icon: 'rainy', color: '#3B82F6', advice: '⚠️ งดงานเทปูนและโครงสร้างกลางแจ้ง แนะนำสลับทีมไปทำงานฉาบปูนภายใน หรืองานกระเบื้องเพื่อลดการรองาน (Idle Time)' };
    if (rainProb >= 30) return { status: 'มีโอกาสฝนตก', icon: 'partly-sunny', color: '#6366F1', advice: '⚡ ระมัดระวังงานกลางแจ้ง เตรียมผ้าใบคลุมวัสดุและเครื่องจักร' };
    return { status: 'ท้องฟ้าแจ่มใส', icon: 'sunny', color: '#F59E0B', advice: '✅ อากาศเอื้ออำนวย เร่งดำเนินงานโครงสร้าง หรืองานกลางแจ้งได้เต็มกำลัง' };
  };

  const condition = weatherData ? getAdvice(weatherData.rainProb) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ paddingHorizontal: 20 }}>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>พยากรณ์อากาศหน้างาน</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.label}>พื้นที่ก่อสร้าง</Text>
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowProvincePicker(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={20} color={selectedProvince === 'พิกัดปัจจุบัน (GPS)' ? '#3B82F6' : '#0F2654'} />
              <Text style={styles.dropdownText}>{selectedProvince}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
          
          <Text style={styles.label}>วันที่วิเคราะห์แผนงาน</Text>
          <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowDatePicker(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={20} color="#0F2654" />
              <Text style={styles.dropdownText}>{selectedDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
            </View>
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker value={selectedDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(e, d) => { setShowDatePicker(false); if(d) setSelectedDate(d); }} />
          )}

          <TouchableOpacity style={styles.searchBtn} onPress={processLocationSearch}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>ดึงข้อมูลสภาพอากาศ</Text>}
          </TouchableOpacity>
        </View>

        {!loading && weatherData && condition && (
          <View style={[styles.resultCard, { backgroundColor: condition.color }]}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>📍 {locationName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={condition.icon} size={80} color="#fff" />
              <View style={{ marginLeft: 20 }}>
                <Text style={{ fontSize: 48, fontWeight: 'bold', color: '#fff' }}>{weatherData.tempMax}°C</Text>
                <Text style={{ fontSize: 20, color: '#fff', fontWeight: '600' }}>{condition.status}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.1)', padding: 12, borderRadius: 10, marginVertical: 15 }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>โอกาสฝนตก:</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{weatherData.rainProb}%</Text>
            </View>
            <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 10 }}>
              <Text style={{ color: '#0F2654', fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>💡 การจัดการทรัพยากร (Resource Allocation)</Text>
              <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>{condition.advice}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal เลือกจังหวัด */}
      <Modal visible={showProvincePicker} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, maxHeight: '80%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F2654', marginBottom: 15, textAlign: 'center' }}>เลือกจังหวัดหน้างาน</Text>
            <FlatList
              data={Object.keys(PROVINCE_COORDS)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={{ paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between' }}
                  onPress={() => { setSelectedProvince(item); setShowProvincePicker(false); }}
                >
                  <Text style={{ fontSize: 16, color: selectedProvince === item ? '#0F2654' : '#374151', fontWeight: selectedProvince === item ? 'bold' : 'normal' }}>{item}</Text>
                  {selectedProvince === item && <Ionicons name="checkmark-circle" size={20} color="#0F2654" />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={{ padding: 15, backgroundColor: '#F3F4F6', alignItems: 'center', marginTop: 10, borderRadius: 10 }} onPress={() => setShowProvincePicker(false)}>
              <Text style={{ fontWeight: 'bold', color: '#374151' }}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#0F2654', paddingTop: 50, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 10 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 14 },
  dropdownText: { marginLeft: 10, fontSize: 15, color: '#111827', fontWeight: '600' },
  searchBtn: { backgroundColor: '#F59E0B', padding: 16, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  searchBtnText: { color: '#0F2654', fontWeight: 'bold', fontSize: 16 },
  resultCard: { borderRadius: 16, padding: 20, elevation: 3 }
});