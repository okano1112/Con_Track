// db.js — FIX v7: force push หลัง createProject/createInviteCode + pull ก่อน findProjectByCode
import * as SQLite from 'expo-sqlite';
import { newUUID, now } from './utils';

let _db = null;
let _initPromise = null;

export async function getDB() {
  if (_db) return _db;
  if (_initPromise) return await _initPromise;
  _initPromise = (async () => {
    _db = await SQLite.openDatabaseAsync('contrack_v6.db');
    await _db.execAsync('PRAGMA journal_mode = WAL;');
    await _db.execAsync('PRAGMA foreign_keys = ON;');
    await initSchema(_db);
    await runMigrations(_db);
    return _db;
  })();
  return await _initPromise;
}

const cleanParam = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isNaN(v) ? 0 : v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
const cleanArray = (args) => {
  if (args.length === 1 && Array.isArray(args[0])) return args[0].map(cleanParam);
  return args.map(cleanParam);
};

export async function dbRun(sql, ...args) {
  const db = await getDB();
  return await db.runAsync(sql, ...cleanArray(args));
}
export async function dbGetFirst(sql, ...args) {
  const db = await getDB();
  return await db.getFirstAsync(sql, ...cleanArray(args));
}
export async function dbGetAll(sql, ...args) {
  const db = await getDB();
  return await db.getAllAsync(sql, ...cleanArray(args));
}

