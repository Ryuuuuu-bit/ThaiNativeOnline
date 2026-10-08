"""Frame item art from tools/icons/source/items/ onto the lacquer square (offline tool; Pillow).

    python tools/icons/frame_items.py [id ...]     # all of source/items, or only the ids given

The art is PixelLab's 48×48 on transparency (create_image_pixflux, no background); the frame,
glow and shadow are normalize.py's, so item icons match the skill icons exactly. Writes
public/ui/items/icon_<id>.png. Retired gear keeps no icon (src/character/data/items.js `retired`).
"""
import os
import sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from normalize import compose, SIZE, SRC, OUT_DIR  # noqa: E402

src, out = os.path.join(SRC, 'items'), OUT_DIR['items']
ids = sys.argv[1:]
names = [f'icon_{i}.png' for i in ids] if ids else sorted(n for n in os.listdir(src) if n.endswith('.png'))
for name in names:
    art = Image.open(os.path.join(src, name)).convert('RGBA').resize((SIZE, SIZE), Image.NEAREST)
    compose('items', art).save(os.path.join(out, name))
print(len(names), 'item icons framed')
