// src/WeatherScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';

// 🌟 รายชื่อ 77 จังหวัดของประเทศไทย + ตัวเลือก GPS
const PROVINCES = [
  'พิกัดปัจจุบัน (GPS)', 'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี'
];

export default function WeatherScreen({ navigation }) {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // สถานะสำหรับ Dropdown จังหวัดและวันที่
  const [selectedProvince, setSelectedProvince] = useState('พิกัดปัจจุบัน (GPS)');
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [locationName, setLocationName] = useState('พิกัดปัจจุบัน (GPS)');

  useEffect(() => {
    fetchWeatherByGPS();
  }, []);

  // 🌟 1. ดึง GPS แบบ "ความแม่นยำสูงสุด" (Highest Accuracy)
  const fetchWeatherByGPS = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('แจ้งเตือน', 'ไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง ระบบจะใช้ค่าเริ่มต้น (กรุงเทพฯ)');
        fetchWeatherByCoordinates(13.7563, 100.5018, 'กรุงเทพมหานคร (ค่าเริ่มต้น)');
        return;
      }
      
      // บังคับใช้ความแม่นยำสูงสุด (แม่นยำระดับ 1-5 เมตร)
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });
      
      fetchWeatherByCoordinates(location.coords.latitude, location.coords.longitude, 'พิกัด GPS หน้างาน');
    } catch (error) {
      console.log(error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงข้อมูล GPS ได้ กรุณาลองเลือกจังหวัดแทน');
      setLoading(false);
    }
  };

  // 🌟 2. ค้นหาพิกัดจากจังหวัดที่เลือกใน Dropdown
  const searchLocationAndFetchWeather = async () => {
    if (selectedProvince === 'พิกัดปัจจุบัน (GPS)') {
      fetchWeatherByGPS();
      return;
    }
    
    try {
      setLoading(true);
      // ค้นหาพิกัดโดยแนบคำว่า Thailand เข้าไปเพื่อให้ API แม่นยำขึ้น
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(selectedProvince + " Thailand")}&count=1&language=th`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();

      if (geoData.results && geoData.results.length > 0) {
        const { latitude, longitude, name } = geoData.results[0];
        fetchWeatherByCoordinates(latitude, longitude, `จ.${selectedProvince}`);
      } else {
        Alert.alert('ไม่พบข้อมูล', 'เกิดข้อผิดพลาดในการหาพิกัดจังหวัดนี้');
        setLoading(false);
      }
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  // 🌟 3. ดึงพยากรณ์อากาศจากพิกัด
  const fetchWeatherByCoordinates = async (lat, lon, locName) => {
    try {
      setLocationName(locName);
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,precipitation_probability_max&timezone=Asia%2FBangkok&start_date=${dateStr}&end_date=${dateStr}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.daily) {
        setWeatherData({
          tempMax: data.daily.temperature_2m_max[0],
          rainProb: data.daily.precipitation_probability_max[0],
          weatherCode: data.daily.weathercode[0]
        });
      }
    } catch (error) {
      Alert.alert('ผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์พยากรณ์อากาศได้');
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  const getAdvice = (rainProb) => {
    if (rainProb >= 60) {
      return {
        status: 'ฝนตกหนัก', icon: 'rainy', color: '#3B82F6',
        advice: '⚠️ งดงานเทปูนและโครงสร้างกลางแจ้ง แนะนำสลับทีมไปทำงานฉาบปูนภายใน หรืองานกระเบื้องเพื่อลดความสูญเปล่าของค่าแรง'
      };
    } else if (rainProb >= 30) {
      return {
        status: 'มีโอกาสฝนตก', icon: 'partly-sunny', color: '#6366F1',
        advice: '⚡ ระมัดระวังงานกลางแจ้ง เตรียมผ้าใบคลุมวัสดุและเครื่องจักร สามารถทำงานโครงสร้างได้แต่ต้องประเมินหน้างานจริง'
      };
    } else {
      return {
        status: 'ท้องฟ้าแจ่มใส', icon: 'sunny', color: '#F59E0B',
        advice: '✅ อากาศเอื้ออำนวย เร่งดำเนินงานโครงสร้าง คสล. งานมุงหลังคา หรืองานกลางแจ้งได้เต็มกำลังผลิต'
      };
    }
  };

  const condition = weatherData ? getAdvice(weatherData.rainProb) : null;

  // 🌟 Component สำหรับ Dropdown เลือกจังหวัด
  const renderProvincePickerModal = () => (
    <Modal visible={showProvincePicker} transparent animationType="fade">
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerBox}>
          <Text style={styles.modalTitle}>เลือกจังหวัดหน้างาน</Text>
          <FlatList
            data={PROVINCES}
            keyExtractor={(item) => item}
            style={{ width: '100%', maxHeight: 400 }}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.pickerItem}
                onPress={() => {
                  setSelectedProvince(item);
                  setShowProvincePicker(false);
                }}
              >
                <Text style={{ fontSize: 16, color: selectedProvince === item ? '#0F2654' : '#374151', fontWeight: selectedProvince === item ? 'bold' : 'normal' }}>
                  {item}
                </Text>
                {selectedProvince === item && <Ionicons name="checkmark-circle" size={20} color="#0F2654" />}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity 
            style={{ width: '100%', padding: 15, backgroundColor: '#F3F4F6', alignItems: 'center', marginTop: 10, borderRadius: 10 }}
            onPress={() => setShowProvincePicker(false)}
          >
            <Text style={{ fontWeight: 'bold', color: '#374151' }}>ปิด</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>พยากรณ์อากาศหน้างาน</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          
          {/* 🌟 ปุ่มเรียก Dropdown รายชื่อจังหวัด */}
          <Text style={styles.label}>พื้นที่ก่อสร้าง (จังหวัด)</Text>
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
            <Ionicons name="create-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker 
              value={selectedDate} 
              mode="date" 
              display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
              onChange={onDateChange} 
            />
          )}

          <TouchableOpacity style={styles.searchBtn} onPress={searchLocationAndFetchWeather}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>วิเคราะห์สภาพอากาศ</Text>}
          </TouchableOpacity>
        </View>

        {!loading && weatherData && condition && (
          <View style={[styles.resultCard, { backgroundColor: condition.color }]}>
            <Text style={styles.resultDate}>พยากรณ์สำหรับวันที่ {selectedDate.toLocaleDateString('th-TH')}</Text>
            <Text style={styles.resultLocation}>📍 {locationName}</Text>
            
            <View style={styles.weatherMain}>
              <Ionicons name={condition.icon} size={80} color="#fff" />
              <View style={{ marginLeft: 20 }}>
                <Text style={styles.tempText}>{weatherData.tempMax}°C</Text>
                <Text style={styles.statusText}>{condition.status}</Text>
              </View>
            </View>
            
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>โอกาสฝนตก:</Text>
              <Text style={styles.statValue}>{weatherData.rainProb}%</Text>
            </View>

            <View style={styles.adviceBox}>
              <Text style={styles.adviceTitle}>💡 การจัดการทรัพยากร (Resource Allocation)</Text>
              <Text style={styles.adviceText}>{condition.advice}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* เรียกใช้งาน Modal Picker ที่สร้างไว้ */}
      {renderProvincePickerModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#0F2654', paddingTop: 50, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuBtn: { paddingHorizontal: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 10 },
  
  // 🌟 Style สำหรับ Dropdown ใหม่
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 14 },
  dropdownText: { marginLeft: 10, fontSize: 15, color: '#111827', fontWeight: '600' },
  
  // 🌟 Style สำหรับ Modal Picker
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#fff', width: '85%', borderRadius: 16, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F2654', marginBottom: 15 },
  pickerItem: { width: '100%', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  searchBtn: { backgroundColor: '#F59E0B', padding: 16, borderRadius: 10, marginTop: 20, alignItems: 'center' },
  searchBtnText: { color: '#0F2654', fontWeight: 'bold', fontSize: 16 },
  resultCard: { borderRadius: 16, padding: 20, elevation: 3 },
  resultDate: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  resultLocation: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginTop: 5 },
  weatherMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  tempText: { fontSize: 48, fontWeight: 'bold', color: '#fff' },
  statusText: { fontSize: 20, color: '#fff', fontWeight: '600' },
  statBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.1)', padding: 12, borderRadius: 10, marginVertical: 15 },
  statLabel: { color: '#fff', fontSize: 16 },
  statValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  adviceBox: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginTop: 5 },
  adviceTitle: { color: '#0F2654', fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  adviceText: { color: '#374151', fontSize: 14, lineHeight: 22 }
});