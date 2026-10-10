// Independent binary utilities: no authoring-tool or unmerged asset dependency.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseGLB(bytes) {
  bytes = Buffer.from(bytes);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid GLB header');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw Error('Truncated GLB chunk');
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (size % 4 || offset + 8 + size > bytes.length) throw Error('Invalid GLB chunk size');
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) { if (json) throw Error('Duplicate JSON chunk'); json = JSON.parse(data.toString('utf8').trim()); }
    if (type === 0x004e4942) { if (bin) throw Error('Duplicate BIN chunk'); bin = data; }
    offset += 8 + size;
  }
  if (!json || json.asset?.version !== '2.0' || !bin) throw Error('Expected embedded glTF 2.0');
  if ((json.buffers ?? []).some(b => b.uri) || (json.images ?? []).some(i => i.uri)) throw Error('External buffers/images are not supported');
  return { json, bin, bytes, sha256: sha256(bytes) };
}

export async function readGLB(file) { return parseGLB(await readFile(file)); }

export class GLBBuilder {
  constructor() {
    this.json = { asset: { version: '2.0', generator: 'ThaiNativeOnline NPC local preparation' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], skins: [], materials: [], animations: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
    this.parts = []; this.length = 0;
  }
  view(bytes) {
    bytes = Buffer.from(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength ?? bytes.length);
    const id = this.json.bufferViews.length;
    this.json.bufferViews.push({ buffer: 0, byteOffset: this.length, byteLength: bytes.length });
    const pad = (4 - bytes.length % 4) % 4;
    this.parts.push(bytes, Buffer.alloc(pad)); this.length += bytes.length + pad;
    return id;
  }
  accessor(array, type, { bounds = false } = {}) {
    const componentType = array instanceof Float32Array ? 5126 : array instanceof Uint16Array ? 5123 : array instanceof Uint32Array ? 5125 : array instanceof Uint8Array ? 5121 : null;
    const stride = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    if (!componentType || !stride || array.length % stride) throw Error('Unsupported accessor');
    const a = { bufferView: this.view(array), componentType, type, count: array.length / stride };
    if (bounds) {
      a.min = Array(stride).fill(Infinity); a.max = Array(stride).fill(-Infinity);
      for (let i = 0; i < array.length; i++) { a.min[i % stride] = Math.min(a.min[i % stride], array[i]); a.max[i % stride] = Math.max(a.max[i % stride], array[i]); }
    }
    this.json.accessors.push(a); return this.json.accessors.length - 1;
  }
  encode() {
    this.json.buffers[0].byteLength = this.length;
    const text = Buffer.from(JSON.stringify(this.json));
    const json = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
    const bin = Buffer.concat(this.parts), out = Buffer.alloc(12 + 8 + json.length + 8 + bin.length);
    out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
    out.writeUInt32LE(json.length, 12); out.writeUInt32LE(0x4e4f534a, 16); json.copy(out, 20);
    out.writeUInt32LE(bin.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(out, 28 + json.length);
    return out;
  }
}
