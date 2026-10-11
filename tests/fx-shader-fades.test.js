import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const engine = await readFile(new URL('../src/classes/fx/engine.js', import.meta.url), 'utf8');
const boxer = await readFile(new URL('../src/classes/fx/boxer-skills.js', import.meta.url), 'utf8');
const postfx = await readFile(new URL('../src/world/PostFX.js', import.meta.url), 'utf8');

test('FX fragment fades never call GLSL smoothstep with reversed constant edges', () => {
  for (const source of [engine, boxer, postfx]) {
    for (const call of source.matchAll(/smoothstep\(\s*([-+]?[\d.]+)\s*,\s*([-+]?[\d.]+)\s*,/g)) {
      assert.ok(Number(call[1]) < Number(call[2]), `Undefined GLSL fade: ${call[0]}`);
    }
  }
});

test('shock and normal-blended pool fade remains finite at zero radius and through its lifetime', () => {
  // Evaluate the actual shader helper with scalar GLSL semantics, rather than a
  // duplicate fade implementation. GLSL permits smoothstep only for lo < hi.
  const body = engine.match(/float fadeOut\(float lo,float hi,float x\)\{([^}]+)\}/)?.[1];
  assert.ok(body, 'ground shader must define its descending fade safely');
  const smoothstep = (lo, hi, x) => {
    assert.ok(lo < hi, 'GLSL edges must be ordered and distinct');
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  };
  const fade = new Function('lo', 'hi', 'x', 'smoothstep', 'max', body);
  for (const radius of [0, 0.000001, .01, .25, 1]) {
    for (const x of [0, radius / 2, radius, 1, 1.42]) {
      const value = fade(0, radius, x, smoothstep, Math.max);
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
  }
  assert.equal(fade(.75, 1, .5, smoothstep, Math.max), 1);
  assert.equal(fade(.75, 1, 1.2, smoothstep, Math.max), 0);
  assert.match(engine, /fadeOut\(0\.,R,r\)/, 'frame-zero shock uses the guarded helper');
});


test('fullscreen grade keeps a finite, monotonic vignette from center to edge', () => {
  const expression = postfx.match(/mix\(1\.0 - uVig, 1\.0, (.*)\);/)?.[1];
  assert.ok(expression, 'grade must retain its original tint/vignette mix');
  const scalar = expression.replace(/length\(d \* vec2\(1\.0, 0\.9\)\)/, 'radius');
  const evaluate = new Function('radius', 'smoothstep', 'return ' + scalar);
  const smoothstep = (lo, hi, x) => {
    assert.ok(lo < hi, 'fullscreen shader cannot use undefined GLSL edges');
    const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  };
  let previous = 1;
  for (const radius of [0, .25, .4, .6, .85, 1]) {
    const fade = evaluate(radius, smoothstep);
    assert.ok(Number.isFinite(fade) && fade >= 0 && fade <= previous);
    previous = fade;
  }
  assert.equal(evaluate(0, smoothstep), 1);
  assert.equal(evaluate(1, smoothstep), 0);
});
