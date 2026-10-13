# Ayutthaya city kit: modular Thai architecture for the compact city, built in Blender.
#
#   python3 tools/city-kit/ayutthaya_kit.py [out.glb]   (pip install bpy; no Blender UI needed; packs with npx gltfpack)
#   → public/models/city/ayutthaya-kit.glb, one top-level node per piece (names below)
#
# Every piece stands on its own origin at ground level, its front toward Blender −Y, which
# glTF exports as +Z: the game's south. Materials are named after the city palette in
# src/world/compact-city-render/buildCityArt.js (brick, rim, cream, gold, roof, wood …); the
# game swaps them for its own materials when it loads the kit, so the pieces light, fade and
# glow at night exactly like the rest of the town. Colours here only serve the preview.
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'public/models/city/ayutthaya-kit.glb'
PALETTE = {
  'brick': '#927456', 'brickRed': '#9a5a3e', 'rim': '#ead4a5', 'cream': '#ede0b5', 'gold': '#caa05e',
  'wood': '#684c33', 'dark': '#3e3830', 'timber': '#987044', 'roof': '#944f3b', 'roofDark': '#74483b',
  'jade': '#49775c', 'red': '#ba493a', 'clay': '#b17751', 'leaf': '#678549', 'leafDark': '#4d734a',
  'leafLight': '#88a35b', 'lantern': '#ffe3a0', 'cloth': '#c8a24a', 'bark': '#6b5640',
}

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
def material(key):
  if key not in MATS:
    m = bpy.data.materials.new(key); h = PALETTE[key].lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    m.diffuse_color = (*[x ** 2.2 for x in c], 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value = m.diffuse_color
    bsdf.inputs['Roughness'].default_value = .88
    MATS[key] = m
  return MATS[key]

# ---- primitive builders: each returns an object carrying one material ----
def from_bm(bm, mat, name='part'):
  me = bpy.data.meshes.new(name); bm.normal_update(); bm.to_mesh(me); bm.free()
  ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
  me.materials.append(material(mat)); return ob

def box(mat, x, y, z, w, d, h, rz=0, taper=1.0):
  """A box w (x) × d (y) × h (z) standing on z; taper shrinks the top."""
  bm = bmesh.new(); v = []
  for k, zz in ((1, 0), (taper, h)):
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
      v.append(bm.verts.new((sx * w / 2 * k, sy * d / 2 * k, zz)))
  for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
    bm.faces.new([v[i] for i in f])
  ob = from_bm(bm, mat); ob.location = (x, y, z); ob.rotation_euler = (0, 0, rz); return ob

def lathe(mat, profile, seg=8, x=0, y=0, z=0, rot=0.0, scale=(1, 1)):
  """Revolve [(r, z) …] bottom to top; r = 0 closes a pole. scale squashes x / y."""
  bm = bmesh.new(); rings = []
  for r, zz in profile:
    if r <= 1e-6: rings.append([bm.verts.new((0, 0, zz))]); continue
    rings.append([bm.verts.new((r * math.cos(rot + i / seg * 2 * math.pi) * scale[0], r * math.sin(rot + i / seg * 2 * math.pi) * scale[1], zz)) for i in range(seg)])
  for a, b in zip(rings, rings[1:]):
    for i in range(seg):
      j = (i + 1) % seg
      if len(a) == 1 and len(b) == 1: continue
      if len(a) == 1: bm.faces.new((a[0], b[i], b[j]) if False else (a[0], b[j], b[i]))
      elif len(b) == 1: bm.faces.new((a[i], a[j], b[0]))
      else: bm.faces.new((a[i], a[j], b[j], b[i]))
  if len(rings[0]) > 1: bm.faces.new(list(reversed(rings[0])))
  if len(rings[-1]) > 1: bm.faces.new(rings[-1])
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  ob = from_bm(bm, mat); ob.location = (x, y, z); return ob

def cyl(mat, x, y, z, r, h, seg=8, r2=None):
  return lathe(mat, [(r, 0), (r if r2 is None else r2, h)], seg, x, y, z)

def slab(mat, poly, t, x=0, y=0, z=0, rz=0, rx=0):
  """A flat plate: polygon [(u, v) …] in the x-z plane, t thick along y (convex outline)."""
  bm = bmesh.new()
  f = [bm.verts.new((u, -t / 2, v)) for u, v in poly]; b = [bm.verts.new((u, t / 2, v)) for u, v in poly]
  bm.faces.new(f); bm.faces.new(list(reversed(b)))
  n = len(poly)
  for i in range(n):
    j = (i + 1) % n; bm.faces.new((f[j], f[i], b[i], b[j]))
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  ob = from_bm(bm, mat); ob.location = (x, y, z); ob.rotation_euler = (rx, 0, rz); return ob

def band(mat, outer, inner, t, x=0, y=0, z=0):
  """A strip between two polylines in the x-z plane (an arch), t thick along y."""
  bm = bmesh.new()
  of = [bm.verts.new((u, -t / 2, v)) for u, v in outer]; ob_ = [bm.verts.new((u, t / 2, v)) for u, v in outer]
  inf = [bm.verts.new((u, -t / 2, v)) for u, v in inner]; ib = [bm.verts.new((u, t / 2, v)) for u, v in inner]
  for i in range(len(outer) - 1):
    bm.faces.new((of[i], of[i + 1], inf[i + 1], inf[i])); bm.faces.new((ob_[i + 1], ob_[i], ib[i], ib[i + 1]))
    bm.faces.new((of[i + 1], of[i], ob_[i], ob_[i + 1])); bm.faces.new((inf[i], inf[i + 1], ib[i + 1], ib[i]))
  bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
  o = from_bm(bm, mat); o.location = (x, y, z); return o

def beam(mat, a, b, r, seg=6, r2=None):
  a, b = Vector(a), Vector(b); d = b - a
  o = cyl(mat, 0, 0, 0, r, d.length, seg, r2)
  o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized()); o.location = a
  return o

