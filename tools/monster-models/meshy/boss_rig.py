"""Staged registered-Harness rig pipeline for approved Meshy biped bosses.

No connection, filesystem write, or window mutation on import. Never uses bpy,
automatic weights, paid services, retargeting, or unregistered scene commands.

Environment: MESHY_RIG_OUTPUT (default artifacts/meshy-boss-01), plus the
existing harness_client's BLENDER_DESIGN_ROOT/BLENDER_SESSION_DESCRIPTOR.
Input: OUT/input/TYPE.glb, TYPE-positions.json (glTF +Y up), TYPE-indices.json,
TYPE-anatomy.json (boss_weights recipe in Blender +Z up, -Y forward; height 1.9).

Commands:
  python boss_rig.py plan TYPE                 # offline, prints weight summary
  python boss_rig.py bind TYPE                 # registered import/bind/weights
  python boss_rig.py export TYPE rest          # snapshot-bound rest GLB job
  # Parent derives TYPE-calibration.json from that exact rest export, then:
  python boss_rig.py animate TYPE
  python boss_rig.py export TYPE final-v1       # GLB + packed editable BLEND
  python boss_rig.py collect TYPE final-v1      # recorded identities only
  python boss_rig.py recover TYPE final-v1      # job.recover, NEVER resume/POST
  python boss_rig.py reweight TYPE             # same topology/bones, edited masks
  python boss_rig.py applyweights TYPE WEIGHTS_JSON

Foot calibration: {restGlbSha256, anatomySha256, legs: {LIMB_NAME:
  {rotation: [Blender Euler radians], poleAngle: radians}}, rootDownLocal: [..],
  tailUpLocal: [..] (Chalawan only), arms: {ARM_NAME: {upperAxis, upperSign,
  lowerAxis, lowerSign, upperRestRotation?: [x,y,z], lowerRestRotation?: [x,y,z]}}}.
Consolidated OUT/calibration.json keyed by TYPE is
also accepted. Rest-calibrated arm axes/signs override recipe defaults without
changing the anatomy hash. Axis indices are 0..2; signs are +/-1.

Recipe motion permits bounded shoulderCast<=1.0, elbowCast<=.4, bodyCast<=.08,
bodyDeath<=.6, deathDrop<=.28, walkStride<=.09, walkLift<=.07, tailSway<=.08.
Death is an authored bow/crouch with planted feet; these authoring ranges do
not relax deformation, limb, foot or floor validation. Chalawan uses a small
root drop to preserve the grounded tail junction.
The default stride/lift scale with actual measured leg lengths. Five timeline
ranges match rig_wat.py. Parent's bake/slice stage creates five runtime clips;
a single Harness timeline export is not falsely labelled a five-clip GLB.

All stage receipts/weight caches stay in OUT, never in parent source files.
Export journals reserve job IDs before dispatch; unknown responses are recovered
by the SAME ID. Existing completed artifacts are checked, never overwritten.
"""
import argparse
import collections
import hashlib
import importlib
import json
import math
import os
from pathlib import Path
import re
import struct
import sys
import time
import uuid

if __package__:
    from .boss_weights import TYPES, boss_weights, smooth, validate_recipe, vector
else:
    from boss_weights import TYPES, boss_weights, smooth, validate_recipe, vector

PREFIXES = {'chalawan': 'ChalawanBossV1', 'bamboo_grave_3': 'BambooGraveBossV1',
            'sealed_mine_3': 'SealedMineBossV1', 'dusk_fort_3': 'DuskFortBossV1',
            'giant_valley_3': 'GiantValleyBossV1', 'himmapan_3': 'HimmapanBossV1',
            'fallen_city_3': 'FallenCityBossV1', 'demon_rift_3': 'DemonRiftBossV1'}
CLIPS = {'idle': [1, 49], 'walk': [51, 75], 'attack': [81, 105], 'hurt': [111, 121], 'die': [131, 155]}
FRAMES = sorted({1, 13, 25, 37, 49, *range(51, 76, 2), 75, 81, 85, 89, 92, 96,
                 101, 105, 111, 114, 117, 121, 131, 137, 143, 149, 155})