async function initSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, custom_id TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
      phone TEXT DEFAULT '', address TEXT DEFAULT '', avatar_url TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, project_code TEXT DEFAULT '',
      name TEXT NOT NULL, description TEXT DEFAULT '',
      project_type TEXT DEFAULT 'building',
      location TEXT DEFAULT '', latitude REAL, longitude REAL,
      budget REAL DEFAULT 0, contract_no TEXT DEFAULT '',
      contract_value REAL DEFAULT 0, advance_percent REAL DEFAULT 0,
      retention_percent REAL DEFAULT 5, scope_of_work TEXT DEFAULT '',
      contract_date TEXT, ntp_date TEXT, duration_days INTEGER DEFAULT 0,
      start_date TEXT, end_date TEXT, client_name TEXT DEFAULT '',
      address TEXT DEFAULT '', pm_id TEXT, progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planning', owner_id TEXT,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS project_codes (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, code TEXT UNIQUE NOT NULL,
      created_by TEXT, role TEXT DEFAULT 'member', expires_at TEXT,
      max_uses INTEGER DEFAULT 0, uses_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL, permissions TEXT DEFAULT '{}', company_name TEXT DEFAULT '',
      is_external INTEGER DEFAULT 0, joined_at TEXT, updated_at TEXT,
      sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS boq_items (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      item_no TEXT DEFAULT '', category TEXT DEFAULT '', item_name TEXT NOT NULL,
      work_type TEXT DEFAULT '', unit TEXT DEFAULT '',
      quantity REAL DEFAULT 0, unit_price REAL DEFAULT 0,
      labor_rate REAL DEFAULT 0, material_rate REAL DEFAULT 0,
      total_price REAL DEFAULT 0, note TEXT DEFAULT '', sort_order INTEGER DEFAULT 0,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, assigned_to TEXT,
      title TEXT NOT NULL, description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'todo', due_date TEXT,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS gantt_tasks (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT,
      name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      duration_days INTEGER DEFAULT 1, progress INTEGER DEFAULT 0,
      depends_on TEXT, is_milestone INTEGER DEFAULT 0, assigned_to TEXT,
      sort_order INTEGER DEFAULT 0, color TEXT DEFAULT '#3B82F6',
      notes TEXT DEFAULT '', work_type TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, uploaded_by TEXT,
      name TEXT NOT NULL, category TEXT DEFAULT 'other',
      file_url TEXT DEFAULT '', notes TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT DEFAULT '',
      nationality TEXT DEFAULT 'ไทย', gender TEXT DEFAULT 'ชาย', age INTEGER DEFAULT 0,
      daily_wage REAL DEFAULT 0, experience_years INTEGER DEFAULT 0,
      employment_status TEXT DEFAULT 'พนักงานรายวัน', phone TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS worker_records (
      id TEXT PRIMARY KEY, worker_id TEXT NOT NULL, work_type TEXT DEFAULT '',
      date TEXT, output REAL DEFAULT 0, quality REAL DEFAULT 0,
      ot_hours REAL DEFAULT 0, ot_amount REAL DEFAULT 0,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS diary_reports (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, reported_by TEXT,
      report_date TEXT NOT NULL, work_summary TEXT DEFAULT '',
      workers_count INTEGER DEFAULT 0, weather_data TEXT,
      obstacles TEXT DEFAULT '', photos TEXT DEFAULT '[]',
      progress_percent INTEGER DEFAULT 0,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS weather_logs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, diary_report_id TEXT,
      confirmed_by TEXT, event_time TEXT NOT NULL, latitude REAL, longitude REAL,
      rain_mm REAL, wind_speed REAL, temperature REAL, weather_code INTEGER,
      api_source TEXT DEFAULT 'Open-Meteo', raw_data TEXT,
      action_taken TEXT DEFAULT '', note TEXT DEFAULT '',
      created_at TEXT, sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL, action TEXT NOT NULL,
      row_id TEXT NOT NULL, payload TEXT NOT NULL,
      created_at TEXT NOT NULL, retry_count INTEGER DEFAULT 0,
      last_error TEXT DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name, row_id);
    CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
    CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(project_code);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_gantt_project ON gantt_tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_boq_project ON boq_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_code_lookup ON project_codes(code);
  `);
}

async function runMigrations(db) {
  const alters = [
    `ALTER TABLE projects ADD COLUMN project_code TEXT DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'building'`,
    `ALTER TABLE projects ADD COLUMN contract_no TEXT DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN contract_value REAL DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN advance_percent REAL DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN retention_percent REAL DEFAULT 5`,
    `ALTER TABLE projects ADD COLUMN scope_of_work TEXT DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN contract_date TEXT`,
    `ALTER TABLE projects ADD COLUMN ntp_date TEXT`,
    `ALTER TABLE projects ADD COLUMN duration_days INTEGER DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN client_name TEXT DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN address TEXT DEFAULT ''`,
    `ALTER TABLE projects ADD COLUMN pm_id TEXT`,
    `ALTER TABLE gantt_tasks ADD COLUMN work_type TEXT DEFAULT ''`,
  ];
  for (const sql of alters) {
    try { await db.execAsync(sql); } catch { /* exists */ }
  }
}

// ── sync helpers ──────────────────────────────────────────
async function enqueue(tableName, action, rowId, payload) {
  await dbRun(
    `INSERT INTO sync_queue (table_name, action, row_id, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    tableName, action, rowId, JSON.stringify(payload), now()
  );
  try { const { triggerSync } = require('./syncEngine'); triggerSync(); } catch { }
}

async function insertRow(tableName, data) {
  const row = { id: data.id || newUUID(), created_at: now(), updated_at: now(), sync_status: 'pending', ...data };
  const keys = Object.keys(row);
  await dbRun(`INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(k => row[k]));
  const { sync_status, ...cloudPayload } = row;
  await enqueue(tableName, 'insert', row.id, cloudPayload);
  return row;
}

async function updateRow(tableName, id, data) {
  const updates = { ...data, updated_at: now(), sync_status: 'pending' };
  const keys = Object.keys(updates);
  await dbRun(`UPDATE ${tableName} SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`, [...keys.map(k => updates[k]), id]);
  const { sync_status, ...cloudPayload } = updates;
  await enqueue(tableName, 'update', id, { id, ...cloudPayload });
}

async function deleteRow(tableName, id) {
  await dbRun(`DELETE FROM ${tableName} WHERE id=?`, id);
  await enqueue(tableName, 'delete', id, { id });
}

export { insertRow, updateRow, deleteRow, enqueue };

// ── Force push helper ─────────────────────────────────────
async function forcePush() {
  try {
    const { push } = require('./syncEngine');
    await push();
  } catch (e) {
    console.warn('[db] forcePush failed (network?):', e?.message);
  }
}

// ── Project Code Generator ────────────────────────────────
function generateProjectCode() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 3; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `CT-${yy}${mm}-${r}`;
}

async function generateUniqueProjectCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateProjectCode();
    const exists = await dbGetFirst('SELECT id FROM projects WHERE project_code=?', code);
    if (!exists) return code;
  }
  return `CT-${Date.now().toString(36).toUpperCase()}`;
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ✅ FIX: force push ทันทีหลังสร้าง invite code
export async function createInviteCode({ projectId, createdBy, role = 'member', expiresInDays = 30 }) {
  let code;
  for (let i = 0; i < 10; i++) {
    const c = generateInviteCode();
    const exists = await dbGetFirst('SELECT id FROM project_codes WHERE code=?', c);
    if (!exists) { code = c; break; }
  }
  if (!code) code = `INV${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const result = await insertRow('project_codes', {
    project_id: projectId, code,
    created_by: createdBy || null, role,
    expires_at: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
    max_uses: 0, uses_count: 0, is_active: 1,
  });

  // ✅ push ทันที ไม่รอ debounce
  await forcePush();
  return result;
}

// ✅ FIX: findProjectByCode — pull ก่อน + error message ชัดเจน
export async function findProjectByCode(code) {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) return { error: 'กรุณากรอกรหัส' };

  // ── Step 0: pull ข้อมูลล่าสุดจาก Supabase ก่อนค้นหา ────
  try {
    const { pull } = require('./syncEngine');
    await pull();
  } catch { /* offline */ }

  // ── Step 1: ค้น invite code ──────────────────────────────
  let invite = await dbGetFirst('SELECT * FROM project_codes WHERE code=? AND is_active=1', trimmed);

  if (!invite) {
    try {
      const { supabase } = require('./supabaseClient');
      const { data: ri, error: re } = await supabase
        .from('project_codes').select('*')
        .eq('code', trimmed).eq('is_active', true).maybeSingle();
      if (re) console.warn('[findProjectByCode] invite query error:', re.message);
      else if (ri) {
        invite = ri;
        await upsertInviteLocal(ri).catch(() => {});
      }
    } catch (e) { console.warn('[findProjectByCode] invite remote failed:', e?.message); }
  }

  if (invite) {
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return { error: 'รหัสนี้หมดอายุแล้ว กรุณาขอรหัสใหม่จากเจ้าของโครงการ' };
    if (invite.max_uses > 0 && invite.uses_count >= invite.max_uses)
      return { error: 'รหัสนี้ถูกใช้ครบจำนวนแล้ว' };

    let project = await dbGetFirst('SELECT * FROM projects WHERE id=?', invite.project_id);
    if (!project) {
      try {
        const { supabase } = require('./supabaseClient');
        const { data: rp } = await supabase.from('projects').select('*').eq('id', invite.project_id).maybeSingle();
        if (rp) { await upsertProjectLocal(rp).catch(() => {}); project = rp; }
      } catch { }
    }
    if (project) return { project, invite };
    return { error: 'พบรหัสเชิญแต่ไม่พบข้อมูลโครงการ (อาจยังไม่ sync)' };
  }

  // ── Step 2: ค้น project_code โดยตรง ────────────────────
  let project = await dbGetFirst('SELECT * FROM projects WHERE project_code=?', trimmed);
  if (!project) {
    try {
      const { supabase } = require('./supabaseClient');
      const { data: rp } = await supabase.from('projects').select('*').eq('project_code', trimmed).maybeSingle();
      if (rp) { await upsertProjectLocal(rp).catch(() => {}); project = rp; }
    } catch { }
  }
  if (project) return { project, invite: null };

  return {
    error: `ไม่พบโครงการรหัส "${trimmed}"\n\nสาเหตุที่เป็นไปได้:\n• รหัสผิด — ตรวจสอบตัวพิมพ์\n• เจ้าของยังไม่ได้กด Force Sync\n• Supabase RLS บล็อกการค้นหา (ดูคำแนะนำด้านล่าง)`,
  };
}

async function upsertProjectLocal(row) {
  const cleaned = { ...row, sync_status: 'synced' };
  for (const k of Object.keys(cleaned)) {
    if (typeof cleaned[k] === 'boolean') cleaned[k] = cleaned[k] ? 1 : 0;
    if (cleaned[k] && typeof cleaned[k] === 'object') cleaned[k] = JSON.stringify(cleaned[k]);
  }
  const keys = Object.keys(cleaned);
  await dbRun(
    `INSERT INTO projects (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${keys.map(k => `${k}=excluded.${k}`).join(',')}`,
    keys.map(k => cleaned[k])
  );
}

async function upsertInviteLocal(row) {
  const cleaned = { ...row, sync_status: 'synced' };
  for (const k of Object.keys(cleaned)) {
    if (typeof cleaned[k] === 'boolean') cleaned[k] = cleaned[k] ? 1 : 0;
  }
  const keys = Object.keys(cleaned);
  await dbRun(
    `INSERT INTO project_codes (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${keys.map(k => `${k}=excluded.${k}`).join(',')}`,
    keys.map(k => cleaned[k])
  );
}

export async function useInviteCode(inviteId, userId) {
  if (!userId) throw new Error('ต้องล็อกอินก่อน');
  const invite = await dbGetFirst('SELECT * FROM project_codes WHERE id=?', inviteId);
  if (!invite) throw new Error('ไม่พบรหัสเชิญ');

  const existing = await dbGetFirst('SELECT id FROM project_members WHERE project_id=? AND user_id=?', invite.project_id, userId);
  if (!existing) {
    await insertRow('project_members', {
      project_id: invite.project_id, user_id: userId,
      role: invite.role || 'member', permissions: '{}',
    });
  }
  await updateRow('project_codes', inviteId, { uses_count: (invite.uses_count || 0) + 1 });
  try {
    const { push, pull } = require('./syncEngine');
    await push(); await pull();
  } catch { }
  return invite.project_id;
}

// ── PROJECTS ──────────────────────────────────────────────
export async function checkProjectCodeExists(code, excludeId = null) {
  if (!code || !code.trim()) return false;
  const rows = excludeId
    ? await dbGetAll('SELECT id FROM projects WHERE project_code=? AND id!=? LIMIT 1', code.trim(), excludeId)
    : await dbGetAll('SELECT id FROM projects WHERE project_code=? LIMIT 1', code.trim());
  return rows && rows.length > 0;
}

// ✅ FIX: force push หลังสร้าง
export async function createProject(data) {
  const code = data.projectCode || data.project_code || await generateUniqueProjectCode();
  const id = data.id || newUUID();
  const owner_id = data.ownerId || data.owner_id;

  const row = await insertRow('projects', {
    id, project_code: code, name: data.name,
    description: data.description || '',
    project_type: data.projectType || data.project_type || 'building',
    location: data.location || '', latitude: data.latitude || null, longitude: data.longitude || null,
    budget: data.budget || 0, contract_no: data.contractNo || data.contract_no || '',
    contract_value: data.contractValue || data.contract_value || 0,
    advance_percent: data.advancePercent || data.advance_percent || 0,
    retention_percent: data.retentionPercent || data.retention_percent || 5,
    scope_of_work: data.scopeOfWork || data.scope_of_work || '',
    contract_date: data.contractDate || data.contract_date || null,
    ntp_date: data.ntpDate || data.ntp_date || null,
    duration_days: data.durationDays || data.duration_days || 0,
    start_date: data.startDate || data.start_date || null,
    end_date: data.endDate || data.end_date || null,
    client_name: data.clientName || data.client_name || '',
    address: data.address || '', pm_id: data.pmId || null,
    status: data.status || 'planning', progress: 0, owner_id,
  });

  if (owner_id) {
    await insertRow('project_members', { project_id: id, user_id: owner_id, role: 'owner', permissions: '{}' });
  }

  // ✅ push ทันที ไม่รอ debounce
  await forcePush();
  return row;
}

export async function updateProject(id, data) { return await updateRow('projects', id, data); }
export async function deleteProject(id) { return await deleteRow('projects', id); }

export async function getAllProjects(statusFilter) {
  let sql = `SELECT p.*, (SELECT COUNT(*) FROM tasks WHERE project_id=p.id) AS task_count, (SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status='done') AS done_count, (SELECT COUNT(*) FROM documents WHERE project_id=p.id) AS doc_count, (SELECT COUNT(*) FROM boq_items WHERE project_id=p.id) AS boq_count FROM projects p`;
  const params = [];
  if (statusFilter && statusFilter !== 'all') { sql += ' WHERE p.status=?'; params.push(statusFilter); }
  sql += ' ORDER BY p.created_at DESC';
  return await dbGetAll(sql, params);
}

export async function getProjectById(id) {
  const project = await dbGetFirst('SELECT * FROM projects WHERE id=?', id);
  if (!project) return null;
  const tasks = await dbGetAll('SELECT * FROM tasks WHERE project_id=? ORDER BY created_at DESC', id);
  const documents = await dbGetAll('SELECT * FROM documents WHERE project_id=? ORDER BY created_at DESC', id);
  const boqItems = await dbGetAll('SELECT * FROM boq_items WHERE project_id=? ORDER BY sort_order ASC, created_at ASC', id);
  return { ...project, tasks, documents, boqItems };
}

// ── BOQ ───────────────────────────────────────────────────
export async function createBOQItem(data) {
  const qty = parseFloat(data.quantity) || 0;
  const up = parseFloat(data.unitPrice) || 0;
  return await insertRow('boq_items', {
    project_id: data.projectId, item_no: data.itemNo || '', category: data.category || '',
    item_name: data.itemName, work_type: data.workType || '', unit: data.unit || '',
    quantity: qty, unit_price: up, labor_rate: parseFloat(data.laborRate) || 0,
    material_rate: parseFloat(data.materialRate) || 0, total_price: qty * up,
    note: data.note || '', sort_order: data.sortOrder || 0,
  });
}

export async function updateBOQItem(id, data) {
  const updates = { ...data };
  if (updates.quantity !== undefined || updates.unit_price !== undefined) {
    const item = await dbGetFirst('SELECT * FROM boq_items WHERE id=?', id);
    const qty = updates.quantity !== undefined ? parseFloat(updates.quantity) : item.quantity;
    const up = updates.unit_price !== undefined ? parseFloat(updates.unit_price) : item.unit_price;
    updates.total_price = qty * up;
  }
  return await updateRow('boq_items', id, updates);
}
export async function deleteBOQItem(id) { return await deleteRow('boq_items', id); }
export async function getBOQItems(projectId) {
  return await dbGetAll('SELECT * FROM boq_items WHERE project_id=? ORDER BY sort_order ASC, created_at ASC', projectId);
}

// ── GANTT ─────────────────────────────────────────────────
export async function getGanttTasks(projectId) {
  return await dbGetAll('SELECT * FROM gantt_tasks WHERE project_id=? ORDER BY sort_order ASC, start_date ASC', projectId);
}
export async function createGanttTask(data) {
  return await insertRow('gantt_tasks', {
    project_id: data.projectId, parent_id: data.parentId || null,
    name: data.name, start_date: data.startDate, end_date: data.endDate,
    duration_days: data.durationDays || 1, progress: data.progress || 0,
    depends_on: data.dependsOn || '', is_milestone: data.isMilestone ? 1 : 0,
    assigned_to: data.assignedTo || null, sort_order: data.sortOrder || 0,
    color: data.color || '#3B82F6', notes: data.notes || '', work_type: data.workType || '',
  });
}

// ── TASKS ─────────────────────────────────────────────────
export async function createTask(data) {
  return await insertRow('tasks', {
    project_id: data.projectId, assigned_to: data.assignedTo || null,
    title: data.title, description: data.description || '',
    priority: data.priority || 'medium', status: data.status || 'todo', due_date: data.dueDate || null,
  });
}
export async function toggleTask(id) {
  const task = await dbGetFirst('SELECT status FROM tasks WHERE id=?', id);
  if (!task) return;
  await updateRow('tasks', id, { status: task.status === 'done' ? 'todo' : 'done' });
}
export async function deleteTask(id) { return await deleteRow('tasks', id); }

// ── DOCUMENTS ─────────────────────────────────────────────
export async function createDocument(data) {
  return await insertRow('documents', {
    project_id: data.projectId, uploaded_by: data.uploadedBy || null,
    name: data.name, category: data.category || 'other',
    file_url: data.fileUrl || '', notes: data.notes || '',
  });
}
export async function getAllDocuments(categoryFilter, includeTaskDocs = false) {
  let sql = `SELECT d.*, p.name AS project_name FROM documents d LEFT JOIN projects p ON d.project_id = p.id`;
  const params = [], where = [];
  if (categoryFilter && categoryFilter !== 'all') { where.push('d.category = ?'); params.push(categoryFilter); }
  else if (!includeTaskDocs) { where.push("(d.category NOT LIKE 'task:%' OR d.category IS NULL)"); }
  if (where.length > 0) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY d.created_at DESC';
  return await dbGetAll(sql, params);
}
export async function deleteDocument(id) { return await deleteRow('documents', id); }

// ── WORKERS ───────────────────────────────────────────────
export async function createWorker(data) {
  return await insertRow('workers', {
    name: data.name, role: data.role || '',
    nationality: data.nationality || 'ไทย', gender: data.gender || 'ชาย',
    age: data.age || 0, daily_wage: data.dailyWage || 0,
    experience_years: data.experienceYears || 0,
    employment_status: data.employmentStatus || 'พนักงานรายวัน',
    phone: data.phone || '', avatar_url: data.avatarUrl || '',
  });
}
export async function deleteWorker(id) { return await deleteRow('workers', id); }
export async function createWorkerRecord(data) {
  return await insertRow('worker_records', {
    worker_id: data.workerId, work_type: data.workType, date: data.date,
    output: data.output || 0, quality: data.quality || 0,
    ot_hours: data.otHours || 0, ot_amount: data.otAmount || 0,
  });
}
export async function getWorkersWithRecords() {
  const workers = await dbGetAll('SELECT * FROM workers ORDER BY name ASC');
  for (const w of workers) {
    w.records = await dbGetAll('SELECT * FROM worker_records WHERE worker_id=? ORDER BY date DESC', w.id);
  }
  return workers;
}

// ── DASHBOARD ─────────────────────────────────────────────
export async function getDashboardStats() {
  const p = await dbGetFirst(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status='planning' THEN 1 ELSE 0 END) AS planning FROM projects`);
  const t = await dbGetFirst(`SELECT COUNT(*) AS total, SUM(CASE WHEN priority='urgent' AND status!='done' THEN 1 ELSE 0 END) AS urgent FROM tasks`);
  const recent = await dbGetAll('SELECT * FROM projects ORDER BY created_at DESC LIMIT 5');
  return { projects: p, tasks: t, recentProjects: recent };
}
export async function getTaskDocuments(taskId) {
  if (!taskId) return [];
  return await dbGetAll("SELECT * FROM documents WHERE category = ? ORDER BY created_at DESC", `task:${taskId}`);
}

// ── MAINTENANCE ───────────────────────────────────────────
export async function clearAllData() {
  const db = await getDB();
  await db.execAsync(`
    DELETE FROM weather_logs; DELETE FROM diary_reports; DELETE FROM worker_records;
    DELETE FROM workers; DELETE FROM documents; DELETE FROM gantt_tasks; DELETE FROM tasks;
    DELETE FROM boq_items; DELETE FROM project_codes; DELETE FROM project_members;
    DELETE FROM projects; DELETE FROM profiles; DELETE FROM sync_queue;
  `);
}

// ── PERMISSIONS ───────────────────────────────────────────
export async function getMyRoleInProject(projectId, userId) {
  if (!projectId || !userId) return null;
  const project = await dbGetFirst('SELECT owner_id FROM projects WHERE id=?', projectId);
  if (project?.owner_id === userId) return 'owner';
  const member = await dbGetFirst('SELECT role FROM project_members WHERE project_id=? AND user_id=?', projectId, userId);
  return member?.role || null;
}
export async function getProjectMembers(projectId) {
  return await dbGetAll(`SELECT pm.*, pr.full_name, pr.custom_id, pr.avatar_url, pr.phone FROM project_members pm LEFT JOIN profiles pr ON pm.user_id = pr.id WHERE pm.project_id = ? ORDER BY CASE pm.role WHEN 'owner' THEN 1 WHEN 'engineer' THEN 2 WHEN 'foreman' THEN 3 ELSE 4 END, pm.joined_at ASC`, projectId);
}
export async function updateMemberRole(memberId, newRole) { return await updateRow('project_members', memberId, { role: newRole }); }
export async function removeMember(memberId) { return await deleteRow('project_members', memberId); }
export function canPerform(role, action) {
  const perms = { owner: ['*'], engineer: ['edit_project','add_task','edit_task','delete_task','add_document','delete_document','add_boq','edit_boq','delete_boq','invite_member','edit_gantt'], foreman: ['add_task','edit_task','add_document','add_worker_record','edit_worker_record'], member: ['view_project','add_worker_record'] };
  const p = perms[role] || [];
  return p.includes('*') || p.includes(action);
}
export const ROLE_LABELS = {
  owner: { label: 'เจ้าของโครงการ', color: '#EF4444', icon: 'star' },
  engineer: { label: 'วิศวกร', color: '#3B82F6', icon: 'construct' },
  foreman: { label: 'โฟร์แมน', color: '#F59E0B', icon: 'people' },
  member: { label: 'สมาชิก', color: '#6B7280', icon: 'person' },
};