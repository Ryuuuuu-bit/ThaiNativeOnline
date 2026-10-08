// Pixels per FX-local unit. Orthographic particles do not shrink with depth.
export function particleProjection(camera, height, pixelRatio, size) {
  const pixels = height * pixelRatio * size;
  return camera.isOrthographicCamera
    ? pixels * camera.zoom / (camera.top - camera.bottom)
    : pixels / (2 * Math.tan(camera.fov * Math.PI / 360));
}
