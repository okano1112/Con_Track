// criticalPath.js
// ============================================================
// Critical Path Method (CPM) + Rain Delay Analysis
// - คำนวณ Early/Late Start/Finish + Slack
// - หางานที่อยู่บน Critical Path
// - วิเคราะห์ผลกระทบเมื่อฝนตก/งานถูกบล็อก
// - แนะนำงานทดแทนที่ทำได้ในร่ม
// ============================================================

// งานกลางแจ้ง (ฝนตกทำไม่ได้)
export const OUTDOOR_WORK_KEYWORDS = [
  'เทปูน', 'โครงสร้าง', 'คสล', 'ผูกเหล็ก', 'ตั้งแบบ', 'ไม้แบบ',
  'มุงหลังคา', 'หลังคา', 'เชื่อม', 'ขุด', 'ถม', 'งานดิน',
];

// งานในร่ม (ทำได้แม้ฝนตก)
export const INDOOR_WORK_KEYWORDS = [
  'ฉาบ', 'ก่ออิฐ', 'ก่อ', 'ไฟฟ้า', 'ประปา', 'ทาสี', 'สี',
  'กระเบื้อง', 'ฝ้า', 'เพดาน', 'ไม้คร่าว', 'ประตู', 'หน้าต่าง',
];

// ============================================================
// Helpers
// ============================================================

