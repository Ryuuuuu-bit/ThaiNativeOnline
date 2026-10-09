"""Read existing snapshot export jobs; never submit or retry an unknown export."""
import hashlib,json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from harness_client import Milestone
out=Path(os.environ.get('MESHY_RIG_OUTPUT','artifacts/meshy-rig-03/deep-forest'))
kind=sys.argv[1];report_path=out/f'{kind}-rig-report.json'
report=json.loads(report_path.read_text());m=Milestone(kind+'-collect-exports')
try:
    # A terminal worker's status releases its scheduler slot; drain earlier
    # snapshots too, even when the caller only needs the newest species.
    for path in (out/'jobs').glob('*/status.json'):
        status=json.loads(path.read_text())
        m.mutate('job.status',{'jobId':status['jobId']})
    jobs=[m.mutate('job.status',{'jobId':j['jobId']}) for j in report['jobs']];m.commit()
except Exception:m.rollback();raise
for job in jobs:
    if job['state']=='completed':
        artifact=job['artifact'];data=Path(artifact['path']).read_bytes()
        assert len(data)==artifact['bytes'] and hashlib.sha256(data).hexdigest()==artifact['sha256']
report['productionExports']=jobs;report_path.write_text(json.dumps(report,indent=2))
print(json.dumps([{'jobId':j['jobId'],'state':j['state'],'artifact':j.get('artifact')} for j in jobs]))
sys.exit(0 if all(j['state']=='completed' for j in jobs) else 1)
