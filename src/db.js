// src/db.js

import * as SQLite from 'expo-sqlite';

let _db = null;

export async function getDB() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('ots_app.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await initDB(_db);
  return _db;
}

async function initDB(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      position TEXT DEFAULT '',
      department TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      budget REAL DEFAULT 0,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planning',
      manager_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      assigned_to INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      due_date TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      uploaded_by INTEGER,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS progress_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      reported_by INTEGER,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      progress_percent INTEGER DEFAULT 0,
      weather TEXT DEFAULT '',
      workers_count INTEGER DEFAULT 0,
      issues TEXT DEFAULT '',
      report_date TEXT DEFAULT (date('now','localtime')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      age INTEGER DEFAULT 0,
      phone TEXT DEFAULT '',
      avatar_uri TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS worker_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      work_type TEXT DEFAULT '',
      date TEXT DEFAULT '',
      output REAL DEFAULT 0,
      quality REAL DEFAULT 0,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );
  `);
}

// === AUTH ===
export async function register(username, password, fullName, position, department, phone) {
  const db = await getDB();
  const exists = await db.getFirstAsync('SELECT id FROM users WHERE username=?', [username.toLowerCase()]);
  if (exists) throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  const r = await db.runAsync(
    'INSERT INTO users (username,password,full_name,position,department,phone) VALUES (?,?,?,?,?,?)',
    [username.toLowerCase(), password, fullName, position || '', department || '', phone || '']
  );
  return { id: r.lastInsertRowId, username, fullName };
}
export async function login(username, password) {
  const db = await getDB();
  const user = await db.getFirstAsync('SELECT * FROM users WHERE username=? AND password=?', [username.toLowerCase(), password]);
  if (!user) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  return user;
}
export async function getUserById(id) {
  const db = await getDB();
  return await db.getFirstAsync('SELECT * FROM users WHERE id=?', [id]);
}
export async function updateProfile(userId, fullName, position, department, phone) {
  const db = await getDB();
  await db.runAsync('UPDATE users SET full_name=?,position=?,department=?,phone=? WHERE id=?', [fullName, position, department, phone, userId]);
}
export async function getAllUsers() {
  const db = await getDB();
  return await db.getAllAsync('SELECT id,username,full_name,position FROM users ORDER BY full_name');
}

// === PROJECTS ===
export async function createProject(name, desc, location, budget, startDate, endDate, status, managerId) {
  const db = await getDB();
  const r = await db.runAsync('INSERT INTO projects (name,description,location,budget,start_date,end_date,status,manager_id) VALUES (?,?,?,?,?,?,?,?)',
    [name, desc || '', location || '', budget || 0, startDate || '', endDate || '', status || 'planning', managerId || null]);
  return r.lastInsertRowId;
}
export async function getAllProjects(statusFilter) {
  const db = await getDB();
  let q = `SELECT p.*, u.full_name as manager_name,
    (SELECT COUNT(*) FROM tasks WHERE project_id=p.id) as task_count,
    (SELECT COUNT(*) FROM tasks WHERE project_id=p.id AND status='done') as done_count,
    (SELECT COUNT(*) FROM documents WHERE project_id=p.id) as doc_count
    FROM projects p LEFT JOIN users u ON p.manager_id=u.id`;
  if (statusFilter && statusFilter !== 'all') q += ` WHERE p.status='${statusFilter}'`;
  q += ' ORDER BY p.created_at DESC';
  return await db.getAllAsync(q);
}
export async function getProjectById(id) {
  const db = await getDB();
  const project = await db.getFirstAsync('SELECT p.*,u.full_name as manager_name FROM projects p LEFT JOIN users u ON p.manager_id=u.id WHERE p.id=?', [id]);
  if (!project) throw new Error('ไม่พบโครงการ');
  const tasks = await db.getAllAsync('SELECT t.*,u.full_name as assignee_name FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id WHERE t.project_id=? ORDER BY t.created_at DESC', [id]);
  const documents = await db.getAllAsync('SELECT * FROM documents WHERE project_id=? ORDER BY created_at DESC', [id]);
  return { ...project, tasks, documents };
}
export async function deleteProject(id) { const db = await getDB(); await db.runAsync('DELETE FROM projects WHERE id=?', [id]); }
export async function getDashboardStats() {
  const db = await getDB();
  const p = await db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status='planning' THEN 1 ELSE 0 END) as planning FROM projects`);
  const t = await db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN priority='urgent' AND status!='done' THEN 1 ELSE 0 END) as urgent FROM tasks`);
  const recent = await db.getAllAsync('SELECT p.*,u.full_name as manager_name FROM projects p LEFT JOIN users u ON p.manager_id=u.id ORDER BY p.created_at DESC LIMIT 5');
  return { projects: p, tasks: t, recentProjects: recent };
}

// === TASKS ===
export async function createTask(projectId, assignedTo, title, desc, priority, status, dueDate) {
  const db = await getDB();
  return await db.runAsync('INSERT INTO tasks (project_id,assigned_to,title,description,priority,status,due_date) VALUES (?,?,?,?,?,?,?)',
    [projectId, assignedTo || null, title, desc || '', priority || 'medium', status || 'todo', dueDate || '']);
}
export async function toggleTask(taskId) {
  const db = await getDB();
  const task = await db.getFirstAsync('SELECT status FROM tasks WHERE id=?', [taskId]);
  if (!task) return;
  await db.runAsync('UPDATE tasks SET status=? WHERE id=?', [task.status === 'done' ? 'todo' : 'done', taskId]);
}
export async function deleteTask(id) { const db = await getDB(); await db.runAsync('DELETE FROM tasks WHERE id=?', [id]); }

// === DOCUMENTS ===
export async function createDocument(projectId, uploadedBy, name, category, notes) {
  const db = await getDB();
  return await db.runAsync('INSERT INTO documents (project_id,uploaded_by,name,category,notes) VALUES (?,?,?,?,?)',
    [projectId, uploadedBy || null, name, category || 'other', notes || '']);
}
export async function getAllDocuments(categoryFilter) {
  const db = await getDB();
  let q = 'SELECT d.*,p.name as project_name FROM documents d LEFT JOIN projects p ON d.project_id=p.id';
  if (categoryFilter && categoryFilter !== 'all') q += ` WHERE d.category='${categoryFilter}'`;
  q += ' ORDER BY d.created_at DESC';
  return await db.getAllAsync(q);
}
export async function deleteDocument(id) { const db = await getDB(); await db.runAsync('DELETE FROM documents WHERE id=?', [id]); }

// === WORKERS ===
// insertWorker รับ object: insertWorker({ name, role, age, phone, avatarUri })
export async function insertWorker({ name, role, age, phone, avatarUri }) {
  const db = await getDB();
  const r = await db.runAsync('INSERT INTO workers (name,role,age,phone,avatar_uri) VALUES (?,?,?,?,?)',
    [name, role || '', age || 0, phone || '', avatarUri || '']);
  return r.lastInsertRowId;
}

// =====================================================
// getWorkersWithRecords — คืน Array ของ worker แต่ละคน
// worker แต่ละคนมี:
//   .id, .name, .role, .age, .phone, .avatar_uri  ← ข้อมูลช่าง (String/Number)
//   .records ← Array ของ { id, work_type, date, output, quality }
// =====================================================
export async function getWorkersWithRecords() {
  const db = await getDB();

  // ดึงช่างทั้งหมด (ไม่ join กับ records)
  const allWorkers = await db.getAllAsync('SELECT * FROM workers ORDER BY name ASC');

  // ดึง records ทั้งหมด
  const allRecords = await db.getAllAsync('SELECT * FROM worker_records ORDER BY date DESC');

  // จับคู่ records เข้ากับ worker แต่ละคน
  const result = allWorkers.map(w => {
    const myRecords = allRecords
      .filter(r => r.worker_id === w.id)
      .map(r => ({
        id: r.id,
        work_type: r.work_type || '',
        date: r.date || '',
        output: r.output || 0,
        quality: r.quality || 0,
      }));

    return {
      id: w.id,
      name: w.name || '',           // ← String เสมอ
      role: w.role || '',            // ← String เสมอ
      age: w.age || 0,               // ← Number เสมอ
      phone: w.phone || '',          // ← String เสมอ
      avatar_uri: w.avatar_uri || '',// ← String เสมอ
      records: myRecords,            // ← Array เสมอ
    };
  });

  return result;
}

export async function insertWorkerRecord(workerId, workType, date, output, quality) {
  const db = await getDB();
  return await db.runAsync('INSERT INTO worker_records (worker_id,work_type,date,output,quality) VALUES (?,?,?,?,?)',
    [workerId, workType, date, output, quality]);
}
export async function deleteWorker(id) { const db = await getDB(); await db.runAsync('DELETE FROM workers WHERE id=?', [id]); }

// === RESET ===
export async function resetDB() {
  const db = await getDB();
  await db.execAsync('DROP TABLE IF EXISTS worker_records; DROP TABLE IF EXISTS workers; DROP TABLE IF EXISTS progress_reports; DROP TABLE IF EXISTS documents; DROP TABLE IF EXISTS tasks; DROP TABLE IF EXISTS projects; DROP TABLE IF EXISTS users;');
  _db = null;
  await getDB();
}