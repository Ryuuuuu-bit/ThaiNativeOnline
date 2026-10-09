"""Editable buffalo rig: cloven-hoof contacts, hind hocks, restrained heavy motion.

Only registered Harness commands mutate Blender. Run rest, calibrate the rest
bases with poles_buffalo.mjs, then build a fresh numbered animation version.
"""
import collections
import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from harness_client import call, Milestone

VERSION = sys.argv[1] if len(sys.argv) > 1 else 'v1'
OUT = Path(os.environ.get('MESHY_RIG_OUTPUT', 'artifacts/meshy-rig-02/paddy-buffalo')).resolve()
PREFIX = 'Buffalo' + VERSION.upper()
BONES, LEGS = [], []
calibration_file = Path(__file__).with_name('pole-angles-buffalo.json')
CALIBRATION = json.loads(calibration_file.read_text()) if calibration_file.exists() else {}


def bone(name, head, tail, parent='Body'):
    ancestor = next((b for b in BONES if b['name'] == parent), None)
    BONES.append(dict(name=name, head=head, tail=tail, parent=parent, deform=True,
                      connected=bool(ancestor and head == ancestor['tail'])))


def leg(name, hip, knee, joint, ankle, toe, pole, phase):
    bone(name+'Upper', hip, knee)
    bone(name+'Lower', knee, joint, name+'Upper')
    if joint != ankle:
        bone(name+'Pastern', joint, ankle, name+'Lower')
    bone(name+'Foot', ankle, toe, name+('Pastern' if joint != ankle else 'Lower'))
    LEGS.append(dict(name=name, hip=hip, knee=knee, joint=joint, ankle=ankle,
                     toe=toe, pole=pole, phase=phase))


def smooth(a, b, value):
    t = max(0, min(1, (value-a)/(b-a)))
    return t*t*(3-2*t)


def distance(p, a, b):
    d = [v-u for u, v in zip(a, b)]
    t = max(0, min(1, sum((v-u)*w for v, u, w in zip(p, a, d))/sum(w*w for w in d)))
    return math.sqrt(sum((v-u-t*w)**2 for v, u, w in zip(p, a, d)))


bone('Root', [0, 0, 0], [0, 0, .2], None)
bone('Body', [0, .42, .72], [0, -.24, .78], 'Root')
bone('Neck', [0, -.24, .78], [.025, -.44, .86])
bone('Head', [.025, -.44, .86], [.10, -.80, .75], 'Neck')
bone('TailBase', [.03, .78, .83], [.10, .92, .63])
bone('TailTip', [.10, .92, .63], [.32, .90, .29], 'TailBase')
leg('ForeL', [-.27, -.30, .70], [-.27, -.13, .38], [-.30, -.19, .065], [-.30, -.19, .065], [-.31, -.32, .065], [-.27, .4, .4], 0)
leg('ForeR', [.25, -.27, .70], [.24, -.10, .38], [.26, -.15, .065], [.26, -.15, .065], [.265, -.28, .065], [.24, .4, .4], .5)
leg('HindL', [-.18, .57, .70], [-.20, .45, .43], [-.13, .73, .23], [-.16, .75, .065], [-.16, .64, .065], [-.20, -.3, .4], .75)
leg('HindR', [.27, .58, .70], [.30, .55, .43], [.30, .80, .23], [.31, .78, .065], [.31, .67, .065], [.30, -.3, .4], .25)


