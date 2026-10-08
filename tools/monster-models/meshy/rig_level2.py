"""Lv.2 species-specific, explicitly weighted Blender Harness rigs.
Rebuild from unpacked candidates; no human autorig or runtime code changes.
"""
import collections,json,math,sys,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from harness_client import call,Milestone
TYPE=sys.argv[1];VERSION=sys.argv[2] if len(sys.argv)>2 else ('v3' if TYPE=='cobra' else 'v2')
OUT=Path(os.environ.get('MESHY_RIG_OUTPUT','artifacts/meshy-rig-02')).resolve();PREFIX=TYPE.title()+VERSION.upper()
BONES=[];LEGS=[]
POLE_ANGLES={}
angle_file=Path(__file__).with_name('pole-angles-level2.json')
if angle_file.exists():POLE_ANGLES=json.loads(angle_file.read_text())
def bone(name,head,tail,parent='Body',deform=True):
    BONES.append(dict(name=name,head=head,tail=tail,parent=parent,deform=deform))
def leg(name,hip,knee,ankle,toe,pole,phase):
    bone(name+'Upper',hip,knee);bone(name+'Lower',knee,ankle,name+'Upper');bone(name+'Foot',ankle,toe,name+'Lower')
    LEGS.append(dict(name=name,hip=hip,knee=knee,ankle=ankle,toe=toe,pole=pole,phase=phase))
    POLE_ANGLES.setdefault(name,math.pi/2 if name.startswith('Fore') else -math.pi/2)
def smooth(a,b,v):
    t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
def distance_segment(p,a,b):
    d=[v-u for u,v in zip(a,b)];length=sum(v*v for v in d)
    t=max(0,min(1,sum((v-u)*w for v,u,w in zip(p,a,d))/length))
    return math.sqrt(sum((v-(u+t*w))**2 for v,u,w in zip(p,a,d))),t
bone('Root',[0,0,0],[0,.2,0],None)
if TYPE=='monkey':
    bone('Body',[0,.1,.95],[0,.3,.95],'Root')
    bone('Neck',[0,-.32,1.05],[0,-.55,1.22])
    bone('Head',[0,-.55,1.22],[0,-.81,1.35],'Neck')
    bone('Tail',[0,.74,1.18],[0,.94,1.38])
    leg('ForeL',[-.22,-.48,1],[-.24,-.42,.50],[-.23,-.62,.065],[-.23,-.77,.065],[-.24,.30,.5],0)
    leg('ForeR',[.30,-.38,1],[.40,-.30,.48],[.43,-.40,.065],[.43,-.55,.065],[.40,.40,.48],.5)
    leg('HindL',[-.22,.54,1],[-.36,.31,.57],[-.39,.58,.06],[-.40,.43,.06],[-.36,-.3,.57],.5)
    leg('HindR',[.30,.64,1],[.40,.47,.50],[.47,.79,.06],[.47,.64,.06],[.40,-.3,.5],0)
elif TYPE=='cobra':
    bone('Body',[.12,.90,.12],[.32,.65,.12],'Root')
    chain=[[.32,.65,.12],[.25,.4,.12],[-.10,.1,.12],[.12,-.25,.12],[.09,-.55,.12],[-.06,-.78,.12]]
    parent='Body'
    for i,(a,b) in enumerate(zip(chain,chain[1:])):
        name='Coil'+str(i+1);bone(name,a,b,parent);parent=name
    bone('NeckLower',chain[-1],[-.10,-.78,.43],parent)
    bone('NeckUpper',[-.10,-.78,.43],[-.07,-.64,.66],'NeckLower')
    bone('Hood',[-.07,-.64,.66],[-.07,-.66,.91],'NeckUpper')
    bone('Head',[-.07,-.66,.91],[-.07,-.94,1.00],'Hood')
else:raise ValueError(TYPE)

