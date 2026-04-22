// DocumentsScreen.js
// ============================================================
// หน้าเอกสาร 
// ============================================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, SafeAreaView, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabaseClient'; 
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const initialCategories = [
  { id: 'plans', name: 'แบบแปลน', icon: 'map', color: '#6366f1', documents: [] },
  { id: 'contracts', name: 'สัญญา', icon: 'file-contract', color: '#10b981', documents: [] },
  { id: 'reports', name: 'รายงาน', icon: 'clipboard-list', color: '#f59e0b', documents: [] },
  { id: 'invoices', name: 'ใบแจ้งหนี้', icon: 'file-invoice-dollar', color: '#ef4444', documents: [] },
  { id: 'photos', name: 'รูปถ่ายหน้างาน', icon: 'camera', color: '#8b5cf6', documents: [] },
  { id: 'others', name: 'อื่นๆ', icon: 'ellipsis-h', color: '#6b7280', documents: [] }
];


export default function DocumentsScreen({ navigation }) {
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [docName, setDocName] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docNote, setDocNote] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); 

  const openCategory = (category) => {
    setSelectedCategory(category);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setDocName(''); setDocNumber(''); setDocNote(''); setSelectedFile(null);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', 
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
      }
    } catch (error) {
      console.error(error);
    }
  };

 const handleAddDocument = async () => {
    if (!docName) {
      Alert.alert('แจ้งเตือน', 'กรุณาระบุชื่อเอกสาร');
      return;
    }

    try {
      // ใช้คำสั่งบันทึกชื่อที่จะใช้ร่วมกันทั้งใน Storage และ Database
      let finalFileNameForDb = 'ไม่มีไฟล์แนบ';
      let uploadedFileUrl = null;

      if (selectedFile) {
        // 1. สร้างชื่อไฟล์ที่มี timestamp กันชื่อซ้ำ
        const timestamp = Date.now();
        const fileName = `${timestamp}_${selectedFile.name}`; // ชื่อที่มีตัวเลขนำหน้า
        const filePath = `${selectedCategory.id}/${fileName}`; 
        
        // เก็บชื่อนี้ไว้บันทึกลง Database ด้วย ⭐ สำคัญมาก
        finalFileNameForDb = fileName; 

        Alert.alert('กำลังอัปโหลด', 'กรุณารอสักครู่...');

        // อ่านไฟล์แบบ Base64
        const base64File = await FileSystem.readAsStringAsync(selectedFile.uri, {
          encoding: 'base64',
        });

        // อัปโหลดขึ้น Bucket 'project_documents'
        const { error: uploadError } = await supabase.storage
          .from('project_documents')
          .upload(filePath, decode(base64File), {
            contentType: selectedFile.mimeType,
          });

        if (uploadError) throw uploadError;

        // ดึง URL
        const { data: publicUrlData } = supabase.storage
          .from('project_documents')
          .getPublicUrl(filePath);
          
        uploadedFileUrl = publicUrlData.publicUrl;
      }

      // 2. บันทึกข้อมูล (แก้ไขตรง fileName: finalFileNameForDb)
      const newDocData = {
        name: docName,
        number: docNumber || 'ไม่ระบุ',
        note: docNote,
        category: selectedCategory.id,
        fileName: finalFileNameForDb, // ✅ ชื่อจะตรงกับใน Storage
        file_url: uploadedFileUrl,
        created_at: new Date().toISOString()
      };

      const { data: insertData, error: insertError } = await supabase
        .from('documents')
        .insert([newDocData])
        .select();

      if (insertError) throw insertError;

      // 3. อัปเดตหน้าจอแอป
      const newDoc = {
        id: insertData[0].id.toString(),
        name: insertData[0].name,
        number: insertData[0].number,
        date: new Date(insertData[0].created_at).toLocaleDateString('th-TH'),
        note: insertData[0].note,
        fileName: insertData[0].fileName, // ดึงค่าที่บันทึกจริงออกมา
        fileUrl: insertData[0].file_url
      };

      setCategories(prev => prev.map(cat => {
        if (cat.id === selectedCategory.id) {
          return { ...cat, documents: [newDoc, ...cat.documents] };
        }
        return cat;
      }));

      Alert.alert('สำเร็จ', `อัปโหลดเอกสาร "${docName}" เรียบร้อยแล้ว`);
      [
          { text: 'OK', onPress: () => setModalVisible(false) } // พอกด OK ปุ๊บ ให้ปิดหน้าต่างเพิ่มเอกสารด้วย
        ]
      
      setDocName(''); setDocNumber(''); setDocNote(''); setSelectedFile(null);

    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถอัปโหลดไฟล์ได้');
    }
  };

 const deleteDocument = (docId, fileName, categoryId) => {
    Alert.alert('ยืนยันการลบ', 'คุณต้องการลบข้อมูลและไฟล์ถาวรใช่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { 
        text: 'ลบ', 
        style: 'destructive', 
        onPress: async () => {
          try {
            // 1. สร้าง Path ไปยังไฟล์ (เช่น 'photos/1776544555228.jpg')
            // categoryId คือชื่อโฟลเดอร์ใน Storage
            const filePath = `${categoryId}/${fileName}`;
            console.log("กำลังจะลบไฟล์ที่ path:", filePath);

            // 2. สั่งลบไฟล์ใน Storage (ต้องทำขั้นตอนนี้ด้วยไฟล์ถึงจะหาย)
            const { error: storageError } = await supabase.storage
              .from('project_documents')
              .remove([filePath]);

            if (storageError) {
              console.warn('ลบไฟล์ใน Storage ไม่สำเร็จ:', storageError.message);
            }

            // 3. สั่งลบแถวข้อมูลใน Database
            const { error: dbError } = await supabase
              .from('documents')
              .delete()
              .eq('id', docId);

            if (dbError) throw dbError;

            // 4. อัปเดตหน้าจอแอป
            setCategories(prev => prev.map(cat => {
              if (cat.id === categoryId) {
                return { ...cat, documents: cat.documents.filter(d => d.id !== docId) };
              }
              return cat;
            }));

            Alert.alert('สำเร็จ', 'ลบข้อมูลและไฟล์เรียบร้อยแล้ว');
          } catch (error) {
            Alert.alert('ผิดพลาด', error.message);
          }
        } 
      }
    ]);
  };

  // --- การ์ดดีไซน์ใหม่ (ชิดซ้าย, มีไอคอนวงกลม) ---
  const renderCategoryCard = (cat) => (
    <TouchableOpacity 
      key={cat.id} 
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => openCategory(cat)}
    >
      <View style={[styles.iconContainer, { backgroundColor: cat.color + '15' }]}>
        <FontAwesome5 name={cat.icon} size={22} color={cat.color} />
      </View>
      <Text style={styles.cardTitle}>{cat.name}</Text>
      <Text style={styles.cardDocCount}>{cat.documents.length} Items</Text>
    </TouchableOpacity>
  );

  return (
  <View style={styles.container}>
    
    {/* 1. Header ส่วนบน */}
    <LinearGradient colors={['#1d2f69', '#253774']} style={styles.headerBg}>
      <SafeAreaView>
        <View style={styles.topNav}>
          
          {/* ✅ ปุ่มย้อนกลับ: ย้าย onPress มาไว้ใน TouchableOpacity */}
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={() => navigation.goBack()}
          >
            <FontAwesome5 name="chevron-left" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Documents</Text>

          {/* ✅ ปุ่มแจ้งเตือน: ย้าย onPress มาไว้ใน TouchableOpacity */}
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={() => Alert.alert('การแจ้งเตือน', 'คุณไม่มีรายการใหม่ในขณะนี้')}
          >
            <FontAwesome5 name="bell" size={20} color="#fff" />
          </TouchableOpacity>
          
        </View>

        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
          <TextInput 
            placeholder="Search..." 
            placeholderTextColor="#94a3b8"
            style={styles.searchInput} 
          />
        </View>
      </SafeAreaView>
    </LinearGradient>

    {/* 2. เนื้อหาสีขาว */}
    <View style={styles.contentContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <TouchableOpacity>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {categories.map(renderCategoryCard)}
        </View>
      </ScrollView>
    </View>

    {/* 3. Modal สำหรับเพิ่ม/ดูเอกสาร */}
    <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            <FontAwesome5 name={selectedCategory?.icon} size={20} color="#8b5cf6" /> {selectedCategory?.name}
          </Text>
          <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalScroll}>
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>➕ เพิ่มเอกสารใหม่</Text>
            
            <Text style={styles.label}>ชื่อเอกสาร</Text>
            <TextInput style={styles.input} placeholder="ระบุชื่อเอกสาร" value={docName} onChangeText={setDocName} />
            
            <Text style={styles.label}>เลขที่เอกสาร</Text>
            <TextInput style={styles.input} placeholder="เช่น DOC-2024-001" value={docNumber} onChangeText={setDocNumber} />
            
            <TouchableOpacity style={[styles.uploadBtn, selectedFile ? styles.uploadBtnSuccess : null]} onPress={pickDocument}>
              <Text style={styles.uploadIcon}>{selectedFile ? '✅' : '📎'}</Text>
              <Text style={[styles.uploadTextTitle, selectedFile ? {color: '#10b981'} : null]}>
                {selectedFile ? selectedFile.name : 'คลิกเพื่อเลือกไฟล์'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddDocument}>
              <Text style={styles.submitBtnText}>เพิ่มเอกสาร</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listSection}>
            <Text style={styles.formTitle}>📋 รายการเอกสาร</Text>
            {selectedCategory?.documents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTextDesc}>ยังไม่มีเอกสารในหมวดหมู่นี้</Text>
              </View>
            ) : (
              selectedCategory?.documents.map((doc) => (
                <View key={doc.id} style={styles.docItem}>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName}>{doc.name}</Text>
                    <Text style={styles.docMeta}>📄 {doc.number}  •  📅 {doc.date}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={() => deleteDocument(doc.id, doc.fileName, selectedCategory.id)} 
                  >
                    <FontAwesome5 name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>

  </View>
);
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, // พื้นหลังล่างสุด
  
  // Header Styles
  headerBg: {
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 40, // เผื่อพื้นที่ให้ View สีขาวดึงทับ
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,                    // ✅ ให้ชื่อหน้ากินพื้นที่ตรงกลาง
    textAlign: 'center',        // ✅ จัดตัวหนังสือไว้ตรงกลาง
  },
  backButton: {
    padding: 10,                // ✅ เพิ่มพื้นที่กดให้กว้างขึ้น
  },
  notificationButton: {
    padding: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingHorizontal: 15,
    alignItems: 'center',
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
  },

  // Body / Content Styles
  contentContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -25, // ดึงขึ้นมาทับ Header ส่วนล่าง
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  seeAllText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Card Styles
  card: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 4,
  },
  cardDocCount: {
    fontSize: 13,
    color: '#94a3b8',
  },

  // Modal Styles (เก็บของเดิมไว้)
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#64748b', fontSize: 16, fontWeight: 'bold' },
  modalScroll: { padding: 20 },
  formSection: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 8, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, backgroundColor: '#f8fafc', marginBottom: 15 },
  uploadBtn: { borderWidth: 2, borderColor: '#8b5cf6', borderStyle: 'dashed', borderRadius: 12, padding: 25, alignItems: 'center', backgroundColor: '#f5f3ff', marginBottom: 15 },
  uploadBtnSuccess: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
  uploadIcon: { fontSize: 30, marginBottom: 10 },
  uploadTextTitle: { color: '#8b5cf6', fontSize: 15, fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#8b5cf6', padding: 15, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  listSection: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 40 },
  emptyState: { alignItems: 'center', padding: 20 },
  emptyTextDesc: { color: '#94a3b8', fontSize: 14 },
  docItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#f8fafc', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  docInfo: { flex: 1 },
  docName: { fontSize: 15, fontWeight: 'bold', color: '#334155', marginBottom: 4 },
  docMeta: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  docMetaFileName: { fontSize: 12, color: '#8b5cf6' },
  deleteBtn: { padding: 10, backgroundColor: '#fee2e2', borderRadius: 8 }
});