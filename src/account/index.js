// Public interface of the account system: login → character select → (new
// slot) character creation, run before the world starts.
//
//   await enterGame(root)   // resolves once a character slot is active
//
// It selects the save slot (src/core/SaveSlot.js), so Character, quests,
// discovered places and the last location all load and save per character.
// The session is kept for this tab (sessionStorage): a reload goes straight
// back into the same character. The settings panel gets "change character"
// and "log out" buttons. ?login forces the screens even with a session.
import { AccountStore } from './AccountStore.js';
import { showLogin, showCharacterSelect } from './screens.js';
import { SaveSlot } from '../core/SaveSlot.js';
import { Character } from '../character/Character.js';
import { showCreation } from '../character/ui/CreationScreen.js';
import '../character/ui/character.css';
import './account.css';

const SESSION_KEY = 'tno.session.v1';
const readSession = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'); } catch { return null; } };
const writeSession = s => { try { if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ } };

export async function enterGame(root) {
  const store = new AccountStore();
  const forced = new URLSearchParams(location.search).has('login');
  let session = forced ? null : readSession();

  // Same tab, same character: skip the screens.
  if (session?.prefix !== undefined && store.slots(session.id).some(s => s.prefix === session.prefix && s.character)) {
    SaveSlot.use(session.prefix);
  } else {
    let pick = null;
    while (!pick) {
      if (!session?.id) session = await showLogin(root, store);
      pick = await showCharacterSelect(root, store, session);
      if (!pick) session = null; // logged out → back to the login
    }
    SaveSlot.use(pick.prefix);
    if (pick.fresh) {
      const { name, classId, gender } = await showCreation(root);
      Character.create(name, classId, gender).save();
    }
    session = { id: session.id, guest: !!session.guest, prefix: pick.prefix };
    writeSession(session);
  }
  addSettingsButtons(session);
  return session;
}

function addSettingsButtons(session) {
  const settings = document.getElementById('settings');
  if (!settings) return;
  const row = document.createElement('div'); row.className = 'acc-settings';
  row.innerHTML = `<button type="button" data-acc="switch">เปลี่ยนตัวละคร</button><button type="button" data-acc="logout">${session.guest ? 'ออกจากโหมดผู้มาเยือน' : 'ออกจากระบบ'}</button>`;
  row.addEventListener('click', e => {
    const act = e.target.closest('[data-acc]')?.dataset.acc;
    if (!act) return;
    writeSession(act === 'switch' ? { id: session.id, guest: session.guest } : null);
    location.reload();
  });
  settings.appendChild(row);
}
