// seedSupabase.js
// ============================================================
// Seed ข้อมูลลง Supabase โดยตรง (Cloud-First)
// ข้อมูลอยู่บน cloud ถาวร — ใครใส่รหัส ADMIN01 ก็เจอทันที
// ไม่ต้อง sync ไม่ต้องรอ
//
// วิธีใช้: กดปุ่ม "🌐 สร้างข้อมูลบน Cloud" ใน ProfileScreen
// ============================================================

import { supabase } from './supabaseClient';

// ── รหัสที่ใช้เข้าร่วม (ตายตัว) ──────────────────────────
export const CLOUD_PROJECT_CODE = 'DEMO2568';  // ค้นหาด้วย project_code
export const CLOUD_INVITE_CODE  = 'ADMIN01';   // ใส่ตรงๆ ใน JoinProject

// ── UUID ตายตัว (ไม่สุ่มใหม่ทุกครั้ง ป้องกันข้อมูลซ้ำ) ──
const PID  = 'demo-project-contrack-2568-0001';
const ICID = 'demo-invite-code-admin01-00001';

// ── Helper: วันที่ ─────────────────────────────────────────
function d(offsetDays = 0) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().split('T')[0];
}
function endDate(startISO, durationDays) {
  const dt = new Date(startISO);
  dt.setDate(dt.getDate() + durationDays - 1);
  return dt.toISOString().split('T')[0];
}
const ts = () => new Date().toISOString();
function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── ตรวจว่ามีข้อมูลอยู่แล้วไหม ────────────────────────────
export async function checkCloudDataExists() {
  const { data } = await supabase.from('projects').select('id').eq('id', PID).maybeSingle();
  return !!data;
}

