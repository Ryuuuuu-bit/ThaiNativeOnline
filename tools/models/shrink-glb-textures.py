#!/usr/bin/env python3
"""Re-encode the textures embedded in a GLB so the file downloads faster (phones).

    python3 tools/models/shrink-glb-textures.py public/models/herbalist.glb [--max 1024] [--quality 85]

Every embedded image is re-encoded as JPEG (a PNG without transparency too; one with
transparency is kept as PNG) and shrunk to --max px on its long side. Geometry, skins and
animations are untouched; only the image buffer views change. Overwrites the file.
"""
import argparse, io, json, struct, sys
from PIL import Image

def pad4(b, fill=b'\0'):
    return b + fill * ((4 - len(b) % 4) % 4)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--max', type=int, default=1024)
    ap.add_argument('--quality', type=int, default=85)
    a = ap.parse_args()
    for path in a.files:
        raw = open(path, 'rb').read()
        assert raw[:4] == b'glTF', f'{path}: not a GLB'
        jlen = struct.unpack('<I', raw[12:16])[0]
        gltf = json.loads(raw[20:20 + jlen])
        blen = struct.unpack('<I', raw[20 + jlen:24 + jlen])[0]
        binary = raw[28 + jlen:28 + jlen + blen]
        views = gltf['bufferViews']
        image_views = {img['bufferView']: img for img in gltf.get('images', []) if 'bufferView' in img}
        out = bytearray(); before = len(raw)
        for i, bv in enumerate(views):
            off = bv.get('byteOffset', 0); data = binary[off:off + bv['byteLength']]
            if i in image_views:
                im = Image.open(io.BytesIO(data))
                alpha = im.mode in ('RGBA', 'LA') and im.getextrema()[-1][0] < 255
                if max(im.size) > a.max:
                    im.thumbnail((a.max, a.max), Image.LANCZOS)
                buf = io.BytesIO()
                if alpha:
                    im.save(buf, 'PNG', optimize=True); image_views[i]['mimeType'] = 'image/png'
                else:
                    im.convert('RGB').save(buf, 'JPEG', quality=a.quality, optimize=True, progressive=False); image_views[i]['mimeType'] = 'image/jpeg'
                data = buf.getvalue()
            bv['byteOffset'] = len(out); bv['byteLength'] = len(data)
            out += pad4(data)
        gltf['buffers'][0]['byteLength'] = len(out)
        jbytes = pad4(json.dumps(gltf, separators=(',', ':')).encode('utf8'), b' ')
        total = 12 + 8 + len(jbytes) + 8 + len(out)
        with open(path, 'wb') as f:
            f.write(b'glTF' + struct.pack('<II', 2, total))
            f.write(struct.pack('<I', len(jbytes)) + b'JSON' + jbytes)
            f.write(struct.pack('<I', len(out)) + b'BIN\0' + bytes(out))
        print(f'{path}: {before / 1e6:.2f} MB -> {total / 1e6:.2f} MB')

if __name__ == '__main__':
    main()
