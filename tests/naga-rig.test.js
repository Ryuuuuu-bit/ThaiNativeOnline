import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

function offline(code){
  return JSON.parse(execFileSync(process.env.PYTHON??'python',['-B','-c',"import sys,json; sys.path.insert(0,'tools/monster-models/meshy'); import naga_rig as n; "+code],{
    encoding:'utf8',timeout:15000,
    env:{...process.env,BLENDER_SESSION_DESCRIPTOR:'',BLENDER_DESIGN_ROOT:'',PYTHONDONTWRITEBYTECODE:'1'},
  }));
}

// Snapshot receipts and revision transactions are synthetic. No descriptor,
// Harness import, Blender connection or real asset is used by these regressions.
const preparedExport=String.raw`
import copy,hashlib,struct,tempfile
from pathlib import Path
s=n.snapshot_exporter
class FakeClient:
    def __init__(self,directory):
        self.directory=directory;self.revision=0;self.calls=[];self.submitted=[];self.unknown=False
        outer=self
        class Milestone:
            def __init__(self,label):self.revision=outer.revision;self.start=self.revision;self.active=True
            def mutate(self,command,args):
                assert self.active and self.revision==outer.revision,'Stale/missing transaction'
                outer.calls.append(command)
                if command=='job.submit':
                    outer.submitted.append(args['jobId']);outer.revision+=1
                    if outer.unknown:raise RuntimeError('unknown submit response')
                    value=outer.publish(args['jobId'],args['format'])
                elif command in ('job.status','job.recover'):
                    outer.revision+=1
                    path=outer.directory/'jobs'/args['jobId']/'status.json'
                    if not path.exists():raise RuntimeError('JOB_NOT_FOUND: outcome unknown')
                    value=s.read_json(path)
                else:raise AssertionError('Only recorded snapshot jobs permitted: '+command)
                self.revision=outer.revision;return value
            def commit(self):self.active=False;return 'synthetic-snapshot-'+str(self.revision)
            def rollback(self):outer.revision=self.start;self.revision=self.start;self.active=False
        self.Milestone=Milestone
    def call(self,command,args=None):
        self.calls.append(command)
        assert command=='session.status','Job controls require transactions; no rig/scene authoring permitted'
        return {'sceneRevision':self.revision,'result':{}}
    def publish(self,job_id,fmt):
        directory=self.directory/'jobs'/job_id;directory.mkdir(parents=True,exist_ok=True)
        snapshot=directory/'source.blend';snapshot.write_bytes(b'BLENDER synthetic snapshot fixture')
        artifact=directory/('artifact.'+fmt)
        artifact.write_bytes(b'glTF'+struct.pack('<II',2,24)+struct.pack('<II',4,0x4e4f534a)+b'{}  ' if fmt=='glb' else b'BLENDER synthetic output fixture')
        receipt={'jobId':job_id,'kind':'EXPORT','state':'completed',
            'snapshot':{'path':str(snapshot),'sha256':s.sha(snapshot)},
            'artifact':{'path':str(artifact),'sha256':s.sha(artifact),'bytes':artifact.stat().st_size}}
        s.write_json(directory/'status.json',receipt);return receipt

def prepared(directory,attempted=True):
    directory=Path(directory);fake=FakeClient(directory)
    source={'type':n.TYPE,'taxon':'serpent','legs':[],'arms':[],
        'rigName':'NagaRig','surfaceName':'NagaSurface','animationSnapshotId':'authored'}
    report_path=directory/(n.TYPE+'-rig-report.json');s.write_json(report_path,source)
    ids=['job_naga_existing_glb','job_naga_reserved_blend']
    journal={'type':n.TYPE,'tag':'final-v1','phase':'prepared','sceneRevision':0,'snapshotId':'approved',
        'rigReportSha256':s.sha(report_path),'completed':False,
        'jobs':[{'jobId':ids[0],'format':'glb','dispatchAttempted':attempted},
                {'jobId':ids[1],'format':'blend','dispatchAttempted':False}]}
    path=s.export_path(directory,n.TYPE,'final-v1');s.write_json(path,journal)
    if attempted:fake.publish(ids[0],'glb')
    return fake,ids,path,report_path
`;

test('Naga helpers import without opening a Harness or reading a descriptor',()=>{
  assert.equal(offline("print(json.dumps('harness_client' in sys.modules))"),false);
});

test('measured outer hood stays on the head instead of the grounded coil',()=>{
  const weights=offline('print(json.dumps(n.weights([0.3646337406593284,-0.26207923527465016,1.278960027282969])))');
  assert.equal(weights.Head,1);
  assert.equal(weights.GroundCoil??0,0);
});

test('serpent contact, tail and transition weights retain normalized bounded ownership',()=>{
  const values=offline('print(json.dumps([n.weights(p) for p in [[.2,.3,.15],[.54,.53,.7],[.07,-.29,.8],[.07,-.4,.4]]]))');
  assert.deepEqual(values[0],{GroundCoil:1});
  assert.deepEqual(values[1],{Tail:1});
  for(const weights of values){
    assert.ok(Object.keys(weights).length<=4);
    assert.ok(Math.abs(Object.values(weights).reduce((sum,v)=>sum+v,0)-1)<1e-8);
    assert.ok(Object.values(weights).every(v=>v>0&&Number.isFinite(v)));
  }
});

test('all authored serpent motions preserve the fixed supporting coil and closed loops',()=>{
  const poses=offline('print(json.dumps({str(f):n.world_pose(f) for f in n.FRAMES}))');
  for(const pose of Object.values(poses))assert.deepEqual(pose.GroundCoil,[0,0,0]);
  for(const [a,b] of [[1,49],[51,75]])for(const name of Object.keys(poses[a]))for(let i=0;i<3;i++)assert.ok(Math.abs(poses[a][name][i]-poses[b][name][i])<1e-8);
  assert.ok(poses[155].NeckLower[0]>poses[131].NeckLower[0]);
});

