// db.js
// ============================================================
// Database Layer (SQLite) - Offline First
// ทุกการเขียนจะเข้า sync_queue อัตโนมัติ
// v6: เพิ่ม project_codes, boq_items, field โครงการใหม่ 4 ส่วน
// ============================================================

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

// ============================================================
// ด่านตรวจ: ดักจับ/ซ่อมแซมค่าก่อนเข้า SQLite
// ============================================================
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

// ============================================================
// SCHEMA
// ============================================================
async function initSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, custom_id TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
      phone TEXT DEFAULT '', address TEXT DEFAULT '', avatar_url TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      project_code TEXT DEFAULT '',
      name TEXT NOT NULL, description TEXT DEFAULT '',
      project_type TEXT DEFAULT 'building',
      location TEXT DEFAULT '', latitude REAL, longitude REAL,
      budget REAL DEFAULT 0,
      contract_no TEXT DEFAULT '',
      contract_value REAL DEFAULT 0,
      advance_percent REAL DEFAULT 0,
      retention_percent REAL DEFAULT 5,
      scope_of_work TEXT DEFAULT '',
      contract_date TEXT,
      ntp_date TEXT,
      duration_days INTEGER DEFAULT 0,
      start_date TEXT, end_date TEXT,
      client_name TEXT DEFAULT '',
      pm_id TEXT,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planning', owner_id TEXT,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS project_codes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_by TEXT,
      role TEXT DEFAULT 'member',
      expires_at TEXT,
      max_uses INTEGER DEFAULT 0,
      uses_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL, permissions TEXT DEFAULT '{}', company_name TEXT DEFAULT '',
      is_external INTEGER DEFAULT 0, joined_at TEXT, updated_at TEXT,
      sync_status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS boq_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      item_no TEXT DEFAULT '',
      category TEXT DEFAULT '',
      item_name TEXT NOT NULL,
      work_type TEXT DEFAULT '',
      unit TEXT DEFAULT '',
      quantity REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      labor_rate REAL DEFAULT 0,
      material_rate REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      note TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
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
      sort_order INTEGER DEFAULT 0, color TEXT DEFAULT '#3B82F6', notes TEXT DEFAULT '',
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

// Migration: เพิ่ม column ที่หายไปในฐานข้อมูลเก่า (ถ้ามี)
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
    `ALTER TABLE projects ADD COLUMN pm_id TEXT`,
  ];
  for (const sql of alters) {
    try { await db.execAsync(sql); } catch (e) { /* column exists แล้ว - ข้าม */ }
  }
}

// ============================================================
// sync helpers
// ============================================================
async function enqueue(tableName, action, rowId, payload) {
  await dbRun(
    `INSERT INTO sync_queue (table_name, action, row_id, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    tableName, action, rowId, JSON.stringify(payload), now()
  );
}

async function insertRow(tableName, data) {
  const row = {
    id: data.id || newUUID(),
    created_at: now(),
    updated_at: now(),
    sync_status: 'pending',
    ...data,
  };

  const keys = Object.keys(row);
  const placeholders = keys.map(() => '?').join(',');
  const values = keys.map(k => row[k]);

  await dbRun(`INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`, values);

  const { sync_status, ...cloudPayload } = row;
  await enqueue(tableName, 'insert', row.id, cloudPayload);
  return row;
}

async function updateRow(tableName, id, data) {
  const updates = { ...data, updated_at: now(), sync_status: 'pending' };

  const keys = Object.keys(updates);
  const setClause = keys.map(k => `${k}=?`).join(',');
  const values = [...keys.map(k => updates[k]), id];

  await dbRun(`UPDATE ${tableName} SET ${setClause} WHERE id=?`, values);

  const { sync_status, ...cloudPayload } = updates;
  await enqueue(tableName, 'update', id, { id, ...cloudPayload });
}

async function deleteRow(tableName, id) {
  await dbRun(`DELETE FROM ${tableName} WHERE id=?`, id);
  await enqueue(tableName, 'delete', id, { id });
}

export { insertRow, updateRow, deleteRow, enqueue };

// ============================================================
// PROJECT CODE GENERATOR
// ============================================================
function generateProjectCode() {
  // รูปแบบ: CT-YYMM-XXX (เช่น CT-2604-A5K)
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ตัด 0,O,1,I,l เพื่อไม่สับสน
  let random = '';
  for (let i = 0; i < 3; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CT-${yy}${mm}-${random}`;
}

async function generateUniqueProjectCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateProjectCode();
    const exists = await dbGetFirst('SELECT id FROM projects WHERE project_code=?', code);
    if (!exists) return code;
  }
  // fallback: ใส่ timestamp
  return `CT-${Date.now().toString(36).toUpperCase()}`;
}

