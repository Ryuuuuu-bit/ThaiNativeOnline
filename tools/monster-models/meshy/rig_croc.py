"""Crocodile anatomy, four planted limbs and five game clips through L3 Harness.

Stages: bind -> export rest -> calibrate_croc.mjs -> animate -> export final.
No human retargeting, automatic rigging, arbitrary bpy or paid animation calls.
"""
import collections
import hashlib
import json
import math
import os
import sys
import time
from pathlib import Path
from croc_weights import croc_weights
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from harness_client import call, Milestone

OUT = Path(os.environ.get('MESHY_RIG_OUTPUT', 'artifacts/meshy-rig-05/klong')).resolve()
RECIPE = Path(__file__).with_name('rigs') / 'croc-anatomy.json'
RIG, SURFACE = 'CrocV1Rig', 'CrocV1Surface'


def bind(reweight=False):
    recipe = json.loads(RECIPE.read_text())
    bones, legs = recipe['bones'], recipe['legs']
    m = Milestone('croc-bind')
    try:
        previous = json.loads((OUT / 'croc-rig-report.json').read_text()) if reweight else {}
        if not reweight:
            for ob in call('scene.inspect')['result']['objectDetails']:
                m.mutate('object.set_visibility', {'name': ob['name'], 'viewport': False, 'render': False})
            imported = m.mutate('asset.import_file', {'path': str(OUT / 'input/croc.glb')})
            source = next(ob['name'] for ob in imported['objects'] if ob['name'].startswith('crocSource'))
            m.mutate('object.rename', {'name': source, 'newName': SURFACE})
        topology = m.mutate('mesh.inspect', {'name': SURFACE, 'allowOpenSurface': True})
        points = [(x, -z, y) for x, y, z in json.loads((OUT / 'input/croc-positions.json').read_text())]
        assert topology['counts']['vertices'] == len(points)
        if not reweight:
            rig_id = m.mutate('rig.create_armature', {'name': RIG, 'bones': bones})['objectId']
            m.mutate('rig.bind', {'mesh': {'name': SURFACE}, 'armature': {'name': RIG}})
        else:
            rig_id = previous['rigId']
        indices = json.loads((OUT / 'input/croc-indices.json').read_text())
        values = croc_weights(points, indices, bones, legs)
        before = json.loads((OUT / 'croc-applied-weights.json').read_text()) if reweight else None
        changed = {i for i, w in enumerate(values) if before is None or w != before[i]}
        if reweight and changed:
            selection = m.mutate('mesh.select', {'name': SURFACE, 'method': 'indices', 'vertices': sorted(changed)})
            for b in bones:
                if b['deform']:
                    m.mutate('rig.assign_weights', {'mesh': {'name': SURFACE}, 'bone': b['name'], 'selection': selection, 'weight': 0})
        groups = collections.defaultdict(list)
        for i, weights in enumerate(values):
            assert len(weights) <= 4 and abs(sum(weights.values()) - 1) < 1e-8
            assert all(math.isfinite(w) and 0 < w <= 1 for w in weights.values())
            if i not in changed:
                continue
            for bone, weight in weights.items():
                groups[bone, weight].append(i)
        for (bone, weight), vertices in groups.items():
            selection = m.mutate('mesh.select', {'name': SURFACE, 'method': 'indices', 'vertices': vertices})
            m.mutate('rig.assign_weights', {'mesh': {'name': SURFACE}, 'bone': bone, 'selection': selection, 'weight': weight})
        skin = m.mutate('rig.inspect', {'name': RIG})
        snapshot = m.commit()
        weights_bytes = json.dumps(values).encode()
        report = previous | dict(type='croc', version='v1', bones=bones, legs=previous.get('legs', legs), rigId=rig_id,
                      weightGroups=len(groups), skin=skin, snapshotId=snapshot, sceneRevision=m.revision,
                      inputPositionsSha256=hashlib.sha256((OUT / 'input/croc-positions.json').read_bytes()).hexdigest(),
                      anatomySha256=hashlib.sha256(RECIPE.read_bytes()).hexdigest(),
                      weightAlgorithmSha256=hashlib.sha256(Path(__file__).with_name('croc_weights.py').read_bytes()).hexdigest(),
                      appliedWeightsSha256=hashlib.sha256(weights_bytes).hexdigest())
        (OUT / 'croc-rig-report.json').write_text(json.dumps(report, indent=2))
        (OUT / 'croc-applied-weights.json').write_bytes(weights_bytes)
        if reweight and 'animationSnapshotId' in report:
            Path(__file__).with_name('rigs').joinpath('croc.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps({'vertices': len(points), 'bones': len(bones), 'groups': len(groups)}), flush=True)
    except Exception:
        m.rollback()
        raise


def animate():
    report = json.loads((OUT / 'croc-rig-report.json').read_text())
    calibration = json.loads((OUT / 'croc-calibration.json').read_text())
    m = Milestone('croc-five-clips')
    try:
        call('scene.inspect')
        for leg in report['legs']:
            if 'control' in leg:
                continue
            name = 'Croc' + leg['name']
            target = m.mutate('rig.create_control', {'name': name + 'Target', 'location': leg['joint'], 'shape': 'CIRCLE', 'size': .025})
            pole = m.mutate('rig.create_control', {'name': name + 'Pole', 'location': leg['pole'], 'shape': 'SPHERE', 'size': .02})
            m.mutate('object.transform', {'name': name + 'Target', 'rotation': calibration['legs'][leg['name']]['rotation']})
            m.mutate('constraint.add_bone', {'armatureId': report['rigId'], 'bone': leg['name'] + 'Lower', 'name': 'Plant-' + leg['name'], 'type': 'IK', 'targetObjectId': target['objectId'], 'poleObjectId': pole['objectId'], 'chainLength': 2, 'poleAngle': calibration['legs'][leg['name']]['poleAngle']})
            m.mutate('constraint.add_bone', {'armatureId': report['rigId'], 'bone': leg['name'] + 'Foot', 'name': 'Level-' + leg['name'], 'type': 'COPY_TRANSFORMS', 'targetObjectId': target['objectId']})
            leg['control'] = name + 'Target'
        m.mutate('animation.set_frame_range', {'start': 1, 'end': 155})
        frames = sorted(set([1, 13, 25, 37, 49] + list(range(51, 76, 2)) + [75, 81, 85, 89, 92, 96, 101, 105, 111, 114, 117, 121, 131, 137, 143, 149, 155]))
        for frame in frames:
            wave = wind = strike = recoil = settle = 0
            if frame <= 49:
                wave = math.sin((frame - 1) / 48 * math.tau)
            elif frame <= 75:
                wave = math.sin((frame - 51) / 24 * math.tau)
            elif frame <= 105:
                t = (frame - 81) / 24
                wind = math.sin(math.pi * min(1, t / .42))
                strike = math.sin(math.pi * max(0, min(1, (t - .27) / .55)))
            elif frame <= 121:
                recoil = math.sin(math.pi * (frame - 111) / 10)
            else:
                t = max(0, min(1, (frame - 131) / 24))
                settle = t * t * (3 - 2 * t)
            rotation = {b['name']: [0, 0, 0] for b in report['bones']}
            rotation['Neck'][0] = .010 * wave - .035 * wind + .075 * strike - .045 * recoil + .035 * settle
            rotation['Head'][0] = .009 * wave + .05 * strike + .025 * settle
            # Read the exported rest-axis sign: a positive Blender local angle
            # is not necessarily an anatomically downward opening.
            rotation['Jaw'][0] = calibration['pitchDownSigns']['Jaw'] * .11 * strike
            for bone, amplitude in [('TailBase', .012), ('TailMid', .016), ('TailTip', .018)]:
                rotation[bone][2] = amplitude * wave * (2 if 51 <= frame <= 75 else 1)
            for bone in report['bones']:
                m.mutate('animation.pose_keyframe', {'armature': RIG, 'bone': bone['name'], 'dataPath': 'rotation_euler', 'frame': frame, 'value': rotation[bone['name']]})
            # This low crocodile's belly is already only millimetres above
            # the floor; a human-sized crouch would push it underground.
            down = .003 * settle
            m.mutate('animation.pose_keyframe', {'armature': RIG, 'bone': 'Body', 'dataPath': 'location', 'frame': frame, 'value': [v * down for v in calibration['bodyDownLocal']]})
            # The long tail rests close to the floor. Counter the parent's
            # death crouch in its verified local basis instead of sinking it.
            m.mutate('animation.pose_keyframe', {'armature': RIG, 'bone': 'TailBase', 'dataPath': 'location', 'frame': frame, 'value': [v * down for v in calibration['tailUpLocal']]})
            for leg in report['legs']:
                p = leg['joint'].copy()
                if 51 <= frame <= 75:
                    phase = ((frame - 51) / 24 + leg['phase']) % 1
                    p[1] += .025 * math.sin(phase * math.tau)
                    p[2] += .018 * max(0, math.sin(phase * math.tau))
                m.mutate('object.transform', {'name': leg['control'], 'location': p})
                m.mutate('animation.insert_keyframe', {'object': leg['control'], 'dataPath': 'location', 'frame': frame})
        report['limbLength'] = m.mutate('validation.limb_length', {'armature': {'name': RIG}, 'bones': [b['name'] for b in report['bones'] if b['name'].endswith(('Upper', 'Lower'))], 'frameStart': 1, 'frameEnd': 155, 'limit': .005})
        report['idleFeet'] = [m.mutate('validation.foot_drift', {'armature': {'name': RIG}, 'bone': leg['name'] + 'Foot', 'frameStart': 1, 'frameEnd': 49, 'limit': .0015}) for leg in report['legs']]
        assert report['limbLength']['passed'] and all(f['passed'] for f in report['idleFeet'])
        m.mutate('playback.set_frame', {'frame': 1})
        m.mutate('view.focus', {'object': SURFACE})
        report['animationSnapshotId'] = m.commit()
        report['sceneRevision'] = m.revision
        (OUT / 'croc-rig-report.json').write_text(json.dumps(report, indent=2))
        Path(__file__).with_name('rigs').joinpath('croc.json').write_text(json.dumps(report, indent=2) + '\n')
        print('Crocodile five clips authored and plant checks passed', flush=True)
    except Exception:
        m.rollback()
        raise


def export(tag):
    receipt_file = OUT / f'croc-{tag}-export.json'
    if receipt_file.exists():
        report = json.loads(receipt_file.read_text())
    else:
        m = Milestone('croc-export-' + tag)
        for ob in call('scene.inspect')['result']['objectDetails']:
            visible = ob['name'] in [RIG, SURFACE]
            m.mutate('object.set_visibility', {'name': ob['name'], 'viewport': visible, 'render': visible})
        m.mutate('playback.set_frame', {'frame': 1})
        m.mutate('asset.pack_resources')
        snapshot = m.commit()
        report = dict(snapshotId=snapshot, sceneRevision=m.revision, jobs=[])
        receipt_file.write_text(json.dumps(report, indent=2))
    for fmt in (['glb'] if tag == 'rest' else ['glb', 'blend']):
        jid = f'job_croc_{tag}_{fmt}'
        status_file = OUT / 'jobs' / jid / 'status.json'
        if not any(j['jobId'] == jid for j in report['jobs']):
            report['jobs'].append({'jobId': jid})
            receipt_file.write_text(json.dumps(report, indent=2))
            job = Milestone('croc-job-' + tag + '-' + fmt)
            try:
                job.mutate('job.submit', {'jobId': jid, 'kind': 'EXPORT', 'format': fmt, 'parameters': {}})
                job.commit()
            except Exception as error:
                job.rollback()
                # A failed dispatch response can follow a successful child
                # start. Recover that exact durable job; never submit again.
                report.setdefault('dispatchErrors', {})[jid] = str(error)
                receipt_file.write_text(json.dumps(report, indent=2))
                if not status_file.exists():
                    raise
        checked_queue = False
        for _ in range(60):
            # Terminal worker receipts are immutable files. Re-querying the
            # scheduler after transaction rollback can launch a duplicate child.
            status = json.loads(status_file.read_text()) if status_file.exists() else {}
            if status.get('state') == 'queued' and not checked_queue:
                # One query releases completed scheduler slots and starts this
                # exact recorded job. Never scan/re-query old terminal jobs.
                call('job.status', {'jobId': jid})
                checked_queue = True
            if status.get('state') == 'completed':
                break
            if status.get('state') in ['failed', 'cancelled']:
                raise RuntimeError(json.dumps(status))
            time.sleep(2)
        else:
            raise RuntimeError('Recorded export still running; collect it without resubmission')
        artifact = status['artifact']
        data = Path(artifact['path']).read_bytes()
        assert len(data) == artifact['bytes'] and hashlib.sha256(data).hexdigest() == artifact['sha256']
        snapshot = status['snapshot']
        assert hashlib.sha256(Path(snapshot['path']).read_bytes()).hexdigest() == snapshot['sha256']
        # The scheduler releases its slot only when this job's terminal state
        # is acknowledged. Query this exact job once, never all old job folders.
        if jid not in report.setdefault('releasedJobIds', []):
            call('job.status', {'jobId': jid})
            report['releasedJobIds'].append(jid)
        report.setdefault('productionExports', [])
        report['productionExports'] = [s for s in report['productionExports'] if s['jobId'] != jid] + [status]
        receipt_file.write_text(json.dumps(report, indent=2))
        print(tag, fmt, 'L3 export verified', flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'bind':
        bind()
    elif sys.argv[1] == 'reweight':
        bind(True)
    elif sys.argv[1] == 'animate':
        animate()
    elif sys.argv[1] == 'export':
        export(sys.argv[2])
    else:
        raise ValueError('Unknown crocodile stage')
