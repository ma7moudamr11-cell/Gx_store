/* Gamer X — store catalog from Supabase: published apps (latest release), developer name, real APK download, download counter. */
(() => {
  const cfg = window.GX_SUPABASE_CONFIG, grid = document.querySelector('#productsGrid');
  if (!cfg || !window.supabase || /YOUR_/.test(cfg.url) || !grid || !window.GamerXStore) return;
  const sb = window.GamerXSupabase || (window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey));
  const CATS = { games: 'ألعاب', apps: 'تطبيقات', tools: 'أدوات' };
  const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) e.setAttribute(x, v); e.append(...k); return e; };

  function card(a, devs) {
    const rel = [...a.app_releases].sort((x, y) => y.version_code - x.version_code)[0];
    const url = sb.storage.from('apks').getPublicUrl(rel.apk_path, { download: (String(a.name).replace(/[^\w\u0600-\u06FF.-]+/g, '-') || 'app') + '.apk' }).data.publicUrl;
    const dev = devs.get(a.developer_id) || 'مطور';
    const el = h('article', { class: 'product', 'data-name': a.name, 'data-category': a.category, 'data-version': rel.version_name,
      'data-developer': dev, 'data-updated': new Date(a.updated_at).toLocaleDateString('ar-EG'), 'data-download': url, 'data-app-id': a.id, 'data-downloads': a.downloads, 'data-ts': Date.parse(a.updated_at) });
    const icons = h('div', { class: 'product-icons' },
      h('button', { class: 'icon-btn bookmark-btn', type: 'button', 'aria-label': 'حفظ', style: 'width:34px;height:34px;border-radius:10px' }, '★'),
      h('button', { class: 'icon-btn info-btn', type: 'button', 'aria-label': 'تفاصيل', style: 'width:34px;height:34px;border-radius:10px' }, 'ⓘ'));
    const art = h('div', { class: 'product-art product-image' }, h('span', { class: 'badge' }, CATS[a.category] || a.category), icons,
      a.icon_path ? h('img', { class: 'art-icon', src: sb.storage.from('app-media').getPublicUrl(a.icon_path).data.publicUrl, alt: '', width: '72', height: '72', loading: 'lazy', style: 'width:72px;height:72px;border-radius:18px;object-fit:cover' }) : h('span', { class: 'art-icon' }, [...a.name][0].toUpperCase()));
    const dl = h('button', { class: 'modal-action download-btn', type: 'button' }, h('span', {}, 'تثبيت'));
    const desc = h('p', { class: 'product-description' }, a.description || '');
    const info = h('div', { class: 'product-info' }, h('h3', { class: 'product-title' }, a.name), desc,
      h('div', { class: 'product-meta' }, h('span', {}, dev), h('span', {}, 'v' + rel.version_name), h('span', {}, a.downloads + ' تحميل')), dl);
    el.append(art, info); return el;
  }

  async function load() {
    const base = (cols) => sb.from('apps').select(cols).eq('status', 'published');
    let { data: apps, error } = await base('id,name,category,description,downloads,updated_at,developer_id,icon_path,app_releases(version_name,version_code,apk_path)')
      .eq('app_releases.status', 'approved').order('updated_at', { ascending: false }).limit(60);
    // older databases (before the latest SQL) lack icon_path / release status: fall back to the basic query
    if (error) ({ data: apps, error } = await base('id,name,category,description,downloads,updated_at,developer_id,app_releases(version_name,version_code,apk_path)').order('updated_at', { ascending: false }).limit(60));
    if (error || !apps) return;
    const ids = [...new Set(apps.map((a) => a.developer_id))];
    const { data: devs } = ids.length ? await sb.from('gx_public_developers').select('id,display_name,username').in('id', ids) : { data: [] };
    const names = new Map((devs || []).map((d) => [d.id, d.display_name || d.username]));
    grid.replaceChildren(...apps.filter((a) => a.app_releases?.length).map((a) => card(a, names)));
    window.GamerXStore.bindCards();
    document.dispatchEvent(new Event('gx:catalog-loaded'));
  }
  window.GamerXHooks = Object.assign(window.GamerXHooks || {}, { onDownload(c) { const id = c.dataset.appId; if (id) sb.rpc('gx_count_download', { p_app: id }).then(() => {}, () => {}); } });
  document.addEventListener('gx:catalog-refresh', load);
  load();
})();
