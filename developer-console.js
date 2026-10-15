/* Gamer X — developer program UI: settings upgrade card, gold badge, developer console (apps/releases/APK upload), owner review. */
(() => {
  if (window.GX_FEATURES && window.GX_FEATURES.developerAccount === false) return; // developer buttons are inert until enabled in gx-features.js
  const cfg = window.GX_SUPABASE_CONFIG;
  if (!cfg || !window.supabase || /YOUR_/.test(cfg.url)) return;
  const sb = window.GamerXSupabase || (window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey));
  const $ = (s, r = document) => r.querySelector(s);
  const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'class') e.className = v; else if (x.startsWith('on')) e[x] = v; else e.setAttribute(x, v); } e.append(...k.flat().filter((n) => n != null)); return e; };
  const ST = { draft: 'مسودة', review: 'قيد المراجعة', published: 'منشور', rejected: 'مرفوض', suspended: 'موقوف' };
  const CATS = { games: 'ألعاب', apps: 'تطبيقات', tools: 'أدوات' };
  const isDev = () => role === 'developer' || role === 'owner';
  let role = null, uid = null;

  document.head.append(h('style', {}, `
  .gx-dev-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font:700 12px/1.4 inherit;color:#2a1d00;background:linear-gradient(135deg,#ffe58a,#d4a017);box-shadow:0 0 12px rgba(255,200,60,.45);margin-inline-start:8px;vertical-align:middle}
  .dv-panel{max-width:780px;width:calc(100% - 24px);max-height:88vh;overflow:auto}
  .dv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
  .dv-grid div,.dv-app,#gxDevProgram{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px}
  .dv-grid b{display:block;font-size:22px}.dv-app{margin:10px 0}
  .dv-chip{padding:2px 9px;border-radius:999px;font-size:12px;background:rgba(255,255,255,.12)}
  .dv-chip.published{background:#1f7a3d}.dv-chip.review{background:#8a6d12}.dv-chip.rejected,.dv-chip.suspended{background:#8f2a2a}
  .dv-form{display:grid;gap:8px;margin-top:8px}.dv-form input,.dv-form select,.dv-form textarea{width:100%;padding:9px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:inherit;font:inherit}
  .dv-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}.dv-steps{padding-inline-start:20px;margin:8px 0}
  #gxDevProgram{margin:14px 0;display:grid;gap:8px}`));

  // ---------- role + badge ----------
  async function loadRole() {
    const { data: s } = await sb.auth.getSession(); uid = s.session?.user.id || null;
    if (uid) {
      const { data } = await sb.from('profiles').select('role').eq('id', uid).maybeSingle();
      if (data) role = data.role || null; else { const r = await sb.rpc('gx_ensure_profile'); role = r.data || null; }
    } else role = null;
    apply();
  }
  function badge(host, id) {
    let b = $('#' + id); if (!host) return;
    if (!b) { b = h('span', { class: 'gx-dev-badge', id }, '★ حساب مطور'); host.append(b); }
    b.hidden = !isDev();
  }
  function apply() {
    badge($('#profileTitle'), 'gxBadgeProfile'); badge($('#menuName'), 'gxBadgeMenu'); badge($('#settingsAccountName'), 'gxBadgeSettings');
    const ri = $('#profileRoleInput'); if (ri && isDev()) ri.value = role === 'owner' ? 'مالك المتجر' : 'حساب مطور';
    renderProgram();
  }
  function renderProgram() {
    const host = $('#accountSettings'); if (!host) return;
    let box = $('#gxDevProgram'); if (!box) { box = h('div', { id: 'gxDevProgram' }); ($('.account-actions', host) || host).after(box); }
    box.replaceChildren(h('span', { class: 'section-kicker' }, 'DEVELOPER PROGRAM'), h('h3', {}, 'حساب المطور'));
    if (!uid) box.append(h('p', { class: 'data-note' }, 'سجّل الدخول أولًا لتحويل حسابك إلى حساب مطور.'));
    else if (role === 'user') box.append(
      h('p', { class: 'data-note' }, 'انشر تطبيقاتك وألعابك على المتجر، وارفع الإصدارات، وتابع التحميلات من مركز المطور.'),
      h('ol', { class: 'dv-steps' }, ['اضغط "تحويل إلى حساب مطور"', 'استلم رمزًا من 8 خانات على بريدك المؤكد', 'أدخل الرمز فيتحول حسابك فورًا'].map((x) => h('li', {}, x))),
      h('button', { class: 'modal-action', type: 'button', onclick: () => window.GamerXDeveloper?.openUpgrade() }, 'تحويل إلى حساب مطور'));
    else if (!role) box.append(h('p', { class: 'data-note' }, 'تعذر تجهيز حسابك. حدّث الصفحة وحاول مرة أخرى، وتأكد من تشغيل ملف update-2.sql.'), h('button', { class: 'secondary-action', type: 'button', onclick: () => loadRole() }, 'إعادة المحاولة'));
    else if (isDev()) box.append(h('div', {}, h('span', { class: 'gx-dev-badge', style: 'margin:0' }, '★ حساب مطور')), h('button', { class: 'modal-action', type: 'button', onclick: openConsole }, 'فتح مركز المطور'));
  }

  // ---------- console modal ----------
  const modal = h('div', { class: 'modal-backdrop', hidden: '' });
  modal.innerHTML = '<section class="panel auth-panel dv-panel" role="dialog" aria-modal="true"><button class="modal-close" id="dvClose" aria-label="إغلاق">×</button><span class="section-kicker">DEVELOPER CONSOLE</span><h2>مركز المطور</h2><div class="auth-status" id="dvMsg" role="status"></div><div id="dvBody"></div></section>';
  document.body.append(modal);
  $('#dvClose').onclick = () => (modal.hidden = true);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
  const msg = (t, ok) => { const m = $('#dvMsg'); m.textContent = t || ''; m.classList.toggle('success', !!ok); };
  const field = (label, el) => h('label', { class: 'auth-field' }, h('span', {}, label), el);

  async function openConsole() { if (!isDev()) return; $('#settingsModal') && ($('#settingsModal').hidden = true); modal.hidden = false; msg(''); await render(); }

  async function render() {
    const body = $('#dvBody'); body.replaceChildren(h('p', { class: 'data-note' }, 'جاري التحميل…'));
    let { data: apps, error } = await sb.from('apps').select('*, app_releases(id,version_name,version_code,size_bytes,status,review_note)').eq('developer_id', uid).order('created_at', { ascending: false });
    if (error) ({ data: apps, error } = await sb.from('apps').select('*, app_releases(id,version_name,version_code,size_bytes)').eq('developer_id', uid).order('created_at', { ascending: false }));
    if (apps) apps.forEach((a) => (a.app_releases || []).forEach((r) => { r.status = r.status || 'approved'; }));
    if (error) return body.replaceChildren(h('p', { class: 'data-note' }, 'تعذر تحميل البيانات.'));
    const stat = (n, l) => h('div', {}, h('b', {}, String(n)), h('small', {}, l));
    body.replaceChildren(
      h('div', { class: 'dv-grid' }, stat(apps.length, 'تطبيقات'), stat(apps.filter((a) => a.status === 'published').length, 'منشورة'), stat(apps.reduce((s, a) => s + Number(a.downloads), 0), 'تحميلات')),
      newAppForm(), ...(apps.length ? apps.map(appCard) : [h('p', { class: 'data-note' }, 'لا توجد تطبيقات بعد. أضف أول تطبيق من الأعلى.')]));
    if (role === 'owner') body.append(await reviewQueue());
  }

  function newAppForm() {
    const name = h('input', { maxlength: 60, placeholder: 'اسم التطبيق' }), pkg = h('input', { placeholder: 'com.yourname.game', dir: 'ltr' }),
      cat = h('select', {}, Object.entries(CATS).map(([k, v]) => h('option', { value: k }, v))), desc = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'وصف صفحة المتجر' });
    const go = h('button', { class: 'modal-action', type: 'button', onclick: async () => {
      if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg.value.trim())) return msg('Package ID غير صالح. مثال: com.name.game (حروف صغيرة وأرقام و _ ونقطة).');
      if (name.value.trim().length < 2) return msg('اكتب اسم التطبيق.');
      go.disabled = true;
      const { error } = await sb.from('apps').insert({ developer_id: uid, name: name.value.trim(), package_id: pkg.value.trim(), category: cat.value, description: desc.value.trim() });
      go.disabled = false;
      if (error) return msg(error.code === '23505' ? 'Package ID مستخدم بالفعل.' : 'تعذر إنشاء التطبيق.');
      msg('تم إنشاء التطبيق كمسودة.', true); render();
    } }, 'إنشاء التطبيق');
    return h('details', { class: 'dv-app' }, h('summary', {}, '＋ تطبيق جديد'), h('div', { class: 'dv-form' }, field('الاسم', name), field('Package ID', pkg), field('الفئة', cat), field('الوصف', desc), go));
  }

  const iconUrl = (p) => (p ? sb.storage.from('app-media').getPublicUrl(p).data.publicUrl : '');
  function iconBlob(file) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256); URL.revokeObjectURL(u);
        c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/webp', 0.85); };
      img.onerror = rej; img.src = u;
    });
  }
  const RST = { approved: 'معتمد', pending: 'قيد المراجعة', rejected: 'مرفوض' };

  function appCard(a) {
    const rel = [...(a.app_releases || [])].sort((x, y) => y.version_code - x.version_code);
    const live = rel.find((r) => r.status === 'approved'), pend = rel.filter((r) => r.status === 'pending');
    const ic = a.icon_path ? h('img', { src: iconUrl(a.icon_path), width: 44, height: 44, alt: '', style: 'border-radius:12px;object-fit:cover' })
      : h('div', { style: 'width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.1);display:grid;place-items:center;font-weight:700' }, [...a.name][0].toUpperCase());
    const card = h('div', { class: 'dv-app' },
      h('div', { class: 'dv-row' }, h('span', { class: 'dv-row', style: 'gap:10px;justify-content:flex-start' }, ic, h('b', {}, a.name)), h('span', { class: 'dv-chip ' + a.status }, ST[a.status])),
      h('small', { dir: 'ltr' }, `${a.package_id} · ${CATS[a.category] || a.category} · ${a.downloads} تحميل · ${live ? 'v' + live.version_name + ' (' + live.version_code + ')' : 'بدون إصدارات'}`));
    if (a.review_note && a.status === 'rejected') card.append(h('p', { class: 'data-note' }, 'ملاحظة المراجعة: ' + a.review_note));
    rel.filter((r) => r.status !== 'approved').forEach((r) => card.append(h('div', { class: 'dv-row' }, h('small', {}, `إصدار ${r.version_name} (${r.version_code}) — ${RST[r.status]}${r.review_note ? ': ' + r.review_note : ''}`),
      h('button', { class: 'danger-action', type: 'button', onclick: async () => { const { error } = await sb.from('app_releases').delete().eq('id', r.id); if (error) return msg('تعذر الحذف.'); render(); } }, 'حذف'))));
    if (a.status !== 'review' && a.status !== 'suspended') { card.append(editForm(a)); card.append(releaseForm(a, rel)); }
    const actions = h('div', { class: 'dv-row' });
    if ((a.status === 'draft' || a.status === 'rejected') && live) actions.append(h('button', { class: 'secondary-action', type: 'button', onclick: async () => {
      const { error } = await sb.from('apps').update({ status: 'review' }).eq('id', a.id); if (error) return msg('تعذر الإرسال للمراجعة.'); msg('تم إرسال التطبيق للمراجعة.', true); render(); } }, 'إرسال للمراجعة'));
    if (a.status === 'draft' || a.status === 'rejected') actions.append(h('button', { class: 'danger-action', type: 'button', onclick: async () => {
      if (!confirm('حذف التطبيق نهائيًا؟')) return; const { error } = await sb.from('apps').delete().eq('id', a.id); if (error) return msg('تعذر الحذف.'); render(); } }, 'حذف'));
    card.append(actions); return card;
  }

  function editForm(a) {
    const locked = !(a.status === 'draft' || a.status === 'rejected');
    const name = h('input', { maxlength: 60, value: a.name }), cat = h('select', {}, Object.entries(CATS).map(([k, v]) => h('option', Object.assign({ value: k }, k === a.category ? { selected: '' } : {}), v)));
    const desc = h('textarea', { rows: 3, maxlength: 2000 }); desc.value = a.description || '';
    if (locked) name.disabled = true;
    const file = h('input', { type: 'file', accept: 'image/*' });
    const go = h('button', { class: 'secondary-action', type: 'button', onclick: async () => {
      go.disabled = true; const patch = { category: cat.value, description: desc.value.trim() };
      if (!locked) { if (name.value.trim().length < 2) { go.disabled = false; return msg('اكتب اسم التطبيق.'); } patch.name = name.value.trim(); }
      let newPath = null;
      if (file.files[0]) {
        try { const b = await iconBlob(file.files[0]); newPath = `${uid}/${a.id}/icon-${Date.now()}.${b.type === 'image/webp' ? 'webp' : 'png'}`;
          const up = await sb.storage.from('app-media').upload(newPath, b, { contentType: b.type }); if (up.error) throw up.error; patch.icon_path = newPath;
        } catch { go.disabled = false; return msg('تعذر رفع الأيقونة (حد 2MB).'); }
      }
      const { error } = await sb.from('apps').update(patch).eq('id', a.id); go.disabled = false;
      if (error) { if (newPath) await sb.storage.from('app-media').remove([newPath]); return msg('تعذر حفظ التعديلات.'); }
      if (newPath && a.icon_path) await sb.storage.from('app-media').remove([a.icon_path]);
      msg('تم حفظ التعديلات.', true); render();
    } }, 'حفظ التعديلات');
    return h('details', {}, h('summary', {}, '✎ تعديل البيانات والأيقونة'), h('div', { class: 'dv-form' }, field('الاسم' + (locked ? ' (مقفل بعد المراجعة)' : ''), name), field('الفئة', cat), field('الوصف', desc), field('أيقونة التطبيق', file), go));
  }

  function releaseForm(a, rel) {
    const isUpdate = a.status === 'published';
    const vn = h('input', { placeholder: 'اسم الإصدار 1.0.0', maxlength: 30, dir: 'ltr' }), vc = h('input', { type: 'number', min: 1, placeholder: 'رقم الإصدار', value: String((rel[0]?.version_code || 0) + 1) }),
      notes = h('textarea', { rows: 2, maxlength: 1000, placeholder: 'ما الجديد؟' }), file = h('input', { type: 'file', accept: '.apk' });
    const go = h('button', { class: 'secondary-action', type: 'button', onclick: async () => {
      const f = file.files[0], code = parseInt(vc.value, 10);
      if (!f || !/\.apk$/i.test(f.name)) return msg('اختر ملف APK.'); if (f.size > 52428800) return msg('الحد الأقصى 50MB.');
      if (!vn.value.trim() || !(code > 0)) return msg('أكمل بيانات الإصدار.'); if (rel.some((r) => r.version_code === code)) return msg('رقم الإصدار مستخدم.');
      if (rel.length && code <= rel[0].version_code) return msg('رقم الإصدار يجب أن يكون أكبر من الحالي.');
      go.disabled = true; msg('جاري رفع الملف…');
      const path = `${uid}/${a.id}/${code}.apk`;
      const up = await sb.storage.from('apks').upload(path, f, { contentType: 'application/vnd.android.package-archive' });
      if (up.error) { go.disabled = false; return msg('تعذر رفع الملف (قد يتجاوز حد الخطة).'); }
      const { error } = await sb.from('app_releases').insert({ app_id: a.id, version_name: vn.value.trim(), version_code: code, apk_path: path, size_bytes: f.size, notes: notes.value.trim(), status: isUpdate ? 'pending' : 'approved' });
      go.disabled = false;
      if (error) { await sb.storage.from('apks').remove([path]); return msg('تعذر حفظ الإصدار.'); }
      msg(isUpdate ? 'تم رفع التحديث وهو بانتظار المراجعة. النسخة الحالية تبقى منشورة.' : 'تم رفع الإصدار.', true); render();
    } }, 'رفع إصدار جديد');
    return h('details', {}, h('summary', {}, isUpdate ? '＋ تحديث جديد (يحتاج مراجعة)' : '＋ إصدار جديد'), h('div', { class: 'dv-form' }, vn, vc, notes, file, go));
  }

  async function reviewQueue() {
    const wrap = h('div', {}, h('h3', {}, 'طلبات المراجعة (Owner)'));
    const { data } = await sb.from('apps').select('id,name,package_id,developer_id').eq('status', 'review').order('created_at');
    const { data: rels } = await sb.from('app_releases').select('id,version_name,version_code,apps(name,package_id)').eq('status', 'pending').order('created_at');
    if (!data?.length && !rels?.length) { wrap.append(h('p', { class: 'data-note' }, 'لا توجد طلبات.')); return wrap; }
    const done = () => { msg('تم التحديث.', true); document.dispatchEvent(new Event('gx:catalog-refresh')); render(); };
    const setApp = async (id, status, note) => { const { error } = await sb.from('apps').update({ status, review_note: note || null }).eq('id', id); error ? msg('تعذر التحديث.') : done(); };
    const setRel = async (id, status, note) => { const { error } = await sb.from('app_releases').update({ status, review_note: note || null }).eq('id', id); error ? msg('تعذر التحديث.') : done(); };
    (data || []).forEach((a) => wrap.append(h('div', { class: 'dv-app dv-row' }, h('span', {}, `تطبيق: ${a.name} — ${a.package_id}`),
      h('span', {}, h('button', { class: 'secondary-action', type: 'button', onclick: () => setApp(a.id, 'published') }, 'نشر'),
        h('button', { class: 'danger-action', type: 'button', onclick: () => { const n = prompt('سبب الرفض؟'); if (n !== null) setApp(a.id, 'rejected', n); } }, 'رفض')))));
    (rels || []).forEach((r) => wrap.append(h('div', { class: 'dv-app dv-row' }, h('span', {}, `تحديث: ${r.apps?.name || ''} v${r.version_name} (${r.version_code})`),
      h('span', {}, h('button', { class: 'secondary-action', type: 'button', onclick: () => setRel(r.id, 'approved') }, 'اعتماد'),
        h('button', { class: 'danger-action', type: 'button', onclick: () => { const n = prompt('سبب الرفض؟'); if (n !== null) setRel(r.id, 'rejected', n); } }, 'رفض')))));
    return wrap;
  }

  $('#developerBtn')?.addEventListener('click', () => { $('#accountMenu') && ($('#accountMenu').hidden = true); openConsole(); });
  document.addEventListener('gx:role-changed', loadRole);
  sb.auth.onAuthStateChange(() => loadRole());
  new MutationObserver(apply).observe($('#profileModal') || document.body, { attributes: true, attributeFilter: ['hidden'] });
  $('#settingsModal') && new MutationObserver(apply).observe($('#settingsModal'), { attributes: true, attributeFilter: ['hidden'] });
  loadRole();
})();
