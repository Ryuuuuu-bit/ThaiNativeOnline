"""Generate one recoverable Meshy Image-to-3D candidate. Credentials stay in env.

python tools/monster-models/meshy/generate.py boar --submit
python tools/monster-models/meshy/generate.py boar --collect

Task IDs are persisted before polling. POST is never automatically retried.
Original downloads/status stay in ignored artifacts; committed provenance has
no access tokens, base64 data or signed URLs.
"""
import argparse
import base64
import hashlib
import json
import os
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[3]
DEST = ROOT / 'tools/monster-models/meshy'
TMP = ROOT / 'artifacts/meshy-monsters'
BASE = 'https://api.meshy.ai/openapi/v1/'


def request(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={
        'Authorization': 'Bearer ' + os.environ['MESHY_API_KEY'],
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=90) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('creature', choices=['boar', 'fowl', 'crab', 'cobra', 'monkey', 'dhole', 'phibpa', 'buffalo', 'kongkoi', 'monitor', 'pray', 'khamot', 'winyan', 'takian', 'headless', 'pret', 'krahang', 'krasue', 'phitaihong', 'soldier', 'pusom', 'croc', 'chalawan', 'bamboo_grave_3', 'sealed_mine_3'])
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--submit', action='store_true')
    action.add_argument('--collect', action='store_true')
    parser.add_argument('--variant', choices=['anatomy-v2','thai-volume-v3'], help='Explicit separately reviewed correction; never an automatic POST retry')
    args = parser.parse_args()
    name = args.creature
    tmp = TMP / name
    if args.variant:
        tmp = tmp / args.variant
    tmp.mkdir(parents=True, exist_ok=True)
    job_path = tmp / 'task.json'
    if args.submit:
        intent_path = tmp / 'submit-intent.json'
        if job_path.exists() or intent_path.exists():
            raise RuntimeError('Task already exists; collect it instead of spending credits again.')
        reference = DEST / 'references' / (name + ('-' + args.variant if args.variant else '') + '.png')
        parameters = json.loads((DEST / 'parameters.json').read_text())
        submitted_parameters = parameters.copy()
        if name in ['chalawan', 'bamboo_grave_3', 'sealed_mine_3']:
            parameters['pose_mode'] = 'a-pose'
            submitted_parameters = parameters.copy()
        if name in ['croc', 'chalawan', 'bamboo_grave_3', 'sealed_mine_3']:
            balance = request('balance')['balance']
            if balance < 35:
                raise RuntimeError('At least 35 Meshy credits required for this 2K geometry/texture candidate.')
        parameters['image_url'] = 'data:image/png;base64,' + base64.b64encode(reference.read_bytes()).decode()
        intent_path.write_text(json.dumps({'referenceSha256': hashlib.sha256(reference.read_bytes()).hexdigest(),
                                            'parameters': submitted_parameters,
                                            'note': 'If POST outcome is unknown, recover the task from Meshy history. Do not resubmit.'}, indent=2))
        task = request('image-to-3d', parameters)
        job_path.write_text(json.dumps(task, indent=2))
        print(json.dumps({'creature': name, 'task': task['result']}))
        return
    task_id = json.loads(job_path.read_text())['result']
    task = request('image-to-3d/' + task_id)
    print(json.dumps({'creature': name, 'task': task_id, 'status': task['status'],
                      'progress': task.get('progress'), 'credits': task.get('consumed_credits')}, ensure_ascii=False))
    if task['status'] != 'SUCCEEDED':
        if task['status'] in ['FAILED', 'CANCELED']:
            raise RuntimeError(json.dumps(task.get('task_error')))
        return
    output = tmp / 'original.glb'
    if not output.exists():
        with urllib.request.urlopen(task['model_urls']['glb'], timeout=120) as response:
            output.write_bytes(response.read())
    intent = json.loads((tmp / 'submit-intent.json').read_text())
    info = {
        'provider': 'Meshy', 'endpoint': 'image-to-3d', 'taskId': task_id,
        'status': task['status'], 'credits': task.get('consumed_credits'),
        'parameters': intent.get('parameters', json.loads((DEST / 'parameters.json').read_text())),
        'reference': 'references/' + name + ('-' + args.variant if args.variant else '') + '.png',
        'referenceSha256': hashlib.sha256((DEST / 'references' / (name + ('-' + args.variant if args.variant else '') + '.png')).read_bytes()).hexdigest(),
        'originalSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'originalBytes': output.stat().st_size,
        'originalLocalPath': str(output.relative_to(ROOT)).replace('\\', '/'),
    }
    (DEST / (name + '-provenance.json')).write_text(json.dumps(info, indent=2) + '\n')
    print(json.dumps({'downloaded': str(output.relative_to(ROOT)), 'bytes': output.stat().st_size}))


if __name__ == '__main__':
    main()
