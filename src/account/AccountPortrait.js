import { googlePictureURL } from './profile-picture.js';

let picture = null;
const listeners = new Set();
export function setAccountPicture(value) {
  picture = googlePictureURL(value);
  for (const update of listeners) update(picture);
}

// Leave the class badge and level in place. A photo overlays only the badge
// after loading successfully; late responses from an old account are discarded.
export function bindAccountPortrait(container) {
  let image = null;
  const update = url => {
    image?.remove(); image = null;
    container.dataset.portrait = 'default';
    if (!url) return;
    const next = document.createElement('img');
    next.className = 'g-account-photo'; next.alt = 'รูปโปรไฟล์ Google';
    next.referrerPolicy = 'no-referrer'; next.decoding = 'async'; next.hidden = true;
    next.onload = () => {
      if (image !== next) return;
      next.hidden = false; container.dataset.portrait = 'google';
    };
    next.onerror = () => {
      if (image !== next) return;
      next.remove(); image = null; container.dataset.portrait = 'default';
    };
    image = next; container.append(next); next.src = url;
  };
  listeners.add(update); update(picture);
  return () => { listeners.delete(update); image?.remove(); };
}
