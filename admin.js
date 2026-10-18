/* Gamer X — secret admin area. Gate checks happen on the SERVER (hashed codes in Supabase); nothing secret lives in this file. */
(() => {
  'use strict';
  const cfg = window.GX_SUPABASE_CONFIG;
  if (!cfg || !window.supabase || /YOUR_/.test(cfg.url)) return;
  const stack = document.querySelector('.settings-stack'); if (!stack) return;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const fmt = (d) => d ? new Date(d).toLocaleString('ar-EG') : '—';
  let admin = null, token = null, timer = null, bd = null;

  /* ---- the tiny secret field at the bottom of Settings ---- */
  const wrap = el('div', 'gx-secret'), inp = el('input'); inp.type = 'password'; inp.maxLength = 8; inp.autocomplete = 'off'; inp.spellcheck = false;
  inp.setAttribute('aria-label', '·'); inp.placeholder = '· · · · · · · ·'; wrap.append(inp); stack.after(wrap);
  inp.addEventListener('input', async () => {
    if (inp.value.length !== 8) return;
    const code = inp.value; inp.value = ''; inp.disabled = true; let ok = false;
    try { const r = await window.GamerXSupabase.rpc('gx_admin_gate', { p_code: code }); ok = r.data === true; } catch {}
    inp.disabled = false;
    if (ok) { document.querySelector('[data-close="settingsModal"]')?.click(); stepLogin(); }
    else { wrap.classList.add('shake'); setTimeout(() => wrap.classList.remove('shake'), 500); }
  });

  /* ---- overlay helpers ---- */
  function open() { bd?.remove(); bd = el('div', 'gx-admin-bd'); document.body.append(bd); const box = el('div', 'gx-admin-box'); bd.append(box); return box; }
  async function close(silent) {
    clearTimeout(timer);
    if (token && admin) { try { await admin.rpc('gx_admin_logout', { p_token: token }); } catch {} }
    if (admin) { try { await admin.auth.signOut(); } catch {} }
    token = null; admin = null; bd?.remove(); bd = null;
  }
  const field = (label, type, max) => { const l = el('label', 'gx-f'); l.append(el('span', '', label)); const i = el('input'); i.type = type; if (max) i.maxLength = max; i.autocomplete = 'off'; l.append(i); return [l, i]; };
  const msgEl = () => el('div', 'gx-admin-msg');

  /* ---- step 2: account email + password (separate client: never touches the visitor's own session) ---- */
  function stepLogin() {
    const box = open(); box.append(el('h3', '', 'دخول الإدارة'), el('p', 'gx-admin-sub', 'أدخل بيانات حساب الأدمن.'));
    const [l1, em] = field('البريد الإلكتروني', 'email', 120), [l2, pw] = field('كلمة المرور', 'password', 128), m = msgEl();
    const go = el('button', 'gx-btn-yes', 'متابعة'), no = el('button', 'gx-btn-no', 'إلغاء'); go.type = no.type = 'button';
    no.onclick = () => close(); box.append(l1, l2, m, el('div', 'gx-confirm-row')); box.lastChild.append(no, go);
    go.onclick = async () => {
      m.textContent = ''; go.disabled = true;
      admin = window.supabase.createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await admin.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
      pw.value = ''; go.disabled = false;
      if (error) { m.textContent = 'بيانات غير صحيحة.'; admin = null; return; }
      stepKey();
    };
  }

  /* ---- step 3: the 20-character key ---- */
  function stepKey() {
    const box = open(); box.append(el('h3', '', 'مفتاح الأمان'), el('p', 'gx-admin-sub', 'أدخل المفتاح المكوّن من 20 خانة.'));
    const [l, k] = field('المفتاح', 'password', 20), m = msgEl(), go = el('button', 'gx-btn-yes', 'فتح'), no = el('button', 'gx-btn-no', 'إلغاء'); go.type = no.type = 'button';
    no.onclick = () => close(); box.append(l, m, el('div', 'gx-confirm-row')); box.lastChild.append(no, go);
    go.onclick = async () => {
      m.textContent = ''; go.disabled = true;
      const { data, error } = await admin.rpc('gx_admin_unlock', { p_key: k.value }); k.value = ''; go.disabled = false;
      if (error || !data) { m.textContent = 'مرفوض.'; return; }
      token = data; timer = setTimeout(() => close(), 30 * 60 * 1000); dashboard();
    };
  }

  /* ---- dashboard ---- */
  const call = (fn, args = {}) => admin.rpc(fn, { p_token: token, ...args }).then((r) => { if (r.error) throw r.error; return r.data; });
  const TABS = [['overview', 'نظرة عامة'], ['users', 'المستخدمون'], ['apps', 'التطبيقات'], ['comments', 'التعليقات'], ['events', 'الأمان'], ['words', 'الكلمات']];
  function dashboard() {
    const box = open(); box.classList.add('wide');
    const top = el('div', 'gx-admin-top'); top.append(el('h3', '', 'لوحة الإدارة')); const out = el('button', 'gx-btn-no', 'خروج'); out.type = 'button'; out.onclick = () => close(); top.append(out);
    const tabs = el('div', 'gx-admin-tabs'), body = el('div', 'gx-admin-body'); box.append(top, tabs, body);
    TABS.forEach(([k, t]) => { const b = el('button', '', t); b.type = 'button'; b.onclick = () => { tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); show(k, body); }; tabs.append(b); });
    tabs.firstChild.click();
  }
  const row = (...kids) => { const r = el('div', 'gx-row'); r.append(...kids); return r; };
  const btn = (t, fn, cls) => { const b = el('button', 'gx-mini ' + (cls || ''), t); b.type = 'button'; b.onclick = fn; return b; };
  const LBL = { users: 'المستخدمون', developers: 'المطورون', apps: 'تطبيقات منشورة', downloads: 'إجمالي التحويلات', comments: 'التعليقات', hidden_comments: 'تعليقات مخفية', reports: 'بلاغات', events_24h: 'أحداث أمنية (24س)', banned: 'محظورون', muted: 'مكتومون' };
  const EV = { blocked_comment: 'تعليق محظور (ألفاظ/روابط)', auto_mute: 'كتم تلقائي', comment_report: 'بلاغ عن تعليق', admin_gate_fail: 'محاولة فاشلة للبوابة السرية', admin_key_fail: 'مفتاح أمان خاطئ', admin_unlock_denied: 'محاولة دخول إدارة مرفوضة', admin_login: 'دخول إدارة', admin_app_status: 'تغيير حالة تطبيق', admin_user_action: 'إجراء على مستخدم' };
  async function show(tab, body) {
    body.replaceChildren(el('p', 'gx-admin-sub', 'جاري التحميل…'));
    try {
      const nodes = [];
      if (tab === 'overview') { const d = await call('gx_admin_overview'); const g = el('div', 'gx-tiles'); Object.keys(LBL).forEach((k) => { const t = el('div', 'gx-tile'); t.append(el('b', '', String(d[k] ?? 0)), el('span', '', LBL[k])); g.append(t); }); nodes.push(g); }
      if (tab === 'users') {
        const q = el('input', 'gx-search'); q.placeholder = 'بحث بالاسم أو البريد…'; const list = el('div');
        const load = async () => { const d = await call('gx_admin_users', { p_q: q.value.trim() }); list.replaceChildren(...d.map((u) => {
          const info = el('div', 'gx-grow'); info.append(el('b', '', (u.display_name || u.username || 'بدون اسم') + (u.username ? ' @' + u.username : '')), el('small', '', u.email + ' · ' + u.role), el('small', '', 'انضم ' + fmt(u.created_at) + ' · آخر دخول ' + fmt(u.last_sign_in_at)), el('small', '', `تطبيقات ${u.apps} · تعليقات ${u.comments} · مخالفات ${u.strikes}` + (u.banned ? ' · 🚫 محظور' : '') + (u.muted_until && new Date(u.muted_until) > new Date() ? ' · 🔇 مكتوم' : '')));
          const act = (a, r) => async () => { if (!confirm('تأكيد؟')) return; await call('gx_admin_user_action', { p_user: u.id, p_action: a, p_reason: r || null }); load(); };
          const ctl = el('div', 'gx-ctl'); ctl.append(u.banned ? btn('فك الحظر', act('unban')) : btn('حظر', act('ban', 'إدارة'), 'bad'), btn('كتم 24س', act('mute')), btn('تصفير', act('reset'))); return row(info, ctl); })); };
        let t; q.oninput = () => { clearTimeout(t); t = setTimeout(load, 350); }; nodes.push(q, list); await load();
      }
      if (tab === 'apps') { const d = await call('gx_admin_apps'); d.forEach((a) => { const info = el('div', 'gx-grow'); info.append(el('b', '', a.name + ' · v' + (a.version || '?')), el('small', '', `${a.display_name || a.username || 'مطور'} · ${a.status} · ${a.downloads} تحويل · ${a.releases} إصدار · ⭐ ${a.rating ?? '—'} (${a.ratings})`), el('small', '', 'نُشر ' + fmt(a.created_at)));
        const nx = a.status === 'published' ? 'suspended' : 'published'; nodes.push(row(info, btn(nx === 'suspended' ? 'إيقاف' : 'نشر', async () => { await call('gx_admin_set_app_status', { p_app: a.id, p_status: nx }); show('apps', body); }, nx === 'suspended' ? 'bad' : ''))); }); }
      if (tab === 'comments') {
        const fl = el('label', 'gx-chk'); const cb = el('input'); cb.type = 'checkbox'; fl.append(cb, ' المُبلَّغ عنها / المخفية فقط'); const list = el('div');
        const load = async () => { const d = await call('gx_admin_comments', { p_flagged: cb.checked }); list.replaceChildren(...d.map((c) => { const info = el('div', 'gx-grow'); info.append(el('b', '', (c.display_name || c.username || 'مستخدم') + ' ← ' + c.app_name), el('p', 'gx-cbody', c.body), el('small', '', fmt(c.created_at) + ' · بلاغات ' + c.reports + (c.hidden ? ' · مخفي' : '')));
          const a = (x) => async () => { await call('gx_admin_comment_action', { p_id: c.id, p_action: x }); load(); }; const ctl = el('div', 'gx-ctl');
          ctl.append(btn(c.hidden ? 'إظهار' : 'إخفاء', a(c.hidden ? 'show' : 'hide')), btn('حذف', async () => { if (confirm('حذف نهائي؟')) { await call('gx_admin_comment_action', { p_id: c.id, p_action: 'delete' }); load(); } }, 'bad'), btn('حظر الكاتب', async () => { if (confirm('حظر الكاتب؟')) { await call('gx_admin_user_action', { p_user: c.user_id, p_action: 'ban', p_reason: 'تعليقات مسيئة' }); load(); } }, 'bad')); return row(info, ctl); })); };
        cb.onchange = load; nodes.push(fl, list); await load();
      }
      if (tab === 'events') { const d = await call('gx_admin_events'); d.forEach((e) => { const info = el('div', 'gx-grow'); info.append(el('b', '', (e.severity >= 3 ? '🔴 ' : e.severity === 2 ? '🟠 ' : '🟢 ') + (EV[e.kind] || e.kind)), el('small', '', fmt(e.created_at) + (e.username || e.display_name ? ' · ' + (e.display_name || e.username) : '')), e.detail?.text ? el('p', 'gx-cbody', e.detail.text) : el('span')); nodes.push(row(info)); }); if (!d.length) nodes.push(el('p', 'gx-admin-sub', 'لا توجد أحداث.')); }
      if (tab === 'words') {
        const form = el('div', 'gx-row'), w = el('input', 'gx-search'), s = el('select'); w.placeholder = 'كلمة ممنوعة جديدة'; s.append(new Option('عادية (كلمة كاملة)', '1'), new Option('شديدة (أي موضع)', '2'));
        const add = btn('إضافة', async () => { if (!w.value.trim()) return; await call('gx_admin_word_set', { p_word: w.value.trim(), p_sev: +s.value }); show('words', body); }); form.append(w, s, add); nodes.push(form);
        const d = await call('gx_admin_words'); const chips = el('div', 'gx-chips'); d.forEach((x) => { const c = el('button', 'gx-chip' + (x.severity === 2 ? ' hard' : ''), x.word + ' ✕'); c.type = 'button'; c.onclick = async () => { await call('gx_admin_word_set', { p_word: x.word, p_sev: x.severity, p_remove: true }); show('words', body); }; chips.append(c); }); nodes.push(chips);
      }
      body.replaceChildren(...nodes);
    } catch (e) { body.replaceChildren(el('p', 'gx-admin-msg', 'انتهت الجلسة أو لا توجد صلاحية.')); }
  }
})();
