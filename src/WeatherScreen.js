// WeatherScreen.js
// ============================================================
// ระบบพยากรณ์อากาศหน้างาน (Open-Meteo API)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Alert, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// พิกัด 77 จังหวัด
// ============================================================
const PROVINCE_COORDS = {
  'พิกัดปัจจุบัน (GPS)': null,
  'กรุงเทพมหานคร': { lat: 13.7563, lon: 100.5018 },
  'กระบี่': { lat: 8.0863, lon: 98.9063 },
  'กาญจนบุรี': { lat: 14.0041, lon: 99.5305 },
  'กาฬสินธุ์': { lat: 16.4333, lon: 103.5 },
  'กำแพงเพชร': { lat: 16.4833, lon: 99.5167 },
  'ขอนแก่น': { lat: 16.4333, lon: 102.8333 },
  'จันทบุรี': { lat: 12.6167, lon: 102.1 },
  'ฉะเชิงเทรา': { lat: 13.6833, lon: 101.0667 },
  'ชลบุรี': { lat: 13.3667, lon: 100.9833 },
  'ชัยนาท': { lat: 15.1833, lon: 100.1167 },
  'ชัยภูมิ': { lat: 15.8, lon: 102.0333 },
  'ชุมพร': { lat: 10.5, lon: 99.1833 },
  'เชียงราย': { lat: 19.9167, lon: 99.8333 },
  'เชียงใหม่': { lat: 18.7833, lon: 98.9833 },
  'ตรัง': { lat: 7.55, lon: 99.6167 },
  'ตราด': { lat: 12.2333, lon: 102.5167 },
  'ตาก': { lat: 16.8833, lon: 99.1167 },
  'นครนายก': { lat: 14.2, lon: 101.2167 },
  'นครปฐม': { lat: 13.8167, lon: 100.0667 },
  'นครพนม': { lat: 17.4, lon: 104.7833 },
  'นครราชสีมา': { lat: 14.9667, lon: 102.1 },
  'นครศรีธรรมราช': { lat: 8.4333, lon: 99.9667 },
  'นครสวรรค์': { lat: 15.7, lon: 100.1333 },
  'นนทบุรี': { lat: 13.8667, lon: 100.5167 },
  'นราธิวาส': { lat: 6.4167, lon: 101.8167 },
  'น่าน': { lat: 18.7833, lon: 100.7667 },
  'บึงกาฬ': { lat: 18.3667, lon: 103.65 },
  'บุรีรัมย์': { lat: 14.9833, lon: 103.1 },
  'ปทุมธานี': { lat: 14.0167, lon: 100.5333 },
  'ประจวบคีรีขันธ์': { lat: 11.8, lon: 99.8 },
  'ปราจีนบุรี': { lat: 14.05, lon: 101.3667 },
  'ปัตตานี': { lat: 6.8667, lon: 101.25 },
  'พระนครศรีอยุธยา': { lat: 14.35, lon: 100.5667 },
  'พะเยา': { lat: 19.1667, lon: 99.9 },
  'พังงา': { lat: 8.45, lon: 98.5333 },
  'พัทลุง': { lat: 7.6167, lon: 100.0833 },
  'พิจิตร': { lat: 16.4333, lon: 100.35 },
  'พิษณุโลก': { lat: 16.8167, lon: 100.2667 },
  'เพชรบุรี': { lat: 13.1167, lon: 99.9333 },
  'เพชรบูรณ์': { lat: 16.4167, lon: 101.15 },
  'แพร่': { lat: 18.1333, lon: 100.1333 },
  'ภูเก็ต': { lat: 7.9833, lon: 98.3333 },
  'มหาสารคาม': { lat: 16.1833, lon: 103.3 },
  'มุกดาหาร': { lat: 16.5333, lon: 104.7167 },
  'แม่ฮ่องสอน': { lat: 19.3, lon: 97.9667 },
  'ยโสธร': { lat: 15.8, lon: 104.1333 },
  'ยะลา': { lat: 6.5333, lon: 101.2833 },
  'ร้อยเอ็ด': { lat: 16.05, lon: 103.65 },
  'ระนอง': { lat: 9.9667, lon: 98.6333 },
  'ระยอง': { lat: 12.6667, lon: 101.2833 },
  'ราชบุรี': { lat: 13.5333, lon: 99.8167 },
  'ลพบุรี': { lat: 14.8, lon: 100.6167 },
  'ลำปาง': { lat: 18.2833, lon: 99.5 },
  'ลำพูน': { lat: 18.5833, lon: 99.0167 },
  'เลย': { lat: 17.4833, lon: 101.7333 },
  'ศรีสะเกษ': { lat: 15.1167, lon: 104.3333 },
  'สกลนคร': { lat: 17.1667, lon: 104.15 },
  'สงขลา': { lat: 7.2, lon: 100.6 },
  'สตูล': { lat: 6.6167, lon: 100.0667 },
  'สมุทรปราการ': { lat: 13.6, lon: 100.6 },
  'สมุทรสงคราม': { lat: 13.4167, lon: 100.0 },
  'สมุทรสาคร': { lat: 13.55, lon: 100.2833 },
  'สระแก้ว': { lat: 13.8167, lon: 102.0667 },
  'สระบุรี': { lat: 14.5333, lon: 100.9167 },
  'สิงห์บุรี': { lat: 14.8833, lon: 100.4 },
  'สุโขทัย': { lat: 17.0167, lon: 99.8333 },
  'สุพรรณบุรี': { lat: 14.4667, lon: 100.1167 },
  'สุราษฎร์ธานี': { lat: 9.1333, lon: 99.3333 },
  'สุรินทร์': { lat: 14.8833, lon: 103.5 },
  'หนองคาย': { lat: 17.8833, lon: 102.7333 },
  'หนองบัวลำภู': { lat: 17.2, lon: 102.4333 },
  'อ่างทอง': { lat: 14.5833, lon: 100.45 },
  'อำนาจเจริญ': { lat: 15.8667, lon: 104.6333 },
  'อุดรธานี': { lat: 17.4167, lon: 102.7833 },
  'อุตรดิตถ์': { lat: 17.6167, lon: 100.1 },
  'อุทัยธานี': { lat: 15.3833, lon: 100.0333 },
  'อุบลราชธานี': { lat: 15.2333, lon: 104.85 }
};

