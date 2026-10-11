// These two lightweight panels permit keyboard walking from nontext controls.
export const isTypingControl = target => !!target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
export const isMovementKey = code => /^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(code);
export function passMovementKey(event) {
  if (!isMovementKey(event.code) || isTypingControl(event.target) || event.ctrlKey || event.altKey || event.metaKey) return false;
  event.preventDefault();
  return true;
}
