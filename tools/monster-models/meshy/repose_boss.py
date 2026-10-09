"""Revise the existing registered boss timeline after a measured weight patch.

Does not create rigs/controls, touch topology, or perform generation/export.
Requires a fresh verified rest export and exact calibrated recipe hashes.
"""
import argparse
import boss_rig as rig


def repose(kind, rest_tag):
    inputs = rig.load_inputs(kind)
    root, recipe = inputs['root'], inputs['recipe']
    report = rig.read_json(root / f'{kind}-rig-report.json')
    if report['inputHashes'] != inputs['hashes'] or report['bones'] != recipe['bones']:
        raise ValueError('Bind/reweight the exact measured recipe before reposing')
    if 'animationSnapshotId' not in report or any('control' not in l for l in report['legs']):
        raise ValueError('Use animate for an unanimated rig; do not invent duplicate controls')
    calibration = rig.load_calibration(kind, root, report, rest_tag)
    client = rig.harness()
    client.call('scene.inspect')
    m = client.Milestone(kind + '-boss-measured-motion-revision')
    try:
        for frame in rig.FRAMES:
            pose = rig.pose_at(frame, recipe, calibration)
            for name, value in pose['rotations'].items():
                m.mutate('animation.pose_keyframe', {'armature': report['rigName'], 'bone': name,
                         'dataPath': 'rotation_euler', 'frame': frame, 'value': value})
            for name, value in pose['locations'].items():
                m.mutate('animation.pose_keyframe', {'armature': report['rigName'], 'bone': name,
                         'dataPath': 'location', 'frame': frame, 'value': value})
            for leg in report['legs']:
                m.mutate('object.transform', {'name': leg['control'], 'location': pose['targets'][leg['name']]})
                m.mutate('animation.insert_keyframe', {'object': leg['control'], 'dataPath': 'location', 'frame': frame})
        checks = {'limbLength': m.mutate('validation.limb_length', {
            'armature': {'name': report['rigName']},
            'bones': [l[k] for l in recipe['legs'] + recipe['arms'] for k in ('upper', 'lower')],
            'frameStart': 1, 'frameEnd': 155, 'limit': .005}), 'footDrift': {}, 'floor': {}}
        for name, (start, end) in rig.CLIPS.items():
            if name != 'walk':
                checks['footDrift'][name] = [m.mutate('validation.foot_drift', {
                    'armature': {'name': report['rigName']}, 'bone': l['foot'],
                    'frameStart': start, 'frameEnd': end, 'limit': .001}) for l in report['legs']]
            checks['floor'][name] = m.mutate('validation.floor_penetration', {
                'object': {'name': report['surfaceName']}, 'frameStart': start, 'frameEnd': end,
                'floorZ': 0., 'limit': .01})
        if not checks['limbLength']['passed'] or any(not c['passed'] for cs in checks['footDrift'].values() for c in cs) or any(not c['passed'] for c in checks['floor'].values()):
            rig.write_json(root / f'{kind}-failed-repose-validation.json', checks)
            raise ValueError('Unchanged limb/foot/floor gates failed')
        m.mutate('playback.set_frame', {'frame': 1})
        snapshot = m.commit()
    except Exception:
        m.rollback()
        raise
    report.update(animationSnapshotId=snapshot, sceneRevision=m.revision, validation=checks,
                  calibration=calibration, animationAlgorithmSha256=rig.sha(rig.__file__),
                  motionRevisionAlgorithmSha256=rig.sha(__file__), requiresFreshExportAndQA=True)
    rig.write_json(root / f'{kind}-rig-report.json', report)
    print(kind, snapshot)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('type', choices=rig.TYPES)
    parser.add_argument('--rest-tag', required=True)
    args = parser.parse_args()
    repose(args.type, args.rest_tag)
