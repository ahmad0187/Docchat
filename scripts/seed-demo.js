// Fills the public "demo" workspace with the PDFs in sample-docs/ (or a folder you pass).
// Usage: node scripts/seed-demo.js [folder]        (uses the same .env / env vars as the server)
import '../lib/env.js';
import path from 'path';
import { createStore } from '../lib/store.js';
import { seedWorkspace } from '../lib/seed.js';

const dir = path.resolve(process.argv[2] || 'sample-docs');
const store = createStore();
if (store.kind !== 'supabase') {
  console.log('Supabase is not configured, so there is nothing to seed (local mode seeds itself on start).');
  process.exit(0);
}
console.log(`Seeding demo workspace from ${dir}`);
await seedWorkspace(store, 'demo', dir);
console.log('Done. The demo is live.');