def output_root(out=None):
    return Path(out or os.environ.get('MESHY_RIG_OUTPUT', 'artifacts/meshy-boss-01')).resolve()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def write_json(path, payload, exclusive=False):
    """Flush journal/receipt before dispatch; atomic replacements within OUT."""
    path = Path(path)
    data = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    if exclusive:
        with path.open('x', encoding='utf-8') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        return
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temporary.open('x', encoding='utf-8') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def harness():
    # harness_client loads its descriptor at import: defer it until a live stage.
    parent = str(Path(__file__).resolve().parents[1])
    if parent not in sys.path:
        sys.path.insert(0, parent)
    return importlib.import_module('harness_client')


def load_inputs(kind, out=None):
    if kind not in TYPES:
        raise ValueError('Only approved measured biped bosses are supported; Naga requires a serpent rig')
    root = output_root(out); source = root/'input'
    paths = {label: source/f'{kind}{suffix}' for label, suffix in {
        'source': '.glb', 'positions': '-positions.json', 'indices': '-indices.json', 'anatomy': '-anatomy.json'}.items()}
    recipe = validate_recipe(read_json(paths['anatomy']), kind)
    points = [(x, -z, y) for x, y, z in (vector(p, 'glTF vertex') for p in read_json(paths['positions']))]
    if not points or abs(max(p[2] for p in points)-min(p[2] for p in points)-1.9) > .005 or abs(min(p[2] for p in points)) > .001:
        raise ValueError('Parent must normalise and ground the actual source to 1.9m before measuring the recipe')
    indices = read_json(paths['indices'])
    values = boss_weights(points, indices, recipe)
    prefix = recipe.get('prefix', PREFIXES[kind])
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{0,55}', prefix):
        raise ValueError('Invalid instance prefix')
    return dict(type=kind, root=root, recipe=recipe, points=points, indices=indices, values=values,
                prefix=prefix, rig=prefix+'Rig', surface=prefix+'Surface',
                hashes={name: sha(path) for name, path in paths.items()}, paths=paths)


def weight_summary(values):
    return {'vertices': len(values), 'maxInfluences': max(map(len, values)),
            'maxSumError': max(abs(sum(w.values())-1) for w in values),
            'boneVertices': dict(collections.Counter(n for w in values for n in w)),
            'weightGroups': len({(n, v) for w in values for n, v in w.items()})}


def check_weights(values, points, recipe, rigid_reference=None):
    allowed = {b['name'] for b in recipe['bones'] if b['deform']}
    if len(values) != len(points):
        raise ValueError('Weights must retain the input topology/vertex ordering')
    for weight in values:
        if not isinstance(weight, dict) or not 1 <= len(weight) <= 4 or any(n not in allowed or isinstance(v, bool)
                or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 < v <= 1 for n, v in weight.items()) or abs(sum(weight.values())-1) > 1e-8:
            raise ValueError('Expected 1..4 finite positive normalised deform influences')
    details = [d['bone'] for d in recipe.get('rigidBones', [])]
    if details and (rigid_reference is None or len(rigid_reference) != len(values) or any(
            weight.get(name, 0.) != reference.get(name, 0.)
            for weight, reference in zip(values, rigid_reference) for name in details)):
        raise ValueError('Explicit weight overrides must preserve authored rigid detail masks')