// รหัสเชิญสั้น 6 ตัว
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createInviteCode({ projectId, createdBy, role = 'member', expiresInDays = 30 }) {
  let code;
  for (let i = 0; i < 10; i++) {
    const c = generateInviteCode();
    const exists = await dbGetFirst('SELECT id FROM project_codes WHERE code=?', c);
    if (!exists) { code = c; break; }
  }
  if (!code) code = `INV${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

  return await insertRow('project_codes', {
    project_id: projectId,
    code,
    created_by: createdBy || null,
    role,
    expires_at: expiresAt,
    max_uses: 0,
    uses_count: 0,
    is_active: 1,
  });
}

export async function findProjectByCode(code) {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) return null;

  // 1. ลองหาจาก invite code ก่อน
  const invite = await dbGetFirst(
    'SELECT * FROM project_codes WHERE code=? AND is_active=1',
    trimmed
  );
  if (invite) {
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { error: 'รหัสนี้หมดอายุแล้ว' };
    }
    if (invite.max_uses > 0 && invite.uses_count >= invite.max_uses) {
      return { error: 'รหัสนี้ถูกใช้ครบจำนวนแล้ว' };
    }
    const project = await dbGetFirst('SELECT * FROM projects WHERE id=?', invite.project_id);
    if (project) return { project, invite };
  }

  // 2. หาจาก project_code ตรงๆ
  const project = await dbGetFirst('SELECT * FROM projects WHERE project_code=?', trimmed);
  if (project) return { project, invite: null };

  return { error: 'ไม่พบโครงการที่ใช้รหัสนี้' };
}

export async function useInviteCode(inviteId, userId) {
  const invite = await dbGetFirst('SELECT * FROM project_codes WHERE id=?', inviteId);
  if (!invite) throw new Error('ไม่พบรหัสเชิญ');

  // เพิ่ม member (ถ้ายังไม่มี)
  const existing = await dbGetFirst(
    'SELECT id FROM project_members WHERE project_id=? AND user_id=?',
    invite.project_id, userId
  );
  if (!existing) {
    await insertRow('project_members', {
      project_id: invite.project_id,
      user_id: userId,
      role: invite.role || 'member',
      permissions: '{}',
    });
  }

  // update uses_count
  await updateRow('project_codes', inviteId, {
    uses_count: (invite.uses_count || 0) + 1,
  });

  return invite.project_id;
}

// ============================================================
// PROJECTS
// ============================================================
export async function createProject(data) {
  const code = data.projectCode || await generateUniqueProjectCode();
  return await insertRow('projects', {
    project_code: code,
    name: data.name,
    description: data.description || '',
    project_type: data.projectType || 'building',
    location: data.location || '',
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    budget: data.budget || 0,
    contract_no: data.contractNo || '',
    contract_value: data.contractValue || 0,
    advance_percent: data.advancePercent || 0,
    retention_percent: data.retentionPercent || 5,
    scope_of_work: data.scopeOfWork || '',
    contract_date: data.contractDate || null,
    ntp_date: data.ntpDate || null,
    duration_days: data.durationDays || 0,
    start_date: data.startDate || null,
    end_date: data.endDate || null,
    client_name: data.clientName || '',
    pm_id: data.pmId || null,
    status: data.status || 'planning',
    progress: 0,
    owner_id: data.ownerId,
  });
}

export async function updateProject(id, data) {
  return await updateRow('projects', id, data);
}

export async function deleteProject(id) {
  return await deleteRow('projects', id);
}

export async function getAllProjects(statusFilter) {
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id=p.id) AS task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status='done') AS done_count,
      (SELECT COUNT(*) FROM documents WHERE project_id=p.id) AS doc_count,
      (SELECT COUNT(*) FROM boq_items WHERE project_id=p.id) AS boq_count
    FROM projects p
  `;
  const params = [];
  if (statusFilter && statusFilter !== 'all') {
    sql += ' WHERE p.status=?';
    params.push(statusFilter);
  }
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

// ============================================================
// BOQ ITEMS
// ============================================================
export async function createBOQItem(data) {
  const qty = parseFloat(data.quantity) || 0;
  const unitPrice = parseFloat(data.unitPrice) || 0;
  return await insertRow('boq_items', {
    project_id: data.projectId,
    item_no: data.itemNo || '',
    category: data.category || '',
    item_name: data.itemName,
    work_type: data.workType || '',
    unit: data.unit || '',
    quantity: qty,
    unit_price: unitPrice,
    labor_rate: parseFloat(data.laborRate) || 0,
    material_rate: parseFloat(data.materialRate) || 0,
    total_price: qty * unitPrice,
    note: data.note || '',
    sort_order: data.sortOrder || 0,
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

export async function deleteBOQItem(id) {
  return await deleteRow('boq_items', id);
}

export async function getBOQItems(projectId) {
  return await dbGetAll(
    'SELECT * FROM boq_items WHERE project_id=? ORDER BY sort_order ASC, created_at ASC',
    projectId
  );
}

// ============================================================
// TASKS
// ============================================================
export async function createTask(data) {
  return await insertRow('tasks', {
    project_id: data.projectId,
    assigned_to: data.assignedTo || null,
    title: data.title,
    description: data.description || '',
    priority: data.priority || 'medium',
    status: data.status || 'todo',
    due_date: data.dueDate || null,
  });
}

export async function toggleTask(id) {
  const task = await dbGetFirst('SELECT status FROM tasks WHERE id=?', id);
  if (!task) return;
  const newStatus = task.status === 'done' ? 'todo' : 'done';
  await updateRow('tasks', id, { status: newStatus });
}

export async function deleteTask(id) {
  return await deleteRow('tasks', id);
}

// ============================================================
// DOCUMENTS
// ============================================================
export async function createDocument(data) {
  return await insertRow('documents', {
    project_id: data.projectId,
    uploaded_by: data.uploadedBy || null,
    name: data.name,
    category: data.category || 'other',
    file_url: data.fileUrl || '',
    notes: data.notes || '',
  });
}

export async function getAllDocuments(categoryFilter) {
  let sql = `
    SELECT d.*, p.name AS project_name
    FROM documents d
    LEFT JOIN projects p ON d.project_id = p.id
  `;
  const params = [];
  if (categoryFilter && categoryFilter !== 'all') {
    sql += ' WHERE d.category=?';
    params.push(categoryFilter);
  }
  sql += ' ORDER BY d.created_at DESC';
  return await dbGetAll(sql, params);
}

export async function deleteDocument(id) {
  return await deleteRow('documents', id);
}

// ============================================================
// WORKERS
// ============================================================
export async function createWorker(data) {
  return await insertRow('workers', {
    name: data.name,
    role: data.role || '',
    nationality: data.nationality || 'ไทย',
    gender: data.gender || 'ชาย',
    age: data.age || 0,
    daily_wage: data.dailyWage || 0,
    experience_years: data.experienceYears || 0,
    employment_status: data.employmentStatus || 'พนักงานรายวัน',
    phone: data.phone || '',
    avatar_url: data.avatarUrl || '',
  });
}

export async function deleteWorker(id) {
  return await deleteRow('workers', id);
}

export async function createWorkerRecord(data) {
  return await insertRow('worker_records', {
    worker_id: data.workerId,
    work_type: data.workType,
    date: data.date,
    output: data.output || 0,
    quality: data.quality || 0,
    ot_hours: data.otHours || 0,
    ot_amount: data.otAmount || 0,
  });
}

export async function getWorkersWithRecords() {
  const workers = await dbGetAll('SELECT * FROM workers ORDER BY name ASC');
  for (const w of workers) {
    w.records = await dbGetAll('SELECT * FROM worker_records WHERE worker_id=? ORDER BY date DESC', w.id);
  }
  return workers;
}

// ============================================================
// DASHBOARD
// ============================================================
export async function getDashboardStats() {
  const p = await dbGetFirst(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='planning' THEN 1 ELSE 0 END) AS planning
    FROM projects
  `);
  const t = await dbGetFirst(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN priority='urgent' AND status!='done' THEN 1 ELSE 0 END) AS urgent
    FROM tasks
  `);
  const recent = await dbGetAll('SELECT * FROM projects ORDER BY created_at DESC LIMIT 5');
  return { projects: p, tasks: t, recentProjects: recent };
}

// ============================================================
// MAINTENANCE
// ============================================================
export async function clearAllData() {
  const db = await getDB();
  await db.execAsync(`
    DELETE FROM weather_logs;
    DELETE FROM diary_reports;
    DELETE FROM worker_records;
    DELETE FROM workers;
    DELETE FROM documents;
    DELETE FROM gantt_tasks;
    DELETE FROM tasks;
    DELETE FROM boq_items;
    DELETE FROM project_codes;
    DELETE FROM project_members;
    DELETE FROM projects;
    DELETE FROM profiles;
    DELETE FROM sync_queue;
  `);
}