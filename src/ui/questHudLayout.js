// Physical viewport geometry; saved HUD zoom can leave no room below the map.
export function questHudPlacement({ touch, mini, width, height, fullHeight, hotbar }) {
  const right = touch ? 12 : Math.max(12, width - mini.right);
  const left = width - right - (touch ? 138 : 240);
  const overlapsBar = hotbar?.height > 0 && left < hotbar.right && width - right > hotbar.left;
  const top = mini.bottom + (touch ? 6 : 10);
  const limit = overlapsBar ? Math.min(height - 12, hotbar.top - 6) : height - 12;
  const compact = !touch && top + fullHeight > limit;
  const placedTop = compact ? mini.bottom + 6 : top;
  // Desktop chip is 32px plus border. In an extreme zoom/height combination
  // with no safe gap, the same objective remains available through the journal.
  return { top: placedTop, right, compact, hidden: compact && placedTop + 34 > limit };
}
