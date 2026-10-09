"""Deep-forest species rigs, explicit skin weights and five editable game beats.

Registered Harness mutations only. Planted rigs: rest -> poles_forest.mjs -> version.
Hands/toes keep their source shape; no humanoid retargeting or finger bends.
"""
import collections,json,math,os,sys
from surface_weights import surface_weights
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from harness_client import call,Milestone
TYPE=sys.argv[1]; VERSION=sys.argv[2] if len(sys.argv)>2 else 'v1'
OUT=Path(os.environ.get('MESHY_RIG_OUTPUT','artifacts/meshy-rig-03/deep-forest')).resolve()
PREFIX=TYPE.title()+VERSION.upper(); BONES=[]; LEGS=[]
def bone(name,head,tail,parent='Body'):
    p=next((b for b in BONES if b['name']==parent),None)
    BONES.append(dict(name=name,head=head,tail=tail,parent=parent,deform=True,connected=bool(p and head==p['tail'])))
def smooth(a,b,v):
    t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
def distance(p,a,b):
    d=[v-u for u,v in zip(a,b)];t=max(0,min(1,sum((v-u)*w for v,u,w in zip(p,a,d))/sum(w*w for w in d)))
    return math.sqrt(sum((v-u-t*w)**2 for v,u,w in zip(p,a,d)))
def leg(name,hip,knee,ankle,toe,pole,phase):
    bone(name+'Upper',hip,knee);bone(name+'Lower',knee,ankle,name+'Upper');bone(name+'Foot',ankle,toe,name+'Lower')
    LEGS.append(dict(name=name,hip=hip,knee=knee,joint=ankle,ankle=ankle,toe=toe,pole=pole,phase=phase))
bone('Root',[0,0,0],[0,0,.2],None)
if TYPE=='monitor':
    bone('Body',[0,.08,.23],[0,-.40,.28],'Root')
    bone('Neck',[0,-.40,.28],[.045,-.60,.40]);bone('Head',[.045,-.60,.40],[.045,-.87,.48],'Neck')
    bone('TailBase',[0,.16,.20],[-.02,.44,.12]);bone('TailMid',[-.02,.44,.12],[-.08,.72,.08],'TailBase');bone('TailTip',[-.08,.72,.08],[-.15,.91,.13],'TailMid')
    for side,s in [('L',-1),('R',1)]:
        x=-.222 if s<0 else .262
        leg('Fore'+side,[s*.12,-.47,.26],[s*.23,-.43,.14],[x,-.60,.035],[x,-.70,.035],[s*.55,-.30,.16],0 if s<0 else .5)
        x=-.24 if s<0 else .268
        leg('Hind'+side,[s*.12,.025,.24],[s*.23,.08,.13],[x,-.03,.035],[x,-.12,.035],[s*.55,.25,.14],.75 if s<0 else .25)
elif TYPE=='khamot':
    bone('Body',[0,0,.85],[0,0,1.25],'Root');bone('FlameTip',[0,0,1.45],[0,0,1.86]);bone('FlameTail',[0,0,.42],[0,0,.08])