def ball(mat, x, y, z, sx, sy=None, sz=None, seg=8):
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(x, y, z))
  o = bpy.context.active_object; o.scale = (sx, sy or sx, sz or sx); o.data.materials.append(material(mat)); return o

def turn(parts, angle):
  """Turn already placed parts about the piece origin (z axis)."""
  bpy.context.view_layer.update(); R = Matrix.Rotation(angle, 4, 'Z')
  for o in parts: o.matrix_world = R @ o.matrix_world
  return parts

def piece(name, parts):
  """Join parts into one object named `name` with transforms applied."""
  bpy.ops.object.select_all(action='DESELECT')
  for p in parts: p.select_set(True)
  bpy.context.view_layer.objects.active = parts[0]
  bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
  bpy.ops.object.join(); o = bpy.context.active_object; o.name = name; o.data.name = name
  bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
  # merge per material duplicates only within tolerance; keep flat shading for the low-poly look
  for poly in o.data.polygons: poly.use_smooth = False
  return o

# ---- shared shapes ----
SEMA = [(-.34, 0), (.34, 0), (.34, .42), (.22, .68), (0, .95), (-.22, .68), (-.34, .42)]   # ใบเสมา outline
def sema(mat, x, y, z, s=1.0, rz=0):
  return slab(mat, [(u * s, v * s) for u, v in SEMA], .22 * s, x, y, z, rz)

def prang_profile(base_r, height, tiers=5):
  """A corn-cob prang tower: bulging tiers narrowing to a point (r, z) bottom→top."""
  pts = [(base_r, 0)]
  for i in range(tiers):
    t0, t1 = i / tiers, (i + 1) / tiers
    r0 = base_r * (1 - .78 * t0 ** 1.1); r1 = base_r * (1 - .78 * t1 ** 1.1)
    z0, z1 = height * .82 * t0, height * .82 * t1
    pts += [(r0 * 1.08, z0 + (z1 - z0) * .35), (r1 * .93, z1)]
  pts += [(base_r * .16, height * .86), (0, height)]
  return pts