// ============================================================
// MAIN: seed ทุกอย่างลง Supabase โดยตรง
// ============================================================
export async function seedToSupabase(ownerId) {
  // ── 1. โครงการ ────────────────────────────────────────────
  const ntpDate = d(-60);
  const { error: pErr } = await supabase.from('projects').upsert({
    id: PID,
    project_code: CLOUD_PROJECT_CODE,
    name: 'ก่อสร้างอาคารเรียน ค.ส.ล. 2 ชั้น 8 ห้องเรียน (Demo)',
    description: 'โครงการก่อสร้างอาคารเรียนมาตรฐาน สปช.105/29 ขนาด 2 ชั้น 8 ห้องเรียน ตามแบบมาตรฐานสพฐ. สำหรับทดสอบระบบ ConTrack',
    project_type: 'education',
    location: 'โรงเรียนบ้านท่าขี้เหล็ก ต.ท่าข้าม อ.บ้านโป่ง จ.ราชบุรี',
    latitude: 13.8234,
    longitude: 99.8765,
    contract_no: 'สพฐ.รบ.เขต1-68-042',
    contract_value: 4850000,
    advance_percent: 15,
    retention_percent: 5,
    scope_of_work: 'ก่อสร้างอาคารเรียน ค.ส.ล. 2 ชั้น พื้นที่ 576 ตร.ม. งานโครงสร้าง สถาปัตยกรรม ระบบไฟฟ้า ระบบประปา ครุภัณฑ์',
    ntp_date: ntpDate,
    duration_days: 180,
    start_date: ntpDate,
    end_date: d(120),
    client_name: 'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาราชบุรี เขต 1',
    address: 'ถ.สุขาภิบาล 1 ต.หน้าเมือง อ.เมือง จ.ราชบุรี 70000',
    status: 'active',
    progress: 35,
    owner_id: ownerId || null,
    created_at: ts(),
    updated_at: ts(),
  }, { onConflict: 'id' });

  if (pErr) throw new Error('สร้างโครงการล้มเหลว: ' + pErr.message);

  // ── 2. project_member (owner) ─────────────────────────────
  if (ownerId) {
    await supabase.from('project_members').upsert({
      id: `demo-member-owner-${ownerId.slice(0, 8)}`,
      project_id: PID, user_id: ownerId,
      role: 'owner', permissions: {},
      joined_at: ts(), updated_at: ts(),
    }, { onConflict: 'id' });
  }

  // ── 3. invite code ADMIN01 ────────────────────────────────
  const { error: icErr } = await supabase.from('project_codes').upsert({
    id: ICID,
    project_id: PID,
    code: CLOUD_INVITE_CODE,
    created_by: ownerId || null,
    role: 'engineer',
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    max_uses: 0,
    uses_count: 0,
    is_active: true,
    created_at: ts(),
    updated_at: ts(),
  }, { onConflict: 'id' });

  if (icErr) console.warn('invite code error:', icErr.message);

  // ── 4. BOQ 15 รายการ ──────────────────────────────────────
  const boqRows = [
    { no:'1.1', cat:'โครงสร้าง', name:'เหล็กเสริม DB12-DB25 รวมสูญเสีย 5%',         wt:'ผูกเหล็ก',              unit:'กก.',   qty:48500, up:32,   lr:7.5,  mr:24.5 },
    { no:'1.2', cat:'โครงสร้าง', name:'คอนกรีตผสมสำเร็จ f\'c=240 ksc เทฐานราก',    wt:'เทปูน',                 unit:'ลบ.ม.', qty:210,   up:2850, lr:320,  mr:2530 },
    { no:'1.3', cat:'โครงสร้าง', name:'คอนกรีต f\'c=240 ksc เทเสา-คาน-พื้น',       wt:'โครงสร้าง คสล.',        unit:'ลบ.ม.', qty:380,   up:3100, lr:420,  mr:2680 },
    { no:'1.4', cat:'โครงสร้าง', name:'ไม้แบบหล่อคอนกรีต (2 รอบ)',                  wt:'งานไม้แบบ',             unit:'ตร.ม.', qty:1440,  up:320,  lr:95,   mr:225  },
    { no:'2.1', cat:'งานก่อผนัง', name:'ก่ออิฐมวลเบา 7.5 ซม. มอร์ต้าร์',            wt:'ก่ออิฐมวลเบา',          unit:'ตร.ม.', qty:2640,  up:480,  lr:130,  mr:350  },
    { no:'2.2', cat:'งานก่อผนัง', name:'ฉาบปูนผิวเรียบ 2 ชั้น ใน+นอก',              wt:'ฉาบปูน',                unit:'ตร.ม.', qty:5280,  up:195,  lr:65,   mr:130  },
    { no:'2.3', cat:'งานพื้นผิว', name:'กระเบื้องพื้นแกรนิตโต้ 60×60 ซม.',          wt:'งานกระเบื้องพื้น',      unit:'ตร.ม.', qty:576,   up:720,  lr:195,  mr:525  },
    { no:'2.4', cat:'งานพื้นผิว', name:'กระเบื้องผนัง 30×60 ซม. (ห้องน้ำ)',         wt:'งานกระเบื้องผนัง',      unit:'ตร.ม.', qty:284,   up:680,  lr:185,  mr:495  },
    { no:'2.5', cat:'งานสี',     name:'สีน้ำภายนอก กันน้ำ-กันรา 2 ชั้น',            wt:'งานทาสี',               unit:'ตร.ม.', qty:1800,  up:95,   lr:28,   mr:67   },
    { no:'2.6', cat:'งานสี',     name:'สีน้ำภายใน 2 ชั้น',                           wt:'งานทาสี',               unit:'ตร.ม.', qty:4200,  up:75,   lr:22,   mr:53   },
    { no:'3.1', cat:'หลังคา',    name:'โครงหลังคาเหล็กรูปพรรณ (Truss)',              wt:'งานเชื่อม',             unit:'กก.',   qty:8200,  up:45,   lr:8,    mr:37   },
    { no:'3.2', cat:'หลังคา',    name:'มุงหลังคาเมทัลชีทหนา 0.47 มม.',               wt:'มุงหลังคาเมทัลชีท',     unit:'ตร.ม.', qty:680,   up:420,  lr:95,   mr:325  },
    { no:'3.3', cat:'หลังคา',    name:'ฝ้าเพดานยิปซัม 9 มม. + โครงเคร่า',          wt:'งานฝ้าเพดาน',           unit:'ตร.ม.', qty:560,   up:365,  lr:110,  mr:255  },
    { no:'4.1', cat:'ระบบไฟฟ้า', name:'ระบบไฟฟ้า-แสงสว่างครบชุด 8 ห้อง',           wt:'งานไฟฟ้า',              unit:'จุด',   qty:168,   up:1950, lr:480,  mr:1470 },
    { no:'4.2', cat:'ระบบประปา', name:'ระบบประปา-สุขาภิบาลครบชุด ห้องน้ำ 4 ห้อง',  wt:'งานประปา',              unit:'จุด',   qty:52,    up:2400, lr:580,  mr:1820 },
  ];

  const boqInsert = boqRows.map((b, i) => ({
    id: `demo-boq-${String(i + 1).padStart(2, '0')}-2568`,
    project_id: PID, sort_order: i + 1,
    item_no: b.no, category: b.cat, item_name: b.name,
    work_type: b.wt, unit: b.unit, quantity: b.qty,
    unit_price: b.up, labor_rate: b.lr, material_rate: b.mr,
    total_price: b.qty * b.up, note: '',
    created_at: ts(), updated_at: ts(),
  }));
  const { error: boqErr } = await supabase.from('boq_items').upsert(boqInsert, { onConflict: 'id' });
  if (boqErr) console.warn('BOQ error:', boqErr.message);

  // ── 5. Gantt 12 งาน ───────────────────────────────────────
  const G = [
    { i:1,  name:'งานเตรียมพื้นที่ ถมดิน และระบบระบายน้ำ',       dur:14, prog:100, color:'#6B7280', wt:'',                    dep:'',  off:-60,  note:'ขุดดิน ถมบดอัด วางท่อระบาย' },
    { i:2,  name:'งานเข็มเจาะและฐานราก',                         dur:21, prog:100, color:'#3B82F6', wt:'เทปูน',               dep:'1',  off:-46, note:'เข็มเจาะ Ø35 ซม. ลึก 12 ม. 48 ต้น' },
    { i:3,  name:'โครงสร้างชั้น 1 (เสา-คาน-พื้น)',              dur:28, prog:85,  color:'#1D4ED8', wt:'โครงสร้าง คสล.',      dep:'2',  off:-25, note:'ผูกเหล็ก เทปูน ถอดแบบ' },
    { i:4,  name:'โครงสร้างชั้น 2 (เสา-คาน-พื้น)',              dur:28, prog:40,  color:'#1D4ED8', wt:'โครงสร้าง คสล.',      dep:'3',  off:3,   note:'ผูกเหล็ก เทปูน ถอดแบบ' },
    { i:5,  name:'โครงหลังคาเหล็กและมุงหลังคา',                  dur:18, prog:5,   color:'#7C3AED', wt:'มุงหลังคาเมทัลชีท',   dep:'4',  off:31,  note:'งานกลางแจ้ง: โครงเหล็ก มุงเมทัลชีท' },
    { i:6,  name:'งานก่ออิฐและฉาบปูนทั้งอาคาร',                 dur:35, prog:15,  color:'#D97706', wt:'ก่ออิฐมวลเบา',        dep:'4',  off:3,   note:'ก่ออิฐมวลเบา ฉาบปูนในและนอก' },
    { i:7,  name:'งานระบบไฟฟ้าและแสงสว่าง',                     dur:25, prog:5,   color:'#EA580C', wt:'งานไฟฟ้า',            dep:'6',  off:38,  note:'ร้อยท่อ เดินสาย ติดตั้งอุปกรณ์' },
    { i:8,  name:'งานระบบประปาและสุขาภิบาล',                     dur:20, prog:5,   color:'#0891B2', wt:'งานประปา',            dep:'6',  off:38,  note:'วางท่อน้ำ ท่อทิ้ง ติดสุขภัณฑ์' },
    { i:9,  name:'งานพื้น-ผนังกระเบื้อง',                        dur:22, prog:0,   color:'#DB2777', wt:'งานกระเบื้องพื้น',    dep:'8',  off:58,  note:'ปูกระเบื้องพื้น ติดกระเบื้องห้องน้ำ' },
    { i:10, name:'งานฝ้าเพดานและงานไม้ตกแต่ง',                   dur:18, prog:0,   color:'#7C3AED', wt:'งานฝ้าเพดาน',         dep:'9',  off:80,  note:'ฝ้ายิปซัม วงกบ บัวพื้น-บัวเพดาน' },
    { i:11, name:'งานทาสีทั้งอาคาร',                              dur:20, prog:0,   color:'#059669', wt:'งานทาสี',             dep:'10', off:98,  note:'รองพื้น 1 ชั้น ทับหน้า 2 ชั้น' },
    { i:12, name:'งานภูมิทัศน์และส่งมอบงาน',                     dur:14, prog:0,   color:'#374151', wt:'',                    dep:'11', off:118, note:'ทางเดิน ปลูกต้นไม้ ทดสอบระบบ ส่งมอบ' },
  ];

  // สร้าง map id สำหรับ depends_on
  const ganttIds = {};
  for (const g of G) { ganttIds[g.i] = `demo-gantt-${String(g.i).padStart(2,'0')}-2568`; }

  const ganttInsert = G.map(g => {
    const sd = d(g.off);
    const ed = endDate(sd, g.dur);
    const depId = g.dep ? ganttIds[parseInt(g.dep)] || '' : '';
    return {
      id: ganttIds[g.i],
      project_id: PID, sort_order: g.i,
      name: g.name, start_date: sd, end_date: ed,
      duration_days: g.dur, progress: g.prog,
      depends_on: depId, is_milestone: false,
      color: g.color, notes: g.note,
      work_type: g.wt, assigned_to: null,
      created_at: ts(), updated_at: ts(),
    };
  });
  const { error: ganttErr } = await supabase.from('gantt_tasks').upsert(ganttInsert, { onConflict: 'id' });
  if (ganttErr) console.warn('Gantt error:', ganttErr.message);

  // ── 6. Tasks ──────────────────────────────────────────────
  const taskDefs = [
    { title:'ส่งแบบขออนุมัติก่อสร้าง',            p:'urgent',  s:'done',        desc:'ส่งแบบแปลนชุดทั้งหมด พร้อมรายการประกอบแบบและคำนวณโครงสร้าง' },
    { title:'ตรวจรับพื้นที่และรั้วชั่วคราว',        p:'high',    s:'done',        desc:'รับมอบพื้นที่ ล้อมรั้ว ทำป้ายโครงการตามข้อกำหนด' },
    { title:'สั่งซื้อวัสดุหลัก (เหล็ก/ปูน/ทราย)',   p:'high',    s:'done',        desc:'สั่งซื้อล่วงหน้า 4 สัปดาห์ ตรวจสอบคุณภาพและใบรับรอง มอก.' },
    { title:'ตรวจสอบเหล็กก่อนเทคอนกรีตชั้น 2',    p:'high',    s:'in_progress', desc:'ตรวจเหล็กหลัก-ปลอก ระยะห่าง ขนาด ความยาวฝัง วิศวกรรับรอง' },
    { title:'ทดสอบระบบไฟฟ้า (Insulation Test)',    p:'medium',  s:'todo',        desc:'ค่าความต้านทานฉนวน ≥ 1 MΩ ทุกวงจร' },
    { title:'ทดสอบระบบประปา (Hydrostatic Test)',   p:'medium',  s:'todo',        desc:'ทดสอบความดัน 1.5 เท่าของความดันใช้งาน นาน 2 ชั่วโมง' },
    { title:'รายงานความก้าวหน้าประจำเดือน',         p:'medium',  s:'todo',        desc:'จัดทำรายงาน ส่วนงาน ปัญหาอุปสรรค แผนงานเดือนถัดไป' },
    { title:'ประชุมทบทวนแผนงาน Look-ahead 3 สัปดาห์', p:'low', s:'todo',        desc:'ประชุมร่วม PM โฟร์แมน วางแผนทรัพยากร' },
  ];
  const taskInsert = taskDefs.map((t, i) => ({
    id: `demo-task-${String(i + 1).padStart(2,'0')}-2568`,
    project_id: PID, title: t.title, description: t.desc,
    priority: t.p, status: t.s, assigned_to: null, due_date: null,
    created_at: ts(), updated_at: ts(),
  }));
  const { error: taskErr } = await supabase.from('tasks').upsert(taskInsert, { onConflict: 'id' });
  if (taskErr) console.warn('Task error:', taskErr.message);

  // ── 7. ช่าง 10 คน + สถิติ ────────────────────────────────
  // [id_suffix, ชื่อ, ตำแหน่ง, สัญชาติ, เพศ, อายุ, ค่าแรง, ปีประสบการณ์, เบอร์]
  const workerDefs = [
    ['w01', 'นายสมชาย ผูกเหล็กดี',          'ช่างเหล็ก/ผูกเหล็ก', 'ไทย',   'ชาย',  38, 480, 14, '0812345601'],
    ['w02', 'นายประสิทธิ์ เหล็กแกร่ง',       'ช่างเหล็ก/ผูกเหล็ก', 'ไทย',   'ชาย',  32, 420, 8,  '0812345602'],
    ['w03', 'นายบุญมาก เทปูนเก่ง',           'ช่างปูน/เทปูน',       'ไทย',   'ชาย',  45, 460, 20, '0812345603'],
    ['w04', 'นายอ่อง โซ่',                   'ช่างปูน/เทปูน',       'เมียนมา','ชาย',  28, 360, 5,  '0812345604'],
    ['w05', 'นางสาวสุดา ฉาบปูนเนียน',        'ช่างฉาบ',             'ไทย',   'หญิง', 30, 380, 7,  '0812345605'],
    ['w06', 'นายมะโยเซ็น ก่อดี',             'ช่างก่อ',             'เมียนมา','ชาย',  24, 320, 3,  '0812345606'],
    ['w07', 'นายวิชัย กระเบื้องเรียบ',       'ช่างกระเบื้อง',       'ไทย',   'ชาย',  35, 420, 10, '0812345607'],
    ['w08', 'นายเจริญ ไฟฟ้าแสงสว่าง',       'ช่างไฟฟ้า',           'ไทย',   'ชาย',  42, 550, 18, '0812345608'],
    ['w09', 'นายสมพร ประปาใสสะอาด',         'ช่างประปา',           'ไทย',   'ชาย',  40, 500, 15, '0812345609'],
    ['w10', 'นายศักดิ์ชัย หลังคาเหล็ก',     'ช่างเชื่อม',          'ไทย',   'ชาย',  36, 480, 12, '0812345610'],
  ];

  const workerInsert = workerDefs.map(([suf, name, role, nat, gen, age, wage, exp, phone]) => ({
    id: `demo-worker-${suf}-2568`,
    name, role, nationality: nat, gender: gen, age,
    daily_wage: wage, experience_years: exp,
    employment_status: 'พนักงานรายวัน', phone,
    avatar_url: '',
    created_at: ts(), updated_at: ts(),
  }));
  const { error: wErr } = await supabase.from('workers').upsert(workerInsert, { onConflict: 'id' });
  if (wErr) console.warn('Worker error:', wErr.message);

  // ── 8. สถิติช่าง (worker_records) ────────────────────────
  // สร้างข้อมูลย้อนหลัง 45 วัน ให้แต่ละคนมี 4-5 records
  // แต่ละ record มี work_type ที่สอดคล้องกับตำแหน่ง
  const recordDefs = [
    // ช่างเหล็ก 2 คน — ผูกเหล็ก + โครงสร้าง คสล.
    ['r01', 'w01', 'ผูกเหล็ก',           218, 92, 2,  -42],
    ['r02', 'w01', 'ผูกเหล็ก',           205, 90, 0,  -35],
    ['r03', 'w01', 'ผูกเหล็ก',           225, 94, 2,  -28],
    ['r04', 'w01', 'ผูกเหล็ก',           198, 88, 1,  -21],
    ['r05', 'w01', 'โครงสร้าง คสล.',      3.4, 90, 0,  -14],
    ['r06', 'w02', 'ผูกเหล็ก',           168, 82, 0,  -40],
    ['r07', 'w02', 'ผูกเหล็ก',           155, 78, 0,  -33],
    ['r08', 'w02', 'ผูกเหล็ก',           182, 85, 2,  -26],
    ['r09', 'w02', 'ผูกเหล็ก',           175, 83, 1,  -19],
    // ช่างปูน 2 คน — เทปูน + โครงสร้าง
    ['r10', 'w03', 'เทปูน',               5.2, 93, 0,  -44],
    ['r11', 'w03', 'เทปูน',               4.8, 91, 0,  -37],
    ['r12', 'w03', 'เทปูน',               5.5, 94, 2,  -30],
    ['r13', 'w03', 'โครงสร้าง คสล.',      3.2, 92, 0,  -23],
    ['r14', 'w03', 'โครงสร้าง คสล.',      2.9, 90, 0,  -16],
    ['r15', 'w04', 'เทปูน',               3.8, 75, 0,  -41],
    ['r16', 'w04', 'เทปูน',               4.1, 78, 2,  -34],
    ['r17', 'w04', 'ก่ออิฐมวลเบา',       9.5, 72, 0,  -27],
    ['r18', 'w04', 'ก่ออิฐมวลเบา',      10.2, 74, 0,  -20],
    // ช่างฉาบ + ก่อ
    ['r19', 'w05', 'ฉาบปูน',             12.5, 90, 0,  -38],
    ['r20', 'w05', 'ฉาบปูน',             11.8, 88, 0,  -31],
    ['r21', 'w05', 'ฉาบปูน',             13.2, 92, 2,  -24],
    ['r22', 'w05', 'งานทาสี',             44,  86, 0,  -17],
    ['r23', 'w06', 'ก่ออิฐมวลเบา',        8.5, 70, 0,  -39],
    ['r24', 'w06', 'ก่ออิฐมวลเบา',        7.8, 68, 0,  -32],
    ['r25', 'w06', 'ฉาบปูน',              7.2, 65, 0,  -25],
    // กระเบื้อง
    ['r26', 'w07', 'งานกระเบื้องพื้น',   10.5, 92, 0,  -36],
    ['r27', 'w07', 'งานกระเบื้องพื้น',    9.8, 90, 0,  -29],
    ['r28', 'w07', 'งานกระเบื้องผนัง',    6.2, 88, 0,  -22],
    ['r29', 'w07', 'งานกระเบื้องผนัง',    5.8, 85, 2,  -15],
    // ไฟฟ้า
    ['r30', 'w08', 'งานไฟฟ้า',            13,  95, 0,  -43],
    ['r31', 'w08', 'งานไฟฟ้า',            12,  93, 0,  -36],
    ['r32', 'w08', 'งานไฟฟ้า',            14,  96, 2,  -29],
    // ประปา
    ['r33', 'w09', 'งานประปา',             9.5, 92, 0,  -43],
    ['r34', 'w09', 'งานประปา',            10.2, 90, 0,  -36],
    ['r35', 'w09', 'งานประปา',             8.8, 88, 0,  -29],
    // เชื่อม+หลังคา
    ['r36', 'w10', 'งานเชื่อม',            22,  90, 2,  -42],
    ['r37', 'w10', 'งานเชื่อม',            20,  88, 0,  -35],
    ['r38', 'w10', 'มุงหลังคาเมทัลชีท',   28,  86, 0,  -28],
    ['r39', 'w10', 'มุงหลังคาเมทัลชีท',   25,  84, 0,  -21],
  ];

  const recInsert = recordDefs.map(([rid, wSuf, wt, out, qual, otH, dOff]) => {
    const wage = workerDefs.find(w => w[0] === wSuf)?.[6] || 400;
    return {
      id: `demo-record-${rid}-2568`,
      worker_id: `demo-worker-${wSuf}-2568`,
      work_type: wt, date: d(dOff),
      output: out, quality: qual,
      ot_hours: otH,
      ot_amount: otH > 0 ? (wage / 8) * 1.5 * otH : 0,
      created_at: ts(), updated_at: ts(),
    };
  });
  const { error: recErr } = await supabase.from('worker_records').upsert(recInsert, { onConflict: 'id' });
  if (recErr) console.warn('Records error:', recErr.message);

  return {
    success: true,
    projectId: PID,
    projectCode: CLOUD_PROJECT_CODE,
    inviteCode: CLOUD_INVITE_CODE,
    stats: {
      boq: boqInsert.length,
      gantt: ganttInsert.length,
      tasks: taskInsert.length,
      workers: workerInsert.length,
      records: recInsert.length,
    },
  };
}

// ── ลบข้อมูล demo ออกจาก Supabase (ถ้าต้องการ reset) ──────
export async function deleteCloudDemoData() {
  await supabase.from('worker_records').delete().like('id', '%-2568');
  await supabase.from('workers').delete().like('id', 'demo-worker-%');
  await supabase.from('tasks').delete().like('id', 'demo-task-%');
  await supabase.from('gantt_tasks').delete().like('id', 'demo-gantt-%');
  await supabase.from('boq_items').delete().like('id', 'demo-boq-%');
  await supabase.from('project_codes').delete().eq('id', ICID);
  await supabase.from('project_members').delete().like('id', 'demo-member-%');
  await supabase.from('projects').delete().eq('id', PID);
  return { success: true };
}