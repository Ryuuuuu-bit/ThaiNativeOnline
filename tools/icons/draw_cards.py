"""Draw the monster card icons (offline tool; needs Python + Pillow).

    python tools/icons/draw_cards.py

Writes public/ui/items/icon_card_<monster>.png (48x48) for every card in
src/character/data/cards.js: a small card in the monster's colour with its race
mark (paw = สัตว์, wisp = ผี, horns = อสูร), framed blue (rare) or violet (epic,
elites and bosses). Pixel art on a 24x24 grid drawn at 2x.
"""
import os
import re
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'ui', 'items')
G = 24
INK = (22, 12, 8, 255)


def monsters():
    src = open(os.path.join(ROOT, 'src', 'combat', 'data', 'monsters.js'), encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"\n  (\w+):\s+\{ name: '[^']+', race: '(\w+)', element: '(\w+)',(.*)", src):
        body = m.group(4)
        color = re.search(r"color: '#([0-9a-fA-F]{6})'", body).group(1)
        out[m.group(1)] = (m.group(2), tuple(int(color[i:i + 2], 16) for i in (0, 2, 4)), 'elite: true' in body or 'boss: true' in body)
    return out


def cards():
    src = open(os.path.join(ROOT, 'src', 'character', 'data', 'cards.js'), encoding='utf-8').read()
    return re.findall(r"\n  (\w+):\s+\{ slot:", src)


def mix(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c) + (255,)


def draw(race, color, big):
    im = Image.new('RGBA', (G, G), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    edge = (199, 154, 240, 255) if big else (127, 183, 232, 255)
    # card body with a frame
    d.rectangle([5, 2, 18, 21], fill=edge)
    d.rectangle([6, 3, 17, 20], fill=mix(color, .45))
    d.rectangle([7, 4, 16, 14], fill=mix(color, 1.0))
    d.rectangle([7, 16, 16, 19], fill=(232, 220, 190, 255))
    d.line([(8, 17), (15, 17)], fill=(150, 130, 100, 255)); d.line([(8, 18), (13, 18)], fill=(150, 130, 100, 255))
    mark = (250, 244, 228, 255)
    if race == 'beast':      # paw
        d.ellipse([9, 9, 14, 13], fill=mark)
        for x, y in ((8, 6), (10, 5), (13, 5), (15, 6)): d.rectangle([x, y, x + 1, y + 1], fill=mark)
    elif race == 'spirit':   # wisp flame
        d.polygon([(11, 5), (14, 9), (14, 12), (12, 13), (9, 12), (9, 9)], fill=mark)
        d.rectangle([11, 9, 12, 11], fill=mix(color, .8))
    else:                    # demon horns
        d.ellipse([9, 8, 14, 13], fill=mark)
        d.polygon([(9, 9), (7, 5), (10, 8)], fill=mark); d.polygon([(14, 9), (16, 5), (13, 8)], fill=mark)
        d.point((10, 10), fill=(200, 40, 30, 255)); d.point((13, 10), fill=(200, 40, 30, 255))
    if big:                  # a star in the corner
        for x, y in ((16, 3), (15, 4), (17, 4), (16, 5)): d.point((x, y), fill=(255, 236, 160, 255))
    # outline
    src = im.load(); out = im.copy(); o = out.load()
    for y in range(G):
        for x in range(G):
            if not src[x, y][3] and any(0 <= x + dx < G and 0 <= y + dy < G and src[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = INK
    # the same lacquer square the other items sit on
    bg = Image.new('RGBA', (G * 2, G * 2), (34, 30, 22, 255)); bd = ImageDraw.Draw(bg)
    bd.rectangle([0, 0, 47, 47], outline=(214, 169, 79, 255)); bd.rectangle([1, 1, 46, 46], outline=(128, 88, 32, 255))
    bg.alpha_composite(out.resize((G * 2, G * 2), Image.NEAREST))
    return bg


def main():
    info = monsters()
    for m in cards():
        race, color, big = info[m]
        draw(race, color, big).save(os.path.join(OUT, f'icon_card_{m}.png'))
    print(len(cards()), 'cards')


if __name__ == '__main__':
    main()
