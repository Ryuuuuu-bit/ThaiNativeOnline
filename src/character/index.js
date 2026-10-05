// Public interface of the character system.
import { Character } from './Character.js';
import { showCreation } from './ui/CreationScreen.js';

export { Character } from './Character.js';
export { CharacterUI } from './ui/CharacterUI.js';
export { Feed } from './ui/Feed.js';

// Resolves with the saved character, or shows the creation screen first.
export async function loadOrCreateCharacter(root) {
  const saved = Character.load();
  if (saved) return saved;
  const { name, classId, gender } = await showCreation(root);
  const character = Character.create(name, classId, gender);
  character.save();
  return character;
}
