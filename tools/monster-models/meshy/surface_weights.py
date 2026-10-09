"""Surface-geodesic skin weights: disconnected cloth never falls into a leg/root
because a palm crossed an arbitrary spatial radius. UV duplicates share weights.
Pure authoring calculation; Blender assignments still use the registered rig API.
"""
import collections,heapq,math

def surface_weights(points,indices,bones):
    body=next(b for b in bones if b['name']=='Body')
    head=next(b for b in bones if b['name']=='Head')
    one_leg=any(b['name']=='LegFoot' for b in bones)
    keys=[tuple(round(v,5) for v in p) for p in points]
    unique=list(dict.fromkeys(keys));lookup={p:i for i,p in enumerate(unique)}
    remap=[lookup[p] for p in keys];graph=[{} for _ in unique]
    for i in range(0,len(indices),3):
        t=[remap[v] for v in indices[i:i+3]]
        for a,b in zip(t,t[1:]+t[:1]):
            if a==b:continue
            length=math.dist(unique[a],unique[b]);graph[a][b]=length;graph[b][a]=length
    def segment(p,b):
        a=b['head'];d=[v-u for u,v in zip(a,b['tail'])]
        t=max(0,min(1,sum((v-u)*w for v,u,w in zip(p,a,d))/sum(w*w for w in d)))
        return math.sqrt(sum((v-u-t*w)**2 for v,u,w in zip(p,a,d)))
    # Root is a transform anchor. Only the tree guardian has a rigid root base;
    # letting it compete with a foot/robe creates a seam on moving lower limbs.
    rigid_root=not any(b['name'].startswith(('Leg','Hem')) for b in bones)
    seeds=[{} for _ in bones]
    for bi,b in enumerate(bones):
        if b['name']=='Root' and not rigid_root:continue
        for fraction in [0,.25,.5,.75,1]:
            sample=[a+(z-a)*fraction for a,z in zip(b['head'],b['tail'])]
            for vi in sorted(range(len(unique)),key=lambda i:math.dist(unique[i],sample))[:3]:
                seeds[bi][vi]=min(seeds[bi].get(vi,math.inf),segment(unique[vi],b))
    # Tiny detached accessories (hair/leaf plates) inherit their nearest bone
    # as a whole if no anatomical seed reaches their connected component.
    visited=set()
    for vi in range(len(unique)):
        if vi in visited:continue
        stack=[vi];component=[]
        while stack:
            a=stack.pop()
            if a in visited:continue
            visited.add(a);component.append(a);stack.extend(n for n in graph[a] if n not in visited)
        if any(any(i in s for i in component) for s in seeds):continue
        distance,bi,a=min((segment(unique[i],b),bi,i) for bi,b in enumerate(bones) if b['name']!='Root' or rigid_root for i in component)
        seeds[bi][a]=distance
    distances=[]
    for seed in seeds:
        d=[math.inf]*len(unique);queue=[]
        for vi,length in seed.items():d[vi]=length;heapq.heappush(queue,(length,vi))
        while queue:
            length,a=heapq.heappop(queue)
            if length!=d[a]:continue
            for b,edge in graph[a].items():
                nd=length+edge
                if nd<d[b]:d[b]=nd;heapq.heappush(queue,(nd,b))
        distances.append(d)
    values=[]
    for vi in range(len(unique)):
        x,y,z=unique[vi]
        def allowed(b):
            if one_leg:return True
            name=b['name']
            if name=='Head':return z>body['tail'][2]-.02
            if name.startswith(('Arm','Hand')):return abs(x)>.12 and z>min(b['head'][2],b['tail'][2])-.12
            if name.startswith('Hem') or name=='Root':return z<body['head'][2]+.12
            return True
        nearest=min(range(len(bones)),key=lambda bi:distances[bi][vi] if allowed(bones[bi]) else math.inf)
        values.append({nearest:1.0})
    # Smooth over surface edges before limiting to four normalized influences.
    # This avoids sharp skin seams at reconstructed sleeve/forearm junctions.
    for _ in range(100):
        smoothed=[]
        for vi,w in enumerate(values):
            if not graph[vi]:smoothed.append(w);continue
            average=collections.defaultdict(float)
            for n in graph[vi]:
                for bi,v in values[n].items():average[bi]+=v/len(graph[vi])
            smoothed.append({bi:w.get(bi,0)*.65+average.get(bi,0)*.35 for bi in w.keys()|average.keys()})
        values=smoothed
    result=[]
    def smooth(a,b,z):
        t=max(0,min(1,(z-a)/(b-a)));return t*t*(3-2*t)
    for vi,w in enumerate(values):
        z=unique[vi][2];w=w.copy()
        if not one_leg:
            if rigid_root:
                for bi in list(w):
                    name=bones[bi]['name']
                    if name.startswith('Arm') and name.endswith('Upper'):
                        lower=next(i for i,b in enumerate(bones) if b['name']==name.replace('Upper','Lower'))
                        retain=smooth(bones[lower]['tail'][2]+.03,bones[bi]['tail'][2]+.10,z)
                        w[lower]=w.get(lower,0)+w[bi]*(1-retain);w[bi]*=retain
            arm_width=min(abs(b['head'][0]) for b in bones if b['name'].startswith('Arm') and b['name'].endswith('Upper'))
            hand_bottom=min(b['tail'][2] for b in bones if b['name'].startswith('Hand'))
            arm_distance=min(segment(unique[vi],b) for b in bones if b['name'].startswith(('Arm','Hand')))
            factor=smooth(.10,arm_width*.95,abs(unique[vi][0]))*(1-smooth(.10,.28,arm_distance))
            transferred=0
            for bi in list(w):
                if bones[bi]['name'].startswith(('Arm','Hand')):
                    transferred+=w[bi]*(1-factor);w[bi]*=factor
            body_index=next(i for i,b in enumerate(bones) if b['name']=='Body')
            root_factor=1-smooth(body['head'][2]-.2,body['head'][2]+.1,z) if rigid_root else 0
            w[body_index]=w.get(body_index,0)+transferred*(1-root_factor)
            if root_factor:
                root_index=next(i for i,b in enumerate(bones) if b['name']=='Root')
                w[root_index]=w.get(root_index,0)+transferred*root_factor
            if rigid_root:
                root_index=next(i for i,b in enumerate(bones) if b['name']=='Root')
                retained=smooth(body['head'][2]-.30,body['head'][2]+.05,z)
                w[root_index]=w.get(root_index,0)+w[body_index]*(1-retained)
                w[body_index]*=retained
        for bi in w if one_leg else []:
            name=bones[bi]['name']
            if name=='Head':w[bi]*=smooth(body['tail'][2]-.10,head['head'][2]+.02,z)
            elif name.startswith(('Leg','Hem')):w[bi]*=1-smooth(body['head'][2]+.02,body['head'][2]+.16,z)
            elif name=='Root':w[bi]*=1-smooth(body['head'][2]+.02,body['head'][2]+.20,z)
        selected=sorted(w.items(),key=lambda item:-item[1])[:4];total=sum(v for _,v in selected)
        result.append({bones[bi]['name']:v/total for bi,v in selected if v>0})
    return [result[i] for i in remap]
