// Shared physical reservations and exterior contacts; Main adds these boxes to
// city navigation/collision. The southern pair faces the normal camera; the
// smaller dice booth fronts the temple court, leaving temple_sala untouched.
export { isFairOpen, isFairOpen as fairIsOpen } from './fairRules.js';
export const FAIR_RANGE = 4;
export const FAIR_SITES = Object.freeze([
  {id:'balloons',label:'ปาเป้าลูกโป่ง',x:-54.7,z:-23.5,w:4.8,d:3.4,approach:{x:-54.7,z:-19.8}},
  {id:'dolls',label:'ยิงเป้าตุ๊กตา',x:-48.6,z:-23.5,w:4.8,d:3.4,approach:{x:-48.6,z:-19.8}},
  {id:'dice',label:'น้ำเต้า ปู ปลา',x:-56.6,z:-28.25,w:4,d:3.4,approach:{x:-56.6,z:-31.95}},
].map(site=>Object.freeze({...site,approach:Object.freeze(site.approach)})));

