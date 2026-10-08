"""Species-specific editable rigs, explicit skin weights and baked game motion.

Only registered Harness commands mutate Blender. No humanoid retargeting or
automatic weights. Source vertex order is verified against spatial selections.
Run unpack.mjs first; use a managed Harness with this task's approved roots.
"""
import collections
import json
import math
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from harness_client import call, Milestone

TYPE = sys.argv[1]
OUT = Path('artifacts/meshy-rig-01').resolve()
VERSION = sys.argv[2] if len(sys.argv)>2 else 'v5'
PREFIX = TYPE.title()+VERSION.upper()
POLE_ANGLES = {k:-v for k,v in json.loads(Path(__file__).with_name('pole-angles.json').read_text())[TYPE].items()}
BONES = []
LEGS = []
def bone(name, head, tail, parent='Body', deform=True):
    BONES.append(dict(name=name, head=head, tail=tail, parent=parent, deform=deform))
def leg(name, hip, knee, ankle, toe, pole, phase):
    bone(name+'Upper', hip, knee)
    bone(name+'Lower', knee, ankle, name+'Upper')
    bone(name+'Foot', ankle, toe, name+'Lower')
    LEGS.append(dict(name=name, hip=hip, knee=knee, ankle=ankle, toe=toe, pole=pole, phase=phase))
def smooth(a,b,v):
    t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
def distance_segment(p,a,b):
    d=[v-u for u,v in zip(a,b)];length=sum(v*v for v in d)
    t=max(0,min(1,sum((v-u)*w for v,u,w in zip(p,a,d))/length))
    return math.sqrt(sum((v-(u+t*w))**2 for v,u,w in zip(p,a,d))),t

bone('Root',[0,0,0],[0,.2,0],None)
if TYPE=='boar':
    bone('Body',[0,.15,.78],[0,.35,.78],'Root')
    bone('Head',[0,-.26,.95],[0,-.72,1.02])
    bone('Tail',[0,.67,.96],[0,.92,1.15])
    for s,side in [(-1,'L'),(1,'R')]:
        leg('Fore'+side,[s*.28,-.28,.73],[s*.28,-.22,.39],[s*.28,-.29,.105],[s*.28,-.40,.105],[s*.28,.3,.4],0 if s<0 else .5)
        hx=-.14 if s<0 else .37
        leg('Hind'+side,[hx,.56,.74],[hx,.47,.39],[hx,.72,.105],[hx,.60,.105],[hx,-.1,.4],.5 if s<0 else 0)
elif TYPE=='fowl':
    bone('Body',[0,.0,.72],[0,.16,.72],'Root')
    bone('Neck',[0,-.22,.88],[0,-.39,1.18])
    bone('Head',[0,-.39,1.18],[0,-.51,1.41],'Neck')
    bone('Tail',[0,.34,.82],[0,.70,1.24])
    for s,side in [(-1,'L'),(1,'R')]:
        bone('Wing'+side,[s*.20,-.10,.85],[s*.34,.26,.62])
        leg('Leg'+side,[s*.22,-.18,.62],[s*.22,-.27,.31],[s*.22,-.40,.065],[s*.22,-.61,.065],[s*.22,.15,.30],0 if s<0 else .5)
elif TYPE=='crab':
    bone('Body',[0,0,.35],[0,.15,.35],'Root')
    for s,side in [(-1,'L'),(1,'R')]:
        bone('Eye'+side,[s*.17,-.29,.36],[s*.18,-.34,.57])
        bone('Claw'+side,[s*.24,-.27,.30],[s*.44,-.45,.32])
        bone('Palm'+side,[s*.44,-.45,.32],[s*.34,-.61,.31],'Claw'+side)
        # Preserve generated pinch gaps; do not invent a separate movable finger.
        endpoints=[(.69,-.47),(.92,-.22),(.94,.17),(.67,.62)]
        hips=[(.31,-.22),(.38,-.06),(.38,.13),(.29,.28)]
        for i,((x,y),(hx,hy)) in enumerate(zip(endpoints,hips)):
            knee=[s*(hx+(x-hx)*.56),hy+(y-hy)*.56,.17]
            ankle=[s*(x-.025),y,.025]
            leg('Leg'+side+str(i+1),[s*hx,hy,.30],knee,ankle,[s*x,y,.025],[s*(x+.2),y,.65],((i+(0 if s<0 else 1))%2)*.5)
