// src/db/documentRepo.js
// ============================================================
// Document CRUD
// ============================================================

import { getDatabase } from './database';

export async function createDocument({ projectId, uploadedBy, name, category, fileUri, fileSize, fileType, notes }) {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO documents (project_id, uploaded_by, name, category, file_uri, file_size, file_type, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, uploadedBy || null, name.trim(), category || 'other', fileUri || '', fileSize || 0, fileType || '', notes?.trim() || '']
  );
  return { id: result.lastInsertRowId };
}

export async function getDocumentsByProject(projectId, categoryFilter = null) {
  const db = await getDatabase();
  let query = `
    SELECT d.*, u.full_name as uploader_name
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    WHERE d.project_id = ?
  `;
  const params = [projectId];

  if (categoryFilter && categoryFilter !== 'all') {
    query += ' AND d.category = ?';
    params.push(categoryFilter);
  }

  query += ' ORDER BY d.created_at DESC';
  return await db.getAllAsync(query, params);
}

export async function getAllDocuments(categoryFilter = null) {
  const db = await getDatabase();
  let query = `
    SELECT d.*, u.full_name as uploader_name, p.name as project_name
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    LEFT JOIN projects p ON d.project_id = p.id
  `;
  const params = [];

  if (categoryFilter && categoryFilter !== 'all') {
    query += ' WHERE d.category = ?';
    params.push(categoryFilter);
  }

  query += ' ORDER BY d.created_at DESC';
  return await db.getAllAsync(query, params);
}

export async function deleteDocument(docId) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM documents WHERE id = ?', [docId]);
}

export async function searchDocuments(keyword) {
  const db = await getDatabase();
  const term = `%${keyword}%`;
  return await db.getAllAsync(
    `SELECT d.*, u.full_name as uploader_name, p.name as project_name
     FROM documents d
     LEFT JOIN users u ON d.uploaded_by = u.id
     LEFT JOIN projects p ON d.project_id = p.id
     WHERE d.name LIKE ? OR d.notes LIKE ?
     ORDER BY d.created_at DESC`,
    [term, term]
  );
}
