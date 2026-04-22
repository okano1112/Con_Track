// demoData.js
// ============================================================
// ข้อมูลจำลองครบชุดสำหรับทดสอบ ConTrack
// - โครงการก่อสร้างอาคารเรียนมาตรฐาน สพฐ. ครบทุก field
// - BOQ 15 รายการ พร้อมราคาจริงตามท้องตลาด 2568
// - Gantt 12 งาน พร้อม dependencies + Critical Path
// - ช่าง 10 คน พร้อมสถิติผลงานและ Normal Curve
// - รหัสเชิญ: ADMIN01 (6 ตัว, ใช้เข้าร่วมทดสอบ)
// ============================================================

import {
  createProject, createTask, createBOQItem,
  createGanttTask, createWorker, createWorkerRecord,
  createInviteCode, dbGetFirst, clearAllData,
} from './db';

// ── ค่าคงที่ ──────────────────────────────────────────────
const DEMO_PROJECT_CODE = 'DEMO2568';   // รหัสโครงการ — ใช้ค้นหาด้วย project_code
const DEMO_INVITE_CODE  = 'ADMIN01';   // รหัสเชิญ — ใช้เข้าร่วม (6 ตัว)

export { DEMO_PROJECT_CODE, DEMO_INVITE_CODE };

// ── Helper: วันที่ ─────────────────────────────────────────
function dateISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}
function addWorkDays(startISO, days) {
  const d = new Date(startISO);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().split('T')[0];
}

