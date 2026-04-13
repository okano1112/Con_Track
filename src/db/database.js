import * as SQLite from 'expo-sqlite';

const DB_NAME = 'ots_manager.db';

let _db = null;

export async function getDatabase() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  
  await migrate(_db);
  
  return _db;
}

async function migrate(db) {
  const result = await db.getFirstAsync('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await migrateV1(db);
  }
  if (currentVersion < 2) {
    await migrateV2(db);
  }
}

// ============================================================
// V1 — ตารางหลัก (users, projects, tasks, documents, etc.)
// ============================================================
async function migrateV1(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      position TEXT DEFAULT '',
      department TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      avatar_uri TEXT DEFAULT '',
      role TEXT DEFAULT 'member' CHECK (role IN ('admin','manager','member')),
      pin_hash TEXT DEFAULT '',
      is_synced INTEGER DEFAULT 0,
      sync_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      location TEXT DEFAULT '',
      budget REAL DEFAULT 0,
      start_date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      status TEXT DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed')),
      manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_synced INTEGER DEFAULT 0,
      sync_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'worker' CHECK (role IN ('manager','engineer','foreman','worker')),
      joined_at TEXT DEFAULT (datetime('now','localtime')),
      is_synced INTEGER DEFAULT 0,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      uploaded_by INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other' CHECK (category IN ('blueprint','contract','report','invoice','photo','other')),
      file_uri TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      file_type TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      is_synced INTEGER DEFAULT 0,
      sync_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      assigned_to INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
      status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
      due_date TEXT DEFAULT '',
      completed_at TEXT DEFAULT '',
      is_synced INTEGER DEFAULT 0,
      sync_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS progress_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      reported_by INTEGER REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
      weather TEXT DEFAULT '',
      workers_count INTEGER DEFAULT 0,
      issues TEXT DEFAULT '',
      photo_uris TEXT DEFAULT '[]',
      is_synced INTEGER DEFAULT 0,
      sync_id TEXT DEFAULT '',
      report_date TEXT DEFAULT (date('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT DEFAULT '',
      type TEXT DEFAULT 'info' CHECK (type IN ('info','warning','success','error')),
      is_read INTEGER DEFAULT 0,
      related_type TEXT DEFAULT '',
      related_id INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_progress_project ON progress_reports(project_id);

    PRAGMA user_version = 1;
  `);

  console.log('✅ Database migrated to v1');
}

// ============================================================
// V2 — ตารางช่าง (workers, worker_records)
// แยกออกมาเป็น migration ใหม่เพื่อให้ DB ที่เคยรัน v1 แล้ว
// สามารถเพิ่มตารางได้โดยไม่ต้อง reset
// ============================================================
async function migrateV2(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      avatar TEXT DEFAULT '👷'
    );

    CREATE TABLE IF NOT EXISTS worker_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      workType TEXT DEFAULT '',
      date TEXT DEFAULT '',
      output REAL DEFAULT 0,
      quality REAL DEFAULT 0,
      FOREIGN KEY (worker_id) REFERENCES workers (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_worker_records_worker ON worker_records(worker_id);

    PRAGMA user_version = 2;
  `);

  console.log('✅ Database migrated to v2 (workers tables)');
}

export async function getUnsyncedRecords(tableName) {
  const db = await getDatabase();
  return await db.getAllAsync(`SELECT * FROM ${tableName} WHERE is_synced = 0`);
}

export async function markAsSynced(tableName, ids) {
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE ${tableName} SET is_synced = 1 WHERE id IN (${placeholders})`,
    ids
  );
}

export async function resetDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS worker_records;
    DROP TABLE IF EXISTS workers;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS progress_reports;
    DROP TABLE IF EXISTS documents;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS project_members;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS users;
    PRAGMA user_version = 0;
  `);
  _db = null;
  await getDatabase(); 
}