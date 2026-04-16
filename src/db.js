// src/db.js
// ============================================================
// ฐานข้อมูลทั้งหมดรวมไว้ไฟล์เดียว (เพิ่มระบบ Auto-Migration แก้บัคคอลัมน์หาย)
// + เพิ่มระบบ Offline-First Syncing (ส่งข้อมูลขึ้น Cloud เมื่อมีเน็ต)
// ============================================================

import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

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
  // 1. สร้างตารางทั้งหมด (กรณีติดตั้งแอปครั้งแรก) - โค้ดเดิมของคุณ
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
      nationality TEXT DEFAULT 'ไทย',
      gender TEXT DEFAULT 'ชาย',
      age INTEGER DEFAULT 0,
      daily_wage REAL DEFAULT 0,
      experience_years INTEGER DEFAULT 0,
      employment_status TEXT DEFAULT 'พนักงานรายวัน',
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
      ot_hours REAL DEFAULT 0,
      ot_amount REAL DEFAULT 0,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- 🌟 ส่วนที่เพิ่มใหม่: ตารางคิวสำหรับระบบออฟไลน์ 🌟
    -- ==========================================
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);

  // ============================================================
  // 🌟 ระบบ Auto-Migration 🌟 (โค้ดเดิมของคุณ)
  // ============================================================
  const workerColumns = [
    "ALTER TABLE workers ADD COLUMN nationality TEXT DEFAULT 'ไทย';",
    "ALTER TABLE workers ADD COLUMN gender TEXT DEFAULT 'ชาย';",
    "ALTER TABLE workers ADD COLUMN age INTEGER DEFAULT 0;",
    "ALTER TABLE workers ADD COLUMN daily_wage REAL DEFAULT 0;",
    "ALTER TABLE workers ADD COLUMN experience_years INTEGER DEFAULT 0;",
    "ALTER TABLE workers ADD COLUMN employment_status TEXT DEFAULT 'พนักงานรายวัน';"
  ];

  for (let sql of workerColumns) {
    try { await db.execAsync(sql); } catch (e) { /* ละเว้น error หากคอลัมน์มีอยู่แล้ว */ }
  }

  const recordColumns = [
    "ALTER TABLE worker_records ADD COLUMN ot_hours REAL DEFAULT 0;",
    "ALTER TABLE worker_records ADD COLUMN ot_amount REAL DEFAULT 0;"
  ];

  for (let sql of recordColumns) {
    try { await db.execAsync(sql); } catch (e) { /* ละเว้น error หากคอลัมน์มีอยู่แล้ว */ }
  }
}

// ============================================================
// 🌟 ส่วนที่เพิ่มใหม่: ระบบ SYNC ENGINE (ทำงานเบื้องหลัง) 🌟
// ============================================================
let isSyncing = false;

export async function syncToCloud() {
  if (isSyncing) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected) return; // ไม่มีเน็ตให้หยุด

  isSyncing = true;
  try {
    const db = await getDB();
    const queue = await db.getAllAsync('SELECT * FROM offline_queue ORDER BY id ASC');
    
    for (let item of queue) {
      const payload = JSON.parse(item.payload);
      let error = null;

      if (item.action === 'INSERT') {
        const { error: insertErr } = await supabase.from(item.table_name).insert([payload]);
        if (insertErr && insertErr.code !== '23505') error = insertErr; // รหัส 23505 คือมีข้อมูลแล้ว
      } else if (item.action === 'UPDATE') {
        const { id, ...updateData } = payload;
        const { error: updateErr } = await supabase.from(item.table_name).update(updateData).eq('id', id);
        error = updateErr;
      } else if (item.action === 'DELETE') {
        const { error: deleteErr } = await supabase.from(item.table_name).delete().eq('id', payload.id);
        error = deleteErr;
      }

      if (error) {
        console.log(`[Sync Error] โต๊ะ: ${item.table_name}`, error);
        break; 
      } else {
        await db.runAsync('DELETE FROM offline_queue WHERE id=?', [item.id]);
      }
    }
  } catch (e) {
    console.log('[Sync Exception]', e);
  } finally {
    isSyncing = false;
  }
}

async function addToQueue(db, tableName, action, payload) {
  await db.runAsync(
    'INSERT INTO offline_queue (table_name, action, payload) VALUES (?, ?, ?)',
    [tableName, action, JSON.stringify(payload)]
  );
  syncToCloud();
}


