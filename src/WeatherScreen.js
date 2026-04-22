// WeatherScreen.js
// ============================================================
// ระบบพยากรณ์อากาศหน้างาน (Open-Meteo API + Geocoding ค้นหาเขต/อำเภอ)
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Alert, Modal, FlatList, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import Location สำหรับจัดการ GPS และแปลงพิกัดเป็นชื่อสถานที่
import * as Location from 'expo-location';
// import AsyncStorage สำหรับบันทึกข้อมูลลงเครื่อง (Cache) จะได้ไม่ต้องดึง API ใหม่ทุกครั้ง
import AsyncStorage from '@react-native-async-storage/async-storage';

// สร้าง Object เก็บข้อมูลสภาพอากาศ อ้างอิงตาม WMO Weather interpretation codes ของ Open-Meteo
// เพื่อแปลงรหัสตัวเลขเป็น คำบรรยาย, ไอคอน และสีที่จะแสดงบนหน้าจอ
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

// ฟังก์ชันสำหรับแปลงรหัส weather code เป็นข้อมูลที่ใช้แสดงผล ถ้าไม่ตรงกับเงื่อนไขด้านบนเลยจะคืนค่า Default
function getWeatherInfo(code) {
  return WEATHER_CODES[code] || { desc: 'ไม่ทราบ', icon: 'help-circle', color: '#6B7280' };
}

// ============================================================
// ส่วนของการทำ Caching ข้อมูล (ลดการเรียก API ซ้ำซ้อน)
// Export สำหรับ TeamCalcScreen หรือหน้าอื่นๆ ที่ต้องการดึงข้อมูลอากาศไปใช้ต่อ
// ============================================================
export async function getWeatherForecast() {
  try {
    const cached = await AsyncStorage.getItem('weatherForecast'); // ดึงข้อมูลที่เคยเซฟไว้
    if (cached) {
      const data = JSON.parse(cached);
      // เช็คว่าข้อมูลนี้เก่าเกิน 1 ชั่วโมง (3,600,000 มิลลิวินาที) หรือยัง
      if (Date.now() - data.timestamp < 3600000) return data; // ถ้ายังไม่เก่า ให้ใช้ข้อมูลเดิม
    }
    return null; // ถ้าไม่มีข้อมูลหรือหมดอายุแล้ว คืนค่า null เพื่อไปดึง API ใหม่
  } catch (e) { return null; }
}

