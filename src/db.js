// db.js
// ============================================================
// Database Layer (SQLite) - Offline First
// ทุกการเขียนจะเข้า sync_queue อัตโนมัติ
// ============================================================

import * as SQLite from 'expo-sqlite';
import { newUUID, now } from './utils';

let _db = null;

export async function getDB() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('contrack.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await initSchema(_db);
  return _db;
}

async function initSchema(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, custom_id TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
      phone TEXT DEFAULT '', address TEXT DEFAULT '', avatar_url TEXT DEFAULT '',
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
      location TEXT DEFAULT '', latitude REAL, longitude REAL, budget REAL DEFAULT 0,
      start_date TEXT, end_date TEXT, progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planning', owner_id TEXT,
      created_at TEXT, updated_at TEXT, sync_status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL, permissions TEXT DEFAULT '{}', company_name TEXT DEFAULT '',
      is_external INTEGER DEFAULT 0, joined_at TEXT, updated_at TEXT,
      sync_status TEXT DEFAULT 'pending'
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
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_gantt_project ON gantt_tasks(project_id);
  `);
}

// ============================================================
// Helpers
// ============================================================
async function enqueue(db, tableName, action, rowId, payload) {
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, action, row_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tableName, action, rowId, JSON.stringify(payload), now()]
  );
}

async function insertRow(tableName, data) {
  const db = await getDB();
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

  await db.runAsync(
    `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`,
    values
  );

  const { sync_status, ...cloudPayload } = row;
  await enqueue(db, tableName, 'insert', row.id, cloudPayload);
  return row;
}

async function updateRow(tableName, id, data) {
  const db = await getDB();
  const updates = { ...data, updated_at: now(), sync_status: 'pending' };

  const keys = Object.keys(updates);
  const setClause = keys.map(k => `${k}=?`).join(',');
  const values = [...keys.map(k => updates[k]), id];

  await db.runAsync(
    `UPDATE ${tableName} SET ${setClause} WHERE id=?`,
    values
  );

  const { sync_status, ...cloudPayload } = updates;
  await enqueue(db, tableName, 'update', id, { id, ...cloudPayload });
}

async function deleteRow(tableName, id) {
  const db = await getDB();
  await db.runAsync(`DELETE FROM ${tableName} WHERE id=?`, [id]);
  await enqueue(db, tableName, 'delete', id, { id });
}

export { insertRow, updateRow, deleteRow, enqueue };

// ============================================================
// PROJECTS
// ============================================================
export async function createProject(data) {
  return await insertRow('projects', {
    name: data.name,
    description: data.description || '',
    location: data.location || '',
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    budget: data.budget || 0,
    start_date: data.startDate || null,
    end_date: data.endDate || null,
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
  const db = await getDB();
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id=p.id) AS task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status='done') AS done_count,
      (SELECT COUNT(*) FROM documents WHERE project_id=p.id) AS doc_count
    FROM projects p
  `;
  const params = [];
  if (statusFilter && statusFilter !== 'all') {
    sql += ' WHERE p.status=?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY p.created_at DESC';
  return await db.getAllAsync(sql, params);
}

export async function getProjectById(id) {
  const db = await getDB();
  const project = await db.getFirstAsync('SELECT * FROM projects WHERE id=?', [id]);
  if (!project) return null;

  const tasks = await db.getAllAsync(
    'SELECT * FROM tasks WHERE project_id=? ORDER BY created_at DESC', [id]
  );
  const documents = await db.getAllAsync(
    'SELECT * FROM documents WHERE project_id=? ORDER BY created_at DESC', [id]
  );
  return { ...project, tasks, documents };
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
  const db = await getDB();
  const task = await db.getFirstAsync('SELECT status FROM tasks WHERE id=?', [id]);
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
  const db = await getDB();
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
  return await db.getAllAsync(sql, params);
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
  const db = await getDB();
  const workers = await db.getAllAsync('SELECT * FROM workers ORDER BY name ASC');
  for (const w of workers) {
    w.records = await db.getAllAsync(
      'SELECT * FROM worker_records WHERE worker_id=? ORDER BY date DESC', [w.id]
    );
  }
  return workers;
}

// ============================================================
// DASHBOARD
// ============================================================
export async function getDashboardStats() {
  const db = await getDB();
  const p = await db.getFirstAsync(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status='planning' THEN 1 ELSE 0 END) AS planning
    FROM projects
  `);
  const t = await db.getFirstAsync(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN priority='urgent' AND status!='done' THEN 1 ELSE 0 END) AS urgent
    FROM tasks
  `);
  const recent = await db.getAllAsync(
    'SELECT * FROM projects ORDER BY created_at DESC LIMIT 5'
  );
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
    DELETE FROM project_members;
    DELETE FROM projects;
    DELETE FROM profiles;
    DELETE FROM sync_queue;
  `);
}