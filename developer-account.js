/* Gamer X — منطقة المطور: الدور، طلب حساب مطور فوري، الشارة الذهبية، وصفحة الإعدادات. */
(() => {
  'use strict';
  const cfg = window.GX_SUPABASE_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'class') e.className = v; else if (x.startsWith('on')) e[x] = v; else e.setAttribute(x, v); } e.append(...k.flat().filter((n) => n != null)); return e; };
  const toast = (m) => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); };
  const enabled = !(window.GX_FEATURES && window.GX_FEATURES.developerAccount === false);
  const online = !!(cfg && window.supabase && cfg.url && cfg.publishableKey && !/YOUR_/.test(cfg.url));
  const sb = online ? (window.GamerXSupabase || (window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey))) : null;
  let role = null, uid = null, loading = true;
  const isDev = () => role === 'developer' || role === 'owner';

  const api = window.GamerXDeveloper = { sb, isDev, getRole: () => role, getUid: () => uid, refresh, openArea, openRequest, openAccount: () => window.GamerXDeveloperConsole?.open?.() };

  async function refresh() {
    loading = true; render();
    let next = null;
    if (sb) {
      const { data: s } = await sb.auth.getSession(); uid = s.session?.user.id || null;
      if (uid) {
        const { data, error } = await sb.from('profiles').select('role').eq('id', uid).maybeSingle();
        if (!error && data?.role) next = data.role;
        else { const r = await sb.rpc('gx_ensure_profile'); next = !r.error && r.data ? (typeof r.data === 'string' ? r.data : r.data.role) : null; }
      } else { try { localStorage.removeItem('gx_developer_apps'); } catch {} }
    }
    const changed = next !== role; role = next; loading = false; render();
    if (changed) document.dispatchEvent(new CustomEvent('gx:role-changed', { detail: role }));
  }

  /* ---------- badge (gold) ---------- */
  function badge(host) {
    if (!host) return; const b = host.querySelector('.gx-dev-badge');
    if (isDev() && !b) host.append(h('span', { class: 'gx-dev-badge' }, '★ حساب مطور'));
    else if (!isDev() && b) b.remove();
  }
  ['#menuName', '#settingsAccountName'].forEach((s) => { const el = $(s); el && new MutationObserver(() => badge(el)).observe(el, { childList: true }); });

  /* ---------- UI ---------- */
  function render() {
    const btn = $('#developerAreaBtn'); if (btn) btn.hidden = !uid || !enabled;
    badge($('#menuName')); badge($('#settingsAccountName'));
    const ri = $('#profileRoleInput'); if (ri && isDev()) ri.value = role === 'owner' ? 'مالك المتجر' : 'حساب مطور';
    renderZone();
  }
  function renderZone() {
    const z = $('#gxDevZone'); if (!z) return;
    const card = (...k) => h('div', { class: 'dev-card' }, ...k);
    if (!enabled || !online) return z.replaceChildren(card(h('p', { class: 'data-note' }, 'ميزة حساب المطور غير متاحة حاليًا.')));
    if (loading) return z.replaceChildren(h('div', { class: 'profile-empty' }, 'جاري التحميل…'));
    if (!uid) return z.replaceChildren(card(h('b', {}, 'سجّل الدخول أولًا'), h('p', { class: 'data-note' }, 'لازم يكون عندك حساب مسجّل عشان تطلب حساب مطور.'),
      h('button', { class: 'modal-action', type: 'button', onclick: () => { $('#settingsModal').hidden = true; window.GamerXAuth?.openAuth?.('login'); } }, 'تسجيل الدخول')));
    if (!role) return z.replaceChildren(card(h('p', { class: 'data-note' }, 'تعذر تجهيز حسابك. تأكد من تشغيل ملف supabase-update-4.sql ثم أعد المحاولة.'), h('button', { class: 'secondary-action', type: 'button', onclick: refresh }, 'إعادة المحاولة')));
    if (isDev()) return z.replaceChildren(card(h('span', { class: 'gx-dev-badge', style: 'margin:0' }, '★ حساب مطور'),
      h('p', { class: 'data-note' }, 'حسابك مفعّل. افتح حساب المطور لإضافة تطبيق أو إدارة تطبيقاتك.'),
      h('button', { class: 'modal-action', type: 'button', onclick: api.openAccount }, 'فتح حساب المطور')));
    z.replaceChildren(card(h('b', {}, 'حساب المطور'), h('p', { class: 'data-note' }, 'انشر تطبيقاتك وألعابك وأدواتك في المتجر وتابع التنزيلات والمفضلة.'),
      h('button', { class: 'modal-action', type: 'button', onclick: openRequest }, 'طلب حساب مطور')));
  }

  function openArea() {
    const m = $('#accountMenu'); if (m) m.hidden = true;
    $('#settingsBtn')?.click(); (document.querySelector("[data-settings-tab=developer]") && document.querySelector("[data-settings-section=developer]").classList.contains("active") ? 0 : document.querySelector("[data-settings-tab=developer]")?.click());
  }

  /* ---------- request ---------- */
  const rm = $('#devRequestModal');
  const rst = (t, ok) => { const e = $('#devRequestStatus'); e.textContent = t || ''; e.classList.toggle('success', !!ok); };
  function openRequest() {
    if (!uid) return toast('سجّل الدخول أولًا.');
    $('#settingsModal').hidden = true; $('#devAgree').checked = false; rst(''); rm.hidden = false;
  }
  rm?.addEventListener('click', (e) => { if (e.target === rm) rm.hidden = true; });
  $('#devRequestSubmit')?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    if (!$('#devAgree').checked) return rst('وافق على التعهد أولًا.');
    b.disabled = true; rst('جاري تفعيل حساب المطور…', true);
    try {
      const { data, error } = await sb.rpc('gx_become_developer');
      if (error) {
        const m = String(error.message || '');
        if (/email_not_confirmed/.test(m)) throw new Error('أكّد بريدك الإلكتروني أولًا.');
        if (/gx_become_developer|PGRST202|function/i.test(m)) throw new Error('لازم تشغّل ملف supabase-update-4.sql في Supabase أولًا.');
        throw new Error('تعذر تفعيل الحساب. حاول مرة أخرى.');
      }
      if (data !== 'developer' && data !== 'owner') throw new Error('تعذر تفعيل الحساب.');
      const { data: u } = await sb.auth.getUser(); if (u?.user) await window.GamerXOnline?.mirror?.(u.user);
      await refresh(); rm.hidden = true; toast('تم تفعيل حساب المطور ★');
      setTimeout(api.openAccount, 350);
    } catch (err) { rst(err.message || 'تعذر تفعيل الحساب.'); } finally { b.disabled = false; }
  });

  $('#developerAreaBtn')?.addEventListener('click', openArea);
  if (sb) sb.auth.onAuthStateChange(() => setTimeout(refresh, 0));
  refresh();
})();
