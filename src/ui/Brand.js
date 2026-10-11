// One wordmark and crest for account pages, loading and the game header.
export const brandMarkup = () => `<span class="tno-brand" role="img" aria-label="Thai Native Online"><img src="/ui/login/native-crest.svg" alt="" width="64" height="70"><span class="tno-brand-name">THAI NATIVE<span class="tno-brand-online">ONLINE</span></span></span>`;
export const loadingMarkup = () => `<div class="tno-loading-scene" aria-hidden="true"></div><div class="tno-loading-content">${brandMarkup()}<span class="tno-loading-kicker">การเดินทางครั้งใหม่</span><h2 data-loading-title>นครที่ถูกลืมเลือน</h2><p id="loading-text" data-loading-text role="status" aria-live="polite">กำลังเปิดประตูสู่ราชธานี…</p><div class="tno-loading-progress"><span data-loading-count>กำลังเตรียมการเดินทาง</span><strong data-loading-percent></strong></div><div class="tno-loading-track" data-loading-track role="progressbar" aria-label="ความคืบหน้าการเตรียมเกม" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><ol class="tno-loading-steps" data-loading-steps aria-label="ขั้นตอนการเตรียมเกม"></ol><div class="tno-loading-actions"><button type="button" class="tno-loading-retry" data-loading-retry hidden>ลองใหม่</button><button type="button" class="tno-loading-cancel" data-loading-cancel hidden>กลับไปแผนที่เดิม</button></div><span class="tno-loading-note">โหลดเฉพาะสิ่งที่จำเป็นสำหรับการเดินทางครั้งนี้</span></div>`;

export function mountEntryBrand() {
  document.querySelectorAll('[data-game-brand]').forEach(node => { node.innerHTML = brandMarkup(); });
  const loading = document.getElementById('loading');
  if (loading) loading.innerHTML = loadingMarkup();
}
