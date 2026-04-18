// BOQScreen.js
// ============================================================
// จัดการ BOQ (Bill of Quantities) + เทียบผลงานกับช่าง
// สูตรคุ้มทุน: ค่าแรง/วัน ÷ ราคาต่อหน่วย = ผลผลิตขั้นต่ำ/วัน
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Modal,
  RefreshControl, KeyboardAvoidingView, Platform, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { C, Card, Button, Input, Badge, Empty, Header } from './Components';
import {
  getBOQItems, createBOQItem, updateBOQItem, deleteBOQItem,
  getProjectById, getWorkersWithRecords
} from './db';

// หน่วยและประเภทงานที่ match กับ WorkerStatsScreen
const COMMON_UNITS = ['กก.', 'ตร.ม.', 'ลบ.ม.', 'เมตร', 'จุด', 'ชุด', 'ตัว', 'ชิ้น', 'หน่วย'];

const WORK_TYPE_MAP = {
  'ผูกเหล็ก': { unit: 'กก.', icon: 'construct-outline' },
  'เทปูน': { unit: 'ลบ.ม.', icon: 'cube-outline' },
  'โครงสร้าง คสล.': { unit: 'ลบ.ม.', icon: 'business-outline' },
  'ก่ออิฐมอญ': { unit: 'ตร.ม.', icon: 'grid-outline' },
  'ก่ออิฐบล็อก': { unit: 'ตร.ม.', icon: 'grid-outline' },
  'ก่ออิฐมวลเบา': { unit: 'ตร.ม.', icon: 'grid-outline' },
  'ฉาบปูน': { unit: 'ตร.ม.', icon: 'layers-outline' },
  'งานไม้แบบ': { unit: 'ตร.ม.', icon: 'hammer-outline' },
  'งานไฟฟ้า': { unit: 'จุด', icon: 'flash-outline' },
  'งานประปา': { unit: 'จุด', icon: 'water-outline' },
  'งานทาสี': { unit: 'ตร.ม.', icon: 'color-palette-outline' },
  'งานกระเบื้องพื้น': { unit: 'ตร.ม.', icon: 'apps-outline' },
  'งานกระเบื้องผนัง': { unit: 'ตร.ม.', icon: 'apps-outline' },
  'งานฝ้าเพดาน': { unit: 'ตร.ม.', icon: 'resize-outline' },
  'มุงหลังคาเมทัลชีท': { unit: 'ตร.ม.', icon: 'home-outline' },
  'งานเชื่อม': { unit: 'เมตร', icon: 'flame-outline' },
  'อื่นๆ': { unit: 'หน่วย', icon: 'ellipsis-horizontal-outline' },
};
const WORK_TYPES = Object.keys(WORK_TYPE_MAP);

// ============================================================
// Helpers
// ============================================================
function calcBreakEven(wage, ratePerUnit) {
  if (!wage || !ratePerUnit || ratePerUnit <= 0) return 0;
  return wage / ratePerUnit;
}

