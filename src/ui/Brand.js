// One wordmark and crest for account pages, loading and the game header.
export const brandMarkup = () => `<span class="tno-brand" role="img" aria-label="Thai Native Online"><img src="/ui/login/native-crest.svg" alt="" width="64" height="70"><span class="tno-brand-name">THAI NATIVE<span class="tno-brand-online">ONLINE</span></span></span>`;
export const loadingMarkup = () => `<div class="tno-loading-scene" aria-hidden="true"></div><div class="tno-loading-content">${brandMarkup()}<span class="tno-loading-kicker">A NEW CHAPTER AWAITS</span><h2 data-loading-title>นครอโยธยา</h2><p id="loading-text" role="status" aria-live="polite">กำลังเปิดประตูสู่ราชธานี…</p><div class="tno-loading-track" aria-hidden="true"><i></i></div><span class="tno-loading-note">ทุกการเดินทาง เริ่มต้นด้วยก้าวแรก</span></div>`;

export function mountEntryBrand() {
  document.querySelectorAll('[data-game-brand]').forEach(node => { node.innerHTML = brandMarkup(); });
  const loading = document.getElementById('loading');
  if (loading) loading.innerHTML = loadingMarkup();
}
