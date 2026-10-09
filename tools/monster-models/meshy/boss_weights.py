"""Offline explicit weights for measured Meshy HUMANOID boss surfaces.

All points/recipe joints are Blender metres (+Z up, -Y forward). No Blender,
network, auto weights, class retargeting, or side effects at import time.

boss_weights(points, indices, recipe) returns named, normalised <=4 influences.
Recipe: bones; legs [{name, upper?, lower?, foot?, pole, phase?}]; arms
[{name, upper?, lower?, hand?}]; tail [bone names]. Canonical names are inferred
only from each limb's explicit name, never from a monster's old species rig.
Optional roles map root/pelvis/body/head to bone names. Bone coordinates supply
hip/knee/joint/toe and shoulder/elbow/wrist, verified against any supplied joints.

weights.regions: [{name, type: cloth|hand|foot|tail|rigid, bone OR weights,
                  vertices: [original indices] OR bounds: {min, max}, feather?}]
Core selections are authoritative; bounds feather *outside* the core. Cloth
can use only Pelvis/Body roles, hand only Hand bones, feet only Foot bones,
and tail only its declared chain/Pelvis. UV copies cannot disagree on a pin.
New biped recipes may declare rigidBones: [{bone, purpose: wing|prop}]. Each
needs an authored single-bone rigid region; folded wings attach to Body or
another wing bone. These detail groups NEVER receive geodesic/diffused weights
outside their authored masks. Wing declarations are specific to Himmapan.
Optional weights.smoothIterations (24), diffusion (.30), jointBlend (.065),
handBlend (.035), quantization (64), seamDecimals (5). No surface is moved.
"""
import collections
import copy
import heapq
import math

TYPES = ('chalawan', 'bamboo_grave_3', 'sealed_mine_3', 'dusk_fort_3',
         'giant_valley_3', 'himmapan_3', 'fallen_city_3', 'demon_rift_3')


def vector(value, label='vector'):
    if not isinstance(value, (list, tuple)) or len(value) != 3 or any(
            isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in value):
        raise ValueError(f'{label} must contain three finite numbers')
    return tuple(float(v) for v in value)


def smooth(a, b, value):
    if b <= a:
        raise ValueError('Smooth interval must have positive length')
    t = max(0., min(1., (value - a) / (b - a)))
    return t * t * (3 - 2 * t)


def segment(point, bone):
    delta = tuple(b - a for a, b in zip(bone['head'], bone['tail']))
    length2 = sum(v * v for v in delta)
    if length2 <= 1e-12:
        raise ValueError(f"Zero length bone {bone['name']}")
    t = max(0., min(1., sum((p - a) * d for p, a, d in zip(point, bone['head'], delta)) / length2))
    nearest = tuple(a + t * d for a, d in zip(bone['head'], delta))
    return math.dist(point, nearest), t, math.sqrt(length2)


