// Storage backends. "supabase" for production (Postgres + pgvector + Storage);
// "memory" for local testing with no accounts (data is lost on restart).
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export function createStore() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return supabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  return memoryStore();
}

// ---------------------------------------------------------------- Supabase
function supabaseStore(sb) {
  const BUCKET = 'documents';
  const ok = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data; };

  return {
    kind: 'supabase',
    supabase: sb,

    async createDocument({ workspace, name, sizeBytes }) {
      const id = randomUUID();
      return ok(await sb.from('documents').insert({
        id, workspace_id: workspace, name, size_bytes: sizeBytes, storage_path: `${workspace}/${id}.pdf`,
      }).select().single(), 'create document');
    },

    async saveFile(doc, buffer) {
      ok(await sb.storage.from(BUCKET).upload(doc.storage_path, buffer, { contentType: 'application/pdf', upsert: true }), 'upload PDF');
    },

    async insertChunks(doc, chunks) {
      for (let i = 0; i < chunks.length; i += 100) {
        const rows = chunks.slice(i, i + 100).map((c) => ({
          document_id: doc.id, workspace_id: doc.workspace_id,
          page_start: c.page_start, page_end: c.page_end, content: c.content,
          embedding: JSON.stringify(c.embedding),
        }));
        ok(await sb.from('chunks').insert(rows), 'save chunks');
      }
    },

    async updateDocument(id, fields) {
      ok(await sb.from('documents').update(fields).eq('id', id), 'update document');
    },

    async listDocuments(workspace) {
      return ok(await sb.from('documents').select('id,name,pages,size_bytes,status,error,created_at')
        .eq('workspace_id', workspace).order('created_at', { ascending: false }), 'list documents');
    },

    async getDocument(workspace, id) {
      const { data } = await sb.from('documents').select('*').eq('workspace_id', workspace).eq('id', id).maybeSingle();
      return data;
    },

    async deleteDocument(workspace, id) {
      const doc = await this.getDocument(workspace, id);
      if (!doc) return false;
      if (doc.storage_path) await sb.storage.from(BUCKET).remove([doc.storage_path]);
      ok(await sb.from('documents').delete().eq('id', id).eq('workspace_id', workspace), 'delete document');
      return true;
    },

    async match(workspace, embedding, k) {
      return ok(await sb.rpc('match_chunks', { p_workspace: workspace, p_embedding: JSON.stringify(embedding), p_k: k }), 'search');
    },

    async fileUrls(paths) {
      // One signed URL per distinct file, valid for 1 hour.
      const uniq = [...new Set(paths.filter(Boolean))];
      if (!uniq.length) return {};
      const data = ok(await sb.storage.from(BUCKET).createSignedUrls(uniq, 3600), 'sign URLs');
      return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
    },

    async verifyUser(token) {
      if (!token) return null;
      const { data, error } = await sb.auth.getUser(token);
      return error ? null : data.user;
    },
  };
}

// ---------------------------------------------------------------- In-memory
function memoryStore() {
  const docs = new Map();      // id -> doc
  const files = new Map();     // id -> Buffer
  let chunks = [];             // { ...chunk, document_id, workspace_id }
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

  return {
    kind: 'memory',

    async createDocument({ workspace, name, sizeBytes }) {
      const id = randomUUID();
      const doc = { id, workspace_id: workspace, name, pages: 0, size_bytes: sizeBytes, storage_path: id, status: 'processing', error: null, created_at: new Date().toISOString() };
      docs.set(id, doc);
      return doc;
    },
    async saveFile(doc, buffer) { files.set(doc.id, buffer); },
    async insertChunks(doc, list) {
      chunks.push(...list.map((c) => ({ ...c, document_id: doc.id, workspace_id: doc.workspace_id })));
    },
    async updateDocument(id, fields) { Object.assign(docs.get(id) || {}, fields); },
    async listDocuments(workspace) {
      return [...docs.values()].filter((d) => d.workspace_id === workspace)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(({ storage_path, workspace_id, ...d }) => d);
    },
    async getDocument(workspace, id) {
      const d = docs.get(id);
      return d && d.workspace_id === workspace ? d : null;
    },
    async deleteDocument(workspace, id) {
      if (!(await this.getDocument(workspace, id))) return false;
      docs.delete(id); files.delete(id);
      chunks = chunks.filter((c) => c.document_id !== id);
      return true;
    },
    async match(workspace, embedding, k) {
      return chunks
        .filter((c) => c.workspace_id === workspace && docs.get(c.document_id)?.status === 'ready')
        .map((c) => {
          const d = docs.get(c.document_id);
          return { id: c.document_id + ':' + c.page_start, document_id: c.document_id, doc_name: d.name, storage_path: d.storage_path,
            page_start: c.page_start, page_end: c.page_end, content: c.content, similarity: dot(c.embedding, embedding) };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k);
    },
    async fileUrls(paths) {
      return Object.fromEntries(paths.filter(Boolean).map((p) => [p, `/api/files/${p}`]));
    },
    getFile(id) { return files.get(id); },
    async verifyUser() { return null; },
  };
}
