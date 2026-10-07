"""Draw the icons of the head / off-hand / cape / shoes gear (offline tool; needs Python + Pillow).

    python tools/icons/draw_gear.py

Writes public/ui/items/icon_<id>.png (48x48): pixel art on a 24x24 grid drawn at 2x,
outlined, on the same lacquer square and gold frame as the card icons
(tools/icons/draw_cards.py). PixelLab art can replace any of them later.
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'ui', 'items')
G = 24
INK = (22, 12, 8, 255)


def c(h, a=255):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (a,)


def pha_khao(d):   # a head wrap
    d.ellipse([5, 8, 18, 18], fill=c('#c8473c')); d.rectangle([5, 13, 18, 18], fill=(0, 0, 0, 0))
    d.rectangle([5, 12, 18, 15], fill=c('#e0624f')); d.line([(6, 13), (17, 13)], fill=c('#f3a08c'))
    d.polygon([(16, 13), (20, 17), (18, 18)], fill=c('#c8473c'))


def ngob(d):       # a palm-leaf farmer's hat
    d.polygon([(12, 4), (21, 15), (3, 15)], fill=c('#d9b36a'))
    for y in (8, 11, 14): d.line([(12 - (y - 4) * .8, y), (12 + (y - 4) * .8, y)], fill=c('#a8813f'))
    d.rectangle([7, 15, 17, 16], fill=c('#8a6a32'))


def chada(d):      # a brass crown with a spire
    d.polygon([(12, 2), (14, 8), (10, 8)], fill=c('#f0cf6a'))
    d.polygon([(8, 8), (16, 8), (17, 18), (7, 18)], fill=c('#d6a53f'))
    d.rectangle([7, 16, 17, 18], fill=c('#a8772a')); d.point((12, 12), fill=c('#e04848')); d.point((9, 13), fill=c('#48a0e0')); d.point((15, 13), fill=c('#48a0e0'))


def shield(color, rim, boss):
    def draw(d):
        d.ellipse([4, 4, 19, 19], fill=rim); d.ellipse([6, 6, 17, 17], fill=color)
        for i in range(6, 18, 3): d.line([(i, 6), (i, 17)], fill=rim)
        d.ellipse([10, 10, 13, 13], fill=boss)
    return draw


def mo_knife(d):   # a short doctor's knife
    d.polygon([(6, 18), (15, 6), (17, 8), (8, 19)], fill=c('#d8dce4')); d.line([(8, 17), (16, 7)], fill=c('#ffffff'))
    d.rectangle([4, 17, 8, 21], fill=c('#6b4a2b')); d.rectangle([7, 16, 10, 18], fill=c('#c9a24a'))


def cloth(main, stripe):
    def draw(d):
        d.polygon([(6, 4), (18, 4), (20, 20), (4, 20)], fill=main)
        for y in range(6, 20, 4): d.line([(5, y), (19, y)], fill=stripe)
        for x in range(8, 18, 4): d.line([(x, 4), (x - 1, 20)], fill=stripe)
    return draw


def sabai(d):      # a silk shoulder sash
    d.polygon([(4, 4), (9, 4), (20, 18), (20, 21), (15, 21)], fill=c('#b34a8a'))
    d.line([(6, 5), (18, 20)], fill=c('#e89ac8')); d.line([(15, 20), (20, 20)], fill=c('#f0cf6a'))


def shoe(main, sole, strap):
    def draw(d):
        d.polygon([(4, 12), (10, 12), (12, 15), (20, 16), (20, 19), (4, 19)], fill=main)
        d.rectangle([4, 19, 20, 20], fill=sole); d.line([(6, 13), (11, 17)], fill=strap); d.line([(8, 12), (8, 18)], fill=strap)
    return draw


def bia_kae(d):    # a cowrie shell on a cord
    d.line([(6, 4), (12, 9), (18, 4)], fill=c('#c8a070'))
    d.ellipse([7, 9, 17, 20], fill=c('#efe4c8')); d.line([(12, 11), (12, 18)], fill=c('#8a7a5a'))
    for y in (12, 14, 16): d.point((11, y), fill=c('#8a7a5a')); d.point((13, y), fill=c('#8a7a5a'))


def pha_yant(d):   # a cloth covered in yantra rows
    d.rectangle([5, 4, 19, 20], fill=c('#e8dcc0'))
    for y in (7, 10, 13, 16, 19): d.line([(7, y), (17, y)], fill=c('#a83a2a'))
    d.rectangle([10, 8, 14, 12], outline=c('#a83a2a'))


def prakam(d):     # agarwood prayer beads
    import math as m
    for i in range(14):
        a = i / 14 * 6.283; x, y = 12 + m.cos(a) * 7, 12 + m.sin(a) * 7
        d.ellipse([x - 1.6, y - 1.6, x + 1.6, y + 1.6], fill=c('#7a4a2a'))
    d.ellipse([10, 18, 14, 22], fill=c('#f0cf6a'))


ICONS = {
    'bia_kae': bia_kae, 'pha_yant': pha_yant, 'prakam': prakam,
    'pha_khao': pha_khao, 'ngob': ngob, 'chada': chada,
    'rattan_shield': shield(c('#c79a52'), c('#8a6430'), c('#5a3e1c')),
    'buffalo_shield': shield(c('#5a4a42'), c('#2e2622'), c('#d9cfb4')),
    'mo_knife': mo_knife,
    'pakhaoma': cloth(c('#4a7ec0'), c('#d24a4a')), 'sabai': sabai,
    'sandals': shoe(c('#a87a48'), c('#5a3e1c'), c('#e0c08a')),
    'hide_boots': shoe(c('#7a5a3a'), c('#3e2a16'), c('#c8a070')),
}


def render(fn):
    im = Image.new('RGBA', (G, G), (0, 0, 0, 0)); fn(ImageDraw.Draw(im))
    src = im.load(); out = im.copy(); o = out.load()
    for y in range(G):
        for x in range(G):
            if not src[x, y][3] and any(0 <= x + dx < G and 0 <= y + dy < G and src[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = INK
    bg = Image.new('RGBA', (G * 2, G * 2), (34, 30, 22, 255)); bd = ImageDraw.Draw(bg)
    bd.rectangle([0, 0, 47, 47], outline=(214, 169, 79, 255)); bd.rectangle([1, 1, 46, 46], outline=(128, 88, 32, 255))
    bg.alpha_composite(out.resize((G * 2, G * 2), Image.NEAREST))
    return bg


if __name__ == '__main__':
    for k, fn in ICONS.items(): render(fn).save(os.path.join(OUT, f'icon_{k}.png'))
    print(len(ICONS), 'icons')