def pointed_arch(span, spring, k=.62, n=8):
  """Left-to-right points of a pointed arch over `span`, springing at z = spring."""
  R = span * k; cx = -span / 2 + R; tmax = math.acos(cx / R); left = []
  for i in range(n + 1):
    t = tmax * i / n; left.append((cx - R * math.cos(t), spring + R * math.sin(t)))
  return left + [(-u, v) for u, v in reversed(left[:-1])]

def thai_roof(mat, w, d, eave_z, ridge_z, over=.45, x=0, y=0, end_mat='cream', boards='wood', chofa=True, ends=(True, True)):
  """A gable roof with its ridge along x: two plates, gable infill, barge boards with chofa tips."""
  parts = []; half = d / 2 + over; rise = ridge_z - eave_z; t = .1
  slope = math.atan2(rise, half); L = math.hypot(half, rise)
  for s in (-1, 1):
    o = box(mat, 0, 0, -t, w + over * 1.2, L, t)   # a plate centred on its slope, rising toward the ridge
    o.rotation_euler = (-s * slope, 0, 0); o.location = (x, y + s * half / 2, eave_z + rise / 2); parts.append(o)
  for side, on in zip((-1, 1), ends):
    if not on: continue
    gx = x + side * (w / 2)
    parts.append(slab(end_mat, [(-d / 2, eave_z), (d / 2, eave_z), (0, ridge_z - .12)], .08, gx, y, 0, math.pi / 2))
    if chofa:
      for s in (-1, 1):   # ป้านลม barge boards rising to a curled ช่อฟ้า at the ridge, หางหงส์ at the eaves
        parts.append(beam(boards, (gx + side * .1, y + s * half, eave_z - .05), (gx + side * .1, y, ridge_z + .05), .07, 4))
        parts.append(beam('gold', (gx + side * .1, y + s * half, eave_z - .05), (gx + side * .1, y + s * (half + .25), eave_z + .35), .05, 4))
      parts.append(beam('gold', (gx + side * .1, y, ridge_z), (gx + side * .1, y + .12, ridge_z + .55), .06, 4, .02))
  parts.append(box('roofDark', x, y, ridge_z - .1, w + over * 1.2, .22, .2))
  return parts

# =========================== pieces ===========================
def make_sema():
  return piece('sema', [sema('rim', 0, 0, 0)])

def make_wall():
  """4 m of city wall: brick on a dark plinth, a stucco band and three ใบเสมา merlons."""
  p = [box('dark', 0, 0, 0, 4.02, 1.9, .45), box('brickRed', 0, 0, .45, 4.02, 1.6, 2.65),
       box('rim', 0, 0, 3.1, 4.08, 1.78, .22)]
  for x in (-1.33, 0, 1.33): p.append(sema('rim', x, 0, 3.32, 1.0))
  for x in (-1.33, 0, 1.33): p.append(box('brick', x + .66, -.82, 1.2, .12, .04, .9))   # weathered courses
  return piece('wall', p)

def make_bastion():
  """A corner fort (ป้อม): octagonal brick drum, stucco cornice, merlons and a red flag."""
  p = [lathe('dark', [(3.0, 0), (3.0, .5)], 8, rot=math.pi / 8),
       lathe('brickRed', [(2.8, .5), (2.6, 4.4)], 8, rot=math.pi / 8),
       lathe('rim', [(2.85, 4.4), (2.85, 4.65)], 8, rot=math.pi / 8)]
  for i in range(8):
    a = i / 8 * 2 * math.pi; p.append(sema('rim', math.cos(a) * 2.45, math.sin(a) * 2.45, 4.65, .95, a + math.pi / 2))
  p.append(cyl('wood', 0, 0, 4.65, .08, 3.4, 6)); p.append(slab('red', [(0, 0), (1.1, 0), (1.1, -.7), (0, -.7)], .03, 0, 0, 8.0))
  return piece('bastion', p)