def weights(p):
    x,y,z=p;a=abs(x)
    if TYPE=='monkey':
        if z<.98:
            candidates=[l for l in LEGS if l['name'].endswith('L')==(x<0) and l['name'].startswith('Fore')==(y<0)]
            l=candidates[0];distance=min(distance_segment(p,l['hip'],l['knee'])[0],distance_segment(p,l['knee'],l['ankle'])[0])
            radius=.18+max(0,z-.3)*.10
            limb=(1-smooth(.72,.99,z))*(1-smooth(radius*.8,radius,distance))
            if z<.30:limb=1
            upper=smooth(.40,.62,z);foot=1-smooth(.08,.16,z)
            out={'Body':1-limb,l['name']+'Upper':limb*upper,l['name']+'Lower':limb*(1-upper)*(1-foot),l['name']+'Foot':limb*(1-upper)*foot}
        else:
            head=(1-smooth(-.48,-.16,y))*smooth(1.04,1.22,z);neck=1-smooth(-.12,.1,y)
            tail=smooth(.77,.86,y)*smooth(1.10,1.22,z)
            out={'Body':(1-tail)*(1-head)*(1-neck*.3),'Neck':(1-tail)*(1-head)*neck*.3,'Head':(1-tail)*head,'Tail':tail}
    else:
        # Nearest two adjacent centre-line segments give continuous scale skin.
        candidates=[b for b in BONES if b['name']!='Root' and (z>.18 or b['name']=='Body' or b['name'].startswith('Coil'))]
        d=sorted((distance_segment(p,b['head'],b['tail'])[0],i,b) for i,b in enumerate(candidates))
        first=d[0];second=min((item for item in d[1:] if abs(item[1]-first[1])==1),key=lambda item:item[0])
        inv=[1/(item[0]+.035)**3 for item in [first,second]];total=sum(inv)
        out={first[2]['name']:inv[0]/total,second[2]['name']:inv[1]/total}
        if z<.40:
            neck_blend=smooth(.18,.40,z);redistribute=0
            for name,value in list(out.items()):
                if name not in ['Body'] and not name.startswith('Coil'):
                    redistribute+=value*(1-neck_blend);out[name]=value*neck_blend
            ground=min((b for b in BONES if b['name']=='Body' or b['name'].startswith('Coil')),key=lambda b:distance_segment(p,b['head'],b['tail'])[0])['name']
            out[ground]=out.get(ground,0)+redistribute
    counts={b:round(w*32) for b,w in out.items() if w>.0001};counts={b:w for b,w in counts.items() if w>0}
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
    frames=sorted(set([1,13,25,37,49]+list(range(51,76,2))+[75,81,85,89,92,96,101,105,111,114,117,121,131,137,143,149,155]))
    for frame in frames:
        body=[0,0,0];head=0;tail_angle=0;strike=0;settle=0
        if frame<=49:
            t=(frame-1)/48*math.tau;body[2]=.003*(1-math.cos(t));head=.02*math.sin(t);tail_angle=.035*math.sin(t)
        elif frame<=75:
            t=(frame-51)/24*math.tau;body[2]=.003*(1-math.cos(t*2));head=.025*math.sin(t);tail_angle=.06*math.sin(t)
        elif frame<=105:
            t=(frame-81)/24;wind=math.sin(math.pi*min(1,t/.42));strike=math.sin(math.pi*max(0,min(1,(t-.27)/.55)))
            body[1]=.025*wind-.07*strike;head=-.07*wind+.18*strike
        elif frame<=121:
            t=(frame-111)/10;head=-.10*math.sin(math.pi*t);body[1]=.03*math.sin(math.pi*t)
        else:
            settle=smooth(0,1,(frame-131)/24);head=.12*settle;body[2]=-.14*settle
        for b in BONES:
            name=b['name'];r=[0,0,0];loc=[0,0,0]
            if TYPE=='monkey':
                if name=='Body':loc=body
                if name=='Neck':r[0]=head*.35
                if name=='Head':r[0]=head*.65
                if name=='Tail':r[2]=tail_angle
            else:
                # Planar slither only: lower body keeps its original height.
                if name.startswith('Coil'):
                    index=int(name[4:]);r[2]=(.055*math.sin(t-index*.8) if 51<=frame<=75 else 0)
                if name in ['NeckLower','NeckUpper','Hood','Head']:
                    factor={'NeckLower':.45,'NeckUpper':.35,'Hood':.15,'Head':.05}[name]
                    r[0]=factor*(head*2.3+settle*.9)
                    if frame<=49:r[2]=factor*.045*math.sin(t)
                # Do not animate floor-bearing Body vertically for a snake.
            for path,value in [('rotation_euler',r),('location',loc)]:mut('animation.pose_keyframe',{'armature':rig,'bone':name,'dataPath':path,'frame':frame,'value':value})
        for l in LEGS:
            pos=l['ankle'].copy()
            if 51<=frame<=75:
                t=((frame-51)/24+l['phase'])%1
                stride=.14
                if t<.5:advance=stride*(.5-2*t);lift=0
                else:advance=stride*(-.5+2*(t-.5));lift=math.sin((t-.5)*math.tau)*.055
                pos[1]-=advance;pos[2]+=lift
            elif 81<=frame<=105 and l['name']=='ForeR':
                pos[1]-=.18*strike;pos[2]+=.14*strike
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
    report.update(version=VERSION, editableSource=str(OUT.relative_to(Path.cwd())/f'{TYPE}-rig-{VERSION}.blend'), snapshotId=snapshot)
    report['blend']=call('export.file',{'path':str(OUT/f'{TYPE}-rig-{VERSION}.blend'),'snapshotId':snapshot})
    report['glb']=call('export.file',{'path':str(OUT/f'{TYPE}-rig-{VERSION}.glb'),'snapshotId':snapshot,'parameters':{'use_visible':True,'use_renderable':True,'export_apply':False,'export_animations':True}})
    (OUT/f'{TYPE}-rig-report.json').write_text(json.dumps(report,indent=2))
    metadata={k:report[k] for k in ['bones','legs','weightGroups','limbLength','idleFeet','version','editableSource','snapshotId']}
    metadata_dir=Path(__file__).with_name('rigs');metadata_dir.mkdir(exist_ok=True)
    (metadata_dir/f'{TYPE}.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps({'type':TYPE,'snapshot':snapshot,'limbLength':report['limbLength'],'idleFeet':report['idleFeet']}),flush=True)
except Exception:
    m.rollback();raise
