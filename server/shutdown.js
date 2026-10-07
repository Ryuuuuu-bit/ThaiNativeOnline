// Quiesce first, capture final snapshots, then drain every queued write.
// A deadline failure is visible to the process supervisor, never reported as saved.
export function createShutdown({ quiesce, save, drain, close, timeoutMs = 20000 }) {
  let running;
  return () => running ??= (async () => {
    let timer;
    try {
      await Promise.race([
        (async () => { await quiesce(); await save(); await drain(timeoutMs); await close(); })(),
        new Promise((_, reject) => { timer=setTimeout(()=>reject(new Error('Shutdown deadline exceeded')),timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  })();
}
