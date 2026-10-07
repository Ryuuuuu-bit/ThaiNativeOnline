"""Original paddy creatures, authored only through registered Blender commands.

Usage: set BLENDER_DESIGN_ROOT, BLENDER_SESSION_DESCRIPTOR, MONSTER_OUTPUT_ROOT;
then python tools/monster-models/build_paddy.py fowl|cobra|crab|buffalo|monkey|phibpa.
Use a fresh output directory/session when rebuilding (no implicit overwrites).
"""
from harness_client import call, Milestone
from pathlib import Path
import json
import math
import os
import sys

kind = sys.argv[1]
if kind not in ['fowl', 'cobra', 'crab', 'buffalo', 'monkey', 'phibpa']:
    raise ValueError('Unknown paddy creature')
output = Path(os.environ['MONSTER_OUTPUT_ROOT']).resolve()
prefix = kind.title() + os.environ.get('MONSTER_VARIANT', '')
palette = {
    'fowl': {'Main':'303a35','Warm':'b76631','Light':'dabd77','Dark':'182c30','Accent':'a83227','Eye':'161819','Detail':'54766d'},
    'cobra': {'Main':'4e5739','Warm':'8b7944','Light':'c9b57a','Dark':'27332c','Accent':'a84e45','Eye':'161b17','Detail':'ac9a56'},
    'crab': {'Main':'756442','Warm':'927e50','Light':'c0ab79','Dark':'443c32','Accent':'a96a43','Eye':'151d1b','Detail':'5c6552'},
    'buffalo': {'Main':'4b4c4b','Warm':'686a61','Light':'d4cbb1','Dark':'303433','Accent':'8d756a','Eye':'171b18','Detail':'a59d83'},
    'monkey': {'Main':'88704f','Warm':'ac9470','Light':'d9bb91','Dark':'4b4134','Accent':'bd8d7b','Eye':'171b19','Detail':'705b40'},
    'phibpa': {'Main':'52745a','Warm':'725d40','Light':'c4b990','Dark':'2b443d','Accent':'9dbb72','Eye':'d4e5a0','Detail':'809965'},
}[kind]
parts = []
bones = [{'name':'Root','head':[0,0,0],'tail':[0,0,.2]},
         {'name':'Body','head':[0,0,.6],'tail':[0,0,.9],'parent':'Root'}]
milestone = Milestone(kind)
m = milestone.mutate

def color(value):
    def linear(v): return v / 12.92 if v <= .04045 else ((v+.055)/1.055)**2.4
    return [linear(int(value[i:i+2],16)/255) for i in [0,2,4]] + [1]

def bone(name, head, tail, parent='Body'):
    bones.append({'name':name,'head':head,'tail':tail,'parent':parent})

def mesh(name, position, scale, material='Main', joint='Body', rotation=None, primitive='sphere'):
    name=prefix+name
    args={'name':name,'primitive':primitive,'location':position,'scale':scale}
    if rotation: args['rotation']=rotation
    m('object.create_mesh',args)
    m('object.apply_transform',{'name':name,'scale':True})
    if primitive=='sphere':m('modifier.add',{'name':name,'modifier':'DECIMATE','settings':{'ratio':.18}})
    m('material.assign',{'object':name,'material':prefix+material})
    parts.append((name,joint))

def segment(name, a, b, radius, material='Main', joint='Body', primitive='sphere', width=None):
    delta=[b[i]-a[i] for i in range(3)]
    length=math.sqrt(sum(v*v for v in delta))
    rotation=[0,math.acos(max(-1,min(1,delta[2]/length))),math.atan2(delta[1],delta[0])]
    mesh(name,[(a[i]+b[i])/2 for i in range(3)],[radius,width or radius,length/2+(radius*.35 if primitive=='sphere' else 0)],material,joint,rotation,primitive)