def bind(kind, out=None, reweight=False, weights_file=None, client=None):
    inputs = load_inputs(kind, out); root, recipe = inputs['root'], inputs['recipe']
    report_path, cache_path = root/f'{kind}-rig-report.json', root/f'{kind}-applied-weights.json'
    if report_path.exists() and not reweight:
        raise FileExistsError('Already bound: inspect the report or explicitly reweight, never import a duplicate rig')
    previous = read_json(report_path) if reweight else {}
    before = read_json(cache_path) if reweight else None
    if reweight and (previous['inputHashes']['positions'] != inputs['hashes']['positions'] or
                     previous['inputHashes']['indices'] != inputs['hashes']['indices'] or
                     previous['inputHashes']['source'] != inputs['hashes']['source'] or
                     previous['bones'] != recipe['bones'] or previous['rigName'] != inputs['rig']):
        raise ValueError('Reweighting requires the exact existing topology, source and skeleton')
    if reweight and sha(cache_path) != previous['appliedWeightsSha256']:
        raise ValueError('Applied-weight cache no longer matches the last committed bind')
    values = read_json(weights_file) if weights_file else inputs['values']
    check_weights(values, inputs['points'], recipe, rigid_reference=inputs['values'])
    if before is not None and len(before) != len(values):
        raise ValueError('Applied-weight cache has the wrong topology')
    changed = [i for i, w in enumerate(values) if before is None or w != before[i]]
    groups = collections.defaultdict(list)
    for i in changed:
        for name, weight in values[i].items():
            groups[name, weight].append(i)
    client = client or harness(); client.call('scene.inspect')
    m = client.Milestone(kind+'-boss-bind')
    try:
        if not reweight:
            imported = m.mutate('asset.import_file', {'path': str(inputs['paths']['source'])})
            name = recipe.get('sourceName', kind+'Source')
            matches = [o for o in imported['objects'] if o['name'] == name]
            if len(matches) != 1:
                raise ValueError('Expected exactly the unpacked named source mesh; do not choose an arbitrary imported object')
            m.mutate('object.rename', {'name': name, 'newName': inputs['surface']})
        topology = m.mutate('mesh.inspect', {'name': inputs['surface'], 'allowOpenSurface': True})
        if topology['counts']['vertices'] != len(inputs['points']):
            raise ValueError('Imported surface and decoded weight topology differ')
        if reweight:
            rig_id = previous['rigId']
        else:
            rig_id = m.mutate('rig.create_armature', {'name': inputs['rig'], 'bones': recipe['bones']})['objectId']
            m.mutate('rig.bind', {'mesh': {'name': inputs['surface']}, 'armature': {'name': inputs['rig']}})
        if reweight and changed:
            selection = m.mutate('mesh.select', {'name': inputs['surface'], 'method': 'indices', 'vertices': changed})
            for b in recipe['bones']:
                if b['deform']:
                    m.mutate('rig.assign_weights', {'mesh': {'name': inputs['surface']}, 'bone': b['name'], 'selection': selection, 'weight': 0})
        for (name, weight), vertices in sorted(groups.items()):
            selection = m.mutate('mesh.select', {'name': inputs['surface'], 'method': 'indices', 'vertices': vertices})
            m.mutate('rig.assign_weights', {'mesh': {'name': inputs['surface']}, 'bone': name, 'selection': selection, 'weight': weight})
        skin = m.mutate('rig.inspect', {'name': inputs['rig']})
        if set(skin['boundMeshes']) != {inputs['surface']} or any(not math.isfinite(b['length']) or b['length'] <= 0 for b in skin['bones']):
            raise ValueError('Rig receipt must contain one bound surface and positive finite bones')
        snapshot = m.commit()
    except Exception:
        m.rollback(); raise
    write_json(cache_path, values)
    report = previous | {'type': kind, 'taxon': 'humanoid-biped', 'version': 'boss-v1',
        'rigName': inputs['rig'], 'surfaceName': inputs['surface'], 'prefix': inputs['prefix'], 'rigId': rig_id,
        'bones': recipe['bones'], 'legs': previous.get('legs', recipe['legs']), 'arms': recipe['arms'], 'tail': recipe['tail'],
        'rigidBones': recipe.get('rigidBones', []),
        'inputHashes': inputs['hashes'], 'weightsAlgorithmSha256': sha(Path(__file__).with_name('boss_weights.py')),
        'appliedWeightsSha256': sha(cache_path), 'weights': weight_summary(values), 'skin': skin,
        'snapshotId': snapshot, 'sceneRevision': m.revision}
    if reweight:
        report['requiresFreshExportAndQA'] = True
    write_json(report_path, report)
    return report


def motion_options(recipe):
    named = {b['name']: b for b in recipe['bones']}
    leg_length = min(sum(math.dist(named[l[k]]['head'], named[l[k]]['tail']) for k in ('upper', 'lower')) for l in recipe['legs'])
    defaults = {'shoulderCast': .90, 'elbowCast': .35, 'bodyCast': .045, 'bodyDeath': .10,
                'deathDrop': .035, 'walkStride': min(.06, leg_length*.075),
                'walkLift': min(.045, leg_length*.06), 'tailSway': .035,
                'bodyHurt': .025, 'headHurt': .012}
    options = defaults | recipe.get('motion', {})
    caps = {'shoulderCast': 1., 'elbowCast': .4, 'bodyCast': .08, 'bodyDeath': .6,
            'deathDrop': .28, 'walkStride': .09, 'walkLift': .07, 'tailSway': .08,
            'bodyHurt': .20, 'headHurt': .12}
    if set(options) != set(caps):
        raise ValueError('Unknown motion parameter')
    for name, cap in caps.items():
        v = options[name]
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= cap:
            raise ValueError(f'{name} exceeds the modest authored motion range')
    return options


