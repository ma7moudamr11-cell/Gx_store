/* Gamer X — full app page (ⓘ button): info, publisher, rating, comments with a respect filter. Server enforces the same rules. */
(() => {
  'use strict';
  const sb = () => window.GamerXSupabase; if (!window.GX_SUPABASE_CONFIG) return;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const CATS = { games: 'ألعاب', apps: 'تطبيقات', tools: 'أدوات' };
  const d = (x) => x ? new Date(x).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  /* light client-side pre-check (the real filter is on the server) */
  const BAD = ['كلب', 'حمار', 'غبي', 'حقير', 'زباله', 'قذر', 'واطي', 'حيوان', 'خنزير', 'متخلف', 'ابنالكلب', 'شرموط', 'كسمك', 'fuck', 'bitch', 'shit', 'stupid', 'idiot', 'asshole'];
  const sq = (t) => t.toLowerCase().replace(/[\u064B-\u065F\u0640\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[0@]/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/[4]/g, 'a').replace(/[$5]/g, 's').replace(/[\s.\-_*,/\\|~`'"!?:;()[\]{}<>+=^%#&،؛؟]/g, '').replace(/(.)\1+/g, '$1');
  const HARD = ['ابنالكلب', 'شرموط', 'كسمك', 'fuck', 'bitch', 'asshole'];
  const bad = (t) => { const s = sq(t); if (HARD.some((w) => s.includes(sq(w)))) return true;
    const toks = t.split(/[\s.\-_*,/\\|~`'"!?:;()[\]{}<>+=^%#&،؛؟]+/).map(sq).filter(Boolean);
    return BAD.some((w) => { const x = sq(w); return toks.some((k) => k === x || (/^[\u0621-\u064A]/.test(x) && k.length > x.length && k.length <= x.length + 2 && k.endsWith(x))); }); };
  const link = (t) => /(https?:|www\.|\.(com|net|org|io|me|ly|xyz|ru|cc|tk)\b|t\.me|wa\.me|\d{8,})/i.test(t);

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.info-btn'); const card = b?.closest('.product'); if (!card?.dataset.appId) return;
    e.preventDefault(); e.stopImmediatePropagation(); openPage(card);
  }, true);

  let page = null;
  const closePage = () => { page?.remove(); page = null; document.body.style.overflow = ''; };
  async function getDev(id) {
    let r = await sb().from('gx_public_developers').select('id,display_name,username,avatar_url,created_at').eq('id', id).maybeSingle();
    if (r.error) r = await sb().from('gx_public_developers').select('id,display_name,username').eq('id', id).maybeSingle();
    return r.data || { id };
  }
  const paintAv = (node, v) => { if (v && window.GamerXPaintAvatar) { node.textContent = ''; window.GamerXPaintAvatar(node, v); } };
  async function me() { try { return (await sb().auth.getSession()).data.session?.user || null; } catch { return null; } }

  async function openPage(card) {
    closePage(); const id = card.dataset.appId;
    page = el('div', 'gx-page'); document.body.append(page); document.body.style.overflow = 'hidden';
    const bar = el('div', 'gx-page-bar'), back = el('button', 'gx-page-back', '→ رجوع'); back.type = 'button'; back.onclick = closePage; bar.append(back, el('b', '', card.dataset.name || 'التطبيق'));
    const inner = el('div', 'gx-page-in'); page.append(bar, inner); inner.append(el('p', 'gx-admin-sub', 'جاري التحميل…'));
    const [appR, ratingR, comR] = await Promise.all([
      sb().from('apps').select('id,name,description,category,created_at,updated_at,downloads,developer_id,icon_path,app_releases(version_name,version_code)').eq('id', id).maybeSingle(),
      sb().rpc('gx_app_rating', { p_app: id }), sb().from('gx_app_comments_v').select('*').eq('app_id', id).order('created_at', { ascending: false }).limit(50)]);
    const a = appR.data; if (!a) { inner.replaceChildren(el('p', 'gx-admin-sub', 'تعذر تحميل التطبيق.')); return; }
    const dev = await getDev(a.developer_id);
    const rel = [...(a.app_releases || [])].sort((x, y) => y.version_code - x.version_code)[0];
    const user = await me();

    /* hero */
    const hero = el('div', 'gx-hero'); const ic = el('div', 'gx-hero-ic');
    const img = card.querySelector('.art-icon'); if (img?.tagName === 'IMG') { const i = el('img'); i.src = img.src; i.alt = ''; ic.append(i); } else ic.textContent = [...a.name][0].toUpperCase();
    const ht = el('div'); ht.append(el('h2', '', a.name), el('span', 'gx-badge', CATS[a.category] || a.category)); hero.append(ic, ht);
    const desc = el('p', 'gx-desc', a.description || 'لا يوجد وصف.');
    const stats = el('div', 'gx-stats'); [['الإصدار', rel ? 'v' + rel.version_name : '—'], ['تاريخ النشر', d(a.created_at)], ['آخر تحديث', d(a.updated_at)], ['التحويلات', String(a.downloads)]].forEach(([k, v]) => { const s = el('div'); s.append(el('span', '', k), el('b', '', v)); stats.append(s); });
    /* publisher */
    const pub = el('div', 'gx-pub'); const av = el('div', 'gx-pub-av', [...(dev.display_name || dev.username || 'م')][0].toUpperCase()); const pi = el('div');
    pi.append(el('b', '', dev.display_name || 'مطور'), el('small', '', dev.username ? '@' + dev.username : ''), el('small', '', 'صاحب / مصمم التطبيق · اضغط لعرض ملفه')); paintAv(av, dev.avatar_url); pub.append(av, pi);
    pub.classList.add('link'); pub.tabIndex = 0; pub.setAttribute('role', 'button'); pub.onclick = () => openDev(a.developer_id, dev);
    const inst = el('button', 'modal-action', 'تثبيت'); inst.type = 'button'; inst.onclick = () => { closePage(); card.querySelector('.download-btn')?.click(); };

    /* rating */
    const rbox = el('section', 'gx-sec'); rbox.append(el('h3', '', 'التقييم'));
    const rinfo = el('div', 'gx-rate-info'), stars = el('div', 'gx-stars'), rmsg = el('div', 'gx-admin-msg');
    const paint = (r) => { const v = r.data || {}; rinfo.textContent = v.count ? `⭐ ${v.avg} من 5 · ${v.count} تقييم` : 'لا توجد تقييمات بعد'; [...stars.children].forEach((s, i) => s.classList.toggle('on', i < (v.mine || 0))); };
    for (let i = 1; i <= 5; i++) { const s = el('button', 'gx-star', '★'); s.type = 'button'; s.setAttribute('aria-label', i + ' نجوم');
      s.onclick = async () => { rmsg.textContent = ''; const r = await sb().rpc('gx_rate_app', { p_app: id, p_rating: i }); if (r.data?.ok) paint(await sb().rpc('gx_app_rating', { p_app: id })); else rmsg.textContent = r.data?.error || 'تعذر التقييم.'; }; stars.append(s); }
    paint(ratingR); rbox.append(rinfo, stars, rmsg);

    /* comments */
    const cbox = el('section', 'gx-sec'); cbox.append(el('h3', '', 'التعليقات'));
    const rules = el('p', 'gx-rules', 'قواعد التعليق: احترم الجميع — ممنوع السب والشتائم والتنمر والروابط وأرقام الهواتف. المخالفات المتكررة تؤدي للكتم ثم الحظر.');
    const ta = el('textarea'); ta.maxLength = 500; ta.rows = 3; ta.placeholder = user ? 'اكتب تعليقك…' : 'سجّل الدخول لتتمكن من التعليق'; ta.disabled = !user;
    const hint = el('div', 'gx-admin-msg'), send = el('button', 'modal-action', 'نشر التعليق'); send.type = 'button'; send.disabled = true; const cnt = el('small', 'gx-cnt', '0/500');
    ta.oninput = () => { cnt.textContent = ta.value.length + '/500'; const t = ta.value; hint.textContent = bad(t) ? 'التعليق فيه ألفاظ غير لائقة.' : link(t) ? 'ممنوع الروابط وأرقام الهواتف.' : ''; send.disabled = !user || t.trim().length < 2 || !!hint.textContent; };
    const list = el('div', 'gx-comments');
    const render = (rows) => list.replaceChildren(...(rows.length ? rows.map((c) => { const it = el('div', 'gx-comment'); const top = el('div', 'gx-c-top'); top.append(el('b', '', c.author), el('small', '', d(c.created_at)));
      const rp = el('button', 'gx-mini', 'إبلاغ'); rp.type = 'button'; rp.onclick = async () => { if (!user) { rp.textContent = 'سجّل الدخول'; return; } const r = await sb().rpc('gx_report_comment', { p_id: c.id, p_reason: 'abuse' }); rp.textContent = r.data?.ok ? 'تم الإبلاغ' : 'تعذر'; rp.disabled = true; };
      it.append(top, el('p', '', c.body), rp); return it; }) : [el('p', 'gx-admin-sub', 'كن أول من يعلّق.')]));
    render(comR.data || []);
    send.onclick = async () => { send.disabled = true; hint.textContent = ''; const r = await sb().rpc('gx_post_comment', { p_app: id, p_body: ta.value });
      if (r.data?.ok) { ta.value = ''; cnt.textContent = '0/500'; render((await sb().from('gx_app_comments_v').select('*').eq('app_id', id).order('created_at', { ascending: false }).limit(50)).data || []); }
      else { hint.textContent = r.data?.error || 'تعذر نشر التعليق.'; } };
    cbox.append(rules, ta, el('div', 'gx-c-row'), list); cbox.querySelector('.gx-c-row').append(cnt, send); ta.after(hint);
    inner.replaceChildren(hero, desc, stats, pub, inst, rbox, cbox);
  }

  /* developer / designer profile page */
  async function openDev(devId, dev) {
    const sub = el('div', 'gx-page gx-dev'); document.body.append(sub);
    const bar = el('div', 'gx-page-bar'), back = el('button', 'gx-page-back', '→ رجوع'); back.type = 'button'; back.onclick = () => sub.remove(); bar.append(back, el('b', '', 'ملف المطور'));
    const inner = el('div', 'gx-page-in'); sub.append(bar, inner);
    const { data } = await sb().from('apps').select('id,name,category,downloads,icon_path,app_releases(version_name,version_code)').eq('developer_id', devId).eq('status', 'published').order('downloads', { ascending: false }).limit(60);
    const apps = data || [], total = apps.reduce((n, x) => n + (x.downloads || 0), 0);
    const hero = el('div', 'gx-hero'); const ic = el('div', 'gx-hero-ic round', [...(dev.display_name || dev.username || 'م')][0].toUpperCase()); const t = el('div');
    t.append(el('h2', '', dev.display_name || 'مطور'), el('span', 'gx-badge', dev.username ? '@' + dev.username : 'حساب مطور')); if (dev.created_at) t.append(el('small', 'gx-joined', 'انضم ' + d(dev.created_at))); paintAv(ic, dev.avatar_url); hero.append(ic, t);
    const stats = el('div', 'gx-stats'); [['التطبيقات المنشورة', String(apps.length)], ['إجمالي التحويلات', String(total)]].forEach(([k, v]) => { const x = el('div'); x.append(el('span', '', k), el('b', '', v)); stats.append(x); });
    const list = el('div'); list.append(el('h3', '', 'أعماله'));
    apps.forEach((x) => { const rel = [...(x.app_releases || [])].sort((p, q) => q.version_code - p.version_code)[0]; const r = el('button', 'gx-row gx-appbtn'); r.type = 'button';
      const i = el('div', 'gx-mini-ic'); if (x.icon_path) { const im = el('img'); im.alt = ''; im.src = sb().storage.from('app-media').getPublicUrl(x.icon_path).data.publicUrl; i.append(im); } else i.textContent = [...x.name][0].toUpperCase();
      const info = el('div', 'gx-grow'); info.append(el('b', '', x.name), el('small', '', (CATS[x.category] || x.category) + (rel ? ' · v' + rel.version_name : '') + ' · ' + x.downloads + ' تحويل')); r.append(i, info);
      r.onclick = () => { const c = document.querySelector('.product[data-app-id="' + x.id + '"]'); if (c) { sub.remove(); openPage(c); } }; list.append(r); });
    if (!apps.length) list.append(el('p', 'gx-admin-sub', 'لا توجد تطبيقات منشورة.'));
    inner.append(hero, stats, list);
  }
})();
