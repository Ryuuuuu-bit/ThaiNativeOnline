"""Shell-side client for registered Blender Harness commands; never executes bpy code."""
import json
import os
from pathlib import Path
import sys
import uuid

plugin = Path(os.environ['BLENDER_DESIGN_ROOT'])
sys.path.insert(0, str(plugin))
from scripts.harness_cli import _endpoint
from scripts.harness.transport import send_request
from scripts.managed_launcher import load_descriptor

descriptor = load_descriptor(Path(os.environ['BLENDER_SESSION_DESCRIPTOR']))

def call(command, arguments=None, transaction='read', revision=None):
    request = {'protocolVersion': 'codex-blender/v1', 'sessionId': descriptor['sessionId'],
               'requestId': str(uuid.uuid4()), 'transactionId': transaction,
               'command': command, 'arguments': arguments or {}}
    if revision is not None:
        request['expectedSceneRevision'] = revision
    result = send_request(_endpoint(descriptor), descriptor['token'], request)
    if result.get('status') == 'failed' or 'error' in result:
        raise RuntimeError(json.dumps(result))
    return result

class Milestone:
    def __init__(self, label):
        self.revision = call('session.status')['sceneRevision']
        self.transaction = label + '-' + uuid.uuid4().hex[:8]
        self.mutate('transaction.begin')

    def mutate(self, command, arguments=None):
        receipt = call(command, arguments, self.transaction, self.revision)
        self.revision = receipt['sceneRevision']
        return receipt.get('result', {})

    def commit(self):
        return self.mutate('transaction.commit')['snapshotId']

    def rollback(self):
        try:
            self.mutate('transaction.rollback')
        except (RuntimeError, OSError, EOFError):
            pass  # Failed mutations can already have rolled back the milestone.
