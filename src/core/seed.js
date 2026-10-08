// A small number from any id, for staggering animations: offline monsters have numeric ids,
// online ones strings like "s42" (src/net/NetCombat.js) — adding a string to a time gives NaN,
// which left every online monster's sprite or model frozen and invisible.
export const seedOf = id => typeof id === 'number' ? id : [...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1000;