const WEATHER_CODES = {
  0: { desc: 'ท้องฟ้าแจ่มใส', icon: 'sunny', color: '#F59E0B' },
  1: { desc: 'ส่วนใหญ่แจ่มใส', icon: 'sunny', color: '#F59E0B' },
  2: { desc: 'มีเมฆบางส่วน', icon: 'partly-sunny', color: '#6366F1' },
  3: { desc: 'มีเมฆมาก', icon: 'cloudy', color: '#6B7280' },
  45: { desc: 'หมอก', icon: 'cloudy', color: '#9CA3AF' },
  48: { desc: 'หมอกแข็ง', icon: 'cloudy', color: '#9CA3AF' },
  51: { desc: 'ฝนปรอยเบา', icon: 'rainy', color: '#3B82F6' },
  53: { desc: 'ฝนปรอยปานกลาง', icon: 'rainy', color: '#3B82F6' },
  55: { desc: 'ฝนปรอยหนัก', icon: 'rainy', color: '#2563EB' },
  61: { desc: 'ฝนตกเบา', icon: 'rainy', color: '#3B82F6' },
  63: { desc: 'ฝนตกปานกลาง', icon: 'rainy', color: '#2563EB' },
  65: { desc: 'ฝนตกหนัก', icon: 'thunderstorm', color: '#1D4ED8' },
  80: { desc: 'ฝนเป็นช่วงๆ เบา', icon: 'rainy', color: '#3B82F6' },
  81: { desc: 'ฝนเป็นช่วงๆ ปานกลาง', icon: 'rainy', color: '#2563EB' },
  82: { desc: 'ฝนเป็นช่วงๆ หนัก', icon: 'thunderstorm', color: '#1D4ED8' },
  95: { desc: 'พายุฝนฟ้าคะนอง', icon: 'thunderstorm', color: '#7C3AED' },
  96: { desc: 'พายุฯ มีลูกเห็บ', icon: 'thunderstorm', color: '#6D28D9' },
  99: { desc: 'พายุฯ รุนแรง', icon: 'thunderstorm', color: '#5B21B6' },
};

function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { desc: 'ไม่ทราบ', icon: 'help-circle', color: '#6B7280' };
}

// ============================================================
// Export สำหรับ TeamCalcScreen
// ============================================================
export async function getWeatherForecast() {
  try {
    const cached = await AsyncStorage.getItem('weatherForecast');
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp < 3600000) return data;
    }
    return null;
  } catch (e) { return null; }
}

