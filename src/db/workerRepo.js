import { getDatabase } from './database';

// ดึงข้อมูลช่างทั้งหมด พร้อมประวัติงาน
export const getWorkersWithRecords = async () => {
  try {
    const db = await getDatabase();
    
    // ใช้ getAllAsync แทน tx.executeSql
    const rows = await db.getAllAsync(`
      SELECT w.*, r.id as record_id, r.workType, r.date, r.output, r.quality 
      FROM workers w 
      LEFT JOIN worker_records r ON w.id = r.worker_id
    `);

    const workersMap = {};
    
    rows.forEach(row => {
      if (!workersMap[row.id]) {
        workersMap[row.id] = {
          id: row.id, name: row.name, role: row.role, avatar: row.avatar, records: []
        };
      }
      if (row.record_id) {
        workersMap[row.id].records.push({
          id: row.record_id, workType: row.workType, date: row.date, output: row.output, quality: row.quality
        });
      }
    });
    
    return Object.values(workersMap);
  } catch (error) {
    console.error("Error in getWorkersWithRecords:", error);
    throw error;
  }
};

// เพิ่มช่างใหม่
export const insertWorker = async (name, role, avatar) => {
  try {
    const db = await getDatabase();
    // ใช้ runAsync สำหรับ INSERT, UPDATE, DELETE
    const result = await db.runAsync(
      `INSERT INTO workers (name, role, avatar) VALUES (?, ?, ?);`,
      [name, role, avatar]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error in insertWorker:", error);
    throw error;
  }
};

// เพิ่มสถิติงานให้ช่าง
export const insertWorkerRecord = async (workerId, workType, date, output, quality) => {
  try {
    const db = await getDatabase();
    const result = await db.runAsync(
      `INSERT INTO worker_records (worker_id, workType, date, output, quality) VALUES (?, ?, ?, ?, ?);`,
      [workerId, workType, date, output, quality]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error("Error in insertWorkerRecord:", error);
    throw error;
  }
};