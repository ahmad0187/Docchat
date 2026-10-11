// PDF text extraction (one string per page) and page-aware chunking.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractPages(buffer) {
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    let text = '';
    for (const item of tc.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : (item.str && !item.str.endsWith(' ') ? ' ' : '');
    }
    pages.push(clean(text));
    page.cleanup();
  }
  await pdf.destroy();
  return stripRepeatedLines(pages);
}

// Removes running headers/footers: short lines that repeat on most pages (digits ignored,
// so "Page 3" and "Page 4" count as the same line). They add noise to every chunk.
function stripRepeatedLines(pages) {
  if (pages.length < 2) return pages;
  const key = (l) => l.trim().toLowerCase().replace(/\d+/g, '#');
  const counts = new Map();
  for (const p of pages) {
    for (const k of new Set(p.split('\n').map(key).filter((k) => k && k.length < 150))) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const need = Math.max(2, Math.ceil(pages.length * 0.6));
  const drop = new Set([...counts].filter(([, n]) => n >= need).map(([k]) => k));
  if (!drop.size) return pages;
  return pages.map((p) => p.split('\n').filter((l) => !drop.has(key(l))).join('\n').trim());
}

function clean(s) {
  return s
    .replace(/­/g, '')            // soft hyphens
    .replace(/(\w)-\n(\w)/g, '$1$2')   // words broken across lines
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Splits each page into chunks of up to ~maxChars (≈800 tokens at ~4 chars/token) with overlap.
 * Chunks never cross a page break, so every citation points to one exact page.
 */
export function chunkPages(pages, { maxChars = 3200, overlap = 400 } = {}) {
  const chunks = [];
  pages.forEach((text, i) => {
    const page = i + 1;
    if (!text || text.length < 20) return;
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + maxChars, text.length);
      if (end < text.length) {
        // Prefer ending at a paragraph, then a sentence, then a space.
        const winStart = start + Math.floor(maxChars * 0.6);
        const win = text.slice(winStart, end);
        let cut = win.lastIndexOf('\n\n');
        if (cut < 0) cut = Math.max(win.lastIndexOf('. ') + 1, win.lastIndexOf('\n'), win.lastIndexOf(' '));
        if (cut > 0) end = winStart + cut + 1;
      }
      const content = text.slice(start, end).trim();
      if (content.length >= 20) chunks.push({ content, page_start: page, page_end: page });
      if (end >= text.length) break;
      let next = end - overlap;
      const sp = text.indexOf(' ', next);
      if (sp > 0 && sp < end) next = sp + 1;   // don't start mid-word
      start = Math.max(next, start + 1);
    }
  });
  return chunks;
}