def make_gate():
  """The north city gate: brick piers, a pointed stucco arch, an attic with merlons and a prang
  crown (ยอดปรางค์) flanked by four small spires. Open red doors. ~13.4 m wide, 15 m tall."""
  p = []; span = 7.0; spring = 3.7
  for s in (-1, 1):
    x = s * (span / 2 + 1.6)
    p += [box('dark', x, 0, 0, 3.4, 4.4, .5), box('brickRed', x, 0, .5, 3.2, 4.2, 5.7),
          box('rim', x, 0, 2.9, 3.3, 4.3, .18), box('rim', x, -2.12, .5, .5, .1, 5.7), box('rim', x + s * 1.35, -2.12, .5, .4, .1, 5.7)]
    # open door leaves, swung back against the piers
    door = box('red', 0, 0, 0, 3.4, .14, 3.9); door.location = (s * (span / 2 - .3), -1.2, .1); door.rotation_euler = (0, 0, s * 1.25); p.append(door)
    for k in range(3): p.append(ball('gold', s * (span / 2 - .25) + s * .12, -1.2 - (k - 1) * .9 * 0, .9 + k * 1.1, .08))
  arch_o = pointed_arch(span + .9, spring - .2); arch_i = pointed_arch(span, spring)
  p.append(band('rim', arch_o, arch_i, .5, 0, -2.0))
  inner = pointed_arch(span, spring)
  # brick spandrels above the arch up to the attic, as a slab with the arch cut by stacking strips
  for i in range(len(inner) - 1):
    (u0, v0), (u1, v1) = inner[i], inner[i + 1]
    top = 6.2
    p.append(slab('brickRed', [(u0, v0), (u1, v1), (u1, top), (u0, top)], 4.0, 0, 0, 0))
  # attic and cornices
  p += [box('brickRed', 0, 0, 6.2, 13.6, 4.4, 1.4), box('rim', 0, 0, 7.6, 14.0, 4.7, .26),
        box('rim', 0, -2.24, 6.35, 3.2, .1, 1.0), box('gold', 0, -2.3, 6.5, 2.2, .06, .55)]
  for x in [i * 1.32 - 5.94 for i in range(10)]:
    p.append(sema('rim', x, -2.15, 7.86, .9)); p.append(sema('rim', x, 2.15, 7.86, .9))
  # stepped base, cella and prang crown
  p += [box('cream', 0, 0, 7.86, 4.6, 3.6, .7), box('cream', 0, 0, 8.56, 3.8, 3.0, .6),
        box('rim', 0, 0, 9.16, 3.0, 2.6, 1.4), box('dark', 0, -1.32, 9.36, 1.0, .08, 1.0)]
  p.append(lathe('cream', prang_profile(1.5, 5.6, 5), 8, 0, 0, 10.56, math.pi / 8))
  p.append(cyl('gold', 0, 0, 15.3, .07, 1.1, 5, .02))
  for sx in (-1, 1):
    for sy in (-1, 1):
      p.append(box('cream', sx * 5.9, sy * 1.6, 7.86, 1.1, 1.1, .5))
      p.append(lathe('cream', prang_profile(.5, 2.2, 4), 8, sx * 5.9, sy * 1.6, 8.36, math.pi / 8))
      p.append(cyl('gold', sx * 5.9, sy * 1.6, 10.5, .04, .5, 4, .01))
  # lanterns hung under the arch for the night
  for s in (-1, 1): p += [cyl('dark', s * 2.4, -2.3, 3.2, .02, .6, 4), lathe('lantern', [(0, 0), (.16, .08), (.18, .3), (.1, .42), (0, .45)], 8, s * 2.4, -2.3, 2.75)]
  return piece('gate', p)

