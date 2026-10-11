// Read-only navigation presentation. Distances use the map's world units (วา).
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

export function cameraRelativeArrow(from, to, { forward, right, upScale = 1 } = {}) {
  if (!point(from) || !point(to) || !point(forward) || !point(right)) return null;
  const x = to.x - from.x, z = to.z - from.z;
  if (Math.hypot(x, z) < .01) return null;
  const screenX = x * right.x + z * right.z;
  const screenUp = (x * forward.x + z * forward.z) * Math.max(.01, Number.isFinite(upScale) ? upScale : 1);
  return Math.atan2(screenX, screenUp) * 180 / Math.PI;
}

export function questGuidance({ objective, position, map, route, walking = false, cameraBasis, message = '' }) {
  const step = objective?.step;
  const unavailable = objective?.reason || (!point(step) ? 'ไม่พบจุดหมาย · เปิดสมุดเควส' : step.map !== map ? 'จุดหมายอยู่คนละแผนที่ · เปิดแผนที่' : '');
  if (unavailable || !point(position)) return { arrow: null, distance: null, distanceKind: null, label: 'ไม่พร้อม', status: unavailable || 'รอตำแหน่งผู้เล่น', arrived: false };
  // Use only this quest's current path; unrelated combat/manual routes are ignored.
  const path = walking && route?.length && route.every(point) ? route : null;
  const direct = distance(position, step);
  const remaining = path ? path.reduce((sum, p, i) => sum + distance(i ? path[i - 1] : position, p), 0) : direct;
  const near = Number.isFinite(step.near) && step.near >= 0 ? step.near : 0;
  const arrived = direct <= near + .5 && (!path || remaining <= .6);
  const aim = path?.find(p => distance(position, p) > .2) ?? step;
  const distanceKind = path ? 'path' : 'direct';
  const label = `${path ? 'ตามทาง' : 'ระยะตรง'} ${Math.round(remaining)} วา`;
  let status = message;
  if (!status || walking || arrived) status = arrived
    ? objective.crossMap ? 'ถึงประตู · เดินผ่านแล้วกดเดินต่อในแผนที่ถัดไป' : 'ถึงจุดหมาย · คุยหรือทำเป้าหมายด้วยตนเอง'
    : objective.crossMap ? `ไปประตู · ${step.name} · ข้ามแล้วกดเดินต่อ` : `${walking ? 'กำลังเดิน · ' : ''}${step.name ?? 'จุดหมายเควส'}`;
  if (message.includes('กีดขวาง')) status = message;
  return { arrow: arrived ? null : cameraRelativeArrow(position, aim, cameraBasis), distance: remaining, distanceKind, label, status, arrived };
}
