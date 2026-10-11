// The RAG pipeline: ingest a PDF, and answer a question from one workspace's chunks.
import { extractPages, chunkPages } from './pdf.js';
import { embed, answer, IDK, aiMode } from './ai.js';

const TOP_K = Number(process.env.TOP_K || 5);
// Chunks less similar than this are ignored. If nothing passes, we answer "I don't know"
// without calling Claude at all (saves money on off-topic questions).
const MIN_SIMILARITY = Number(process.env.MIN_SIMILARITY || (aiMode === 'mock' ? 0.12 : 0.25));
const MAX_PAGES = Number(process.env.MAX_PAGES || 300);

export async function ingestPdf(store, { workspace, name, buffer }) {
  if (buffer.subarray(0, 5).toString() !== '%PDF-') throw userError('That file is not a PDF.');
  const doc = await store.createDocument({ workspace, name, sizeBytes: buffer.length });
  try {
    await store.saveFile(doc, buffer);
    let pages;
    try { pages = await extractPages(buffer); }
    catch (e) { throw userError(/password/i.test(e.message) ? 'This PDF is password-protected.' : 'Could not read this PDF.'); }
    if (pages.length > MAX_PAGES) throw userError(`This PDF has ${pages.length} pages; the limit is ${MAX_PAGES}.`);
    if (pages.join('').replace(/\s/g, '').length < 50) {
      throw userError('No selectable text found. This looks like a scanned PDF; run it through OCR first.');
    }
    const chunks = chunkPages(pages);
    // Prefixing the title and page helps retrieval for questions like "what does the price list say about…".
    const vectors = await embed(chunks.map((c) => `${name} (page ${c.page_start})\n${c.content}`));
    chunks.forEach((c, i) => { c.embedding = vectors[i]; });
    await store.insertChunks(doc, chunks);
    await store.updateDocument(doc.id, { status: 'ready', pages: pages.length, error: null });
    return { ...doc, status: 'ready', pages: pages.length, chunks: chunks.length };
  } catch (e) {
    await store.updateDocument(doc.id, { status: 'failed', error: e.expose ? e.message : 'Processing failed' }).catch(() => {});
    throw e;
  }
}

export async function ask(store, workspace, question) {
  const [qvec] = await embed([question]);
  const matches = await store.match(workspace, qvec, TOP_K);
  const relevant = matches.filter((m) => m.similarity >= MIN_SIMILARITY);
  if (!relevant.length) return { answer: IDK, sources: [], grounded: false, retrieved: matches.length };

  const { text, usage } = await answer(question, relevant);
  const refused = text.toLowerCase().startsWith("i don't know") || text.toLowerCase().startsWith('i do not know');

  // Keep the original numbering so the [n] markers in the answer match the source chips.
  const cited = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const urls = await store.fileUrls(relevant.map((r) => r.storage_path));
  const sources = refused ? [] : relevant
    .map((r, i) => ({
      n: i + 1,
      cited: cited.has(i + 1),
      document_id: r.document_id,
      document: r.doc_name,
      page: r.page_start,
      similarity: Math.round(r.similarity * 1000) / 1000,
      snippet: snippet(r.content, question),
      url: urls[r.storage_path] ? `${urls[r.storage_path]}#page=${r.page_start}` : null,
    }))
    .filter((s) => s.cited || cited.size === 0);

  return { answer: text, sources, grounded: !refused, usage };
}

// ~300 characters of the chunk around the words that best match the question.
function snippet(content, question) {
  const flat = content.replace(/\s+/g, ' ').trim();
  const words = (question.toLowerCase().match(/[a-z0-9$]{4,}/g) || []);
  let at = -1;
  for (const w of words) { const i = flat.toLowerCase().indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  let start = Math.max(0, (at < 0 ? 0 : at) - 100);
  if (start > 0) { const sp = flat.indexOf(' ', start); if (sp > 0 && sp < start + 30) start = sp + 1; }
  const s = flat.slice(start, start + 300);
  return (start > 0 ? '…' : '') + s + (start + 300 < flat.length ? '…' : '');
}

export function userError(message, status = 400) {
  const e = new Error(message); e.expose = true; e.status = status; return e;
}
