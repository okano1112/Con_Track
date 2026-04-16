// src/syncEngine.js
// ============================================================
// Sync Engine - จัดการส่งข้อมูลใน queue ขึ้น Supabase
//
// การทำงาน:
// 1. push(): หยิบรายการจาก sync_queue ส่งขึ้น Supabase ทีละตัว
//    - ถ้าสำเร็จ -> ลบออกจาก queue + update sync_status='synced'
//    - ถ้าล้มเหลว -> เพิ่ม retry_count + เก็บ error
// 2. pull(): ดึงข้อมูลจาก Supabase ที่ใหม่กว่าใน local มาอัปเดต
// 3. syncAll(): push ก่อน แล้ว pull (ทำเมื่อเน็ตกลับมา)
// 4. startAutoSync(): ฟัง NetInfo เน็ตกลับมา -> เรียก syncAll
// ============================================================

import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabaseClient';
import { getDB } from './db';
import { checkOnline } from './Usenetwork';

// ============================================================
// ป้องกันการ sync ซ้อนกัน
// ============================================================
let isSyncing = false;
const MAX_RETRY = 5;

// ============================================================
// ตารางที่ sync (เรียงตาม dependency - parent ก่อน child)
// ============================================================
const SYNC_TABLES = [
  'profiles',
  'projects',
  'project_members',
  'tasks',
  'gantt_tasks',
  'documents',
  'workers',
  'worker_records',
  'diary_reports',
  'weather_logs',
];

// ============================================================
// 🔼 PUSH: ส่งข้อมูลจาก sync_queue ขึ้น Supabase
// ============================================================
export async function push() {
  if (isSyncing) return { pushed: 0, failed: 0 };
  const online = await checkOnline();
  if (!online) return { pushed: 0, failed: 0 };

  isSyncing = true;
  const db = await getDB();
  let pushed = 0;
  let failed = 0;

  try {
    // หยิบรายการใน queue ที่ยังไม่ retry เกินจำกัด
    const items = await db.getAllAsync(
      `SELECT * FROM sync_queue
       WHERE retry_count < ?
       ORDER BY id ASC
       LIMIT 50`,
      [MAX_RETRY]
    );

    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload);
        let error = null;

        // แปลง integer → boolean ก่อนส่ง (SQLite ไม่มี boolean)
        normalizePayload(item.table_name, payload);

        if (item.action === 'insert') {
          // ใช้ upsert กัน duplicate (กรณี queue ซ้ำ)
          const res = await supabase
            .from(item.table_name)
            .upsert(payload, { onConflict: 'id' });
          error = res.error;
        } else if (item.action === 'update') {
          const { id, ...updateData } = payload;
          const res = await supabase
            .from(item.table_name)
            .update(updateData)
            .eq('id', id);
          error = res.error;
        } else if (item.action === 'delete') {
          const res = await supabase
            .from(item.table_name)
            .delete()
            .eq('id', payload.id);
          error = res.error;
        }

        if (error) {
          // บันทึก error + retry_count
          await db.runAsync(
            `UPDATE sync_queue
             SET retry_count = retry_count + 1, last_error = ?
             WHERE id = ?`,
            [error.message || String(error), item.id]
          );
          failed++;
          console.log(`[Sync] ${item.table_name} ${item.action} failed:`, error.message);
        } else {
          // สำเร็จ → ลบ queue + update sync_status
          await db.runAsync('DELETE FROM sync_queue WHERE id=?', [item.id]);
          if (item.action !== 'delete') {
            await db.runAsync(
              `UPDATE ${item.table_name} SET sync_status='synced' WHERE id=?`,
              [item.row_id]
            ).catch(() => {}); // กรณี table ไม่มี sync_status (เช่น weather_logs อาจถูกลบไปแล้ว)
          }
          pushed++;
        }
      } catch (e) {
        console.log('[Sync] push error:', e);
        await db.runAsync(
          `UPDATE sync_queue
           SET retry_count = retry_count + 1, last_error = ?
           WHERE id = ?`,
          [e.message, item.id]
        );
        failed++;
      }
    }
  } finally {
    isSyncing = false;
  }

  return { pushed, failed };
}

// ============================================================
// 🔽 PULL: ดึงข้อมูลจาก Supabase มาอัปเดต SQLite
// (เน้นเฉพาะตารางที่น่าจะมีคนอื่นแก้)
// ============================================================
export async function pull() {
  const online = await checkOnline();
  if (!online) return { pulled: 0 };

  const db = await getDB();
  let pulled = 0;

  try {
    // หา updated_at ล่าสุดใน local → ดึงเฉพาะที่ใหม่กว่านั้น
    for (const table of SYNC_TABLES) {
      try {
        const latest = await db.getFirstAsync(
          `SELECT MAX(updated_at) AS max_updated FROM ${table}`
        );
        const since = latest?.max_updated || '1970-01-01T00:00:00Z';

        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('updated_at', since)
          .limit(500);

        if (error) {
          console.log(`[Sync] pull ${table} error:`, error.message);
          continue;
        }

        if (data && data.length > 0) {
          for (const row of data) {
            await upsertLocal(db, table, row);
            pulled++;
          }
        }
      } catch (e) {
        console.log(`[Sync] pull ${table} exception:`, e);
      }
    }
  } catch (e) {
    console.log('[Sync] pull error:', e);
  }

  return { pulled };
}

