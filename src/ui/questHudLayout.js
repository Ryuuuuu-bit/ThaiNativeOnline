// Physical viewport geometry; saved HUD zoom can leave no room below the map.
const validRect = r => r && [r.left, r.right, r.top, r.bottom].every(Number.isFinite) && r.right > r.left && r.bottom > r.top;
export const hudRectsOverlap = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
// Transient visible anchors only. Resize/mode changes must search current geometry.
export class QuestHudTouchAnchor {
  previous({ width, height, touch }) {
    const key = `${width}:${height}:${!!touch}`;
    if (this.key !== key || !touch) this.clear();
    this.key = key;
    return this.anchor;
  }
  remember(placement, visible) {
    this.anchor = visible && !placement.hidden && this.key?.endsWith(':true')
      ? { top: placement.top, right: placement.right } : null;
  }
  clear() { this.anchor = null; }
}
export function questHudPlacement({ touch, mini, width, height, fullHeight, hotbar, protectedRects = [], chipHeight = 50, previous = null }) {
  const right = touch ? 12 : Math.max(12, width - mini.right);
  const left = width - right - (touch ? 138 : 240);
  const overlapsBar = hotbar?.height > 0 && left < hotbar.right && width - right > hotbar.left;
  const top = mini.bottom + (touch ? 6 : 10);
  if (touch) {
    const obstacles = protectedRects.filter(validRect);
    const safe = box => validRect(box) && box.left >= 12 && box.right <= width - 12 && box.top >= 12 && box.bottom <= height - 12
      && !obstacles.some(r => hudRectsOverlap(box, r, 4));
    if (previous && [previous.top, previous.right].every(Number.isFinite)) {
      const box = { left: width - previous.right - 138, right: width - previous.right, top: previous.top, bottom: previous.top + chipHeight };
      if (safe(box)) return { top: previous.top, right: previous.right, compact: false, hidden: false };
    }
    const tops = [...new Set([top, ...obstacles.flatMap(r => [r.bottom + 6, r.top - chipHeight - 6])])]
      .filter(y => y >= 12 && y + chipHeight <= height - 12).sort((a, b) => Math.abs(a - top) - Math.abs(b - top));
    // Both edge columns avoid putting an opaque strip across the playfield.
    // If the painted name/zone and controls fill both, use the journal instead.
    for (const edge of [right, width - 12 - 138]) for (const y of tops) {
      const box = { left: width - edge - 138, right: width - edge, top: y, bottom: y + chipHeight };
      if (safe(box)) return { top: y, right: edge, compact: false, hidden: false };
    }
    return { top, right, compact: false, hidden: true };
  }
  const limit = overlapsBar ? Math.min(height - 12, hotbar.top - 6) : height - 12;
  const compact = !touch && top + fullHeight > limit;
  const placedTop = compact ? mini.bottom + 6 : top;
  // Desktop chip is 32px plus border. In an extreme zoom/height combination
  // with no safe gap, the same objective remains available through the journal.
  return { top: placedTop, right, compact, hidden: compact && placedTop + 34 > limit };
}
