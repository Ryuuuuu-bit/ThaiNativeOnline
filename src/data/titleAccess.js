import { TITLES, TITLE_BY_ID } from './titles.js';

// Session-only capability: never read a save, constructor option or public flag.
// Callers granting this must already have authenticated the live server session.
const gmCharacters = new WeakSet();
export const hasGmTitleAccess = c => gmCharacters.has(c);
export const availableTitles = c => hasGmTitleAccess(c) ? TITLES.map(t => t.id) : [...c.titles];
export const canWearTitle = (c, id) => id === null || typeof id === 'string' && Object.hasOwn(TITLE_BY_ID, id) && (hasGmTitleAccess(c) || c.titles.includes(id));
export function setGmTitleAccess(c, allowed) {
  const before = hasGmTitleAccess(c), worn = c.title;
  if (allowed === true) gmCharacters.add(c); else gmCharacters.delete(c);
  if (!canWearTitle(c, c.title)) c.title = null;
  if (before !== hasGmTitleAccess(c) || worn !== c.title) c.emit?.('titles', []);
}
