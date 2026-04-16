// syncEngine.js
// ============================================================
// Sync Engine - ส่งข้อมูล sync_queue ขึ้น Supabase
// ============================================================

import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabaseClient';
import { dbRun, dbGetFirst, dbGetAll } from './db';
import { checkOnline } from './useNetwork';

let isSyncing = false;
const MAX_RETRY = 5;

const SYNC_TABLES = [
  'profiles', 'projects', 'project_members', 'tasks', 'gantt_tasks',
  'documents', 'workers', 'worker_records', 'diary_reports', 'weather_logs',
];

// ============================================================
// PUSH: ส่ง sync_queue → Supabase
// ============================================================
export async function push() {
  if (isSyncing) return { pushed: 0, failed: 0 };
  const online = await checkOnline();
  if (!online) return { pushed: 0, failed: 0 };

  isSyncing = true;
  let pushed = 0, failed = 0;

  try {
    const items = await dbGetAll(`SELECT * FROM sync_queue WHERE retry_count < ? ORDER BY id ASC LIMIT 50`, MAX_RETRY);

    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload);
        let error = null;

        normalizePayload(item.table_name, payload);

        if (item.action === 'insert') {
          const res = await supabase.from(item.table_name).upsert(payload, { onConflict: 'id' });
          error = res.error;
        } else if (item.action === 'update') {
          const { id, ...updateData } = payload;
          const res = await supabase.from(item.table_name).update(updateData).eq('id', id);
          error = res.error;
        } else if (item.action === 'delete') {
          const res = await supabase.from(item.table_name).delete().eq('id', payload.id);
          error = res.error;
        }

        if (error) {
          await dbRun(`UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`, error.message || String(error), item.id);
          failed++;
          console.log(`[Sync] ${item.table_name} ${item.action} failed:`, error.message);
        } else {
          await dbRun('DELETE FROM sync_queue WHERE id=?', item.id);
          if (item.action !== 'delete') {
            await dbRun(`UPDATE ${item.table_name} SET sync_status='synced' WHERE id=?`, item.row_id).catch(() => {});
          }
          pushed++;
        }
      } catch (e) {
        console.log('[Sync] push error:', e);
        await dbRun(`UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?`, e.message, item.id);
        failed++;
      }
    }
  } finally {
    isSyncing = false;
  }

  return { pushed, failed };
}

// ============================================================
// PULL: ดึงข้อมูลจาก Supabase → SQLite
// ============================================================
export async function pull() {
  const online = await checkOnline();
  if (!online) return { pulled: 0 };

  let pulled = 0;

  try {
    for (const table of SYNC_TABLES) {
      try {
        // เงื่อนไขพิเศษ: weather_logs ใช้ created_at แทน updated_at
        const timeCol = table === 'weather_logs' ? 'created_at' : 'updated_at';
        
        const latest = await dbGetFirst(`SELECT MAX(${timeCol}) AS max_time FROM ${table}`);
        const since = latest?.max_time || '1970-01-01T00:00:00Z';

        const { data, error } = await supabase.from(table).select('*').gt(timeCol, since).limit(500);

        if (error) {
          console.log(`[Sync] pull ${table} error:`, error.message);
          continue;
        }

        if (data && data.length > 0) {
          for (const row of data) {
            await upsertLocal(table, row);
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
// Helpers
// ============================================================
async function upsertLocal(table, row) {
  for (const key of Object.keys(row)) {
    if (typeof row[key] === 'boolean') row[key] = row[key] ? 1 : 0;
    if (row[key] && typeof row[key] === 'object') row[key] = JSON.stringify(row[key]);
  }

  // เงื่อนไขพิเศษ: weather_logs เช็กจาก created_at
  const timeCol = table === 'weather_logs' ? 'created_at' : 'updated_at';
  const existing = await dbGetFirst(`SELECT ${timeCol} FROM ${table} WHERE id=?`, row.id);
  
  if (existing && existing[timeCol] > row[timeCol]) return;

  const rowWithStatus = { ...row, sync_status: 'synced' };
  const keys = Object.keys(rowWithStatus);
  const placeholders = keys.map(() => '?').join(',');
  const updates = keys.map(k => `${k}=excluded.${k}`).join(',');
  const values = keys.map(k => rowWithStatus[k]);

  await dbRun(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
    values
  );
}

function normalizePayload(tableName, payload) {
  const booleanFields = { project_members: ['is_external'], gantt_tasks: ['is_milestone'] };
  const jsonFields = { project_members: ['permissions'], diary_reports: ['weather_data', 'photos'], weather_logs: ['raw_data'] };

  (booleanFields[tableName] || []).forEach(f => { if (payload[f] !== undefined) payload[f] = Boolean(payload[f]); });
  (jsonFields[tableName] || []).forEach(f => {
    if (typeof payload[f] === 'string') { try { payload[f] = JSON.parse(payload[f]); } catch {} }
  });
}

// ============================================================
// SYNC ALL
// ============================================================
export async function syncAll() {
  const online = await checkOnline();
  if (!online) return { success: false, reason: 'offline' };

  const pushResult = await push();
  const pullResult = await pull();

  return { success: true, pushed: pushResult.pushed, failed: pushResult.failed, pulled: pullResult.pulled };
}

// ============================================================
// AUTO SYNC
// ============================================================
let unsubscribe = null;
let syncInterval = null;

export function startAutoSync() {
  stopAutoSync();
  unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      console.log('[Sync] Network reconnected, syncing...');
      const result = await syncAll();
      console.log('[Sync] Result:', result);
    }
  });

  syncInterval = setInterval(async () => {
    const online = await checkOnline();
    if (online) {
      const pending = await getPendingCount();
      if (pending > 0) await push();
    }
  }, 30000);

  syncAll().then(r => console.log('[Sync] Initial sync:', r));
}

export function stopAutoSync() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}

// ============================================================
// STATS
// ============================================================
export async function getPendingCount() {
  const r = await dbGetFirst('SELECT COUNT(*) AS count FROM sync_queue WHERE retry_count < ?', MAX_RETRY);
  return r?.count || 0;
}

export async function getFailedCount() {
  const r = await dbGetFirst('SELECT COUNT(*) AS count FROM sync_queue WHERE retry_count >= ?', MAX_RETRY);
  return r?.count || 0;
}

export async function retryFailed() {
  await dbRun(`UPDATE sync_queue SET retry_count=0, last_error='' WHERE retry_count >= ?`, MAX_RETRY);
  return await push();
}