export async function saveWeatherForecast(data) {
  try {
    // เซฟข้อมูลลงเครื่อง พร้อมแนบ timestamp ปัจจุบันเข้าไปด้วยเพื่อใช้เช็คอายุข้อมูล
    await AsyncStorage.setItem('weatherForecast', JSON.stringify({
      ...data, timestamp: Date.now()
    }));
  } catch (e) { console.log('Save weather error:', e); }
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function WeatherScreen({ navigation }) {
  // --- การประกาศ State ต่างๆ สำหรับใช้ในหน้าจอนี้ ---
  const [loading, setLoading] = useState(false); // สถานะกำลังโหลดข้อมูล
  const [selectedProvince, setSelectedProvince] = useState('พิกัดปัจจุบัน (GPS)'); // ชื่อสถานที่ที่เลือกแสดงบนปุ่ม
  const [showProvincePicker, setShowProvincePicker] = useState(false); // ควบคุมการเปิด/ปิด Modal ค้นหาสถานที่
  const [currentWeather, setCurrentWeather] = useState(null); // เก็บข้อมูลอากาศ ณ วันนี้
  const [dailyForecast, setDailyForecast] = useState([]); // เก็บข้อมูลพยากรณ์อากาศ 7 วัน
  const [locationDetails, setLocationDetails] = useState({ // เก็บรายละเอียดที่อยู่แบบเต็ม
    province: '', district: '', subdistrict: '', fullAddress: ''
  });

  // --- State สำหรับระบบค้นหาสถานที่ ---
  const [searchQuery, setSearchQuery] = useState(''); // คำค้นหาที่พิมพ์ลงไป
  const [searchResults, setSearchResults] = useState([]); // ผลลัพธ์ที่ได้จากการค้นหา
  const [isSearching, setIsSearching] = useState(false); // สถานะกำลังค้นหาข้อมูลจาก API

  // useEffect จะทำงาน 1 ครั้งตอนเปิดหน้านี้ขึ้นมาครั้งแรก โดยสั่งให้ดึงพิกัด GPS ทันที
  useEffect(() => { fetchWeatherByGPS(); }, []);

  // ฟังก์ชันหลัก 1: ดึงตำแหน่งปัจจุบันของผู้ใช้
  const fetchWeatherByGPS = async () => {
    try {
      setLoading(true); // เริ่มหมุน Loading
      // 1. ขอสิทธิ์เข้าถึง GPS ของเครื่อง
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { // ถ้าไม่อนุญาต
        Alert.alert('ต้องการสิทธิ์', 'กรุณาเปิดสิทธิ์ GPS');
        // บังคับกำหนดพิกัดเป็นกรุงเทพฯ (Default) แทน เพื่อให้แอปทำงานต่อได้
        fetchWeatherByCoordinates(13.7563, 100.5018, 'กรุงเทพมหานคร');
        return;
      }

      // 2. ถ้าอนุญาต ก็ดึงพิกัด (ละติจูด, ลองจิจูด)
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High // เอาแบบแม่นยำสูง
      });

      // 3. แปลงพิกัดตัวเลข ให้กลายเป็นชื่อที่อยู่ (Reverse Geocoding)
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      // 4. จัดเรียงข้อมูลที่อยู่ให้สวยงาม เตรียมเซฟลง State
      const locDetails = {
        province: address?.region || address?.city || '',
        district: address?.subregion || address?.district || '',
        subdistrict: address?.street || address?.name || '',
        // เอาค่าที่มีมาต่อกันด้วยลูกน้ำ (,)
        fullAddress: [address?.name, address?.street, address?.subregion, address?.region]
          .filter(Boolean).join(', ')
      };

      setLocationDetails(locDetails);
      setSelectedProvince('พิกัดปัจจุบัน (GPS)');
      // 5. โยนพิกัดไปให้ฟังก์ชันดึงสภาพอากาศทำงานต่อ
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

  // ฟังก์ชันหลัก 2: รับพิกัดแล้วไปดึงข้อมูลพยากรณ์อากาศจาก Open-Meteo
  const fetchWeatherByCoordinates = async (lat, lon, locationName) => {
    try {
      // ต่อ String URL โดยส่งพารามิเตอร์ต่างๆ ไปให้ API เช่น ข้อมูลปัจจุบัน (current) ข้อมูลรายวัน (daily) และตั้งค่า timezone
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&timezone=Asia%2FBangkok&forecast_days=7&models=best_match`;

      const response = await fetch(url);
      const data = await response.json();

      // เช็คว่ามีข้อมูลตอบกลับมาครบไหม
      if (data.current && data.daily) {
        // จัดรูปแบบข้อมูลอากาศปัจจุบัน
        const current = {
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          apparentTemp: data.current.apparent_temperature, // อุณหภูมิที่รู้สึกจริง
          weatherCode: data.current.weather_code,
          windSpeed: data.current.wind_speed_10m,
          tempMax: data.daily.temperature_2m_max[0], // อุณหภูมิสูงสุดของวันนี้ (index 0)
          tempMin: data.daily.temperature_2m_min[0],
          rainProb: data.daily.precipitation_probability_max[0], // โอกาสเกิดฝน
          precipitation: data.daily.precipitation_sum[0]
        };
        setCurrentWeather(current);

        // จัดรูปแบบข้อมูลพยากรณ์อากาศล่วงหน้า 7 วัน (วนลูป Map ตามจำนวนวันที่ API คืนมา)
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

        // เซฟข้อมูลเก็บไว้ใน Cache เพื่อให้ดึงไปใช้หน้าอื่นได้
        await saveWeatherForecast({
          current, forecast,
          location: { lat, lon, province: locationName, ...locationDetails }
        });
      }
    } catch (error) {
      console.log('Weather API Error:', error);
      Alert.alert('ผิดพลาด', 'ไม่สามารถดึงข้อมูลสภาพอากาศได้');
    } finally {
      setLoading(false); // โหลดเสร็จแล้ว ปิด Loading
    }
  };

  // ฟังก์ชันค้นหาสถานที่ (เขต/อำเภอ/จังหวัด) จากการพิมพ์ข้อความ
  const searchLocationFromAPI = async (text) => {
    setSearchQuery(text); // อัปเดตข้อความในช่องค้นหา
    if (text.length < 2) { // ถ้าพิมพ์น้อยกว่า 2 ตัวอักษร ยังไม่ต้องยิง API (ลดภาระเซิร์ฟเวอร์)
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      // ยิง API ค้นหาชื่อเมือง (Geocoding) ของ Open-Meteo จำกัด 10 ผลลัพธ์
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(text)}&count=10&language=th&format=json`);
      const data = await res.json();
      if (data.results) {
        setSearchResults(data.results); // เก็บผลลัพธ์ลง State เตรียมแสดงใน List
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.log('Search API Error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // เมื่อผู้ใช้กดเลือกสถานที่จากผลลัพธ์การค้นหา
  const handleSelectSearchedLocation = async (item) => {
    // สร้างชื่อสถานที่ให้ดูเข้าใจง่าย เช่น "บางกะปิ, กรุงเทพมหานคร"
    const displayName = `${item.name}${item.admin1 ? `, ${item.admin1}` : ''}`;
    
    // อัปเดต State ให้ UI เปลี่ยนแปลงตามที่เลือก
    setSelectedProvince(displayName);
    setShowProvincePicker(false); // ปิด Modal ค้นหา
    setSearchQuery(''); // เคลียร์ช่องค้นหา
    setSearchResults([]); // เคลียร์ลิสต์ผลลัพธ์
    
    setLocationDetails({
      province: item.admin1 || '',
      district: item.name || '',
      subdistrict: '',
      fullAddress: displayName
    });

    setLoading(true);
    // ดึงสภาพอากาศใหม่ โดยใช้พิกัดจากสถานที่ที่ผู้ใช้จิ้มเลือก
    await fetchWeatherByCoordinates(item.latitude, item.longitude, displayName);
  };

  // ฟังก์ชันตรรกะประเมินสภาพอากาศเพื่องานก่อสร้าง (คำนวณจากโอกาสฝนตกและรหัสสภาพอากาศ)
  const getWorkAdvice = (rainProb, weatherCode) => {
    // กรณีที่ 1: ฝนตกหนักมาก (โอกาสเกิดฝน >= 70% หรือ โค้ดอากาศบอกว่าฝนตกหนัก)
    if (rainProb >= 70 || weatherCode >= 65) {
      return {
        status: 'ไม่เหมาะทำงานกลางแจ้ง', statusColor: '#EF4444', icon: 'warning',
        advice: '⛔ งดงานเทปูน, งานโครงสร้าง, มุงหลังคา\n✅ แนะนำงานในร่ม: ฉาบปูน, กระเบื้อง, ทาสี',
        outdoorOk: false
      };
    }
    // กรณีที่ 2: ฝนตกปานกลาง หรือโอกาสตก 40-69%
    if (rainProb >= 40 || (weatherCode >= 51 && weatherCode < 65)) {
      return {
        status: 'ระวังฝนตก', statusColor: '#F59E0B', icon: 'alert-circle',
        advice: '⚠️ เตรียมผ้าใบคลุมวัสดุ\n⏰ เร่งงานกลางแจ้งช่วงเช้า', outdoorOk: true
      };
    }
    // กรณีที่ 3: ปลอดโปร่ง
    return {
      status: 'เหมาะสำหรับทุกงาน', statusColor: '#10B981', icon: 'checkmark-circle',
      advice: '✅ อากาศเอื้ออำนวย เร่งงานกลางแจ้งได้เต็มกำลัง', outdoorOk: true
    };
  };

  // ฟังก์ชันแปลงวันที่แบบสากล (ISO) ให้เป็นภาษาไทยแบบย่อ
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  // Helper function ตรวจสอบว่าใช่วันนี้ หรือ พรุ่งนี้หรือไม่
  const isToday = (s) => s === new Date().toISOString().split('T')[0];
  const isTomorrow = (s) => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return s === t.toISOString().split('T')[0];
  };

  // ดึงข้อมูล UI (สี, ไอคอน, คำบรรยาย) และ คำแนะนำงานก่อสร้าง มาเก็บใส่ตัวแปรไว้รอ Render
  const weatherInfo = currentWeather ? getWeatherInfo(currentWeather.weatherCode) : null;
  const workAdvice = currentWeather ? getWorkAdvice(currentWeather.rainProb, currentWeather.weatherCode) : null;

  return (
    <View style={styles.container}>
      {/* --- ส่วน Header (มีปุ่มเมนู Drawer และปุ่ม Refresh) --- */}
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
        {/* --- Card แสดงสถานที่ปัจจุบันที่เลือกอยู่ --- */}
        <View style={styles.card}>
          <Text style={styles.label}>📍 พื้นที่ก่อสร้าง</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => {
            setShowProvincePicker(true); // กดแล้วเปิด Modal ให้ค้นหาสถานที่ใหม่
            setSearchQuery('');
            setSearchResults([]);
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons
                name={selectedProvince === 'พิกัดปัจจุบัน (GPS)' ? 'navigate' : 'location'}
                size={20}
                color={selectedProvince === 'พิกัดปัจจุบัน (GPS)' ? '#3B82F6' : '#0F2654'} />
              <Text style={styles.dropdownText} numberOfLines={1}>{selectedProvince}</Text>
            </View>
            <Ionicons name="search" size={20} color="#6B7280" />
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
          // ระหว่างดึง API ให้โชว์ Spinner หมุนๆ
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <ActivityIndicator size="large" color="#0F2654" />
            <Text style={{ marginTop: 12, color: '#6B7280' }}>กำลังดึงข้อมูล...</Text>
          </View>
        ) : currentWeather ? (
          // ถ้ามีข้อมูลสภาพอากาศ ให้แสดง UI ส่วนนี้
          <>
            {/* --- Card แสดงอุณหภูมิและสภาพอากาศวันนี้ --- */}
            <View style={[styles.weatherCard, { backgroundColor: weatherInfo.color }]}>
              {/* เปลี่ยนสีพื้นหลังอัตโนมัติตามสภาพอากาศ */}
              <View style={styles.weatherCardHeader}>
                <View>
                  <Text style={styles.weatherDate}>วันนี้ • {formatDate(new Date().toISOString().split('T')[0])}</Text>
                  <Text style={styles.weatherDesc}>{weatherInfo.desc}</Text>
                </View>
                <Ionicons name={weatherInfo.icon} size={60} color="rgba(255,255,255,0.9)" />
              </View>

              <View style={styles.tempContainer}>
                {/* อุณหภูมิปัจจุบัน */}
                <Text style={styles.tempMain}>{Math.round(currentWeather.temperature)}°</Text>
                <View style={styles.tempRange}>
                  {/* อุณหภูมิสูงสุด */}
                  <View style={styles.tempItem}>
                    <Ionicons name="arrow-up" size={16} color="#FEF3C7" />
                    <Text style={styles.tempLabel}>สูงสุด</Text>
                    <Text style={styles.tempValue}>{Math.round(currentWeather.tempMax)}°</Text>
                  </View>
                  <View style={styles.tempDivider} />
                  {/* อุณหภูมิต่ำสุด */}
                  <View style={styles.tempItem}>
                    <Ionicons name="arrow-down" size={16} color="#BFDBFE" />
                    <Text style={styles.tempLabel}>ต่ำสุด</Text>
                    <Text style={styles.tempValue}>{Math.round(currentWeather.tempMin)}°</Text>
                  </View>
                </View>
              </View>

              {/* แถบสถิติอื่นๆ (ความชื้น, โอกาสฝนตก, ความเร็วลม) */}
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

            {/* --- Card คำแนะนำการทำงาน (แสดงเฉพาะตอนที่ตัวแปร workAdvice ถูกคำนวณแล้ว) --- */}
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

            {/* --- Card พยากรณ์อากาศล่วงหน้า 7 วัน --- */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📅 พยากรณ์ 7 วัน</Text>
              {/* วนลูปสร้างรายการแต่ละวัน */}
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
                      {/* ถ้าทำงานกลางแจ้งไม่ได้ ให้โชว์ป้ายเตือนสีแดง */}
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
          // ถ้าโหลด API แล้วไม่เจอข้อมูลหรือเน็ตหลุด ให้โชว์หน้านี้พร้อมปุ่ม Retry
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="cloud-offline" size={48} color="#9CA3AF" />
            <Text style={{ marginTop: 12, color: '#6B7280' }}>ไม่มีข้อมูล</Text>
            <TouchableOpacity onPress={fetchWeatherByGPS} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>ลองใหม่</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* --- Modal สำหรับค้นหาและเลือกสถานที่ --- */}
      <Modal visible={showProvincePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>ค้นหาสถานที่ (เขต, อำเภอ)</Text>
            
            {/* ช่อง Input สำหรับพิมพ์ค้นหา */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color="#6B7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="พิมพ์ชื่อสถานที่..."
                value={searchQuery}
                onChangeText={searchLocationFromAPI} // เมื่อพิมพ์จะเรียกฟังก์ชันยิง API ค้นหา
                autoFocus={true}
              />
              {/* ปุ่ม (X) สำหรับเคลียร์ข้อความ ถ้าพิมพ์ไปแล้วอย่างน้อย 1 ตัว */}
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => searchLocationFromAPI('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* ปุ่มทางลัดสำหรับกลับไปใช้พิกัด GPS */}
            <TouchableOpacity 
              style={styles.gpsButton}
              onPress={() => {
                setShowProvincePicker(false);
                fetchWeatherByGPS();
              }}>
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.gpsButtonText}>ใช้ตำแหน่งปัจจุบัน (GPS)</Text>
            </TouchableOpacity>

            {/* การแสดงผลลัพธ์การค้นหา */}
            {isSearching ? (
              <ActivityIndicator size="small" color="#0F2654" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item, index) => index.toString()}
                style={{ marginTop: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalItem}
                    onPress={() => handleSelectSearchedLocation(item)}>
                    <View>
                      <Text style={styles.modalItemText}>{item.name}</Text>
                      {item.admin1 && <Text style={styles.modalSubItemText}>{item.admin1}, {item.country}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </TouchableOpacity>
                )}
                // ถ้าพิมพ์หาแล้วแต่ไม่เจอ (ข้อมูลเปล่า) ให้โชว์ข้อความนี้
                ListEmptyComponent={
                  searchQuery.length > 1 ? (
                    <Text style={{ textAlign: 'center', marginTop: 20, color: '#6B7280' }}>ไม่พบสถานที่ที่ค้นหา</Text>
                  ) : null
                }
              />
            )}

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