else:raise ValueError(TYPE)

def weights(p):
    x,y,z=p;a=abs(x);out={'Body':1.0}
    if TYPE=='boar':
        if z<.67 and (a>.13 or z<.25):
            l=min(LEGS,key=lambda l:distance_segment(p,l['knee'],l['ankle'])[0])
            distance=min(distance_segment(p,l['hip'],l['knee'])[0],distance_segment(p,l['knee'],l['ankle'])[0])
            radius=.12+max(0,z-.2)*.17
            limb=(1-smooth(.51,.70,z))*(1-smooth(radius*.8,radius,distance))
            if z<.25:limb=1
            knee=smooth(.31,.47,z)
            foot=1-smooth(.11,.19,z)
            out={'Body':1-limb,l['name']+'Upper':limb*knee,l['name']+'Lower':limb*(1-knee)*(1-foot),l['name']+'Foot':limb*(1-knee)*foot}
        else:
            head=1-smooth(-.38,-.15,y)
            tail=smooth(.68,.78,y)*smooth(.72,.90,z)
            out={'Body':(1-head)*(1-tail),'Head':head*(1-tail),'Tail':tail}
    elif TYPE=='fowl':
        if z<.61 and -.80<y<.05 and a<.5:
            l=LEGS[0 if x<0 else 1]
            distance=min(distance_segment(p,l['hip'],l['knee'])[0],distance_segment(p,l['knee'],l['ankle'])[0])
            radius=.045+max(0,z-.20)*.14
            limb=(1-smooth(.43,.61,z))*(1-smooth(radius*.80,radius,distance))
            if z<.30:limb=1 # separated lower legs, toes and rear hallux
            upper=smooth(.25,.39,z);foot=1-smooth(.075,.14,z)
            out={'Body':1-limb,l['name']+'Upper':limb*upper,l['name']+'Lower':limb*(1-upper)*(1-foot),l['name']+'Foot':limb*(1-upper)*foot}
        else:
            neck=smooth(.89,1.10,z)*(1-smooth(-.20,.02,y))
            head=smooth(1.15,1.30,z)
            tail=smooth(.29,.45,y)
            wing=smooth(.21,.34,a)*(1-smooth(.90,1.04,z))*(1-tail)*(1-neck)
            out={'Body':(1-tail)*(1-neck)-wing,'Neck':(1-tail)*neck*(1-head),'Head':(1-tail)*neck*head,'Tail':tail,('WingL' if x<0 else 'WingR'):wing}
    else:
        side='L' if x<0 else 'R'
        if y<-.31 and a<.55:
            eye=(1-smooth(.22,.28,a))*smooth(.39,.48,z)
            claw=smooth(.27,.39,math.sqrt((x/1.1)**2+y*y))*(1-eye)
            palm=1-smooth(-.52,-.41,y)
            out={'Body':max(0,1-eye-claw),'Eye'+side:eye,'Claw'+side:claw*(1-palm),'Palm'+side:claw*palm}
        else:
            l=min((l for l in LEGS if l['name'].startswith('LegL')==(x<0)),key=lambda l:min(distance_segment(p,l['hip'],l['knee'])[0],distance_segment(p,l['knee'],l['ankle'])[0]))
            radial=math.sqrt((x/.39)**2+(y/.36)**2)
            limb=smooth(.90,1.18,radial)*(1-smooth(.34,.45,z))
            d1,t1=distance_segment(p,l['hip'],l['knee']);d2,t2=distance_segment(p,l['knee'],l['ankle'])
            lower=smooth(.72,1,t1)*.5 if d1<d2 else .5+.5*smooth(0,.25,t2)
            foot=smooth(.80,.98,t2) if d2<d1 else 0
            out={'Body':1-limb,l['name']+'Upper':limb*(1-lower),l['name']+'Lower':limb*lower*(1-foot),l['name']+'Foot':limb*lower*foot}
    # Quantise the explicitly designed influence field for batched assignments.
    counts={b:round(w*32) for b,w in out.items() if w>.0001}
    counts={b:w for b,w in counts.items() if w>0}
    largest=max(counts,key=counts.get);counts[largest]+=32-sum(counts.values())
    return {b:w/32 for b,w in counts.items() if w>0}