def weights(p):
    x, y, z = p
    tail = smooth(.80, .85, y) * smooth(.20, .27, z)
    l = min(LEGS, key=lambda l: min(distance(p, l['hip'], l['knee']), distance(p, l['knee'], l['joint']), distance(p, l['joint'], l['toe'])))
    radius = .17 if l['name'].startswith('Hind') else .18
    d = min(distance(p, l['hip'], l['knee']), distance(p, l['knee'], l['joint']))
    limb = (1-smooth(.42, .73, z)) * (1-smooth(radius*.55, radius, d))
    if z < .27:
        limb = 1
    upper = smooth(.32, .48, z)
    foot = 1-smooth(.09, .16, z)
    pastern = 1-smooth(.22, .31, z) if l['name'].startswith('Hind') else 0
    # Keep both horns and ears with the head, including their swept-back roots.
    head = max(1-smooth(-.57, -.38, y), smooth(.90, 1.01, z)*(1-smooth(-.05, .18, y)))
    neck = (1-smooth(-.37, -.17, y))*smooth(.53, .79, z)*(1-head)
    base = (1-tail)*(1-limb)
    tip = 1-smooth(.48, .65, z)
    out = {'Body':base*max(0, 1-head-neck), 'Head':base*head, 'Neck':base*neck,
           'TailBase':tail*(1-tip), 'TailTip':tail*tip,
           l['name']+'Upper':(1-tail)*limb*upper,
           l['name']+'Lower':(1-tail)*limb*(1-upper)*(1-foot)*(1-pastern),
           l['name']+'Foot':(1-tail)*limb*(1-upper)*foot}
    if pastern:
        out[l['name']+'Pastern'] = (1-tail)*limb*(1-upper)*(1-foot)*pastern
    out = dict(sorted(out.items(), key=lambda item:item[1], reverse=True)[:4])
    total = sum(out.values())
    counts = {b:round(w/total*32) for b,w in out.items() if w/total > .01}
    counts = {b:w for b,w in counts.items() if w}
    counts[max(counts,key=counts.get)] += 32-sum(counts.values())
    return {b:w/32 for b,w in counts.items() if w}


def export(m, report):
    m.mutate('playback.set_frame', {'frame':1})
    m.mutate('view.focus', {'object':PREFIX+'Surface'})
    m.mutate('asset.pack_resources')
    snapshot = m.commit()
    report.update(version=VERSION, snapshotId=snapshot, editableSource=str(OUT.relative_to(Path.cwd())/f'buffalo-rig-{VERSION}.blend'))
    report['blend'] = call('export.file', {'path':str(OUT/f'buffalo-rig-{VERSION}.blend'), 'snapshotId':snapshot})
    report['glb'] = call('export.file', {'path':str(OUT/f'buffalo-rig-{VERSION}.glb'), 'snapshotId':snapshot,
                      'parameters':{'use_visible':True,'use_renderable':True,'export_apply':False,'export_animations':True}})
    (OUT/'buffalo-rig-report.json').write_text(json.dumps(report, indent=2))
    if VERSION != 'rest':
        keys = ['bones','legs','weightGroups','limbLength','idleFeet','version','editableSource','snapshotId']
        Path(__file__).with_name('rigs').joinpath('buffalo.json').write_text(json.dumps({k:report[k] for k in keys},indent=2)+'\n')
    print(json.dumps({'version':VERSION,'snapshot':snapshot,'bones':len(BONES)}), flush=True)


