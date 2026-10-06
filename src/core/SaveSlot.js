// The active character's save slot. Every per-character save (character,
// quests, discovered places, last location) goes through `slotStorage`, which
// prefixes keys with the slot chosen on the character-select screen
// (src/account). With no slot chosen the prefix is empty, so keys are the same
// as before accounts existed and old saves keep loading.
let prefix = '';
const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export const SaveSlot = {
  get prefix() { return prefix; },
  use(next) { prefix = next ?? ''; },
};

// Storage-like (getItem/setItem/removeItem) and safe without localStorage (tests, blocked storage).
export const slotStorage = {
  getItem: key => { try { return store()?.getItem(prefix + key) ?? null; } catch { return null; } },
  setItem: (key, value) => { try { store()?.setItem(prefix + key, value); } catch { /* storage unavailable */ } },
  removeItem: key => { try { store()?.removeItem(prefix + key); } catch { /* storage unavailable */ } },
};
