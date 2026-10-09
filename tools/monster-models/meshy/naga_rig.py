"""Measured Meshy Naga rig; no biped retargeting or automatic weights.

Offline weight/pose helpers have no live side effects. Bind and animate use only
registered Harness commands. A fixed coil supports a continuous weighted neck.
The six source joints were measured from this candidate's four cardinal views
and 1.9m decoded source; authored masks never add or replace source geometry.
"""
import argparse
import collections
import importlib
import json
import math
import os
from pathlib import Path
import sys

import boss_rig as snapshot_exporter
from boss_rig import sha, write_json

TYPE = 'sunken_city_3'
PREFIX = 'SunkenNagaBossV1'
CLIPS = {'idle': [1, 49], 'walk': [51, 75], 'attack': [81, 105], 'hurt': [111, 121], 'die': [131, 155]}
FRAMES = sorted({1,13,25,37,49,*range(51,76,2),75,81,85,89,92,96,101,105,111,114,117,121,131,137,143,149,155})

def smooth(a, b, v):
    t = max(0., min(1., (v-a)/(b-a)))
    return t*t*(3-2*t)

def root():
    return Path(os.environ.get('MESHY_RIG_OUTPUT', 'artifacts/meshy-boss-02')).resolve()

def client():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    return importlib.import_module('harness_client')

def inputs():
    out = root(); source = out/'input'
    paths = {key: source/f'{TYPE}{suffix}' for key,suffix in {'source':'.glb','positions':'-positions.json','indices':'-indices.json','anatomy':'-anatomy.json'}.items()}
    recipe = json.loads(paths['anatomy'].read_text())
    if recipe['type'] != TYPE or recipe['taxon'] != 'serpent' or recipe['legs'] or recipe['arms']:
        raise ValueError('This source is one continuous serpent with zero arms or legs')
    points = [(x,-z,y) for x,y,z in json.loads(paths['positions'].read_text())]
    if abs(max(p[2] for p in points)-min(p[2] for p in points)-1.9)>.005 or abs(min(p[2] for p in points))>.001:
        raise ValueError('Expected measured grounded 1.9m Naga source')
    return out, paths, recipe, points

def weights(p):
    x,y,z = p
    # The raised tail occupies the rear-right quadrant. Blend at its true coil
    # junction rather than assigning the neighbouring front neck to a tail bone.
    tail = smooth(.31,.46,x)*smooth(.20,.40,y)*smooth(.27,.47,z)
    neck = smooth(.27,.51,z)*(1-smooth(-.12,.06,y))*(1-smooth(.26,.42,abs(x-.07)))
    # The entire broad hood belongs to the upper neck/head. A narrow lower-neck
    # mask must never leave lateral hood scales pinned to the grounded coil.
    upper_hood = smooth(.85,1.0,z)
    neck = neck*(1-upper_hood)+upper_hood
    upper = smooth(.68,.93,z)
    head = smooth(1.06,1.23,z)
    result = {'GroundCoil':(1-tail)*(1-neck), 'NeckLower':(1-tail)*neck*(1-upper),
              'NeckUpper':(1-tail)*neck*upper*(1-head), 'Head':(1-tail)*neck*upper*head,'Tail':tail}
    pairs = sorted(((k,v) for k,v in result.items() if v>1e-9),key=lambda kv:-kv[1])[:4]
    total = sum(v for _,v in pairs)
    return {k:v/total for k,v in pairs}