def curve(name, points, radius, material='Main', joint='Body'):
    name=prefix+name
    m('curve.create',{'name':name,'points':points,'bevelDepth':radius,'bevelResolution':1,'resolution':6})
    m('curve.to_mesh',{'name':name})
    m('material.assign',{'object':name,'material':prefix+material})
    parts.append((name,joint))

def eye(label, x, y, z, radius=.04, joint='Head'):
    mesh('Eye'+label,[x,y,z],[radius,radius*.7,radius],'Eye',joint)
    mesh('Glint'+label,[x-radius*.25,y-radius*.6,z+radius*.3],[radius*.23]*3,'Light',joint)

try:
    # Probe live domain support and inspect before changing the working scene.
    capabilities={}
    for domain in ['object','modifier','curve','rig','animation','material','camera','light','render','export','preview']:
        capabilities[domain]=call('capability.list',{'domain':domain,'limit':100})['result']
    for command in ['object.create_mesh','object.apply_transform','modifier.add','curve.create','curve.to_mesh','rig.create_armature','rig.bind','rig.assign_weights','mesh.select','animation.pose_keyframe','camera.create','camera.aim_at','light.create','render.configure','export.file','preview.capture']:
        call('capability.describe',{'id':command})
    (output/(kind+'-capabilities.json')).write_text(json.dumps(capabilities))
    scene=m('scene.inspect')
    for obj in scene['objectDetails']:
        m('object.set_visibility',{'name':obj['name'],'viewport':False,'render':False})
    for name,value in palette.items():m('material.create_pbr',{'name':prefix+name,'baseColor':color(value),'roughness':.84 if name!='Eye' else .25})

    if kind=='fowl':
        bone('Head',[0,-.32,.85],[0,-.45,1.22])
        bone('Tail',[0,.32,.67],[0,.75,.95])
        mesh('Body',[0,.04,.57],[.27,.38,.31])
        mesh('Breast',[0,-.2,.6],[.22,.23,.28],'Warm')
        segment('Neck',[0,-.22,.67],[0,-.35,1.03],.13,'Light','Head')
        mesh('Head',[0,-.4,1.07],[.15,.16,.17],'Warm','Head')
        segment('Beak',[0,-.51,1.07],[0,-.70,1.04],.07,'Light','Head','cone')
        mesh('Wattle',[0,-.52,.91],[.05,.045,.10],'Accent','Head')
        for i in range(4):mesh('Comb'+str(i),[0,-.49+i*.065,1.23+math.sin(i/3*math.pi)*.045],[.04,.055,.07],'Accent','Head')
        for s,label in [(-1,'L'),(1,'R')]:
            bone('Wing'+label,[s*.21,0,.7],[s*.4,.17,.4])
            bone('Leg'+label,[s*.12,.02,.42],[s*.12,-.04,.1])
            mesh('Wing'+label,[s*.24,.08,.57],[.09,.26,.19],'Warm','Wing'+label,[.2,s*.15,0])
            for i in range(3):segment('WingFeather'+label+str(i),[s*.29,-.02+i*.09,.63],[s*.3,.14+i*.09,.40],.045,'Light' if i==0 else 'Detail','Wing'+label)
            segment('Shank'+label,[s*.12,.03,.42],[s*.12,-.05,.12],.036,'Light','Leg'+label)
            for i in range(3):segment('Toe'+label+str(i),[s*.12,-.05,.09],[s*.12+(i-1)*.065,-.21,.055],.018,'Light','Leg'+label)
            eye(label,s*.13,-.46,1.10,.032)
        for i in range(5):
            x=(i-2)*.065
            segment('TailFeather'+str(i),[x,.29,.68],[x*1.4,.73+abs(i-2)*.04,1.10-abs(i-2)*.08],.07,'Detail' if i%2 else 'Dark','Tail',width=.11)

    elif kind=='cobra':
        bone('Head',[0,-.08,.57],[0,-.18,.92])
        bone('Tail',[0,.24,.13],[.4,.55,.1])
        points=[]
        for i in range(33):
            t=i/32*math.pi*3.5
            r=.32*(1-i/45)
            points.append([math.cos(t)*r,math.sin(t)*r+.1,.11+i*.001])
        curve('Coils',points,.075,'Main','Tail')
        curve('Neck',[[0,.1,.15],[0,.06,.3],[0,.06,.57],[0,-.03,.82]],.075)
        mesh('Hood',[0,-.015,.62],[.245,.075,.27],'Main','Head')
        mesh('HoodBelly',[0,-.087,.61],[.18,.023,.23],'Light','Head')
        for i in range(5):
            width=[.07,.11,.12,.11,.07][i]
            segment('BellyBand'+str(i),[-width,-.112,.49+i*.06],[width,-.112,.49+i*.06],.008,'Warm','Head')
        mesh('Head',[0,-.13,.88],[.115,.17,.095],'Main','Head')
        mesh('Jaw',[0,-.18,.83],[.1,.12,.035],'Light','Head')
        for s,label in [(-1,'L'),(1,'R')]:
            eye(label,s*.092,-.213,.9,.022)
            mesh('HoodMark'+label,[s*.12,.049,.68],[.055,.018,.085],'Detail','Head')
            segment('Fork'+label,[0,-.34,.83],[s*.035,-.4,.83],.009,'Accent','Head')
        segment('Tongue',[0,-.25,.83],[0,-.35,.83],.012,'Accent','Head')
        segment('TailTip',points[0],[-.50,.18,.08],.055,'Warm','Tail','cone')

    elif kind=='crab':
        bone('Head',[0,-.08,.27],[0,-.2,.5])
        mesh('Shell',[0,0,.28],[.36,.27,.19])
        mesh('Carapace',[0,-.01,.37],[.29,.22,.105],'Warm')
        mesh('Face',[0,-.24,.27],[.22,.045,.08],'Light','Head')
        for s,label in [(-1,'L'),(1,'R')]:
            bone('Claw'+label,[s*.26,-.15,.3],[s*.52,-.37,.4])
            bone('Leg'+label,[s*.24,.03,.27],[s*.6,.03,.08])
            segment('EyeStalk'+label,[s*.13,-.21,.34],[s*.16,-.24,.50],.025,'Dark','Head')
            eye(label,s*.16,-.25,.51,.04)
            segment('Arm'+label,[s*.27,-.13,.30],[s*.50,-.28,.34],.065,'Main','Claw'+label)
            mesh('ClawPalm'+label,[s*.53,-.35,.35],[.15,.12,.11],'Accent','Claw'+label)
            for i in [-1,1]:
                start=[s*(.53+i*.055),-.41,.35]
                end=[s*(.53+i*.018),-.64,.36]
                segment('Pincer'+label+str(i),start,end,.044,'Warm','Claw'+label,'cone')
            for i in range(4):
                y=-.14+i*.115
                curve('Leg'+label+str(i),[[s*.27,y,.26],[s*.50,y+.03,.22],[s*.66,y-.04,.065]],.025,'Main','Leg'+label)
                segment('LegTip'+label+str(i),[s*.62,y-.03,.11],[s*.69,y-.05,.025],.026,'Dark','Leg'+label,'cone')
        for i in range(3):mesh('ShellSpeck'+str(i),[(i-1)*.13,.04,.465],[.025,.04,.012],'Light')

    elif kind=='buffalo':
        bone('Head',[0,-.55,.95],[0,-1.10,.77])
        bone('Tail',[0,.85,.8],[0,1.13,.7])
        mesh('Body',[0,.1,.87],[.50,.87,.47])
        mesh('Shoulders',[0,-.38,.92],[.55,.51,.48],'Warm')
        mesh('Rump',[0,.67,.82],[.44,.39,.4])
        mesh('Head',[0,-.88,.81],[.34,.42,.34],'Main','Head')
        mesh('Muzzle',[0,-1.21,.62],[.29,.27,.19],'Warm','Head')
        mesh('Nose',[0,-1.42,.65],[.23,.06,.12],'Dark','Head')
        mesh('Forehead',[0,-.95,1.04],[.23,.25,.13],'Warm','Head')
        for s,label in [(-1,'L'),(1,'R')]:
            mesh('Ear'+label,[s*.4,-.67,.94],[.23,.10,.095],'Warm','Head',[0,s*.2,s*.2])
            mesh('EarInner'+label,[s*.43,-.75,.96],[.15,.025,.05],'Accent','Head')
            eye(label,s*.29,-1.03,.88,.037)
            mesh('Nostril'+label,[s*.1,-1.469,.66],[.036,.016,.03],'Dark','Head')
            pts=[[s*.25,-.65,1.14],[s*.52,-.53,1.16],[s*.75,-.35,1.27],[s*.83,-.30,1.48]]
            curve('Horn'+label,pts,.075,'Light','Head')
            segment('HornTip'+label,pts[-1],[s*.78,-.34,1.64],.061,'Dark','Head','cone')
            for y,leg in [(-.46,'Fore'),(.62,'Hind')]:
                name=leg+label;bone(name,[s*.34,y,.74],[s*.34,y,.13])
                segment('Leg'+name,[s*.34,y,.70],[s*.36,y-.015,.2],.13,'Main',name)
                mesh('Ankle'+name,[s*.36,y-.02,.18],[.12,.13,.15],'Warm',name)
                for toe in [-1,1]:mesh('Hoof'+name+str(toe),[s*.36+toe*.06,y-.065,.09],[.058,.15,.09],'Dark',name)
        curve('Tail',[[0,.88,.86],[.04,1.04,.67],[.09,1.10,.42]],.03,'Main','Tail')
        mesh('TailTassel',[.09,1.1,.38],[.075,.055,.12],'Dark','Tail')

    elif kind=='monkey':
        bone('Head',[0,-.1,.88],[0,-.14,1.26])
        bone('Tail',[0,.22,.38],[0,.58,.45])
        mesh('Torso',[0,.02,.65],[.26,.20,.34])
        mesh('Chest',[0,-.145,.69],[.19,.065,.25],'Light')
        mesh('Haunch',[0,.08,.37],[.27,.22,.2],'Warm')
        mesh('Head',[0,-.1,1.08],[.26,.22,.27],'Main','Head')
        mesh('Face',[0,-.26,1.045],[.20,.10,.20],'Accent','Head')
        mesh('Muzzle',[0,-.34,.96],[.13,.085,.09],'Light','Head')
        mesh('Nose',[0,-.406,1.0],[.065,.024,.045],'Dark','Head')
        mesh('Crown',[0,-.02,1.29],[.18,.15,.08],'Dark','Head')
        for s,label in [(-1,'L'),(1,'R')]:
            bone('Arm'+label,[s*.23,0,.84],[s*.40,-.12,.41])
            bone('Leg'+label,[s*.15,.05,.42],[s*.21,-.09,.10])
            mesh('Ear'+label,[s*.255,-.08,1.09],[.09,.06,.12],'Main','Head')
            mesh('EarInner'+label,[s*.285,-.12,1.09],[.05,.028,.075],'Accent','Head')
            mesh('Brow'+label,[s*.086,-.316,1.12],[.09,.028,.035],'Dark','Head',[0,0,s*.1])
            eye(label,s*.087,-.333,1.07,.039)
            segment('UpperArm'+label,[s*.23,0,.82],[s*.34,-.025,.61],.08,'Main','Arm'+label)
            segment('Forearm'+label,[s*.34,-.025,.61],[s*.41,-.13,.37],.065,'Warm','Arm'+label)
            mesh('Hand'+label,[s*.42,-.15,.33],[.08,.07,.075],'Accent','Arm'+label)
            for i in range(3):segment('Finger'+label+str(i),[s*(.39+i*.025),-.19,.34],[s*(.39+i*.025),-.22,.25],.014,'Accent','Arm'+label)
            segment('Thigh'+label,[s*.15,.05,.43],[s*.21,-.05,.24],.105,'Main','Leg'+label)
            segment('Shin'+label,[s*.21,-.05,.24],[s*.22,-.1,.10],.065,'Warm','Leg'+label)
            mesh('Foot'+label,[s*.22,-.17,.08],[.08,.14,.065],'Accent','Leg'+label)
        curve('Tail',[[0,.2,.4],[0,.47,.37],[.08,.66,.50],[.14,.66,.75],[.10,.58,.85]],.045,'Main','Tail')

    else:  # Forest spirit at the edge of the paddies; a bark mask, not a recoloured woman.
        bone('Head',[0,0,1.18],[0,0,1.65])
        bone('Tail',[0,0,.65],[0,.15,.15])
        mesh('Torso',[0,.02,1.0],[.23,.15,.35])
        mesh('BarkMask',[0,-.025,1.49],[.22,.13,.30],'Warm','Head')
        mesh('FacePlane',[0,-.115,1.49],[.17,.045,.235],'Light','Head')
        segment('NoseRidge',[0,-.17,1.57],[0,-.19,1.39],.025,'Warm','Head')
        mesh('Mouth',[0,-.159,1.34],[.055,.015,.025],'Dark','Head')
        for s,label in [(-1,'L'),(1,'R')]:
            mesh('Socket'+label,[s*.08,-.156,1.54],[.06,.019,.032],'Dark','Head',[0,0,s*.18])
            eye(label,s*.08,-.178,1.54,.027)
            bone('Arm'+label,[s*.18,0,1.13],[s*.43,-.12,.75])
            curve('VineArm'+label,[[s*.17,0,1.15],[s*.32,-.02,1.05],[s*.41,-.1,.82],[s*.48,-.16,.73]],.04,'Warm','Arm'+label)
            for i in range(3):segment('RootFinger'+label+str(i),[s*.46,-.15,.77],[s*(.47+i*.035),-.21,.63+i*.025],.015,'Warm','Arm'+label,'cone')
            for i in range(3):mesh('Leaf'+label+str(i),[s*(.17+i*.035),.02,1.66+i*.09],[.09,.04,.18],'Accent' if i%2 else 'Detail','Head',[0,s*(.5+i*.12),0])
        for i in range(5):
            x=(i-2)*.07
            curve('Root'+str(i),[[x,0,.84],[x*1.4,-.02,.56],[x*1.6,.07,.32],[x*1.9+.06,.16,.17]],.035,'Main','Tail')
            segment('RootTip'+str(i),[x*1.6,.07,.32],[x*1.9+.09,.19,.1],.034,'Warm','Tail','cone')
        for i in range(3):mesh('Moss'+str(i),[(i-1)*.13,-.12,1.10-i*.08],[.09,.04,.07],'Detail')

    rig=prefix+'Rig'
    m('rig.create_armature',{'name':rig,'bones':bones})
    for name,joint in parts:
        m('rig.bind',{'mesh':{'name':name},'armature':{'name':rig}})
        selection=m('mesh.select',{'name':name,'method':'spatial','min':[-10]*3,'max':[10]*3})
        m('rig.assign_weights',{'mesh':{'name':name},'bone':joint,'selection':selection.get('selection',selection),'weight':1})
    rig_report=m('rig.inspect',{'name':rig})
    m('animation.set_frame_range',{'start':1,'end':155})
    frames=[1,13,25,37,49,51,57,63,69,75,81,87,91,97,105,111,116,121,131,141,155]
    for frame in frames:
        for b in bones:
            name=b['name'];rotation=[0,0,0];location=[0,0,0]
            if frame<=49:
                phase=(frame-1)/48*math.pi*2
                if name=='Body':location[2]=math.sin(phase)*(.022 if kind=='phibpa' else .007)
                if name=='Head':rotation[0]=math.sin(phase)*.025
                if name=='Tail':rotation[2]=math.sin(phase)*.06
            elif frame<=75:
                phase=(frame-51)/24*math.pi*2
                if name.startswith(('Leg','Fore','Hind')):rotation[0]=math.sin(phase+(0 if name.endswith('L') else math.pi))*(.2 if kind=='crab' else .28)
                if name.startswith('Arm'):rotation[0]=math.sin(phase+(math.pi if name.endswith('L') else 0))*.22
                if name=='Body':location[2]=abs(math.sin(phase))*(.01 if kind in ['cobra','crab'] else .025)
                if name=='Head':rotation[1]=math.sin(phase)*.05
                if name=='Tail':rotation[2]=math.sin(phase)*(.18 if kind=='cobra' else .08)
            elif frame<=105:
                power={81:0,87:-.15,91:.38,97:.14,105:0}[frame]
                if name=='Head':rotation[0]=power*(1.5 if kind=='fowl' else 1)
                if name=='Body':location[1]=-max(0,power)*.22
                if name.startswith(('Arm','Claw')):rotation[0]=-power*1.6
                if name.startswith('Wing'):rotation[1]=(1 if name.endswith('L') else -1)*power*1.8
            elif frame<=121:
                if name=='Body':rotation[1]=-.16 if frame==116 else 0
            else:
                k=(frame-131)/24
                if name=='Root':rotation[1]=k*(1.0 if kind=='crab' else 1.35);location[2]=-k*.2
            for path,value in [('rotation_euler',rotation),('location',location)]:m('animation.pose_keyframe',{'armature':rig,'bone':name,'dataPath':path,'frame':frame,'value':value})
    m('playback.set_frame',{'frame':1})
    camera=prefix+'Camera'
    m('camera.create',{'name':camera,'location':[3,-5,3],'lens':65,'active':True})
    m('camera.aim_at',{'name':camera,'target':[0,0,.65 if kind!='phibpa' else .9]})
    lights=[]
    for name,position,energy,tint in [('Key',[2,-3,5],650,[1,.88,.73]),('Fill',[-3,-1,3],450,[.73,.85,1]),('Rim',[0,3,4],750,[1,.82,.6])]:
        name=prefix+name;lights.append(name)
        m('light.create',{'name':name,'type':'AREA','location':position,'energy':energy,'color':tint,'size':4})
        x,y,z=position;dx,dy,dz=-x,-y,.65-z
        m('object.transform',{'name':name,'rotation':[math.atan2(-dy,-dz),-math.atan2(dx,math.sqrt(dy*dy+dz*dz)),0]})
    m('render.configure',{'engine':'BLENDER_EEVEE','width':768,'height':768,'transparent':False})
    snapshot=milestone.commit()
    preview=call('preview.capture',{'snapshotId':snapshot,'width':768,'height':768})
    (output/(kind+'-preview.json')).write_text(json.dumps(preview))
    blend=call('export.file',{'path':str(output/(kind+'.blend')),'snapshotId':snapshot})
    milestone=Milestone(kind+'-export');m=milestone.mutate
    for name in [camera]+lights:m('object.set_visibility',{'name':name,'viewport':False,'render':False})
    snapshot=milestone.commit()
    exported=call('export.file',{'path':str(output/(kind+'.glb')),'snapshotId':snapshot,'parameters':{'use_visible':True,'use_renderable':True,'export_apply':True,'export_animations':True}})
    (output/(kind+'-receipt.json')).write_text(json.dumps({'blend':blend,'model':exported,'rig':rig_report}))
    print(json.dumps({'kind':kind,'revision':milestone.revision,'snapshot':snapshot,'parts':len(parts),'bones':len(bones),'model':exported['result']['artifact']['path']}),flush=True)
except Exception:
    milestone.rollback()
    raise
