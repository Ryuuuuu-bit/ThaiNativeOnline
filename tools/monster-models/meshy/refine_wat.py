"""Topology-preserving organic smoothing and a rigid frontal shield guard.

Coordinates are calculated here; all geometry edits are registered L3
sculpt.displace / mesh.edit commands. UV seam copies move together.
Run once against the original V1 bind surface, after weight correction.
"""
import collections,json,math,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from harness_client import call,Milestone
OUT=Path(os.environ.get('MESHY_RIG_OUTPUT','artifacts/meshy-rig-04/wat-rang'))
kind=sys.argv[1]
receipt=OUT/(kind+('-surface-refinement.json' if kind=='krasue' else '-final-guard-refinement.json'))
if receipt.exists():raise RuntimeError('Refinement already recorded; reopen the original bind snapshot before replaying.')

if kind=='krasue':
    raw=json.loads((OUT/'input/krasue-positions.json').read_text())
    points=[(x,-z,y) for x,y,z in raw]
    keys=[tuple(round(v,5) for v in p) for p in points]
    unique=list(dict.fromkeys(keys));lookup={p:i for i,p in enumerate(unique)}
    remap=[lookup[p] for p in keys];graph=[set() for _ in unique]
    indices=json.loads((OUT/'input/krasue-indices.json').read_text())
    for i in range(0,len(indices),3):
        tri=[remap[v] for v in indices[i:i+3]]
        for a,b in zip(tri,tri[1:]+tri[:1]):
            if a!=b:graph[a].add(b);graph[b].add(a)
    edited=[list(p) for p in unique]
    def mask(z):
        t=max(0,min(1,(.91-z)/.15));return t*t*(3-2*t)
    # Alternating positive/negative Laplacian steps soften the coil silhouette
    # while limiting shrinkage. Hair, face and the neck remain unchanged.
    for _ in range(6):
        for strength in [.50,-.51]:
            next_points=[]
            for i,p in enumerate(edited):
                if not graph[i] or not mask(unique[i][2]):next_points.append(p);continue
                avg=[sum(edited[n][a] for n in graph[i])/len(graph[i]) for a in range(3)]
                next_points.append([v+strength*mask(unique[i][2])*(avg[a]-v) for a,v in enumerate(p)])
            edited=next_points
    groups=collections.defaultdict(list)
    for vi,(p,q) in enumerate(zip(unique,edited)):
        delta=[v-u for u,v in zip(p,q)];length=math.sqrt(sum(v*v for v in delta))
        if length>.025:delta=[v*.025/length for v in delta]
        delta=tuple(round(v,6) for v in delta)
        if math.dist(delta,[0,0,0])>.00001:groups[delta].extend(i for i,r in enumerate(remap) if r==vi)
    m=Milestone('krasue-rounded-organ-contours')
    try:
        m.mutate('playback.set_frame',{'frame':1})
        for delta,vertices in groups.items():
            selection=m.mutate('mesh.select',{'name':'KrasueV1Surface','method':'indices','vertices':vertices})
            m.mutate('sculpt.displace',{'selection':selection,'direction':list(delta),'strength':math.dist(delta,[0,0,0])})
        snapshot=m.commit()
        (OUT/'krasue-surface-refinement.json').write_text(json.dumps(dict(snapshotId=snapshot,groups=len(groups),maxDisplacement=.025,iterations=6),indent=2))
        print('Krasue contours refined:',len(groups),flush=True)
    except Exception:m.rollback();raise
elif kind=='soldier':
    target=json.loads((OUT/'soldier-final-guard-targets.json').read_text())
    groups=collections.defaultdict(list)
    for i,d in enumerate(target['deltas']):
        delta=tuple(round(v,5) for v in [d[0],-d[2],d[1]])
        if math.dist(delta,[0,0,0])>.00005:groups[delta].append(i)
    m=Milestone('soldier-round-frontal-guard-final')
    try:
        m.mutate('playback.set_frame',{'frame':1})
        for delta,vertices in groups.items():
            selected=m.mutate('mesh.select',{'name':'SoldierV1Surface','method':'indices','vertices':vertices})
            m.mutate('sculpt.displace',{'selection':selected,'direction':list(delta),'strength':math.dist(delta,[0,0,0])})
        topology=m.mutate('mesh.inspect',{'name':'SoldierV1Surface','allowOpenSurface':True})
        selected=m.mutate('mesh.select',{'name':'SoldierV1Surface','method':'indices','faces':list(range(topology['counts']['faces']))})
        m.mutate('mesh.edit',{'selection':selected,'operation':'recalculate_normals'})
        snapshot=m.commit()
        (OUT/'soldier-final-guard-refinement.json').write_text(json.dumps({'snapshotId':snapshot,'groups':len(groups),'yawRadians':target['angle'],'gripPivot':target['pivot'],'shieldVertices':len(target['shieldVertices'])},indent=2))
        print('Final round guard applied',len(groups),flush=True)
    except Exception:m.rollback();raise
else:raise ValueError(kind)
