/* Gamer X — app-style profile with Supabase: avatar (logo / presets / upload), name, @username, account type. */
(() => {
  const cfg = window.GX_SUPABASE_CONFIG;
  if (!cfg || !window.supabase || /YOUR_/.test(cfg.url)) return;
  const sb = window.GamerXSupabase || (window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey));
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const EMOJI = ['', '🎮', '🕹️', '👾', '🚀', '🐉', '⚡', '🦊', '🐺', '🤖', '👑', '🔥'];
  const ROLE = { user: 'حساب عادي', developer: 'حساب مطور', owner: 'مالك المتجر' };
  const grad = (i) => `linear-gradient(135deg,hsl(${(i * 53) % 360} 80% 55%),hsl(${(i * 53 + 60) % 360} 80% 38%))`;
  let me = { uid: null, role: null, username: '', name: '', avatar: '' };
  let pending; // undefined = no change, '' = remove picture, otherwise the new value

  document.head.append(Object.assign(document.createElement('style'), { textContent: `
  #gxBadgeProfile{display:none!important}
  .gx-picker{margin:4px 0 14px}.gx-picker>span{display:block;margin-bottom:8px;font-weight:700}
  .gx-av-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
  .gx-av{aspect-ratio:1;border-radius:50%;border:2px solid transparent;display:grid;place-items:center;font-size:20px;cursor:pointer;overflow:hidden;padding:0;color:#fff;background-size:cover!important;background-position:center!important}
  .gx-av.sel{border-color:var(--accent,#5d83ff);box-shadow:0 0 0 2px rgba(93,131,255,.35)}
  .gx-picker-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}` }));

  const toast = (m) => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); };
  const lk = () => 'gx_avatar_' + me.uid;
  const getLocal = () => { try { return localStorage.getItem(lk()) || ''; } catch { return ''; } };
  const setLocal = (v) => { try { v ? localStorage.setItem(lk(), v) : localStorage.removeItem(lk()); } catch {} };
  const cur = () => (pending !== undefined ? pending : me.avatar);

  function paint(el, v) {
    el.style.background = '';
    if (!v) return;
    if (v === 'preset:0') { el.style.background = '#0d1325 url(logo.webp) center/cover no-repeat'; el.textContent = ''; }
    else if (v.startsWith('preset:')) { const i = +v.slice(7); el.style.background = grad(i); el.textContent = EMOJI[i] || ''; }
    else { el.style.background = `url("${v}") center/cover no-repeat`; el.textContent = ''; }
  }
  window.GamerXPaintAvatar = paint;
  const expectedText = (v) => (v.startsWith('preset:') && +v.slice(7) ? EMOJI[+v.slice(7)] : '');
  const mo = new MutationObserver((list) => {
    const v = cur(); if (!me.uid || !v) return;
    list.forEach((m) => { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (el?.classList?.contains('account-avatar') && el.textContent !== expectedText(v)) paint(el, v); });
  });
  function paintAll() {
    if (!me.uid) return; const v = cur();
    $$('.account-avatar').forEach((el) => { if (!el.dataset.gxp) { el.dataset.gxp = '1'; mo.observe(el, { childList: true, characterData: true, subtree: true }); } paint(el, v); });
  }

  function decorate() {
    const title = $('#profileTitle'); if (!title) return;
    if (me.uid) title.textContent = me.name || 'الملف الشخصي';
    const host = title.parentElement;
    let u = $('#gxUsername', host), c = $('#gxRoleChip', host);
    if (!u) { u = Object.assign(document.createElement('p'), { id: 'gxUsername', className: 'gx-username' }); title.after(u); }
    if (!c) { c = Object.assign(document.createElement('span'), { id: 'gxRoleChip', className: 'gx-role-chip' }); host.append(c); }
    u.hidden = c.hidden = !me.uid; u.textContent = me.username ? '@' + me.username : '';
    const dev = me.role === 'developer' || me.role === 'owner';
    c.textContent = (dev ? '★ ' : '') + (ROLE[me.role] || ROLE.user); c.classList.toggle('dev', dev);
    const ri = $('#profileRoleInput'); if (ri && me.uid) ri.value = ROLE[me.role] || ROLE.user;
    const grid = $('.profile-data-grid'); if (!grid || !me.uid) return;
    if (!$('#gxUserInput')) { const l = document.createElement('label'); l.innerHTML = '<span>اسم المستخدم</span><input id="gxUserInput" disabled dir="ltr">'; grid.insertBefore(l, grid.children[1] || null); }
    $('#gxUserInput').value = me.username ? '@' + me.username : '';
    if (!$('#gxPicker')) buildPicker(grid);
    markSel();
  }

  function buildPicker(grid) {
    const box = document.createElement('div'); box.className = 'gx-picker'; box.id = 'gxPicker';
    box.innerHTML = '<span>صورة الحساب</span><div class="gx-av-grid"></div><div class="gx-picker-actions"><button type="button" class="secondary-action gx-upload">رفع صورة أو لوجو</button><button type="button" class="secondary-action gx-reset">إزالة الصورة</button></div><input type="file" accept="image/*" hidden>';
    grid.before(box);
    const g = $('.gx-av-grid', box);
    EMOJI.forEach((_, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'gx-av'; b.dataset.v = 'preset:' + i; b.setAttribute('aria-label', 'صورة ' + (i + 1)); paint(b, 'preset:' + i); g.append(b); });
    g.addEventListener('click', (e) => { const b = e.target.closest('.gx-av'); if (b) choose(b.dataset.v); });
    const file = $('input[type=file]', box);
    $('.gx-upload', box).onclick = () => file.click();
    $('.gx-reset', box).onclick = () => choose('');
    file.onchange = async () => { const f = file.files[0]; file.value = ''; if (!f) return; try { choose(await shrink(f)); } catch { toast('تعذر قراءة الصورة. جرّب صورة أخرى.'); } };
  }
  function choose(v) { pending = v; const a = $('#profileAvatar'); if (a) { paint(a, v); if (!v) a.textContent = a.textContent || 'GX'; } markSel(); }
  function markSel() { const c = cur(); $$('.gx-av').forEach((b) => b.classList.toggle('sel', b.dataset.v === c)); }

  function shrink(file) { // square-crop to 192px, small WebP/JPEG data URL
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 192;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192); URL.revokeObjectURL(url);
        let d = c.toDataURL('image/webp', 0.8); if (!d.startsWith('data:image/webp')) d = c.toDataURL('image/jpeg', 0.8);
        d.length < 55000 ? res(d) : rej(new Error('big'));
      };
      img.onerror = rej; img.src = url;
    });
  }

  async function load() {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) { me = { uid: null, role: null, username: '', name: '', avatar: '' }; return; }
    me.uid = s.session.user.id;
    let { data, error } = await sb.from('profiles').select('username,display_name,role,avatar_url').eq('id', me.uid).maybeSingle();
    if (error) ({ data } = await sb.from('profiles').select('username,display_name,role').eq('id', me.uid).maybeSingle());
    me.username = data?.username || ''; me.name = data?.display_name || ''; me.role = data?.role || 'user';
    me.avatar = data?.avatar_url || getLocal();
    paintAll(); decorate();
  }

  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#saveProfileBtn') || !me.uid) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const name = $('#profileNameInput').value.trim(); if (!name) return toast('اكتب اسمك');
    const now = new Date().toISOString(), changed = pending !== undefined;
    const patch = { display_name: name, updated_at: now }; if (changed) patch.avatar_url = pending || null;
    let { error } = await sb.from('profiles').update(patch).eq('id', me.uid);
    let note = '';
    if (error && changed) { // maybe the avatar column is missing: keep the name, keep the picture on this device
      const r = await sb.from('profiles').update({ display_name: name, updated_at: now }).eq('id', me.uid);
      if (!r.error) { error = null; note = 'تم حفظ الاسم، والصورة محفوظة على هذا الجهاز فقط (شغّل supabase.sql في Supabase).'; }
    }
    if (error) return toast('تعذر الحفظ: ' + String(error.message || '').slice(0, 90));
    if (changed) { setLocal(pending); me.avatar = pending; }
    pending = undefined; await load();
    const { data: s } = await sb.auth.getSession(); if (s.session) await window.GamerXOnline?.mirror(s.session.user);
    paintAll(); decorate(); toast(note || 'تم حفظ بياناتك');
  }, true);

  const reload = () => load();
  document.addEventListener('gx:role-changed', reload);
  sb.auth.onAuthStateChange(() => setTimeout(reload, 0));
  ['profileModal', 'settingsModal'].forEach((id) => { const m = $('#' + id); m && new MutationObserver(() => { if (!m.hidden) { pending = undefined; setTimeout(() => { paintAll(); decorate(); }, 30); } }).observe(m, { attributes: true, attributeFilter: ['hidden'] }); });
  load();
})();
