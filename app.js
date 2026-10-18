(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const keyOf = (card) => card.dataset.appId || card.dataset.name;
  const store = {
    saved: JSON.parse(localStorage.getItem('gx_saved') || '[]'),
    downloadHistory: JSON.parse(localStorage.getItem('gx_download_history') || '[]'),
    motion: localStorage.getItem('gx_motion') !== 'false',
    fx: localStorage.getItem('gx_fx') !== 'false',
    downloads: new Map()
  };
  const toast = $('#toast');
  let toastTimer;
  function showToast(message){
    clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function haptic(){ if(store.fx && navigator.vibrate) navigator.vibrate(10); }
  function updateCounts(){
    $('#productCount').textContent = $$('.product:not(.hidden)').length;
    $('#savedCount').textContent = store.saved.length;
    $('#activeDownloads').textContent = [...store.downloads.values()].filter(x=>x.status==='downloading').length;
  }
  function saveState(){ localStorage.setItem('gx_saved', JSON.stringify(store.saved)); updateCounts(); if(activeFilter==='saved')filterProducts(); }

  // Animated background particles
  const particles = $('#particles');
  for(let i=0;i<0;i++){
    const p=document.createElement('i'); p.className='particle'; p.style.left=(Math.random()*100)+'%'; p.style.setProperty('--dx',((Math.random()-.5)*180)+'px'); p.style.animationDuration=(8+Math.random()*12)+'s'; p.style.animationDelay=(-Math.random()*18)+'s'; particles.appendChild(p);
  }
  function applyMotion(){ document.body.classList.toggle('reduce-motion', !store.motion); $('#motionToggle').checked=store.motion; }
  applyMotion();

  // Search/filter
  const input=$('#searchInput'), clear=$('#searchClear'), empty=$('#emptyState'); let activeFilter='all';
  function filterProducts(){
    const q=input.value.trim().toLowerCase(); let visible=0;
    $$('.product').forEach(card=>{
      const cats=card.dataset.category.split(' '), name=(card.dataset.name||'').toLowerCase();
      const matchFilter=activeFilter==='all'||(activeFilter==='saved'?store.saved.includes(keyOf(card)):cats.includes(activeFilter)); const matchSearch=!q||name.includes(q)||card.textContent.toLowerCase().includes(q);
      const show=matchFilter&&matchSearch; card.classList.toggle('hidden',!show); if(show)visible++;
    });
    clear.hidden=!input.value; empty.classList.toggle('visible',visible===0); updateCounts();
  }
  input.addEventListener('input',filterProducts); $('#heroSearchBtn').addEventListener('click',()=>{filterProducts(); $('#storeSection').scrollIntoView({behavior:'smooth',block:'start'}); haptic();});
  $('#searchBtn').addEventListener('click',()=>{input.focus(); window.scrollTo({top:0,behavior:'smooth'});});
  $('#searchClear').addEventListener('click',()=>{input.value='';filterProducts();input.focus();});
  $$('.category').forEach(btn=>btn.addEventListener('click',()=>{ $$('.category').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-pressed','false')});btn.classList.add('active');btn.setAttribute('aria-pressed','true');activeFilter=btn.dataset.filter;filterProducts();haptic(); }));
  $('#viewAll').addEventListener('click',()=>{activeFilter='all';input.value='';$$('.category').forEach(x=>{x.classList.toggle('active',x.dataset.filter==='all');x.setAttribute('aria-pressed',x.dataset.filter==='all')});filterProducts();});

  // Collection tabs
  $$('.collection-tab').forEach(tab=>tab.addEventListener('click',()=>{
    $$('.collection-tab').forEach(x=>x.classList.toggle('active',x===tab));
    const target=tab.dataset.collection;
    activeFilter=target==='all'?'all':target;
    $$('.category').forEach(x=>{const active=x.dataset.filter===activeFilter || (activeFilter==='all'&&x.dataset.filter==='all');x.classList.toggle('active',active);x.setAttribute('aria-pressed',active)});
    filterProducts();
    $('#storeSection').scrollIntoView({behavior:'smooth',block:'start'});
    haptic();
  }));

  // Favorites
  $$('.bookmark-btn').forEach(btn=>{
    const card=btn.closest('.product'), key=keyOf(card); const active=store.saved.includes(key); btn.setAttribute('aria-pressed',active);
    btn.addEventListener('click',()=>{
      const now=btn.getAttribute('aria-pressed')!=='true'; btn.setAttribute('aria-pressed',now); haptic();
      if(now){ if(!store.saved.includes(key))store.saved.push(key); showToast('تم حفظ '+card.dataset.name+' في المفضلة'); }
      else {store.saved=store.saved.filter(x=>x!==key);showToast('تمت إزالة '+card.dataset.name+' من المفضلة');}
      saveState(); window.GamerXHooks?.onFavorite?.(key,now);
    });
  });

  // Details
  const detailsModal=$('#detailsModal');
  let selectedDetailCard=null;
  function openDetails(card){
    selectedDetailCard=card;
    const name=card.dataset.name||'التطبيق';
    $('#detailsTitle').textContent=name;
    $('#detailsText').textContent=card.querySelector('.product-description')?.textContent||'';
    $('#detailsVersion').textContent=card.dataset.version||'—';
    $('#detailsDeveloper').textContent=card.dataset.developer||'—';
    $('#detailsRating').textContent=(card.dataset.rating?`★ ${card.dataset.rating}`:'—');
    $('#detailsUpdated').textContent=card.dataset.updated||'—';
    const art=card.querySelector('.art-icon'); $('#detailsArt').textContent=art?.textContent?.trim()||'GX';
    detailsModal.hidden=false;
  }
  $$('.info-btn').forEach(btn=>btn.addEventListener('click',()=>openDetails(btn.closest('.product'))));
  $('#detailsDownload').addEventListener('click',()=>{
    if(!selectedDetailCard)return;
    detailsModal.hidden=true;
    const btn=selectedDetailCard.querySelector('.download-btn');
    startDownload(selectedDetailCard,btn);
  });
  $$('.quick-pick').forEach(btn=>btn.addEventListener('click',()=>{
    const card=$$('.product').find(x=>x.dataset.name===btn.dataset.target);
    if(card)openDetails(card);
  }));

  // Modal helpers
  function closeModal(id){const el=$('#'+id);if(el)el.hidden=true;}
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
  [detailsModal,$('#settingsModal')].forEach(m=>m?.addEventListener('click',e=>{if(e.target===m)m.hidden=true}));
  $('#settingsBtn').addEventListener('click',()=>$('#settingsModal').hidden=false);
  $('#motionToggle').addEventListener('change',e=>{store.motion=e.target.checked;localStorage.setItem('gx_motion',store.motion);applyMotion();});
  $('#fxToggle').addEventListener('change',e=>{store.fx=e.target.checked;localStorage.setItem('gx_fx',store.fx);});
  $('#saveToggle').addEventListener('change',e=>{if(!e.target.checked)showToast('المفضلة الحالية محفوظة، ويمكنك حذفها من الأزرار.');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$$('.modal-backdrop').forEach(m=>m.hidden=true);closeDownloads();}});

  // Download center
  const drawer=$('#downloadsDrawer'), backdrop=$('#drawerBackdrop'), list=$('#downloadList');
  function openDownloads(){drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');backdrop.hidden=false;renderDownloads();}
  function closeDownloads(){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');backdrop.hidden=true;}
  $('#downloadsBtn').addEventListener('click',openDownloads);$('#downloadsClose').addEventListener('click',closeDownloads);backdrop.addEventListener('click',closeDownloads);
  function renderDownloads(){
    if(!store.downloads.size){list.innerHTML='<div class="download-empty">لا توجد تنزيلات حاليًا.</div>';return;}
    list.innerHTML=''; store.downloads.forEach(d=>{
      const item=document.createElement('div');item.className='download-item';item.dataset.id=d.id;
      item.innerHTML='<div class="download-top"><span class="download-name"></span><span class="download-status"></span></div><div class="progress"><i></i></div><div class="download-controls"><button class="cancel-download" type="button">إلغاء</button><button class="cancel-download install-again" type="button" hidden>تثبيت</button></div>';
      $('.download-name',item).textContent=d.name;$('.download-status',item).textContent=d.statusText||'جاري التحضير';$('.progress i',item).style.width=(d.progress||0)+'%';
      const ia=$('.install-again',item);if(d.status==='done'&&d.blob){ia.hidden=false;$('.cancel-download',item).hidden=true;ia.onclick=()=>installApk(d);}$('.cancel-download',item).onclick=()=>{d.controller?.abort();d.status='cancelled';d.statusText='تم الإلغاء';d.progress=0;renderDownloads();updateCounts();};list.appendChild(item);
    });
  }
  function setButton(btn,state){
    btn.classList.remove('downloading','done');
    const svg=btn.querySelector('svg');
    if(state==='downloading'){btn.classList.add('downloading');btn.disabled=true;btn.querySelector('span').textContent='جاري التثبيت…';}
    else if(state==='done'){btn.classList.add('done');btn.disabled=false;btn.querySelector('span').textContent='تثبيت مرة أخرى';}
    else{btn.disabled=false;btn.querySelector('span').textContent='تثبيت';}
  }
  const APK_MIME='application/vnd.android.package-archive';
  async function installApk(d){
    // Native wrapper (Capacitor/WebView bridge) can install silently-ish via the system installer
    try{ if(window.GamerXNative?.installApk){ const buf=await d.blob.arrayBuffer(); await window.GamerXNative.installApk(d.file,buf); return; } }catch(e){}
    if(/^https?:/.test(d.src||'')&&/[?&]download=/.test(d.src)){const l=document.createElement('a');l.href=d.src;l.rel='noopener';document.body.appendChild(l);l.click();l.remove();return;}
    const u=URL.createObjectURL(d.blob);const a=document.createElement('a');a.href=u;a.download=d.file;a.type=APK_MIME;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
    d.url&&URL.revokeObjectURL(d.url);d.url=u;
  }
  async function startDownload(card,btn){
    const url=card.dataset.download; const name=card.dataset.name; if(!url){showToast('لم يتم تحديد ملف تحميل لهذه البطاقة.');return;}
    if(store.downloads.has(name) && store.downloads.get(name).status==='downloading')return;
    const controller=new AbortController(); const d={id:Date.now()+Math.random(),name,status:'downloading',progress:0,controller,statusText:'بدء الاتصال…'};store.downloads.set(name,d);setButton(btn,'downloading');updateCounts();renderDownloads();openDownloads();
    try{
      d.src=url;const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const total=Number(response.headers.get('content-length'))||0;let received=0;const reader=response.body?.getReader();let blob;
      if(reader){const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;d.progress=total?Math.round(received/total*100):Math.min(95,d.progress+5);d.statusText=total?`${d.progress}%`:'جاري التنزيل';renderDownloads();}blob=new Blob(chunks,{type:APK_MIME});}else{blob=new Blob([await response.blob()],{type:APK_MIME});d.progress=100;}
      d.blob=blob;d.file=(name.replace(/[^\w\u0600-\u06FF-]+/g,'-')||'gamer-x-store')+'.apk';d.statusText='جاري فتح المثبّت…';renderDownloads();await installApk(d);
      window.GamerXHooks?.onDownload?.(card);d.status='done';d.progress=100;d.statusText='تم التنزيل — أكمل التثبيت من نافذة الأندرويد';setButton(btn,'done');
      store.downloadHistory=[{name,time:new Date().toISOString(),url},...store.downloadHistory.filter(x=>x.name!==name)].slice(0,30);
      localStorage.setItem('gx_download_history',JSON.stringify(store.downloadHistory));
      showToast('تم تنزيل '+name+' — اضغط "تثبيت" في نافذة الأندرويد');renderDownloads();updateCounts();
    }catch(err){
      if(err.name==='AbortError'){showToast('تم إلغاء تنزيل '+name);setButton(btn,'idle');store.downloads.delete(name);renderDownloads();updateCounts();return;}
      d.status='error';d.statusText='تعذر العثور على الملف';setButton(btn,'idle');renderDownloads();updateCounts();showToast('ضع ملف APK في المسار: '+url);
    }
  }
  $$('.download-btn').forEach(btn=>btn.addEventListener('click',()=>startDownload(btn.closest('.product'),btn)));

  // Local account system + email verification/profile setup.
  // This keeps the current local prototype while enforcing the new signup flow.
  const AUTH_KEY='gx_accounts_v1', SESSION_KEY='gx_session_v1';
  let authMode='login', pendingVerificationEmail=null, pendingEmailCode=null;
  const authModal=$('#authModal'), authForm=$('#authForm'), authStatus=$('#authStatus'), authName=$('#authName'), authEmail=$('#authEmail'), authPassword=$('#authPassword');
  const emailVerifyModal=$('#emailVerifyModal'), emailVerifyCode=$('#emailVerifyCode'), emailVerifyStatus=$('#emailVerifyStatus'), emailDemoCode=$('#emailDemoCode');
  const profileSetupModal=$('#profileSetupModal'), profileSetupForm=$('#profileSetupForm'), profileSetupStatus=$('#profileSetupStatus');
  const accountBtn=$('#accountBtn'), accountMenu=$('#accountMenu'), accountLabel=$('#accountLabel'), accountAvatar=$('#accountAvatar'), menuAvatar=$('#menuAvatar'), menuName=$('#menuName'), menuEmail=$('#menuEmail');
  function readAccounts(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'{}')}catch{return {}}}
  function writeAccounts(a){localStorage.setItem(AUTH_KEY,JSON.stringify(a))}
  function normalizeEmail(v){return v.trim().toLowerCase()}
  function randomSalt(){const a=new Uint8Array(16); if(window.crypto?.getRandomValues) crypto.getRandomValues(a); else for(let i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256); return [...a].map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function hashPassword(password,salt){
    if(window.crypto?.subtle){const data=new TextEncoder().encode(salt+'::'+password);const buf=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('')}
    let h=2166136261; for(const ch of salt+'::'+password){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)} return (h>>>0).toString(16)
  }
  function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function getCurrentAccount(){const session=getSession(); if(!session?.email)return null; const a=readAccounts()[session.email]; return a||null}
  function initials(name){return (name||'GX').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase().slice(0,2)||'GX'}
  function updateAccountUI(){
    const a=getCurrentAccount();
    if(a){const ini=initials(a.displayName||a.name); accountLabel.textContent=a.displayName||a.name||a.email.split('@')[0]; accountAvatar.textContent=ini; menuAvatar.textContent=ini; menuName.textContent=a.displayName||a.name||a.email.split('@')[0]; menuEmail.textContent=a.email; $('#loginMenuBtn').hidden=true; $('#logoutBtn').hidden=false; $('#profileBtn').hidden=false}
    else{accountLabel.textContent='تسجيل الدخول'; accountAvatar.textContent='GX'; menuAvatar.textContent='GX'; menuName.textContent='زائر'; menuEmail.textContent='سجّل الدخول لحفظ بياناتك'; $('#loginMenuBtn').hidden=false; $('#logoutBtn').hidden=true; $('#profileBtn').hidden=true}
  }
  function openAuth(mode='login'){authMode=mode; authModal.hidden=false; accountMenu.hidden=true; authStatus.textContent=''; authStatus.classList.remove('success'); authForm.reset(); $$('.auth-tab').forEach(t=>t.classList.toggle('active',t.dataset.authMode===mode)); $('#authTitle').textContent=mode==='login'?'تسجيل الدخول':'إنشاء حساب'; $('#authSubmit').textContent=mode==='login'?'دخول':'إنشاء الحساب'; $('#nameField').hidden=mode==='login'; authPassword.autocomplete=mode==='login'?'current-password':'new-password'; setTimeout(()=>authEmail.focus(),50)}
  function closeAuth(){authModal.hidden=true}
  function randomVerificationCode(){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';const a=new Uint32Array(8);if(window.crypto?.getRandomValues)crypto.getRandomValues(a);else for(let i=0;i<8;i++)a[i]=Math.floor(Math.random()*0xffffffff);return [...a].map(n=>chars[n%62]).join('')}
  function sendEmailVerification(email, notice='تم إنشاء رمز تأكيد جديد.'){
    pendingVerificationEmail=email; pendingEmailCode=randomVerificationCode();
    const accounts=readAccounts(); if(accounts[email]){accounts[email].verificationCode=pendingEmailCode;accounts[email].verificationCreatedAt=new Date().toISOString();writeAccounts(accounts)}
    $('#emailDemoCode').hidden=false; $('#emailDemoCode').textContent='رمز الاختبار: '+pendingEmailCode;
    emailVerifyStatus.textContent=notice; emailVerifyStatus.classList.add('success'); emailVerifyModal.hidden=false; emailVerifyCode.value=''; setTimeout(()=>emailVerifyCode.focus(),50)
  }
  function closeEmailVerification(){emailVerifyModal.hidden=true;pendingVerificationEmail=null;pendingEmailCode=null}
  function openProfileSetup(account){
    profileSetupStatus.textContent='';profileSetupStatus.classList.remove('success');profileSetupForm.reset();
    $('#profileUsername').value=account.username||'';$('#profileDisplayName').value=account.displayName||account.name||'';
    profileSetupModal.hidden=false;setTimeout(()=>$('#profileUsername').focus(),50)
  }
  accountBtn.addEventListener('click',()=>{accountMenu.hidden=!accountMenu.hidden});
  document.addEventListener('click',e=>{if(!accountMenu.hidden&&!accountMenu.contains(e.target)&&!accountBtn.contains(e.target))accountMenu.hidden=true});
  $('#loginMenuBtn').addEventListener('click',()=>openAuth('login')); $('#authClose').addEventListener('click',closeAuth);
  authModal.addEventListener('click',e=>{if(e.target===authModal)closeAuth()});
  $$('.auth-tab').forEach(t=>t.addEventListener('click',()=>openAuth(t.dataset.authMode)));
  $('#profileBtn').addEventListener('click',()=>{const a=getCurrentAccount();if(!a)return openAuth('login');accountMenu.hidden=true;openProfileSetup(a)});
  $('#logoutBtn').addEventListener('click',()=>{localStorage.removeItem(SESSION_KEY);accountMenu.hidden=true;updateAccountUI();showToast('تم تسجيل الخروج');});
  $('#emailVerifyClose').addEventListener('click',()=>{emailVerifyModal.hidden=true});
  emailVerifyModal.addEventListener('click',e=>{if(e.target===emailVerifyModal)emailVerifyModal.hidden=true});
  $('#emailVerifyResend').addEventListener('click',()=>{if(pendingVerificationEmail)sendEmailVerification(pendingVerificationEmail,'تم إنشاء رمز جديد. الرمز السابق لم يعد صالحًا.')});
  $('#emailVerifySubmit').addEventListener('click',()=>{
    const email=pendingVerificationEmail, entered=emailVerifyCode.value.trim(), accounts=readAccounts(), a=email?accounts[email]:null;
    if(!a||!pendingEmailCode||entered!==pendingEmailCode){emailVerifyStatus.textContent='رمز التأكيد غير صحيح.';emailVerifyStatus.classList.remove('success');return}
    a.verified=true;delete a.verificationCode;delete a.verificationCreatedAt;accounts[email]=a;writeAccounts(accounts);pendingEmailCode=null;pendingVerificationEmail=null;emailVerifyModal.hidden=true;
    localStorage.setItem(SESSION_KEY,JSON.stringify({email}));updateAccountUI();openProfileSetup(a);showToast('تم تأكيد البريد الإلكتروني');
  });
  profileSetupForm.addEventListener('submit',e=>{
    e.preventDefault();const a=getCurrentAccount();if(!a)return;const username=$('#profileUsername').value.trim(),displayName=$('#profileDisplayName').value.trim();
    if(!username||!displayName){profileSetupStatus.textContent='أكمل بيانات الملف الشخصي.';return}
    const accounts=readAccounts();accounts[a.email]={...a,username,displayName,profileCompleted:true,updatedAt:new Date().toISOString()};writeAccounts(accounts);profileSetupModal.hidden=true;updateAccountUI();showToast('تم إعداد الملف الشخصي');
  });
  authForm.addEventListener('submit',async e=>{
    e.preventDefault();authStatus.textContent='';authStatus.classList.remove('success');
    const email=normalizeEmail(authEmail.value),password=authPassword.value,name=authName.value.trim();
    if(!/^\S+@\S+\.\S+$/.test(email)){authStatus.textContent='اكتب بريدًا إلكترونيًا صحيحًا.';return}
    if(password.length<6){authStatus.textContent='كلمة المرور يجب أن تكون 6 أحرف على الأقل.';return}
    const accounts=readAccounts();
    if(authMode==='register'){
      if(accounts[email]){authStatus.textContent='هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.';return}
      const salt=randomSalt(),hash=await hashPassword(password,salt);
      accounts[email]={name:name||email.split('@')[0],email,salt,passwordHash:hash,createdAt:new Date().toISOString(),verified:false,profileCompleted:false,role:'user',preferences:{}};writeAccounts(accounts);closeAuth();sendEmailVerification(email,'تم إنشاء الحساب. أكد بريدك الإلكتروني أولًا.');showToast('تم إرسال رمز تأكيد البريد');
    }else{
      const a=accounts[email];if(!a){authStatus.textContent='الحساب غير موجود. يمكنك إنشاء حساب جديد.';return}
      const hash=await hashPassword(password,a.salt);if(hash!==a.passwordHash){authStatus.textContent='البريد أو كلمة المرور غير صحيحة.';return}
      if(!a.verified){closeAuth();sendEmailVerification(email,'هذا الحساب غير مؤكد. أرسلنا رمز تأكيد جديدًا.');return}
      if(!a.profileCompleted){localStorage.setItem(SESSION_KEY,JSON.stringify({email}));closeAuth();openProfileSetup(a);return}
      localStorage.setItem(SESSION_KEY,JSON.stringify({email}));authStatus.textContent='تم تسجيل الدخول بنجاح.';authStatus.classList.add('success');updateAccountUI();setTimeout(closeAuth,500);showToast('مرحبًا بعودتك '+(a.displayName||a.name));
    }
  });
  function saveProfilePatch(patch){const a=getCurrentAccount();if(!a)return;const accounts=readAccounts();accounts[a.email]={...a,...patch,updatedAt:new Date().toISOString()};writeAccounts(accounts);updateAccountUI()}
  function bindCards(){
    $$('.product:not([data-bound])').forEach(card=>{
      card.dataset.bound='1'; const key=keyOf(card), bm=$('.bookmark-btn',card), info=$('.info-btn',card), dl=$('.download-btn',card);
      if(bm){ bm.setAttribute('aria-pressed',store.saved.includes(key)); bm.addEventListener('click',()=>{
        const now=bm.getAttribute('aria-pressed')!=='true'; bm.setAttribute('aria-pressed',now); haptic();
        if(now){ if(!store.saved.includes(key))store.saved.push(key); showToast('تم حفظ '+card.dataset.name+' في المفضلة'); } else { store.saved=store.saved.filter(x=>x!==key); showToast('تمت إزالة '+card.dataset.name+' من المفضلة'); }
        saveState(); window.GamerXHooks?.onFavorite?.(key,now); }); }
      info?.addEventListener('click',()=>openDetails(card)); dl?.addEventListener('click',()=>startDownload(card,dl));
    });
    filterProducts();
  }
  const paintSaved=()=>$$('.product').forEach(c=>{const b=$('.bookmark-btn',c);b&&b.setAttribute('aria-pressed',store.saved.includes(keyOf(c)))});
  window.GamerXStore={bindCards,keyOf,getSaved:()=>[...store.saved],
    setSaved:(list)=>{store.saved=[...new Set(list.filter(x=>typeof x==='string'&&x))];saveState();paintSaved()},
    removeSaved:(k)=>{store.saved=store.saved.filter(x=>x!==k);saveState();paintSaved();window.GamerXHooks?.onFavorite?.(k,false)}};
  window.GamerXAuth={getCurrentAccount,openAuth,logout:()=>{localStorage.removeItem(SESSION_KEY);updateAccountUI()},saveProfilePatch,openProfileSetup,refresh:updateAccountUI};
  updateAccountUI();

  updateCounts(); filterProducts();
})();
