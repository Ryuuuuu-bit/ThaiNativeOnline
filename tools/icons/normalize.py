"""Give every class skill icon the same frame (offline tool; needs Python + Pillow).

    python tools/icons/normalize.py            # rewrites public/fx/<class>/icon_*.png and public/ui/items/
    (item art comes from tools/icons/draw_items.py → tools/icons/source/items/)

Each 48x48 icon gets:
  - the class's background (dark lacquer red for มวยไทย, deep herb green for หมอยา,
    forest-floor brown for นายพราน — its art comes from PixelLab, 48×48 on transparency)
    with a soft centre glow,
  - the subject centred in the 40x40 inner area with a 1 px drop shadow,
  - one gold bevel frame (light top-left, dark bottom-right) like the HUD panels.

Icons that already carry a baked 4 px gold frame have it stripped first, and
their flat background is cleared by flood fill from the inner corners, so old
and new icons end up identical in framing. The original art is read from
tools/icons/source/ (kept so the tool can be re-run); the first run copies the
current icons there. heal_zone (วงหนาดปราบผี) has no art file, so it is drawn
here as pixel art.
"""
import math
import os
import shutil
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'tools', 'icons', 'source')
OUT = os.path.join(ROOT, 'public', 'fx')
SIZE, INNER = 48, 40

PALETTE = {  # centre glow, edge
    'muaythai': ((122, 46, 26), (34, 13, 8)),
    'herbalist': ((52, 92, 38), (12, 26, 10)),
    'hunter': ((92, 78, 38), (24, 20, 9)),       # forest-floor brown for นายพราน
    'warrior': ((50, 58, 80), (12, 14, 22)),     # night-steel blue for นักรบ
    'items': ((70, 64, 48), (20, 18, 13)),   # warm neutral lacquer for every item
}
# Where each set lives in public/ (items are not class FX).
OUT_DIR = {'items': os.path.join(ROOT, 'public', 'ui', 'items')}
GOLD_LIGHT, GOLD, GOLD_DARK, INK = (246, 222, 150), (214, 169, 79), (128, 88, 32), (16, 10, 5)


def background(cls):
    centre, edge = PALETTE[cls]
    im = Image.new('RGBA', (SIZE, SIZE))
    px = im.load()
    for y in range(SIZE):
        for x in range(SIZE):
            d = min(1, math.hypot(x - 23.5, y - 21) / 30)
            px[x, y] = tuple(round(c * (1 - d) + e * d) for c, e in zip(centre, edge)) + (255,)
    return im


def frame(im):
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, SIZE - 1, SIZE - 1], outline=INK)
    for i, inset in enumerate((1, 2)):
        tl = GOLD_LIGHT if i == 0 else GOLD
        br = GOLD_DARK if i == 0 else (168, 120, 48)
        d.line([(inset, inset), (SIZE - 1 - inset, inset)], fill=tl)
        d.line([(inset, inset), (inset, SIZE - 1 - inset)], fill=tl)
        d.line([(inset, SIZE - 1 - inset), (SIZE - 1 - inset, SIZE - 1 - inset)], fill=br)
        d.line([(SIZE - 1 - inset, inset), (SIZE - 1 - inset, SIZE - 1 - inset)], fill=br)
    d.rectangle([3, 3, SIZE - 4, SIZE - 4], outline=(30, 18, 8, 220))
    for x, y in ((1, 1), (SIZE - 2, 1), (1, SIZE - 2), (SIZE - 2, SIZE - 2)):  # rounded corners
        d.point((x, y), fill=INK)
    return im


def has_baked_frame(im):
    px = im.load()
    ring = [px[x, y] for x in range(SIZE) for y in (0, 1, SIZE - 1, SIZE - 2)] + [px[x, y] for y in range(SIZE) for x in (0, 1, SIZE - 1, SIZE - 2)]
    return sum(p[3] > 200 for p in ring) / len(ring) > .85


