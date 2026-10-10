export const INVENTORY_SIZE = 500;

// Keep recovery/legacy cells beyond the standard bag size; migration never drops loot.
export function expandInventory(inventory) {
  const slots = Array.isArray(inventory) ? inventory : [];
  return Array.from({ length: Math.max(INVENTORY_SIZE, slots.length) }, (_, i) => slots[i] ?? null);
}
