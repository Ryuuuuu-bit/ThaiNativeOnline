"""Wat Rang anatomical rigs, planted-foot controls, and five editable clips.

Usage: bind TYPE; export rest; animate TYPE; export final; collect TAG.
All Blender mutations use the registered Harness and snapshot-bound L3 jobs.
Rest bases are calibrated from the exported GLB before IK is enabled.
"""
import collections, hashlib, json, math, os, sys, time
from pathlib import Path
from wat_weights import wat_weights
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from harness_client import call, Milestone
OUT=Path(os.environ.get('MESHY_RIG_OUTPUT','artifacts/meshy-rig-04/wat-rang')).resolve()
TYPES=['headless','pret','krahang','krasue','phitaihong','soldier','pusom']
MODE=sys.argv[1];TYPE=sys.argv[2] if len(sys.argv)>2 else None

def prefix(kind):return kind.title()+'V1'
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)

def skeleton(kind):
    bones=[];legs=[]
    def bone(name,head,tail,parent='Body',deform=True):
        bones.append(dict(name=name,head=head,tail=tail,parent=parent,deform=deform,connected=False))
    bone('Root',[0,0,0],[0,0,.2],None,False)
    if kind=='krasue':
        bone('Body',[0,0,.84],[0,0,.95],'Root')
        bone('Head',[0,0,.95],[0,0,1.90])
        bone('Heart',[0,-.03,.73],[0,-.03,.55])
        bone('LungL',[-.18,0,.70],[-.18,0,.32]);bone('LungR',[.18,0,.70],[.18,0,.32])
        bone('CoilBase',[.03,0,.38],[0,0,.18]);bone('CoilTip',[0,0,.18],[.03,0,.04],'CoilBase')
        return bones,legs
    configs={
      'headless':dict(hip=.97,neck=1.79,head=None,shoulder=[.24,0,1.70],elbow=[.34,-.01,1.37],wrist=[.47,-.035,1.03],hand=[.49,-.04,.90],legX=.20,knee=.51),
      'pret':dict(hip=.95,neck=1.61,head=1.65,shoulder=[.16,0,1.56],elbow=[.27,-.01,1.23],wrist=[.40,-.02,.84],hand=[.43,-.025,.65],legX=.13,knee=.54),
      'krahang':dict(hip=.87,neck=1.57,head=1.59,shoulder=[.24,.04,1.48],elbow=[.37,.01,1.22],wrist=[.80,-.22,1.31],hand=[.82,-.23,1.26],legX=.24,knee=.49),
      'phitaihong':dict(hip=.88,neck=1.56,head=1.61,shoulder=[.16,0,1.51],elbow=[.24,-.015,1.20],wrist=[.30,-.035,.94],hand=[.31,-.04,.79],legX=.13,knee=.47),
      'soldier':dict(hip=.86,neck=1.49,head=1.52,shoulder=[.24,.03,1.42],elbow=[.34,-.005,1.12],wrist=[.40,-.06,.90],hand=[.41,-.08,.79],legX=.17,knee=.46),
      'pusom':dict(hip=.89,neck=1.53,head=1.56,shoulder=[.26,.02,1.47],elbow=[.39,-.015,1.20],wrist=[.49,-.035,.99],hand=[.51,-.04,.85],legX=.23,knee=.42),
    }
    c=configs[kind]
    bone('Pelvis',[0,0,c['hip']],[0,0,c['hip']+.12],'Root')
    bone('Body',[0,0,c['hip']+.12],[0,0,c['neck']],'Pelvis')
    if c['head']:bone('Head',[0,0,c['head']],[0,0,1.90])
    for side,s in [('L',-1),('R',1)]:
        p=[[s*v[0],v[1],v[2]] for v in [c['shoulder'],c['elbow'],c['wrist'],c['hand']]]
        bone('Arm'+side+'Upper',p[0],p[1]);bone('Arm'+side+'Lower',p[1],p[2],'Arm'+side+'Upper');bone('Hand'+side,p[2],p[3],'Arm'+side+'Lower')
        x=s*c['legX'];hip=[x,0,c['hip']];knee=[x,-.035,c['knee']];ankle=[x,0,.10];toe=[x,-.15,.045]
        name='Leg'+side
        bone(name+'Upper',hip,knee,'Pelvis');bone(name+'Lower',knee,ankle,name+'Upper');bone(name+'Foot',ankle,toe,name+'Lower')
        legs.append(dict(name=name,hip=hip,knee=knee,joint=ankle,ankle=ankle,toe=toe,pole=[x,-.5,c['knee']],phase=0 if s<0 else .5))
    if kind=='krahang':
        for side,s in [('L',-1),('R',1)]:bone('Tray'+side,[s*.8,-.22,1.31],[s*.40,-.22,1.31],'Hand'+side)
        bone('Pestle',[0,.25,1.12],[0,.25,.35],'Pelvis')
    if kind=='soldier':
        bone('Sword',[-.40,-.10,.81],[-.55,-.20,.48],'HandL')
        bone('Shield',[.42,-.15,1.05],[.45,-.15,.78],'HandR')
    return bones,legs