def pose_at(frame, recipe, calibration):
    """Pure timeline recipe. Foot targets change ONLY in the walk interval."""
    recipe = validate_recipe(recipe); options = motion_options(recipe); roles = recipe['roles']
    if type(frame) is not int or not 1 <= frame <= 155:
        raise ValueError('Expected an authored frame in 1..155')
    rotations = {b['name']: [0., 0., 0.] for b in recipe['bones']}
    wave = strike = wind = recoil = settle = 0.
    if frame <= 49:
        wave = math.sin((frame-1)/48*math.tau)
    elif 51 <= frame <= 75:
        wave = math.sin((frame-51)/24*math.tau)
    elif 81 <= frame <= 105:
        t = (frame-81)/24
        wind = math.sin(math.pi*max(0., min(1., t/.42)))
        strike = math.sin(math.pi*max(0., min(1., (t-.27)/.55)))
    elif 111 <= frame <= 121:
        recoil = math.sin(math.pi*(frame-111)/10)
    elif frame >= 131:
        settle = smooth(0, 1, (frame-131)/24)
    rotations[roles['body']][0] = .004*wave - .018*wind + options['bodyCast']*strike - options['bodyHurt']*recoil + options['bodyDeath']*settle
    rotations[roles['head']] = [-options['headHurt']*recoil + .25*settle, .012*wave, 0.]
    root_down = vector(calibration['rootDownLocal'], 'rootDownLocal')
    root_location = [v*options['deathDrop']*settle for v in root_down]
    locations = {roles['root']: root_location}
    for index, arm in enumerate(recipe['arms']):
        measured = arm | calibration.get('arms', {}).get(arm['name'], {})
        upper_axis, lower_axis = measured.get('upperAxis', 0), measured.get('lowerAxis', 0)
        upper_sign, lower_sign = measured.get('upperSign', -1), measured.get('lowerSign', 1)
        if type(upper_axis) is not int or type(lower_axis) is not int or upper_axis not in (0, 1, 2) or lower_axis not in (0, 1, 2) or isinstance(upper_sign, bool) or isinstance(lower_sign, bool) or upper_sign not in (-1, 1) or lower_sign not in (-1, 1):
            raise ValueError('Measured arm axes/signs must be local indices and +/-1')
        rotations[arm['upper']] = list(vector(measured.get('upperRestRotation', [0., 0., 0.]), 'upperRestRotation'))
        rotations[arm['lower']] = list(vector(measured.get('lowerRestRotation', [0., 0., 0.]), 'lowerRestRotation'))
        walk = .065*wave*(1 if index == 0 else -1) if 51 <= frame <= 75 else 0.
        rotations[arm['upper']][upper_axis] += max(-1., min(1.,
            upper_sign*options['shoulderCast']*strike + .045*wind + walk + .035*settle))
        rotations[arm['lower']][lower_axis] += lower_sign*options['elbowCast']*strike + .045*settle
        outward = arm.get('castOutward', 0.)
        if isinstance(outward, bool) or not isinstance(outward, (int, float)) or not math.isfinite(outward) or not 0 <= outward <= .3:
            raise ValueError('Cast presentation spread must remain within .3 radians')
        for axis, rest in enumerate(measured.get('upperRestRotation', [0., 0., 0.])):
            if rest:
                rotations[arm['upper']][axis] -= math.copysign(outward, rest)*strike
        # Hands/fingers have zero additional bend. Existing sculpted grip stays intact.
    targets = {}
    for leg in recipe['legs']:
        pos = list(leg['joint'])
        if 51 <= frame <= 75:
            phase = ((frame-51)/24+leg['phase']) % 1
            # Closed loop with no initial pop; alternate contact/lift intervals.
            cycle = math.sin(phase*math.tau)
            pos[1] += options['walkStride']*cycle
            pos[2] += options['walkLift']*max(0., cycle)
        targets[leg['name']] = pos
    for index, name in enumerate(recipe['tail']):
        axis = vector(calibration.get('tailRotationAxes', {}).get(name, [0., 0., 1.]), 'tail rotation axis')
        rotations[name] = [v*options['tailSway']*wave*(.65 if index == 0 else 1.) for v in axis]
    if recipe['tail']:
        # Parent calibrates this rest-local vector; cancel downward root travel
        # so a grounded long tail is not pushed into the floor during death.
        up = vector(calibration['tailUpLocal'], 'tailUpLocal')
        locations[recipe['tail'][0]] = [v*options['deathDrop']*settle for v in up]
    return {'rotations': rotations, 'locations': locations, 'targets': targets}


