import { normalizeUid } from './identity.js';
import './uid.css';

export function uidRow(label, value, prefix) {
  const uid = normalizeUid(value, prefix), row = document.createElement('div'); row.className = 'account-uid';
  const title = document.createElement('small'); title.textContent = label;
  const code = document.createElement('code'); code.textContent = uid ?? 'ยังไม่มี UID · ผู้มาเยือนหรือบัญชีในเครื่อง';
  row.append(title, code);
  if (uid) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'คัดลอก'; button.setAttribute('aria-label', `คัดลอก ${label}`);
    const feedback = document.createElement('small'); feedback.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(uid); feedback.textContent = 'คัดลอกแล้ว'; }
      catch { feedback.textContent = 'คัดลอกไม่ได้ · เลือก UID เพื่อคัดลอกเอง'; const selection = window.getSelection(), range = document.createRange(); range.selectNodeContents(code); selection.removeAllRanges(); selection.addRange(range); }
    });
    row.append(button, feedback);
  }
  row.addEventListener('keydown', e => e.stopPropagation());
  return row;
}