// ============================================================
// 🔧 Helper: upsert row ลง SQLite
// ============================================================
async function upsertLocal(db, table, row) {
  // แปลง boolean → integer (SQLite ไม่มี boolean)
  for (const key of Object.keys(row)) {
    if (typeof row[key] === 'boolean') row[key] = row[key] ? 1 : 0;
    if (row[key] && typeof row[key] === 'object') {
      row[key] = JSON.stringify(row[key]);
    }
  }

  // เช็ค row ใน local
  const existing = await db.getFirstAsync(
    `SELECT updated_at FROM ${table} WHERE id=?`,
    [row.id]
  );

  // ถ้า local ใหม่กว่า → ข้าม (user แก้ล่าสุดยัง sync ไม่เสร็จ)
  if (existing && existing.updated_at > row.updated_at) return;

  // สร้าง SQL dynamic
  const rowWithStatus = { ...row, sync_status: 'synced' };
  const keys = Object.keys(rowWithStatus);
  const placeholders = keys.map(() => '?').join(',');
  const updates = keys.map(k => `${k}=excluded.${k}`).join(',');
  const values = keys.map(k => rowWithStatus[k]);

  await db.runAsync(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
    values
  );
}

// ============================================================
// 🔧 Helper: แปลงข้อมูลก่อนส่ง Supabase
// - boolean: SQLite เก็บเป็น 0/1 → Supabase ต้องการ true/false
// - JSON fields: SQLite เก็บเป็น string → Supabase ต้องการ object
// ============================================================
function normalizePayload(tableName, payload) {
  const booleanFields = {
    project_members: ['is_external'],
    gantt_tasks: ['is_milestone'],
  };
  const jsonFields = {
    project_members: ['permissions'],
    diary_reports: ['weather_data', 'photos'],
    weather_logs: ['raw_data'],
  };

  (booleanFields[tableName] || []).forEach(f => {
    if (payload[f] !== undefined) payload[f] = Boolean(payload[f]);
  });

  (jsonFields[tableName] || []).forEach(f => {
    if (typeof payload[f] === 'string') {
      try { payload[f] = JSON.parse(payload[f]); } catch {}
    }
  });
}

// ============================================================
// 🔄 SYNC ALL: push ก่อน pull (เรียกตอนเน็ตกลับ หรือกดปุ่ม sync)
// ============================================================
export async function syncAll() {
  const online = await checkOnline();
  if (!online) return { success: false, reason: 'offline' };

  const pushResult = await push();
  const pullResult = await pull();

  return {
    success: true,
    pushed: pushResult.pushed,
    failed: pushResult.failed,
    pulled: pullResult.pulled,
  };
}

// ============================================================
// 🔁 AUTO SYNC: ฟังเน็ตกลับมา แล้ว sync อัตโนมัติ
// เรียกครั้งเดียวตอนแอปเริ่มต้น
// ============================================================
let unsubscribe = null;
let syncInterval = null;

export function startAutoSync() {
  // ล้างของเดิมก่อน (กัน subscribe ซ้ำ)
  stopAutoSync();

  // 1. ฟังเน็ตกลับ
  unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      console.log('[Sync] Network reconnected, syncing...');
      const result = await syncAll();
      console.log('[Sync] Result:', result);
    }
  });

  // 2. sync ทุก 30 วินาที (ถ้ามีเน็ต)
  syncInterval = setInterval(async () => {
    const online = await checkOnline();
    if (online) {
      const pending = await getPendingCount();
      if (pending > 0) {
        await push(); // มีของค้าง ส่งขึ้นเลย
      }
    }
  }, 30000);

  // 3. sync ครั้งแรกตอนเริ่มต้น
  syncAll().then(r => console.log('[Sync] Initial sync:', r));
}

export function stopAutoSync() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// ============================================================
// 📊 สถิติ queue (ใช้แสดงใน UI)
// ============================================================
export async function getPendingCount() {
  const db = await getDB();
  const r = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM sync_queue WHERE retry_count < ?',
    [MAX_RETRY]
  );
  return r?.count || 0;
}

export async function getFailedCount() {
  const db = await getDB();
  const r = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM sync_queue WHERE retry_count >= ?',
    [MAX_RETRY]
  );
  return r?.count || 0;
}

// ============================================================
// 🔄 Reset failed items (กรณีต้องการลอง push ใหม่)
// ============================================================
export async function retryFailed() {
  const db = await getDB();
  await db.runAsync(
    'UPDATE sync_queue SET retry_count=0, last_error=\'\' WHERE retry_count >= ?',
    [MAX_RETRY]
  );
  return await push();
}