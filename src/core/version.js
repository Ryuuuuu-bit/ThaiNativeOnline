// The build's stamp (vite.config.js defines __BUILD__ at build time): big assets are cached
// by the browser for a day, so their URLs carry the stamp and a new deploy is fetched fresh.
export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
export const versioned = url => `${url}${url.includes('?') ? '&' : '?'}v=${BUILD}`;
