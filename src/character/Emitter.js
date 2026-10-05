// Minimal event emitter shared by the character and combat systems.
export class Emitter {
  constructor() { this.handlers = {}; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return () => this.off(type, fn); }
  off(type, fn) { this.handlers[type] = (this.handlers[type] || []).filter(h => h !== fn); }
  emit(type, payload) { for (const fn of this.handlers[type] || []) fn(payload); }
}