def bind(reweight=False):
    out,paths,recipe,points = inputs(); report_path=out/f'{TYPE}-rig-report.json'
    if report_path.exists() and not reweight:
        raise FileExistsError('Existing Naga bind must be inspected, never duplicated')
    previous=json.loads(report_path.read_text()) if reweight else {}
    if reweight and (previous['inputHashes']!={k:sha(p) for k,p in paths.items()} or previous['bones']!=recipe['bones']):
        raise ValueError('Naga reweight requires exact existing source, topology and measured bones')
    values = [weights(p) for p in points]; groups=collections.defaultdict(list)
    for i,values_i in enumerate(values):
        if len(values_i)>4 or abs(sum(values_i.values())-1)>1e-8:
            raise ValueError('Invalid normalized serpent skin')
    # Quantization keeps bounded registered weight groups while summing exactly
    # to one; no nearest humanoid joint or topology rewrite.
    quantized=[]
    for v in values:
        counts={k:round(w*64) for k,w in v.items()}; counts={k:n for k,n in counts.items() if n}
        largest=max(counts,key=counts.get); counts[largest]+=64-sum(counts.values())
        quantized.append({k:n/64 for k,n in counts.items() if n>0})
    for i,v in enumerate(quantized):
        for bone,weight in v.items(): groups[bone,weight].append(i)
    c=client(); c.call('scene.inspect'); m=c.Milestone('naga-measured-bind')
    try:
        surface=PREFIX+'Surface'; rig=PREFIX+'Rig'
        if not reweight:
            imported=m.mutate('asset.import_file',{'path':str(paths['source'])})
            if sum(o['name']==TYPE+'Source' for o in imported['objects'])!=1: raise ValueError('Exact Naga surface required')
            m.mutate('object.rename',{'name':TYPE+'Source','newName':surface})
        topology=m.mutate('mesh.inspect',{'name':surface,'allowOpenSurface':True})
        if topology['counts']['vertices']!=len(points): raise ValueError('Decoded source topology changed')
        # Check imported original-index identity before assigning measured masks.
        for lo,hi in [([-2,-2,0],[2,2,.3]),([-2,-2,1],[2,2,2])]:
            sel=m.mutate('mesh.select',{'name':surface,'method':'spatial','min':lo,'max':hi})
            if sel['vertices']!=[i for i,p in enumerate(points) if all(a<=v<=b for a,v,b in zip(lo,p,hi))]: raise ValueError('Source vertex ordering changed')
        if reweight:
            rid=previous['rigId']
            sel=m.mutate('mesh.select',{'name':surface,'method':'indices','vertices':list(range(len(points)))})
            for b in recipe['bones']:
                if b['deform']:m.mutate('rig.assign_weights',{'mesh':{'name':surface},'bone':b['name'],'selection':sel,'weight':0})
        else:
            rid=m.mutate('rig.create_armature',{'name':rig,'bones':recipe['bones']})['objectId']
            m.mutate('rig.bind',{'mesh':{'name':surface},'armature':{'name':rig}})
        for (bone,weight),indices in sorted(groups.items()):
            sel=m.mutate('mesh.select',{'name':surface,'method':'indices','vertices':indices})
            m.mutate('rig.assign_weights',{'mesh':{'name':surface},'bone':bone,'selection':sel,'weight':weight})
        skin=m.mutate('rig.inspect',{'name':rig})
        if skin['boundMeshes']!=[surface]: raise ValueError('One Naga bound surface required')
        snapshot=m.commit()
    except Exception:
        m.rollback(); raise
    cache=out/f'{TYPE}-applied-weights.json'; write_json(cache,quantized)
    report=previous|{'type':TYPE,'taxon':'serpent','rigName':rig,'surfaceName':surface,'rigId':rid,'prefix':PREFIX,
            'bones':recipe['bones'],'legs':[],'arms':[],'tail':['Tail'],'inputHashes':{k:sha(p) for k,p in paths.items()},
            'skin':skin,'snapshotId':snapshot,'sceneRevision':m.revision,'appliedWeightsSha256':sha(cache),
            'weightsAlgorithmSha256':sha(__file__),'requiresFreshExportAndQA':True,
            'weights':{'vertices':len(points),'maxInfluences':max(map(len,quantized)),'maxSumError':max(abs(sum(w.values())-1) for w in quantized)}}
    write_json(report_path,report); return report

def world_pose(frame):
    pitch=roll=tip=0.
    if frame<=49:
        t=(frame-1)/48*math.tau; pitch=.014*math.sin(t); roll=.025*math.sin(t); tip=.015*math.sin(t)
    elif frame<=75:
        t=(frame-51)/24*math.tau; pitch=.035*math.sin(t); roll=.15*math.sin(t); tip=.045*math.sin(t)
    elif frame<=105:
        t=(frame-81)/24; wind=math.sin(math.pi*min(1,t/.42)); strike=math.sin(math.pi*max(0,min(1,(t-.27)/.55)))
        pitch=-.10*wind+.48*strike; tip=.04*strike
    elif frame<=121:
        pitch=-.32*math.sin(math.pi*(frame-111)/10)
    else:
        pitch=1.15*smooth(0,1,(frame-131)/24)
    return {'GroundCoil':[0.,0.,0.],'NeckLower':[pitch*.48,roll*.5,0.],
            'NeckUpper':[pitch*.32,roll*.5,0.],'Head':[pitch*.20,0.,0.],'Tail':[0.,0.,tip]}

