/* Gamer X — profile modal wiring, favorites lists, store options, inert developer buttons. Works with or without Supabase. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const json = (k, d) => { try { return JSON.parse(LS.get(k, 'null')) ?? d; } catch { return d; } };
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
  const toast = (m) => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };
  const CAT = { games: 'ألعاب', apps: 'تطبيقات', tools: 'أدوات' }, ROLE = { user: 'حساب عادي', developer: 'حساب مطور', owner: 'مالك المتجر' };
  const acct = () => window.GamerXAuth?.getCurrentAccount?.() || null;
  const cardOf = (n) => $$('.product').find((c) => c.dataset.name === n);
  const modal = $('#profileModal');
  const saved = () => window.GamerXStore?.getSaved?.() || json('gx_saved', []);

  /* ---------- profile modal ---------- */
  function fillProfile(a) {
    const name = a.displayName || a.name || 'المستخدم', role = ROLE[a.role] || ROLE.user;
    $('#profileTitle').textContent = name; $('#profileEmail').textContent = a.email;
    $('#profileNameInput').value = name; $('#profileEmailInput').value = a.email; $('#profileRoleInput').value = role;
    $('#profileCreatedInput').value = a.createdAt ? new Date(a.createdAt).toLocaleDateString('ar-EG') : '—';
    $('#psRole').textContent = role;
    const av = $('#profileAvatar');
    if (!av.style.background && !av.style.backgroundImage) av.textContent = name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
    if (!window.GamerXOnline) { const chip = $('#gxRoleChip'), dev = a.role === 'developer' || a.role === 'owner'; chip.hidden = false; chip.textContent = (dev ? '★ ' : '') + role; chip.classList.toggle('dev', dev); }
    renderSaved(); renderDownloads();
  }
  function showPTab(name) {
    $$('.profile-tab', modal).forEach((b) => b.classList.toggle('active', b.dataset.profileTab === name));
    $$('.profile-section', modal).forEach((s) => { const on = s.dataset.profileSection === name; s.hidden = !on; s.classList.toggle('active', on); });
  }
  function openProfile() {
    const a = acct(); if (!a) return false;
    const m = $('#accountMenu'); if (m) m.hidden = true; const sm = $('#settingsModal'); if (sm) sm.hidden = true;
    fillProfile(a); showPTab('data'); modal.hidden = false; return true;
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#profileBtn, #settingsProfileBtn') && acct()) { e.preventDefault(); e.stopImmediatePropagation(); openProfile(); }
    const tab = e.target.closest('.profile-tab'); if (tab && modal.contains(tab)) showPTab(tab.dataset.profileTab);
  }, true);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  // local-only save (online mode is handled by profile-plus.js)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#saveProfileBtn') || window.GamerXOnline) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const a = acct(), name = $('#profileNameInput').value.trim(); if (!a) return; if (!name) return toast('اكتب اسمك');
    try {
      const all = JSON.parse(LS.get('gx_accounts_v1', '{}')); if (all[a.email]) { all[a.email].displayName = name; all[a.email].name = name; LS.set('gx_accounts_v1', JSON.stringify(all)); }
    } catch {}
    window.GamerXAuth?.refresh?.(); fillProfile(acct() || a); toast('تم حفظ بياناتك');
  }, true);

  /* ---------- favorites + downloads lists ---------- */
  function renderSaved() {
    const box = $('#profileSavedList'), names = saved(); if (!box) return;
    $('#psSaved').textContent = names.length; box.replaceChildren();
    if (!names.length) { box.append(el('div', 'profile-empty', 'لا توجد محفوظات بعد. اضغط ★ على أي تطبيق لإضافته.')); return; }
    names.forEach((n) => {
      const c = cardOf(n), row = el('div', 'profile-item');
      row.append(el('span', 'profile-item-ico', [...n][0].toUpperCase()));
      const txt = el('div', 'profile-item-txt'); txt.append(el('b', '', n), el('small', '', c ? [CAT[c.dataset.category] || c.dataset.category, c.dataset.developer, c.dataset.version && 'v' + c.dataset.version].filter(Boolean).join(' · ') : 'غير متاح حاليًا في المتجر'));
      const act = el('div', 'profile-item-actions');
      if (c) { const o = el('button', 'secondary-action', 'فتح'); o.type = 'button'; o.onclick = () => { modal.hidden = true; setTimeout(() => $('.info-btn', c)?.click(), 60); }; act.append(o); }
      const r = el('button', 'danger-action', 'إزالة'); r.type = 'button'; r.onclick = () => { window.GamerXStore?.removeSaved?.(n); renderSaved(); toast('تمت إزالة ' + n + ' من المفضلة'); }; act.append(r);
      row.append(txt, act); box.append(row);
    });
  }
  function renderDownloads() {
    const box = $('#profileDownloadsList'), list = json('gx_download_history', []); if (!box) return;
    $('#psDl').textContent = list.length; box.replaceChildren();
    if (!list.length) { box.append(el('div', 'profile-empty', 'لا توجد تحميلات مسجلة حتى الآن.')); return; }
    list.forEach((d) => { const row = el('div', 'profile-item'), txt = el('div', 'profile-item-txt');
      txt.append(el('b', '', d.name), el('small', '', new Date(d.time).toLocaleString('ar-EG'))); row.append(el('span', 'profile-item-ico', [...d.name][0].toUpperCase()), txt); box.append(row); });
  }
  [['#savedCount', renderSaved], ['#activeDownloads', renderDownloads]].forEach(([s, f]) => { const n = $(s); n && new MutationObserver(() => { if (!modal.hidden) f(); else { $('#psSaved').textContent = saved().length; } }).observe(n, { childList: true, characterData: true, subtree: true }); });
  // respect the "save favorites" switch
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.bookmark-btn'); if (!b) return;
    if (b.getAttribute('aria-pressed') !== 'true' && LS.get('gx_save_fav', 'true') === 'false') { e.preventDefault(); e.stopImmediatePropagation(); toast('حفظ المفضلة متوقف من إعدادات المتجر.'); }
  }, true);

  /* ---------- store options ---------- */
  const pref = { cat: LS.get('gx_pref_cat', 'all'), sort: LS.get('gx_pref_sort', 'new'), confirm: LS.get('gx_pref_confirm', 'false') === 'true' };
  function applySort() {
    const g = $('#productsGrid'); if (!g) return;
    const by = { new: (a, b) => (+b.dataset.ts || 0) - (+a.dataset.ts || 0), top: (a, b) => (+b.dataset.downloads || 0) - (+a.dataset.downloads || 0), name: (a, b) => (a.dataset.name || '').localeCompare(b.dataset.name || '', 'ar') }[pref.sort];
    [...g.children].filter((c) => c.classList.contains('product')).sort(by).forEach((c) => g.append(c));
  }
  function bindPrefs() {
    const c = $('#prefCategory'), s = $('#prefSort'), k = $('#prefConfirm');
    if (c) { c.value = pref.cat; c.onchange = () => { pref.cat = c.value; LS.set('gx_pref_cat', pref.cat); toast('تم الحفظ'); }; }
    if (s) { s.value = pref.sort; s.onchange = () => { pref.sort = s.value; LS.set('gx_pref_sort', pref.sort); applySort(); toast('تم الحفظ'); }; }
    if (k) { k.checked = pref.confirm; k.onchange = () => { pref.confirm = k.checked; LS.set('gx_pref_confirm', String(pref.confirm)); }; }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.download-btn'); if (!b || !pref.confirm) return;
    const label = (b.textContent || '').trim(); if (!label.includes('تحميل') || label.includes('إلغاء')) return;
    const n = b.closest('.product')?.dataset.name || 'التطبيق'; if (!confirm('بدء تحميل ' + n + '؟')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('gx:catalog-loaded', applySort);

  /* ---------- developer buttons: ready but inert until enabled in gx-features.js ---------- */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dev-action') || window.GX_FEATURES?.developerAccount) return;
    e.preventDefault(); e.stopImmediatePropagation(); toast('زر المطور جاهز لكنه غير مفعّل حاليًا.');
  }, true);

  bindPrefs(); applySort();
  if (pref.cat !== 'all') $(`.category[data-filter="${pref.cat}"]`)?.click();
  $('#psSaved').textContent = saved().length; $('#psDl').textContent = json('gx_download_history', []).length;
})();