m=Milestone(TYPE+'-rig-'+VERSION);mut=m.mutate
try:
    for ob in call('scene.inspect')['result']['objectDetails']:
        mut('object.set_visibility',{'name':ob['name'],'viewport':False,'render':False})
    imported=mut('asset.import_file',{'path':str(OUT/'input'/f'{TYPE}.glb')})
    mesh=next(ob['name'] for ob in imported['objects'] if ob['name'].startswith(TYPE+'Source'))
    mut('object.rename',{'name':mesh,'newName':PREFIX+'Surface'});mesh=PREFIX+'Surface'
    topology=mut('mesh.inspect',{'name':mesh,'allowOpenSurface':True})
    (OUT/f'{TYPE}-topology.json').write_text(json.dumps(topology))
    points=[(x,-z,y) for x,y,z in json.loads((OUT/'input'/f'{TYPE}-positions.json').read_text())]
    assert topology['counts']['vertices']==len(points)
    for lo,hi in [([-2,-2,0],[0,2,.3]),([0,-2,.5],[2,0,1.2]),([-2,-2,1],[2,2,2])]:
        selection=mut('mesh.select',{'name':mesh,'method':'spatial','min':lo,'max':hi})
        assert selection['vertices']==[i for i,p in enumerate(points) if all(a<=v<=b for a,v,b in zip(lo,p,hi))], 'import vertex order changed'
    rig=PREFIX+'Rig';created=mut('rig.create_armature',{'name':rig,'bones':BONES});rig_id=created['objectId']
    mut('rig.bind',{'mesh':{'name':mesh},'armature':{'name':rig}})
    groups=collections.defaultdict(list)
    for i,p in enumerate(points):
        w=weights(p);assert abs(sum(w.values())-1)<1e-8 and len(w)<=4
        for b,value in w.items():groups[b,value].append(i)
    for (b,w),indices in groups.items():
        sel=mut('mesh.select',{'name':mesh,'method':'indices','vertices':indices})
        mut('rig.assign_weights',{'mesh':{'name':mesh},'bone':b,'selection':sel,'weight':w})
    print(json.dumps({'type':TYPE,'weightedVertices':len(points),'groups':len(groups),'bones':len(BONES)}),flush=True)
    for l in LEGS:
        control=PREFIX+l['name']+'Target';pole=PREFIX+l['name']+'Pole'
        target=mut('rig.create_control',{'name':control,'location':l['ankle'],'shape':'CIRCLE','size':.07})
        p=mut('rig.create_control',{'name':pole,'location':l['pole'],'shape':'SPHERE','size':.035})
        dx,dy,_=[b-a for a,b in zip(l['ankle'],l['toe'])];l['angle']=math.atan2(-dx,dy)
        mut('object.transform',{'name':control,'rotation':[0,0,l['angle']]})
        mut('constraint.add_bone',{'armatureId':rig_id,'bone':l['name']+'Lower','name':'Plant-'+l['name'],'type':'IK','targetObjectId':target['objectId'],'poleObjectId':p['objectId'],'chainLength':2,'poleAngle':POLE_ANGLES[l['name']]})
        mut('constraint.add_bone',{'armatureId':rig_id,'bone':l['name']+'Foot','name':'Level-'+l['name'],'type':'COPY_TRANSFORMS','targetObjectId':target['objectId']})
        l['control']=control;l['poleName']=pole
    mut('animation.set_frame_range',{'start':1,'end':155})
    for name,frame in [('idle',1),('walk',51),('attack',81),('hurt',111),('die',131)]:mut('animation.marker_set',{'name':name,'frame':frame})
    frames=sorted(set([1,13,25,37,49]+list(range(51,76,2))+[75,81,85,89,92,96,101,105,111,114,117,121,131,137,143,149,155]))
    for frame in frames:
        body=[0,0,0];root=[0,0,0];roll=0;head=0;tail=0;wing=0;claw=0
        if frame<=49:
            t=(frame-1)/48*math.tau;body[2]=.004*(1-math.cos(t));head=math.sin(t)*.025;tail=math.sin(t)*.055;claw=math.sin(t)*.025
        elif frame<=75:
            t=(frame-51)/24*math.tau;body[2]=.004*(1-math.cos(t*2));head=math.sin(t)*(.045 if TYPE=='fowl' else .02);tail=math.sin(t)*.045
        elif frame<=105:
            t=(frame-81)/24;wind=math.sin(math.pi*min(1,t/.42));strike=math.sin(math.pi*max(0,min(1,(t-.27)/.55)))
            head=(-.12*wind+.38*strike) if TYPE=='boar' else (-.14*wind+.52*strike) if TYPE=='fowl' else 0
            body[1]=.035*wind-.10*strike;body[2]=.035*strike;wing=.12*strike;claw=.42*strike-.08*wind
        elif frame<=121:
            t=(frame-111)/10;body[1]=.05*math.sin(math.pi*t);head=-.10*math.sin(math.pi*t)
        else:
            t=smooth(0,1,(frame-131)/24)
            # Grounded crouch/settle rather than sinking an arbitrary roll into terrain.
            body[2]=-t*({'boar':.16,'fowl':.22,'crab':.07}[TYPE]);head=t*.18;tail=-t*.12;claw=t*.25
        for b in BONES:
            name=b['name'];r=[0,0,0];loc=[0,0,0]
            if name=='Root':loc=root;r[1]=roll
            if name=='Body':loc=body
            if name in ['Head','Neck']:r[0]=head*(.6 if name=='Neck' else 1)
            if name=='Tail':r[2]=tail
            if name.startswith('Wing'):r[1]=wing*(1 if name.endswith('L') else -1)
            if name.startswith('Claw'):r[0]=claw;r[2]=claw*.35*(1 if name.endswith('L') else -1)
            if name.startswith('Palm'):r[0]=claw*.35
            # Explicit neutral FK keys give the IK solver a stable starting pose
            # at every beat; results cannot depend on the previous preview frame.
            for path,value in [('rotation_euler',r),('location',loc)]:mut('animation.pose_keyframe',{'armature':rig,'bone':name,'dataPath':path,'frame':frame,'value':value})
        for l in LEGS:
            pos=l['ankle'].copy()
            if 51<=frame<=75:
                t=((frame-51)/24+l['phase'])%1
                stride={'boar':.16,'fowl':.14,'crab':.075}[TYPE]
                if t<.5:advance=stride*(.5-2*t);lift=0
                else:advance=stride*(-.5+2*(t-.5));lift=math.sin((t-.5)*math.tau)*(.065 if TYPE!='crab' else .045)
                pos[1]-=advance;pos[2]+=lift
            elif frame>=131:
                t=smooth(0,1,(frame-131)/24);pos[0]*=1+.12*t
            mut('object.transform',{'name':l['control'],'location':pos})
            mut('animation.insert_keyframe',{'object':l['control'],'dataPath':'location','frame':frame})
    mut('playback.set_frame',{'frame':1})
    report={'bones':BONES,'legs':LEGS,'skin':mut('rig.inspect',{'name':rig}),'weightGroups':len(groups)}
    report['limbLength']=mut('validation.limb_length',{'armature':{'name':rig},'bones':[b['name'] for b in BONES if b['name'].endswith(('Upper','Lower'))],'frameStart':1,'frameEnd':155,'limit':.005})
    report['idleFeet']=[mut('validation.foot_drift',{'armature':{'name':rig},'bone':l['name']+'Foot','frameStart':1,'frameEnd':49,'limit':.001}) for l in LEGS]
    mut('asset.pack_resources')
    snapshot=m.commit()
    report.update(version=VERSION, editableSource=f'artifacts/meshy-rig-01/{TYPE}-rig-{VERSION}.blend', snapshotId=snapshot)
    report['blend']=call('export.file',{'path':str(OUT/f'{TYPE}-rig-{VERSION}.blend'),'snapshotId':snapshot})
    report['glb']=call('export.file',{'path':str(OUT/f'{TYPE}-rig-{VERSION}.glb'),'snapshotId':snapshot,'parameters':{'use_visible':True,'use_renderable':True,'export_apply':False,'export_animations':True}})
    (OUT/f'{TYPE}-rig-report.json').write_text(json.dumps(report,indent=2))
    metadata={k:report[k] for k in ['bones','legs','weightGroups','limbLength','idleFeet','version','editableSource','snapshotId']}
    metadata_dir=Path(__file__).with_name('rigs');metadata_dir.mkdir(exist_ok=True)
    (metadata_dir/f'{TYPE}.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps({'type':TYPE,'snapshot':snapshot,'limbLength':report['limbLength'],'idleFeet':report['idleFeet']}),flush=True)
except Exception:
    m.rollback();raise
