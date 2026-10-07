import { TITLE_BY_ID } from '../data/titles.js';

// A worn title as a coloured tag (src/data/titles.js): above name plates, before chat names and in
// the social window. '' when there is none. `brackets` writes it as [ฉายา] (chat).
export function titleHtml(id, { brackets = false } = {}) {
  const t = TITLE_BY_ID[id]; if (!t) return '';
  return `<em class="ttl${t.glow ? ' glow' : ''}" style="--ttl:${t.color}">${brackets ? `[${t.name}]` : t.name}</em>`;
}