def load_calibration(kind, root, report, rest_tag='rest', path=None):
    explicit = Path(path) if path else root/f'{kind}-calibration.json'
    calibration = read_json(explicit if explicit.exists() else root/'calibration.json')
    if kind in calibration:
        calibration = calibration[kind]
    journal = read_json(export_path(root, kind, rest_tag))
    jobs = [j for j in journal['jobs'] if j['format'] == 'glb']
    if len(jobs) != 1 or 'verifiedStatus' not in jobs[0]:
        raise ValueError('Collect and verify this type\'s rest GLB before calibrating IK')
    expected = jobs[0]['verifiedStatus']['artifact']['sha256']
    if calibration.get('restGlbSha256') != expected or calibration.get('anatomySha256') != report['inputHashes']['anatomy']:
        raise ValueError('Calibration must name the exact rest GLB and measured anatomy hashes')
    verify_completed(jobs[0]['verifiedStatus'], root, 'glb')
    for leg in report['legs']:
        entry = calibration['legs'][leg['name']]
        vector(entry['rotation'], 'foot rest orientation')
        if isinstance(entry['poleAngle'], bool) or not isinstance(entry['poleAngle'], (int, float)) or not math.isfinite(entry['poleAngle']):
            raise ValueError('Measured poleAngle must be finite')
    for field in ['rootDownLocal'] + (['tailUpLocal'] if report['tail'] else []):
        direction = vector(calibration[field], field)
        if abs(sum(v*v for v in direction)-1) > 1e-5:
            raise ValueError(f'{field} must be a unit rest-local direction')
    return calibration