else:
    config={
      'kongkoi':dict(base=.61,neck=1.05,head=1.15,top=1.62,shoulder=[.24,0,1.02],elbow=[.36,-.01,.82],wrist=[.46,-.04,.64],hand=[.46,-.04,.49]),
      'pray':dict(base=.65,neck=1.30,head=1.41,top=1.76,shoulder=[.23,0,1.28],elbow=[.34,-.01,1.04],wrist=[.47,-.07,.88],hand=[.51,-.07,.77]),
      'winyan':dict(base=.64,neck=1.24,head=1.34,top=1.70,shoulder=[.24,0,1.22],elbow=[.37,-.015,1.03],wrist=[.49,-.045,.84],hand=[.52,-.06,.70]),
      'takian':dict(base=.90,neck=1.45,head=1.56,top=1.77,shoulder=[.18,0,1.41],elbow=[.25,-.01,1.22],wrist=[.31,-.02,1.05],hand=[.32,-.025,.94]),
    }[TYPE]
    bone('Body',[0,0,config['base']],[0,0,config['neck']],'Root');bone('Head',[0,0,config['head']],[0,0,config['top']])
    for side,s in [('L',-1),('R',1)]:
        points=[[s*p[0],p[1],p[2]] for p in [config['shoulder'],config['elbow'],config['wrist'],config['hand']]]
        bone('Arm'+side+'Upper',points[0],points[1]);bone('Arm'+side+'Lower',points[1],points[2],'Arm'+side+'Upper');bone('Hand'+side,points[2],points[3],'Arm'+side+'Lower')
    if TYPE=='kongkoi':
        leg('Leg',[0,0,.61],[0,-.04,.36],[0,0,.08],[0,-.22,.08],[0,-.40,.32],0)
    elif TYPE!='takian':
        for i,x in enumerate([-.2,0,.2]):bone('Hem'+str(i),[x,0,.58],[x,0,.10],'Root')

def weights(p):
    x,y,z=p
    if TYPE=='monitor':
        tail=smooth(.10,.24,y)
        head=(1-smooth(-.68,-.52,y))*smooth(.26,.40,z)
        neck=(1-smooth(-.48,-.32,y))*(1-head)*smooth(.16,.30,z)
        l=min(LEGS,key=lambda l:min(distance(p,l['hip'],l['knee']),distance(p,l['knee'],l['joint']),distance(p,l['joint'],l['toe'])))
        d=min(distance(p,l['hip'],l['knee']),distance(p,l['knee'],l['joint']),distance(p,l['joint'],l['toe']))
        limb=(1-smooth(.08,.15,d))*smooth(.10,.16,abs(x))*(1-smooth(.18,.27,z))*(1-tail)
        if z<.075 and abs(x)>.15 and y<.13:limb=1
        upper=smooth(.105,.19,z);foot=1-smooth(.045,.085,z)
        mid=smooth(.35,.56,y);tip=smooth(.63,.80,y);base=max(0,1-tail-limb)
        out={'Body':base*max(0,1-head-neck),'Head':base*head,'Neck':base*neck,'TailBase':tail*(1-mid),'TailMid':tail*mid*(1-tip),'TailTip':tail*mid*tip,l['name']+'Upper':limb*upper,l['name']+'Lower':limb*(1-upper)*(1-foot),l['name']+'Foot':limb*(1-upper)*foot}
    elif TYPE=='khamot':
        tip=smooth(1.40,1.65,z);tail=1-smooth(.35,.55,z)
        out={'Body':max(0,1-tip-tail),'FlameTip':tip,'FlameTail':tail}
    else:
        side='L' if x<0 else 'R';a=next(b for b in BONES if b['name']=='Arm'+side+'Upper');b=next(b for b in BONES if b['name']=='Arm'+side+'Lower')
        radius=.10 if TYPE=='takian' else .14
        proximity=1-smooth(radius*.5,radius,min(distance(p,a['head'],a['tail']),distance(p,b['head'],b['tail'])))
        arm=proximity*smooth(config['shoulder'][0]*.8,config['shoulder'][0]*1.1,abs(x))*(1-smooth(config['shoulder'][2]-.01,config['shoulder'][2]+.10,z))
        # Keep whole palms and all attached digits with the wrist, not separate finger bends.
        if abs(x)>config['wrist'][0]-.04 and config['hand'][2]-.12<z<config['wrist'][2]+.02 and y<.12:arm=1
        upper=smooth(config['elbow'][2]-.04,config['elbow'][2]+.07,z)
        hand=1-smooth(config['wrist'][2]-.025,config['wrist'][2]+.045,z)
        head=smooth(config['head']-.08,config['head']+.02,z)*(1-arm)
        body=smooth(config['base']-.12,config['base']+.10,z)*(1-arm-head)
        low=max(0,1-arm-head-body)
        out={'Body':body,'Head':head,'Arm'+side+'Upper':arm*upper,'Arm'+side+'Lower':arm*(1-upper)*(1-hand),'Hand'+side:arm*(1-upper)*hand}
        if TYPE=='kongkoi':
            upper=smooth(.31,.43,z);foot=1-smooth(.11,.18,z)
            out.update(LegUpper=low*upper,LegLower=low*(1-upper)*(1-foot),LegFoot=low*(1-upper)*foot)
        elif TYPE=='takian':out['Root']=low
        else:out['Hem'+str(0 if x<-.12 else 2 if x>.12 else 1)]=low
    out=dict(sorted(out.items(),key=lambda item:item[1],reverse=True)[:4]);total=sum(out.values())
    counts={b:round(w/total*32) for b,w in out.items() if w/total>.01};counts={b:w for b,w in counts.items() if w}
    counts[max(counts,key=counts.get)]+=32-sum(counts.values())
    return {b:w/32 for b,w in counts.items() if w}