def validate_recipe(recipe, kind=None):
    """Return a normalised copy; fail before connecting on incorrect anatomy."""
    r = copy.deepcopy(recipe)
    if not isinstance(r, dict):
        raise ValueError('Anatomy recipe must be an object')
    kind = kind or r.get('type')
    if kind not in TYPES or r.get('type', kind) != kind:
        raise ValueError('Only approved measured biped bosses are supported; Naga requires a serpent rig')
    if r.get('taxon', 'humanoid-biped') not in ('humanoid-biped', 'biped'):
        raise ValueError('These approved sources require biped anatomy, not quadrupeds or serpents')
    if r.get('coordinateSystem', 'blender') not in ('blender', 'Blender metres: +Z up, -Y forward'):
        raise ValueError('Recipe joints must be measured in Blender +Z-up metres')
    r.update(type=kind, taxon='humanoid-biped', coordinateSystem='blender')
    height = r.get('sourceHeight', 1.9)
    if isinstance(height, bool) or not isinstance(height, (int, float)) or not math.isfinite(height) or abs(height - 1.9) > 1e-6:
        raise ValueError('The calibrated source clip space must be 1.9 metres')
    r['sourceHeight'] = height
    bones, named = r.get('bones'), {}
    if not isinstance(bones, list) or not bones:
        raise ValueError('Explicit bones are required')
    for bone in bones:
        name = bone.get('name')
        if not isinstance(name, str) or not name or name in named:
            raise ValueError('Bone names must be nonempty and unique')
        bone['head'] = list(vector(bone.get('head'), name + '.head'))
        bone['tail'] = list(vector(bone.get('tail'), name + '.tail'))
        if math.dist(bone['head'], bone['tail']) < .0001:
            raise ValueError(f'Nonpositive bone length: {name}')
        parent = bone.get('parent')
        if parent is not None and parent not in named:
            raise ValueError(f'{name}: parent must precede child')
        for flag, default in [('deform', True), ('connected', False)]:
            bone.setdefault(flag, default)
            if type(bone[flag]) is not bool:
                raise ValueError(f'{name}: {flag} must be boolean')
        if bone['connected'] and (parent is None or math.dist(bone['head'], named[parent]['tail']) > 1e-5):
            raise ValueError(f'{name}: connected head must meet parent tail')
        named[name] = bone
    roles = {'root': 'Root', 'pelvis': 'Pelvis', 'body': 'Body', 'head': 'Head'} | r.get('roles', {})
    if kind in TYPES[3:] and set(roles) != {'root', 'pelvis', 'body', 'head'}:
        raise ValueError('New biped roles are root/pelvis/body/head only; declare details in rigidBones')
    if any(name not in named for name in roles.values()):
        raise ValueError('Root/Pelvis/Body/Head roles must reference existing bones')
    if named[roles['root']]['deform'] or named[roles['root']]['parent'] is not None:
        raise ValueError('Root must be the nondeforming placement anchor')
    if any(not named[roles[role]]['deform'] for role in ('pelvis', 'body', 'head')):
        raise ValueError('Pelvis, Body and Head must deform')
    if named[roles['pelvis']]['parent'] != roles['root'] or named[roles['body']]['parent'] != roles['pelvis']:
        raise ValueError('Expected Root -> Pelvis -> Body spine hierarchy')
    if named[roles['head']]['parent'] != roles['body']:
        raise ValueError('Head must attach to Body in this measured biped cookbook')
    r['roles'] = roles
    used = set()
    for family, distal, joints in [('legs', 'foot', ('hip', 'knee', 'joint', 'toe')),
                                    ('arms', 'hand', ('shoulder', 'elbow', 'wrist', 'tip'))]:
        limbs = r.get(family)
        if not isinstance(limbs, list) or len(limbs) != 2:
            raise ValueError(f'Exactly two measured {family} are required')
        for index, limb in enumerate(limbs):
            if not isinstance(limb.get('name'), str) or not limb['name']:
                raise ValueError('Each limb needs an explicit name')
            for key, suffix in [('upper', 'Upper'), ('lower', 'Lower'), (distal, 'Foot' if distal == 'foot' else '')]:
                default = limb['name'] + suffix if suffix else 'Hand' + limb['name'][-1]
                limb.setdefault(key, default)
                if limb[key] not in named or not named[limb[key]]['deform'] or limb[key] in used:
                    raise ValueError(f"Invalid/reused limb bone: {limb[key]}")
                used.add(limb[key])
            upper, lower, end = (named[limb[k]] for k in ('upper', 'lower', distal))
            if lower['parent'] != upper['name'] or end['parent'] != lower['name']:
                raise ValueError('Limb hierarchy must be upper -> lower -> distal block')
            if math.dist(upper['tail'], lower['head']) > 1e-5 or math.dist(lower['tail'], end['head']) > 1e-5:
                raise ValueError('Measured limb segments must meet without a gap')
            if family == 'legs' and upper['parent'] != roles['pelvis']:
                raise ValueError('Biped legs must attach to the pelvis')
            if family == 'arms' and upper['parent'] != roles['body']:
                raise ValueError('Biped arms must attach to Body')
            for key, location in zip(joints, [upper['head'], lower['head'], end['head'], end['tail']]):
                supplied = limb.get(key, limb.get('ankle') if key == 'joint' else None)
                if supplied is not None and math.dist(vector(supplied, key), location) > 1e-5:
                    raise ValueError(f'{limb["name"]}.{key} disagrees with measured bones')
                limb[key] = list(location)
            if family == 'legs':
                limb['pole'] = list(vector(limb.get('pole'), 'pole'))
                axis = [b - a for a, b in zip(limb['hip'], limb['joint'])]
                pole = [b - a for a, b in zip(limb['hip'], limb['pole'])]
                cross = [axis[1]*pole[2]-axis[2]*pole[1], axis[2]*pole[0]-axis[0]*pole[2], axis[0]*pole[1]-axis[1]*pole[0]]
                if sum(v*v for v in cross) < 1e-10:
                    raise ValueError('IK pole must not be collinear with the leg')
                limb.setdefault('phase', index * .5)
                if isinstance(limb['phase'], bool) or not isinstance(limb['phase'], (int, float)) or not math.isfinite(limb['phase']):
                    raise ValueError('Leg phase must be finite')
    tail = [item if isinstance(item, str) else item.get('bone') for item in r.get('tail', [])]
    if (kind == 'chalawan' and len(tail) < 2) or (kind != 'chalawan' and tail):
        raise ValueError('Only the Chalawan humanoid requires a dedicated tail chain (>=2 bones)')
    parent = roles['pelvis']
    for name in tail:
        if name not in named or name in used or not named[name]['deform'] or named[name]['parent'] != parent:
            raise ValueError('Tail must form one unbranched chain rooted at Pelvis')
        used.add(name); parent = name
    r['tail'] = tail
    # Detail bones need explicit semantic ownership, never a distance fallback.
    described = used | set(roles.values())
    rigid = r.get('rigidBones', [])
    if not isinstance(rigid, list) or (rigid and kind in TYPES[:3]):
        raise ValueError('Rigid detail declarations are available only for the new biped batch')
    rigid_names, wing_names = set(), set()
    for detail in rigid:
        if not isinstance(detail, dict) or set(detail) != {'bone', 'purpose'}:
            raise ValueError('Rigid detail requires {bone, purpose: wing|prop}')
        name, purpose = detail['bone'], detail['purpose']
        if name not in named or name in described or name in rigid_names or not named[name]['deform']:
            raise ValueError('Rigid details must reference distinct extra deform bones')
        if purpose not in ('wing', 'prop'):
            raise ValueError('Extra deform bones are only authored wing/prop details')
        parent = named[name]['parent']
        if parent not in (described - {roles['root']}) | rigid_names or not named[parent]['deform']:
            raise ValueError('Rigid details must attach to an authored deform anchor')
        if purpose == 'wing':
            if kind != 'himmapan_3' or parent not in {roles['body']} | wing_names:
                raise ValueError('Himmapan folded wings must attach to Body or an earlier wing bone')
            wing_names.add(name)
        rigid_names.add(name)
    if any(b['deform'] and b['name'] not in described | rigid_names for b in bones):
        raise ValueError('Every deform bone needs a spine/limb/tail role or authored rigid detail')
    options = {'smoothIterations': 24, 'diffusion': .30, 'jointBlend': .065,
               'handBlend': .035, 'quantization': 64, 'seamDecimals': 5, 'regions': []} | r.get('weights', {})
    for key, low, high in [('smoothIterations', 0, 120), ('quantization', 8, 1024), ('seamDecimals', 4, 8)]:
        if type(options[key]) is not int or not low <= options[key] <= high:
            raise ValueError(f'Invalid {key}')
    for key, low, high in [('diffusion', 0, .5), ('jointBlend', .005, .20), ('handBlend', .005, .12)]:
        if isinstance(options[key], bool) or not isinstance(options[key], (int, float)) or not math.isfinite(options[key]) or not low <= options[key] <= high:
            raise ValueError(f'Invalid {key}')
    r['weights'] = options
    covered = set()
    for region in options['regions']:
        targets = region.get('weights', {region.get('bone'): 1.})
        if not isinstance(targets, dict):
            raise ValueError('Region weights must be an object')
        extra = rigid_names & targets.keys()
        if extra:
            if region.get('type', 'rigid') != 'rigid' or len(targets) != 1:
                raise ValueError('Extra detail bones require single-bone rigid regions')
            if ('vertices' in region) == ('bounds' in region) or ('vertices' in region and not region['vertices']):
                raise ValueError('Rigid detail region needs a nonempty original-index or bounds selector')
            covered.update(extra)
    if covered != rigid_names:
        raise ValueError('Every rigid detail bone needs its own authored rigid region')
    return r


