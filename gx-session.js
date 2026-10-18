/* Gamer X — one shared Supabase client with a durable, auto-restoring login session. */
(() => {
  const cfg = window.GX_SUPABASE_CONFIG;
  if (!cfg || !window.supabase || /YOUR_/.test(cfg.url)) return;
  const KEY = 'gx-auth-v1', BK = 'gx_session_backup';
  const store = {
    getItem(k) { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k) } catch { try { return sessionStorage.getItem(k) } catch { return null } } },
    setItem(k, v) { try { localStorage.setItem(k, v) } catch {} try { sessionStorage.setItem(k, v) } catch {} },
    removeItem(k) { try { localStorage.removeItem(k) } catch {} try { sessionStorage.removeItem(k) } catch {} }
  };
  const sb = window.GamerXSupabase = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: KEY, storage: store }
  });
  try { navigator.storage?.persist?.() } catch {}
  let signedOutByUser = false;
  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_OUT') { if (signedOutByUser) { try { localStorage.removeItem(BK) } catch {} } return; }
    if (session?.refresh_token) { try { localStorage.setItem(BK, JSON.stringify({ r: session.refresh_token, t: Date.now() })) } catch {} }
  });
  const origOut = sb.auth.signOut.bind(sb.auth);
  sb.auth.signOut = async (...a) => { signedOutByUser = true; try { localStorage.removeItem(BK) } catch {} return origOut(...a); };
  // Restore from the backup token if the main session entry was lost (e.g. cleared by the browser/webview)
  window.GamerXSessionReady = (async () => {
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session) return data.session;
      const bk = JSON.parse(localStorage.getItem(BK) || 'null');
      if (bk?.r) { const r = await sb.auth.refreshSession({ refresh_token: bk.r }); return r.data?.session || null; }
    } catch {}
    return null;
  })();
})();
