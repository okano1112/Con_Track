// src/db/taskRepo.js
// ============================================================
// Task CRUD
// ============================================================

import { getDatabase } from './database';

export async function createTask({ projectId, assignedTo, title, description, priority, status, dueDate }) {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO tasks (project_id, assigned_to, title, description, priority, status, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, assignedTo || null, title.trim(), description?.trim() || '', priority || 'medium', status || 'todo', dueDate || '']
  );
  return { id: result.lastInsertRowId };
}

export async function getTasksByProject(projectId) {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT t.*, u.full_name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.project_id = ?
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       t.created_at DESC`,
    [projectId]
  );
}

export async function updateTask(taskId, data) {
  const db = await getDatabase();
  const fields = [];
  const values = [];

  const allowedFields = {
    title: 'title', description: 'description', priority: 'priority',
    status: 'status', assignedTo: 'assigned_to', dueDate: 'due_date',
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(data[key]);
    }
  }

  // ถ้าเปลี่ยนเป็น done ให้บันทึก completed_at
  if (data.status === 'done') {
    fields.push("completed_at = datetime('now','localtime')");
  } else if (data.status && data.status !== 'done') {
    fields.push("completed_at = ''");
  }

  if (fields.length === 0) return;
  
  fields.push('is_synced = 0');
  values.push(taskId);

  await db.runAsync(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function toggleTaskStatus(taskId) {
  const db = await getDatabase();
  const task = await db.getFirstAsync('SELECT status FROM tasks WHERE id = ?', [taskId]);
  if (!task) return;

  const nextStatus = task.status === 'done' ? 'todo' : 'done';
  await updateTask(taskId, { status: nextStatus });
}

export async function deleteTask(taskId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]);
}

export async function getTasksForUser(userId) {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT t.*, p.name as project_name
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE t.assigned_to = ?
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       t.due_date ASC`,
    [userId]
  );
}
