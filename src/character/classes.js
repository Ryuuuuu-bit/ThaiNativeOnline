// Class lookup and validation. Pure logic: no Three.js (runs under node --test).
import { CLASSES, DEFAULT_CLASS_ID } from './data/classes.js';

export { CLASSES, DEFAULT_CLASS_ID };

export const STAT_KEYS = ['maxHp', 'maxMp', 'attack', 'defense', 'moveSpeed'];
export const PALETTE_KEYS = ['skin', 'shirt', 'pants', 'sash', 'hair', 'footwear', 'weapon', 'weaponGrip', 'accent', 'magic', 'ring'];
export const WEAPON_TYPES = ['sword', 'staff', 'bow'];
export const HAIR_STYLES = ['topknot', 'headcloth'];

const HEX = /^#[0-9a-f]{6}$/i;

/** Returns a list of human-readable problems with a class definition ([] when valid). */
export function validateClass(def) {
  const errors = [];
  if (!def || typeof def !== 'object') return ['class definition must be an object'];
  const where = def.id ? `class '${def.id}'` : 'class';
  if (typeof def.id !== 'string' || !def.id) errors.push(`${where}: missing id`);
  if (typeof def.name !== 'string' || !def.name) errors.push(`${where}: missing Thai display name`);
  if (!def.stats || typeof def.stats !== 'object') errors.push(`${where}: missing stats`);
  else for (const key of STAT_KEYS) {
    const v = def.stats[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) errors.push(`${where}: stats.${key} must be a finite number >= 0`);
  }
  if (def.stats && !(def.stats.maxHp > 0)) errors.push(`${where}: stats.maxHp must be > 0`);
  if (def.stats && !(def.stats.moveSpeed > 0)) errors.push(`${where}: stats.moveSpeed must be > 0`);
  if (!WEAPON_TYPES.includes(def.weapon)) errors.push(`${where}: unknown weapon '${def.weapon}'`);
  const look = def.appearance;
  if (!look || typeof look !== 'object') errors.push(`${where}: missing appearance`);
  else {
    if (!HAIR_STYLES.includes(look.hairStyle)) errors.push(`${where}: unknown hairStyle '${look.hairStyle}'`);
    const palette = look.palette || {};
    for (const key of PALETTE_KEYS) if (!HEX.test(palette[key] ?? '')) errors.push(`${where}: palette.${key} must be a #rrggbb colour`);
    if (look.hairStyle === 'headcloth' && !HEX.test(palette.headcloth ?? '')) errors.push(`${where}: palette.headcloth required for hairStyle 'headcloth'`);
  }
  return errors;
}

/** Validates every class in a table (default: the shipped CLASSES). */
export function validateAllClasses(table = CLASSES) {
  const errors = [];
  for (const [key, def] of Object.entries(table)) {
    errors.push(...validateClass(def));
    if (def && def.id !== key) errors.push(`class key '${key}' does not match id '${def?.id}'`);
  }
  if (!table[DEFAULT_CLASS_ID]) errors.push(`default class '${DEFAULT_CLASS_ID}' missing`);
  return errors;
}

export function listClassIds() { return Object.keys(CLASSES); }

export function hasClass(classId) { return Object.prototype.hasOwnProperty.call(CLASSES, classId); }

/** Class definition by id; throws on unknown ids so typos surface immediately. */
export function getClass(classId = DEFAULT_CLASS_ID) {
  if (!hasClass(classId)) throw new Error(`Unknown character class '${classId}'. Known: ${listClassIds().join(', ')}`);
  return CLASSES[classId];
}

/** A fresh, mutable copy of a class's base stats. */
export function getClassStats(classId = DEFAULT_CLASS_ID) {
  const { stats } = getClass(classId);
  const copy = {};
  for (const key of STAT_KEYS) copy[key] = stats[key];
  return copy;
}
