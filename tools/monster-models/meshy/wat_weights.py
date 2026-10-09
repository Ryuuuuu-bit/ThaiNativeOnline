"""Topology-based weights for Wat Rang's explicit anatomical and prop bones.

No armature auto-weighting: one-hot geodesic regions are diffused on actual
surface edges. Detached accessories use a single nearest bone as a whole.
UV seam copies share weights. Root is a non-deforming placement anchor.
"""
import collections, heapq, math

def wat_weights(points, indices, bones):
    keys=[tuple(round(v,5) for v in p) for p in points]
    unique=list(dict.fromkeys(keys)); lookup={p:i for i,p in enumerate(unique)}
    remap=[lookup[p] for p in keys]; graph=[{} for _ in unique]
    for i in range(0,len(indices),3):
        t=[remap[v] for v in indices[i:i+3]]
        for a,b in zip(t,t[1:]+t[:1]):
            if a!=b:graph[a][b]=graph[b][a]=math.dist(unique[a],unique[b])
    def segment(p,b):
        a=b['head']; d=[v-u for u,v in zip(a,b['tail'])]
        t=max(0,min(1,sum((v-u)*w for v,u,w in zip(p,a,d))/sum(w*w for w in d)))
        return math.sqrt(sum((v-u-t*w)**2 for v,u,w in zip(p,a,d)))
    seeds=[{} for _ in bones]
    for bi,b in enumerate(bones):
        if not b['deform']:continue
        for f in [0,.2,.4,.6,.8,1]:
            p=[a+(z-a)*f for a,z in zip(b['head'],b['tail'])]
            for vi in sorted(range(len(unique)),key=lambda i:math.dist(unique[i],p))[:3]:
                seeds[bi][vi]=min(seeds[bi].get(vi,math.inf),segment(unique[vi],b))
    visited=set()
    for vi in range(len(unique)):
        if vi in visited:continue
        stack=[vi]; component=[]
        while stack:
            a=stack.pop()
            if a in visited:continue
            visited.add(a);component.append(a);stack.extend(graph[a])
        if any(any(i in s for i in component) for s in seeds):continue
        _,bi,a=min((segment(unique[i],b),bi,i) for bi,b in enumerate(bones) if b['deform'] for i in component)
        seeds[bi][a]=0
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
    for vi,p in enumerate(unique):
        x,y,z=p
        def allowed(b):
            name=b['name']
            if not b['deform']:return False
            if name=='Head':return z>b['head'][2]-.10
            if name.startswith('Leg'):return z<max(b['head'][2],b['tail'][2])+.18 and (x<.04 if name.startswith('LegL') else x>-.04)
            if name.startswith(('Arm','Hand')):return abs(x)>.08 and z>min(b['head'][2],b['tail'][2])-.18 and (x<.04 if name.startswith(('ArmL','HandL')) else x>-.04)
            if name.startswith('Ribbon'):return z<1.18
            return True
        bi=min(range(len(bones)),key=lambda i:distances[i][vi] if allowed(bones[i]) else math.inf)
        assert math.isfinite(distances[bi][vi]), 'Every shell needs an anatomical seed'
        values.append({bi:1.0})
    for _ in range(100):
        smoothed=[]
        for vi,w in enumerate(values):
            if not graph[vi]:smoothed.append(w);continue
            avg=collections.defaultdict(float)
            for n in graph[vi]:
                for bi,v in values[n].items():avg[bi]+=v/len(graph[vi])
            smoothed.append({bi:w.get(bi,0)*.65+avg.get(bi,0)*.35 for bi in w.keys()|avg.keys()})
        values=smoothed
    # Diffusion can cross connected waistbands and spread a thigh onto the
    # torso. Transfer that mass continuously to the adjacent anatomical bone;
    # merely deleting it would amplify tiny residual weights at the boundary.
    named={b['name']:i for i,b in enumerate(bones)}
    def smooth(a,b,v):
        t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
    def transfer(w,source,target,retain):
        bi=named[source];ti=named[target];removed=w.get(bi,0)*(1-retain)
        w[bi]=w.get(bi,0)*retain;w[ti]=w.get(ti,0)+removed
    projected=[]
    for vi,w in enumerate(values):
        w=w.copy();p=unique[vi];x,y,z=p
        if 'Pelvis' in named:
            hip=bones[named['Pelvis']]['head'][2]
            for side in ['L','R']:
                leg='Leg'+side
                knee=bones[named[leg+'Lower']]['head'][2]
                total=sum(w.get(named[leg+s],0) for s in ['Upper','Lower','Foot'])
                retained=1-smooth(hip-.10,hip+.13,z)
                w[named['Pelvis']]=w.get(named['Pelvis'],0)+total*(1-retained)
                total*=retained
                # Keep geodesic left/right membership, but use continuous
                # adjacent-joint blends along each leg. A thigh may not pull
                # the ankle merely because a connected trouser seam diffused.
                thigh=smooth(knee-.12,knee+.12,z)
                foot=1-smooth(.18,.34,z)
                w[named[leg+'Upper']]=total*thigh
                w[named[leg+'Lower']]=total*(1-thigh)*(1-foot)
                w[named[leg+'Foot']]=total*(1-thigh)*foot
            # Low detached cuffs inherit the nearby leg rather than the pelvis.
            side='L' if x<0 else 'R';leg='Leg'+side
            factor=(1-smooth(hip-.22,hip-.06,z))*smooth(.06,abs(bones[named[leg+'Upper']]['head'][0])*.8,abs(x))
            target=leg+('Lower' if z<bones[named[leg+'Lower']]['head'][2] else 'Upper')
            transfer(w,'Pelvis',target,1-factor)
            arm_width=min(abs(b['head'][0]) for b in bones if b['name'].startswith('Arm') and b['name'].endswith('Upper'))
            arm_factor=smooth(arm_width+.02,arm_width+.12,abs(x))
            for b in bones:
                if b['name'].startswith(('Arm','Hand')):transfer(w,b['name'],'Body',arm_factor)
            if 'Pestle' in named:
                pestle=bones[named['Pestle']]
                retain=(1-smooth(.10,.22,segment(p,pestle)))*(1-smooth(pestle['head'][2]-.08,pestle['head'][2]+.04,z))
                transfer(w,'Pestle','Pelvis',retain)
                for side in ['L','R']:
                    transfer(w,'Tray'+side,'Body',smooth(.20,.40,abs(x)))
            # The spine blend is spatially continuous even where different
            # reconstructed clothing shells have different geodesic labels.
            spine=smooth(hip+.02,hip+.25,z)
            torso=w.get(named['Body'],0)+w.get(named['Pelvis'],0)
            w[named['Body']]=torso*spine;w[named['Pelvis']]=torso*(1-spine)
            leg='Leg'+('L' if x<0 else 'R')
            near_leg=smooth(.06,abs(bones[named[leg+'Upper']]['head'][0])*.8,abs(x))
            low=(1-smooth(hip-.18,hip-.02,z))*near_leg
            transfer(w,'Pelvis',leg+'Upper',1-low)
            for side in ['L','R']:
                leg='Leg'+side;knee=bones[named[leg+'Lower']]['head'][2]
                total=sum(w.get(named[leg+s],0) for s in ['Upper','Lower','Foot'])
                thigh=smooth(knee-.12,knee+.12,z);foot=1-smooth(.18,.34,z)
                w[named[leg+'Upper']]=total*thigh
                w[named[leg+'Lower']]=total*(1-thigh)*(1-foot)
                w[named[leg+'Foot']]=total*(1-thigh)*foot

        projected.append(w)
    values=projected
    result=[]
    for w in values:
        top=sorted(w.items(),key=lambda item:-item[1])[:4];total=sum(v for _,v in top)
        counts={bi:round(v/total*64) for bi,v in top};counts={bi:v for bi,v in counts.items() if v}
        counts[max(counts,key=counts.get)]+=64-sum(counts.values())
        result.append({bones[bi]['name']:v/64 for bi,v in counts.items()})
        p=unique[len(result)-1];x,y,z=p
        if 'Shield' in named and x>.24 and .69<z<1.235 and .85*x-.53*y>.24:
            result[-1]={'Shield':1.0}
    return [result[i] for i in remap]
