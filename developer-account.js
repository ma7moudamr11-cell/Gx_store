/* Gamer X Store — Beta developer upgrade by email verification.
   Client UI only: code generation, mail delivery and role changes are performed by
   the Supabase Edge Function `developer-code` using server-side credentials. */
(() => {
  'use strict';
  if (window.GX_FEATURES && window.GX_FEATURES.developerAccount === false) return; // developer buttons are inert until enabled in gx-features.js
  const cfg = window.GX_SUPABASE_CONFIG;
  if (!cfg || !window.supabase || !cfg.url || !cfg.publishableKey || /YOUR_/.test(cfg.url)) return;
  const sb = window.GamerXSupabase || (window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey));
  const $ = (s) => document.querySelector(s);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.hidden = true;
  modal.innerHTML = `<section class="panel auth-panel" role="dialog" aria-modal="true" aria-labelledby="dcTitle">
    <button class="modal-close" id="dcClose" type="button" aria-label="إغلاق">×</button>
    <span class="section-kicker">DEVELOPER ACCOUNT · BETA</span>
    <h2 id="dcTitle">طلب حساب مطور</h2>
    <p class="auth-note">في نسخة البيتا، يمكنك تحويل حسابك بعد تأكيد ملكية البريد الإلكتروني المسجّل. سنرسل رمزًا مؤقتًا من 8 خانات.</p>
    <div id="dcStep1"><button class="modal-action" id="dcSend" type="button">إرسال رمز التأكيد</button></div>
    <div id="dcStep2" hidden>
      <p class="auth-note" id="dcCodeHint">أدخل الرمز الذي وصلك إلى بريدك الإلكتروني. صلاحية الرمز 10 دقائق.</p>
      <label class="auth-field"><span>رمز التأكيد</span><input id="dcCode" type="text" inputmode="text" maxlength="8" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="XXXXXXXX" aria-describedby="dcCodeHint"></label>
      <button class="modal-action" id="dcVerify" type="button">تأكيد وتحويل الحساب</button>
      <button class="auth-secondary" id="dcResend" type="button">إرسال رمز جديد</button>
    </div>
    <div class="auth-status" id="dcStatus" role="status" aria-live="polite"></div>
    <small class="auth-security">تأكيد البريد وحده لا يكشف بياناتك أو كلمة مرورك. تغيير الصلاحية يتم في الخادم بعد التحقق من الرمز.</small>
  </section>`;
  document.body.appendChild(modal);

  const status = (message, ok = false) => {
    const el = $('#dcStatus');
    el.textContent = message || '';
    el.classList.toggle('success', !!ok);
  };
  const busy = (button, on) => {
    button.disabled = on;
    button.setAttribute('aria-busy', String(on));
  };
  const resetModal = () => {
    $('#dcStep1').hidden = false;
    $('#dcStep2').hidden = true;
    $('#dcCode').value = '';
    status('');
  };
  async function invoke(action, code) {
    const { data, error } = await sb.functions.invoke('developer-code', { body: { action, ...(code ? { code } : {}) } });
    if (error) {
      let message = 'تعذر إكمال العملية. تحقق من اتصالك وحاول مرة أخرى.';
      try {
        const body = error.context?.json ? await error.context.json() : null;
        if (body?.error) message = body.error;
      } catch {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function currentRole() {
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionError || !sessionData.session) return null;
    const uid = sessionData.session.user.id;
    const { data, error } = await sb.from('profiles').select('role').eq('id', uid).maybeSingle();
    if (!error && data?.role) return data.role;
    // Keep the request accessible if profile provisioning is delayed; the Edge Function
    // still checks the authenticated user and current role before sending a code.
    try {
      const ensured = await sb.rpc('gx_ensure_profile');
      if (!ensured.error && ensured.data) return typeof ensured.data === 'string' ? ensured.data : (ensured.data.role || 'user');
    } catch {}
    return 'user';
  }
  async function refreshButtons() {
    const [{ data: sessionData }, role] = await Promise.all([sb.auth.getSession(), currentRole()]);
    const signedIn = !!sessionData?.session;
    const req = $('#developerRequestBtn');
    const settingsReq = $('#settingsDeveloperRequestBtn');
    const dev = $('#developerBtn');
    const own = $('#ownerBtn');
    const isDev = role === 'developer' || role === 'owner';
    if (req) req.hidden = !signedIn || isDev;
    if (settingsReq) settingsReq.hidden = !signedIn || isDev;
    if (dev) dev.hidden = !isDev;
    if (own) own.hidden = role !== 'owner';
    document.dispatchEvent(new CustomEvent('gx:role-changed', { detail: role }));
  }
  async function openUpgrade() {
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      status('سجّل الدخول أولًا ثم أعد طلب حساب المطور.');
      modal.hidden = false;
      $('#dcStep1').hidden = true;
      $('#dcStep2').hidden = true;
      return;
    }
    resetModal();
    modal.hidden = false;
    $('#dcSend').focus();
  }
  async function requestCode() {
    const { data: s } = await sb.auth.getSession();
    const email = s.session?.user?.email; if (!email) throw new Error('سجّل الدخول أولًا.');
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (!error) return;
    const m = String(error.message || '');
    if (error.status === 429 || /second|rate/i.test(m)) throw new Error('انتظر دقيقة قبل طلب رمز جديد.');
    throw new Error('تعذر إرسال الرمز: ' + m.slice(0, 120));
  }
  window.GamerXDeveloper = { openUpgrade, refreshButtons };

  async function send(button) {
    busy(button, true);
    status('جاري إرسال رمز التأكيد إلى بريد حسابك…');
    try {
      await requestCode();
      $('#dcStep1').hidden = true;
      $('#dcStep2').hidden = false;
      status('تم إرسال رمز من 8 أرقام إلى بريدك. افحص الوارد ومجلد الرسائل غير المرغوب فيها.', true);
      $('#dcCode').focus();
    } catch (error) {
      status(error.message || 'تعذر إرسال الرمز.');
    } finally {
      busy(button, false);
    }
  }
  $('#dcSend').addEventListener('click', (event) => send(event.currentTarget));
  $('#dcResend').addEventListener('click', (event) => send(event.currentTarget));
  $('#dcCode').addEventListener('input', (event) => {
    event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  });
  $('#dcCode').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); $('#dcVerify').click(); }
  });
  $('#dcVerify').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const code = $('#dcCode').value.trim();
    if (!/^[A-Z0-9]{8}$/.test(code)) return status('أدخل رمزًا صحيحًا من 8 خانات.');
    busy(button, true);
    status('جاري التحقق من الرمز…');
    try {
      await invoke('verify', code);
      // Refresh the local compatibility cache used by the existing settings/profile UI.
      const { data: userData } = await sb.auth.getUser();
      if (userData?.user && window.GamerXOnline?.mirror) await window.GamerXOnline.mirror(userData.user);
      await refreshButtons();
      status('تم تأكيد الرمز وتحويل حسابك إلى حساب مطور بنجاح.', true);
      setTimeout(() => { modal.hidden = true; }, 1400);
    } catch (error) {
      status(error.message || 'تعذر التحقق من الرمز.');
    } finally {
      busy(button, false);
    }
  });
  $('#dcClose').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; });
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#developerRequestBtn, #settingsDeveloperRequestBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openUpgrade();
    }
  }, true);
  document.addEventListener('DOMContentLoaded', refreshButtons);
  sb.auth.onAuthStateChange(() => { refreshButtons(); });
  if (document.readyState !== 'loading') refreshButtons();
})();
