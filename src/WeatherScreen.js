// src/WeatherScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Card, Header } from './Components'; 

export default function WeatherScreen({ navigation }) {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('กำลังหาพิกัด...');

  useEffect(() => {
    fetchWeatherByGPS();
  }, []);

  const fetchWeatherByGPS = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName('ไม่ได้รับสิทธิ์เข้าถึงตำแหน่ง GPS');
        setLoading(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // ดึงข้อมูลพยากรณ์อากาศแบบไม่ใช้ Token
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
      const response = await fetch(url);
      const data = await response.json();
      
      setWeatherData(data);
      setLocationName(`พิกัดหน้างาน: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    } catch (error) {
      console.log('Error fetching weather:', error);
      setLocationName('เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const getConstructionAdvice = (weatherCode) => {
    // อ้างอิงรหัส WMO (0=Clear, 1-3=Cloudy, 51-67=Rain, 80-99=Rain/Thunderstorm)
    if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 99)) {
      return { 
        status: 'ฝนตก', 
        condition: 'Rain',
        impact: 'ประสิทธิภาพงานกลางแจ้งลดลง 60-80% เสี่ยงต่อความปลอดภัย', 
        advice: 'แนะนำสลับช่างไปทำงานในร่ม เช่น ฉาบปูน ทาสีภายใน หรือปูกระเบื้อง (ไม่ใช่ความผิดช่างหากงานกลางแจ้งล่าช้า)',
        icon: 'rainy', color: '#3B82F6', isDelayExcused: true 
      };
    } else if (weatherCode === 0 || weatherCode === 1) {
      return { 
        status: 'ท้องฟ้าแจ่มใส / แดดจัด', 
        condition: 'ExtremeHot',
        impact: 'ประสิทธิภาพงานกลางแจ้งปกติ (ระวังภาวะขาดน้ำ)', 
        advice: 'เร่งงานโครงสร้าง เทปูน มุงหลังคาได้เต็มที่ แนะนำให้สลับพักในที่ร่ม',
        icon: 'sunny', color: '#F59E0B', isDelayExcused: false 
      };
    }
    return { 
      status: 'มีเมฆมาก / อากาศปกติ', 
      condition: 'Normal',
      impact: 'สภาพอากาศเอื้ออำนวยต่อการทำงาน', 
      advice: 'ทำงานได้ตามแผนงานปกติทุกประเภท',
      icon: 'partly-sunny', color: '#6B7280', isDelayExcused: false 
    };
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#0F2654" />
      </View>
    );
  }

  const weatherCode = weatherData?.current_weather?.weathercode || 0;
  const currentCondition = getConstructionAdvice(weatherCode);

  return (
    <View style={styles.container}>
      <Header title="สภาพอากาศหน้างาน" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card style={{ backgroundColor: currentCondition.color, alignItems: 'center', paddingVertical: 30, borderRadius: 16 }}>
          <Ionicons name={currentCondition.icon} size={80} color="#fff" />
          <Text style={styles.tempText}>{weatherData?.current_weather?.temperature}°C</Text>
          <Text style={styles.statusText}>{currentCondition.status}</Text>
          <Text style={styles.locationText}>{locationName}</Text>
        </Card>

        <Card style={{ marginTop: 16, borderRadius: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="construct-outline" size={24} color="#0F2654" style={{ marginRight: 8 }} />
            <Text style={styles.headerTitle}>วิเคราะห์ผลกระทบต่อแผนงาน</Text>
          </View>
          
          {currentCondition.isDelayExcused && (
            <View style={styles.alertBox}>
              <Ionicons name="warning" size={20} color="#9A3412" />
              <Text style={styles.alertText}>แจ้งเตือนโฟร์แมน: งานกลางแจ้งล่าช้าจากสภาพอากาศ ระบบอนุโลมไม่หักคะแนนประเมินช่าง</Text>
            </View>
          )}

          <Text style={styles.label}>ผลกระทบการก่อสร้าง:</Text>
          <Text style={styles.value}>{currentCondition.impact}</Text>

          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 }} />

          <Text style={styles.label}>คำแนะนำการสลับงาน (Resource Allocation):</Text>
          <Text style={styles.value}>{currentCondition.advice}</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  tempText: { fontSize: 48, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  statusText: { fontSize: 24, color: '#fff', fontWeight: '600' },
  locationText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 10, textAlign: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  alertBox: { flexDirection: 'row', backgroundColor: '#FFEDD5', padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#FDBA74' },
  alertText: { color: '#9A3412', fontSize: 13, marginLeft: 8, flex: 1, fontWeight: '600', lineHeight: 20 },
  label: { fontSize: 14, color: '#6B7280', marginTop: 8, fontWeight: '500' },
  value: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 4, lineHeight: 24 }
});