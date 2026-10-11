// DocChat front end (no build step).
(() => {
  const $ = (id) => document.getElementById(id);
  const state = { cfg: null, mode: 'demo', sb: null, session: null, docs: [], threads: { demo: [], mine: [] }, busy: false, signUp: false };

  // ------------------------------------------------------------ API
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (state.session?.access_token) headers.authorization = `Bearer ${state.session.access_token}`;
    if (opts.json) { headers['content-type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
    const res = await fetch(path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || `Request failed (${res.status})`); e.status = res.status; throw e; }
    return data;
  }
  const ws = () => (state.mode === 'demo' ? 'demo' : 'mine');
  const canUseMine = () => !state.cfg.authEnabled || !!state.session;

  // ------------------------------------------------------------ boot
  async function boot() {
    state.cfg = await api('/api/config');
    $('limits').textContent = `PDF up to ${state.cfg.maxFileMb} MB · ${state.cfg.maxDocs} documents`;
    if (state.cfg.authEnabled && state.cfg.supabaseAnonKey && window.supabase) {
      state.sb = window.supabase.createClient(state.cfg.supabaseUrl, state.cfg.supabaseAnonKey);
      const { data } = await state.sb.auth.getSession();
      state.session = data.session;
      state.sb.auth.onAuthStateChange((_e, session) => {
        const was = !!state.session; state.session = session; renderAuth();
        if (was !== !!session) { state.threads.mine = []; if (state.mode === 'mine') setMode('mine'); }
      });
      $('authBtn').hidden = false;
    }
    renderAuth();
    setMode('demo');
  }

  // ------------------------------------------------------------ workspace switch
  function setMode(mode) {
    state.mode = mode;
    $('tabDemo').setAttribute('aria-pressed', mode === 'demo');
    $('tabMine').setAttribute('aria-pressed', mode === 'mine');
    $('uploadWrap').hidden = mode === 'demo' || !canUseMine();
    $('docsLabel').textContent = mode === 'demo' ? 'Demo documents' : 'Your documents';
    $('sideNote').innerHTML = mode === 'demo'
      ? `<b>This is a live demo.</b> The documents belong to a fictional dental clinic. Click a source under any answer to open the PDF at that page.${state.cfg.authEnabled ? ' Switch to <b>My documents</b> to try your own PDFs.' : ''}`
      : canUseMine()
        ? `<b>Private to you.</b> Only questions you ask in this workspace can see these documents.${state.cfg.authEnabled ? '' : ' (Local test mode: no login, data resets when the server restarts.)'}`
        : `<b>Sign in to upload your own PDFs.</b> Each account gets its own private workspace.`;
    $('q').placeholder = mode === 'demo' ? 'Ask about the clinic documents…' : 'Ask a question about your documents…';
    loadDocs();
    renderThread();
  }
  $('tabDemo').onclick = () => setMode('demo');
  $('tabMine').onclick = () => { setMode('mine'); if (!canUseMine()) openAuth(); };

  // ------------------------------------------------------------ documents
  async function loadDocs() {
    const list = $('docs');
    if (state.mode === 'mine' && !canUseMine()) { state.docs = []; list.innerHTML = ''; return; }
    try {
      const { documents } = await api(`/api/documents?workspace=${ws()}`);
      state.docs = documents;
      renderDocs();
    } catch (e) { list.innerHTML = `<li class="note err">${esc(e.message)}</li>`; }
  }
  function renderDocs(pending = []) {
    const list = $('docs');
    const rows = [...pending, ...state.docs];
    if (!rows.length) {
      list.innerHTML = `<li class="note">${state.mode === 'demo' ? 'No demo documents loaded yet.' : 'No documents yet. Upload a PDF to start asking questions.'}</li>`;
      return;
    }
    list.innerHTML = rows.map((d) => `
      <li class="doc">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>
        <div class="meta">
          <div class="name" title="${esc(d.name)}">${esc(d.name)}</div>
          ${d.status === 'processing' ? '<div class="sub"><span class="spin"></span>Reading and indexing…</div>'
            : d.status === 'failed' ? `<div class="sub err">${esc(d.error || 'Failed')}</div>`
            : `<div class="sub">${d.pages} page${d.pages === 1 ? '' : 's'}${d.size_bytes ? ' · ' + fmtSize(d.size_bytes) : ''}</div>`}
        </div>
        ${state.mode === 'mine' && d.id ? `<button class="x" data-del="${d.id}" title="Delete" aria-label="Delete ${esc(d.name)}">×</button>` : ''}
      </li>`).join('');
  }
  $('docs').addEventListener('click', async (e) => {
    const id = e.target.closest('[data-del]')?.dataset.del;
    if (!id) return;
    const doc = state.docs.find((d) => d.id === id);
    if (!window.confirm(`Delete "${doc?.name}"? DocChat will stop using it in answers.`)) return;
    try { await api(`/api/documents/${id}`, { method: 'DELETE' }); loadDocs(); }
    catch (err) { alertSide(err.message); }
  });

  async function uploadFile(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) return alertSide('Only PDF files are supported.');
    if (file.size > state.cfg.maxFileMb * 1048576) return alertSide(`Files must be under ${state.cfg.maxFileMb} MB.`);
    renderDocs([{ name: file.name, status: 'processing' }]);
    const fd = new FormData(); fd.append('file', file);
    try { await api('/api/documents', { method: 'POST', body: fd }); }
    catch (e) { alertSide(e.message); }
    loadDocs();
  }
  function alertSide(msg) { $('sideNote').innerHTML = `<span class="err">${esc(msg)}</span>`; }
  $('file').onchange = (e) => { uploadFile(e.target.files[0]); e.target.value = ''; };
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => uploadFile(e.dataTransfer.files[0]));

  // ------------------------------------------------------------ chat
  function renderThread() {
    const inner = $('inner');
    const thread = state.threads[state.mode];
    if (!thread.length) {
      const demo = state.mode === 'demo';
      inner.innerHTML = `<div class="empty">
        <h1>${demo ? 'Ask the clinic’s documents' : 'Ask your documents'}</h1>
        <p>${demo ? `${esc(state.cfg.demo.title)}: a patient handbook, a price list and a staff manual. Every answer shows the page it came from.`
                  : 'Upload PDFs on the left, then ask anything. Answers cite the document and page, and DocChat says “I don’t know” rather than guess.'}</p>
        ${demo ? `<div class="sugg">${state.cfg.demo.suggestions.map((s) => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      </div>`;
      return;
    }
    inner.innerHTML = thread.map(renderTurn).join('');
    $('thread').scrollTop = $('thread').scrollHeight;
  }
  function renderTurn(t, i) {
    const q = `<div class="q">${esc(t.q)}</div>`;
    if (t.pending) return q + `<div class="a"><div class="typing"><i></i><i></i><i></i></div></div>`;
    if (t.error) return q + `<div class="a"><div class="err">${esc(t.error)}</div></div>`;
    const r = t.r;
    const srcs = r.sources || [];
    return q + `<div class="a" data-turn="${i}">
      ${r.grounded ? '' : '<div class="idk">Not found in the documents</div>'}
      <div class="text">${formatAnswer(r.answer, srcs, i)}</div>
      ${srcs.length ? `<div class="sources">${srcs.map((s) => `
        <a class="src" id="src-${i}-${s.n}" ${s.url ? `href="${esc(s.url)}" target="_blank" rel="noopener"` : ''}>
          <div class="n">${s.n}</div>
          <div><div class="t">${esc(s.document)} <span>· page ${s.page}</span></div><div class="s">${esc(s.snippet)}</div></div>
        </a>`).join('')}</div>` : ''}
      <div class="foot">${r.grounded ? `Answered from ${new Set(srcs.map((s) => s.document)).size || 0} document${new Set(srcs.map((s) => s.document)).size === 1 ? '' : 's'}` : 'DocChat only answers from the uploaded documents'} · ${(r.ms / 1000).toFixed(1)}s</div>
    </div>`;
  }
  // Escape, then light markdown (bold, lists, paragraphs), then turn [n] into citation buttons.
  function formatAnswer(text, sources, turn) {
    const known = new Set(sources.map((s) => s.n));
    const blocks = esc(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').split(/\n{2,}/);
    const html = blocks.map((b) => {
      const lines = b.split('\n');
      if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${l.replace(/^\s*([-*•]|\d+\.)\s+/, '')}</li>`).join('')}</ul>`;
      return `<p>${lines.join('<br>')}</p>`;
    }).join('');
    return html.replace(/\[(\d+)\]/g, (m, n) => known.has(Number(n))
      ? `<button type="button" class="cite" data-cite="${turn}-${n}" title="Show source ${n}">${n}</button>` : '');
  }
  $('inner').addEventListener('click', (e) => {
    const s = e.target.closest('[data-s]');
    if (s) { $('q').value = s.dataset.s; $('askForm').requestSubmit(); return; }
    const c = e.target.closest('[data-cite]');
    if (c) {
      const el = $(`src-${c.dataset.cite}`);
      if (!el) return;
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200);
    }
  });

  $('askForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = $('q').value.trim();
    if (!question || state.busy) return;
    if (state.mode === 'mine' && !canUseMine()) return openAuth();
    const mode = state.mode;
    const turn = { q: question, pending: true };
    state.threads[mode].push(turn);
    $('q').value = ''; state.busy = true; $('send').disabled = true;
    renderThread();
    try { turn.r = await api('/api/chat', { method: 'POST', json: { question, workspace: mode === 'demo' ? 'demo' : 'mine' } }); }
    catch (err) { turn.error = err.message; }
    turn.pending = false; state.busy = false; $('send').disabled = false;
    if (state.mode === mode) renderThread();
    $('q').focus();
  });

  // ------------------------------------------------------------ auth
  function renderAuth() {
    if (!state.cfg.authEnabled) return;
    $('who').textContent = state.session?.user?.email || '';
    $('authBtn').textContent = state.session ? 'Sign out' : 'Sign in';
  }
  $('authBtn').onclick = async () => {
    if (state.session) { await state.sb.auth.signOut(); setMode('demo'); } else openAuth();
  };
  function openAuth() {
    if (!state.sb) return;
    setAuthMode(false); $('authMsg').textContent = ''; $('authDlg').showModal(); $('email').focus();
  }
  function setAuthMode(signUp) {
    state.signUp = signUp;
    $('authTitle').textContent = signUp ? 'Create your account' : 'Sign in';
    $('authSubmit').textContent = signUp ? 'Create account' : 'Sign in';
    $('authSwitch').textContent = signUp ? 'I already have an account' : 'Create an account';
    $('password').autocomplete = signUp ? 'new-password' : 'current-password';
  }
  $('authSwitch').onclick = () => setAuthMode(!state.signUp);
  $('authCancel').onclick = () => $('authDlg').close();
  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim(), password = $('password').value;
    const msg = $('authMsg'); msg.className = 'msg'; msg.textContent = 'Please wait…';
    const fn = state.signUp ? state.sb.auth.signUp({ email, password }) : state.sb.auth.signInWithPassword({ email, password });
    const { data, error } = await fn;
    if (error) { msg.className = 'msg err'; msg.textContent = error.message; return; }
    if (state.signUp && !data.session) { msg.textContent = 'Check your email to confirm your account, then sign in.'; setAuthMode(false); return; }
    $('authDlg').close(); $('password').value = '';
    setMode('mine');
  });

  // ------------------------------------------------------------ utils
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }

  boot().catch((e) => { $('inner').innerHTML = `<div class="a err">Could not start: ${esc(e.message)}</div>`; });
})();
