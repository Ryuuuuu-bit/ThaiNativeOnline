import { TITLE_BY_ID } from '../data/titles.js';
import { titleTier, titleTheme } from './titleAppearance.js';

// A worn title as a coloured tag (src/data/titles.js): above name plates, before chat names and in
// the social window. '' when there is none. `brackets` writes it as [ฉายา] (chat).
export function titleHtml(id, { brackets = false } = {}) {
  const t = TITLE_BY_ID[id]; if (!t) return '';
  const tier = titleTier(t);
  return `<em class="ttl ttl-${tier}${t.glow ? ' glow' : ''}" data-title-tier="${tier}" data-title-theme="${titleTheme(t)}" style="--ttl:${t.color}"><span class="ttl-label">${brackets ? `[${t.name}]` : t.name}</span></em>`;
}