// ============================================================
// AUTH, PROJECTS, TASKS, DOCUMENTS (คงโค้ดเดิมของคุณไว้ 100%)
// ============================================================
export async function register(username, password, fullName, position, department, phone) {
  const db = await getDB();
  const exists = await db.getFirstAsync('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
  if (exists) throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  const r = await db.runAsync(
    'INSERT INTO users (username,password,full_name,position,department,phone) VALUES (?,?,?,?,?,?)',
    [username.toLowerCase(), password, fullName, position || '', department || '', phone || '']
  );
  
  // เพิ่มคิว
  await addToQueue(db, 'users', 'INSERT', { id: r.lastInsertRowId, username: username.toLowerCase(), password, full_name: fullName, position: position || '', department: department || '', phone: phone || '' });
  return { id: r.lastInsertRowId, username, fullName };
}

export async function login(username, password) {
  const db = await getDB();
  const user = await db.getFirstAsync('SELECT * FROM users WHERE username=? AND password=?', [username.toLowerCase(), password]);
  if (!user) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  syncToCloud(); // เช็ค Sync ตอนเข้าสู่ระบบ
  return user;
}

export async function getUserById(id) {
  const db = await getDB();
  return await db.getFirstAsync('SELECT * FROM users WHERE id=?', [id]);
}

export async function updateProfile(userId, fullName, position, department, phone) {
  const db = await getDB();
  await db.runAsync('UPDATE users SET full_name=?,position=?,department=?,phone=? WHERE id=?', [fullName, position, department, phone, userId]);
  await addToQueue(db, 'users', 'UPDATE', { id: userId, full_name: fullName, position, department, phone });
}

export async function getAllUsers() {
  const db = await getDB();
  return await db.getAllAsync('SELECT id,username,full_name,position FROM users ORDER BY full_name');
}

export async function createProject(name, desc, location, budget, startDate, endDate, status, managerId) {
  const db = await getDB();
  const r = await db.runAsync(
    'INSERT INTO projects (name,description,location,budget,start_date,end_date,status,manager_id) VALUES (?,?,?,?,?,?,?,?)',
    [name, desc || '', location || '', budget || 0, startDate || '', endDate || '', status || 'planning', managerId || null]
  );
  await addToQueue(db, 'projects', 'INSERT', { id: r.lastInsertRowId, name, description: desc || '', location: location || '', budget: budget || 0, start_date: startDate || '', end_date: endDate || '', status: status || 'planning', manager_id: managerId || null });
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
  syncToCloud(); // สั่งอัปเดตเมื่อเปิดหน้าโปรเจกต์
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

export async function deleteProject(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM projects WHERE id=?', [id]);
  await addToQueue(db, 'projects', 'DELETE', { id });
}

export async function getDashboardStats() {
  const db = await getDB();
  const p = await db.getFirstAsync(`SELECT COUNT(*) as total,
    SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN status='planning' THEN 1 ELSE 0 END) as planning FROM projects`);
  const t = await db.getFirstAsync(`SELECT COUNT(*) as total,
    SUM(CASE WHEN priority='urgent' AND status!='done' THEN 1 ELSE 0 END) as urgent FROM tasks`);
  const recent = await db.getAllAsync('SELECT p.*,u.full_name as manager_name FROM projects p LEFT JOIN users u ON p.manager_id=u.id ORDER BY p.created_at DESC LIMIT 5');
  syncToCloud();
  return { projects: p, tasks: t, recentProjects: recent };
}

export async function createTask(projectId, assignedTo, title, desc, priority, status, dueDate) {
  const db = await getDB();
  const r = await db.runAsync(
    'INSERT INTO tasks (project_id,assigned_to,title,description,priority,status,due_date) VALUES (?,?,?,?,?,?,?)',
    [projectId, assignedTo || null, title, desc || '', priority || 'medium', status || 'todo', dueDate || '']
  );
  await addToQueue(db, 'tasks', 'INSERT', { id: r.lastInsertRowId, project_id: projectId, assigned_to: assignedTo || null, title, description: desc || '', priority: priority || 'medium', status: status || 'todo', due_date: dueDate || '' });
  return r;
}

export async function toggleTask(taskId) {
  const db = await getDB();
  const task = await db.getFirstAsync('SELECT status FROM tasks WHERE id=?', [taskId]);
  if (!task) return;
  const newStatus = task.status === 'done' ? 'todo' : 'done';
  await db.runAsync('UPDATE tasks SET status=? WHERE id=?', [newStatus, taskId]);
  await addToQueue(db, 'tasks', 'UPDATE', { id: taskId, status: newStatus });
}

export async function deleteTask(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM tasks WHERE id=?', [id]);
  await addToQueue(db, 'tasks', 'DELETE', { id });
}

export async function createDocument(projectId, uploadedBy, name, category, notes) {
  const db = await getDB();
  const r = await db.runAsync(
    'INSERT INTO documents (project_id,uploaded_by,name,category,notes) VALUES (?,?,?,?,?)',
    [projectId, uploadedBy || null, name, category || 'other', notes || '']
  );
  await addToQueue(db, 'documents', 'INSERT', { id: r.lastInsertRowId, project_id: projectId, uploaded_by: uploadedBy || null, name, category: category || 'other', notes: notes || '' });
  return r;
}

export async function getAllDocuments(categoryFilter) {
  const db = await getDB();
  let q = 'SELECT d.*,p.name as project_name FROM documents d LEFT JOIN projects p ON d.project_id=p.id';
  if (categoryFilter && categoryFilter !== 'all') q += ` WHERE d.category='${categoryFilter}'`;
  q += ' ORDER BY d.created_at DESC';
  return await db.getAllAsync(q);
}

export async function deleteDocument(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM documents WHERE id=?', [id]);
  await addToQueue(db, 'documents', 'DELETE', { id });
}

// ============================================================
// WORKERS 
// ============================================================

export async function insertWorker({ name, role, nationality, gender, age, dailyWage, experienceYears, employmentStatus, phone, avatarUri }) {
  const db = await getDB();
  const r = await db.runAsync(
    'INSERT INTO workers (name,role,nationality,gender,age,daily_wage,experience_years,employment_status,phone,avatar_uri) VALUES (?,?,?,?,?,?,?,?,?,?)',
    name, role || '', nationality || 'ไทย', gender || 'ชาย', age || 0, dailyWage || 0, experienceYears || 0, employmentStatus || 'พนักงานรายวัน', phone || '', avatarUri || ''
  );
  await addToQueue(db, 'workers', 'INSERT', { id: r.lastInsertRowId, name, role: role || '', nationality: nationality || 'ไทย', gender: gender || 'ชาย', age: age || 0, daily_wage: dailyWage || 0, experience_years: experienceYears || 0, employment_status: employmentStatus || 'พนักงานรายวัน', phone: phone || '', avatar_uri: avatarUri || '' });
  return r.lastInsertRowId;
}

// โค้ดเดิมของคุณทั้งหมดแบบไม่ตัดบรรทัดทิ้ง
export async function getWorkersWithRecords() {
  const db = await getDB();
  const rows = await db.getAllAsync(`
    SELECT w.*, r.id as rid, r.work_type, r.date, r.output, r.quality, r.ot_hours, r.ot_amount
    FROM workers w LEFT JOIN worker_records r ON w.id=r.worker_id
    ORDER BY w.name ASC
  `);
  
  const map = {};
  
  rows.forEach(row => {
    if (!map[row.id]) {
      map[row.id] = {
        id: row.id, name: row.name, role: row.role,
        nationality: row.nationality, gender: row.gender,
        daily_wage: row.daily_wage, experience_years: row.experience_years,
        employment_status: row.employment_status,
        age: row.age, phone: row.phone, avatar_uri: row.avatar_uri,
        records: [],
        records_text: '', 
      };
    }
    
    if (row.rid) {
      map[row.id].records.push({
        id: row.rid, work_type: row.work_type, date: row.date,
        output: row.output, quality: row.quality, ot_hours: row.ot_hours, ot_amount: row.ot_amount
      });
    }
  });

  const finalResult = Object.values(map).map(worker => {
    if (worker.records.length > 0) {
      worker.records_text = worker.records
        .map(r => `• วันที่ ${r.date} | งาน: ${r.work_type} (ผลผลิต: ${r.output}, OT: ${r.ot_hours||0} ชม.)`)
        .join('\n');
    } else {
      worker.records_text = 'ยังไม่มีประวัติการทำงาน';
    }
    return worker;
  });

  return finalResult;
}

export async function insertWorkerRecord(workerId, workType, date, output, quality, otHours, otAmount) {
  const db = await getDB();
  const r = await db.runAsync(
    'INSERT INTO worker_records (worker_id,work_type,date,output,quality,ot_hours,ot_amount) VALUES (?,?,?,?,?,?,?)',
    workerId, workType, date, output, quality, otHours || 0, otAmount || 0
  );
  await addToQueue(db, 'worker_records', 'INSERT', { id: r.lastInsertRowId, worker_id: workerId, work_type: workType, date, output, quality, ot_hours: otHours || 0, ot_amount: otAmount || 0 });
  return r;
}

export async function deleteWorker(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM workers WHERE id=?', [id]);
  await addToQueue(db, 'workers', 'DELETE', { id });
}

export async function resetDB() {
  const db = await getDB();
  await db.execAsync(`
    DROP TABLE IF EXISTS offline_queue;
    DROP TABLE IF EXISTS worker_records; DROP TABLE IF EXISTS workers;
    DROP TABLE IF EXISTS progress_reports; DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS tasks; DROP TABLE IF EXISTS projects; DROP TABLE IF EXISTS users;
  `);
  _db = null;
  await getDB();
}