def make_prang():
  """A small ปรางค์ on a redented brick plinth with a stucco porch niche, ~8.5 m."""
  p = [box('dark', 0, 0, 0, 3.4, 3.4, .35), box('brickRed', 0, 0, .35, 3.0, 3.0, .5), box('rim', 0, 0, .85, 3.1, 3.1, .12),
       box('brickRed', 0, 0, .97, 2.3, 2.3, 2.1), box('rim', 0, 0, 3.07, 2.5, 2.5, .16),
       box('rim', 0, -1.2, .97, .9, .3, 1.7), box('dark', 0, -1.36, 1.05, .5, .04, 1.2)]
  p.append(slab('rim', [(-.5, 0), (.5, 0), (0, .7)], .3, 0, -1.2, 2.67))
  p.append(lathe('brickRed', prang_profile(1.05, 4.6, 5), 8, 0, 0, 3.23, math.pi / 8))
  for k, z in enumerate((3.9, 4.8, 5.6)):
    p.append(lathe('rim', [(1.02 - k * .24, 0), (1.06 - k * .24, .1)], 8, 0, 0, z, math.pi / 8))
  p.append(cyl('gold', 0, 0, 7.6, .05, 1.0, 4, .01))
  return piece('prang', p)

def make_chedi():
  """A whitewashed bell chedi (เจดีย์ทรงระฆัง) on a square base, ~6 m."""
  p = [box('brick', 0, 0, 0, 2.8, 2.8, .4), box('rim', 0, 0, .4, 2.5, 2.5, .3), box('cream', 0, 0, .7, 2.2, 2.2, .3)]
  p.append(lathe('cream', [(1.0, 0), (1.0, .18), (.9, .2), (.9, .36), (.82, .38), (.82, .52), (.95, .62), (1.0, 1.0), (.9, 1.45), (.6, 1.75), (0, 1.8)], 12, 0, 0, 1.0))
  p.append(box('cream', 0, 0, 2.75, .7, .7, .35)); p.append(box('rim', 0, 0, 3.1, .8, .8, .08))
  p.append(lathe('cream', [(.26, 0), (.24, .2), (.2, .22), (.19, .42), (.15, .44), (.13, .64), (.1, .66), (.04, 1.6), (0, 1.7)], 8, 0, 0, 3.18))
  p.append(cyl('gold', 0, 0, 4.85, .03, .6, 4, .005))
  return piece('chedi', p)