def quantize(weights, names, divisions=64):
    selected = sorted(((name, value) for name, value in weights.items() if value > 1e-12),
                      key=lambda item: (-item[1], names.index(item[0])))[:4]
    total = sum(v for _, v in selected)
    if not math.isfinite(total) or total <= 0:
        raise ValueError('Every vertex must retain a positive deform weight')
    raw = [(name, value / total * divisions) for name, value in selected]
    counts = {name: math.floor(value) for name, value in raw}
    for name, _ in sorted(raw, key=lambda item: (-(item[1] % 1), names.index(item[0])))[:divisions - sum(counts.values())]:
        counts[name] += 1
    return {name: count / divisions for name, count in counts.items() if count}


def boss_weights(points, indices, bones_or_recipe, recipe=None):
    """Compatible with recipe-only or (points, indices, bones, recipe) callers."""
    if recipe is None:
        recipe = bones_or_recipe
    else:
        recipe = copy.deepcopy(recipe); recipe['bones'] = bones_or_recipe
    r = validate_recipe(recipe)
    points = [vector(p, 'surface vertex') for p in points]
    if not points or len(indices) % 3 or any(type(i) is not int or i < 0 or i >= len(points) for i in indices):
        raise ValueError('Expected nonempty points and valid triangle indices')
    options, roles = r['weights'], r['roles']
    keys = [tuple(round(v, options['seamDecimals']) for v in p) for p in points]
    lookup, unique, remap = {}, [], []
    for key, point in zip(keys, points):
        if key not in lookup:
            lookup[key] = len(unique); unique.append(point)
        remap.append(lookup[key])
    graph = [{} for _ in unique]
    for start in range(0, len(indices), 3):
        tri = [remap[v] for v in indices[start:start + 3]]
        for a, b in zip(tri, tri[1:] + tri[:1]):
            if a != b:
                graph[a][b] = graph[b][a] = max(1e-8, math.dist(unique[a], unique[b]))
    deform = [b for b in r['bones'] if b['deform']]
    names = [b['name'] for b in deform]; named = {b['name']: b for b in r['bones']}
    distances = {b['name']: [segment(p, b) for p in unique] for b in deform}
    hips = [leg['hip'] for leg in r['legs']]
    centre_x, hip_z = sum(p[0] for p in hips)/2, sum(p[2] for p in hips)/2
    tail_names = set(r['tail'])
    rigid_names = tuple(d['bone'] for d in r.get('rigidBones', []))
    rigid_set = set(rigid_names)
    rigid_anchors = {}
    for name in rigid_names:
        parent = named[name]['parent']
        while parent in rigid_names:
            parent = named[parent]['parent']
        rigid_anchors[name] = parent

    def same_side(p, reference):
        return (p[0] - centre_x) * (reference[0] - centre_x) >= -.001

    def allowed(vi, name):
        p, bone = unique[vi], named[name]
        if name in rigid_names:
            return False
        if name == roles['head']:
            return p[2] > bone['head'][2] - .10
        for leg in r['legs']:
            if name in [leg[k] for k in ('upper', 'lower', 'foot')]:
                return p[2] < leg['hip'][2] + .075 and same_side(p, leg['hip'])
        for arm in r['arms']:
            if name in [arm[k] for k in ('upper', 'lower', 'hand')]:
                return same_side(p, arm['shoulder']) and min(distances[arm[k]][vi][0] for k in ('upper', 'lower', 'hand')) < .22
        if name in tail_names:
            base = named[r['tail'][0]]['head']
            return p[1] > base[1] - .075 and min(distances[n][vi][0] for n in tail_names) < .22
        return True

    # Anatomically restricted geodesic seeds and disconnected-shell fallback.
    fields = []
    for name in names:
        seed = {}
        eligible = [i for i in range(len(unique)) if allowed(i, name)]
        b = named[name]
        for fraction in (0, .25, .5, .75, 1):
            sample = tuple(a + (z-a)*fraction for a, z in zip(b['head'], b['tail']))
            for vi in heapq.nsmallest(3, eligible, key=lambda i: math.dist(unique[i], sample)):
                seed[vi] = min(seed.get(vi, math.inf), distances[name][vi][0])
        fields.append(seed)
    components, visited = [], set()
    for start in range(len(unique)):
        if start in visited:
            continue
        stack, component = [start], []
        while stack:
            vi = stack.pop()
            if vi in visited:
                continue
            visited.add(vi); component.append(vi); stack.extend(graph[vi])
        components.append(component)
    for component in components:
        # A disconnected shell can span several anatomical regions (e.g. a
        # trouser/torso strip). One leg seed alone leaves its upper vertices
        # without an admissible label. Seed each admissible field on that shell.
        for name, seed in zip(names, fields):
            if any(i in seed for i in component):
                continue
            candidates = [i for i in component if allowed(i, name)]
            if candidates:
                vi = min(candidates, key=lambda i: distances[name][i][0])
                seed[vi] = distances[name][vi][0]
    geodesic = []
    for seed in fields:
        distance, queue = [math.inf]*len(unique), []
        for vi, cost in seed.items():
            distance[vi] = cost; heapq.heappush(queue, (cost, vi))
        while queue:
            cost, vi = heapq.heappop(queue)
            if cost != distance[vi]:
                continue
            for neighbour, edge in graph[vi].items():
                candidate = cost + edge
                if candidate < distance[neighbour]:
                    distance[neighbour] = candidate; heapq.heappush(queue, (candidate, neighbour))
        geodesic.append(distance)
    values = []
    for vi in range(len(unique)):
        bi = min(range(len(names)), key=lambda i: geodesic[i][vi] if allowed(vi, names[i]) else math.inf)
        if not math.isfinite(geodesic[bi][vi]):
            raise ValueError('Every shell requires an admissible anatomical seed')
        values.append({names[bi]: 1.})

    pins = [[] for _ in unique]
    hard = {}
    rigid_core = set()
    for region in options['regions']:
        kind = region.get('type', 'rigid')
        targets = region.get('weights', {region.get('bone', roles['pelvis'] if kind == 'cloth' else None): 1.})
        if not isinstance(targets, dict) or any(n not in names or isinstance(v, bool) or not isinstance(v, (int, float))
                or not math.isfinite(v) or v <= 0 for n, v in targets.items()) or len(targets) > 4:
            raise ValueError('Region weights need <=4 existing positive deform influences')
        permitted = {'cloth': {roles['pelvis'], roles['body']}, 'hand': {a['hand'] for a in r['arms']},
                     'foot': {l['foot'] for l in r['legs']}, 'tail': tail_names | {roles['pelvis']}, 'rigid': set(names)}
        if kind not in permitted or not set(targets) <= permitted[kind]:
            raise ValueError(f'{kind}: region violates anatomical ownership')
        targets = {name: weight/sum(targets.values()) for name, weight in targets.items()}
        if ('vertices' in region) == ('bounds' in region):
            raise ValueError('Region requires exactly one original-index or bounds selector')
        feather = region.get('feather', 0.)
        if isinstance(feather, bool) or not isinstance(feather, (int, float)) or not math.isfinite(feather) or not 0 <= feather <= .15:
            raise ValueError('Invalid region feather')
        if 'vertices' in region:
            ids = region['vertices']
            if any(type(i) is not int or not 0 <= i < len(points) for i in ids):
                raise ValueError('Region vertex indices are topology-bound original indices')
            selected = {remap[i]: 1. for i in ids}
        else:
            low, high = vector(region['bounds']['min']), vector(region['bounds']['max'])
            if any(a > b for a, b in zip(low, high)):
                raise ValueError('Invalid region bounds')
            selected = {}
            for vi, p in enumerate(unique):
                outside = max(max(a-v, v-b, 0.) for a, b, v in zip(low, high, p))
                if outside == 0 or (feather and outside < feather):
                    selected[vi] = 1. if outside == 0 else 1 - smooth(0, feather, outside)
        for vi, strength in selected.items():
            if strength == 1 and vi in hard and hard[vi] != targets:
                raise ValueError('Conflicting hard regions/UV seam pins')
            if strength == 1:
                hard[vi] = targets
            pins[vi].append((targets, strength))
            if strength == 1:
                rigid_core.update(rigid_set & targets.keys())
    if rigid_core != rigid_set:
        raise ValueError('Each rigid detail region must select actual source vertices in its core')

    def project(vi, weight):
        p = unique[vi]; w = dict(weight)
        # Remove diffused detail mass first; only the authored pins below may
        # reintroduce it. Preserve that mass on its explicit skeletal ancestor.
        for name in rigid_names:
            anchor = rigid_anchors[name]
            w[anchor] = w.get(anchor, 0.) + w.pop(name, 0.)
        # Diffusion cannot drag the chest with a thigh or cross the body's midline.
        for leg in r['legs']:
            total = sum(w.pop(leg[k], 0.) for k in ('upper', 'lower', 'foot'))
            keep = (1 - smooth(leg['hip'][2]-.055, leg['hip'][2]+.075, p[2])) if same_side(p, leg['hip']) else 0.
            w[roles['pelvis']] = w.get(roles['pelvis'], 0.) + total*(1-keep)
            total *= keep
            thigh = smooth(leg['knee'][2]-options['jointBlend'], leg['knee'][2]+options['jointBlend'], p[2])
            sole = 1 - smooth(leg['joint'][2]+.005, leg['joint'][2]+.09, p[2])
            w[leg['upper']] = total*thigh; w[leg['lower']] = total*(1-thigh)*(1-sole); w[leg['foot']] = total*(1-thigh)*sole
        for arm in r['arms']:
            order = [arm[k] for k in ('upper', 'lower', 'hand')]
            total = sum(w.pop(n, 0.) for n in order)
            distance, closest = min((distances[n][vi][0], i) for i, n in enumerate(order))
            torso_distance = min(distances[roles[n]][vi][0] for n in ('body', 'pelvis'))
            retain = smooth(-.025, .045, torso_distance-distance) if same_side(p, arm['shoulder']) else 0.
            w[roles['body']] = w.get(roles['body'], 0.) + total*(1-retain); total *= retain
            lengths = [distances[n][vi][2] for n in order]
            along = sum(lengths[:closest]) + distances[order[closest]][vi][1]*lengths[closest]
            elbow = smooth(lengths[0]-options['jointBlend'], lengths[0]+options['jointBlend'], along)
            wrist = smooth(sum(lengths[:2])-options['handBlend'], sum(lengths[:2])+.004, along)
            w[order[0]] = total*(1-elbow); w[order[1]] = total*elbow*(1-wrist); w[order[2]] = total*elbow*wrist
            # The distal hand, including finger details, stays one rigid block.
            d, t, length = distances[arm['hand']][vi]
            axis = [(b-a)/length for a, b in zip(named[arm['hand']]['head'], named[arm['hand']]['tail'])]
            signed = sum((v-a)*u for v, a, u in zip(p, named[arm['hand']]['head'], axis))
            pin = smooth(-options['handBlend'], .005, signed)*(1-smooth(.085, .13, d))*retain
            w = {n: v*(1-pin) for n, v in w.items()}; w[arm['hand']] = w.get(arm['hand'], 0.) + pin
        torso = w.get(roles['body'], 0.) + w.get(roles['pelvis'], 0.)
        spine = smooth(hip_z+.025, hip_z+.22, p[2])
        w[roles['body']] = torso*spine; w[roles['pelvis']] = torso*(1-spine)
        if tail_names:
            chain = r['tail']; distance, closest = min((distances[n][vi][0], i) for i, n in enumerate(chain))
            other = min(distances[n][vi][0] for n in names if n not in tail_names)
            behind = smooth(named[chain[0]]['head'][1]-.045, named[chain[0]]['head'][1]+.045, p[1])
            pin = behind*(1-smooth(.13, .22, distance))*smooth(-.02, .06, other-distance)
            existing = sum(w.pop(n, 0.) for n in chain)
            mass = existing + (1-existing)*pin
            w = {n: v*(1-pin) for n, v in w.items()}
            lengths = [distances[n][vi][2] for n in chain]
            along = sum(lengths[:closest]) + distances[chain[closest]][vi][1]*lengths[closest]
            mix = {}
            for i, n in enumerate(chain):
                start, end = sum(lengths[:i]), sum(lengths[:i+1])
                lo = 1 if i == 0 else smooth(start-.045, start+.045, along)
                hi = 1 if i == len(chain)-1 else 1-smooth(end-.045, end+.045, along)
                mix[n] = lo*hi
            normal = sum(mix.values())
            for n, v in mix.items():
                w[n] = mass*v/normal
        # Lower heel/toes must not inherit a lower-leg bend through diffusion.
        leg = min(r['legs'], key=lambda l: distances[l['foot']][vi][0])
        distance = distances[leg['foot']][vi][0]
        tail_distance = min((distances[n][vi][0] for n in tail_names), default=math.inf)
        pin = (1-smooth(leg['joint'][2]-.005, leg['joint'][2]+.045, p[2]))*(1-smooth(.115, .16, distance))
        if not same_side(p, leg['hip']) or tail_distance < distance:
            pin = 0.
        w = {n: v*(1-pin) for n, v in w.items()}; w[leg['foot']] = w.get(leg['foot'], 0.) + pin
        for targets, strength in pins[vi]:
            w = {n: v*(1-strength) for n, v in w.items()}
            for n, v in targets.items():
                w[n] = w.get(n, 0.) + v*strength
        total = sum(w.values())
        if total <= 0 or not math.isfinite(total):
            raise ValueError('Invalid anatomical projection')
        return {n: v/total for n, v in w.items() if v > 1e-12}

    values = [project(i, w) for i, w in enumerate(values)]
    for _ in range(options['smoothIterations']):
        result = []
        for vi, weight in enumerate(values):
            if vi in hard:
                result.append(hard[vi]); continue
            if not graph[vi]:
                result.append(weight); continue
            average = collections.defaultdict(float); normal = sum(1/edge for edge in graph[vi].values())
            for neighbour, edge in graph[vi].items():
                for name, v in values[neighbour].items():
                    average[name] += v/edge/normal
            blended = {n: weight.get(n, 0.)*(1-options['diffusion']) + average.get(n, 0.)*options['diffusion']
                       for n in weight.keys() | average.keys()}
            result.append(project(vi, blended))
        values = result
    result = [quantize(project(i, w), names, options['quantization']) for i, w in enumerate(values)]
    return [dict(result[i]) for i in remap]
