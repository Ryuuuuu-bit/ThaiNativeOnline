// Public interface of the account system: login → character select → (new
// slot) character creation, run before the world starts.
//
//   await enterGame(root)   // resolves once a character slot is active
//
// It selects the save slot (src/core/SaveSlot.js), so Character, quests,
// discovered places and the last location all load and save per character.
// The session is kept across browser restarts (localStorage): reopening goes straight
// back into the same character. The settings panel gets "change character"
// and "log out" buttons. ?login forces the screens even with a session.
import { AccountStore } from './AccountStore.js';
import { ServerAccountStore, serverAccounts, startSaveSync } from './ServerAccounts.js';
import { renderGoogleButton } from './google.js';
import { showLogin, showCharacterSelect, showNameRecovery } from './screens.js';
import { SaveSlot } from '../core/SaveSlot.js';
import { Character } from '../character/Character.js';
import { showCreation } from '../character/ui/CreationScreen.js';
import '../character/ui/character.css';
import './account.css';

import { readSession, writeSession } from './session.js';
import { setAccountPicture } from './AccountPortrait.js';

async function refreshAccountProfile(session) {
  let timer;
  try {
    session.google = !session.guest && session.store?.me ? (await Promise.race([
      session.store.me(), new Promise(resolve => { timer = setTimeout(() => resolve(null), 3000); }),
    ]))?.google ?? null : null;
  } catch { session.google = null; }
  finally { clearTimeout(timer); }
  setAccountPicture(session.google?.picture);
}

export async function enterGame(root) {
  // With the game server (Railway) accounts and saves live there; without it (plain dev) in this browser.
  const remote = await serverAccounts();
  const store = remote ? new ServerAccountStore(undefined, { googleClientId: remote.googleClientId }) : new AccountStore();
  const forced = new URLSearchParams(location.search).has('login');
  let session = forced ? null : readSession();
  // a server account resumes with its token (and the server's copy of the slots); a stale one logs in again
  if (remote && session?.id && !session.guest && !(session.token && await store.resume(session.id, session.token).catch(() => false))) { session = null; writeSession(null); }

  // Same tab, same character: skip the screens.
  if (session?.prefix !== undefined && store.slots(session.id).some(s => s.prefix === session.prefix && s.character && !s.needsRename)) {
    SaveSlot.use(session.prefix);
  } else {
    let pick = null;
    while (!pick) {
      if (!session?.id) { session = await showLogin(root, store); session.token = store.token ?? undefined; writeSession(session); }
      pick = await showCharacterSelect(root, store, session, { onLogout: () => { store.logout?.(); writeSession(null); } });
      if (!pick) session = null; // logged out → back to the login
    }
    SaveSlot.use(pick.prefix);
    if (pick.fresh) {
      await showCreation(root, {onConfirm:choice=>store.createCharacter(session.id,pick.slot,Character.create(choice.name,choice.classId,choice.gender).toJSON())});
    } else if (store.slots(session.id).find(s=>s.slot === pick.slot)?.needsRename) {
      const slot = store.slots(session.id).find(s=>s.slot === pick.slot);
      await showNameRecovery(root,slot.character.name,name=>store.renameCharacter(session.id,pick.slot,name));
    }
    session = { id: session.id, guest: !!session.guest, prefix: pick.prefix, slot: pick.slot, token: store.token ?? undefined };
    writeSession(session);
  }
  // a signed-in character is kept on the server while playing (guests stay in this browser)
  if (remote && !session.guest && store.token && Number.isInteger(session.slot)) session.sync = startSaveSync(store, session.id, session.slot);
  session.store = store;
  await refreshAccountProfile(session);
  addSettingsButtons(session);
  return session;
}

function addSettingsButtons(session) {
  const settings = document.getElementById('settings');
  if (!settings) return;
  const row = document.createElement('div'); row.className = 'acc-settings';
  row.innerHTML = `<button type="button" data-acc="switch">เปลี่ยนตัวละคร</button><button type="button" data-acc="logout">${session.guest ? 'ออกจากโหมดผู้มาเยือน' : 'ออกจากระบบ'}</button>${!session.guest && session.store?.googleClientId ? '<button type="button" data-acc="google">ผูกบัญชี Google</button><div class="acc-google-link" hidden></div>' : ''}`;
  row.addEventListener('click', e => {
    const act = e.target.closest('[data-acc]')?.dataset.acc;
    if (!act) return;
    if (act === 'google') { linkGoogle(row, session); return; }
    session.sync?.push(true);
    if (act === 'logout') session.store?.logout?.();
    writeSession(act === 'switch' ? { id: session.id, guest: session.guest, token: session.token } : null);
    location.reload();
  });
  settings.appendChild(row);
  // already linked to Google (or signed in with it): say so instead of offering the link
  if (row.querySelector('[data-acc="google"]') && session.google) {
    const note = Object.assign(document.createElement('small'), { className: 'acc-linked', textContent: `✓ ผูกกับ Google แล้ว${session.google.email ? ` · ${session.google.email}` : ''}` });
    row.querySelector('[data-acc="google"]').replaceWith(note);
  }
}

// Settings → "ผูกบัญชี Google": Google's button, then the link on the server.
function linkGoogle(row, session) {
  const store = session.store;
  const box = row.querySelector('.acc-google-link'), btn = row.querySelector('[data-acc="google"]');
  box.hidden = false; btn.hidden = true;
  renderGoogleButton(box, store.googleClientId, async credential => {
    const r = await store.linkGoogle(credential);
    if (r.ok) await refreshAccountProfile(session);
    box.replaceChildren(Object.assign(document.createElement('small'), { textContent: r.ok ? 'ผูกบัญชี Google แล้ว · ครั้งหน้ากดเข้าสู่ระบบด้วย Google ได้เลย' : r.msg ?? 'ผูกไม่สำเร็จ' }));
  }, { text: 'continue_with' }).catch(() => { box.textContent = 'โหลดปุ่ม Google ไม่ได้'; });
}