function avgWorkerOutput(workers, workType) {
  const values = [];
  workers.forEach(w => {
    (w.records || []).filter(r => r.work_type === workType).forEach(r => {
      if (r.output > 0) values.push(r.output);
    });
  });
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function avgWorkerWage(workers) {
  const wages = workers.map(w => parseFloat(w.daily_wage) || 0).filter(w => w > 0);
  if (wages.length === 0) return 350;
  return wages.reduce((a, b) => a + b, 0) / wages.length;
}

// ============================================================
// MAIN
// ============================================================
export default function BOQScreen({ route, navigation }) {
  const { projectId } = route.params;
  const [project, setProject] = useState(null);
  const [items, setItems] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('items'); // 'items' | 'compare'

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const load = async () => {
    try {
      const [p, list, ws] = await Promise.all([
        getProjectById(projectId),
        getBOQItems(projectId),
        getWorkersWithRecords(),
      ]);
      setProject(p);
      setItems(list);
      setWorkers(ws);
    } catch (e) { console.log('Load BOQ error:', e); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleDelete = (item) => {
    Alert.alert('ลบรายการ', `ลบ "${item.item_name}"?`, [
      { text: 'ยกเลิก' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          await deleteBOQItem(item.id); load();
        }
      }
    ]);
  };

  const totalValue = items.reduce((s, it) => s + (it.total_price || 0), 0);
  const totalLabor = items.reduce((s, it) => s + (it.labor_rate * it.quantity || 0), 0);
  const totalMaterial = items.reduce((s, it) => s + (it.material_rate * it.quantity || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="BOQ"
        subtitle={project?.name || 'Bill of Quantities'}
        onBack={() => navigation.goBack()}
        rightIcon="add-circle-outline"
        onRight={() => { setEditingItem(null); setShowForm(true); }} />

      {/* Tabs */}
      <View style={{
        flexDirection: 'row', backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: C.border
      }}>
        {[
          { key: 'items', label: `รายการ (${items.length})`, icon: 'list-outline' },
          { key: 'compare', label: 'เทียบกับช่าง', icon: 'swap-horizontal-outline' }
        ].map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: active ? C.primary : 'transparent'
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={t.icon} size={16}
                  color={active ? C.primary : C.textLight} />
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: active ? C.primary : C.textSec
                }}>
                  {t.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true); await load(); setRefreshing(false);
          }} />
        }>

        {tab === 'items' && (
          <ItemsTab
            items={items} totalValue={totalValue}
            totalLabor={totalLabor} totalMaterial={totalMaterial}
            onEdit={(it) => { setEditingItem(it); setShowForm(true); }}
            onDelete={handleDelete}
            onAdd={() => { setEditingItem(null); setShowForm(true); }} />
        )}

        {tab === 'compare' && (
          <CompareTab items={items} workers={workers} />
        )}
      </ScrollView>

      <BOQFormModal
        visible={showForm}
        item={editingItem}
        projectId={projectId}
        onClose={() => setShowForm(false)}
        onSaved={async () => { setShowForm(false); await load(); }} />
    </View>
  );
}

// ============================================================
// TAB: Items
// ============================================================
function ItemsTab({ items, totalValue, totalLabor, totalMaterial, onEdit, onDelete, onAdd }) {
  return (
    <View>
      {/* Summary */}
      {items.length > 0 && (
        <Card style={{ backgroundColor: C.primary, marginBottom: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 10 }}>
            มูลค่ารวมตาม BOQ
          </Text>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>
            ฿{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 10, alignItems: 'center'
            }}>
              <Text style={{ color: C.accent, fontSize: 16, fontWeight: '700' }}>
                ฿{totalLabor.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>ค่าแรง</Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 10, alignItems: 'center'
            }}>
              <Text style={{ color: '#60A5FA', fontSize: 16, fontWeight: '700' }}>
                ฿{totalMaterial.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>ค่าวัสดุ</Text>
            </View>
            <View style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 10, alignItems: 'center'
            }}>
              <Text style={{ color: '#A78BFA', fontSize: 16, fontWeight: '700' }}>
                {items.length}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>รายการ</Text>
            </View>
          </View>
        </Card>
      )}

      <Button title="เพิ่มรายการ BOQ" icon="add-circle-outline"
        onPress={onAdd} style={{ marginBottom: 16 }} />

      {items.length > 0 ? items.map(it => {
        const wt = WORK_TYPE_MAP[it.work_type];
        return (
          <Card key={it.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {wt && (
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: C.primary + '15',
                  alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2
                }}>
                  <Ionicons name={wt.icon} size={18} color={C.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {it.item_no ? (
                    <Text style={{ fontSize: 11, color: C.textLight, fontWeight: '600' }}>
                      {it.item_no}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, flex: 1 }}
                    numberOfLines={2}>
                    {it.item_name}
                  </Text>
                </View>
                {it.category ? (
                  <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                    {it.category}{it.work_type ? ` • ${it.work_type}` : ''}
                  </Text>
                ) : it.work_type ? (
                  <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
                    {it.work_type}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 12, color: C.text, fontWeight: '600' }}>
                    {it.quantity} {it.unit}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSec }}>×</Text>
                  <Text style={{ fontSize: 12, color: C.text, fontWeight: '600' }}>
                    ฿{Number(it.unit_price).toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 12, color: C.textSec }}>=</Text>
                  <Text style={{ fontSize: 13, color: C.primary, fontWeight: '800' }}>
                    ฿{Number(it.total_price).toLocaleString()}
                  </Text>
                </View>
                {it.labor_rate > 0 && (
                  <View style={{
                    flexDirection: 'row', gap: 8, marginTop: 6,
                    backgroundColor: '#FEF3C7', padding: 6, borderRadius: 6
                  }}>
                    <Text style={{ fontSize: 11, color: '#92400E' }}>
                      💪 ค่าแรง: ฿{it.labor_rate}/{it.unit}
                    </Text>
                    {it.material_rate > 0 && (
                      <Text style={{ fontSize: 11, color: '#92400E' }}>
                        📦 ฿{it.material_rate}/{it.unit}
                      </Text>
                    )}
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
                <TouchableOpacity onPress={() => onEdit(it)}>
                  <Ionicons name="create-outline" size={20} color={C.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(it)}>
                  <Ionicons name="trash-outline" size={20} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        );
      }) : (
        <Empty icon="document-text-outline" title="ยังไม่มีรายการ BOQ"
          subtitle="กดเพิ่มรายการด้านบนเพื่อเริ่มต้น" />
      )}
    </View>
  );
}

