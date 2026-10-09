import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Synthetic math + stubbed Harness transport only. No Blender descriptor, paid
// generation, source asset mutation, or claims of real model anatomy approval.
const python = String.raw`
import collections, copy, hashlib, json, math, os, struct, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path.cwd()/'tools/monster-models/meshy'))
import boss_weights as weights
import boss_rig as rig

def recipe(kind='bamboo_grave_3'):
    bones=[]
    def bone(n,h,t,p='Body',deform=True,connected=False):
        bones.append(dict(name=n,head=h,tail=t,parent=p,deform=deform,connected=connected))
    bone('Root',[0,0,0],[0,0,.2],None,False)
    bone('Pelvis',[0,0,.9],[0,0,1.02],'Root')
    bone('Body',[0,0,1.02],[0,0,1.60],'Pelvis')
    bone('Head',[0,0,1.60],[0,0,1.90])
    arms=[];legs=[]
    for side,s in [('L',-1),('R',1)]:
        bone('Arm'+side+'Upper',[s*.24,0,1.5],[s*.37,0,1.25])
        bone('Arm'+side+'Lower',[s*.37,0,1.25],[s*.46,0,1.03],'Arm'+side+'Upper',connected=True)
        bone('Hand'+side,[s*.46,0,1.03],[s*.53,0,.94],'Arm'+side+'Lower',connected=True)
        arms.append(dict(name='Arm'+side))
        bone('Leg'+side+'Upper',[s*.14,0,.9],[s*.14,-.045,.49],'Pelvis')
        bone('Leg'+side+'Lower',[s*.14,-.045,.49],[s*.14,0,.10],'Leg'+side+'Upper',connected=True)
        bone('Leg'+side+'Foot',[s*.14,0,.10],[s*.14,-.15,.045],'Leg'+side+'Lower',connected=True)
        legs.append(dict(name='Leg'+side,pole=[s*.14,-.6,.49],phase=0 if s<0 else .5))
    tail=[]
    if kind=='chalawan':
        parent='Pelvis'
        for n,h,t in [('TailBase',[0,.09,.9],[0,.45,.77]),('TailMid',[0,.45,.77],[0,.8,.55]),('TailTip',[0,.8,.55],[0,1.18,.35])]:
            bone(n,h,t,parent,connected=parent!='Pelvis');parent=n;tail.append(n)
    return dict(type=kind,coordinateSystem='blender',sourceHeight=1.9,bones=bones,arms=arms,legs=legs,tail=tail)

def surface(r):
    points=[];indices=[]
    def strip(samples,width):
        base=len(points)
        for x,y,z in samples:points.extend([[x-width,y,z],[x+width,y,z]])
        for i in range(len(samples)-1):
            a=base+i*2;indices.extend([a,a+1,a+2,a+1,a+3,a+2])
    for s in [-1,1]:
        strip([(s*.14,0,z) for z in [0,.07,.16,.29,.43,.50,.57,.72,.86,.95,1.07,1.20,1.35,1.48,1.60,1.75,1.9]],.035)
        strip([(s*.24,0,1.50),(s*.37,0,1.25),(s*.46,0,1.03),(s*.53,0,.94)],.026)
    if r['tail']:
        strip([(0,.10,.90),(0,.32,.82),(0,.58,.68),(0,.89,.50),(0,1.18,.35)],.05)
    # Connected triangles plus one disconnected low cloth patch.
    cloth=len(points);points.extend([[-.05,-.16,.38],[.05,-.16,.38],[0,-.16,.43]])
    indices.extend([cloth,cloth+1,cloth+2])
    return points,indices,cloth

def calibration(r):
    return dict(rootDownLocal=[0,-1,0],tailUpLocal=[0,0,1],legs={l['name']:dict(rotation=[0,0,0],poleAngle=0) for l in r['legs']})

class FakeClient:
    def __init__(self,root,recipe=None,lost=False,missing=False,running=False):
        self.root=Path(root);self.calls=[];self.revision=0;self.recipe=recipe
        self.lost=lost;self.missing=missing;self.running=running;self.job_count=0
        self.statuses={};self.job_controls=[];self.status_error=None
        outer=self
        class Milestone:
            def __init__(self,label):
                self.revision=outer.revision;self.begin_revision=outer.revision;self.active=True
            def mutate(self,command,args=None):
                if not self.active:raise RuntimeError('TRANSACTION_NOT_FOUND')
                if self.revision!=outer.revision:raise RuntimeError('STALE_SCENE_REVISION')
                result=outer.dispatch(command,args or {},in_transaction=True)
                self.revision=outer.revision;return result
            def commit(self):self.active=False;return 'snapshot-'+str(self.revision)
            def rollback(self):
                outer.revision=self.begin_revision;self.revision=self.begin_revision;self.active=False
        self.Milestone=Milestone
    def call(self,command,args=None):return dict(result=self.dispatch(command,args or {}),sceneRevision=self.revision)
    def dispatch(self,command,args,in_transaction=False):
        self.calls.append((command,args))
        if command in ('job.status','job.recover','job.list'):
            if not in_transaction:raise RuntimeError('STALE_SCENE_REVISION / TRANSACTION_NOT_FOUND')
            self.job_controls.append((command,args))
            if self.status_error:raise self.status_error
            self.revision+=1
        if command=='session.status':return {}
        if command=='scene.inspect':return dict(objectDetails=[dict(name='Camera'),dict(name='TestRig'),dict(name='TestSurface')])
        if command=='job.submit':
            self.job_count+=1
            self.revision+=1
            if self.missing:raise RuntimeError('lost submit with unknown outcome')
            directory=self.root/'jobs'/args['jobId'];directory.mkdir(parents=True)
            snap=directory/'source.blend';snap.write_bytes(b'BLENDER synthetic snapshot')
            artifact=directory/('artifact.'+args['format'])
            artifact.write_bytes(b'glTF'+struct.pack('<II',2,24)+struct.pack('<II',4,0x4e4f534a)+b'{}  ' if args['format']=='glb' else b'BLENDER synthetic output')
            status=dict(jobId=args['jobId'],state='running' if self.running else 'completed',kind='EXPORT',
                snapshot=dict(path=str(snap),sha256=rig.sha(snap)),
                artifact=dict(path=str(artifact),sha256=rig.sha(artifact),bytes=artifact.stat().st_size))
            self.statuses[args['jobId']]=copy.deepcopy(status)
            rig.write_json(directory/'status.json',status)
            if self.lost:self.lost=False;raise RuntimeError('response lost after real job reservation')
            return status
        if command in ('job.status','job.recover'):
            path=self.root/'jobs'/args['jobId']/'status.json'
            if path.exists():return rig.read_json(path)
            if args['jobId'] in self.statuses:return copy.deepcopy(self.statuses[args['jobId']])
            raise RuntimeError('JOB_NOT_FOUND: unknown outcome retained')
        if command=='job.list':return dict(items=list(self.statuses.values()))
        if command=='asset.import_file':return dict(objects=[dict(name=self.recipe['type']+'Source')])
        if command=='mesh.inspect':return dict(counts=dict(vertices=self.count))
        if command=='rig.create_armature':return dict(objectId='rig-id')
        if command=='rig.inspect':return dict(boundMeshes=[self.surface],bones=[dict(name=b['name'],length=math.dist(b['head'],b['tail'])) for b in self.recipe['bones']])
        self.revision+=1
        return {'objectId':'control-id','vertices':args.get('vertices',[])}

class OfflineBossTests(unittest.TestCase):
    def test_import_is_offline(self):
        self.assertNotIn('harness_client',sys.modules)
        self.assertNotIn('bpy',sys.modules)
        self.assertEqual(tuple(rig.TYPES),('chalawan','bamboo_grave_3','sealed_mine_3'))

    def test_weights_normalized_deterministic_seams_and_no_cross_limb_chest_leak(self):
        for kind in rig.TYPES:
            r=recipe(kind);points,indices,cloth=surface(r)
            r['weights']={'regions':[dict(type='cloth',bone='Pelvis',vertices=[cloth,cloth+1,cloth+2])]}
            duplicate=len(points);points.append(list(points[0]));indices.extend([duplicate,1,2])
            original=copy.deepcopy(r);values=weights.boss_weights(points,indices,r)
            self.assertEqual(r,original,'recipes must not be mutated')
            self.assertEqual(values,weights.boss_weights(points,indices,r))
            self.assertEqual(values[0],values[duplicate])
            self.assertEqual(values[cloth],{'Pelvis':1})
            for p,w in zip(points,values):
                self.assertLessEqual(len(w),4);self.assertAlmostEqual(sum(w.values()),1,places=12)
                self.assertNotIn('Root',w);self.assertTrue(all(math.isfinite(v) and 0<v<=1 for v in w.values()))
                if p[2]>1.1:self.assertFalse(any(n.startswith('Leg') for n in w),'thighs may not pull the torso')
                if p[0]<-.08:self.assertFalse(any(n.startswith(('LegR','ArmR','HandR')) for n in w))
                if p[0]>.08:self.assertFalse(any(n.startswith(('LegL','ArmL','HandL')) for n in w))
            # Four explicit foot sole endpoints are completely foot-owned.
            self.assertEqual(values[0],{'LegLFoot':1});self.assertEqual(values[42],{'LegRFoot':1})

    def test_hand_blocks_and_tail_are_dedicated_without_invented_finger_bones(self):
        r=recipe('chalawan');points,indices,cloth=surface(r)
        values=weights.boss_weights(points,indices,r)
        for i,p in enumerate(points):
            if abs(p[0])>.50 and p[2]<1.0:
                self.assertEqual(values[i],{'HandL' if p[0]<0 else 'HandR':1})
            if p[1]>.55:
                self.assertTrue(set(values[i])<=set(r['tail']),'tail must not inherit thigh/body deformation')
        self.assertEqual(len(r['bones']),19)

    def test_topology_regions_pins_and_recipe_fail_closed(self):
        r=recipe();points,indices,cloth=surface(r)
        for bad in [[True,1,2],[-1,1,2],[len(points),1,2],[0,1]]:
            with self.assertRaises(ValueError):weights.boss_weights(points,bad,r)
        bad=copy.deepcopy(points);bad[0][0]=float('nan')
        with self.assertRaises(ValueError):weights.boss_weights(bad,indices,r)
        for change in [lambda x:x.update(taxon='crocodile'),lambda x:x['legs'].pop(),
                       lambda x:x['bones'][2].update(parent='Head'),lambda x:x['bones'][1].update(tail=x['bones'][1]['head']),
                       lambda x:x.update(type='sunken_city_3')]:
            bad=copy.deepcopy(r);change(bad)
            with self.assertRaises(ValueError):weights.validate_recipe(bad)
        bad=copy.deepcopy(r);bad['weights']={'regions':[dict(type='cloth',bone='LegLUpper',vertices=[cloth])]}
        with self.assertRaises(ValueError):weights.boss_weights(points,indices,bad)
        bad=copy.deepcopy(r);bad['weights']={'regions':[dict(type='rigid',bone='Body',vertices=[0]),dict(type='rigid',bone='Head',vertices=[0])]}
        with self.assertRaises(ValueError):weights.boss_weights(points,indices,bad)

    def test_bounds_masks_feather_and_quantization(self):
        r=recipe();points,indices,cloth=surface(r)
        r['weights']={'regions':[dict(type='cloth',bone='Pelvis',bounds=dict(min=[-.1,-.2,.30],max=[.1,-.14,.44]),feather=.02)]}
        v=weights.boss_weights(points,indices,r);self.assertEqual(v[cloth],{'Pelvis':1})
        q=weights.quantize({'Body':.2,'Pelvis':.2,'Head':.2,'LegLUpper':.2,'LegRUpper':.2},[b['name'] for b in r['bones']])
        self.assertEqual(len(q),4);self.assertEqual(sum(q.values()),1)

    def test_five_clip_contacts_loops_moderate_cast_and_no_hand_pose(self):
        for kind in rig.TYPES:
            r=recipe(kind);c=calibration(r);normal=weights.validate_recipe(r)
            poses=[rig.pose_at(f,r,c) for f in range(1,156)]
            for f,p in enumerate(poses,1):
                for leg in normal['legs']:
                    if not 51<=f<=75:self.assertEqual(p['targets'][leg['name']],leg['joint'])
                    else:self.assertGreaterEqual(p['targets'][leg['name']][2],leg['joint'][2])
                for arm in normal['arms']:
                    self.assertLessEqual(max(abs(v) for v in p['rotations'][arm['upper']]),1)
                    self.assertLessEqual(max(abs(v) for v in p['rotations'][arm['lower']]),.4)
                    self.assertEqual(p['rotations'][arm['hand']],[0,0,0])
                self.assertTrue(all(math.isfinite(v) for rot in p['rotations'].values() for v in rot))
            for clip in ('idle','walk'):
                a,b=rig.CLIPS[clip];first,last=poses[a-1],poses[b-1]
                for name in first['rotations']:
                    for v,w in zip(first['rotations'][name],last['rotations'][name]):self.assertAlmostEqual(v,w,places=12)
                for name in first['targets']:
                    for v,w in zip(first['targets'][name],last['targets'][name]):self.assertAlmostEqual(v,w,places=12)
            self.assertTrue(any(abs(p['rotations']['ArmLUpper'][0])>.5 for p in poses[81:105]))
            self.assertEqual(set(rig.CLIPS),{'idle','walk','attack','hurt','die'})
        bad=recipe();bad['motion']={'elbowCast':.8}
        with self.assertRaises(ValueError):rig.pose_at(92,bad,calibration(bad))

    def test_calibrated_arm_axes_override_recipe_without_hash_circularity(self):
        r=recipe();original=copy.deepcopy(r);c=calibration(r)
        c['arms']={'ArmL':dict(upperAxis=2,upperSign=1,lowerAxis=1,lowerSign=-1)}
        pose=rig.pose_at(92,r,c)
        self.assertEqual(r,original)
        self.assertGreater(pose['rotations']['ArmLUpper'][2],.5)
        self.assertEqual(pose['rotations']['ArmLUpper'][0],0)
        self.assertLess(pose['rotations']['ArmLLower'][1],-.2)
        self.assertEqual(pose['rotations']['ArmLLower'][0],0)
        self.assertLess(pose['rotations']['ArmRUpper'][0],-.5,'uncalibrated arm retains recipe defaults')
        c['arms']['ArmL']['upperAxis']=True
        with self.assertRaises(ValueError):rig.pose_at(92,r,c)

    def test_calibrated_rest_rotations_are_finite_additive_and_keep_hands_neutral(self):
        r=recipe();c=calibration(r)
        base=rig.pose_at(92,r,c)
        upper=[.12,-.25,.04];lower=[.04,0,.01]
        c['arms']={'ArmL':dict(upperRestRotation=upper,lowerRestRotation=lower)}
        idle=rig.pose_at(1,r,c)
        self.assertEqual(idle['rotations']['ArmLUpper'],upper)
        self.assertEqual(idle['rotations']['ArmLLower'],lower)
        for frame in [13,57,92,117,155]:
            without=rig.pose_at(frame,r,calibration(r));with_base=rig.pose_at(frame,r,c)
            for i in range(3):
                self.assertAlmostEqual(with_base['rotations']['ArmLUpper'][i],without['rotations']['ArmLUpper'][i]+upper[i])
                self.assertAlmostEqual(with_base['rotations']['ArmLLower'][i],without['rotations']['ArmLLower'][i]+lower[i])
            self.assertEqual(with_base['rotations']['HandL'],[0,0,0])
            self.assertEqual(with_base['rotations']['HandR'],[0,0,0])
        for value in [[0,0], [0,float('nan'),0], [True,0,0]]:
            c['arms']['ArmL']['upperRestRotation']=value
            with self.assertRaises(ValueError):rig.pose_at(1,r,c)

    def test_bind_is_registered_explicit_and_reweight_clears_old_groups(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'input').mkdir();r=recipe();points,indices,cloth=surface(r)
            inputs=root/'input';kind=r['type']
            for suffix,value in [('-anatomy.json',r),('-positions.json',[[x,z,-y] for x,y,z in points]),('-indices.json',indices)]:rig.write_json(inputs/(kind+suffix),value)
            (inputs/(kind+'.glb')).write_bytes(b'synthetic-import-placeholder')
            fake=FakeClient(root,r);fake.count=len(points);fake.surface='BambooGraveBossV1Surface'
            report=rig.bind(kind,root,client=fake)
            self.assertEqual(report['taxon'],'humanoid-biped');self.assertLessEqual(report['weights']['maxInfluences'],4)
            commands=[c for c,a in fake.calls]
            self.assertIn('rig.bind',commands);self.assertIn('rig.assign_weights',commands)
            self.assertFalse(any('auto' in c or 'script' in c for c in commands))
            with self.assertRaises(FileExistsError):rig.bind(kind,root,client=fake)
            before=len(fake.calls);r['weights']={'regions':[dict(type='cloth',bone='Pelvis',vertices=[cloth,cloth+1,cloth+2])]}
            rig.write_json(inputs/(kind+'-anatomy.json'),r);rig.bind(kind,root,reweight=True,client=fake)
            updates=fake.calls[before:]
            self.assertTrue(any(c=='rig.assign_weights' and a['weight']==0 for c,a in updates))
            self.assertNotIn('asset.import_file',[c for c,a in updates])

    def export_setup(self,root,**kw):
        root=Path(root);kind='bamboo_grave_3'
        rig.write_json(root/(kind+'-rig-report.json'),dict(type=kind,rigName='TestRig',surfaceName='TestSurface',animationSnapshotId='approved'))
        return kind,FakeClient(root,**kw)

    def test_snapshot_exports_lost_response_recovery_and_tamper_rejection(self):
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp,lost=True)
            report=rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            self.assertTrue(report['completed']);self.assertEqual(fake.job_count,2)
            self.assertEqual(report['sceneRevision'],fake.revision)
            self.assertGreater(report['jobs'][1]['postSubmitSceneRevision'],report['jobs'][1]['submissionSceneRevision'])
            self.assertEqual({j['format'] for j in report['jobs']},{'glb','blend'})
            rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0);rig.collect(kind,'final-v1',tmp,client=fake)
            self.assertEqual(fake.job_count,2,'never re-submit a lost/completed identity')
            path=Path(report['jobs'][0]['verifiedStatus']['artifact']['path']);path.write_bytes(b'tampered')
            with self.assertRaises(ValueError):rig.collect(kind,'final-v1',tmp,client=fake)
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp)
            report=rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            self.assertGreater(report['jobs'][1]['submissionSceneRevision'],report['jobs'][0]['submissionSceneRevision'])
            self.assertEqual(report['sceneRevision'],fake.revision)

    def test_unknown_submit_and_pending_jobs_never_duplicate(self):
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp,missing=True)
            for attempt in range(2):
                with self.assertRaises(RuntimeError):rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            self.assertEqual(fake.job_count,1)
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp,running=True)
            with self.assertRaises(TimeoutError):rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            path=rig.export_path(Path(tmp),kind,'final-v1');report=rig.read_json(path)
            status_path=Path(tmp)/'jobs'/report['jobs'][0]['jobId']/'status.json'
            status=rig.read_json(status_path);status['state']='completed';rig.write_json(status_path,status)
            fake.running=False
            self.assertTrue(rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)['completed'])
            self.assertEqual(fake.job_count,2)

    def test_external_scene_revision_changes_block_unsubmitted_second_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp,running=True)
            with self.assertRaises(TimeoutError):rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            path=rig.export_path(Path(tmp),kind,'final-v1');report=rig.read_json(path)
            status_path=Path(tmp)/'jobs'/report['jobs'][0]['jobId']/'status.json'
            status=rig.read_json(status_path);status['state']='completed';rig.write_json(status_path,status)
            fake.revision+=1
            with self.assertRaisesRegex(ValueError,'Scene/report changed'):
                rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            self.assertEqual(fake.job_count,1)

    def test_transactional_job_controls_acknowledge_and_accept_list_items(self):
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp)
            with self.assertRaisesRegex(RuntimeError,'STALE_SCENE_REVISION'):
                fake.call('job.status',dict(jobId='bare-call'))
            report=rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            self.assertTrue(all(j['slotAcknowledged'] for j in report['jobs']))
            self.assertEqual(len(fake.job_controls),2)
            path=rig.export_path(Path(tmp),kind,'final-v1')
            result=rig.job_control(fake,'job.list',{},report,path)
            self.assertIn('items',result);self.assertNotIn('jobs',result)
            self.assertEqual({j['jobId'] for j in result['items']},{j['jobId'] for j in report['jobs']})
            self.assertEqual(rig.read_json(path)['sceneRevision'],fake.revision)
            self.assertEqual(fake.job_count,2)

    def test_missing_receipt_and_recovery_use_transactions_without_resubmission(self):
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp,running=True)
            with self.assertRaises(TimeoutError):rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            path=rig.export_path(Path(tmp),kind,'final-v1');report=rig.read_json(path)
            job=report['jobs'][0];status_path=Path(tmp)/'jobs'/job['jobId']/'status.json'
            status_path.unlink()
            status=rig.job_status(Path(tmp),job,fake,recover=True,report=report,journal_path=path)
            self.assertEqual(status['state'],'running')
            self.assertEqual([c for c,a in fake.job_controls],['job.status','job.recover'])
            self.assertEqual(report['sceneRevision'],fake.revision)
            self.assertEqual(fake.job_count,1)
            self.assertFalse(job.get('slotAcknowledged',False))

    def test_failed_slot_acknowledgment_is_not_recorded_or_resubmitted(self):
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp);fake.status_error=RuntimeError('lost job-status response')
            with self.assertRaisesRegex(RuntimeError,'lost job-status'):
                rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            path=rig.export_path(Path(tmp),kind,'final-v1');report=rig.read_json(path)
            self.assertFalse(report['jobs'][0].get('slotAcknowledged',False))
            self.assertEqual(report['sceneRevision'],fake.revision)
            fake.status_error=None
            self.assertTrue(rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)['completed'])
            self.assertEqual(fake.job_count,2)

    def test_collect_removes_old_verification_when_receipt_is_now_failed(self):
        with tempfile.TemporaryDirectory() as tmp:
            kind,fake=self.export_setup(tmp)
            report=rig.export(kind,'final-v1',tmp,client=fake,wait_seconds=0)
            job=report['jobs'][0];status_path=Path(tmp)/'jobs'/job['jobId']/'status.json'
            status=rig.read_json(status_path);status['state']='failed';rig.write_json(status_path,status)
            report=rig.collect(kind,'final-v1',tmp,client=fake)
            self.assertFalse(report['completed']);self.assertNotIn('verifiedStatus',report['jobs'][0])
            self.assertEqual(report['jobs'][0]['failedStatus']['state'],'failed')
            self.assertEqual(fake.job_count,2)

unittest.main(argv=['offline-boss-rig-tests'],verbosity=2)
`;

test('Meshy humanoid boss weights, staged motions and durable jobs pass offline Python checks', () => {
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-B', '-c', python], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 30000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', BLENDER_SESSION_DESCRIPTOR: '', BLENDER_DESIGN_ROOT: '' },
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Ran 16 tests/);
});
