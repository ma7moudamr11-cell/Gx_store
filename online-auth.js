/* Gamer X — real multi-user accounts via Supabase Auth.
   Active only when supabase-config.js has real keys; otherwise the local demo keeps working.
   Runs after app.js and takes over the auth form, email-code confirmation, profile setup and logout. */
(() => {
  const cfg = window.GX_SUPABASE_CONFIG;
  if (!cfg || !window.supabase || /YOUR_/.test(cfg.url) || !window.GamerXAuth?.refresh) return;
  const sb = window.GamerXSupabase || (window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey));
  const $ = (s) => document.querySelector(s);
  const ACC = 'gx_accounts_v1', SES = 'gx_session_v1';
  const toast = (m) => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); };
  const setStatus = (el, msg, ok) => { el.textContent = msg; el.classList.toggle('success', !!ok); };
  const cleanEmail = (v) => v.trim().toLowerCase();
  let pendingEmail = null;
  const T = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('انتهت مهلة الاتصال')), 25000))]);

  // Local copy of the account (no password) so the existing UI/settings keep working.
  async function mirror(user) {
    let { data: p, error: pe } = await sb.from('profiles').select('username,display_name,role,avatar_url').eq('id', user.id).maybeSingle();
    if (pe) ({ data: p } = await sb.from('profiles').select('username,display_name,role').eq('id', user.id).maybeSingle());
    const name = p?.display_name || user.user_metadata?.display_name || user.email.split('@')[0];
    const acc = { name, email: user.email, displayName: p?.display_name || '', username: p?.username || '', verified: true,
      profileCompleted: !!p?.username, role: p?.role || 'user', avatar: p?.avatar_url || '', preferences: JSON.parse(localStorage.getItem(ACC) || '{}')[user.email]?.preferences || {} };
    localStorage.setItem(ACC, JSON.stringify({ [user.email]: acc }));
    localStorage.setItem(SES, JSON.stringify({ email: user.email }));
    GamerXAuth.refresh();
    return acc;
  }
  window.GamerXOnline = { mirror };
  function clearLocal() { localStorage.removeItem(SES); localStorage.removeItem(ACC); GamerXAuth.refresh(); }
  const intercept = (type, test, fn) => document.addEventListener(type, (e) => {
    if (!test(e.target)) return; e.preventDefault(); e.stopImmediatePropagation(); fn(e);
  }, true);

  function askCode(email, notice) {
    pendingEmail = email;
    setStatus($('#authStatus'), '');
    $('#emailDemoCode').hidden = true;
    $('#authModal').hidden = true;
    const m = $('#emailVerifyModal'); m.hidden = false; $('#emailVerifyCode').value = '';
    setStatus($('#emailVerifyStatus'), notice, true);
    setTimeout(() => $('#emailVerifyCode').focus(), 50);
  }

  intercept('submit', (t) => t.id === 'authForm', async () => {
    const st = $('#authStatus'); setStatus(st, '');
    const email = cleanEmail($('#authEmail').value), password = $('#authPassword').value, name = $('#authName').value.trim();
    const register = $('.auth-tab.active')?.dataset.authMode === 'register';
    if (!/^\S+@\S+\.\S+$/.test(email)) return setStatus(st, 'اكتب بريدًا إلكترونيًا صحيحًا.');
    if (password.length < 8) return setStatus(st, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
    const btn = $('#authSubmit'); btn.disabled = true;
    setStatus(st, register ? 'جاري إنشاء الحساب… قد يستغرق بضع ثوانٍ.' : 'جاري تسجيل الدخول…', true);
    try {
      if (register) {
        const { data, error } = await T(sb.auth.signUp({ email, password, options: { data: { display_name: name } } }));
        if (error) return setStatus(st, error.message);
        if (data.user && data.user.identities?.length === 0) return setStatus(st, 'هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.');
        if (data.session) { await afterLogin(data.user); return; }
        askCode(email, 'أرسلنا رمز التأكيد إلى بريدك. أدخله لإكمال إنشاء الحساب.');
      } else {
        const { data, error } = await T(sb.auth.signInWithPassword({ email, password }));
        if (error) {
          if (/not confirmed/i.test(error.message)) { await sb.auth.resend({ type: 'signup', email }); return askCode(email, 'الحساب غير مؤكد. أرسلنا رمزًا جديدًا.'); }
          return setStatus(st, 'البريد أو كلمة المرور غير صحيحة.');
        }
        await afterLogin(data.user); setStatus(st, 'تم تسجيل الدخول بنجاح.', true); setTimeout(() => ($('#authModal').hidden = true), 500);
      }
    } catch (err) { setStatus(st, 'تعذر الاتصال بالخادم: ' + String(err?.message || err).slice(0, 90)); } finally { btn.disabled = false; }
  });

  async function afterLogin(user) {
    const acc = await mirror(user); $('#authModal').hidden = true;
    if (!acc.profileCompleted) GamerXAuth.openProfileSetup(acc); else toast('مرحبًا ' + (acc.displayName || acc.name));
  }

  intercept('click', (t) => t.closest?.('#emailVerifySubmit'), async () => {
    const st = $('#emailVerifyStatus'), token = $('#emailVerifyCode').value.trim();
    if (!pendingEmail || !token) return setStatus(st, 'أدخل رمز التأكيد.');
    setStatus(st, 'جاري التحقق…', true);
    try {
      const { data, error } = await T(sb.auth.verifyOtp({ email: pendingEmail, token, type: 'signup' }));
      if (error || !data.user) return setStatus(st, 'رمز التأكيد غير صحيح أو منتهي.');
      pendingEmail = null; $('#emailVerifyModal').hidden = true; await afterLogin(data.user);
    } catch (err) { setStatus(st, 'تعذر الاتصال بالخادم: ' + String(err?.message || err).slice(0, 90)); }
  });
  intercept('click', (t) => t.closest?.('#emailVerifyResend'), async () => {
    if (!pendingEmail) return;
    const { error } = await sb.auth.resend({ type: 'signup', email: pendingEmail });
    setStatus($('#emailVerifyStatus'), error ? 'انتظر قليلًا قبل طلب رمز جديد.' : 'تم إرسال رمز جديد.', !error);
  });

  intercept('submit', (t) => t.id === 'profileSetupForm', async () => {
    const st = $('#profileSetupStatus');
    const username = $('#profileUsername').value.trim().toLowerCase(), display = $('#profileDisplayName').value.trim();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return setStatus(st, 'اسم المستخدم: 3-24 حرفًا إنجليزيًا صغيرًا أو أرقام أو _ .');
    if (!display) return setStatus(st, 'أكمل بيانات الملف الشخصي.');
    const { data: s } = await sb.auth.getSession(); if (!s.session) return setStatus(st, 'سجّل الدخول أولًا.');
    const { error } = await sb.from('profiles').update({ username, display_name: display, updated_at: new Date().toISOString() }).eq('id', s.session.user.id);
    if (error) return setStatus(st, error.code === '23505' ? 'اسم المستخدم مستخدم بالفعل.' : 'تعذر حفظ الملف الشخصي.');
    await mirror(s.session.user); $('#profileSetupModal').hidden = true; toast('تم إعداد الملف الشخصي');
  });

  intercept('click', (t) => t.closest?.('#logoutBtn, #settingsLogoutBtn'), async () => {
    await sb.auth.signOut(); clearLocal(); $('#accountMenu').hidden = true; toast('تم تسجيل الخروج');
  });

  // Boot: Supabase is the only source of truth; drop any leftover demo session.
  sb.auth.getSession().then(({ data }) => data.session ? mirror(data.session.user) : clearLocal());
})();