def make_shophouse():
  """One bay (3.4 m) of a raised timber shophouse row, front to −Y and open to the street: plinth
  and deck, a pale back wall with shelves of jars and cloth, a counter draped in cloth, plank doors
  (ฝาเฟี้ยม) folded back against the posts, a carved fretwork band, a hanging lantern, a gable
  roof with its ridge along the row and a lean-to awning over the walk. Bays tile along x."""
  w, d = 3.4, 3.6; p = []
  p += [box('dark', 0, 0, 0, w, d, .42), box('wood', 0, 0, .42, w, d, .1)]
  p += [box('timber', 0, d / 2 - .1, .52, w, .2, 2.5), box('cream', 0, d / 2 - .22, .55, w - .4, .02, 2.3)]
  for z in (1.25, 1.95):   # shelves with wares
    p.append(box('wood', 0, d / 2 - .45, z, w - .6, .45, .06))
    for i, x in enumerate((-1.1, -.6, -.1, .45, 1.0)):
      if i % 2: p.append(ball(('clay', 'gold', 'red')[(i + int(z * 10)) % 3], x, d / 2 - .45, z + .2, .15, .15, .19))
      else: p.append(box(('red', 'jade', 'cloth')[(i + int(z * 10)) % 3], x, d / 2 - .45, z + .06, .34, .3, .26))
  for x in (-w / 2 + .1, w / 2 - .1): p.append(box('timber', x, 0, .52, .12, d, 2.5))
  for x in (-w / 2 + .12, w / 2 - .12): p.append(box('wood', x, -d / 2 + .12, .52, .2, .2, 2.5))
  p.append(box('wood', 0, -d / 2 + .12, 2.85, w, .22, .2))
  p.append(box('gold', 0, -d / 2 + .02, 2.62, w - .5, .04, .2))   # fretwork band (ลายฉลุ)
  for s in (-1, 1):   # ฝาเฟี้ยม folded against the posts
    for k in range(2): p.append(box('timber', s * (w / 2 - .32 - k * .07), -d / 2 + .3 + k * .1, .55, .06, .5, 2.2))
  p += [box('wood', 0, -.75, .52, w - 1.0, .6, .8), box('timber', 0, -.75, 1.32, w - .9, .7, .06),
        box('red', 0, -1.06, .75, w - 1.1, .02, .56), box('cloth', 0, -1.07, 1.1, w - 1.1, .02, .12)]
  for i, x in enumerate((-.9, -.35, .3, .85)):
    p.append(ball(('clay', 'gold', 'jade', 'leafLight')[i], x, -.75, 1.55, .17, .17, .2))
  p += [cyl('dark', .9, -d / 2 - .1, 2.4, .015, .45, 4), lathe('lantern', [(0, 0), (.14, .06), (.16, .26), (.1, .36), (0, .38)], 8, .9, -d / 2 - .1, 2.02)]
  p.append(box('red', 0, -d / 2 - .02, 2.2, 1.4, .05, .3)); p.append(box('gold', 0, -d / 2 - .05, 2.24, 1.1, .02, .2))
  # each bay shows the street its own gable (หน้าจั่ว) with ป้านลม and ช่อฟ้า: a row reads as a
  # rhythm of carved gables, and the low eaves never hide the open front from the game camera
  p += turn(thai_roof('roof', d + .1, w - .1, 3.0, 4.75, .3, 0, 0, end_mat='timber'), math.pi / 2)
  p.append(box('gold', 0, -d / 2 - .36, 3.35, .5, .04, .5, 0, .6))   # a gilt medallion in the gable
  aw = box('roofDark', 0, 0, 0, w - .2, .95, .06); aw.location = (0, -d / 2 - .42, 2.55); aw.rotation_euler = (-.3, 0, 0); p.append(aw)
  return piece('shophouse', p)

def make_lamp():
  """A lotus-bud street lamp (เสาโคมบัวตูม): stucco post, gold collar, glowing bud."""
  p = [box('brick', 0, 0, 0, .55, .55, .35), box('rim', 0, 0, .35, .45, .45, .1),
       lathe('cream', [(.14, 0), (.11, 2.1), (.16, 2.2)], 8, 0, 0, .45), lathe('gold', [(.2, 0), (.2, .08)], 8, 0, 0, 2.65)]
  p.append(lathe('lantern', [(0, 0), (.16, .05), (.22, .22), (.18, .42), (.08, .58), (0, .66)], 8, 0, 0, 2.73))
  for i in range(6):
    a = i / 6 * 2 * math.pi; leaf = slab('gold', [(-.07, 0), (.07, 0), (0, .3)], .02, math.cos(a) * .2, math.sin(a) * .2, 2.73, a + math.pi / 2, -.35); p.append(leaf)
  return piece('lamp', p)