// ── 1. สร้างโครงการหลัก ────────────────────────────────────
export async function seedDemoProject(ownerId) {
  const existing = await dbGetFirst("SELECT id FROM projects WHERE project_code=?", DEMO_PROJECT_CODE);
  if (existing) return existing.id;

  const ntpDate  = dateISO(-60);   // เริ่มงานไปแล้ว 60 วัน
  const endDate  = dateISO(120);   // เหลืออีก 120 วัน

  const project = await createProject({
    projectCode:    DEMO_PROJECT_CODE,
    name:           'ก่อสร้างอาคารเรียน ค.ส.ล. 2 ชั้น 8 ห้องเรียน',
    description:    'โครงการก่อสร้างอาคารเรียนมาตรฐาน สปช.105/29 ขนาด 2 ชั้น 8 ห้องเรียน พร้อมห้องน้ำ/ห้องส้วม และระบบสาธารณูปโภคครบถ้วน ตามแบบมาตรฐานของสำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน',
    projectType:    'education',
    location:       'โรงเรียนบ้านท่าขี้เหล็ก ต.ท่าข้าม อ.บ้านโป่ง จ.ราชบุรี',
    latitude:       13.8234,
    longitude:      99.8765,
    contractNo:     'สพฐ.รบ.เขต1-68-042',
    contractValue:  4850000,
    advancePercent: 15,
    retentionPercent: 5,
    scopeOfWork:    'ก่อสร้างอาคารเรียน ค.ส.ล. 2 ชั้น ขนาด 8 ห้องเรียน พื้นที่ใช้สอย 576 ตร.ม. ประกอบด้วยงานโครงสร้าง งานสถาปัตยกรรม งานระบบไฟฟ้าและแสงสว่าง งานระบบประปาและสุขาภิบาล งานครุภัณฑ์ประกอบอาคาร',
    ntpDate,
    durationDays:   180,
    startDate:      ntpDate,
    endDate,
    clientName:     'สำนักงานเขตพื้นที่การศึกษาประถมศึกษาราชบุรี เขต 1',
    address:        'ถ.สุขาภิบาล 1 ต.หน้าเมือง อ.เมือง จ.ราชบุรี 70000',
    status:         'active',
    ownerId,
  });

  const pid = project.id;

  // ── BOQ 15 รายการ (ราคาจริง 2568) ──────────────────────
  const boqData = [
    // หมวด 1: งานโครงสร้าง
    { no:'1.1', cat:'โครงสร้าง', name:'เหล็กเสริม DB12-DB25 (รวมขนส่งและสูญเสีย 5%)',
      wt:'ผูกเหล็ก', unit:'กก.', qty:48500, up:32, lr:7.5, mr:24.5 },
    { no:'1.2', cat:'โครงสร้าง', name:'คอนกรีตผสมสำเร็จ f\'c=240 ksc เทฐานราก',
      wt:'เทปูน', unit:'ลบ.ม.', qty:210, up:2850, lr:320, mr:2530 },
    { no:'1.3', cat:'โครงสร้าง', name:'คอนกรีตผสมสำเร็จ f\'c=240 ksc เทเสา-คาน-พื้น',
      wt:'โครงสร้าง คสล.', unit:'ลบ.ม.', qty:380, up:3100, lr:420, mr:2680 },
    { no:'1.4', cat:'โครงสร้าง', name:'ไม้แบบหล่อคอนกรีต (ใช้แล้วทิ้ง 2 รอบ)',
      wt:'งานไม้แบบ', unit:'ตร.ม.', qty:1440, up:320, lr:95, mr:225 },
    // หมวด 2: งานสถาปัตยกรรม
    { no:'2.1', cat:'งานก่อผนัง', name:'ก่ออิฐมวลเบา 7.5 ซม. ปูนซีเมนต์มอร์ต้าร์',
      wt:'ก่ออิฐมวลเบา', unit:'ตร.ม.', qty:2640, up:480, lr:130, mr:350 },
    { no:'2.2', cat:'งานก่อผนัง', name:'ฉาบปูนผิวเรียบ 2 ชั้น ภายในและภายนอก',
      wt:'ฉาบปูน', unit:'ตร.ม.', qty:5280, up:195, lr:65, mr:130 },
    { no:'2.3', cat:'งานพื้นผิว', name:'กระเบื้องพื้นแกรนิตโต้ 60×60 ซม. (ห้องเรียน)',
      wt:'งานกระเบื้องพื้น', unit:'ตร.ม.', qty:576, up:720, lr:195, mr:525 },
    { no:'2.4', cat:'งานพื้นผิว', name:'กระเบื้องผนัง 30×60 ซม. (ห้องน้ำ-ห้องส้วม)',
      wt:'งานกระเบื้องผนัง', unit:'ตร.ม.', qty:284, up:680, lr:185, mr:495 },
    { no:'2.5', cat:'งานพ่นสี', name:'สีน้ำภายนอก 2 ชั้น (กันน้ำ-กันรา)',
      wt:'งานทาสี', unit:'ตร.ม.', qty:1800, up:95, lr:28, mr:67 },
    { no:'2.6', cat:'งานพ่นสี', name:'สีน้ำภายใน 2 ชั้น',
      wt:'งานทาสี', unit:'ตร.ม.', qty:4200, up:75, lr:22, mr:53 },
    // หมวด 3: งานหลังคา
    { no:'3.1', cat:'หลังคา', name:'โครงหลังคาเหล็กรูปพรรณ (Truss)',
      wt:'งานเชื่อม', unit:'กก.', qty:8200, up:45, lr:8, mr:37 },
    { no:'3.2', cat:'หลังคา', name:'มุงหลังคาเมทัลชีทหนา 0.47 มม.',
      wt:'มุงหลังคาเมทัลชีท', unit:'ตร.ม.', qty:680, up:420, lr:95, mr:325 },
    { no:'3.3', cat:'หลังคา', name:'ฝ้าเพดานยิปซัม 9 มม. + โครงเคร่า',
      wt:'งานฝ้าเพดาน', unit:'ตร.ม.', qty:560, up:365, lr:110, mr:255 },
    // หมวด 4: งานระบบ
    { no:'4.1', cat:'ระบบไฟฟ้า', name:'ระบบไฟฟ้าและแสงสว่างครบชุด (8 ห้อง+โถงทางเดิน)',
      wt:'งานไฟฟ้า', unit:'จุด', qty:168, up:1950, lr:480, mr:1470 },
    { no:'4.2', cat:'ระบบประปา', name:'ระบบประปา-สุขาภิบาลครบชุด (ห้องน้ำ 4 ห้อง)',
      wt:'งานประปา', unit:'จุด', qty:52, up:2400, lr:580, mr:1820 },
  ];

  for (let i = 0; i < boqData.length; i++) {
    const b = boqData[i];
    await createBOQItem({
      projectId: pid, sortOrder: i + 1,
      itemNo: b.no, category: b.cat, itemName: b.name,
      workType: b.wt, unit: b.unit, quantity: b.qty,
      unitPrice: b.up, laborRate: b.lr, materialRate: b.mr,
    });
  }

  // ── Gantt 12 งาน พร้อม dependencies ────────────────────
  // คำนวณวันจากวันเริ่มงาน (ntpDate = 60 วันที่แล้ว)
  const g = [];
  let cursor = ntpDate;

  const ganttDef = [
    { name:'งานเตรียมพื้นที่ ถมดิน และระบบระบายน้ำ', dur:14, prog:100, color:'#6B7280', wt:'', note:'งานกลางแจ้ง: ขุดดิน ถมดินบดอัด วางท่อระบายน้ำ' },
    { name:'งานเข็มเจาะและฐานราก', dur:21, prog:100, color:'#3B82F6', wt:'เทปูน', note:'เข็มเจาะเส้นผ่าศูนย์กลาง 35 ซม. ลึก 12 ม. จำนวน 48 ต้น' },
    { name:'โครงสร้างชั้น 1 (เสา-คาน-พื้น)', dur:28, prog:85, color:'#3B82F6', wt:'โครงสร้าง คสล.', note:'ผูกเหล็ก เทปูน ถอดแบบ' },
    { name:'โครงสร้างชั้น 2 (เสา-คาน-พื้น)', dur:28, prog:45, color:'#3B82F6', wt:'โครงสร้าง คสล.', note:'ผูกเหล็ก เทปูน ถอดแบบ' },
    { name:'โครงหลังคาเหล็กและมุงหลังคา', dur:18, prog:10, color:'#8B5CF6', wt:'มุงหลังคาเมทัลชีท', note:'งานกลางแจ้ง: โครงสร้างหลังคาเหล็ก มุงเมทัลชีท' },
    { name:'งานก่ออิฐและงานฉาบปูน', dur:35, prog:20, color:'#F59E0B', wt:'ก่ออิฐมวลเบา', note:'ก่ออิฐมวลเบา ฉาบปูนภายในและภายนอก' },
    { name:'งานระบบไฟฟ้าและแสงสว่าง', dur:25, prog:5, color:'#F97316', wt:'งานไฟฟ้า', note:'ร้อยท่อ เดินสาย ติดตั้งอุปกรณ์' },
    { name:'งานระบบประปาและสุขาภิบาล', dur:20, prog:5, color:'#06B6D4', wt:'งานประปา', note:'วางท่อน้ำ ท่อทิ้ง ติดตั้งสุขภัณฑ์' },
    { name:'งานพื้นกระเบื้องและผนังกระเบื้อง', dur:22, prog:0, color:'#EC4899', wt:'งานกระเบื้องพื้น', note:'ปูกระเบื้องพื้น ติดกระเบื้องผนังห้องน้ำ' },
    { name:'งานฝ้าเพดานและงานไม้ตกแต่ง', dur:18, prog:0, color:'#A855F7', wt:'งานฝ้าเพดาน', note:'ฝ้ายิปซัม วงกบประตู-หน้าต่าง บัวพื้น-บัวเพดาน' },
    { name:'งานทาสีภายนอกและภายใน', dur:20, prog:0, color:'#10B981', wt:'งานทาสี', note:'รองพื้น 1 ชั้น ทับหน้า 2 ชั้น' },
    { name:'งานภูมิทัศน์ ทางเดิน และส่งมอบงาน', dur:14, prog:0, color:'#6B7280', wt:'', note:'ทางเดิน ถนน ปลูกต้นไม้ ทดสอบระบบ ส่งมอบ' },
  ];

  const taskIds = [];
  for (let i = 0; i < ganttDef.length; i++) {
    const def = ganttDef[i];
    const startDate = cursor;
    const endDate2 = addWorkDays(startDate, def.dur);
    const t = await createGanttTask({
      projectId: pid,
      name: def.name,
      startDate,
      endDate: endDate2,
      durationDays: def.dur,
      progress: def.prog,
      dependsOn: i > 0 ? (i <= 4 ? taskIds[i - 1] : '') : '',
      sortOrder: i + 1,
      color: def.color,
      notes: def.note,
      workType: def.wt,
    });
    taskIds.push(t.id);

    // งานถัดไปเริ่มหลังงานก่อนหน้า (เฉพาะงานที่ต่อเนื่อง)
    if (i < 4) {
      const next = new Date(endDate2);
      next.setDate(next.getDate() + 1);
      cursor = next.toISOString().split('T')[0];
    }
    // งาน 5-11 ทำคู่ขนานกับงาน 4-5
    if (i === 4) cursor = addWorkDays(dateISO(-60 + 91), 1);
  }

  // แก้ dependencies ของงานคู่ขนาน
  // งานก่อ (5) ขึ้นอยู่กับงานโครงสร้างชั้น 2 (3)
  // งานไฟฟ้า (6) + ประปา (7) ขึ้นกับงานก่อ (5)
  // งานกระเบื้อง (8) ขึ้นกับงานไฟฟ้า+ประปา
  // งานฝ้า (9) ขึ้นกับงานกระเบื้อง
  // งานสี (10) ขึ้นกับงานฝ้า
  // งานส่งมอบ (11) ขึ้นกับงานสี

  // ── Tasks สำคัญ 8 รายการ ────────────────────────────────
  const taskDefs = [
    { title:'ส่งแบบขออนุมัติก่อสร้างจากหน่วยงาน', priority:'urgent', status:'done', desc:'ส่งแบบแปลนทั้งชุด พร้อมรายการประกอบแบบ และรายการคำนวณโครงสร้าง' },
    { title:'ตรวจรับพื้นที่ก่อสร้างและรั้วชั่วคราว', priority:'high', status:'done', desc:'รับมอบพื้นที่ ล้อมรั้วชั่วคราว ทำป้ายโครงการ' },
    { title:'สั่งซื้อวัสดุหลัก: เหล็ก, ปูน, ทราย, หิน', priority:'high', status:'done', desc:'สั่งซื้อล่วงหน้า 4 สัปดาห์ ตรวจสอบคุณภาพและใบรับรอง มอก.' },
    { title:'ตรวจสอบงานเหล็กเสริมก่อนเทคอนกรีตชั้น 2', priority:'high', status:'in_progress', desc:'ตรวจเหล็กหลักและเหล็กปลอก ระยะห่าง ขนาด ความยาวฝัง วิศวกรลงชื่อรับรอง' },
    { title:'ทดสอบระบบไฟฟ้า (Insulation Test)', priority:'medium', status:'todo', desc:'ทดสอบค่าความต้านทานฉนวน ไม่น้อยกว่า 1 MΩ ทุกวงจร' },
    { title:'ทดสอบระบบประปา (Hydrostatic Test)', priority:'medium', status:'todo', desc:'ทดสอบความดัน 1.5 เท่าของความดันใช้งาน นาน 2 ชั่วโมง' },
    { title:'ส่งรายงานความก้าวหน้าประจำเดือน ก.ค. 68', priority:'medium', status:'todo', desc:'จัดทำรายงานความก้าวหน้า ส่วนงาน ปัญหาอุปสรรค แผนงานเดือนถัดไป' },
    { title:'ประชุมทบทวนแผนงาน (Look-ahead 3 สัปดาห์)', priority:'low', status:'todo', desc:'ประชุมร่วมกับโฟร์แมนและช่างหัวหน้า วางแผนการใช้ทรัพยากร' },
  ];
  for (const t of taskDefs) {
    await createTask({ projectId: pid, title: t.title, description: t.desc, priority: t.priority, status: t.status });
  }

  // ── สร้างรหัสเชิญ ADMIN01 ───────────────────────────────
  const existingCode = await dbGetFirst("SELECT id FROM project_codes WHERE code=?", DEMO_INVITE_CODE);
  if (!existingCode) {
    // insertRow โดยตรงเพื่อกำหนด code เอง
    const { insertRow } = require('./db');
    await insertRow('project_codes', {
      project_id: pid,
      code: DEMO_INVITE_CODE,
      created_by: ownerId || null,
      role: 'engineer',
      expires_at: new Date(Date.now() + 365 * 86400000).toISOString(), // 1 ปี
      max_uses: 0,
      uses_count: 0,
      is_active: 1,
    });
    // force push รหัสเชิญขึ้น Supabase ทันที
    try { const { push } = require('./syncEngine'); await push(); } catch { }
  }

  return pid;
}

