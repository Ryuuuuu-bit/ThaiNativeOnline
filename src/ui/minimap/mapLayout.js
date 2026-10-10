// `pad` is canvas pixels at the bottom covered by on-map controls: the camera centres and
// fits the map in the strip above them, so nothing starts hidden under the buttons.
export function fittedCamera(rect, width, height, focus = rect, pad = 0) {
  const h = Math.max(1, height - pad);
  const base = Math.min(width / (rect.maxX - rect.minX), h / (rect.maxZ - rect.minZ)) * .94;
  const fit = Math.min(width / (focus.maxX - focus.minX), h / (focus.maxZ - focus.minZ)) * .94;
  return { x: (focus.minX + focus.maxX) / 2, z: (focus.minZ + focus.maxZ) / 2, zoom: fit / base };
}

export function mapTransform(rect, width, height, camera, pad = 0) {
  const view = Math.max(1, height - pad);
  const k = Math.min(width / (rect.maxX - rect.minX), view / (rect.maxZ - rect.minZ)) * .94 * camera.zoom;
  const w = (rect.maxX - rect.minX) * k, h = (rect.maxZ - rect.minZ) * k;
  return { k, w, h, left: width / 2 + (rect.minX - camera.x) * k, top: view / 2 + (rect.minZ - camera.z) * k, minX: rect.minX, minZ: rect.minZ };
}

export function clampCamera(rect, width, height, camera, pad = 0) {
  const { k } = mapTransform(rect, width, height, camera, pad), halfX = width / (2 * k), halfZ = Math.max(1, height - pad) / (2 * k);
  const clampAxis = (value, min, max, half) => max - min <= half * 2 ? (min + max) / 2 : Math.max(min + half, Math.min(max - half, value));
  camera.x = clampAxis(camera.x, rect.minX, rect.maxX, halfX);
  camera.z = clampAxis(camera.z, rect.minZ, rect.maxZ, halfZ);
  return camera;
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Group touching badges at the current zoom. Membership is retained for selection;
// zooming in naturally separates them again.
export function clusterMarkers(points, diameter) {
  const groups = [];
  for (const point of points) {
    const nearby = groups.filter(g => g.points.some(p => Math.hypot(p.x - point.x, p.y - point.y) < diameter));
    const points = [point, ...nearby.flatMap(g => g.points)];
    for (const group of nearby) groups.splice(groups.indexOf(group), 1);
    groups.push({ points, x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length });
  }
  return groups;
}

// Reserve icon boxes first. Fit labels in priority order; every omitted label remains
// available through selection and the directory, instead of painting over another name.
export function placeLabels(labels, obstacles, width, height) {
  const boxes = [...obstacles], placed = [];
  for (const item of [...labels].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))) {
    const gap = item.radius + 6, w = Math.min(item.width, width - 16), h = item.height;
    const candidates = [[-w / 2, gap], [gap, -h / 2], [-gap - w, -h / 2], [-w / 2, -gap - h],
      [-w / 2, gap + h + 4], [gap, gap], [-gap - w, gap]];
    for (const [dx, dy] of candidates) {
      const box = { x: item.x + dx, y: item.y + dy, w, h };
      if (box.x < 8 || box.y < 8 || box.x + w > width - 8 || box.y + h > height - 8 || boxes.some(b => overlaps(box, b))) continue;
      boxes.push(box); placed.push({ ...item, box }); break;
    }
  }
  return placed;
}
