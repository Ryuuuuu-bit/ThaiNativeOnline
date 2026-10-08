// Build a review candidate with Meshy's own locomotion on its 24-bone rig.
// Build dependencies and the game-class donor workflow are documented nearby.
import { load, writeAnim, THREE } from '../../muaythai-anims/lib.mjs';

const [source, walkFile, runFile, output] = process.argv.slice(2);
if (!output) throw Error('Expected rigged source, walking GLB, running GLB and output');
const R = await load(source), buffer = R.root.listBuffers()[0];
for (const anim of [...R.root.listAnimations()]) anim.dispose();
const rest = new Map(R.nodes.map(n => [n, {
  t: new THREE.Vector3(...n.getTranslation()),
  r: new THREE.Quaternion(...n.getRotation()),
  s: new THREE.Vector3(...n.getScale()),
}]));
writeAnim(R, 'idle', Array.from({ length: 31 }, () => rest), 30);
for (const [name, path] of [['walk', walkFile], ['run', runFile]]) {
  const D = await load(path), sourceClip = D.root.listAnimations()[0];
  if (!sourceClip) throw Error(`Missing ${name} animation`);
  const anim = R.doc.createAnimation(name), accessors = new Map(), samplers = new Map();
  const copyAccessor = a => {
    if (!accessors.has(a)) accessors.set(a, R.doc.createAccessor().setType(a.getType())
      .setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer));
    return accessors.get(a);
  };
  for (const ch of sourceClip.listChannels()) {
    const target = R.byName[ch.getTargetNode().getName()];
    if (!target) throw Error(`Missing target ${ch.getTargetNode().getName()}`);
    const s = ch.getSampler();
    if (!samplers.has(s)) {
      const copied = R.doc.createAnimationSampler().setInput(copyAccessor(s.getInput()))
        .setOutput(copyAccessor(s.getOutput())).setInterpolation(s.getInterpolation());
      anim.addSampler(copied); samplers.set(s, copied);
    }
    anim.addChannel(R.doc.createAnimationChannel().setTargetNode(target)
      .setTargetPath(ch.getTargetPath()).setSampler(samplers.get(s)));
  }
}
await R.io.write(output, R.doc);
console.log(`${output}: idle, walk, run`);
