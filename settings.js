/* Gamer X Store — Settings module (stacked sections, backgrounds, motion, account) */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const modal = $('#settingsModal');
  if (!modal) return;

  const K = { bg: 'gx_bg', motionBg: 'gx_motion_bg', img: 'gx_bg_image', save: 'gx_save_fav', gen: 'gx_gen', fx: 'gx_fx', motion: 'gx_motion' };
  const ACCOUNTS = 'gx_accounts_v1', SESSION = 'gx_session_v1';
  const BGS = ['default', 'midnight', 'violet', 'ocean', 'sunset'], MOTIONS = ['particles', 'aurora', 'grid', 'none'];
  const get = (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : v } catch { return d } };
  const set = (k, v) => { try { localStorage.setItem(k, v); return true } catch { return false } };
  const del = k => { try { localStorage.removeItem(k) } catch {} };
  const json = (k, d) => { try { return JSON.parse(get(k)) ?? d } catch { return d } };
  const toast = m => { const t = $('#toast'); if (!t) return; clearTimeout(toast.t); t.textContent = m; t.classList.add('show'); toast.t = setTimeout(() => t.classList.remove('show'), 2600) };
  const auth = () => window.GamerXAuth || {};
  let genOff = () => {};
  const initials = n => (n || 'GX').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase().slice(0, 2) || 'GX';

  /* ---- Stacked sections (accordion) ---- */
  let currentTab = 'account';
  function showTab(name) {
    currentTab = name;
    $$('[data-settings-section]', modal).forEach(sec => {
      const on = sec.dataset.settingsSection === name, body = $('.acc-body', sec), head = $('.acc-head', sec);
      sec.classList.toggle('active', on); body.hidden = !on; head.setAttribute('aria-expanded', on);
    });
    if (name === 'account') refreshAccount();
    const act = $('.gx-acc.active', modal); if (act) setTimeout(() => act.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
  }
  $$('[data-settings-tab]', modal).forEach(b => b.addEventListener('click', () => showTab(currentTab === b.dataset.settingsTab ? '' : b.dataset.settingsTab)));
  $('#settingsBtn')?.addEventListener('click', () => showTab(currentTab));

  /* ---- Static backgrounds + custom image ---- */
  const layer = document.createElement('div');
  layer.className = 'gx-bg-image'; layer.setAttribute('aria-hidden', 'true');
  document.body.prepend(layer);
  function applyBg() {
    const img = get(K.img), saved = get(K.bg), bg = BGS.includes(saved) ? saved : 'default';
    document.documentElement.dataset.bg = img ? 'image' : bg;
    layer.style.backgroundImage = img ? `url("${img}")` : '';
    $$('.bg-choice').forEach(b => b.classList.toggle('active', !img && b.dataset.bg === bg));
  }
  $$('.bg-choice').forEach(b => b.addEventListener('click', () => { genOff(); del(K.img); set(K.bg, b.dataset.bg); applyBg() }));

  function compress(file, max, q) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q));
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej() };
      im.src = url;
    });
  }
  $('#backgroundImageInput')?.addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return toast('اختر صورة PNG أو JPG أو WEBP أو GIF.');
    if (f.size > 12 * 1024 * 1024) return toast('الصورة كبيرة جدًا (الحد 12MB).');
    try {
      let ok = false;
      for (const [max, q] of [[1600, .82], [1100, .7]]) { if (set(K.img, await compress(f, max, q))) { ok = true; break } }
      if (!ok) return toast('تعذّر الحفظ: مساحة التخزين ممتلئة.');
      genOff(); applyBg(); toast('تم تطبيق صورتك كخلفية');
    } catch { toast('تعذّر قراءة الصورة.') }
  });
  $('#removeBackgroundBtn')?.addEventListener('click', () => { if (!get(K.img)) return toast('لا توجد صورة مرفوعة.'); del(K.img); applyBg(); toast('تمت إزالة الصورة') });

  /* ---- Animated effects ---- */
  function applyMotionBg() {
    const saved = get(K.motionBg), m = MOTIONS.includes(saved) ? saved : 'particles';
    document.body.dataset.motionBg = m;
    $$('.motion-choice').forEach(b => b.classList.toggle('active', b.dataset.motionBg === m));
  }
  $$('.motion-choice').forEach(b => b.addEventListener('click', () => { genOff(); set(K.motionBg, b.dataset.motionBg); applyMotionBg() }));

  /* ---- Toggles (state restored on load) ---- */
  const fx = $('#fxToggle'), sv = $('#saveToggle');
  if (fx) { fx.checked = get(K.fx) !== 'false' }
  if (sv) { sv.checked = get(K.save) !== 'false'; sv.addEventListener('change', () => set(K.save, sv.checked)) }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('.bookmark-btn');
    if (b && get(K.save) === 'false' && b.getAttribute('aria-pressed') !== 'true') {
      e.stopImmediatePropagation(); e.preventDefault(); toast('حفظ المفضلة متوقف من الإعدادات.');
    }
  }, true);

  /* ---- Account ---- */
  function refreshAccount() {
    const a = auth().getCurrentAccount?.() || null, name = a ? (a.displayName || a.name || a.email.split('@')[0]) : 'زائر';
    $('#settingsAccountName').textContent = name;
    $('#settingsAccountEmail').textContent = a ? a.email : 'سجّل الدخول لإدارة حسابك';
    $('#settingsAvatar').textContent = a ? initials(name) : 'GX';
    $('#settingsProfileBtn').textContent = a ? 'الملف الشخصي' : 'تسجيل الدخول';
    $('#settingsLogoutBtn').hidden = !a; $('#settingsDeleteAccountBtn').hidden = !a;
  }
  $('#settingsProfileBtn')?.addEventListener('click', () => {
    const a = auth().getCurrentAccount?.(); modal.hidden = true;
    a ? auth().openProfileSetup?.(a) : auth().openAuth?.('login');
  });
  $('#settingsLogoutBtn')?.addEventListener('click', () => { auth().logout?.(); toast('تم تسجيل الخروج'); refreshAccount() });
  $('#settingsDeleteAccountBtn')?.addEventListener('click', () => {
    const a = auth().getCurrentAccount?.(); if (!a) return;
    if (!confirm('حذف حسابك نهائيًا من هذا الجهاز؟ لا يمكن التراجع.')) return;
    const all = json(ACCOUNTS, {}); delete all[a.email]; set(ACCOUNTS, JSON.stringify(all)); del(SESSION);
    auth().logout?.(); toast('تم حذف الحساب'); refreshAccount();
  });

  /* ---- Background designs (generated: stars, nebula, squares, grid, rings, waves, aurora, meteors, geo) ---- */