export async function saveWeatherForecast(data) {
  try {
    await AsyncStorage.setItem('weatherForecast', JSON.stringify({
      ...data, timestamp: Date.now()
    }));
  } catch (e) { console.log('Save weather error:', e); }
}

// ============================================================
// MAIN
// ============================================================
export default function WeatherScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState('พิกัดปัจจุบัน (GPS)');
  const [showProvincePicker, setShowProvincePicker] = useState(false);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [dailyForecast, setDailyForecast] = useState([]);
  const [locationDetails, setLocationDetails] = useState({
    province: '', district: '', subdistrict: '', fullAddress: ''
  });

  useEffect(() => { fetchWeatherByGPS(); }, []);

  const fetchWeatherByGPS = async () => {
    try {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์ GPS');
        fetchWeatherByCoordinates(13.7563, 100.5018, 'กรุงเทพมหานคร');
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      const locDetails = {
        province: address?.region || address?.city || '',
        district: address?.subregion || address?.district || '',
        subdistrict: address?.street || address?.name || '',
        fullAddress: [address?.name, address?.street, address?.subregion, address?.region]
          .filter(Boolean).join(', ')
      };

      setLocationDetails(locDetails);
      await fetchWeatherByCoordinates(
        location.coords.latitude, location.coords.longitude,
        locDetails.province || 'พิกัด GPS'
      );
    } catch (error) {
      console.log('GPS Error:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงตำแหน่ง GPS ได้');
      setLoading(false);
    }
  };

  const fetchWeatherByCoordinates = async (lat, lon, provinceName) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FBangkok&forecast_days=7`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.current && data.daily) {
        const current = {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          apparentTemp: data.current.apparent_temperature,
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          tempMax: data.daily.temperature_2m_max[0],
          tempMin: data.daily.temperature_2m_min[0],
          rainProb: data.daily.precipitation_probability_max[0],
          precipitation: data.daily.precipitation_sum[0]
        };
        setCurrentWeather(current);

        const forecast = data.daily.time.map((date, index) => ({
          date,
          weatherCode: data.daily.weather_code[index],
          tempMax: data.daily.temperature_2m_max[index],
          tempMin: data.daily.temperature_2m_min[index],
          rainProb: data.daily.precipitation_probability_max[index],
          precipitation: data.daily.precipitation_sum[index],
          windSpeed: data.daily.wind_speed_10m_max[index]
        }));
        setDailyForecast(forecast);

        await saveWeatherForecast({
          current, forecast,
          location: { lat, lon, province: provinceName, ...locationDetails }
        });
      }
    } catch (error) {
      console.log('Weather API Error:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงข้อมูลสภาพอากาศได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvince = async (province) => {
    setSelectedProvince(province);
    setShowProvincePicker(false);

    if (province === 'พิกัดปัจจุบัน (GPS)') {
      await fetchWeatherByGPS();
    } else {
      const coords = PROVINCE_COORDS[province];
      if (coords) {
        setLocationDetails({
          province, district: '', subdistrict: '', fullAddress: `จ.${province}`
        });
        setLoading(true);
        await fetchWeatherByCoordinates(coords.lat, coords.lon, province);
      }
    }
  };

  const getWorkAdvice = (rainProb, weatherCode) => {
    if (rainProb >= 70 || weatherCode >= 65) {
      return {
        status: 'ไม่เหมาะทำงานกลางแจ้ง', statusColor: '#EF4444', icon: 'warning',
        advice: '⛔ งดงานเทปูน, งานโครงสร้าง, มุงหลังคา\n✅ แนะนำงานในร่ม: ฉาบปูน, กระเบื้อง, ทาสี',
        outdoorOk: false
      };
    }
    if (rainProb >= 40 || (weatherCode >= 51 && weatherCode < 65)) {
      return {
        status: 'ระวังฝนตก', statusColor: '#F59E0B', icon: 'alert-circle',
        advice: '⚠️ เตรียมผ้าใบคลุมวัสดุ\n⏰ เร่งงานกลางแจ้งช่วงเช้า', outdoorOk: true
      };
    }
    return {
      status: 'เหมาะสำหรับทุกงาน', statusColor: '#10B981', icon: 'checkmark-circle',
      advice: '✅ อากาศเอื้ออำนวย เร่งงานกลางแจ้งได้เต็มกำลัง', outdoorOk: true
    };
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const isToday = (s) => s === new Date().toISOString().split('T')[0];
  const isTomorrow = (s) => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return s === t.toISOString().split('T')[0];
  };

  const weatherInfo = currentWeather ? getWeatherInfo(currentWeather.weatherCode) : null;
  const workAdvice = currentWeather ? getWorkAdvice(currentWeather.rainProb, currentWeather.weatherCode) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ padding: 8 }}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>พยากรณ์อากาศหน้างาน</Text>
        <TouchableOpacity onPress={fetchWeatherByGPS} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.card}>
          <Text style={styles.label}>📍 พื้นที่ก่อสร้าง</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowProvincePicker(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons
                name={selectedProvince === 'พิกัดปัจจุบัน (GPS)' ? 'navigate' : 'location'}
                size={20}
                color={selectedProvince === 'พิกัดปัจจุบัน (GPS)' ? '#3B82F6' : '#0F2654'} />
              <Text style={styles.dropdownText}>{selectedProvince}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>

          {locationDetails.fullAddress && (
            <View style={styles.locationDetail}>
              <Text style={styles.locationDetailText}>
                {locationDetails.subdistrict && `ต.${locationDetails.subdistrict} `}
                {locationDetails.district && `อ.${locationDetails.district} `}
                {locationDetails.province && `จ.${locationDetails.province}`}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <ActivityIndicator size="large" color="#0F2654" />
            <Text style={{ marginTop: 12, color: '#6B7280' }}>กำลังดึงข้อมูล...</Text>
          </View>
        ) : currentWeather ? (
          <>
            <View style={[styles.weatherCard, { backgroundColor: weatherInfo.color }]}>
              <View style={styles.weatherCardHeader}>
                <View>
                  <Text style={styles.weatherDate}>วันนี้ • {formatDate(new Date().toISOString().split('T')[0])}</Text>
                  <Text style={styles.weatherDesc}>{weatherInfo.desc}</Text>
                </View>
                <Ionicons name={weatherInfo.icon} size={60} color="rgba(255,255,255,0.9)" />
              </View>

              <View style={styles.tempContainer}>
                <Text style={styles.tempMain}>{Math.round(currentWeather.temperature)}°</Text>
                <View style={styles.tempRange}>
                  <View style={styles.tempItem}>
                    <Ionicons name="arrow-up" size={16} color="#FEF3C7" />
                    <Text style={styles.tempLabel}>สูงสุด</Text>
                    <Text style={styles.tempValue}>{Math.round(currentWeather.tempMax)}°</Text>
                  </View>
                  <View style={styles.tempDivider} />
                  <View style={styles.tempItem}>
                    <Ionicons name="arrow-down" size={16} color="#BFDBFE" />
                    <Text style={styles.tempLabel}>ต่ำสุด</Text>
                    <Text style={styles.tempValue}>{Math.round(currentWeather.tempMin)}°</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="water" size={20} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.statValue}>{currentWeather.humidity}%</Text>
                  <Text style={styles.statLabel}>ความชื้น</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="rainy" size={20} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.statValue}>{currentWeather.rainProb}%</Text>
                  <Text style={styles.statLabel}>ฝน</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="speedometer" size={20} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.statValue}>{Math.round(currentWeather.windSpeed)}</Text>
                  <Text style={styles.statLabel}>ลม km/h</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="thermometer" size={20} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.statValue}>{Math.round(currentWeather.apparentTemp)}°</Text>
                  <Text style={styles.statLabel}>รู้สึก</Text>
                </View>
              </View>
            </View>

            {workAdvice && (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name={workAdvice.icon} size={24} color={workAdvice.statusColor} />
                  <Text style={[styles.adviceStatus, { color: workAdvice.statusColor }]}>
                    {workAdvice.status}
                  </Text>
                </View>
                <View style={styles.adviceBox}>
                  <Text style={styles.adviceTitle}>💡 คำแนะนำ</Text>
                  <Text style={styles.adviceText}>{workAdvice.advice}</Text>
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📅 พยากรณ์ 7 วัน</Text>
              {dailyForecast.map((day) => {
                const dayWeather = getWeatherInfo(day.weatherCode);
                const dayAdvice = getWorkAdvice(day.rainProb, day.weatherCode);
                const today = isToday(day.date);
                const tomorrow = isTomorrow(day.date);

                return (
                  <View key={day.date}
                    style={[styles.forecastItem, today && styles.forecastItemToday,
                      !dayAdvice.outdoorOk && styles.forecastItemWarning]}>
                    <View style={{ width: 70 }}>
                      <Text style={[styles.forecastDay, today && { fontWeight: '800' }]}>
                        {today ? 'วันนี้' : tomorrow ? 'พรุ่งนี้' : formatDate(day.date)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name={dayWeather.icon} size={24} color={dayWeather.color} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={styles.forecastDesc} numberOfLines={1}>{dayWeather.desc}</Text>
                        <Text style={styles.forecastRain}>🌧️ {day.rainProb}%</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.forecastTemp}>
                        <Text style={{ color: '#EF4444' }}>{Math.round(day.tempMax)}°</Text>
                        <Text style={{ color: '#6B7280' }}> / </Text>
                        <Text style={{ color: '#3B82F6' }}>{Math.round(day.tempMin)}°</Text>
                      </Text>
                      {!dayAdvice.outdoorOk && (
                        <View style={styles.warningBadge}>
                          <Text style={styles.warningText}>งดกลางแจ้ง</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="cloud-offline" size={48} color="#9CA3AF" />
            <Text style={{ marginTop: 12, color: '#6B7280' }}>ไม่มีข้อมูล</Text>
            <TouchableOpacity onPress={fetchWeatherByGPS} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>ลองใหม่</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={showProvincePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เลือกจังหวัด</Text>
            <FlatList
              data={Object.keys(PROVINCE_COORDS)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem}
                  onPress={() => handleSelectProvince(item)}>
                  <Text style={[styles.modalItemText,
                    item === selectedProvince && { fontWeight: '700', color: '#0F2654' }]}>
                    {item}
                  </Text>
                  {item === selectedProvince && (
                    <Ionicons name="checkmark-circle" size={20} color="#0F2654" />
                  )}
                </TouchableOpacity>
              )} />
            <TouchableOpacity style={styles.modalCloseBtn}
              onPress={() => setShowProvincePicker(false)}>
              <Text style={styles.modalCloseBtnText}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#0F2654', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 16, marginTop: 16, elevation: 2 },
  label: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  dropdownText: { marginLeft: 10, fontSize: 15, color: '#111827', fontWeight: '600' },
  locationDetail: { marginTop: 10, backgroundColor: '#EFF6FF', padding: 10, borderRadius: 8 },
  locationDetailText: { fontSize: 13, color: '#1D4ED8' },
  weatherCard: { borderRadius: 20, padding: 20, marginHorizontal: 16, marginTop: 16, elevation: 4 },
  weatherCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weatherDate: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  weatherDesc: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 4 },
  tempContainer: { alignItems: 'center', marginVertical: 20 },
  tempMain: { fontSize: 72, fontWeight: '200', color: '#fff' },
  tempRange: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  tempItem: { alignItems: 'center', paddingHorizontal: 20 },
  tempLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  tempValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tempDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 12, paddingVertical: 14, marginTop: 10 },
  statItem: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 4 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  adviceStatus: { fontSize: 16, fontWeight: '700', marginLeft: 10 },
  adviceBox: { backgroundColor: '#F9FAFB', padding: 14, borderRadius: 12 },
  adviceTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  adviceText: { fontSize: 13, color: '#4B5563', lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  forecastItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  forecastItemToday: { backgroundColor: '#EFF6FF', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 8 },
  forecastItemWarning: { backgroundColor: '#FEF2F2' },
  forecastDay: { fontSize: 13, fontWeight: '600', color: '#374151' },
  forecastDesc: { fontSize: 12, color: '#6B7280' },
  forecastRain: { fontSize: 11, color: '#3B82F6', fontWeight: '600' },
  forecastTemp: { fontSize: 14, fontWeight: '700' },
  warningBadge: { backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  warningText: { fontSize: 9, color: '#fff', fontWeight: '600' },
  retryButton: { marginTop: 16, backgroundColor: '#0F2654', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '85%', maxHeight: '75%', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F2654', textAlign: 'center', marginBottom: 16 },
  modalItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalItemText: { fontSize: 15, color: '#374151' },
  modalCloseBtn: { backgroundColor: '#F3F4F6', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  modalCloseBtnText: { fontWeight: '700', color: '#374151' }
});