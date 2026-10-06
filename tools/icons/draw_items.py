"""Draw the item icon art (offline tool; needs Python + Pillow).

    python tools/icons/draw_items.py && python tools/icons/normalize.py

Writes 48x48 transparent pixel art to tools/icons/source/items/icon_<id>.png,
one per item in src/character/data/items.js; normalize.py then frames them
like the skill icons into public/ui/items/. Hand-placed shapes on a 24x24
grid drawn at 2x, so every pixel stays crisp. The shipped set in
source/items/ is PixelLab art (create_image_pixflux, 48x48, transparent);
this script only fills in items that have no art yet (--force redraws all).
"""
import math
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'tools', 'icons', 'source', 'items')
G = 24  # logical grid; drawn at 2x
INK = (26, 14, 8)


class Pix:
    """A 24x24 canvas with crisp shapes and a 1-cell dark outline pass."""

    def __init__(self):
        self.im = Image.new('RGBA', (G, G), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def poly(self, pts, fill):
        self.d.polygon(pts, fill=fill)

    def rect(self, x0, y0, x1, y1, fill):
        self.d.rectangle([x0, y0, x1, y1], fill=fill)

    def ellipse(self, x0, y0, x1, y1, fill):
        self.d.ellipse([x0, y0, x1, y1], fill=fill)

    def line(self, pts, fill, w=1):
        self.d.line(pts, fill=fill, width=w)

    def px(self, x, y, fill):
        self.d.point((x, y), fill=fill)

    def outlined(self):
        """Add a dark outline around every opaque shape, then scale 2x."""
        src = self.im.load()
        out = self.im.copy()
        o = out.load()
        for y in range(G):
            for x in range(G):
                if src[x, y][3]:
                    continue
                if any(0 <= x + dx < G and 0 <= y + dy < G and src[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    o[x, y] = INK + (255,)
        return out.resize((G * 2, G * 2), Image.NEAREST)


def gourd(p, body, light, dark, big=False):
    s = 1 if big else 0
    p.rect(10, 3, 13, 5, (139, 90, 43))           # cork
    p.rect(10, 6, 13, 8, body)                    # neck
    p.ellipse(8 - s, 7, 15 + s, 12, body)         # upper bulb
    p.ellipse(6 - s, 10, 17 + s, 21, body)        # lower bulb
    p.ellipse(7 - s, 13, 12, 20, dark)
    p.ellipse(8, 12, 16 + s, 19, body)
    p.rect(9, 13, 9, 16, light); p.px(10, 12, light)
    p.line([(8, 9), (15, 9)], (240, 220, 160))    # cord
    if big:
        p.rect(6, 15, 17, 15, (240, 220, 160))


def draw():
    art = {}

    p = Pix(); gourd(p, (196, 58, 42), (255, 170, 130), (140, 34, 26)); art['potion_s'] = p
    p = Pix(); gourd(p, (196, 58, 42), (255, 170, 130), (140, 34, 26), big=True); art['potion_m'] = p

    p = Pix()  # น้ำผึ้งป่า: honey jar with a drip
    p.rect(7, 5, 16, 6, (139, 90, 43)); p.rect(8, 4, 15, 4, (180, 120, 60))
    p.ellipse(5, 7, 18, 21, (217, 164, 52)); p.ellipse(6, 9, 11, 19, (172, 118, 30))
    p.ellipse(8, 8, 17, 19, (226, 176, 64)); p.rect(9, 10, 10, 13, (255, 236, 160))
    p.rect(13, 7, 14, 11, (255, 210, 90)); p.px(13, 12, (255, 210, 90))
    art['ether'] = p

    p = Pix()  # หนังสัตว์: a stretched pelt
    p.poly([(5, 6), (9, 4), (12, 6), (15, 4), (19, 6), (17, 11), (19, 18), (14, 20), (12, 18), (10, 20), (5, 18), (7, 11)], (150, 98, 58))
    p.poly([(8, 8), (12, 7), (16, 8), (15, 15), (12, 17), (9, 15)], (176, 122, 76))
    for x, y in ((10, 10), (14, 12), (11, 14)):
        p.px(x, y, (110, 70, 40))
    art['hide'] = p

    p = Pix()  # เขี้ยวหมูป่า: curved tusk
    p.poly([(6, 18), (8, 13), (11, 8), (15, 5), (19, 4), (17, 7), (14, 10), (12, 14), (10, 19)], (238, 228, 200))
    p.poly([(8, 17), (10, 13), (13, 9), (16, 6), (15, 8), (12, 12), (10, 17)], (255, 250, 232))
    p.rect(5, 18, 10, 20, (150, 110, 70))
    art['tusk'] = p

    p = Pix()  # ขี้เถ้าธูป: incense sticks in an ash pile
    p.ellipse(4, 15, 19, 21, (150, 146, 140)); p.ellipse(6, 15, 17, 18, (190, 186, 178))
    for x, top in ((9, 5), (12, 4), (15, 6)):
        p.line([(x, top), (x, 16)], (176, 64, 44)); p.px(x, top - 1, (255, 170, 80))
    p.px(11, 3, (220, 220, 220)); p.px(13, 2, (200, 200, 200)); p.px(16, 4, (210, 210, 210))
    art['ash'] = p

    p = Pix()  # ผ้าพันมือมงคล: hand-wrap roll with red cord
    p.ellipse(4, 7, 15, 18, (236, 230, 214)); p.ellipse(7, 10, 12, 15, (200, 192, 172)); p.ellipse(8, 11, 11, 14, (236, 230, 214))
    p.poly([(13, 9), (20, 13), (19, 17), (13, 16)], (236, 230, 214))
    p.line([(5, 9), (14, 17)], (196, 42, 42)); p.line([(14, 8), (6, 17)], (196, 42, 42))
    p.line([(15, 12), (20, 16)], (196, 42, 42))
    art['hand_wrap'] = p

    p = Pix()  # มีดสั้นคู่: two crossed daggers
    for flip in (False, True):
        q = Pix()
        q.poly([(4, 18), (14, 8), (16, 6), (17, 7), (15, 9), (5, 19)], (210, 216, 224))
        q.line([(5, 18), (15, 8)], (250, 252, 255))
        q.rect(15, 9, 19, 10, (196, 152, 64)); q.rect(16, 11, 19, 15, (120, 70, 40))
        img = q.im.transpose(Image.FLIP_LEFT_RIGHT) if flip else q.im
        p.im.alpha_composite(img)
    art['krabi'] = p

    p = Pix()  # ไม้เท้าสมุนไพร: staff with leaves
    p.line([(7, 21), (16, 4)], (132, 86, 46), 2)
    for (x, y), a in (((15, 4), 0), ((18, 6), 1), ((13, 7), 2), ((17, 2), 3)):
        p.ellipse(x - 2, y - 1, x + 2, y + 2, (96, 170, 72) if a % 2 else (126, 200, 90))
    p.px(16, 5, (255, 220, 120))
    art['herb_staff'] = p

    p = Pix()  # มงคลครูมวย: braided red-white headband ring
    for k in range(20):
        a = k / 20 * math.tau
        x, y = 12 + math.cos(a) * 7, 12 + math.sin(a) * 6
        p.ellipse(x - 1.6, y - 1.6, x + 1.6, y + 1.6, (206, 44, 44) if k % 2 else (240, 232, 220))
    p.poly([(17, 17), (20, 21), (18, 22), (16, 18)], (206, 44, 44)); p.poly([(15, 18), (16, 22), (14, 22), (14, 18)], (240, 232, 220))
    p.px(12, 6, (232, 190, 80))
    art['mongkol'] = p

    p = Pix()  # ดาบไม้ซ้อม: wooden practice sword
    p.poly([(5, 19), (16, 6), (18, 5), (17, 8), (6, 20)], (176, 128, 74)); p.line([(6, 19), (17, 6)], (210, 162, 102))
    p.rect(4, 15, 9, 16, (120, 80, 44)); p.rect(3, 18, 5, 21, (96, 62, 34))
    art['wood_sword'] = p

    p = Pix()  # ดาบเหล็กลาย: Thai steel sword with gold guard
    p.poly([(6, 18), (17, 5), (20, 3), (19, 6), (7, 19)], (200, 208, 220)); p.line([(7, 18), (18, 5)], (245, 248, 255))
    p.line([(9, 14), (13, 10)], (150, 160, 176))
    p.rect(4, 15, 10, 16, (214, 169, 79)); p.px(4, 14, (214, 169, 79)); p.px(10, 17, (214, 169, 79))
    p.rect(3, 18, 5, 21, (90, 40, 30)); p.px(3, 21, (214, 169, 79))
    art['iron_dap'] = p

    p = Pix()  # ธนูไม้ไผ่: bamboo bow with string
    p.line([(8, 3), (6, 8), (5, 12), (6, 16), (8, 21)], (160, 140, 70), 2)
    for y in (6, 12, 18):
        p.px(6 if y != 12 else 5, y, (110, 96, 40))
    p.line([(9, 3), (9, 21)], (236, 230, 214))
    p.line([(9, 12), (19, 12)], (150, 110, 70)); p.poly([(19, 10), (21, 12), (19, 14)], (200, 208, 220))
    p.poly([(9, 11), (11, 12), (9, 13)], (206, 44, 44))
    art['bamboo_bow'] = p

    p = Pix()  # ไม้เท้ากระดูก: bone staff with a small skull
    p.line([(7, 21), (14, 9)], (226, 218, 196), 2); p.rect(9, 16, 11, 17, (180, 172, 150))
    p.ellipse(12, 3, 19, 10, (236, 230, 212)); p.rect(13, 9, 18, 11, (236, 230, 212))
    p.px(14, 6, INK); p.px(17, 6, INK); p.rect(14, 10, 17, 10, (150, 140, 120))
    p.px(19, 3, (160, 120, 230)); p.px(20, 2, (200, 170, 255))
    art['bone_wand'] = p

    p = Pix()  # เสื้อผ้าฝ้าย: cream cotton shirt
    p.poly([(7, 4), (10, 3), (14, 3), (17, 4), (21, 9), (18, 11), (17, 9), (17, 20), (7, 20), (7, 9), (6, 11), (3, 9)], (232, 222, 196))
    p.poly([(10, 3), (12, 7), (14, 3)], (196, 184, 156)); p.rect(7, 13, 17, 14, (196, 120, 60))
    p.line([(9, 15), (9, 19)], (210, 198, 170))
    art['cloth_vest'] = p

    p = Pix()  # เกราะหนังสัตว์: leather armour
    p.poly([(7, 4), (10, 4), (12, 7), (14, 4), (17, 4), (19, 9), (18, 20), (6, 20), (5, 9)], (140, 92, 54))
    p.rect(8, 9, 16, 11, (170, 116, 70)); p.rect(8, 13, 16, 15, (170, 116, 70)); p.rect(8, 17, 16, 18, (170, 116, 70))
    for x in (9, 15):
        p.px(x, 10, (214, 169, 79)); p.px(x, 14, (214, 169, 79))
    art['hide_armor'] = p

    p = Pix()  # ตะกรุดโทน: rolled metal amulet on a cord
    p.line([(5, 4), (12, 11), (19, 4)], (196, 42, 42))
    p.rect(8, 11, 16, 15, (200, 170, 96)); p.rect(8, 11, 16, 11, (246, 222, 150)); p.rect(8, 15, 16, 15, (140, 104, 44))
    p.line([(10, 12), (10, 14)], (150, 112, 50)); p.line([(14, 12), (14, 14)], (150, 112, 50))
    p.rect(7, 12, 7, 14, (196, 42, 42)); p.rect(17, 12, 17, 14, (196, 42, 42))
    p.px(12, 18, (232, 190, 80)); p.px(11, 19, (232, 190, 80)); p.px(13, 19, (232, 190, 80))
    art['takrut'] = p

    p = Pix()  # เขี้ยวเสือสมิง: tiger fang on a cord with a stripe charm
    p.line([(5, 4), (12, 9), (19, 4)], (120, 70, 40))
    p.poly([(10, 9), (14, 9), (13, 15), (12, 21), (11, 15)], (244, 236, 214)); p.line([(11, 10), (12, 18)], (255, 252, 240))
    p.rect(9, 8, 15, 9, (214, 120, 40)); p.px(10, 8, INK); p.px(13, 8, INK)
    art['tiger_fang'] = p

    return art


def main():
    os.makedirs(OUT, exist_ok=True)
    art = draw()
    drawn = 0
    for k, p in art.items():
        path = os.path.join(OUT, f'icon_{k}.png')
        if os.path.exists(path) and '--force' not in sys.argv:
            continue  # keep existing art (the PixelLab set); --force redraws
        p.outlined().save(path); drawn += 1
    print(f'{drawn} item icons drawn ({len(art) - drawn} kept)')


if __name__ == '__main__':
    main()