m = Milestone('buffalo-'+VERSION)
mut = m.mutate
try:
    for ob in call('scene.inspect')['result']['objectDetails']:
        mut('object.set_visibility', {'name':ob['name'],'viewport':False,'render':False})
    imported = mut('asset.import_file', {'path':str(OUT/'input'/'buffalo.glb')})
    mesh = next(ob['name'] for ob in imported['objects'] if ob['name'].startswith('buffaloSource'))
    mut('object.rename', {'name':mesh,'newName':PREFIX+'Surface'})
    mesh = PREFIX+'Surface'
    topology = mut('mesh.inspect', {'name':mesh,'allowOpenSurface':True})
    (OUT/'buffalo-topology.json').write_text(json.dumps(topology))
    points = [(x,-z,y) for x,y,z in json.loads((OUT/'input'/'buffalo-positions.json').read_text())]
    assert topology['counts']['vertices'] == len(points)
    for lo,hi in [([-2,-2,0],[0,2,.3]),([0,-2,.5],[2,0,1.2])]:
        selection = mut('mesh.select', {'name':mesh,'method':'spatial','min':lo,'max':hi})
        assert selection['vertices'] == [i for i,p in enumerate(points) if all(a<=v<=b for a,v,b in zip(lo,p,hi))]
    rig = PREFIX+'Rig'
    rig_id = mut('rig.create_armature', {'name':rig,'bones':BONES})['objectId']
    mut('rig.bind', {'mesh':{'name':mesh},'armature':{'name':rig}})
    groups = collections.defaultdict(list)
    for i,p in enumerate(points):
        w = weights(p)
        assert len(w)<=4 and abs(sum(w.values())-1)<1e-8
        for b,value in w.items():
            groups[b,value].append(i)
    for (b,w),indices in groups.items():
        sel = mut('mesh.select', {'name':mesh,'method':'indices','vertices':indices})
        mut('rig.assign_weights', {'mesh':{'name':mesh},'bone':b,'selection':sel,'weight':w})
    report = {'bones':BONES,'legs':LEGS,'weightGroups':len(groups)}
    print(json.dumps({'vertices':len(points),'groups':len(groups)}),flush=True)
    if VERSION == 'rest':
        export(m, report)
        sys.exit(0)
    assert set(CALIBRATION) == {l['name'] for l in LEGS}, 'Calibrate rest bases before animating'
    for l in LEGS:
        control = PREFIX+l['name']+'Target'
        target = mut('rig.create_control', {'name':control,'location':l['joint'],'shape':'CIRCLE','size':.07})
        pole = mut('rig.create_control', {'name':PREFIX+l['name']+'Pole','location':l['pole'],'shape':'SPHERE','size':.035})
        mut('object.transform', {'name':control,'rotation':CALIBRATION[l['name']]['rotation']})
        mut('constraint.add_bone', {'armatureId':rig_id,'bone':l['name']+'Lower','name':'Plant-'+l['name'],'type':'IK','targetObjectId':target['objectId'],'poleObjectId':pole['objectId'],'chainLength':2,'poleAngle':CALIBRATION[l['name']]['poleAngle']})
        mut('constraint.add_bone', {'armatureId':rig_id,'bone':l['name']+('Pastern' if l['joint']!=l['ankle'] else 'Foot'),'name':'Level-'+l['name'],'type':'COPY_TRANSFORMS','targetObjectId':target['objectId']})
        l['control'] = control
    mut('animation.set_frame_range', {'start':1,'end':155})
    frames = sorted(set([1,13,25,37,49]+list(range(51,76,2))+[75,81,85,89,92,96,101,105,111,114,117,121,131,137,143,149,155]))
    for frame in frames:
        rotations = {b['name']:[0,0,0] for b in BONES}
        body, head, tail, settle = [0,0,0], 0, 0, 0
        if frame <= 49:
            t = (frame-1)/48*math.tau
            body[2] = -.002*(1-math.cos(t))
            head, tail = .01*math.sin(t), .035*math.sin(t)
        elif frame <= 75:
            t = (frame-51)/24*math.tau
            body[2] = -.002*(1-math.cos(t*2))
            head, tail = .015*math.sin(t), .045*math.sin(t)
        elif frame <= 105:
            t = (frame-81)/24
            wind = math.sin(math.pi*min(1,t/.42))
            strike = math.sin(math.pi*max(0,min(1,(t-.27)/.55)))
            body[1] = -.018*wind+.055*strike
            head = .10*wind-.24*strike
        elif frame <= 121:
            t = (frame-111)/10
            body[1] = -.035*math.sin(math.pi*t)
            head = .08*math.sin(math.pi*t)
        else:
            settle = smooth(0,1,(frame-131)/24)
            body[2] = .13*settle  # Spine-local +Z points downward.
            head = .14*settle
        rotations['Neck'][0], rotations['Head'][0] = head*.35, head*.65
        rotations['TailBase'][2], rotations['TailTip'][2] = tail, tail*.5
        for b in BONES:
            for path,value in [('rotation_euler',rotations[b['name']]),('location',body if b['name']=='Body' else [0,0,0])]:
                mut('animation.pose_keyframe', {'armature':rig,'bone':b['name'],'dataPath':path,'frame':frame,'value':value})
        for l in LEGS:
            pos = l['joint'].copy()
            if 51 <= frame <= 75:
                phase = ((frame-51)/24+l['phase'])%1
                advance = .10*(.5-2*phase) if phase<.5 else .10*(-.5+2*(phase-.5))
                pos[1] -= advance
                pos[2] += 0 if phase<.5 else math.sin((phase-.5)*math.tau)*.045
            elif frame >= 131:
                pos[0] *= 1+.08*settle
            mut('object.transform', {'name':l['control'],'location':pos})
            mut('animation.insert_keyframe', {'object':l['control'],'dataPath':'location','frame':frame})
    report['skin'] = mut('rig.inspect', {'name':rig})
    report['limbLength'] = mut('validation.limb_length', {'armature':{'name':rig},'bones':[b['name'] for b in BONES if b['name'].endswith(('Upper','Lower','Pastern'))],'frameStart':1,'frameEnd':155,'limit':.005})
    report['idleFeet'] = [mut('validation.foot_drift', {'armature':{'name':rig},'bone':l['name']+'Foot','frameStart':1,'frameEnd':49,'limit':.001}) for l in LEGS]
    export(m, report)
except Exception:
    m.rollback()
    raise
