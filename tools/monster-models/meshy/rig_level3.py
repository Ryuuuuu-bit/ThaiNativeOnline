"""Lv.3 canine digitigrade legs and floating wood-spirit rigs.

Only registered Blender Harness commands; explicit normalized skin weights.
The spirit's open hands remain rigid rather than inventing finger bends.
"""
import collections
import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from harness_client import call, Milestone

TYPE = sys.argv[1]
VERSION = sys.argv[2] if len(sys.argv) > 2 else ('v5' if TYPE=='dhole' else 'v1')
OUT = Path(os.environ.get('MESHY_RIG_OUTPUT', 'artifacts/meshy-rig-02/level3')).resolve()
PREFIX = TYPE.title() + VERSION.upper()
BONES, LEGS = [], []
angle_file = Path(__file__).with_name('pole-angles-level3.json')
POLE_ANGLES = json.loads(angle_file.read_text()) if angle_file.exists() else {}


def bone(name, head, tail, parent='Body'):
    parent_spec=next((b for b in BONES if b['name']==parent),None)
    BONES.append(dict(name=name, head=head, tail=tail, parent=parent, deform=True,
                      connected=bool(parent_spec and head==parent_spec['tail'])))


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
if TYPE == 'dhole':
    bone('Body', [0, .32, .70], [0, -.28, .76], 'Root')
    bone('Neck', [0, -.28, .76], [0, -.55, 1.0])
    bone('Head', [0, -.55, 1.0], [0, -.83, 1.01], 'Neck')
    bone('TailBase', [.035, .57, .70], [.13, .77, .46])
    bone('TailTip', [.13, .77, .46], [.19, .93, .27], 'TailBase')
    leg('ForeL', [-.17, -.30, .72], [-.165, -.29, .39], [-.18, -.43, .065], [-.18, -.43, .065], [-.21, -.57, .065], [-.17, .3, .4], 0)
    leg('ForeR', [.13, -.24, .71], [.12, -.29, .37], [.14, -.37, .065], [.14, -.37, .065], [.16, -.51, .065], [.12, .3, .4], .5)
    leg('HindL', [-.13, .49, .68], [-.14, .36, .40], [-.14, .55, .255], [-.16, .53, .065], [-.21, .43, .065], [-.14, -.3, .4], .5)
    leg('HindR', [.13, .52, .68], [.135, .39, .40], [.145, .58, .255], [.16, .56, .065], [.21, .47, .065], [.135, -.3, .4], 0)
elif TYPE == 'phibpa':
    bone('Body', [0, 0, .64], [0, 0, 1.18], 'Root')
    bone('Head', [0, 0, 1.28], [0, 0, 1.57])
    for side, sign in [('L', -1), ('R', 1)]:
        bone('Arm'+side+'Upper', [sign*.25, 0, 1.17], [sign*.36, -.015, .96])
        bone('Arm'+side+'Lower', [sign*.36, -.015, .96], [sign*.445, -.035, .75], 'Arm'+side+'Upper')
        bone('Hand'+side, [sign*.445, -.035, .75], [sign*.45, -.025, .59], 'Arm'+side+'Lower')
    for i, x in enumerate([-.22, 0, .22]):
        bone('RootTassel'+str(i), [x, 0, .59], [x, 0, .15], 'Root')
else:
    raise ValueError(TYPE)