// รองรับ depends_on ทั้งแบบ string (comma-separated UUID) และแบบ array
export function parseDependencies(task) {
  if (!task || !task.depends_on) return [];
  if (Array.isArray(task.depends_on)) return task.depends_on.filter(Boolean);
  return String(task.depends_on)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export function isOutdoorTask(task) {
  const text = `${task.name || ''} ${task.notes || ''}`.toLowerCase();
  return OUTDOOR_WORK_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

export function isIndoorTask(task) {
  const text = `${task.name || ''} ${task.notes || ''}`.toLowerCase();
  return INDOOR_WORK_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

// จำนวนวันระหว่าง 2 วันที่ (ISO string หรือ Date)
export function daysBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return Math.round((b - a) / 86400000);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================
// Topological Sort (Kahn's algorithm)
// เพื่อให้ประมวลผลตามลำดับ dependency ที่ถูกต้อง
// ============================================================

function topologicalSort(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map(tasks.map(t => [t.id, 0]));
  const adj = new Map(tasks.map(t => [t.id, []])); // parent -> [children]

  for (const t of tasks) {
    const deps = parseDependencies(t);
    for (const depId of deps) {
      if (!taskMap.has(depId)) continue;
      adj.get(depId).push(t.id);
      inDegree.set(t.id, inDegree.get(t.id) + 1);
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  const sorted = [];
  while (queue.length) {
    const id = queue.shift();
    sorted.push(taskMap.get(id));
    for (const childId of adj.get(id)) {
      inDegree.set(childId, inDegree.get(childId) - 1);
      if (inDegree.get(childId) === 0) queue.push(childId);
    }
  }

  // ถ้า sorted.length !== tasks.length → มี cycle (ข้อมูลผิด)
  if (sorted.length !== tasks.length) {
    console.warn('[CPM] Dependency cycle detected — using partial order');
    // ใส่งานที่เหลือเข้าไปตามลำดับเดิม
    const included = new Set(sorted.map(t => t.id));
    for (const t of tasks) if (!included.has(t.id)) sorted.push(t);
  }

  return sorted;
}

// ============================================================
// CPM Core — คำนวณ ES / EF / LS / LF / Slack / isCritical
// ============================================================

export function calculateCPM(rawTasks, projectStartDate) {
  if (!rawTasks || rawTasks.length === 0) {
    return { tasks: [], projectDurationDays: 0, projectStart: new Date(projectStartDate), criticalTaskIds: [] };
  }

  // copy + เติมค่า default
  const tasks = rawTasks.map(t => ({
    ...t,
    duration_days: Math.max(1, parseInt(t.duration_days) || 1),
    ES: 0, EF: 0, LS: 0, LF: 0, slack: 0, isCritical: false,
  }));

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const sorted = topologicalSort(tasks);

  // ---- Forward pass ----
  for (const t of sorted) {
    const deps = parseDependencies(t);
    if (deps.length === 0) {
      t.ES = 0;
    } else {
      t.ES = Math.max(0, ...deps.map(id => {
        const d = taskMap.get(id);
        return d ? d.EF : 0;
      }));
    }
    t.EF = t.ES + t.duration_days;
  }

  const projectDuration = Math.max(...tasks.map(t => t.EF));

  // ---- Backward pass ----
  for (const t of [...sorted].reverse()) {
    // หางานที่ depend บน t นี้
    const successors = tasks.filter(other => {
      const deps = parseDependencies(other);
      return deps.includes(t.id);
    });

    if (successors.length === 0) {
      t.LF = projectDuration; // งานปลายทาง
    } else {
      t.LF = Math.min(...successors.map(s => s.LS));
    }
    t.LS = t.LF - t.duration_days;
    t.slack = t.LS - t.ES;
    t.isCritical = t.slack === 0;
  }

  // แปลง ES/EF/LS/LF เป็นวันที่จริง
  const startDate = new Date(projectStartDate);
  for (const t of tasks) {
    t.esDate = addDays(startDate, t.ES);
    t.efDate = addDays(startDate, t.EF);
    t.lsDate = addDays(startDate, t.LS);
    t.lfDate = addDays(startDate, t.LF);
  }

  return {
    tasks,
    projectDurationDays: projectDuration,
    projectStart: startDate,
    projectEnd: addDays(startDate, projectDuration),
    criticalTaskIds: tasks.filter(t => t.isCritical).map(t => t.id),
  };
}

// ============================================================
// Rain Delay Analysis — คำนวณผลกระทบต่อโครงการ
// ============================================================

/**
 * วิเคราะห์ผลกระทบเมื่องานบางงานถูกบล็อก (เช่น ฝนตก)
 *
 * @param {Array} blockedTaskIds - id ของงานที่ถูกบล็อก
 * @param {Array} allTasks - งานทั้งหมดในโครงการ
 * @param {number} daysBlocked - จำนวนวันที่บล็อก (เช่น ฝนตก 3 วัน)
 * @param {string|Date} projectStartDate - วันเริ่มโครงการ
 * @returns {object} ผลวิเคราะห์พร้อม reasoning
 */
export function analyzeBlockImpact(blockedTaskIds, allTasks, daysBlocked, projectStartDate) {
  const cpm = calculateCPM(allTasks, projectStartDate);
  const blocked = blockedTaskIds
    .map(id => cpm.tasks.find(t => t.id === id))
    .filter(Boolean);

  if (blocked.length === 0) {
    return {
      originalDurationDays: cpm.projectDurationDays,
      newDurationDays: cpm.projectDurationDays,
      projectDelayDays: 0,
      details: [],
      criticalTasks: cpm.tasks.filter(t => t.isCritical),
      originalEndDate: cpm.projectEnd,
      newEndDate: cpm.projectEnd,
    };
  }

  // ผลกระทบต่อโครงการ = max ของ (daysBlocked − slack) ของแต่ละงาน
  let maxProjectDelay = 0;
  const details = blocked.map(t => {
    const effectiveDelay = Math.max(0, daysBlocked - t.slack);
    if (effectiveDelay > maxProjectDelay) maxProjectDelay = effectiveDelay;

    let reasoning;
    if (t.isCritical) {
      reasoning =
        `งาน "${t.name}" อยู่บน Critical Path (slack = 0 วัน) ` +
        `การถูกบล็อก ${daysBlocked} วัน ส่งผลให้โครงการยืดออกไป ${daysBlocked} วันเต็ม ` +
        `เพราะงานนี้ไม่มี "เวลาสำรอง" — ถ้าช้า 1 วัน ปลายทางช้า 1 วันทันที`;
    } else if (effectiveDelay === 0) {
      reasoning =
        `งาน "${t.name}" มี slack ${t.slack} วัน (เวลาสำรองก่อนกระทบงานถัดไป) ` +
        `การถูกบล็อก ${daysBlocked} วัน < slack ${t.slack} วัน ` +
        `→ โครงการไม่ถูกกระทบ แต่ slack จะเหลือ ${t.slack - daysBlocked} วัน (ลดลง)`;
    } else {
      reasoning =
        `งาน "${t.name}" มี slack ${t.slack} วัน ` +
        `การถูกบล็อก ${daysBlocked} วัน เกิน slack ไป ${effectiveDelay} วัน ` +
        `→ โครงการจะยืดออกไป ${effectiveDelay} วัน (${daysBlocked} − ${t.slack})`;
    }

    return {
      taskId: t.id,
      taskName: t.name,
      isCritical: t.isCritical,
      slack: t.slack,
      daysBlocked,
      effectiveDelay,
      esDate: t.esDate,
      efDate: t.efDate,
      reasoning,
    };
  });

  return {
    originalDurationDays: cpm.projectDurationDays,
    newDurationDays: cpm.projectDurationDays + maxProjectDelay,
    projectDelayDays: maxProjectDelay,
    details,
    criticalTasks: cpm.tasks.filter(t => t.isCritical),
    originalEndDate: cpm.projectEnd,
    newEndDate: addDays(cpm.projectEnd, maxProjectDelay),
    allTasks: cpm.tasks,
  };
}

// ============================================================
// Suggest Alternative Tasks — แนะนำงานทดแทน
// ============================================================

/**
 * หางานทดแทนที่ทำได้วันนี้ (งานในร่ม + dependency พร้อม)
 * เรียงลำดับ: งาน critical path > slack น้อย > ตาม ES
 *
 * @param {Array} blockedTaskIds - id งานที่ถูกบล็อก
 * @param {Array} allTasks - งานทั้งหมด
 * @param {string|Date} projectStartDate
 * @param {string|Date} today - วันนี้
 * @returns {Array} งานแนะนำพร้อมเหตุผล
 */
export function suggestAlternativeTasks(blockedTaskIds, allTasks, projectStartDate, today) {
  const cpm = calculateCPM(allTasks, projectStartDate);
  const daysFromStart = Math.max(0, daysBetween(projectStartDate, today));

  const candidates = cpm.tasks.filter(t => {
    if (blockedTaskIds.includes(t.id)) return false;
    if ((t.progress || 0) >= 100) return false;
    if (isOutdoorTask(t)) return false; // ฝนตก → ไม่เอางานกลางแจ้ง
    // dependency ต้องพร้อม — งานต้องเริ่มได้ภายในวันนี้
    if (t.ES > daysFromStart) return false;
    return true;
  });

  // เรียง: critical ก่อน → slack น้อยก่อน → ES น้อยก่อน
  candidates.sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
    if (a.slack !== b.slack) return a.slack - b.slack;
    return a.ES - b.ES;
  });

  return candidates.map(t => ({
    ...t,
    reason: t.isCritical
      ? `⭐ อยู่บน Critical Path — ทำงานนี้จะช่วยป้องกันการล่าช้าของโครงการโดยตรง`
      : t.slack <= 2
      ? `⚠️ slack เหลือน้อย (${t.slack} วัน) — ถ้าไม่เร่งอาจกลายเป็น critical path`
      : `✅ งานในร่ม ทำแทนได้ — slack ${t.slack} วัน ยืดหยุ่นพอ`,
  }));
}

// ============================================================
// Demo/Test data — ใช้เวลาไม่มี gantt_tasks จริง
// ============================================================

export function buildDemoTasksFromProject(project) {
  const start = project.ntp_date || project.start_date || new Date().toISOString().split('T')[0];
  const total = parseInt(project.duration_days) || 100;

  // แบ่งเป็น 6 phase มาตรฐาน
  const phases = [
    { id: 'demo-1', name: 'งานเตรียมพื้นที่ / ขุดดิน', ratio: 0.1 },
    { id: 'demo-2', name: 'เทฐานราก (คสล.)', ratio: 0.15, depends: ['demo-1'] },
    { id: 'demo-3', name: 'โครงสร้าง เสา-คาน-พื้น', ratio: 0.25, depends: ['demo-2'] },
    { id: 'demo-4', name: 'ก่ออิฐ ฉาบปูน', ratio: 0.2, depends: ['demo-3'] },
    { id: 'demo-5', name: 'งานระบบ ไฟฟ้า/ประปา', ratio: 0.15, depends: ['demo-3'] },
    { id: 'demo-6', name: 'งานตกแต่ง ทาสี กระเบื้อง', ratio: 0.15, depends: ['demo-4', 'demo-5'] },
  ];

  return phases.map(p => ({
    id: p.id,
    project_id: project.id,
    name: p.name,
    start_date: start,
    end_date: start,
    duration_days: Math.max(1, Math.round(total * p.ratio)),
    progress: 0,
    depends_on: (p.depends || []).join(','),
    is_milestone: 0,
  }));
}