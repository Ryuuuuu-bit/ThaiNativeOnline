"""Local conserved weight smoothing from numerical surface diagnostics.

This only edits candidate JSON arrays, never Blender or delivered GLBs. Each
repair joins failing adjacent vertices, assigns the same normalized four-bone
blend, and preserves UV-position copies. The final Harness export must still
pass the independent full compressed-surface regression and visual review.
"""
import json,sys,math,os
from pathlib import Path
out=Path(os.environ.get('MESHY_RIG_OUTPUT','artifacts/meshy-rig-04/wat-rang'))
for kind in sys.argv[1:]:
    file=out/f'{kind}-candidate-weights.json';values=json.loads(file.read_text())
    diagnostic=json.loads((out/f'{kind}-weight-simulation.json').read_text())
    points=json.loads((out/'input'/f'{kind}-positions.json').read_text())
    keys=[tuple(round(v,5) for v in p) for p in points]
    copies={}
    for i,k in enumerate(keys):copies.setdefault(k,[]).append(i)
    graph={}
    for a,b in diagnostic['failingOriginalEdges']:
        group=copies[keys[a]]+copies[keys[b]]
        for i in group:graph.setdefault(i,set()).update(group)
    visited=set();patches=0
    for a in graph:
        if a in visited:continue
        todo=[a];component=[]
        while todo:
            i=todo.pop()
            if i in visited:continue
            visited.add(i);component.append(i);todo.extend(graph[i]-visited)
        weights={}
        for i in component:
            for b,w in values[i].items():weights[b]=weights.get(b,0)+w/len(component)
        top=sorted(weights.items(),key=lambda p:-p[1])[:4];total=sum(v for _,v in top)
        counts={b:round(w/total*64) for b,w in top};counts={b:w for b,w in counts.items() if w}
        counts[max(counts,key=counts.get)]+=64-sum(counts.values())
        weight={b:w/64 for b,w in counts.items()}
        for i in component:values[i]=weight
        patches+=1
    file.write_text(json.dumps(values))
    print(json.dumps({'type':kind,'components':patches,'vertices':len(visited)}),flush=True)
