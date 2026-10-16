/* Gamer X — حساب المطور: قسم «إضافة تطبيق» وقسم «إدارة تطبيقاتك». */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x === 'class') e.className = v; else if (x.startsWith('on')) e[x] = v; else e.setAttribute(x, v); } e.append(...k.flat().filter((n) => n != null)); return e; };
  const toast = (m) => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); };
  const D = () => window.GamerXDeveloper, sb = D()?.sb;
  const modal = $('#devAccountModal');
  window.GamerXDeveloperConsole = { open: () => toast('حساب المطور غير متاح حاليًا.') };
  if (!sb || !modal) return;

  const CATS = { apps: 'تطبيق', games: 'لعبة', tools: 'أداة' };
  const ST = { published: 'منشور', suspended: 'موقوف', review: 'قيد المراجعة', draft: 'مسودة', rejected: 'مرفوض' };
  const MAX_APK = 52428800;
  const fmt = (n) => Number(n || 0).toLocaleString('ar-EG');
  const size = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const pkgId = () => 'gx.app_' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const iconUrl = (p) => (p ? sb.storage.from('app-media').getPublicUrl(p).data.publicUrl : '');
  const msg = (t, ok) => { const m = $('#dvMsg'); m.textContent = t || ''; m.classList.toggle('success', !!ok); };
  const letter = (n) => [...(n || 'G')][0].toUpperCase();

  function logoBlob(file) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256); URL.revokeObjectURL(u);
        c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/webp', 0.85); };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); }; img.src = u;
    });
  }
  async function uploadLogo(file, appId) {
    const b = await logoBlob(file), path = `${D().getUid()}/${appId}/icon-${Date.now()}.${b.type === 'image/webp' ? 'webp' : 'png'}`;
    const up = await sb.storage.from('app-media').upload(path, b, { contentType: b.type }); if (up.error) throw up.error; return path;
  }
  const rmFiles = (bucket, paths) => { const p = paths.filter(Boolean); return p.length ? sb.storage.from(bucket).remove(p).catch(() => {}) : Promise.resolve(); };

  /* ---------- confirm box ---------- */
  const cm = $('#dvConfirmModal'); let pending = null;
  const settle = (v) => { cm.hidden = true; const p = pending; pending = null; p && p(v); };
  function confirmBox(text, ok = 'نعم') {
    if (pending) pending(false);
    $('#dvConfirmText').textContent = text; $('#dvConfirmOk').textContent = ok; cm.hidden = false;
    return new Promise((r) => { pending = r; });
  }
  $('#dvConfirmOk').onclick = () => settle(true); $('#dvConfirmCancel').onclick = () => settle(false);
  cm.addEventListener('click', (e) => { if (e.target === cm) settle(false); });

  /* ---------- tabs ---------- */
  function showTab(name) {
    $$('.dv-tab', modal).forEach((b) => { const on = b.dataset.dvTab === name; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $$('.dv-section', modal).forEach((s) => { s.hidden = s.dataset.dvSection !== name; });
    msg(''); if (name === 'manage') loadManage();
  }
  $$('.dv-tab', modal).forEach((b) => b.addEventListener('click', () => showTab(b.dataset.dvTab)));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  function open() {
    const d = D();
    if (!d.getUid()) return toast('سجّل الدخول أولًا.');
    if (!d.isDev()) return d.openRequest();
    $('#settingsModal') && ($('#settingsModal').hidden = true); modal.hidden = false; showTab('add');
  }
  window.GamerXDeveloperConsole = { open };

  /* ---------- add app ---------- */
  const logoIn = $('#dvLogo'), apkIn = $('#dvApk'), prev = $('#dvLogoPreview');
  let prevUrl = null;
  function resetPreview() { if (prevUrl) URL.revokeObjectURL(prevUrl); prevUrl = null; prev.style.backgroundImage = ''; prev.textContent = letter($('#dvName').value || 'GX'); $('#dvLogoClear').hidden = true; logoIn.value = ''; }
  logoIn.addEventListener('change', () => {
    const f = logoIn.files[0]; if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { logoIn.value = ''; return msg('اللوجو لازم يكون PNG أو JPG أو WEBP.'); }
    if (f.size > 2097152) { logoIn.value = ''; return msg('اللوجو أكبر من 2MB.'); }
    msg(''); if (prevUrl) URL.revokeObjectURL(prevUrl); prevUrl = URL.createObjectURL(f);
    prev.style.backgroundImage = `url("${prevUrl}")`; prev.textContent = ''; $('#dvLogoClear').hidden = false;
  });
  $('#dvLogoClear').onclick = resetPreview;
  $('#dvName').addEventListener('input', () => { if (!prevUrl) prev.textContent = letter($('#dvName').value || 'GX'); });
  apkIn.addEventListener('change', () => {
    const f = apkIn.files[0], l = $('#dvApkLabel');
    if (!f) { l.textContent = 'اختيار ملف APK'; return; }
    if (!/\.apk$/i.test(f.name)) { apkIn.value = ''; l.textContent = 'اختيار ملف APK'; return msg('الملف لازم يكون APK.'); }
    if (f.size > MAX_APK) { apkIn.value = ''; l.textContent = 'اختيار ملف APK'; return msg('حجم الـ APK أكبر من 50MB.'); }
    msg(''); l.textContent = `${f.name} · ${size(f.size)}`;
  });

  async function publish(btn) {
    const name = $('#dvName').value.trim(), cat = $('#dvCategory').value, desc = $('#dvDesc').value.trim(), apk = apkIn.files[0], logo = logoIn.files[0], uid = D().getUid();
    if (name.length < 2) return msg('اكتب اسم التطبيق (حرفين على الأقل).');
    if (!CATS[cat]) return msg('اختر التصنيف.');
    if (!apk) return msg('اختر ملف APK.');
    btn.disabled = true; msg('جاري إنشاء التطبيق…', true);
    let appId = null; const paths = [];
    const rollback = async () => { if (appId) await sb.from('apps').delete().eq('id', appId); await rmFiles('apks', paths.filter((p) => p.endsWith('.apk'))); await rmFiles('app-media', paths.filter((p) => !p.endsWith('.apk'))); };
    try {
      let ins = await sb.from('apps').insert({ developer_id: uid, name, package_id: pkgId(), category: cat, description: desc, status: 'published' }).select('id').single();
      if (ins.error?.code === '23505') ins = await sb.from('apps').insert({ developer_id: uid, name, package_id: pkgId(), category: cat, description: desc, status: 'published' }).select('id').single();
      if (ins.error) throw new Error(/row-level|42501/.test(ins.error.code + ins.error.message) ? 'ما تقدرش تنشر دلوقتي. تأكد من تشغيل supabase-update-4.sql.' : 'تعذر إنشاء التطبيق.');
      appId = ins.data.id;
      if (logo) { msg('جاري رفع اللوجو…', true); const p = await uploadLogo(logo, appId).catch(() => { throw new Error('تعذر رفع اللوجو.'); }); paths.push(p);
        const u = await sb.from('apps').update({ icon_path: p }).eq('id', appId); if (u.error) throw new Error('تعذر حفظ اللوجو.'); }
      msg('جاري رفع ملف APK… ممكن ياخد وقت حسب الحجم.', true);
      const apkPath = `${uid}/${appId}/1.apk`;
      const up = await sb.storage.from('apks').upload(apkPath, apk, { contentType: 'application/vnd.android.package-archive' });
      if (up.error) throw new Error('تعذر رفع الـ APK (الحجم أو الاتصال).'); paths.push(apkPath);
      const rel = await sb.from('app_releases').insert({ app_id: appId, version_name: '1.0.0', version_code: 1, apk_path: apkPath, size_bytes: apk.size, notes: '', status: 'approved' });
      if (rel.error) throw new Error('تعذر حفظ الإصدار.');
    } catch (err) { await rollback(); btn.disabled = false; return msg(err.message || 'تعذر نشر التطبيق.'); }
    btn.disabled = false;
    $('#dvName').value = ''; $('#dvDesc').value = ''; $('#dvCategory').value = 'apps'; apkIn.value = ''; $('#dvApkLabel').textContent = 'اختيار ملف APK'; resetPreview();
    document.dispatchEvent(new Event('gx:catalog-refresh')); toast('تم نشر التطبيق في المتجر ✓'); showTab('manage'); msg('تم نشر «' + name + '» بنجاح.', true);
  }
  $('#dvPublish').addEventListener('click', (e) => publish(e.currentTarget));

  /* ---------- manage apps ---------- */
  async function loadManage() {
    const box = $('#dvApps'), uid = D().getUid(); box.replaceChildren(h('p', { class: 'data-note' }, 'جاري التحميل…')); $('#dvSummary').replaceChildren();
    const sel = (extra) => sb.from('apps').select('id,name,category,description,status,downloads,created_at' + extra[0] + ',app_releases(id,version_name,version_code,size_bytes' + extra[1] + ')').eq('developer_id', uid).order('created_at', { ascending: false });
    let { data: apps, error } = await sel([',icon_path', ',status']);
    if (error) ({ data: apps, error } = await sel(['', '']));
    if (error) return box.replaceChildren(h('p', { class: 'data-note' }, 'تعذر تحميل تطبيقاتك. حاول مرة أخرى.'));
    const st = await sb.rpc('gx_dev_app_stats'), favs = new Map(st.error ? [] : (st.data || []).map((r) => [r.app_id, Number(r.favorites)]));
    try { localStorage.setItem('gx_developer_apps', JSON.stringify(apps.map((a) => a.id))); } catch {}
    const tile = (n, l) => h('div', {}, h('b', {}, n), h('small', {}, l));
    $('#dvSummary').replaceChildren(tile(fmt(apps.length), 'تطبيقاتك'), tile(fmt(apps.reduce((s, a) => s + Number(a.downloads), 0)), 'التنزيلات'), tile(st.error ? '—' : fmt([...favs.values()].reduce((s, n) => s + n, 0)), 'المفضلة'));
    if (!apps.length) return box.replaceChildren(h('p', { class: 'profile-empty' }, 'لا توجد تطبيقات بعد. ابدأ من «إضافة تطبيق».'));
    box.replaceChildren(...apps.map((a) => appCard(a, st.error ? null : favs.get(a.id) || 0)),
      h('p', { class: 'dv-hint' }, 'عدد المفضلة يشمل المستخدمين المسجّلين فقط.'));
  }

  function appCard(a, fav) {
    const rels = [...(a.app_releases || [])].sort((x, y) => y.version_code - x.version_code), last = rels[0], suspended = a.status === 'suspended';
    const ico = a.icon_path ? h('img', { class: 'dv-ico', src: iconUrl(a.icon_path), alt: '', width: 48, height: 48 }) : h('div', { class: 'dv-ico' }, letter(a.name));
    const card = h('div', { class: 'dv-app' },
      h('div', { class: 'dv-row' }, h('span', { class: 'dv-id' }, ico, h('span', {}, h('b', {}, a.name), h('small', {}, `${CATS[a.category] || a.category}${last ? ' · v' + last.version_name : ''}`))), h('span', { class: 'dv-chip ' + a.status }, ST[a.status] || a.status)),
      h('div', { class: 'dv-stats' }, h('span', {}, '★ ', h('b', {}, fav == null ? '—' : fmt(fav)), ' مفضلة'), h('span', {}, '⬇ ', h('b', {}, fmt(a.downloads)), ' تنزيل')));
    if (suspended) card.append(h('p', { class: 'data-note' }, 'تم إيقاف هذا التطبيق من إدارة المتجر. يمكنك إزالته فقط.'));
    else card.append(editTools(a, last, rels));
    card.append(h('button', { class: 'danger-action dv-remove', type: 'button', onclick: () => removeApp(a, rels) }, 'إزالة التطبيق'));
    return card;
  }

  function editTools(a, last, rels) {
    const name = h('input', { maxlength: 60, value: a.name }), desc = h('textarea', { rows: 4, maxlength: 1000, placeholder: 'أضف وصفًا للتطبيق…' }),
      cat = h('select', {}, Object.entries(CATS).map(([k, v]) => h('option', Object.assign({ value: k }, k === a.category ? { selected: '' } : {}), v))),
      file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }), fld = (l, el) => h('label', { class: 'auth-field' }, h('span', {}, l), el);
    desc.value = a.description || '';
    const save = h('button', { class: 'modal-action', type: 'button', onclick: async () => {
      const n = name.value.trim(); if (n.length < 2) return msg('اكتب اسم التطبيق (حرفين على الأقل).');
      if (file.files[0] && (!/^image\/(png|jpeg|webp)$/.test(file.files[0].type) || file.files[0].size > 2097152)) return msg('اللوجو لازم يكون PNG/JPG/WEBP وحتى 2MB.');
      save.disabled = true; const patch = { name: n, category: cat.value, description: desc.value.trim() }; let np = null;
      try { if (file.files[0]) { np = await uploadLogo(file.files[0], a.id); patch.icon_path = np; } } catch { save.disabled = false; return msg('تعذر رفع اللوجو.'); }
      const { error } = await sb.from('apps').update(patch).eq('id', a.id); save.disabled = false;
      if (error) { await rmFiles('app-media', [np]); return msg('تعذر حفظ التعديلات.'); }
      if (np) await rmFiles('app-media', [a.icon_path]);
      document.dispatchEvent(new Event('gx:catalog-refresh')); toast('تم حفظ التعديلات'); loadManage();
    } }, 'حفظ التعديلات');
    const vn = h('input', { maxlength: 30, placeholder: 'اسم الإصدار الجديد مثال: 1.1.0', dir: 'ltr' }), apk = h('input', { type: 'file', accept: '.apk' });
    const upd = h('button', { class: 'secondary-action dv-wide', type: 'button', onclick: async () => {
      const f = apk.files[0], v = vn.value.trim();
      if (!v) return msg('اكتب اسم الإصدار.'); if (!f || !/\.apk$/i.test(f.name)) return msg('اختر ملف APK.'); if (f.size > MAX_APK) return msg('حجم الـ APK أكبر من 50MB.');
      const code = (rels[0]?.version_code || 0) + 1, path = `${D().getUid()}/${a.id}/${code}.apk`;
      upd.disabled = true; msg('جاري رفع الإصدار…', true);
      const up = await sb.storage.from('apks').upload(path, f, { contentType: 'application/vnd.android.package-archive' });
      if (up.error) { upd.disabled = false; return msg('تعذر رفع الملف.'); }
      const { error } = await sb.from('app_releases').insert({ app_id: a.id, version_name: v, version_code: code, apk_path: path, size_bytes: f.size, notes: '', status: 'approved' });
      upd.disabled = false; if (error) { await rmFiles('apks', [path]); return msg('تعذر حفظ الإصدار.'); }
      await sb.from('apps').update({ updated_at: new Date().toISOString() }).eq('id', a.id);
      document.dispatchEvent(new Event('gx:catalog-refresh')); toast('تم رفع الإصدار الجديد'); loadManage();
    } }, 'رفع الإصدار');
    return h('details', { class: 'dv-tools' }, h('summary', {}, '✎ أدوات التعديل'),
      h('div', { class: 'dv-form' }, fld('اسم التطبيق', name), fld('التصنيف', cat), fld('الوصف', desc), fld(a.icon_path ? 'تغيير اللوجو' : 'رفع لوجو', file), save,
        h('div', { class: 'dv-sep' }, 'تحديث التطبيق'), fld('إصدار جديد' + (last ? ` (الحالي ${last.version_name})` : ''), vn), fld('ملف APK الجديد', apk), upd));
  }

  async function removeApp(a, rels) {
    const ok = await confirmBox(`هل أنت متأكد من أنك تريد إزالة تطبيقك «${a.name}»؟ سيُحذف من المتجر نهائيًا مع ملفاته ولا يمكن التراجع.`, 'نعم، إزالة التطبيق');
    if (!ok) return;
    const { error } = await sb.from('apps').delete().eq('id', a.id);
    if (error) return msg('تعذر إزالة التطبيق.');
    await rmFiles('apks', rels.map((r) => r.apk_path || `${D().getUid()}/${a.id}/${r.version_code}.apk`)); await rmFiles('app-media', [a.icon_path]);
    document.dispatchEvent(new Event('gx:catalog-refresh')); toast('تمت إزالة التطبيق'); loadManage();
  }
})();
