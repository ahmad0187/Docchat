// Loads every PDF in a folder into a workspace (used for the public demo and the eval).
import fs from 'fs';
import path from 'path';
import { ingestPdf } from './rag.js';

export async function seedWorkspace(store, workspace, dir, { replace = true, log = console.log } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
  if (!files.length) throw new Error(`No PDFs found in ${dir}`);
  if (replace) {
    for (const d of await store.listDocuments(workspace)) {
      await store.deleteDocument(workspace, d.id);
      log(`  removed old: ${d.name}`);
    }
  }
  for (const f of files) {
    const d = await ingestPdf(store, { workspace, name: f, buffer: fs.readFileSync(path.join(dir, f)) });
    log(`  added: ${f} (${d.pages} pages, ${d.chunks} chunks)`);
  }
}