const TYPES=[['stars','نجوم'],['nebula','سديم'],['squares','مربعات'],['grid','شبكة'],['rings','دوائر'],['waves','موجات'],['aurora','أورورا'],['meteors','شهب'],['geo','هندسي']];
const PAL={purple:{n:'بنفسجي',b:['#05030d','#170b3b'],a:['#7c3aed','#a78bfa','#c084fc','#ffffff'],g:'#4338ca'},blue:{n:'أزرق غامق',b:['#030616','#0a1a52'],a:['#3b5bdb','#60a5fa','#93c5fd','#ffffff'],g:'#1d4ed8'},mix:{n:'مختلط',b:['#05030d','#0b1235'],a:['#7c3aed','#3b5bdb','#a78bfa','#60a5fa'],g:'#6d28d9'}};
function rng(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gen(o){
const r=rng(o.seed),P=PAL[o.pal],D=[.3,.65,1][o.dens-1],A=P.a,rn=(a,b)=>a+(b-a)*r(),pk=a=>a[Math.floor(r()*a.length)],f=n=>+n.toFixed(1),N=(n,m)=>Math.round(n*D)+m;
const st=n=>{let s='';for(let i=0;i<n;i++){const z=rn(1,2.6);s+=`<i class="s" style="left:${f(rn(0,100))}%;top:${f(rn(0,100))}%;width:${f(z)}px;height:${f(z)}px;background:${pk(A)};opacity:${f(rn(.35,1))};--t:${f(rn(2,5))}s;--d:-${f(rn(0,5))}s"></i>`}return s};
const sp=n=>{let s='';for(let i=0;i<n;i++){const z=rn(12,26);s+=`<i class="k" style="left:${f(rn(2,98))}%;top:${f(rn(2,98))}%;width:${f(z)}px;height:${f(z)}px;background:${pk(A)};--t:${f(rn(3,6))}s;--d:-${f(rn(0,5))}s"></i>`}return s};
const gl=(x,y,s,c)=>`<i class="gl" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;background:radial-gradient(circle,${c}66,transparent 65%);--t:${f(rn(12,22))}s"></i>`;
const sq=n=>{let s='';for(let i=0;i<n;i++){const z=rn(14,90),c=pk(A);s+=`<i class="q" style="left:${f(rn(0,100))}%;top:${f(rn(0,100))}%;width:${f(z)}px;height:${f(z)}px;--r:${f(rn(0,80))}deg;border:1.5px solid ${c};background:${r()<.35?c+'33':'transparent'};--t:${f(rn(6,14))}s;--d:-${f(rn(0,8))}s"></i>`}return s};
let h='',c='',k='';
const TW='.s,.k{animation:tw var(--t) ease-in-out var(--d) infinite}@keyframes tw{50%{opacity:.2;transform:scale(.55)}}',
DR='.gl{animation:dr var(--t) ease-in-out infinite}@keyframes dr{50%{transform:translate(-50%,-50%) translate(40px,-30px) scale(1.15)}}',
FL='.q,.t{animation:fl var(--t) ease-in-out var(--d) infinite}@keyframes fl{50%{transform:translateY(-34px) rotate(calc(var(--r) + 45deg))}}';
c='.s{border-radius:50%}.k{clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)}.gl{border-radius:50%;transform:translate(-50%,-50%)}.q,.t{transform:rotate(var(--r))}';
k=TW+DR;
const T=o.type;
if(T=='stars'){h=gl(75,20,560,A[0])+gl(15,85,480,P.g)+st(N(260,20))+sp(N(14,2))}
if(T=='nebula'){for(let i=0;i<N(4,3);i++)h+=gl(rn(5,95),rn(5,95),rn(500,900),pk([A[0],P.g,A[1]]));h+=st(N(120,10))+sp(N(8,2))}
if(T=='squares'){h=gl(20,30,520,A[0])+gl(85,80,460,P.g)+sq(N(46,6))+st(N(40,5));k+=FL}
if(T=='grid'){const z=[96,64,40][o.dens-1];h='<i class="g"></i>'+gl(50,45,700,P.g)+sq(N(12,2))+st(N(40,5));c+=`.g{inset:0;background-image:linear-gradient(${A[2]}30 1px,transparent 1px),linear-gradient(90deg,${A[2]}30 1px,transparent 1px);background-size:${z}px ${z}px;-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 80%);mask-image:radial-gradient(ellipse at center,#000 30%,transparent 80%)}`;k+=`.g{animation:gm 6s linear infinite}@keyframes gm{to{background-position:${z}px ${z}px}}`+FL}
if(T=='rings'){const cx=f(rn(35,65)),cy=f(rn(40,60));h=gl(cx,cy,600,A[0]);for(let i=0;i<N(10,3);i++){const z=90+i*(o.dens==1?150:o.dens==2?90:60);h+=`<i class="x" style="left:${cx}%;top:${cy}%;width:${z}px;height:${z}px;border:1.5px ${i%3==2?'dashed':'solid'} ${pk(A.slice(0,3))};opacity:${f(.85-i*.04)};--t:${f(rn(5,10))}s;--d:-${f(rn(0,6))}s"></i>`}h+=st(N(60,8))+sp(N(6,1));c+='.x{border-radius:50%;transform:translate(-50%,-50%)}';k+='.x{animation:pu var(--t) ease-in-out var(--d) infinite}@keyframes pu{50%{transform:translate(-50%,-50%) scale(1.07)}}'}
if(T=='waves'){h=gl(80,15,520,A[0])+gl(10,90,480,P.g)+st(N(70,10));for(let i=0;i<N(7,2);i++){const b=rn(250,560),a=rn(30,110),p=rn(0,6.28),q=rn(20,60);let d='';for(let x=0;x<=2560;x+=20)d+=(x?'L':'M')+x+' '+f(b+a*Math.sin(6.2832*x/640+p)+q*Math.sin(6.2832*x/1280+p*2))+' ';h+=`<svg class="w" viewBox="0 0 2560 720" preserveAspectRatio="none" style="--t:${f(rn(14,34))}s"><path d="${d}" fill="none" stroke="${pk(A.slice(0,3))}" stroke-width="2" vector-effect="non-scaling-stroke" opacity="${f(rn(.4,.9))}"/></svg>`}c+='.w{left:0;top:0;width:200%;height:100%}';k+='.w{animation:wv var(--t) linear infinite}@keyframes wv{to{transform:translateX(-50%)}}'}
if(T=='aurora'){for(let i=0;i<N(4,3);i++)h+=`<i class="au" style="left:${f(rn(5,95))}%;top:${f(rn(10,90))}%;width:${f(rn(300,600))}px;height:${f(rn(200,420))}px;background:${pk([A[0],A[1],P.g,A[2]])};--t:${f(rn(10,22))}s"></i>`;h+=st(N(70,8));c+='.au{border-radius:50%;filter:blur(70px);opacity:.5;transform:translate(-50%,-50%);mix-blend-mode:screen}';k+='.au{animation:au var(--t) ease-in-out infinite}@keyframes au{50%{transform:translate(-50%,-50%) translate(80px,-50px) scale(1.25) rotate(25deg)}}'}
if(T=='meteors'){h=gl(80,15,500,P.g)+st(N(110,20));for(let i=0;i<N(14,3);i++)h+=`<i class="m" style="left:${f(rn(20,110))}%;top:${f(rn(-10,60))}%;--t:${f(rn(2.5,6))}s;--d:-${f(rn(0,6))}s;--c:${pk(A)}"></i>`;c+='.m{width:150px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--c));transform:rotate(145deg);opacity:.7}';k+='.m{animation:ms var(--t) ease-in var(--d) infinite}@keyframes ms{0%{transform:rotate(145deg) translateX(0);opacity:0}8%,70%{opacity:1}100%{transform:rotate(145deg) translateX(900px);opacity:0}}'}
if(T=='geo'){h='<i class="ln"></i><i class="dg"></i>'+gl(25,50,600,A[0]);for(let i=0;i<N(14,3);i++){const z=rn(22,70);h+=`<svg class="t" viewBox="0 0 100 100" style="left:${f(rn(0,100))}%;top:${f(rn(0,100))}%;width:${f(z)}px;height:${f(z)}px;--r:${f(rn(0,120))}deg;--t:${f(rn(6,14))}s;--d:-${f(rn(0,8))}s"><polygon points="50,8 94,88 6,88" fill="none" stroke="${pk(A)}" stroke-width="3"/></svg>`}for(let i=0;i<N(10,2);i++)h+=`<svg class="t" viewBox="0 0 20 20" style="left:${f(rn(0,100))}%;top:${f(rn(0,100))}%;width:16px;height:16px;--r:0deg;--t:${f(rn(6,14))}s;--d:-${f(rn(0,8))}s"><path d="M10 2v16M2 10h16" stroke="#fff" stroke-width="2" opacity=".7"/></svg>`;h+=st(N(40,6));c+=`.ln{inset:0;background:linear-gradient(135deg,transparent 49%,${A[0]}44 49%,${A[0]}44 51%,transparent 51%) 0 0/60px 60px}.dg{inset:0;background:radial-gradient(${A[1]}88 1.5px,transparent 2px) 0 0/28px 28px;-webkit-mask-image:linear-gradient(90deg,transparent 40%,#000);mask-image:linear-gradient(90deg,transparent 40%,#000)}`;k+=FL+'.ln{animation:lm 5s linear infinite}@keyframes lm{to{background-position:60px 60px}}'}
return{c,k,h,P}}


  const DEF = { type: 'stars', anim: 1, dens: 2, pal: 'purple', seed: 7 };
  function validGen(o) { return !!o && typeof o === 'object' && TYPES.some(t => t[0] === o.type) && (o.anim === 0 || o.anim === 1) && [1, 2, 3].includes(o.dens) && !!PAL[o.pal] && Number.isFinite(o.seed) }
  const saved = json(K.gen, null);
  let gs = validGen(saved) ? { ...saved } : { ...DEF }, genActive = validGen(saved);
  const pageLayer = document.createElement('div'); pageLayer.className = 'gxg'; pageLayer.setAttribute('aria-hidden', 'true'); document.body.prepend(pageLayer);
  const pageStyle = document.createElement('style'), prevStyle = document.createElement('style'); document.head.append(pageStyle, prevStyle);
  const prefix = (t, root) => t.replace(/(^|\})([^@{}]+)\{/g, (m, a, b) => a + b.split(',').map(x => root + ' ' + x.trim()).join(',') + '{');
  function mkcss(g, root, pos, anim) {
    const kf = g.k.match(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})+\}/g) || [], rest = g.k.replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})+\}/g, '');
    return `${root}{position:${pos};inset:0;z-index:${pos === 'fixed' ? -1 : 0};overflow:hidden;background:linear-gradient(160deg,${g.P.b[0]},${g.P.b[1]})}${root} i,${root} svg{position:absolute;display:block}` + prefix(g.c, root) +
      (anim ? prefix(rest, root) + kf.join('') + `@media (prefers-reduced-motion:reduce){${root} *{animation:none!important}}` : '');
  }
  const mkChips = (id, key, items) => { const el = $(id); items.forEach(([v, l]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'design-chip'; b.textContent = l; b.dataset.dg = key; b.dataset.v = v; b.addEventListener('click', () => { gs[key] = typeof gs[key] === 'number' ? +v : v; if (key === 'type') gs.seed = gs.seed; genActive = true; renderGen() }); el.appendChild(b) }) };
  function renderGen() {
    const g = gen(gs);
    prevStyle.textContent = mkcss(g, '.gxp', 'absolute', gs.anim); $('#gxPreview').innerHTML = g.h;
    if (genActive) { pageStyle.textContent = mkcss(g, '.gxg', 'fixed', gs.anim); pageLayer.innerHTML = g.h; document.documentElement.dataset.gen = 'on'; set(K.gen, JSON.stringify(gs)) }
    else { pageStyle.textContent = ''; pageLayer.innerHTML = ''; delete document.documentElement.dataset.gen }
    $$('[data-dg]', modal).forEach(b => b.setAttribute('aria-pressed', String(String(gs[b.dataset.dg]) === b.dataset.v)));
    $('#designState').textContent = genActive ? 'التصميم مفعّل على الموقع الآن.' : 'المعاينة فقط — اختر أي خيار لتفعيله على الموقع.';
    $('#designOff').hidden = !genActive;
  }
  genOff = () => { if (!genActive) return; genActive = false; del(K.gen); renderGen() };
  if ($('#gxPreview')) {
    mkChips('#designTypes', 'type', TYPES); mkChips('#designAnim', 'anim', [[1, 'متحرك'], [0, 'ثابت']]); mkChips('#designDens', 'dens', [[1, 'سادة'], [2, 'متوسطة'], [3, 'مليئة']]); mkChips('#designPal', 'pal', Object.keys(PAL).map(k => [k, PAL[k].n]));
    $('#designRandom').addEventListener('click', () => { gs.seed = Math.floor(Math.random() * 99999); genActive = true; renderGen() });
    $('#designOff').addEventListener('click', () => { genOff(); toast('تم إيقاف التصميم والرجوع للخلفية العادية') });
    renderGen();
  }

  applyBg(); applyMotionBg(); showTab('account');
})();
