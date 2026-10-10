// Windowless software preview of the actual textured skin, for local pose review.
import { writeFile } from 'node:fs/promises';
import { THREE, worldVertices, clampedSampler } from './rig.mjs';

export async function previewRig(rig, sharp, output, { clip, time = 0, yaw = 0, width = 600, height = 600 } = {}) {
  const sampler = clip ? clampedSampler(rig, rig.gltf.animations.find(c => c.name === clip)) : null;
  try {
    sampler?.at(time);
    const world = worldVertices(rig), material = rig.json.materials[0], imageID = rig.json.textures[material.pbrMetallicRoughness.baseColorTexture.index].source, image = rig.json.images[imageID], view = rig.json.bufferViews[image.bufferView];
    const { data: texture, info } = await sharp(rig.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)).resize(1024, 1024).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = Buffer.alloc(width * height * 3), depth = new Float64Array(width * height).fill(-Infinity);
    for (let i = 0; i < pixels.length; i += 3) { pixels[i] = 34; pixels[i + 1] = 45; pixels[i + 2] = 44; }
    const cos = Math.cos(yaw), sin = Math.sin(yaw), projected = [], scale = height / 2.1;
    for (let i = 0; i < world.length; i += 3) projected.push({ x: width / 2 + (world[i] * cos - world[i + 2] * sin) * scale, y: height * 0.94 - world[i + 1] * scale, z: world[i] * sin + world[i + 2] * cos });
    const ids = rig.mesh.geometry.index.array, uv = rig.mesh.geometry.attributes.uv, shade = new THREE.Vector3(0.25, 0.8, 0.6).normalize(), factor = material.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1];
    const transform = material.pbrMetallicRoughness.baseColorTexture.extensions?.KHR_texture_transform ?? {}, repeat = transform.scale ?? [1, 1], offset = transform.offset ?? [0, 0], angle = transform.rotation ?? 0;
    for (let t = 0; t < ids.length; t += 3) {
      const [a, b, c] = [projected[ids[t]], projected[ids[t + 1]], projected[ids[t + 2]]], area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); if (Math.abs(area) < 1e-7) continue;
      const normal = new THREE.Vector3().fromArray(world, ids[t + 1] * 3).sub(new THREE.Vector3().fromArray(world, ids[t] * 3)).cross(new THREE.Vector3().fromArray(world, ids[t + 2] * 3).sub(new THREE.Vector3().fromArray(world, ids[t] * 3))).normalize();
      const light = 0.62 + 0.38 * Math.max(0, normal.dot(shade));
      for (let y = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))); y <= Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y))); y++) for (let x = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))); x <= Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x))); x++) {
        const wb = ((x + 0.5 - a.x) * (c.y - a.y) - (y + 0.5 - a.y) * (c.x - a.x)) / area, wc = ((b.x - a.x) * (y + 0.5 - a.y) - (b.y - a.y) * (x + 0.5 - a.x)) / area, wa = 1 - wb - wc;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const z = wa * a.z + wb * b.z + wc * c.z, pixel = y * width + x; if (z <= depth[pixel]) continue; depth[pixel] = z;
        const rawU = wa * uv.getX(ids[t]) + wb * uv.getX(ids[t + 1]) + wc * uv.getX(ids[t + 2]), rawV = wa * uv.getY(ids[t]) + wb * uv.getY(ids[t + 1]) + wc * uv.getY(ids[t + 2]);
        const u = offset[0] + Math.cos(angle) * rawU * repeat[0] - Math.sin(angle) * rawV * repeat[1], v = offset[1] + Math.sin(angle) * rawU * repeat[0] + Math.cos(angle) * rawV * repeat[1];
        const tx = Math.min(info.width - 1, Math.max(0, Math.floor(u * info.width))), ty = Math.min(info.height - 1, Math.max(0, Math.floor(v * info.height))), texel = (ty * info.width + tx) * info.channels;
        for (let k = 0; k < 3; k++) pixels[pixel * 3 + k] = Math.round(texture[texel + k] * factor[k] * light);
      }
    }
    await writeFile(output, await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer());
  } finally { sampler?.dispose(); }
}
