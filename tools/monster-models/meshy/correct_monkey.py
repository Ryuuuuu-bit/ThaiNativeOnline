"""Bake a neutral neck-yaw correction through a temporary registered Blender rig.

Run after the original monkey prepare/unpack. Export is fresh and editable;
modifier application bakes the corrected mesh before its final locomotion rig.
"""
import collections
import os
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from harness_client import call,Milestone

version=sys.argv[1] if len(sys.argv)>1 else 'v4'
prefix='MacaqueNeck'+version.upper()
out=Path(os.environ.get('MESHY_RIG_OUTPUT','artifacts/meshy-rig-02')).resolve()
points=[(x,-z,y) for x,y,z in json.loads((out/'input/monkey-positions.json').read_text())]
def smooth(a,b,v):
    t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
m=Milestone('macaque-neutral-neck-'+version);mut=m.mutate
try:
    for obj in call('scene.inspect')['result']['objectDetails']:
        mut('object.set_visibility',{'name':obj['name'],'viewport':False,'render':False})
    imported=mut('asset.import_file',{'path':str(out/'input/monkey.glb')})
    source=next(obj['name'] for obj in imported['objects'] if obj['name'].startswith('monkeySource'))
    mut('object.rename',{'name':source,'newName':prefix+'Surface'});mesh=prefix+'Surface'
    topology=mut('mesh.inspect',{'name':mesh,'allowOpenSurface':True})
    assert topology['counts']['vertices']==len(points)
    for lo,hi in [([-2,-2,1.2],[2,0,2]),([-2,-2,0],[0,2,.3])]:
        selection=mut('mesh.select',{'name':mesh,'method':'spatial','min':lo,'max':hi})
        assert selection['vertices']==[i for i,p in enumerate(points) if all(a<=v<=b for a,v,b in zip(lo,p,hi))], 'source coordinates/order differ'
    mut('rig.create_armature',{'name':prefix+'Rig','bones':[
        {'name':'Root','head':[0,0,0],'tail':[0,.2,0]},
        {'name':'Head','head':[0,-.55,1.05],'tail':[0,-.55,1.54],'parent':'Root'}]})
    mut('rig.bind',{'mesh':{'name':mesh},'armature':{'name':prefix+'Rig'}})
    groups=collections.defaultdict(list)
    for index,(x,y,z) in enumerate(points):
        weight=round(smooth(.88,1.08,z)*(1-smooth(-.36,-.12,y))*32)/32
        if weight:groups['Head',weight].append(index)
        if weight<1:groups['Root',1-weight].append(index)
    for (bone,weight),indices in groups.items():
        selection=mut('mesh.select',{'name':mesh,'method':'indices','vertices':indices})
        mut('rig.assign_weights',{'mesh':{'name':mesh},'bone':bone,'selection':selection,'weight':weight})
    # Set the Euler rotation mode before recording the actual correction.
    mut('animation.pose_keyframe',{'armature':prefix+'Rig','bone':'Head','dataPath':'rotation_euler','frame':1,'value':[0,0,0]})
    mut('animation.pose_keyframe',{'armature':prefix+'Rig','bone':'Head','dataPath':'rotation_euler','frame':1,'value':[0,-1.25,0]})
    mut('playback.set_frame',{'frame':1})
    mut('view.focus',{'object':mesh})
    pose_snapshot=m.commit()
    posed=call('export.file',{'path':str(out/f'monkey-neck-{version}-posed.glb'),'snapshotId':pose_snapshot,'parameters':{'use_visible':True,'use_renderable':True,'export_apply':False,'export_animations':True}})
    print('posed export complete',flush=True)
    m=Milestone('macaque-neck-bake-'+version);mut=m.mutate
    mut('playback.set_frame',{'frame':2})
    mut('playback.set_frame',{'frame':1})
    mut('modifier.apply',{'name':mesh,'modifierName':'Armature Deform'})
    # Parenting to a non-deforming control keeps the temporary skeleton out of export.
    root=mut('rig.create_control',{'name':prefix+'Root','location':[0,0,0],'shape':'CIRCLE','size':.1})
    mut('object.parent',{'child':mesh,'parent':prefix+'Root','keepWorld':True})
    mut('object.set_visibility',{'name':prefix+'Rig','viewport':False,'render':False})
    mut('asset.pack_resources')
    snapshot=m.commit()
    results={}
    for extension in ['blend','glb']:
        args={'path':str(out/f'monkey-neutral-corrected-{version}.{extension}'),'snapshotId':snapshot}
        if extension=='glb':args['parameters']={'use_visible':True,'use_renderable':True,'export_animations':False}
        results[extension]=call('export.file',args)
    (out/f'monkey-neck-correction-{version}-receipts.json').write_text(json.dumps(results,indent=2))
    print(json.dumps({'snapshot':snapshot,'yawRadians':-1.25,'weightGroups':len(groups)}))
except Exception:
    m.rollback();raise
