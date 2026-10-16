/* Gamer X — المفضلة: تحويل القديم (بالاسم) إلى id، تنظيف المحذوف، ومزامنة مع الحساب. */
(() => {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cfg = window.GX_SUPABASE_CONFIG;
  const online = !!(cfg && window.supabase && cfg.url && !/YOUR_/.test(cfg.url));
  const sb = online ? (window.GamerXSupabase || (window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey))) : null;
  const toast = (m) => { const t = document.querySelector('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2800); };
  const cards = () => [...document.querySelectorAll('.product')];
  let uid = null, ready = false, busy = false;
  const flag = () => 'gx_fav_synced_' + uid;
  const S = () => window.GamerXStore;

  function tidy() { // legacy names -> ids, then drop favorites of removed apps (only when the whole catalog was loaded)
    const s = S(), list = cards(); if (!s || !list.length) return;
    const byName = new Map(list.filter((c) => c.dataset.appId).map((c) => [c.dataset.name, c.dataset.appId]));
    const ids = new Set(byName.values()); list.forEach((c) => c.dataset.appId && ids.add(c.dataset.appId));
    const cur = s.getSaved(); let next = cur.map((k) => (UUID.test(k) ? k : byName.get(k) || k));
    if (list.length < 60) next = next.filter((k) => ids.has(k));
    if (next.length !== cur.length || next.some((k, i) => k !== cur[i])) s.setSaved(next);
  }

  async function sync() {
    if (!sb || !uid || !ready || busy || !S()) return; busy = true;
    try {
      const { data, error } = await sb.from('app_favorites').select('app_id'); if (error) return;
      const server = new Set(data.map((r) => r.app_id)), known = new Set(cards().map((c) => c.dataset.appId).filter(Boolean)), local = S().getSaved();
      if (!localStorage.getItem(flag())) { // first sync on this device: merge both sides
        const push = local.filter((k) => UUID.test(k) && known.has(k) && !server.has(k));
        if (push.length) { const r = await sb.from('app_favorites').upsert(push.map((a) => ({ user_id: uid, app_id: a })), { onConflict: 'user_id,app_id', ignoreDuplicates: true }); if (r.error) return; }
        const add = [...server].filter((k) => known.has(k) && !local.includes(k)); if (add.length) S().setSaved([...local, ...add]);
        localStorage.setItem(flag(), '1');
      } else { // afterwards the account is the source of truth for the apps in the store
        const keep = local.filter((k) => !known.has(k)), next = [...keep, ...[...server].filter((k) => known.has(k))];
        if (next.length !== local.length || next.some((k) => !local.includes(k))) S().setSaved(next);
      }
    } catch {} finally { busy = false; }
  }

  window.GamerXHooks = Object.assign(window.GamerXHooks || {}, {
    onFavorite(key, on) {
      if (!sb || !uid || !UUID.test(key)) return;
      const q = on ? sb.from('app_favorites').upsert({ user_id: uid, app_id: key }, { onConflict: 'user_id,app_id', ignoreDuplicates: true })
        : sb.from('app_favorites').delete().eq('user_id', uid).eq('app_id', key);
      q.then(({ error }) => { if (error) { localStorage.removeItem(flag()); toast('تعذرت مزامنة المفضلة مع حسابك. سيتم المحاولة لاحقًا.'); } }, () => localStorage.removeItem(flag()));
    }
  });

  document.addEventListener('gx:catalog-loaded', () => { ready = true; tidy(); sync(); });
  if (sb) {
    sb.auth.getSession().then(({ data }) => { uid = data.session?.user.id || null; sync(); });
    sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => { uid = session?.user.id || null; sync(); }, 0); });
  }
})();
