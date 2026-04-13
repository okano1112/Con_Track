import * as SQLite from 'expo-sqlite';

const DB_NAME = 'ots_manager.db';
const DB_VERSION = 1;

let _db = null;

// เปิด database (singleton pattern)
export async function getDatabase() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // เปิด WAL mode เพื่อ performance ที่ดีขึ้น
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  
  // ตรวจ version แล้ว migrate
  await migrate(_db);
  
  return _db;
}

// ============================================================
// Migration System
// ============================================================
async function migrate(db) {
  const result = await db.getFirstAsync('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await migrateV1(db);
  }

  // เพิ่ม migration ใหม่ได้ที่นี่:
  // if (currentVersion < 2) { await migrateV2(db); }
}

async function migrateV1(db) {
  await db.execAsync(`
    -- ===================== 1. ตารางผู้ใช้ =====================
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

    -- ===================== 2. ตารางโครงการ =====================
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

    -- ===================== 3. ตารางสมาชิกโครงการ =====================
    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'worker' CHECK (role IN ('manager','engineer','foreman','worker')),
      joined_at TEXT DEFAULT (datetime('now','localtime')),
      is_synced INTEGER DEFAULT 0,
      UNIQUE(project_id, user_id)
    );

    -- ===================== 4. ตารางเอกสาร =====================
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

    -- ===================== 5. ตารางงาน/กิจกรรม =====================
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

    -- ===================== 6. ตารางรายงานความคืบหน้า =====================
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

    -- ===================== 7. ตารางแจ้งเตือน =====================
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

    -- ===================== Indexes =====================
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_progress_project ON progress_reports(project_id);

    -- ตั้ง version
    PRAGMA user_version = 1;
  `);

  console.log('✅ Database migrated to v1');
}

// ============================================================
// Helper: สำหรับ sync ทีหลัง
// ============================================================
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

// ============================================================
// Reset database (สำหรับ dev/testing)
// ============================================================
export async function resetDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
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
  await getDatabase(); // re-init
}


// ในไฟล์ src/db/database.js
export const initDB = () => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      // (ตารางเดิมของคุณที่มีอยู่แล้วปล่อยไว้)
      
      // 1. สร้างตารางเก็บข้อมูลช่าง
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS workers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          role TEXT,
          avatar TEXT
        );`
      );

      // 2. สร้างตารางเก็บประวัติการทำงานของช่าง
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS worker_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          worker_id INTEGER,
          workType TEXT,
          date TEXT,
          output REAL,
          quality REAL,
          FOREIGN KEY (worker_id) REFERENCES workers (id) ON DELETE CASCADE
        );`,
        [],
        () => resolve(), // สำเร็จ
        (_, error) => reject(error) // ผิดพลาด
      );
    });
  });
};