m=Milestone(TYPE+'-forest-'+VERSION);mut=m.mutate
try:
    for ob in call('scene.inspect')['result']['objectDetails']:mut('object.set_visibility',{'name':ob['name'],'viewport':False,'render':False})
    imported=mut('asset.import_file',{'path':str(OUT/'input'/f'{TYPE}.glb')})
    mesh=next(ob['name'] for ob in imported['objects'] if ob['name'].startswith(TYPE+'Source'));mut('object.rename',{'name':mesh,'newName':PREFIX+'Surface'});mesh=PREFIX+'Surface'
    topology=mut('mesh.inspect',{'name':mesh,'allowOpenSurface':True});points=[(x,-z,y) for x,y,z in json.loads((OUT/'input'/f'{TYPE}-positions.json').read_text())]
    assert topology['counts']['vertices']==len(points)
    for lo,hi in [([-2,-2,0],[0,2,.3]),([0,-2,.5],[2,0,1.2])]:
        sel=mut('mesh.select',{'name':mesh,'method':'spatial','min':lo,'max':hi});assert sel['vertices']==[i for i,p in enumerate(points) if all(a<=v<=b for a,v,b in zip(lo,p,hi))]
    rig=PREFIX+'Rig';rig_id=mut('rig.create_armature',{'name':rig,'bones':BONES})['objectId'];mut('rig.bind',{'mesh':{'name':mesh},'armature':{'name':rig}})
    skin_values=surface_weights(points,json.loads((OUT/'input'/f'{TYPE}-indices.json').read_text()),BONES) if TYPE not in ['monitor','khamot'] else None
    groups=collections.defaultdict(list)
    for i,p in enumerate(points):
        w=skin_values[i] if skin_values else weights(p);assert len(w)<=4 and abs(sum(w.values())-1)<1e-8
        if skin_values:
            counts={b:round(value*64) for b,value in w.items()};counts={b:v for b,v in counts.items() if v};counts[max(counts,key=counts.get)]+=64-sum(counts.values());w={b:v/64 for b,v in counts.items()}
        for b,value in w.items():groups[b,value].append(i)
    for (b,w),indices in groups.items():
        sel=mut('mesh.select',{'name':mesh,'method':'indices','vertices':indices});mut('rig.assign_weights',{'mesh':{'name':mesh},'bone':b,'selection':sel,'weight':w})
    print(json.dumps({'type':TYPE,'vertices':len(points),'bones':len(BONES),'groups':len(groups)}),flush=True)
    report={'bones':BONES,'legs':LEGS,'weightGroups':len(groups),'version':VERSION}
    if VERSION!='rest':
        if LEGS:
            calibration=json.loads(Path(__file__).with_name('pole-angles-forest.json').read_text())[TYPE]
            for l in LEGS:
                target_name=PREFIX+l['name']+'Target';pole_name=PREFIX+l['name']+'Pole'
                target=mut('rig.create_control',{'name':target_name,'location':l['joint'],'shape':'CIRCLE','size':.03});pole=mut('rig.create_control',{'name':pole_name,'location':l['pole'],'shape':'SPHERE','size':.02})
                mut('object.transform',{'name':target_name,'rotation':calibration['legs'][l['name']]['rotation']})
                mut('constraint.add_bone',{'armatureId':rig_id,'bone':l['name']+'Lower','name':'Plant-'+l['name'],'type':'IK','targetObjectId':target['objectId'],'poleObjectId':pole['objectId'],'chainLength':2,'poleAngle':calibration['legs'][l['name']]['poleAngle']})
                mut('constraint.add_bone',{'armatureId':rig_id,'bone':l['name']+'Foot','name':'Level-'+l['name'],'type':'COPY_TRANSFORMS','targetObjectId':target['objectId']});l['control']=target_name
        mut('animation.set_frame_range',{'start':1,'end':155})
        frames=sorted(set([1,13,25,37,49]+list(range(51,76,2))+[75,81,85,89,92,96,101,105,111,114,117,121,131,137,143,149,155]))
        for frame in frames:
            rot={b['name']:[0,0,0] for b in BONES};root=[0,0,0];body=[0,0,0];strike=wind=settle=recoil=0;wave=0
            if frame<=49:wave=math.sin((frame-1)/48*math.tau)
            elif frame<=75:wave=math.sin((frame-51)/24*math.tau)
            elif frame<=105:
                t=(frame-81)/24;wind=math.sin(math.pi*min(1,t/.42));strike=math.sin(math.pi*max(0,min(1,(t-.27)/.55)))
            elif frame<=121:recoil=math.sin(math.pi*(frame-111)/10)
            else:settle=smooth(0,1,(frame-131)/24)
            if TYPE=='monitor':
                rot['Neck'][0]=.012*wave-.035*wind+.10*strike-.06*recoil+.10*settle
                rot['Head'][0]=.014*wave+.06*strike
                for b,factor in [('TailBase',1),('TailMid',.7),('TailTip',.5)]:rot[b][2]=.025*wave*factor
                body=[v*.024*settle for v in calibration['bodyDownLocal']]
            elif TYPE=='khamot':
                root[1]=.025*(1-math.cos((frame-1)/48*math.tau)) if frame<=49 else .035*(1-math.cos((frame-51)/24*math.tau)) if frame<=75 else .04*strike+.025*settle
                rot['Body'][0]=-.06*wind+.15*strike-.10*recoil+.28*settle
                rot['FlameTip'][2]=.025*wave;rot['FlameTail'][2]=-.02*wave
            else:
                if TYPE=='kongkoi':
                    hop=math.sin((frame-51)/24*math.pi)**2 if 51<=frame<=75 else 0
                    root[1]=.17*hop
                    body=[v*(.24*settle+.035*hop) for v in calibration['bodyDownLocal']]
                elif TYPE!='takian':root[1]=(.018 if frame<=49 else .03)*(1-math.sqrt(max(0,1-wave*wave))) if frame<=75 else .03*strike+.025*settle
                rot['Body'][0]=.007*wave-.04*wind+.08*strike-.045*recoil+.20*settle
                rot['Head'][1]=.018*wave;rot['Head'][0]=-.04*recoil+.08*settle
                for side,s in [('L',-1),('R',1)]:
                    rot['Arm'+side+'Upper']=[-.55*strike+.04*wind,0,s*(.012*wave+.07*strike)]
                    rot['Arm'+side+'Lower'][0]=.32*strike+.10*settle
                for b in BONES:
                    if b['name'].startswith('Hem'):rot[b['name']][1]=.018*wave*(int(b['name'][-1])-1)
            for b in BONES:
                mut('animation.pose_keyframe',{'armature':rig,'bone':b['name'],'dataPath':'rotation_euler','frame':frame,'value':rot[b['name']]})
            for b,value in [('Root',root),('Body',body)]:mut('animation.pose_keyframe',{'armature':rig,'bone':b,'dataPath':'location','frame':frame,'value':value})
            if TYPE=='monitor':mut('animation.pose_keyframe',{'armature':rig,'bone':'TailBase','dataPath':'location','frame':frame,'value':[v*.024*settle for v in calibration['tailUpLocal']]})
            for l in LEGS:
                pos=l['joint'].copy()
                if TYPE=='kongkoi' and 51<=frame<=75:pos[2]+=.17*hop
                elif 51<=frame<=75:
                    phase=((frame-51)/24+l['phase'])%1
                    pos[1]-=.035*(.5-2*phase) if phase<.5 else .035*(-.5+2*(phase-.5));pos[2]+=0 if phase<.5 else math.sin((phase-.5)*math.tau)*.022
                mut('object.transform',{'name':l['control'],'location':pos});mut('animation.insert_keyframe',{'object':l['control'],'dataPath':'location','frame':frame})
        report['limbLength']=mut('validation.limb_length',{'armature':{'name':rig},'bones':[b['name'] for b in BONES if b['name'].endswith(('Upper','Lower'))],'frameStart':1,'frameEnd':155,'limit':.005}) if TYPE!='khamot' else None
        report['idleFeet']=[mut('validation.foot_drift',{'armature':{'name':rig},'bone':b['name'],'frameStart':1,'frameEnd':49,'limit':.001}) for b in BONES if b['name'].endswith('Foot')]
        assert not report['limbLength'] or report['limbLength']['passed'];assert all(f['passed'] for f in report['idleFeet'])
    mut('playback.set_frame',{'frame':1});mut('view.focus',{'object':mesh});mut('asset.pack_resources');report['skin']=mut('rig.inspect',{'name':rig})
    snapshot=m.commit();report.update(snapshotId=snapshot,sceneRevision=m.revision,editableSource=str(OUT.relative_to(Path.cwd())/f'{TYPE}-rig-{VERSION}.blend'))
    # export.file is L1 in this bridge. Snapshot-bound background exports are
    # the supported L3 delivery route; collect their terminal receipts before
    # extracting this species with extract_batch.mjs TYPE:VERSION.
    export=Milestone(TYPE+'-export-'+VERSION)
    try:
        report['jobs']=[export.mutate('job.submit',{'jobId':f'job_{TYPE}_{VERSION}_{fmt}','kind':'EXPORT','format':fmt,'parameters':{}}) for fmt in ['glb','blend']]
        # Poll terminal workers to release their two scheduler slots. Queued
        # snapshots remain immutable while the next species is authored.
        for status_file in (OUT/'jobs').glob('*/status.json'):
            status=json.loads(status_file.read_text())
            if status['jobId'].startswith('job_'):export.mutate('job.status',{'jobId':status['jobId']})
        report['exportSnapshotId']=export.commit()
    except Exception:export.rollback();raise
    report['editableSource']=str(OUT.relative_to(Path.cwd())/'jobs'/f'job_{TYPE}_{VERSION}_blend'/'artifact.blend')
    (OUT/f'{TYPE}-rig-report.json').write_text(json.dumps(report,indent=2))
    if VERSION!='rest':Path(__file__).with_name('rigs').joinpath(TYPE+'.json').write_text(json.dumps({k:report[k] for k in ['bones','legs','weightGroups','limbLength','idleFeet','version','editableSource','snapshotId','sceneRevision']},indent=2)+'\n')
    print(json.dumps({'type':TYPE,'version':VERSION,'snapshot':snapshot}),flush=True)
except Exception:
    m.rollback();raise