def animate(repose=False):
    out,paths,recipe,points=inputs(); rp=out/f'{TYPE}-rig-report.json'; report=json.loads(rp.read_text())
    if ('animationSnapshotId' in report)!=repose: raise ValueError('Use animate once; repose only an existing authored Naga')
    calibration=json.loads((out/f'{TYPE}-calibration.json').read_text()); rest=json.loads((out/f'{TYPE}-rest-export.json').read_text())
    receipt=rest['jobs'][0]['verifiedStatus']['artifact']
    if sha(receipt['path'])!=receipt['sha256'] or calibration['restGlbSha256']!=receipt['sha256'] or calibration['anatomySha256']!=sha(paths['anatomy']): raise ValueError('Rest-bound Naga calibration required')
    c=client();c.call('scene.inspect');m=c.Milestone('naga-five-motions')
    try:
        m.mutate('animation.set_frame_range',{'start':1,'end':155})
        for frame in FRAMES:
            for bone,angles in world_pose(frame).items():
                axes=calibration['axes'][bone]
                local=[sum(axes[j][i]*angles[j] for j in range(3)) for i in range(3)]
                m.mutate('animation.pose_keyframe',{'armature':report['rigName'],'bone':bone,'dataPath':'rotation_euler','frame':frame,'value':local})
        checks={}
        for name,(start,end) in CLIPS.items():
            checks[name]=m.mutate('validation.floor_penetration',{'object':{'name':report['surfaceName']},'frameStart':start,'frameEnd':end,'floorZ':0.,'limit':.01})
        if any(not v['passed'] for v in checks.values()): raise ValueError('Naga source floor gate failed')
        m.mutate('playback.set_frame',{'frame':1}); snapshot=m.commit()
    except Exception:
        m.rollback();raise
    report.update(animationSnapshotId=snapshot,sceneRevision=m.revision,validation={'floor':checks},clips=CLIPS,framesPerSecond=24,calibration=calibration,animationAlgorithmSha256=sha(__file__),runtimeClipExtractionPending=True)
    write_json(rp,report);return report

def export_root(out=None):
    """Validate species before delegating snapshot jobs or opening transport."""
    directory=Path(out).resolve() if out is not None else root()
    report=snapshot_exporter.read_json(directory/f'{TYPE}-rig-report.json')
    if report.get('type')!=TYPE or report.get('taxon')!='serpent' or report.get('legs')!=[] or report.get('arms')!=[]:
        raise ValueError('Naga export requires a serpent report with zero arms and legs')
    return directory


def export(tag,wait_seconds=30,*,out=None,client=None):
    # Reuse the prepared journal and reserved identities, including legacy
    # job_naga_* IDs. The shared exporter owns revision/hash and unknown-response
    # guards; it never binds, retargets or calls the biped motion recipe.
    directory=export_root(out)
    return snapshot_exporter.export(TYPE,tag,out=directory,client=client,wait_seconds=wait_seconds)


def collect(tag,*,out=None,client=None,recover=False):
    directory=export_root(out)
    return snapshot_exporter.collect(TYPE,tag,out=directory,client=client,recover=recover)

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['bind','reweight','animate','repose','export','collect']);p.add_argument('tag',nargs='?');a=p.parse_args()
    if a.mode in ('export','collect') and not a.tag:p.error('Recorded export tag required')
    r=bind(a.mode=='reweight') if a.mode in ('bind','reweight') else animate(a.mode=='repose') if a.mode in ('animate','repose') else export(a.tag) if a.mode=='export' else collect(a.tag)
    print(json.dumps({'type':TYPE,'mode':a.mode,'completed':r.get('completed'),'snapshotId':r.get('animationSnapshotId',r.get('snapshotId')),'jobs':[{'jobId':j['jobId'],'state':j.get('lastState')} for j in r.get('jobs',[])]}))

if __name__=='__main__':main()
