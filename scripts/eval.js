// Accuracy test for the case study: asks eval/questions.json against a workspace and
// writes eval-results.md.
//
// Usage: node scripts/eval.js [workspace]      (default workspace: demo)
//
// A question passes when:
//   answerable   -> the answer contains every expected term AND cites the right document + page
//   unanswerable -> DocChat says "I don't know" instead of guessing
import '../lib/env.js';
import fs from 'fs';
import path from 'path';
import { createStore } from '../lib/store.js';
import { ask } from '../lib/rag.js';
import { aiMode, embedProvider } from '../lib/ai.js';
import { seedWorkspace } from '../lib/seed.js';

const workspace = process.argv[2] || 'demo';
const questions = JSON.parse(fs.readFileSync('eval/questions.json', 'utf8'));
const store = createStore();
if (store.kind === 'memory') await seedWorkspace(store, workspace, 'sample-docs', { log: () => {} });

const rows = [];
let tokensIn = 0, tokensOut = 0;
for (const [i, t] of questions.entries()) {
  const t0 = Date.now();
  let r, error;
  try { r = await ask(store, workspace, t.q); } catch (e) { error = e.message; }
  const ms = Date.now() - t0;
  let pass = false, why = '';
  if (error) why = `error: ${error}`;
  else if (t.unanswerable) {
    pass = !r.grounded;
    why = pass ? 'said "I don\'t know"' : 'answered when it should have refused';
  } else {
    const text = r.answer.toLowerCase();
    const missing = t.expect.filter((alts) => !alts.split('|').some((a) => text.includes(a.toLowerCase())));
    const citedRight = r.sources.some((s) => s.document === t.doc && s.page === t.page);
    pass = r.grounded && !missing.length && citedRight;
    why = !r.grounded ? 'said "I don\'t know"' : missing.length ? `missing: ${missing.join(', ')}` : !citedRight ? 'wrong or missing page citation' : 'correct + right page';
  }
  if (r?.usage) { tokensIn += r.usage.input_tokens || 0; tokensOut += r.usage.output_tokens || 0; }
  rows.push({ n: i + 1, q: t.q, pass, why, ms, answer: error ? '' : r.answer, cites: error ? '' : r.sources.map((s) => `${s.document} p.${s.page}`).join('; ') });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${String(i + 1).padStart(2)}. ${t.q}  (${why}, ${ms} ms)`);
}

const passed = rows.filter((r) => r.pass).length;
const ans = rows.filter((_, i) => !questions[i].unanswerable);
const una = rows.filter((_, i) => questions[i].unanswerable);
const avgMs = Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length);
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ');

const md = `# DocChat accuracy test

- **Date:** ${new Date().toISOString().slice(0, 10)}
- **Mode:** ${aiMode === 'mock' ? 'offline mock (NOT the real AI; run again with API keys for the case study)' : `live (${embedProvider} embeddings + ${process.env.CLAUDE_MODEL || 'claude-haiku-5-5'})`}
- **Documents:** ${[...new Set(questions.filter((q) => q.doc).map((q) => q.doc))].join(', ')}

## Score: ${passed}/${rows.length} (${Math.round((passed / rows.length) * 100)}%)

| | Result |
|---|---|
| Answerable questions correct, with the right page cited | ${ans.filter((r) => r.pass).length}/${ans.length} |
| Unanswerable questions correctly refused ("I don't know") | ${una.filter((r) => r.pass).length}/${una.length} |
| Average response time | ${(avgMs / 1000).toFixed(2)} s |
| Claude tokens used (all ${rows.length} questions) | ${tokensIn.toLocaleString()} in / ${tokensOut.toLocaleString()} out |

## Every question

| # | Question | Result | Why | Cited | Answer |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.n} | ${cell(r.q)} | ${r.pass ? 'PASS' : 'FAIL'} | ${cell(r.why)} | ${cell(r.cites)} | ${cell(r.answer)} |`).join('\n')}
`;
fs.writeFileSync('eval-results.md', md);
console.log(`\nScore: ${passed}/${rows.length}. Wrote ${path.resolve('eval-results.md')}`);
