// DocChat server: upload PDFs, ask questions, get answers with page citations.
import './lib/env.js';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStore } from './lib/store.js';
import { ingestPdf, ask, userError } from './lib/rag.js';
import { aiMode } from './lib/ai.js';
import { seedWorkspace } from './lib/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 10);
const MAX_DOCS = Number(process.env.MAX_DOCS_PER_WORKSPACE || 20);
const DEMO_PER_HOUR = Number(process.env.DEMO_QUESTIONS_PER_HOUR || 20);
const DEMO_PER_DAY = Number(process.env.DEMO_QUESTIONS_PER_DAY_TOTAL || 500);
const USER_PER_HOUR = Number(process.env.USER_QUESTIONS_PER_HOUR || 120);
const DEMO = 'demo';

const store = createStore();
const authEnabled = store.kind === 'supabase';
const app = express();
app.set('trust proxy', 1);           // behind Hostinger's proxy: use the real client IP
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});

// ---------------------------------------------------------------- helpers
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Which workspace does this request act on? Signed-in users get their own (their user id).
async function resolveWorkspace(req, { allowDemo }) {
  const which = req.query.workspace || req.body?.workspace || 'mine';
  if (which === DEMO) {
    if (!allowDemo) throw userError('The demo workspace is read-only.', 403);
    return { workspace: DEMO, isDemo: true };
  }
  if (!authEnabled) return { workspace: 'local', isDemo: false };      // local testing: no login
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await store.verifyUser(token);
  if (!user) throw userError('Please sign in to use your own documents.', 401);
  return { workspace: user.id, isDemo: false, user };
}

// Tiny sliding-window rate limiter (per process; fine for a single Hostinger app).
const hits = new Map();
function allow(key, limit, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= limit) { hits.set(key, list); return false; }
  list.push(now); hits.set(key, list); return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 86400000)) hits.delete(k); }, 3600000).unref();

// ---------------------------------------------------------------- API
app.get('/api/health', (req, res) => res.json({ ok: true, store: store.kind, ai: aiMode }));

app.get('/api/config', (req, res) => res.json({
  authEnabled,
  supabaseUrl: authEnabled ? process.env.SUPABASE_URL : null,
  supabaseAnonKey: authEnabled ? process.env.SUPABASE_ANON_KEY || null : null,
  maxFileMb: MAX_FILE_MB,
  maxDocs: MAX_DOCS,
  aiMode,
  demo: {
    title: process.env.DEMO_TITLE || 'Bright Smile Dental (fictional clinic)',
    suggestions: [
      'What is the cancellation fee?',
      'Do you accept Medicaid?',
      'How much is teeth whitening?',
      'What should I do if a tooth is knocked out?',
      'How many sick days do staff get?',
    ],
  },
}));

app.get('/api/documents', wrap(async (req, res) => {
  const { workspace } = await resolveWorkspace(req, { allowDemo: true });
  res.json({ documents: await store.listDocuments(workspace) });
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, /pdf$/i.test(file.mimetype) || /\.pdf$/i.test(file.originalname)),
});

app.post('/api/documents', upload.single('file'), wrap(async (req, res) => {
  const { workspace } = await resolveWorkspace(req, { allowDemo: false });
  if (!req.file) throw userError('Choose a PDF file to upload.');
  const existing = await store.listDocuments(workspace);
  if (existing.length >= MAX_DOCS) throw userError(`Your plan allows ${MAX_DOCS} documents. Delete one to upload another.`, 403);
  if (!allow(`up:${workspace}`, 30, 3600000)) throw userError('Too many uploads this hour. Try again later.', 429);
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8').replace(/[\\/<>"]/g, '_').slice(0, 150);
  const doc = await ingestPdf(store, { workspace, name, buffer: req.file.buffer });
  res.status(201).json({ document: { id: doc.id, name: doc.name, pages: doc.pages, chunks: doc.chunks, status: doc.status } });
}));

app.delete('/api/documents/:id', wrap(async (req, res) => {
  const { workspace } = await resolveWorkspace(req, { allowDemo: false });
  const ok = await store.deleteDocument(workspace, req.params.id);
  if (!ok) throw userError('Document not found.', 404);
  res.json({ ok: true });
}));

app.post('/api/chat', wrap(async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) throw userError('Type a question first.');
  if (question.length > 500) throw userError('Please keep questions under 500 characters.');
  const { workspace, isDemo } = await resolveWorkspace(req, { allowDemo: true });
  if (isDemo) {
    if (!allow(`demo:${req.ip}`, DEMO_PER_HOUR, 3600000)) throw userError(`The demo allows ${DEMO_PER_HOUR} questions per hour. Sign up to keep going with your own documents.`, 429);
    if (!allow('demo:all', DEMO_PER_DAY, 86400000)) throw userError('The public demo has reached its daily limit. Please try again tomorrow.', 429);
  } else if (!allow(`user:${workspace}`, USER_PER_HOUR, 3600000)) {
    throw userError('You have reached the hourly question limit. Try again shortly.', 429);
  }
  const t0 = Date.now();
  const result = await ask(store, workspace, question);
  res.json({ ...result, ms: Date.now() - t0 });
}));

// In memory mode the PDFs are served by the app itself (Supabase mode uses signed URLs).
app.get('/api/files/:id', (req, res) => {
  if (store.kind !== 'memory') return res.status(404).end();
  const buf = store.getFile(req.params.id);
  if (!buf) return res.status(404).end();
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' }).send(buf);
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));

// Errors: friendly messages for expected problems, a generic one for everything else.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .json({ error: err.code === 'LIMIT_FILE_SIZE' ? `Files must be under ${MAX_FILE_MB} MB.` : err.message });
  }
  if (err.expose) return res.status(err.status || 400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, async () => {
  console.log(`DocChat on http://localhost:${PORT}  (store: ${store.kind}, ai: ${aiMode})`);
  if (store.kind === 'memory') {
    console.log('  No Supabase configured: using in-memory storage (data resets on restart).');
    await seedWorkspace(store, DEMO, path.join(__dirname, 'sample-docs'), { replace: false, log: (m) => console.log('  demo' + m.replace(/^ +added/, ''))}).catch((e) => console.error('  demo seed failed:', e.message));
  }
});

export { app, store };