def animate(kind, out=None, calibration_path=None, rest_tag='rest', client=None):
    inputs = load_inputs(kind, out); root, recipe = inputs['root'], inputs['recipe']
    report_path = root/f'{kind}-rig-report.json'; report = read_json(report_path)
    if report['inputHashes'] != inputs['hashes'] or report['bones'] != recipe['bones']:
        raise ValueError('Bind/reweight the current recipe and source before animation')
    if 'animationSnapshotId' in report:
        raise ValueError('Animation is already authored; use a fresh staged rig for changed motion, not duplicate controls/actions')
    calibration = load_calibration(kind, root, report, rest_tag, calibration_path)
    poses = [(f, pose_at(f, recipe, calibration)) for f in FRAMES]
    # Detect an impossible straight-leg stride before asking IK to solve it.
    named = {b['name']: b for b in recipe['bones']}
    for frame, pose in poses:
        for leg in recipe['legs']:
            reach = sum(math.dist(named[leg[k]]['head'], named[leg[k]]['tail']) for k in ('upper', 'lower'))
            hip = list(leg['hip'])
            if frame >= 131:
                hip[2] -= motion_options(recipe)['deathDrop']*smooth(0, 1, (frame-131)/24)
            if math.dist(hip, pose['targets'][leg['name']]) > reach-.0001:
                raise ValueError(f'{leg["name"]} frame {frame}: target outside rigid IK reach; calibrate joints or reduce walk motion')
    client = client or harness(); client.call('scene.inspect'); m = client.Milestone(kind+'-boss-five-clips')
    try:
        for leg in report['legs']:
            target_name, pole_name = report['prefix']+leg['name']+'Target', report['prefix']+leg['name']+'Pole'
            target = m.mutate('rig.create_control', {'name': target_name, 'location': leg['joint'], 'shape': 'CIRCLE', 'size': .03})
            pole = m.mutate('rig.create_control', {'name': pole_name, 'location': leg['pole'], 'shape': 'SPHERE', 'size': .02})
            m.mutate('object.transform', {'name': target_name, 'rotation': calibration['legs'][leg['name']]['rotation']})
            m.mutate('constraint.add_bone', {'armatureId': report['rigId'], 'bone': leg['lower'], 'name': 'Plant-'+leg['name'], 'type': 'IK',
                     'targetObjectId': target['objectId'], 'poleObjectId': pole['objectId'], 'chainLength': 2,
                     'poleAngle': calibration['legs'][leg['name']]['poleAngle']})
            m.mutate('constraint.add_bone', {'armatureId': report['rigId'], 'bone': leg['foot'], 'name': 'Level-'+leg['name'],
                     'type': 'COPY_TRANSFORMS', 'targetObjectId': target['objectId']})
            leg.update(control=target_name, poleControl=pole_name)
        m.mutate('animation.set_frame_range', {'start': 1, 'end': 155})
        for frame, pose in poses:
            for name, rotation in pose['rotations'].items():
                m.mutate('animation.pose_keyframe', {'armature': report['rigName'], 'bone': name, 'dataPath': 'rotation_euler', 'frame': frame, 'value': rotation})
            for name, location in pose['locations'].items():
                m.mutate('animation.pose_keyframe', {'armature': report['rigName'], 'bone': name, 'dataPath': 'location', 'frame': frame, 'value': location})
            for leg in report['legs']:
                m.mutate('object.transform', {'name': leg['control'], 'location': pose['targets'][leg['name']]})
                m.mutate('animation.insert_keyframe', {'object': leg['control'], 'dataPath': 'location', 'frame': frame})
        checks = {'limbLength': m.mutate('validation.limb_length', {'armature': {'name': report['rigName']},
            'bones': [l[k] for l in recipe['legs']+recipe['arms'] for k in ('upper', 'lower')], 'frameStart': 1, 'frameEnd': 155, 'limit': .005}),
            'footDrift': {}, 'floor': {}}
        for clip in ('idle', 'attack', 'hurt', 'die'):
            start, end = CLIPS[clip]
            checks['footDrift'][clip] = [m.mutate('validation.foot_drift', {'armature': {'name': report['rigName']},
                'bone': l['foot'], 'frameStart': start, 'frameEnd': end, 'limit': .001}) for l in report['legs']]
        for clip, (start, end) in CLIPS.items():
            checks['floor'][clip] = m.mutate('validation.floor_penetration', {'object': {'name': report['surfaceName']},
                'frameStart': start, 'frameEnd': end, 'floorZ': 0., 'limit': .01})
        if not checks['limbLength']['passed'] or any(not c['passed'] for group in checks['footDrift'].values() for c in group) or any(not c['passed'] for c in checks['floor'].values()):
            write_json(root/f'{kind}-failed-animation-validation.json', checks)
            raise ValueError('Unchanged 5mm limbs/1mm planted feet/1cm source floor gates failed; receipt preserved')
        m.mutate('playback.set_frame', {'frame': 1}); snapshot = m.commit()
    except Exception:
        m.rollback(); raise
    report.update(animationSnapshotId=snapshot, sceneRevision=m.revision, validation=checks,
        calibration=calibration, clips=CLIPS, framesPerSecond=24, runtimeClipExtractionPending=True,
        animationAlgorithmSha256=sha(__file__), requiresFreshExportAndQA=True)
    write_json(report_path, report); return report


def export_path(root, kind, tag):
    # Snapshot jobs are species-independent. Naga's wrapper validates its
    # serpent report; this does not extend the biped bind/pose/CLI whitelist.
    if kind not in (*TYPES, 'sunken_city_3') or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,35}', tag):
        raise ValueError('Invalid export type/tag')
    return root/f'{kind}-{tag}-export.json'


def verify_completed(status, root, fmt):
    if status.get('state') != 'completed':
        raise ValueError('Export is not completed')
    for label in ('snapshot', 'artifact'):
        receipt = status[label]; path = Path(receipt['path']).resolve()
        if not path.is_relative_to(root):
            raise ValueError('Job artifact/snapshot escaped the authorised output root')
        data = path.read_bytes()
        if not data or hashlib.sha256(data).hexdigest() != receipt['sha256'] or ('bytes' in receipt and len(data) != receipt['bytes']):
            raise ValueError(f'{label} byte count/hash mismatch')
        if label == 'artifact' and fmt == 'glb' and (len(data) < 20 or data[:4] != b'glTF' or struct.unpack_from('<II', data, 4) != (2, len(data))):
            raise ValueError('Invalid GLB signature/version/length')
    return status


