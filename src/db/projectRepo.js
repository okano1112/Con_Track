// src/db/projectRepo.js
// ============================================================
// Project CRUD
// ============================================================

import { getDatabase } from './database';

// ============================================================
// CREATE
// ============================================================
export async function createProject({ name, description, location, budget, startDate, endDate, status, managerId }) {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO projects (name, description, location, budget, start_date, end_date, status, manager_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      description?.trim() || '',
      location?.trim() || '',
      budget || 0,
      startDate || '',
      endDate || '',
      status || 'planning',
      managerId || null,
    ]
  );
  return { id: result.lastInsertRowId };
}

// ============================================================
// READ
// ============================================================
export async function getAllProjects(statusFilter = null) {
  const db = await getDatabase();

  let query = `
    SELECT p.*, u.full_name as manager_name,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as done_count,
      (SELECT COUNT(*) FROM documents WHERE project_id = p.id) as doc_count,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    LEFT JOIN users u ON p.manager_id = u.id
  `;

  if (statusFilter && statusFilter !== 'all') {
    query += ` WHERE p.status = '${statusFilter}'`;
  }

  query += ' ORDER BY p.updated_at DESC';

  return await db.getAllAsync(query);
}

export async function getProjectById(projectId) {
  const db = await getDatabase();

  const project = await db.getFirstAsync(
    `SELECT p.*, u.full_name as manager_name
     FROM projects p
     LEFT JOIN users u ON p.manager_id = u.id
     WHERE p.id = ?`,
    [projectId]
  );

  if (!project) throw new Error('ไม่พบโครงการ');

  // ดึง tasks
  const tasks = await db.getAllAsync(
    `SELECT t.*, u.full_name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.project_id = ?
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       t.created_at DESC`,
    [projectId]
  );

  // ดึง documents
  const documents = await db.getAllAsync(
    `SELECT d.*, u.full_name as uploader_name
     FROM documents d
     LEFT JOIN users u ON d.uploaded_by = u.id
     WHERE d.project_id = ?
     ORDER BY d.created_at DESC`,
    [projectId]
  );

  // ดึง members
  const members = await db.getAllAsync(
    `SELECT pm.*, u.full_name, u.position, u.phone
     FROM project_members pm
     JOIN users u ON pm.user_id = u.id
     WHERE pm.project_id = ?
     ORDER BY pm.role, u.full_name`,
    [projectId]
  );

  // ดึง progress reports
  const reports = await db.getAllAsync(
    `SELECT pr.*, u.full_name as reporter_name
     FROM progress_reports pr
     LEFT JOIN users u ON pr.reported_by = u.id
     WHERE pr.project_id = ?
     ORDER BY pr.report_date DESC`,
    [projectId]
  );

  return { ...project, tasks, documents, members, reports };
}

export async function searchProjects(keyword) {
  const db = await getDatabase();
  const term = `%${keyword}%`;
  return await db.getAllAsync(
    `SELECT p.*, u.full_name as manager_name
     FROM projects p
     LEFT JOIN users u ON p.manager_id = u.id
     WHERE p.name LIKE ? OR p.description LIKE ? OR p.location LIKE ?
     ORDER BY p.updated_at DESC`,
    [term, term, term]
  );
}

// ============================================================
// UPDATE
// ============================================================
export async function updateProject(projectId, data) {
  const db = await getDatabase();
  const fields = [];
  const values = [];

  const allowedFields = {
    name: 'name', description: 'description', location: 'location',
    budget: 'budget', startDate: 'start_date', endDate: 'end_date',
    progress: 'progress', status: 'status', managerId: 'manager_id',
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return;

  fields.push('is_synced = 0');
  fields.push("updated_at = datetime('now','localtime')");
  values.push(projectId);

  await db.runAsync(
    `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// ============================================================
// DELETE
// ============================================================
export async function deleteProject(projectId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM projects WHERE id = ?', [projectId]);
}

// ============================================================
// Dashboard Stats
// ============================================================
export async function getDashboardStats() {
  const db = await getDatabase();

  const projectStats = await db.getFirstAsync(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as on_hold,
      SUM(CASE WHEN status = 'planning' THEN 1 ELSE 0 END) as planning
    FROM projects
  `);

  const taskStats = await db.getFirstAsync(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN priority = 'urgent' AND status != 'done' THEN 1 ELSE 0 END) as urgent
    FROM tasks
  `);

  const docCount = await db.getFirstAsync('SELECT COUNT(*) as total FROM documents');
  const memberCount = await db.getFirstAsync('SELECT COUNT(*) as total FROM users');

  const recentProjects = await db.getAllAsync(
    `SELECT p.*, u.full_name as manager_name
     FROM projects p
     LEFT JOIN users u ON p.manager_id = u.id
     ORDER BY p.updated_at DESC LIMIT 5`
  );

  return {
    projects: projectStats,
    tasks: taskStats,
    documents: { total: docCount?.total || 0 },
    members: { total: memberCount?.total || 0 },
    recentProjects,
  };
}