def make_flag():
  """ธงตะขาบ: a tall red pole with a long gold-edged centipede banner."""
  p = [box('brick', 0, 0, 0, .5, .5, .3), cyl('red', 0, 0, .3, .07, 6.4, 6, .05), lathe('gold', [(0, 0), (.1, .1), (0, .4)], 6, 0, 0, 6.7)]
  p.append(beam('wood', (0, 0, 6.3), (.95, 0, 6.3), .03, 4))
  p.append(slab('cloth', [(.1, 6.25), (.85, 6.25), (.85, 2.6), (.1, 2.6)], .02))
  for i in range(7):
    z = 5.9 - i * .5
    for s in (0, 1): p.append(slab('red', [(-.0, 0), (.38, 0), (.38, -.08), (0, -.08)], .02, .1 - .38 if s == 0 else .85, 0, z))
  p.append(slab('red', [(.1, 2.6), (.85, 2.6), (.475, 2.1)], .02))
  return piece('flag', p)

def make_naga():
  """A rearing naga (นาค) balustrade end: coiled body on a plinth and a fan of five hooded heads."""
  p = [box('brick', 0, 0, 0, .9, 1.6, .5), box('rim', 0, 0, .5, 1.0, 1.7, .1)]
  pts = [(0, .7, .6), (0, .3, .75), (0, -.1, 1.05), (0, -.25, 1.5), (0, -.2, 1.95)]
  for a, b in zip(pts, pts[1:]): p.append(beam('cream', a, b, .2, 6, .18))
  hood = [(-.6, 0), (-.45, .35), (-.22, .6), (0, .7), (.22, .6), (.45, .35), (.6, 0), (0, -.15)]
  p.append(slab('gold', hood, .1, 0, -.15, 1.85))
  for i in range(5):
    a = (i - 2) * .45; hx, hz = math.sin(a) * .45, 2.35 + math.cos(a) * .3 - .3
    p.append(ball('cream', hx, -.3, hz, .12, .16, .11)); p.append(ball('gold', hx, -.4, hz + .08, .05))
  return piece('naga', p)

def make_elephant():
  """A stucco guardian elephant (ช้างปูนปั้น) on a brick plinth, facing −Y."""
  p = [box('dark', 0, 0, 0, 1.7, 2.9, .3), box('brickRed', 0, 0, .3, 1.5, 2.7, .45), box('rim', 0, 0, .75, 1.6, 2.8, .1)]
  p.append(ball('cream', 0, .1, 1.95, .62, 1.0, .68))
  for sx in (-1, 1):
    for sy in (-.55, .7): p.append(cyl('cream', sx * .36, sy, .85, .2, 1.05, 8, .17))
  p.append(ball('cream', 0, -.95, 2.25, .45, .45, .5))
  for s in (-1, 1): p.append(slab('cream', [(0, -.45), (.5, -.25), (.55, .3), (.05, .45)], .05, s * .38, -.8, 2.2, s * .5))
  trunk = [(0, -1.3, 2.15), (0, -1.45, 1.75), (0, -1.48, 1.3), (0, -1.38, 1.0), (0, -1.5, .9)]
  for i, (a, b) in enumerate(zip(trunk, trunk[1:])): p.append(beam('cream', a, b, .16 - i * .025, 6, .14 - i * .025))
  for s in (-1, 1): p.append(beam('rim', (s * .2, -1.25, 1.95), (s * .28, -1.7, 1.75), .05, 4, .015))
  p.append(slab('red', [(-.5, 0), (.5, 0), (.4, -.6), (-.4, -.6)], .9, 0, .1, 2.65))   # saddle cloth
  p.append(box('gold', 0, .1, 2.6, 1.05, .95, .06))
  return piece('elephant', p)

def make_planter():
  """A brick planter box (2.4 × 1.4) with a stucco rim and earth."""
  return piece('planter', [box('brick', 0, 0, 0, 2.4, 1.4, .5), box('rim', 0, 0, .5, 2.5, 1.5, .08), box('dark', 0, 0, .5, 2.2, 1.2, .1)])

