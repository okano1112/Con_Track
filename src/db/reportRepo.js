// src/db/reportRepo.js
// ============================================================
// Progress Report CRUD
// ============================================================

import { getDatabase } from './database';

export async function createReport({ projectId, reportedBy, title, content, progressPercent, weather, workersCount, issues, photoUris }) {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO progress_reports (project_id, reported_by, title, content, progress_percent, weather, workers_count, issues, photo_uris)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId, reportedBy || null, title.trim(), content?.trim() || '',
      progressPercent || 0, weather || '', workersCount || 0,
      issues?.trim() || '', JSON.stringify(photoUris || []),
    ]
  );

  // อัปเดต progress ของ project ด้วย
  if (progressPercent) {
    await db.runAsync(
      'UPDATE projects SET progress = ?, is_synced = 0, updated_at = datetime("now","localtime") WHERE id = ?',
      [progressPercent, projectId]
    );
  }

  return { id: result.lastInsertRowId };
}

export async function getReportsByProject(projectId) {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT pr.*, u.full_name as reporter_name
     FROM progress_reports pr
     LEFT JOIN users u ON pr.reported_by = u.id
     WHERE pr.project_id = ?
     ORDER BY pr.report_date DESC`,
    [projectId]
  );
}

export async function deleteReport(reportId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM progress_reports WHERE id = ?', [reportId]);
}