def job_control(client, command, arguments, report=None, journal_path=None):
    """Job risk:read still needs the managed session's revision/transaction.

    Only advance a journal that matched the revision before OUR transaction;
    querying after an external edit must not rebase an unsubmitted export.
    job.list's result remains {items, ...}, never a fabricated {jobs} wrapper.
    """
    if command not in ('job.status', 'job.recover', 'job.list'):
        raise ValueError('Expected a registered job query/recovery command')
    m = client.Milestone('boss-'+command.replace('.', '-'))
    owns_revision = report is not None and m.revision == report['sceneRevision']
    try:
        result = m.mutate(command, arguments)
        m.commit()
        return result
    except Exception:
        m.rollback(); raise
    finally:
        if owns_revision:
            report['sceneRevision'] = m.revision
            if journal_path is not None:
                write_json(journal_path, report)


def job_status(root, job, client, recover=False, report=None, journal_path=None):
    path = root/'jobs'/job['jobId']/'status.json'
    terminal = ('completed', 'failed', 'cancelled', 'interrupted')
    queried = False
    try:
        status = read_json(path)
    except (OSError, json.JSONDecodeError):
        status = job_control(client, 'job.status', {'jobId': job['jobId']}, report, journal_path)
        queried = True
    if status.get('jobId') != job['jobId']:
        raise ValueError('Status does not match the reserved job identity')
    if recover and status['state'] not in terminal:
        status = job_control(client, 'job.recover', {'jobId': job['jobId']}, report, journal_path)
        queried = True
    elif not queried and (status['state'] == 'queued' or
                         (status['state'] in terminal and not job.get('slotAcknowledged'))):
        # The on-disk receipt alone does not release the scheduler slot. Query
        # this recorded identity, including terminal failures, before marking it.
        status = job_control(client, 'job.status', {'jobId': job['jobId']}, report, journal_path)
        queried = True
    if status.get('jobId') != job['jobId']:
        raise ValueError('Job control returned another export identity')
    if queried and status['state'] in terminal:
        job['slotAcknowledged'] = True
    return status


def collect(kind, tag, out=None, client=None, recover=False):
    root = output_root(out); path = export_path(root, kind, tag); report = read_json(path)
    client = client or harness()
    for job in report['jobs']:
        if not job.get('dispatchAttempted'):
            job['lastState'] = 'reserved-unsubmitted'; continue
        status = job_status(root, job, client, recover, report, path)
        job['lastState'] = status['state']
        if status['state'] == 'completed':
            job['verifiedStatus'] = verify_completed(status, root, job['format'])
        else:
            job.pop('verifiedStatus', None)
            if status['state'] in ('failed', 'cancelled', 'interrupted'):
                job['failedStatus'] = status
        write_json(path, report)
    report['completed'] = all('verifiedStatus' in j for j in report['jobs'])
    write_json(path, report); return report


