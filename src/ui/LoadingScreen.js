// Progress counts completed readiness stages, not invented download bytes.
// Each overlay owns its generation so late callbacks cannot hide a newer trip.
export function createLoadingScreen(options = {}) {
  const element = options?.nodeType ? options : options.element ?? globalThis.document?.getElementById('loading');
  if (!element) throw new Error('Loading overlay is missing');
  const find = selector => element.querySelector(selector);
  const status = find('[data-loading-text]') ?? find('#loading-text');
  const track = find('[data-loading-track]');
  const count = find('[data-loading-count]');
  const percent = find('[data-loading-percent]');
  const list = find('[data-loading-steps]');
  const retryButton = find('[data-loading-retry]');
  const cancelButton = find('[data-loading-cancel]');
  let state = 'idle', steps = [], generation = 0, timer, retryAction, cancelAction;
  const item = id => {
    const step = steps.find(entry => entry.id === id);
    if (!step) throw new Error(`Unknown loading stage: ${id}`);
    return step;
  };
  const render = () => {
    const completed = steps.filter(step => step.state === 'done').length;
    const value = steps.length ? Math.floor(completed * 100 / steps.length) : 0;
    if (count) count.textContent = steps.length ? `พร้อมแล้ว ${completed} / ${steps.length} ขั้นตอน` : 'กำลังเตรียมการเดินทาง';
    if (percent) percent.textContent = steps.length ? `${value}%` : '';
    track?.setAttribute('aria-valuenow', String(value));
    track?.setAttribute('aria-valuetext', `พร้อมแล้ว ${completed} จาก ${steps.length} ขั้นตอน`);
    track?.style.setProperty('--loading-progress', `${value}%`);
    if (list) {
      list.replaceChildren();
      for (const step of steps) {
        const row = element.ownerDocument.createElement('li');
        row.dataset.state = step.state;
        const label = element.ownerDocument.createElement('span');
        label.textContent = step.label;
        const flag = element.ownerDocument.createElement('small');
        flag.textContent = ({ pending: 'รอ', loading: 'กำลังเตรียม', done: 'พร้อม', error: 'โหลดไม่สำเร็จ' })[step.state];
        row.append(label, flag); list.append(row);
      }
    }
  };
  const controller = {
    get pending() { return state === 'loading' || state === 'error'; },
    get state() { return state; },
    begin({ title, steps: plan = [] } = {}) {
      const ids = new Set(plan.map(step => step.id));
      if (ids.size !== plan.length) throw new Error('Loading stages must have unique IDs');
      clearTimeout(timer); generation++; state = 'loading'; retryAction = null; cancelAction = null;
      steps = plan.map(step => ({ ...step, state: 'pending' }));
      element.hidden = false; element.classList.remove('done');
      element.dataset.loadingState = state; element.setAttribute('aria-busy', 'true');
      if (title) { const heading = find('[data-loading-title]'); if (heading) heading.textContent = title; }
      if (status) status.textContent = 'กำลังเตรียมการเดินทาง…';
      if (retryButton) { retryButton.hidden = true; retryButton.disabled = false; }
      if (cancelButton) { cancelButton.hidden = true; cancelButton.disabled = false; }
      render();
      const token = generation;
      // Keep the handle for this attempt across awaits; a retried trip gets a new one.
      return Object.fromEntries(['start', 'complete', 'setDetail', 'fail', 'finish'].map(name =>
        [name, (...args) => generation === token ? controller[name](...args) : undefined]));
    },
    start(id) {
      if (state !== 'loading') return;
      const step = item(id);
      if (step.state === 'done') return;
      step.state = 'loading'; if (status) status.textContent = step.label; render();
    },
    complete(id) {
      if (state !== 'loading') return;
      item(id).state = 'done'; render();
    },
    setDetail(text) { if (state === 'loading' && status) status.textContent = text; },
    fail(message, { retry = () => globalThis.location?.reload(), cancel } = {}) {
      if (state !== 'loading') return;
      state = 'error'; generation++; clearTimeout(timer); retryAction = retry; cancelAction = cancel;
      for (const step of steps) if (step.state === 'loading') step.state = 'error';
      element.dataset.loadingState = state; element.setAttribute('aria-busy', 'false');
      if (status) status.textContent = message || 'โหลดเกมไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่';
      if (retryButton) { retryButton.hidden = false; retryButton.disabled = false; }
      if (cancelButton) { cancelButton.hidden = typeof cancel !== 'function'; cancelButton.disabled = false; }
      render();
    },
    finish() {
      if (state !== 'loading' || !steps.length || steps.some(step => step.state !== 'done')) return false;
      state = 'done'; element.dataset.loadingState = state; element.setAttribute('aria-busy', 'false');
      if (status) status.textContent = 'พร้อมออกเดินทาง';
      element.classList.add('done');
      const token = ++generation;
      timer = setTimeout(() => { if (generation === token && state === 'done') element.hidden = true; }, 350);
      return true;
    },
  };
  retryButton?.addEventListener('click', () => {
    if (state !== 'error' || retryButton.disabled) return;
    retryButton.disabled = true;
    const token = generation;
    try {
      Promise.resolve(retryAction?.()).catch(() => { if (state === 'error' && generation === token) retryButton.disabled = false; });
    } catch { retryButton.disabled = false; }
  });
  cancelButton?.addEventListener('click', async () => {
    if (state !== 'error' || cancelButton.disabled || typeof cancelAction !== 'function') return;
    const token = generation;
    cancelButton.disabled = true;
    try {
      await cancelAction();
      if (generation !== token || state !== 'error') return;
      state = 'idle'; generation++; clearTimeout(timer);
      element.dataset.loadingState = state; element.hidden = true;
      element.setAttribute('aria-busy', 'false');
    } catch {
      if (generation === token && state === 'error') cancelButton.disabled = false;
    }
  });
  return controller;
}
