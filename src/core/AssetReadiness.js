// Finite loading tasks report completed stages, never guessed download bytes.
export function boundedReady(promise, label, { timeout = 90000, onLate } = {}) {
  let timer, expired = false;
  const work = Promise.resolve(promise).then(value => {
    if (expired) onLate?.(value);
    return value;
  });
  return Promise.race([work, new Promise((_, reject) => {
    timer = setTimeout(() => { expired = true; reject(new Error(`${label}: หมดเวลารอ กรุณาลองใหม่`)); }, timeout);
  })]).finally(() => clearTimeout(timer));
}

export async function loadingTask(screen, id, task, options) {
  screen.start(id);
  const result = await boundedReady(Promise.resolve().then(task), id, options);
  screen.complete(id);
  return result;
}

export async function interfaceReady(root = document.body) {
  const images = [...root.querySelectorAll('img')].filter(img => img.getClientRects().length && (img.currentSrc || img.src));
  await Promise.all([
    document.fonts?.ready,
    ...images.map(img => img.decode ? img.decode() : new Promise((resolve, reject) => {
      if (img.complete) return img.naturalWidth ? resolve() : reject(new Error(`ภาพโหลดไม่สำเร็จ: ${img.src}`));
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', () => reject(new Error(`ภาพโหลดไม่สำเร็จ: ${img.src}`)), { once: true });
    })),
  ]);
}