// ── 2. สร้างช่าง 10 คน + สถิติผลงาน ─────────────────────
export async function seedDemoWorkers(projectId) {
  const check = await dbGetFirst("SELECT id FROM workers WHERE name='นายสมชาย ผูกเหล็กดี' LIMIT 1");
  if (check) return;

  const today = new Date();

  // ข้อมูลช่าง: [ชื่อ, ตำแหน่ง, สัญชาติ, เพศ, อายุ, ค่าแรง/วัน, ปีประสบการณ์, สถานะจ้าง, เบอร์]
  const workers = [
    // ช่างเหล็ก 2 คน
    {
      name: 'นายสมชาย ผูกเหล็กดี', role: 'ช่างเหล็ก/ผูกเหล็ก', nationality: 'ไทย',
      gender: 'ชาย', age: 38, dailyWage: 480, experienceYears: 14, employmentStatus: 'พนักงานรายวัน', phone: '0812345671',
      records: [
        { wt: 'ผูกเหล็ก', out: 218, qual: 92, otH: 2 },
        { wt: 'ผูกเหล็ก', out: 205, qual: 90, otH: 0 },
        { wt: 'ผูกเหล็ก', out: 225, qual: 94, otH: 2 },
        { wt: 'ผูกเหล็ก', out: 198, qual: 88, otH: 1 },
        { wt: 'โครงสร้าง คสล.', out: 3.4, qual: 90, otH: 0 },
      ],
    },
    {
      name: 'นายประสิทธิ์ เหล็กแกร่ง', role: 'ช่างเหล็ก/ผูกเหล็ก', nationality: 'ไทย',
      gender: 'ชาย', age: 32, dailyWage: 420, experienceYears: 8, employmentStatus: 'พนักงานรายวัน', phone: '0812345672',
      records: [
        { wt: 'ผูกเหล็ก', out: 168, qual: 82, otH: 0 },
        { wt: 'ผูกเหล็ก', out: 155, qual: 78, otH: 0 },
        { wt: 'ผูกเหล็ก', out: 182, qual: 85, otH: 2 },
        { wt: 'ผูกเหล็ก', out: 175, qual: 83, otH: 1 },
      ],
    },
    // ช่างปูน/เทปูน 2 คน
    {
      name: 'นายบุญมาก เทปูนเก่ง', role: 'ช่างปูน/เทปูน', nationality: 'ไทย',
      gender: 'ชาย', age: 45, dailyWage: 460, experienceYears: 20, employmentStatus: 'พนักงานรายวัน', phone: '0812345673',
      records: [
        { wt: 'เทปูน', out: 5.2, qual: 93, otH: 0 },
        { wt: 'เทปูน', out: 4.8, qual: 91, otH: 0 },
        { wt: 'เทปูน', out: 5.5, qual: 94, otH: 2 },
        { wt: 'โครงสร้าง คสล.', out: 3.2, qual: 92, otH: 0 },
        { wt: 'โครงสร้าง คสล.', out: 2.9, qual: 90, otH: 0 },
      ],
    },
    {
      name: 'นายอ่อง โซ่ (แรงงานเมียนมา)', role: 'ช่างปูน/เทปูน', nationality: 'เมียนมา',
      gender: 'ชาย', age: 28, dailyWage: 360, experienceYears: 5, employmentStatus: 'พนักงานรายวัน', phone: '0812345674',
      records: [
        { wt: 'เทปูน', out: 3.8, qual: 75, otH: 0 },
        { wt: 'เทปูน', out: 4.1, qual: 78, otH: 2 },
        { wt: 'ก่ออิฐมวลเบา', out: 9.5, qual: 72, otH: 0 },
        { wt: 'ก่ออิฐมวลเบา', out: 10.2, qual: 74, otH: 0 },
      ],
    },
    // ช่างฉาบ 2 คน
    {
      name: 'นางสาวสุดา ฉาบปูนเนียน', role: 'ช่างฉาบ', nationality: 'ไทย',
      gender: 'หญิง', age: 30, dailyWage: 380, experienceYears: 7, employmentStatus: 'พนักงานรายวัน', phone: '0812345675',
      records: [
        { wt: 'ฉาบปูน', out: 12.5, qual: 90, otH: 0 },
        { wt: 'ฉาบปูน', out: 11.8, qual: 88, otH: 0 },
        { wt: 'ฉาบปูน', out: 13.2, qual: 92, otH: 2 },
        { wt: 'งานทาสี', out: 44, qual: 86, otH: 0 },
      ],
    },
    {
      name: 'นายมะโยเซ็น (แรงงานเมียนมา)', role: 'ช่างก่อ', nationality: 'เมียนมา',
      gender: 'ชาย', age: 24, dailyWage: 320, experienceYears: 3, employmentStatus: 'พนักงานรายวัน', phone: '0812345676',
      records: [
        { wt: 'ก่ออิฐมวลเบา', out: 8.5, qual: 70, otH: 0 },
        { wt: 'ก่ออิฐมวลเบา', out: 7.8, qual: 68, otH: 0 },
        { wt: 'ฉาบปูน', out: 7.2, qual: 65, otH: 0 },
      ],
    },
    // ช่างกระเบื้อง 1 คน
    {
      name: 'นายวิชัย กระเบื้องเรียบ', role: 'ช่างกระเบื้อง', nationality: 'ไทย',
      gender: 'ชาย', age: 35, dailyWage: 420, experienceYears: 10, employmentStatus: 'พนักงานรายวัน', phone: '0812345677',
      records: [
        { wt: 'งานกระเบื้องพื้น', out: 10.5, qual: 92, otH: 0 },
        { wt: 'งานกระเบื้องพื้น', out: 9.8, qual: 90, otH: 0 },
        { wt: 'งานกระเบื้องผนัง', out: 6.2, qual: 88, otH: 0 },
        { wt: 'งานกระเบื้องผนัง', out: 5.8, qual: 85, otH: 2 },
      ],
    },
    // ช่างไฟฟ้า 1 คน
    {
      name: 'นายเจริญ ไฟฟ้าแสงสว่าง', role: 'ช่างไฟฟ้า', nationality: 'ไทย',
      gender: 'ชาย', age: 42, dailyWage: 550, experienceYears: 18, employmentStatus: 'พนักงานรายวัน', phone: '0812345678',
      records: [
        { wt: 'งานไฟฟ้า', out: 13, qual: 95, otH: 0 },
        { wt: 'งานไฟฟ้า', out: 12, qual: 93, otH: 0 },
        { wt: 'งานไฟฟ้า', out: 14, qual: 96, otH: 2 },
      ],
    },
    // ช่างประปา 1 คน
    {
      name: 'นายสมพร ประปาใสสะอาด', role: 'ช่างประปา', nationality: 'ไทย',
      gender: 'ชาย', age: 40, dailyWage: 500, experienceYears: 15, employmentStatus: 'พนักงานรายวัน', phone: '0812345679',
      records: [
        { wt: 'งานประปา', out: 9.5, qual: 92, otH: 0 },
        { wt: 'งานประปา', out: 10.2, qual: 90, otH: 0 },
        { wt: 'งานประปา', out: 8.8, qual: 88, otH: 0 },
      ],
    },
    // ช่างไม้/เหล็กหลังคา 1 คน
    {
      name: 'นายศักดิ์ชัย หลังคาเหล็ก', role: 'ช่างเชื่อม', nationality: 'ไทย',
      gender: 'ชาย', age: 36, dailyWage: 480, experienceYears: 12, employmentStatus: 'พนักงานรายวัน', phone: '0812345680',
      records: [
        { wt: 'งานเชื่อม', out: 22, qual: 90, otH: 2 },
        { wt: 'งานเชื่อม', out: 20, qual: 88, otH: 0 },
        { wt: 'มุงหลังคาเมทัลชีท', out: 28, qual: 86, otH: 0 },
        { wt: 'มุงหลังคาเมทัลชีท', out: 25, qual: 84, otH: 0 },
      ],
    },
  ];

  for (let wi = 0; wi < workers.length; wi++) {
    const { records, ...wData } = workers[wi];
    const w = await createWorker(wData);

    for (let ri = 0; ri < records.length; ri++) {
      const rec = records[ri];
      // วันที่ย้อนหลัง 3-45 วัน
      const daysBack = (ri + 1) * Math.ceil(45 / records.length);
      const d = new Date(today);
      d.setDate(d.getDate() - daysBack);
      const dateStr = d.toISOString().split('T')[0];

      const wage = wData.dailyWage;
      const otAmt = rec.otH > 0 ? (wage / 8) * 1.5 * rec.otH : 0;

      await createWorkerRecord({
        workerId: w.id,
        workType: rec.wt,
        date: dateStr,
        output: rec.out,
        quality: rec.qual,
        otHours: rec.otH,
        otAmount: otAmt,
      });
    }
  }
}

// ── 3. seed ทุกอย่างใน 1 ฟังก์ชัน ──────────────────────────
export async function seedAllDemoData(ownerId) {
  try {
    const projectId = await seedDemoProject(ownerId);
    await seedDemoWorkers(projectId);

    // force push ทั้งหมดขึ้น Supabase
    try {
      const { push } = require('./syncEngine');
      const result = await push();
      console.log('[Demo] Sync result:', result);
    } catch (e) {
      console.warn('[Demo] Sync failed:', e?.message);
    }

    return {
      success: true,
      projectId,
      projectCode: DEMO_PROJECT_CODE,
      inviteCode: DEMO_INVITE_CODE,
    };
  } catch (e) {
    console.error('[seedAllDemoData]', e);
    return { success: false, error: e.message };
  }
}

export async function resetAndSeedDemoData(ownerId) {
  await clearAllData();
  return await seedAllDemoData(ownerId);
}