def export(kind, tag, out=None, client=None, wait_seconds=60):
    root = output_root(out); path = export_path(root, kind, tag)
    source_report = read_json(root/f'{kind}-rig-report.json')
    if not tag.startswith('rest') and 'animationSnapshotId' not in source_report:
        raise ValueError('Final export requires the committed five-motion authoring stage')
    client = client or harness()
    if path.exists():
        report = read_json(path)
        if report.get('phase') != 'prepared':
            raise ValueError('Incomplete preparation journal: inspect it, do not blindly resubmit or overwrite')
    else:
        report = {'type': kind, 'tag': tag, 'phase': 'preparing', 'jobs': [], 'rigReportSha256': sha(root/f'{kind}-rig-report.json')}
        write_json(path, report, exclusive=True)
        client.call('scene.inspect'); m = client.Milestone(kind+'-boss-export-'+tag)
        try:
            for ob in client.call('scene.inspect')['result']['objectDetails']:
                visible = ob['name'] in (source_report['rigName'], source_report['surfaceName'])
                m.mutate('object.set_visibility', {'name': ob['name'], 'viewport': visible, 'render': visible})
            m.mutate('playback.set_frame', {'frame': 1}); m.mutate('asset.pack_resources')
            report.update(snapshotId=m.commit(), sceneRevision=m.revision, phase='prepared')
        except Exception:
            m.rollback(); raise
        formats = ['glb'] if tag.startswith('rest') else ['glb', 'blend']
        report['jobs'] = [{'jobId': f'job_boss_{kind}_{uuid.uuid4().hex[:12]}_{fmt}', 'format': fmt,
                           'dispatchAttempted': False} for fmt in formats]
        write_json(path, report)
    for job in report['jobs']:
        if not job.get('dispatchAttempted'):
            if client.call('session.status')['sceneRevision'] != report['sceneRevision'] or sha(root/f'{kind}-rig-report.json') != report['rigReportSha256']:
                raise ValueError('Scene/report changed after snapshot approval; export with a fresh tag')
            job['dispatchAttempted'] = True; write_json(path, report)  # durable BEFORE dispatch
            expected_revision = report['sceneRevision']
            m = client.Milestone(kind+'-boss-job-'+job['format'])
            try:
                if m.revision != report['sceneRevision']:
                    raise ValueError('External scene mutation occurred before the job transaction')
                job['submissionSceneRevision'] = m.revision
                m.mutate('job.submit', {'jobId': job['jobId'], 'kind': 'EXPORT', 'format': job['format'], 'parameters': {}})
                job['submissionSnapshotId'] = m.commit()
                report['sceneRevision'] = m.revision
                job['postSubmitSceneRevision'] = m.revision
                write_json(path, report)
            except Exception as error:
                # The child may already exist despite a lost response. Rollback
                # scene transaction only; query this ID and NEVER submit again.
                m.rollback(); job['dispatchError'] = str(error)
                # Use only the revision acknowledged by this own transaction,
                # never adopt an arbitrary session.status revision after failure.
                if job.get('submissionSceneRevision') == expected_revision:
                    report['sceneRevision'] = m.revision
                write_json(path, report)
        deadline = time.monotonic()+max(0., wait_seconds)
        while True:
            status = job_status(root, job, client, report=report, journal_path=path)
            job['lastState'] = status['state']
            if status['state'] == 'completed':
                job['verifiedStatus'] = verify_completed(status, root, job['format'])
                write_json(path, report); break
            job.pop('verifiedStatus', None)
            if status['state'] in ('failed', 'cancelled', 'interrupted'):
                job['failedStatus'] = status; write_json(path, report)
                raise RuntimeError('Recorded export failed/interrupted; inspect/recover, no automatic new job')
            write_json(path, report)
            if time.monotonic() >= deadline:
                raise TimeoutError('Export identity preserved: collect/recover or rerun this tag; no duplicate submission')
            time.sleep(min(2., max(0., deadline-time.monotonic())))
    report['completed'] = True; write_json(path, report); return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('mode', choices=['plan', 'bind', 'reweight', 'applyweights', 'animate', 'export', 'collect', 'recover'])
    parser.add_argument('type', choices=TYPES); parser.add_argument('argument', nargs='?')
    parser.add_argument('--out'); parser.add_argument('--calibration'); parser.add_argument('--rest-tag', default='rest')
    parser.add_argument('--wait', type=float, default=60)
    args = parser.parse_args(argv)
    if args.mode in ('applyweights', 'export', 'collect', 'recover') and not args.argument:
        parser.error('This mode requires a weight file or export tag')
    if args.mode == 'plan':
        inputs = load_inputs(args.type, args.out)
        result = {'type': args.type, 'inputHashes': inputs['hashes'], 'weights': weight_summary(inputs['values']),
                  'rigName': inputs['rig'], 'surfaceName': inputs['surface'], 'clips': CLIPS, 'liveHarnessUsed': False}
    elif args.mode in ('bind', 'reweight', 'applyweights'):
        result = bind(args.type, args.out, args.mode != 'bind', args.argument if args.mode == 'applyweights' else None)
    elif args.mode == 'animate':
        result = animate(args.type, args.out, args.calibration, args.rest_tag)
    elif args.mode == 'export':
        result = export(args.type, args.argument, args.out, wait_seconds=args.wait)
    else:
        result = collect(args.type, args.argument, args.out, recover=args.mode == 'recover')
    print(json.dumps(result, ensure_ascii=False, allow_nan=False), flush=True)
    return 0 if args.mode not in ('collect', 'recover') or result.get('completed') else 1


if __name__ == '__main__':
    sys.exit(main())