def weights(p):
    x, y, z = p
    if TYPE == 'dhole':
        tail = smooth(.61, .71, y)
        if tail > .98:
            tip = smooth(.72, .84, y)
            out = {'TailBase': 1-tip, 'TailTip': tip}
        else:
            l = next(l for l in LEGS if l['name'].endswith('L') == (x < 0)
                     and l['name'].startswith('Fore') == (y < 0))
            radius = .13 if l['name'].startswith('Fore') else .16
            limb = (1-smooth(.40, .70, z))*(1-smooth(radius*.65, radius, min(distance(p,l['hip'],l['knee']),distance(p,l['knee'],l['joint']))))
            if z < .30 and y < .64:
                limb = 1
            upper = smooth(.32, .49, z)
            foot = 1-smooth(.08, .14, z)
            pastern = 1-smooth(.23, .32, z) if not l['name'].startswith('Fore') else 0
            head = (1-smooth(-.62, -.42, y))*smooth(.80, .98, z)
            neck = (1-smooth(-.40, -.18, y))*smooth(.53, .83, z)*(1-head)
            out = {'Body': (1-limb)*(1-head-neck)*(1-tail), 'Head': (1-limb)*head,
                   'Neck': (1-limb)*neck, 'TailBase':(1-limb)*(1-head-neck)*tail,
                   l['name']+'Upper':limb*upper, l['name']+'Lower':limb*(1-upper)*(1-foot)*(1-pastern),
                   l['name']+'Foot':limb*(1-upper)*foot}
            if pastern:
                out[l['name']+'Pastern'] = limb*(1-upper)*(1-foot)*pastern
    else:
        side = 'L' if x < 0 else 'R'
        arm = smooth(.24, .32, abs(x))*(1-smooth(1.16, 1.25, z))*smooth(.50, .65, z)
        upper = smooth(.90, 1.01, z)
        hand = 1-smooth(.72, .79, z)
        head = smooth(1.24, 1.34, z)
        body = smooth(.47, .72, z)*(1-head)*(1-arm)
        root = max(0, 1-head-arm-body)
        out = {'Body':body, 'Head':head, 'Arm'+side+'Upper':arm*upper,
               'Arm'+side+'Lower':arm*(1-upper)*(1-hand), 'Hand'+side:arm*(1-upper)*hand,
               'RootTassel'+str(0 if x < -.10 else 2 if x > .10 else 1):root}
    # Keep at most four influences; quantized groups make assignments auditable.
    out = dict(sorted(out.items(), key=lambda item:item[1], reverse=True)[:4])
    total = sum(out.values())
    counts = {b:round(w/total*32) for b,w in out.items() if w/total > .01}
    counts = {b:w for b,w in counts.items() if w}
    counts[max(counts,key=counts.get)] += 32-sum(counts.values())
    return {b:w/32 for b,w in counts.items() if w}