// ============================================================
// TAB: Compare (จุดคุ้มทุน)
// ============================================================
function CompareTab({ items, workers }) {
  const [customWage, setCustomWage] = useState('');
  const avgWage = avgWorkerWage(workers);
  const useWage = parseFloat(customWage) > 0 ? parseFloat(customWage) : avgWage;

  // เลือกเฉพาะ BOQ ที่มี labor_rate และ work_type
  const compareItems = items.filter(it =>
    it.labor_rate > 0 && it.work_type && it.work_type !== 'อื่นๆ'
  );

  return (
    <View>
      {/* Info card */}
      <Card style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons name="bulb-outline" size={24} color="#2563EB" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E40AF', marginBottom: 6 }}>
              วิเคราะห์จุดคุ้มทุน (Break-Even)
            </Text>
            <Text style={{ fontSize: 12, color: '#1E40AF', lineHeight: 20 }}>
              คำนวณผลผลิตขั้นต่ำที่ช่างต้องทำให้ได้/วัน เพื่อให้คุ้มค่าแรง{'\n\n'}
              <Text style={{ fontWeight: '700' }}>สูตร:</Text>{' '}
              ค่าแรง/วัน ÷ ค่าแรงต่อหน่วย (BOQ) = ผลผลิตขั้นต่ำ/วัน{'\n'}
              <Text style={{ fontSize: 11, opacity: 0.8 }}>
                เช่น ค่าแรง ฿300 ÷ ฿7/กก. = 43 กก./วัน
              </Text>
            </Text>
          </View>
        </View>
      </Card>

      {/* Wage setting */}
      <Card style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>
          ค่าแรงช่างต่อวัน (บาท)
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#F9FAFB', borderRadius: 10,
          borderWidth: 1, borderColor: C.border, paddingHorizontal: 12
        }}>
          <Ionicons name="cash-outline" size={20} color={C.primary} />
          <TextInput
            value={customWage}
            onChangeText={setCustomWage}
            placeholder={`ค่าเฉลี่ยจากช่างทั้งหมด: ${avgWage.toFixed(0)}`}
            placeholderTextColor={C.textLight}
            keyboardType="numeric"
            style={{
              flex: 1, fontSize: 16, color: C.text,
              paddingVertical: 12, marginLeft: 10, fontWeight: '600'
            }} />
          <Text style={{ color: C.textSec, fontSize: 14 }}>บ./วัน</Text>
        </View>
        <Text style={{ fontSize: 11, color: C.textSec, marginTop: 6 }}>
          ใช้ค่าปัจจุบัน: <Text style={{ fontWeight: '700', color: C.primary }}>
            ฿{useWage.toFixed(0)}/วัน
          </Text>
          {!customWage && ' (เฉลี่ยจากข้อมูลช่างที่บันทึกไว้)'}
        </Text>
      </Card>

      {/* Compare list */}
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 20, marginBottom: 10 }}>
        ผลวิเคราะห์จุดคุ้มทุน
      </Text>

      {compareItems.length > 0 ? compareItems.map(it => {
        const breakEven = calcBreakEven(useWage, it.labor_rate);
        const actualAvg = avgWorkerOutput(workers, it.work_type);
        const ratio = breakEven > 0 ? (actualAvg / breakEven) : 0;
        const profitable = actualAvg >= breakEven && actualAvg > 0;
        const hasData = actualAvg > 0;

        // profit/loss ต่อวัน
        const dailyRevenue = actualAvg * it.labor_rate;
        const dailyProfit = dailyRevenue - useWage;

        return (
          <Card key={it.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }} numberOfLines={2}>
                  {it.item_name}
                </Text>
                <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>
                  {it.work_type} • ฿{it.labor_rate}/{it.unit}
                </Text>
              </View>
              {hasData && (
                <Badge
                  label={profitable ? '✓ คุ้มค่าแรง' : '✗ ขาดทุน'}
                  color={profitable ? C.success : C.danger}
                  bg={profitable ? '#D1FAE5' : '#FEE2E2'} />
              )}
            </View>

            {/* Break-even vs actual */}
            <View style={{
              backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 10
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: C.textSec }}>จุดคุ้มทุน (ขั้นต่ำ)</Text>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#F59E0B', marginTop: 2 }}>
                    {breakEven.toFixed(1)}
                  </Text>
                  <Text style={{ fontSize: 10, color: C.textLight }}>{it.unit}/วัน</Text>
                </View>
                <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: C.textSec }}>ค่าเฉลี่ยจริง</Text>
                  <Text style={{
                    fontSize: 20, fontWeight: '800',
                    color: hasData ? (profitable ? C.success : C.danger) : C.textLight,
                    marginTop: 2
                  }}>
                    {hasData ? actualAvg.toFixed(1) : '—'}
                  </Text>
                  <Text style={{ fontSize: 10, color: C.textLight }}>
                    {hasData ? `${it.unit}/วัน` : 'ยังไม่มีข้อมูล'}
                  </Text>
                </View>
              </View>

              {/* Progress bar: แสดงสัดส่วน */}
              {hasData && (
                <>
                  <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
                    <View style={{
                      width: `${Math.min(ratio * 100, 100)}%`,
                      height: '100%',
                      backgroundColor: profitable ? C.success : C.danger,
                      borderRadius: 4
                    }} />
                  </View>
                  <Text style={{ fontSize: 11, color: C.textSec, marginTop: 6, textAlign: 'right' }}>
                    {(ratio * 100).toFixed(0)}% ของจุดคุ้มทุน
                  </Text>
                </>
              )}
            </View>

            {/* กำไร/ขาดทุน ต่อวัน */}
            {hasData && (
              <View style={{
                backgroundColor: profitable ? '#D1FAE5' : '#FEE2E2',
                padding: 10, borderRadius: 8
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{
                    fontSize: 12, fontWeight: '600',
                    color: profitable ? '#047857' : '#B91C1C'
                  }}>
                    💰 มูลค่างาน/วัน - ค่าแรง
                  </Text>
                  <Text style={{
                    fontSize: 15, fontWeight: '800',
                    color: profitable ? '#047857' : '#B91C1C'
                  }}>
                    {profitable ? '+' : ''}฿{dailyProfit.toFixed(0)}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: profitable ? '#047857' : '#B91C1C', marginTop: 2 }}>
                  {actualAvg.toFixed(1)} × ฿{it.labor_rate} = ฿{dailyRevenue.toFixed(0)}
                  {' − '}ค่าแรง ฿{useWage.toFixed(0)}
                </Text>
              </View>
            )}

            {!hasData && (
              <Text style={{
                fontSize: 12, color: C.textLight, fontStyle: 'italic',
                textAlign: 'center', paddingVertical: 6
              }}>
                ยังไม่มีข้อมูลผลผลิตของช่างใน "{it.work_type}"
              </Text>
            )}
          </Card>
        );
      }) : (
        <Card>
          <Empty icon="swap-horizontal-outline"
            title="ไม่มีข้อมูลเทียบ"
            subtitle="เพิ่มรายการ BOQ ที่มีประเภทงาน + ค่าแรงต่อหน่วย เพื่อเทียบกับผลงานช่าง" />
        </Card>
      )}
    </View>
  );
}

