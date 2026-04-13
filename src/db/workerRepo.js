// src/db/workerRepo.js

import { getDatabase } from './database';

// ============================================================
// ดึงข้อมูลช่างทั้งหมด พร้อมประวัติงาน
// ============================================================
export const getWorkersWithRecords = async () => {
  const db = await getDatabase();

  const rows = await db.getAllAsync(`
    SELECT w.*, r.id as record_id, r.workType, r.date, r.output, r.quality 
    FROM workers w 
    LEFT JOIN worker_records r ON w.id = r.worker_id
    ORDER BY w.name ASC, r.date DESC
  `);

  const workersMap = {};

  rows.forEach(row => {
    if (!workersMap[row.id]) {
      workersMap[row.id] = {
        id: row.id,
        name: row.name,
        role: row.role || '',
        avatar: row.avatar || '👷',
        records: [],
      };
    }
    if (row.record_id) {
      workersMap[row.id].records.push({
        id: row.record_id,
        workType: row.workType || '',
        date: row.date || '',
        output: row.output || 0,
        quality: row.quality || 0,
      });
    }
  });

  return Object.values(workersMap);
};

// ============================================================
// เพิ่มช่างใหม่
// ============================================================
export const insertWorker = async (name, role, avatar) => {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO workers (name, role, avatar) VALUES (?, ?, ?)',
    [name, role || '', avatar || '👷']
  );
  return result.lastInsertRowId;
};

// ============================================================
// เพิ่มสถิติงานให้ช่าง
// ============================================================
export const insertWorkerRecord = async (workerId, workType, date, output, quality) => {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO worker_records (worker_id, workType, date, output, quality) VALUES (?, ?, ?, ?, ?)',
    [workerId, workType || '', date || '', output || 0, quality || 0]
  );
  return result.lastInsertRowId;
};

// ============================================================
// ลบช่าง (cascade ลบ records ด้วย)
// ============================================================
export const deleteWorker = async (workerId) => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workers WHERE id = ?', [workerId]);
};

// ============================================================
// ลบสถิติงาน
// ============================================================
export const deleteWorkerRecord = async (recordId) => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM worker_records WHERE id = ?', [recordId]);
};