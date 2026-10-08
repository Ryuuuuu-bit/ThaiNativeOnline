// Visible touch slots retain their original indices for casting and cooldowns.
export function skillPages(slots, level, size = 5) {
  const learned = slots.map((_, i) => i).filter(i => level?.(i) !== 0);
  return Array.from({ length: Math.max(1, Math.ceil(learned.length / size)) }, (_, page) => learned.slice(page * size, (page + 1) * size));
}
