// Loading that survives a flaky phone connection: a task is tried a few times with a growing
// pause, and a cached loader forgets a failure after a while so the next monster (or map)
// asks the server again instead of keeping the placeholder until the page is reloaded.
//
//   await withRetry(attempt => fetch(url), { tries: 3, delay: 800 })
//   const load = cachedLoader(url => loader.loadAsync(url)); load(url) → Promise (shared per url)
export async function withRetry(task, { tries = 3, delay = 800 } = {}) {
  let error;
  for (let attempt = 0; attempt < tries; attempt++) {
    try { return await task(attempt); } catch (e) {
      error = e;
      if (attempt < tries - 1) await new Promise(r => setTimeout(r, delay * (attempt + 1)));
    }
  }
  throw error;
}

export function cachedLoader(load, { tries = 3, delay = 800, retryAfter = 15000, onInvalidated } = {}) {
  const cache = new Map();
  const cached = key => {
    if (cache.has(key)) return cache.get(key).promise;
    const record = { promise: null, state: 'pending', invalidated: false };
    record.promise = withRetry(attempt => load(key, attempt), { tries, delay }).then(value => {
      if (record.invalidated) { onInvalidated?.(value); throw new Error(`Asset request invalidated: ${key}`); }
      record.state = 'fulfilled';
      return value;
    }).catch(e => {
      record.state = 'rejected';
      setTimeout(() => { if (cache.get(key) === record) cache.delete(key); }, retryAfter);
      throw e;
    });
    cache.set(key, record);
    return record.promise;
  };
  // Successful sources may already be in use by another view. Retain them;
  // only failed or unfinished attempts need a fresh request on explicit retry.
  cached.invalidate = key => {
    const record = cache.get(key);
    if (!record || record.state === 'fulfilled') return false;
    record.invalidated = true;
    cache.delete(key);
    return true;
  };
  return cached;
}
