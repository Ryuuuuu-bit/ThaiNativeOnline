"""Recoverable Meshy animation-library fetch. Credentials remain in the environment.

python tools/monster-models/meshy/fetch_motion.py --catalog
python tools/monster-models/meshy/fetch_motion.py --submit --rig-task-id ID --action-ids 0 125 126 219
python tools/monster-models/meshy/fetch_motion.py --collect

An existing or uncertain POST is never resubmitted. Status and signed URLs
remain in ignored artifacts. Commit only stripped motion and public provenance.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.request

BASE = 'https://api.meshy.ai/openapi/v1/'
OUT = Path(__file__).resolve().parents[3] / 'artifacts/boss-motion-polish'


def request(path, payload=None):
    req = urllib.request.Request(BASE + path,
        data=None if payload is None else json.dumps(payload).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['MESHY_API_KEY'],
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--catalog', action='store_true')
    action.add_argument('--submit', action='store_true')
    action.add_argument('--collect', action='store_true')
    parser.add_argument('--rig-task-id')
    parser.add_argument('--action-ids', nargs='+', type=int)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    task_path = OUT / 'meshy-animation-task.json'
    intent_path = OUT / 'meshy-animation-intent.json'
    if args.catalog:
        library = request('animations/library')
        (OUT / 'meshy-library.json').write_text(json.dumps(library, indent=2))
        print(json.dumps({'actions': len(library), 'balance': request('balance')['balance']}))
        return
    if args.submit:
        if task_path.exists() or intent_path.exists():
            raise RuntimeError('An animation task or intent already exists; recover it instead of repeating POST.')
        ids = args.action_ids or []
        if not args.rig_task_id or not 1 <= len(ids) <= 10 or len(set(ids)) != len(ids):
            raise ValueError('Provide a rig task and 1–10 distinct library action IDs.')
        library = request('animations/library')
        if not set(ids).issubset({a['action_id'] for a in library}):
            raise ValueError('A selected action is no longer in the live Meshy library.')
        if request('balance')['balance'] < len(ids) * 3:
            raise RuntimeError('Insufficient credits for the explicitly selected animation batch.')
        payload = {'rig_task_id': args.rig_task_id, 'action_ids': ids}
        intent_path.write_text(json.dumps(payload, indent=2))
        task = request('animations', payload)
        task_path.write_text(json.dumps(task, indent=2))
        print(json.dumps({'task': task['result'], 'actions': ids}))
        return
    task_id = json.loads(task_path.read_text())['result']
    task = request('animations/' + task_id)
    (OUT / 'meshy-animation-status.json').write_text(json.dumps(task, indent=2))
    print(json.dumps({k: task.get(k) for k in ('id', 'status', 'progress', 'consumed_credits')}))
    if task['status'] in ('FAILED', 'CANCELED'):
        raise RuntimeError(json.dumps(task.get('task_error')))
    if task['status'] != 'SUCCEEDED':
        return
    output = OUT / 'meshy-actions.glb'
    if not output.exists():
        with urllib.request.urlopen(task['result']['animation_glb_url'], timeout=45) as response:
            data = response.read()
        if len(data) < 20 or data[:4] != b'glTF':
            raise ValueError('Meshy did not return a GLB animation file.')
        output.write_bytes(data)
    data = output.read_bytes()
    print(json.dumps({'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}))


if __name__ == '__main__':
    main()
