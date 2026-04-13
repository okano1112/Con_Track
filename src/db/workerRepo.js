// src/db/workerRepo.js
import { db } from './database';

// ฟังก์ชันดึงข้อมูลช่างทั้งหมด พร้อมประวัติงาน
export const getWorkersWithRecords = () => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT w.*, r.id as record_id, r.workType, r.date, r.output, r.quality 
         FROM workers w 
         LEFT JOIN worker_records r ON w.id = r.worker_id`,
        [],
        (_, result) => {
          // โค้ดส่วนนี้คือการจัดรูปแบบข้อมูล (Group by worker)
          const workersMap = {};
          const rows = result.rows._array;
          
          rows.forEach(row => {
            if (!workersMap[row.id]) {
              workersMap[row.id] = {
                id: row.id, name: row.name, role: row.role, avatar: row.avatar, records: []
              };
            }
            // ถ้ามีประวัติงานให้ใส่เข้าไปใน array records
            if (row.record_id) {
              workersMap[row.id].records.push({
                id: row.record_id, workType: row.workType, date: row.date, output: row.output, quality: row.quality
              });
            }
          });
          resolve(Object.values(workersMap)); // ส่งกลับเป็น Array ของช่าง
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ฟังก์ชันเพิ่มช่างใหม่
export const insertWorker = (name, role, avatar) => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT INTO workers (name, role, avatar) VALUES (?, ?, ?);`,
        [name, role, avatar],
        (_, result) => resolve(result.insertId),
        (_, error) => reject(error)
      );
    });
  });
};

// ฟังก์ชันเพิ่มสถิติงานให้ช่าง
export const insertWorkerRecord = (workerId, workType, date, output, quality) => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT INTO worker_records (worker_id, workType, date, output, quality) VALUES (?, ?, ?, ?, ?);`,
        [workerId, workType, date, output, quality],
        (_, result) => resolve(result.insertId),
        (_, error) => reject(error)
      );
    });
  });
};