import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Exercise the real live-map constructor/update with rendering dependencies stubbed.
// Shader rendering is covered by browser QA; this checks which DOM layers can
// darken the player's entire viewport when any class runner changes cinematic mood.
const source = (await readFile(new URL('../src/training/TrainingGround.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '')
  .replaceAll('import.meta.env.BASE_URL', "'/'");
function harness() {
  const node = () => ({ style: {}, children: [], append(...children) {
    this.children.push(...children); for (const child of children) child.parentNode = this;
  } });
  const root = node(), group = {}, runner = { busy: false, facing: null, update() {} };
  const fx = { mood: 0, stop: 0, warm() {}, resize() {}, update() {} };
  const TrainingGround = runInNewContext(source + '\nTrainingGround;', {
    document: { createElement: node }, location: { search: '' }, URLSearchParams,
    window: { addEventListener() {} }, TRAINING: { fighter: { skillLevel: 1, level: 1, stats: {} }, dummy: { def: 0, eva: 0 } },
    FOREST_K: 1.35, jobDerived: () => ({}), createFx: () => fx,
    makeModelCharacter: () => ({ group, ready: { then() { return { catch() {} }; } } }),
    KitCaster: class { constructor() { this.runner = runner; } update() {} },
  });
  TrainingGround.prototype.buildPanel = node;
  const training = new TrainingGround({ root, scene: {}, camera: {},
    renderer: { domElement: { addEventListener() {} } },
    player: { group, position: { x: 0, y: 0, z: 0 } } },
  { skills: 'shaman', job: 'shaman', height: 1.8, url: 'model.glb' }, { name: 'หมอผี' });
  return { training, root, fx };
}

test('repeated local skill cinematics never attach a viewport-darkening layer', () => {
  const { training, root, fx } = harness();
  for (const mood of [0, .55, 1, .65, 0, 1, 0]) {
    fx.mood = mood;
    training.update(1 / 60);
    assert.deepEqual(root.children.map(child => child.className), ['fx-labels']);
    assert.equal(fx.mood, mood, 'local FX mood/gain remains available');
  }
});

test('legacy boxer screen dim can still be written without affecting live-map DOM', () => {
  const { training, root } = harness();
  training.dim.style.opacity = '.25';
  assert.equal(training.dim.parentNode, undefined);
  assert.ok(!root.children.includes(training.dim));
  training.dim.style.opacity = '0';
  assert.ok(root.children.includes(training.labels), 'combat labels remain visible');
});
