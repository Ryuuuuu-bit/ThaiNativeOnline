// Canvas text uses the HUD's faces (src/ui/fonts.css): SANS for labels, SERIF for titles.
// A canvas does not wait for webfonts, so anything painted once (sign textures, the full
// map) repaints with afterFonts(draw) when the faces have arrived.
export const SANS = '"IBM Plex Sans Thai Looped", "Noto Sans Thai", sans-serif';
export const SERIF = '"Trirong", "Noto Serif Thai", serif';
let ready = null;
export function afterFonts(draw) {
  const fonts = globalThis.document?.fonts; if (!fonts?.load) return;
  ready ??= Promise.all(['400', '600', '700'].map(w => fonts.load(`${w} 16px ${SANS}`, 'กA')).concat(['500', '600'].map(w => fonts.load(`${w} 16px ${SERIF}`, 'กA'))));
  ready.then(draw, () => {});
}