def bind(kind,reweight=False,weights_file=None):
    bones,legs=skeleton(kind);pfx=prefix(kind);m=Milestone(kind+'-bind-wat');mut=m.mutate
    previous=json.loads((OUT/f'{kind}-rig-report.json').read_text()) if reweight else {}
    if reweight:legs=previous['legs']
    try:
        call('scene.inspect')
        # Blender's asset root is the approved Meshy directory; decoded input
        # copies live there, while large snapshots/reports stay in artifacts.
        mesh=pfx+'Surface';rig=pfx+'Rig'
        if not reweight:
            imported=mut('asset.import_file',{'path':str(Path(__file__).with_name('.authoring')/f'{kind}.glb')})
            original=next(o['name'] for o in imported['objects'] if o['name'].startswith(kind+'Source'))
            mut('object.rename',{'name':original,'newName':mesh})
        topology=mut('mesh.inspect',{'name':mesh,'allowOpenSurface':True})
        points=[(x,-z,y) for x,y,z in json.loads((OUT/'input'/f'{kind}-positions.json').read_text())]
        assert topology['counts']['vertices']==len(points)
        if not reweight:
            rid=mut('rig.create_armature',{'name':rig,'bones':bones})['objectId']
            mut('rig.bind',{'mesh':{'name':mesh},'armature':{'name':rig}})
        else:
            rid=json.loads((OUT/f'{kind}-rig-report.json').read_text())['rigId']
        values=json.loads(Path(weights_file).read_text()) if weights_file else wat_weights(points,json.loads((OUT/'input'/f'{kind}-indices.json').read_text()),bones)
        patch_file=Path(__file__).with_name('rigs')/f'{kind}-weight-patch.json'
        if not weights_file and patch_file.exists():
            patch=json.loads(patch_file.read_text())
            assert hashlib.sha256((OUT/'input'/f'{kind}-positions.json').read_bytes()).hexdigest()==patch['inputPositionsSha256']
            assert hashlib.sha256(json.dumps(values,sort_keys=True).encode()).hexdigest()==patch['baseWeightsSha256']
            for index,weight in patch['vertices'].items():values[int(index)]=weight
        assert len(values)==len(points)
        cache=OUT/f'{kind}-applied-weights.json'
        assigned=json.loads(cache.read_text()) if reweight and weights_file and cache.exists() else None
        changed=[i for i,w in enumerate(values) if assigned is None or w!=assigned[i]]
        changed_set=set(changed)
        if reweight and changed:
            sel=mut('mesh.select',{'name':mesh,'method':'indices','vertices':changed})
            for b in bones:
                if b['deform']:mut('rig.assign_weights',{'mesh':{'name':mesh},'bone':b['name'],'selection':sel,'weight':0})
        groups=collections.defaultdict(list)
        for i,w in enumerate(values):
            assert len(w)<=4 and abs(sum(w.values())-1)<1e-8 and all(math.isfinite(v) and 0<=v<=1 for v in w.values())
            assert all(name in {b['name'] for b in bones if b['deform']} for name in w)
            if assigned is None or i in changed_set:
                for b,v in w.items():groups[b,v].append(i)
        for (b,w),indices in groups.items():
            sel=mut('mesh.select',{'name':mesh,'method':'indices','vertices':indices})
            mut('rig.assign_weights',{'mesh':{'name':mesh},'bone':b,'selection':sel,'weight':w})
        skin=mut('rig.inspect',{'name':rig});snapshot=m.commit()
        report=previous|dict(type=kind,version='v1',bones=bones,legs=legs,weightGroups=len(groups),rigId=rid,skin=skin,snapshotId=snapshot,sceneRevision=m.revision)
        if weights_file:report['weightRecipeSha256']=hashlib.sha256(Path(__file__).with_name('wat_weights.py').read_bytes()).hexdigest();report['weightValuesSha256']=hashlib.sha256(Path(weights_file).read_bytes()).hexdigest()
        if reweight:Path(__file__).with_name('rigs').joinpath(kind+'.json').write_text(json.dumps(report,indent=2)+'\n')
        (OUT/f'{kind}-rig-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'type':kind,'groups':len(groups),'vertices':len(points)}),flush=True)
        cache.write_text(json.dumps(values))
    except Exception:m.rollback();raise

def animate(kind):
    report=json.loads((OUT/f'{kind}-rig-report.json').read_text());bones=report['bones'];legs=report['legs'];rig=prefix(kind)+'Rig'
    calibration=json.loads((OUT/'calibration.json').read_text()).get(kind,{});m=Milestone(kind+'-animate-wat');mut=m.mutate
    try:
        for l in legs:
            if l.get('control'):continue
            target_name=prefix(kind)+l['name']+'Target';pole_name=prefix(kind)+l['name']+'Pole'
            target=mut('rig.create_control',{'name':target_name,'location':l['joint'],'shape':'CIRCLE','size':.03});pole=mut('rig.create_control',{'name':pole_name,'location':l['pole'],'shape':'SPHERE','size':.02})
            mut('object.transform',{'name':target_name,'rotation':calibration['legs'][l['name']]['rotation']})
            mut('constraint.add_bone',{'armatureId':report['rigId'],'bone':l['name']+'Lower','name':'Plant-'+l['name'],'type':'IK','targetObjectId':target['objectId'],'poleObjectId':pole['objectId'],'chainLength':2,'poleAngle':calibration['legs'][l['name']]['poleAngle']})
            mut('constraint.add_bone',{'armatureId':report['rigId'],'bone':l['name']+'Foot','name':'Level-'+l['name'],'type':'COPY_TRANSFORMS','targetObjectId':target['objectId']});l['control']=target_name
        mut('animation.set_frame_range',{'start':1,'end':155})
        frames=sorted(set([1,13,25,37,49]+list(range(51,76,2))+[75,81,85,89,92,96,101,105,111,114,117,121,131,137,143,149,155]))
        for f in frames:
            rot={b['name']:[0,0,0] for b in bones};wave=strike=wind=recoil=settle=0;root=[0,0,0]
            if f<=49:wave=math.sin((f-1)/48*math.tau)
            elif f<=75:wave=math.sin((f-51)/24*math.tau)
            elif f<=105:
                t=(f-81)/24;wind=math.sin(math.pi*min(1,t/.42));strike=math.sin(math.pi*max(0,min(1,(t-.27)/.55)))
            elif f<=121:recoil=math.sin(math.pi*(f-111)/10)
            else:settle=smooth((f-131)/24)
            rot['Body'][0]=.004*wave-.035*wind+.10*strike-.04*recoil+.22*settle
            if 'Head' in rot:rot['Head']=[-.02*recoil+.05*settle,.012*wave,0]
            root[1]=(-.10 if kind=='headless' else -.12)*settle;root[2]=.035*strike
            if kind in ['krahang','krasue']:root[1]=.035*(1-math.cos((f-1)/48*math.tau)) if f<=49 else .045*(1-math.cos((f-51)/24*math.tau)) if f<=75 else -.12*settle
            if kind=='krasue':
                rot['CoilBase'][0]=.035*wave+.08*strike;rot['CoilTip'][2]=.025*wave
            for side,s in [('L',-1),('R',1)]:
                if kind=='krasue':continue
                if kind=='krahang':
                    rot['Arm'+side+'Upper']=[-.10*strike,0,s*(.06*wave+.12*strike)]
                    rot['Arm'+side+'Lower'][0]=.04*wave
                elif kind=='soldier':
                    rot['Arm'+side+'Upper']=[(-.75 if side=='L' else -.25)*strike+.09*wind,0,s*.04*strike]
                    rot['Arm'+side+'Lower'][0]=.30*strike if side=='L' else .08*strike
                else:
                    # Pret's unusually thin, long arms need a restrained sweep:
                    # the broad generic arc pinches its frontal elbow contour.
                    upper=-.22 if kind=='pret' else -.36 if kind=='pusom' else -.48
                    rot['Arm'+side+'Upper']=[upper*strike+.04*wind,0,s*(.008*wave+.07*strike)]
                    rot['Arm'+side+'Lower'][0]=(.12 if kind=='pret' else .25)*strike+.06*settle
            for b in bones:mut('animation.pose_keyframe',{'armature':rig,'bone':b['name'],'dataPath':'rotation_euler','frame':f,'value':rot[b['name']]})
            mut('animation.pose_keyframe',{'armature':rig,'bone':'Root','dataPath':'location','frame':f,'value':root})
            for l in legs:
                pos=l['joint'].copy()
                if 51<=f<=75 and kind!='krahang':
                    phase=((f-51)/24+l['phase'])%1;pos[1]+=.06*math.sin(phase*math.tau);pos[2]+=.055*max(0,math.sin(phase*math.tau))
                elif kind=='krahang':pos[2]+=root[1]
                mut('object.transform',{'name':l['control'],'location':pos});mut('animation.insert_keyframe',{'object':l['control'],'dataPath':'location','frame':f})
        report['limbLength']=mut('validation.limb_length',{'armature':{'name':rig},'bones':[b['name'] for b in bones if b['name'].endswith(('Upper','Lower'))],'frameStart':1,'frameEnd':155,'limit':.005}) if legs else None
        report['idleFeet']=[mut('validation.foot_drift',{'armature':{'name':rig},'bone':l['name']+'Foot','frameStart':1,'frameEnd':49,'limit':.001}) for l in legs] if kind!='krahang' else []
        assert (not report['limbLength'] or report['limbLength']['passed']) and all(i['passed'] for i in report['idleFeet'])
        mut('playback.set_frame',{'frame':1});mut('view.focus',{'object':prefix(kind)+'Surface'});report['animationSnapshotId']=m.commit();report['sceneRevision']=m.revision
        (OUT/f'{kind}-rig-report.json').write_text(json.dumps(report,indent=2));Path(__file__).with_name('rigs').joinpath(kind+'.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'type':kind,'animated':True}),flush=True)
    except Exception:m.rollback();raise

def export(tag):
    m=Milestone('wat-export-'+tag)
    try:
        for ob in call('scene.inspect')['result']['objectDetails']:
            visible=any(ob['name'] in [prefix(k)+'Rig',prefix(k)+'Surface'] for k in TYPES)
            m.mutate('object.set_visibility',{'name':ob['name'],'viewport':visible,'render':visible})
        m.mutate('playback.set_frame',{'frame':1});m.mutate('asset.pack_resources');snapshot=m.commit()
        file=OUT/f'{tag}-export.json'
        if file.exists():raise RuntimeError('Export tag exists; collect its jobs instead of submitting again.')
        report=dict(snapshotId=snapshot,sceneRevision=m.revision,jobs=[])
        file.write_text(json.dumps(report,indent=2))
        # Keep a durable job identity before dispatch. Run exports sequentially:
        # a lost submit response must be recovered by status, never a new POST.
        for fmt in (['glb'] if tag=='rest' else ['glb','blend']):
            jid=f'job_wat_{tag}_{fmt}';report['jobs'].append({'jobId':jid});file.write_text(json.dumps(report,indent=2))
            jobs=Milestone('wat-job-'+tag+'-'+fmt)
            try:
                jobs.mutate('job.submit',{'jobId':jid,'kind':'EXPORT','format':fmt,'parameters':{}});jobs.commit()
            except Exception:
                jobs.rollback()  # Recover this exact job below, without resubmission.
            for _ in range(60):
                status=call('job.status',{'jobId':jid})['result']
                if status['state']=='completed':break
                if status['state'] in ['failed','cancelled']:raise RuntimeError(json.dumps(status))
                time.sleep(2)
            else:raise RuntimeError('Export still running; collect the recorded job.')
            a=status['artifact'];data=Path(a['path']).read_bytes()
            assert len(data)==a['bytes'] and hashlib.sha256(data).hexdigest()==a['sha256']
            print(tag,fmt,'export verified',flush=True)
        print(tag,'exports completed',flush=True)
    except Exception:m.rollback();raise

def collect(tag):
    file=OUT/f'{tag}-export.json';r=json.loads(file.read_text());m=Milestone('wat-collect-'+tag)
    try:
        statuses=[m.mutate('job.status',{'jobId':j['jobId']}) for j in r['jobs']];m.commit()
    except Exception:m.rollback();raise
    for j in statuses:
        if j['state']=='completed':
            a=j['artifact'];data=Path(a['path']).read_bytes();assert len(data)==a['bytes'] and hashlib.sha256(data).hexdigest()==a['sha256']
    r['productionExports']=statuses;file.write_text(json.dumps(r,indent=2));print(json.dumps([{'id':j['jobId'],'state':j['state'],'artifact':j.get('artifact')} for j in statuses]));sys.exit(0 if all(j['state']=='completed' for j in statuses) else 1)

if MODE=='bind':bind(TYPE)
elif MODE=='reweight':bind(TYPE,True)
elif MODE=='applyweights':bind(TYPE,True,sys.argv[3])
elif MODE=='animate':animate(TYPE)
elif MODE=='export':export(TYPE)
elif MODE=='collect':collect(TYPE)
else:raise ValueError('Unknown stage')