def make_frangipani():
  """ลีลาวดี: a crooked forking trunk with leaf clusters and white flowers, ~3.4 m."""
  p = []; tips = [(.9, .3, 2.9), (-.8, .5, 3.0), (.2, -.9, 3.2), (-.3, .1, 3.5)]
  p.append(beam('bark', (0, 0, 0), (.1, 0, 1.4), .14, 6, .11))
  for t in tips:
    mid = (t[0] * .45 + .05, t[1] * .45, 2.0)
    p.append(beam('bark', (.1, 0, 1.35), mid, .1, 5, .08)); p.append(beam('bark', mid, t, .08, 5, .05))
    p.append(ball('leaf', t[0], t[1], t[2] + .2, .7, .7, .38))
    for k in range(4):
      a = k * 1.6 + t[0]; p.append(ball('rim', t[0] + math.cos(a) * .45, t[1] + math.sin(a) * .45, t[2] + .45, .09))
  return piece('frangipani', p)

def make_palm():
  """ต้นตาล: a tall sugar palm, ringed trunk and a round crown of fan leaves, ~8 m."""
  p = [cyl('bark', 0, 0, 0, .24, 7.0, 7, .19)]
  for z in (1.5, 3, 4.5, 6): p.append(cyl('dark', 0, 0, z, .25 - z * .008, .08, 7))
  disc = [(math.cos(a) * .85, math.sin(a) * .85) for a in [i / 9 * 2 * math.pi for i in range(9)]]
  for i in range(14):   # fan leaves on stalks, a round crown drooping below the top
    a = i / 14 * 2 * math.pi + (i % 2) * .2; up = (.9, .45, -.1, -.45)[i % 4]
    d = Vector((math.cos(a), math.sin(a), up)).normalized(); stalk = Vector((0, 0, 7.0)) + d * 1.1
    p.append(beam('bark', (0, 0, 7.0), tuple(stalk), .04, 4))
    f = slab('leafDark' if i % 3 == 0 else 'leaf', disc, .05)
    f.rotation_mode = 'QUATERNION'; f.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(d); f.location = stalk + d * .5
    p.append(f)
  p.append(ball('bark', 0, 0, 6.9, .45, .45, .4))
  return piece('palm', p)

def make_spirit_house():
  """ศาลพระภูมิ: a little gilded shrine on a stucco pillar with a tiered roof."""
  p = [box('brick', 0, 0, 0, .7, .7, .2), cyl('cream', 0, 0, .2, .14, 1.3, 8), box('cream', 0, 0, 1.5, 1.1, 1.1, .1),
       box('red', 0, 0, 1.6, .7, .6, .6), box('gold', 0, -.31, 1.65, .32, .02, .45)]
  for k, (w, z) in enumerate(((1.0, 2.2), (.7, 2.5))):
    p += thai_roof('roof' if k == 0 else 'jade', w * .9, w * .8, z, z + .3 + k * .05, .12, 0, 0, end_mat='gold', boards='gold')
  p.append(cyl('gold', 0, 0, 2.85, .04, .5, 4, .01))
  return piece('spirit_house', p)

PIECES = [make_sema, make_wall, make_bastion, make_gate, make_prang, make_chedi, make_shophouse,
          make_lamp, make_flag, make_naga, make_elephant, make_planter, make_frangipani, make_palm, make_spirit_house]
for i, make in enumerate(PIECES):
  bpy.context.scene.cursor.location = (0, 0, 0)
  o = make()

import os
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
  export_materials='EXPORT', export_normals=True, export_texcoords=False, use_selection=False)
# pack like every model under public/models (quantised + meshopt, names and materials kept)
import subprocess, shutil
tmp = OUT[:-4] + '.packed.glb'
r = subprocess.run(['npx', '-y', 'gltfpack', '-i', OUT, '-o', tmp, '-cc', '-kn', '-km'], capture_output=True, text=True)
if r.returncode == 0: shutil.move(tmp, OUT)
else: print('gltfpack unavailable, left unpacked:', r.stderr[-300:])
print('wrote', OUT, os.path.getsize(OUT), 'bytes,', len(PIECES), 'pieces:', ', '.join(o.name for o in bpy.data.objects))
