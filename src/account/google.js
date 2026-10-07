// "Sign in with Google" (Google Identity Services). The button and Google's popup come
// from Google's own script; what we get back is an ID token (the `credential`) that the
// server checks (server/accounts.js) before it opens a session. No Google keys live here:
// the Client ID is public and comes from the server (/api/health ← GOOGLE_CLIENT_ID).
//   await renderGoogleButton(el, clientId, credential => …, { text })
const SRC = 'https://accounts.google.com/gsi/client';
let loading = null;
const load = () => (loading ??= new Promise((ok, bad) => {
  if (globalThis.google?.accounts?.id) return ok();
  const s = document.createElement('script'); s.src = SRC; s.async = true; s.defer = true;
  s.onload = () => ok(); s.onerror = () => { loading = null; bad(new Error('Google sign-in did not load')); };
  document.head.append(s);
}));

export async function renderGoogleButton(el, clientId, onCredential, { text = 'signin_with' } = {}) {
  await load();
  google.accounts.id.initialize({ client_id: clientId, callback: r => r?.credential && onCredential(r.credential), ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true });
  el.replaceChildren();
  google.accounts.id.renderButton(el, { type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text, locale: 'th', width: Math.min(320, el.clientWidth || 300) });
}