test('Naga prepared export resumes its reserved BLEND ID after collecting the original GLB',()=>{
  const result=offline(preparedExport+String.raw`
with tempfile.TemporaryDirectory() as directory:
    fake,ids,path,source=prepared(directory)
    collected=n.collect('final-v1',out=directory,client=fake)
    assert not collected['completed'] and fake.submitted==[]
    assert collected['jobs'][1]['lastState']=='reserved-unsubmitted'
    complete=n.export('final-v1',0,out=directory,client=fake)
    assert complete['completed'] and fake.submitted==[ids[1]]
    assert [j['jobId'] for j in complete['jobs']]==ids
    assert complete['sceneRevision']==fake.revision
    n.export('final-v1',0,out=directory,client=fake)
    n.collect('final-v1',out=directory,client=fake)
    assert fake.submitted==[ids[1]],'Never duplicate a completed legacy identity'
    print(json.dumps({'completed':True,'submitted':fake.submitted,'harnessImported':'harness_client' in sys.modules}))
`);
  assert.deepEqual(result,{completed:true,submitted:['job_naga_reserved_blend'],harnessImported:false});
});

test('unknown Naga submit responses retain their ID through repeated queries and eventual recovery',()=>{
  const result=offline(preparedExport+String.raw`
with tempfile.TemporaryDirectory() as directory:
    fake,ids,path,source=prepared(directory,attempted=False);fake.unknown=True
    for attempt in range(2):
        try:n.export('final-v1',0,out=directory,client=fake)
        except RuntimeError as error:assert 'JOB_NOT_FOUND' in str(error)
        else:raise AssertionError('Unknown response must stay unresolved')
    recorded=s.read_json(path)
    assert fake.submitted==[ids[0]]
    assert recorded['jobs'][0]['dispatchAttempted'] and 'unknown submit response' in recorded['jobs'][0]['dispatchError']
    assert not recorded['jobs'][1]['dispatchAttempted']
    fake.publish(ids[0],'glb');fake.unknown=False
    assert not n.collect('final-v1',out=directory,client=fake,recover=True)['completed']
    assert n.export('final-v1',0,out=directory,client=fake)['completed']
    assert fake.submitted==ids
    print(json.dumps({'sameIds':True,'submissions':len(fake.submitted)}))
`);
  assert.deepEqual(result,{sameIds:true,submissions:2});
});

for(const changed of ['scene','report'])test(`Naga prepared resume rejects changed ${changed} without dispatching the reserved job`,()=>{
  const result=offline(preparedExport+`
with tempfile.TemporaryDirectory() as directory:
    fake,ids,path,source=prepared(directory);before=s.read_json(path)
    if '${changed}'=='scene':fake.revision+=10
    else:
        report=s.read_json(source);report['animationSnapshotId']='external-authoring';s.write_json(source,report)
    collected=n.collect('final-v1',out=directory,client=fake)
    if '${changed}'=='scene':assert collected['sceneRevision']==before['sceneRevision'],'Query must not rebase an external revision'
    try:n.export('final-v1',0,out=directory,client=fake)
    except ValueError as error:assert 'Scene/report changed' in str(error)
    else:raise AssertionError('Stale prepared source must be rejected')
    recorded=s.read_json(path)
    assert fake.submitted==[] and not recorded['jobs'][1]['dispatchAttempted']
    assert recorded['rigReportSha256']==before['rigReportSha256']
    assert [j['jobId'] for j in recorded['jobs']]==ids
    print(json.dumps({'blocked':True,'submissions':len(fake.submitted)}))
`);
  assert.deepEqual(result,{blocked:true,submissions:0});
});

test('Naga export and collect reject wrong or missing species fields before transport; only prepared journals resume',()=>{
  const result=offline(preparedExport+String.raw`
with tempfile.TemporaryDirectory() as directory:
    fake,ids,path,source=prepared(directory);valid=s.read_json(source)
    for field,value in [('type','chalawan'),('taxon','humanoid-biped'),('legs',[{}]),('arms',[{}]),('legs',None),('arms',None)]:
        invalid=copy.deepcopy(valid);invalid[field]=value;s.write_json(source,invalid)
        for operation in [n.export,n.collect]:
            try:operation('final-v1',out=directory,client=fake)
            except ValueError as error:assert 'serpent report' in str(error)
            else:raise AssertionError('Invalid species must fail closed')
    for field in ['taxon','legs','arms']:
        invalid=copy.deepcopy(valid);del invalid[field];s.write_json(source,invalid)
        try:n.export('final-v1',out=directory,client=fake)
        except ValueError:pass
        else:raise AssertionError('Missing species fields must fail closed')
    assert fake.calls==[]
    s.write_json(source,valid);journal=s.read_json(path);journal['phase']='preparing';s.write_json(path,journal)
    try:n.export('final-v1',0,out=directory,client=fake)
    except ValueError as error:assert 'Incomplete preparation' in str(error)
    else:raise AssertionError('Incomplete snapshot must not resume')
    assert fake.calls==[] and fake.submitted==[]
    assert n.TYPE not in s.TYPES
    try:s.load_inputs(n.TYPE,'NONEXISTENT-BIPED-INPUT')
    except ValueError:pass
    else:raise AssertionError('Export-only support must not enable biped authoring')
    print(json.dumps({'blockedBeforeTransport':True,'bipedRejected':True}))
`);
  assert.deepEqual(result,{blockedBeforeTransport:true,bipedRejected:true});
});