// ============================================================
// Modal: เพิ่ม/แก้ไข BOQ Item
// ============================================================
function BOQFormModal({ visible, item, projectId, onClose, onSaved }) {
  const [form, setForm] = useState({
    itemNo: '', category: '', itemName: '', workType: '',
    unit: '', quantity: '', unitPrice: '', laborRate: '', materialRate: '', note: ''
  });
  const [saving, setSaving] = useState(false);
  const [showWorkTypePicker, setShowWorkTypePicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  React.useEffect(() => {
    if (item) {
      setForm({
        itemNo: item.item_no || '',
        category: item.category || '',
        itemName: item.item_name || '',
        workType: item.work_type || '',
        unit: item.unit || '',
        quantity: String(item.quantity || ''),
        unitPrice: String(item.unit_price || ''),
        laborRate: String(item.labor_rate || ''),
        materialRate: String(item.material_rate || ''),
        note: item.note || '',
      });
    } else {
      setForm({
        itemNo: '', category: '', itemName: '', workType: '',
        unit: '', quantity: '', unitPrice: '', laborRate: '', materialRate: '', note: ''
      });
    }
  }, [item, visible]);

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const pickWorkType = (wt) => {
    const map = WORK_TYPE_MAP[wt];
    setForm(p => ({ ...p, workType: wt, unit: map?.unit || p.unit }));
    setShowWorkTypePicker(false);
  };

  const handleSave = async () => {
    if (!form.itemName.trim()) return Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อรายการ');
    if (!form.unit.trim()) return Alert.alert('แจ้งเตือน', 'กรุณาระบุหน่วย');
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) return Alert.alert('แจ้งเตือน', 'กรุณากรอกปริมาณ');

    setSaving(true);
    try {
      const payload = {
        projectId,
        itemNo: form.itemNo.trim(),
        category: form.category.trim(),
        itemName: form.itemName.trim(),
        workType: form.workType,
        unit: form.unit.trim(),
        quantity: qty,
        unitPrice: parseFloat(form.unitPrice) || 0,
        laborRate: parseFloat(form.laborRate) || 0,
        materialRate: parseFloat(form.materialRate) || 0,
        note: form.note.trim(),
      };
      if (item) {
        await updateBOQItem(item.id, {
          item_no: payload.itemNo, category: payload.category,
          item_name: payload.itemName, work_type: payload.workType,
          unit: payload.unit, quantity: payload.quantity,
          unit_price: payload.unitPrice, labor_rate: payload.laborRate,
          material_rate: payload.materialRate, note: payload.note,
        });
      } else {
        await createBOQItem(payload);
      }
      onSaved();
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message);
    } finally {
      setSaving(false);
    }
  };

  const qty = parseFloat(form.quantity) || 0;
  const up = parseFloat(form.unitPrice) || 0;
  const total = qty * up;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ maxHeight: '92%' }}>
          <View style={{
            backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>
                {item ? 'แก้ไขรายการ BOQ' : 'เพิ่มรายการ BOQ'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={C.textSec} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="ลำดับ/รหัส" value={form.itemNo}
                    onChangeText={v => u('itemNo', v)}
                    placeholder="เช่น 1.1.1" icon="list-outline" />
                </View>
                <View style={{ flex: 2 }}>
                  <Input label="หมวด" value={form.category}
                    onChangeText={v => u('category', v)}
                    placeholder="เช่น โครงสร้าง" icon="folder-outline" />
                </View>
              </View>

              <Input label="ชื่อรายการ *" value={form.itemName}
                onChangeText={v => u('itemName', v)}
                placeholder="เช่น เหล็กเสริม DB12" icon="document-text-outline" />

              {/* Work Type Picker */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>
                ประเภทงาน (ใช้เทียบกับช่าง)
              </Text>
              <TouchableOpacity onPress={() => setShowWorkTypePicker(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  backgroundColor: '#F9FAFB', borderRadius: 10,
                  borderWidth: 1, borderColor: C.border,
                  paddingHorizontal: 12, paddingVertical: 14, marginBottom: 16
                }}>
                <Ionicons name="construct-outline" size={18} color={C.textLight}
                  style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, fontSize: 15, color: form.workType ? C.text : C.textLight }}>
                  {form.workType || 'เลือกประเภทงาน'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={C.textSec} />
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>
                    หน่วย *
                  </Text>
                  <TouchableOpacity onPress={() => setShowUnitPicker(true)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: '#F9FAFB', borderRadius: 10,
                      borderWidth: 1, borderColor: C.border,
                      paddingHorizontal: 12, paddingVertical: 14, marginBottom: 16
                    }}>
                    <Text style={{ flex: 1, fontSize: 15, color: form.unit ? C.text : C.textLight }}>
                      {form.unit || 'เลือก'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={C.textSec} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="ปริมาณ *" value={form.quantity}
                    onChangeText={v => u('quantity', v)}
                    keyboardType="numeric" placeholder="0" icon="layers-outline" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="ราคา/หน่วย (฿)" value={form.unitPrice}
                    onChangeText={v => u('unitPrice', v)}
                    keyboardType="numeric" placeholder="0" icon="cash-outline" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="ค่าวัสดุ/หน่วย" value={form.materialRate}
                    onChangeText={v => u('materialRate', v)}
                    keyboardType="numeric" placeholder="0" icon="cube-outline" />
                </View>
              </View>

              <View style={{
                backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 10
              }}>
                <Text style={{ fontSize: 11, color: '#92400E', marginBottom: 4, fontWeight: '600' }}>
                  💡 สำคัญ: ค่าแรง/หน่วย ใช้คำนวณจุดคุ้มทุนของช่าง
                </Text>
                <Text style={{ fontSize: 10, color: '#78350F' }}>
                  เช่น ผูกเหล็ก ค่าแรง 7 บ./กก. → ช่างที่ได้ค่าแรง 300/วัน ต้องผูก ≥ 43 กก.
                </Text>
              </View>
              <Input label="ค่าแรง/หน่วย (฿)" value={form.laborRate}
                onChangeText={v => u('laborRate', v)}
                keyboardType="numeric" placeholder="เช่น 7"
                icon="hammer-outline" />

              {total > 0 && (
                <View style={{
                  backgroundColor: C.primary, padding: 12, borderRadius: 10,
                  marginBottom: 16, alignItems: 'center'
                }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>รวมเงิน</Text>
                  <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                    ฿{total.toLocaleString()}
                  </Text>
                </View>
              )}

              <Input label="หมายเหตุ" value={form.note}
                onChangeText={v => u('note', v)}
                multiline icon="chatbubble-outline" />

              <Button title={item ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
                onPress={handleSave} loading={saving} icon="checkmark-circle" />
              <Button title="ยกเลิก" variant="outline"
                onPress={onClose} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Work Type picker */}
      <Modal visible={showWorkTypePicker} transparent animationType="fade">
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: '#fff', width: '85%', maxHeight: '70%',
            borderRadius: 16, padding: 20
          }}>
            <Text style={{
              fontSize: 17, fontWeight: '700', color: C.text,
              marginBottom: 16, textAlign: 'center'
            }}>
              เลือกประเภทงาน
            </Text>
            <ScrollView>
              <TouchableOpacity onPress={() => pickWorkType('')}
                style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 15, color: C.textSec, fontStyle: 'italic' }}>
                  — ไม่ระบุ —
                </Text>
              </TouchableOpacity>
              {WORK_TYPES.map(wt => (
                <TouchableOpacity key={wt} onPress={() => pickWorkType(wt)}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'
                  }}>
                  <Ionicons name={WORK_TYPE_MAP[wt].icon} size={20} color={C.primary}
                    style={{ marginRight: 10 }} />
                  <Text style={{
                    flex: 1, fontSize: 15,
                    color: form.workType === wt ? C.primary : C.text,
                    fontWeight: form.workType === wt ? '700' : '400'
                  }}>
                    {wt}
                  </Text>
                  {form.workType === wt && (
                    <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button title="ปิด" variant="outline"
              onPress={() => setShowWorkTypePicker(false)}
              style={{ marginTop: 12 }} />
          </View>
        </View>
      </Modal>

      {/* Unit picker */}
      <Modal visible={showUnitPicker} transparent animationType="fade">
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center'
        }}>
          <View style={{
            backgroundColor: '#fff', width: '75%',
            borderRadius: 16, padding: 20
          }}>
            <Text style={{
              fontSize: 17, fontWeight: '700', color: C.text,
              marginBottom: 16, textAlign: 'center'
            }}>
              เลือกหน่วย
            </Text>
            {COMMON_UNITS.map(unit => (
              <TouchableOpacity key={unit}
                onPress={() => { u('unit', unit); setShowUnitPicker(false); }}
                style={{
                  paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
                }}>
                <Text style={{
                  fontSize: 15,
                  color: form.unit === unit ? C.primary : C.text,
                  fontWeight: form.unit === unit ? '700' : '400'
                }}>
                  {unit}
                </Text>
                {form.unit === unit && (
                  <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                )}
              </TouchableOpacity>
            ))}
            <Button title="ปิด" variant="outline"
              onPress={() => setShowUnitPicker(false)}
              style={{ marginTop: 12 }} />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}