import { ITEMS } from './data/items.js';
export const HOTBAR_SIZE = 10;
export const availableSkillIds = c => c.kitSkills.length ? c.kitSkills.filter(id => c.skillLevel(id) > 0) : [...c.cls.skills];
export function validBinding(c, binding) {
  if (binding === null) return true;
  if (!binding || typeof binding !== 'object' || typeof binding.id !== 'string') return false;
  return binding.kind === 'skill' ? availableSkillIds(c).includes(binding.id)
    : binding.kind === 'item' && ITEMS[binding.id]?.type === 'use' && !ITEMS[binding.id].retired;
}
// Legacy saves stored only a preferred order; the displayed bar also included every learned skill.
// Typed bars store the actual ten bindings, including intentionally cleared positions.
export function cleanBindings(c, input, { legacy = true } = {}) {
  const learned = availableSkillIds(c);
  const oldOrder = legacy && Array.isArray(input) && input.every(id => typeof id === 'string');
  const source = oldOrder ? [...new Set([...input.filter(id => learned.includes(id)), ...learned])]
    : Array.isArray(input) ? input : learned;
  return Array.from({ length: HOTBAR_SIZE }, (_, i) => {
    const candidate = typeof source[i] === 'string' ? {kind:'skill',id:source[i]} : source[i] ?? null;
    return validBinding(c,candidate) && candidate ? {kind:candidate.kind,id:candidate.id} : null;
  });
}
