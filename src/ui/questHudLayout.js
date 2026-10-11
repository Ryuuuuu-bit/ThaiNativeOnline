// Physical viewport geometry; saved HUD zoom can leave no room below the map.
const validRect = r => r && [r.left, r.right, r.top, r.bottom].every(Number.isFinite) && r.right > r.left && r.bottom > r.top;
export const hudRectsOverlap = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
export function questHudPlacement({ touch, mini, width, height, fullHeight, hotbar, protectedRects = [], chipHeight = 50 }) {
  const right = touch ? 12 : Math.max(12, width - mini.right);
  const left = width - right - (touch ? 138 : 240);
  const overlapsBar = hotbar?.height > 0 && left < hotbar.right && width - right > hotbar.left;
  const top = mini.bottom + (touch ? 6 : 10);
  if (touch) {
    const obstacles = protectedRects.filter(validRect);
    const tops = [...new Set([top, ...obstacles.flatMap(r => [r.bottom + 6, r.top - chipHeight - 6])])]
      .filter(y => y >= 12 && y + chipHeight <= height - 12).sort((a, b) => Math.abs(a - top) - Math.abs(b - top));
    // Both edge columns avoid putting an opaque strip across the playfield.
    // If the painted name/zone and controls fill both, use the journal instead.
    for (const edge of [right, width - 12 - 138]) for (const y of tops) {
      const box = { left: width - edge - 138, right: width - edge, top: y, bottom: y + chipHeight };
      if (!obstacles.some(r => hudRectsOverlap(box, r, 4))) return { top: y, right: edge, compact: false, hidden: false };
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