m = Milestone(TYPE+'-rig-'+VERSION)
mut = m.mutate
try:
    for ob in call('scene.inspect')['result']['objectDetails']:
        mut('object.set_visibility', {'name':ob['name'], 'viewport':False, 'render':False})
    imported = mut('asset.import_file', {'path':str(OUT/'input'/f'{TYPE}.glb')})
    mesh = next(ob['name'] for ob in imported['objects'] if ob['name'].startswith(TYPE+'Source'))
    mut('object.rename', {'name':mesh,'newName':PREFIX+'Surface'})
    mesh = PREFIX+'Surface'
    topology = mut('mesh.inspect', {'name':mesh,'allowOpenSurface':True})
    (OUT/f'{TYPE}-topology.json').write_text(json.dumps(topology))
    points = [(x,-z,y) for x,y,z in json.loads((OUT/'input'/f'{TYPE}-positions.json').read_text())]
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
    print(json.dumps({'type':TYPE,'vertices':len(points),'bones':len(BONES),'groups':len(groups)}),flush=True)
    for l in LEGS:
        target_name, pole_name = PREFIX+l['name']+'Target', PREFIX+l['name']+'Pole'
        target = mut('rig.create_control', {'name':target_name,'location':l['joint'],'shape':'CIRCLE','size':.07})
        pole = mut('rig.create_control', {'name':pole_name,'location':l['pole'],'shape':'SPHERE','size':.035})
        end = l['ankle'] if l['joint'] != l['ankle'] else l['toe']
        dx,dy,dz = [b-a for a,b in zip(l['joint'],end)]
        length = math.sqrt(dx*dx+dy*dy+dz*dz)
        # Euler XYZ: map the control's local +Y onto the distal limb segment.
        calibration=POLE_ANGLES.get(l['name'],{})
        mut('object.transform', {'name':target_name,'rotation':calibration.get('rotation',[math.asin(dz/length),0,math.atan2(-dx,dy)])})
        mut('constraint.add_bone', {'armatureId':rig_id,'bone':l['name']+'Lower','name':'Plant-'+l['name'],'type':'IK','targetObjectId':target['objectId'],'poleObjectId':pole['objectId'],'chainLength':2,'poleAngle':calibration.get('poleAngle',math.pi/2)})
        mut('constraint.add_bone', {'armatureId':rig_id,'bone':l['name']+('Pastern' if l['joint']!=l['ankle'] else 'Foot'),'name':'Level-'+l['name'],'type':'COPY_TRANSFORMS','targetObjectId':target['objectId']})
        l['control'] = target_name
    mut('animation.set_frame_range', {'start':1,'end':155})
    frames = sorted(set([1,13,25,37,49]+list(range(51,76,2))+[75,81,85,89,92,96,101,105,111,114,117,121,131,137,143,149,155]))
    for frame in frames:
        rotation = {b['name']:[0,0,0] for b in BONES}
        body,root = [0,0,0],[0,0,0]
        head,tail,strike,settle = 0,0,0,0
        if frame<=49:
            t=(frame-1)/48*math.tau
            if TYPE=='dhole':body[2]=.002*(1-math.cos(t));head=.012*math.sin(t);tail=.045*math.sin(t)
            else:root[1]=.018*(1-math.cos(t));head=.025*math.sin(t)
        elif frame<=75:
            t=(frame-51)/24*math.tau
            if TYPE=='dhole':body[2]=.002*(1-math.cos(t*2));head=.02*math.sin(t);tail=.065*math.sin(t)
            else:root[1]=.025*(1-math.cos(t));rotation['Body'][0]=.035*(1-math.cos(t))
        elif frame<=105:
            t=(frame-81)/24
            wind=math.sin(math.pi*min(1,t/.42));strike=math.sin(math.pi*max(0,min(1,(t-.27)/.55)))
            if TYPE=='dhole':body[1]=-.015*wind+.055*strike;head=-.045*wind+.13*strike
            else:rotation['Body'][0]=-.06*wind+.12*strike;root[1]=.025*strike
        elif frame<=121:
            t=(frame-111)/10
            head=-.08*math.sin(math.pi*t);body[1]=.025*math.sin(math.pi*t)
        else:
            settle=smooth(0,1,(frame-131)/24);head=.10*settle
            # This front-facing spine's local +Z points downward in world space.
            if TYPE=='dhole':body[2]=.11*settle
            else:rotation['Body'][0]=.22*settle;body[1]=.035*settle
        if TYPE=='dhole':
            rotation['Neck'][0]=head*.4;rotation['Head'][0]=head*.6
            rotation['TailBase'][2]=tail;rotation['TailTip'][2]=tail*.6
        else:
            rotation['Head'][1]=head
            for side,sign in [('L',-1),('R',1)]:
                idle=math.sin(t)*.025 if frame<=75 else 0
                rotation['Arm'+side+'Upper']=[-.48*strike,0,sign*(idle+.10*strike)]
                rotation['Arm'+side+'Lower'][0]=.28*strike+.12*settle
            for i in range(3):rotation['RootTassel'+str(i)][1]=.035*math.sin(t)*(i-1) if frame<=75 else 0
        for b in BONES:
            mut('animation.pose_keyframe', {'armature':rig,'bone':b['name'],'dataPath':'rotation_euler','frame':frame,'value':rotation[b['name']]})
        for b,value in [('Body',body),('Root',root)]:
            mut('animation.pose_keyframe', {'armature':rig,'bone':b,'dataPath':'location','frame':frame,'value':value})
        for l in LEGS:
            pos=l['joint'].copy()
            if 51<=frame<=75:
                phase=((frame-51)/24+l['phase'])%1
                advance=.09*(.5-2*phase) if phase<.5 else .09*(-.5+2*(phase-.5))
                pos[1]-=advance
                pos[2]+=0 if phase<.5 else math.sin((phase-.5)*math.tau)*.055
            elif frame>=131:pos[0]*=1+.08*settle
            mut('object.transform', {'name':l['control'],'location':pos})
            mut('animation.insert_keyframe', {'object':l['control'],'dataPath':'location','frame':frame})
    mut('playback.set_frame', {'frame':1})
    mut('view.focus', {'object':mesh})
    report={'bones':BONES,'legs':LEGS,'skin':mut('rig.inspect',{'name':rig}),'weightGroups':len(groups)}
    report['limbLength']=mut('validation.limb_length', {'armature':{'name':rig},'bones':[b['name'] for b in BONES if b['name'].endswith(('Upper','Lower','Pastern'))],'frameStart':1,'frameEnd':155,'limit':.005})
    report['idleFeet']=[mut('validation.foot_drift', {'armature':{'name':rig},'bone':l['name']+'Foot','frameStart':1,'frameEnd':49,'limit':.001}) for l in LEGS]
    mut('asset.pack_resources')
    snapshot=m.commit()
    report.update(version=VERSION,editableSource=str(OUT.relative_to(Path.cwd())/f'{TYPE}-rig-{VERSION}.blend'),snapshotId=snapshot)
    report['blend']=call('export.file',{'path':str(OUT/f'{TYPE}-rig-{VERSION}.blend'),'snapshotId':snapshot})
    report['glb']=call('export.file',{'path':str(OUT/f'{TYPE}-rig-{VERSION}.glb'),'snapshotId':snapshot,'parameters':{'use_visible':True,'use_renderable':True,'export_apply':False,'export_animations':True}})
    (OUT/f'{TYPE}-rig-report.json').write_text(json.dumps(report,indent=2))
    metadata={k:report[k] for k in ['bones','legs','weightGroups','limbLength','idleFeet','version','editableSource','snapshotId']}
    (Path(__file__).with_name('rigs')/f'{TYPE}.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps({'type':TYPE,'snapshot':snapshot,'limbLength':report['limbLength'],'idleFeet':report['idleFeet']}),flush=True)
except Exception:
    m.rollback()
    raise