def clear_flat_background(im, tol=34):
    """Flood-fill from the corners and make the flat background transparent."""
    w, h = im.size
    px = im.load()
    seen, stack = set(), [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    ref = px[0, 0]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        p = px[x, y]
        if p[3] < 10 or sum(abs(a - b) for a, b in zip(p[:3], ref[:3])) <= tol:
            px[x, y] = (0, 0, 0, 0)
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


def has_inner_frame(im, inset=4):
    """A thin frame drawn 4 px in, inside a transparent margin (older PixelLab icons)."""
    px = im.load()
    lo, hi = inset, SIZE - 1 - inset
    ring = [px[x, y] for x in range(lo, hi + 1) for y in (lo, hi)] + [px[x, y] for y in range(lo, hi + 1) for x in (lo, hi)]
    margin = [px[x, y] for x in range(SIZE) for y in (0, 1)]
    return sum(p[3] > 200 for p in ring) / len(ring) > .85 and all(p[3] < 10 for p in margin)


def subject(im):
    if has_baked_frame(im):
        im = clear_flat_background(im.crop((4, 4, SIZE - 4, SIZE - 4)))
    elif has_inner_frame(im):
        im = clear_flat_background(im.crop((6, 6, SIZE - 6, SIZE - 6)))
    box = im.getbbox()
    if not box:
        return im
    im = im.crop(box)
    w, h = im.size
    k = min(1, (INNER - 2) / max(w, h))
    if k < 1:
        im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.NEAREST)
    return im


def compose(cls, art):
    out = background(cls)
    s = subject(art)
    x, y = (SIZE - s.width) // 2, (SIZE - s.height) // 2
    shadow = Image.new('RGBA', s.size, (0, 0, 0, 0))
    shadow.putalpha(s.getchannel('A').point(lambda a: a * 140 // 255))
    out.alpha_composite(shadow, (x + 1, y + 1))
    out.alpha_composite(s, (x, y))
    return frame(out)


def draw_zone():
    """วงหนาดปราบผี: a ring of herb leaves around a yant, on a transparent ground."""
    im = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = 23.5
    for r, col in ((15, (216, 224, 112)), (10, (170, 210, 90))):
        d.ellipse([c - r, c - r, c + r, c + r], outline=col, width=2)
    for k in range(8):  # leaves on the outer ring
        a = k / 8 * math.tau - math.pi / 2
        lx, ly = c + math.cos(a) * 18, c + math.sin(a) * 18
        pts = [(lx + math.cos(a) * 4, ly + math.sin(a) * 4), (lx + math.cos(a + 1.9) * 2.5, ly + math.sin(a + 1.9) * 2.5),
               (lx - math.cos(a) * 3, ly - math.sin(a) * 3), (lx + math.cos(a - 1.9) * 2.5, ly + math.sin(a - 1.9) * 2.5)]
        d.polygon(pts, fill=(140, 214, 80), outline=(60, 110, 30))
    for k in range(8):  # rays between leaves
        a = (k + .5) / 8 * math.tau
        d.line([(c + math.cos(a) * 11, c + math.sin(a) * 11), (c + math.cos(a) * 14, c + math.sin(a) * 14)], fill=(232, 240, 128), width=1)
    for i, w in enumerate((9, 7, 5)):  # yant strokes in the middle
        y = 19 + i * 3
        d.line([(c - w / 2, y), (c + w / 2, y)], fill=(240, 236, 150), width=2)
    return im


def main():
    os.makedirs(SRC, exist_ok=True)
    done = []
    for cls in PALETTE:
        cls_out = OUT_DIR.get(cls, os.path.join(OUT, cls))
        cls_src = os.path.join(SRC, cls)
        os.makedirs(cls_src, exist_ok=True); os.makedirs(cls_out, exist_ok=True)
        for name in sorted(os.listdir(cls_out)) if cls not in OUT_DIR else []:
            if name.startswith('icon_') and name.endswith('.png') and not os.path.exists(os.path.join(cls_src, name)):
                shutil.copy2(os.path.join(cls_out, name), os.path.join(cls_src, name))
        if cls == 'herbalist' and not os.path.exists(os.path.join(cls_src, 'icon_heal_zone.png')):
            draw_zone().save(os.path.join(cls_src, 'icon_heal_zone.png'))
        for name in sorted(os.listdir(cls_src)):
            art = Image.open(os.path.join(cls_src, name)).convert('RGBA').resize((SIZE, SIZE), Image.NEAREST)
            compose(cls, art).save(os.path.join(cls_out, name))
            done.append(f'{cls}/{name}')
    print(f'{len(done)} icons framed')


if __name__ == '__main__':
    main()
