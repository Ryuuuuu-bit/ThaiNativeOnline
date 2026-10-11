# Skill FX rendering contracts

The shared engine in `src/classes/fx/engine.js` renders local and remote skill particles. Class runners retain their existing lights, meshes, cast timing, damage hooks and world-sized smoke.

## Particle projection

`Points.onBeforeRender` reads `renderer.getCurrentViewport()` and the active render camera. Its height is in render-target pixels. Pass that height and pixel ratio 1 into `particleProjection`; the viewport already includes device pixel ratio. Reuse the per-pool Vector4 rather than allocating one per frame.

Canvas CSS height times device pixel ratio is suitable as a pre-render fallback, but it is not the draw-time size when high-quality postprocessing lowers its target resolution. The old uniform stayed unchanged when the target shrank to 60%, enlarging each particle by 1 / 0.6 after upscaling.

A focused Edge/SwiftShader GPU probe with identical camera, normal smoke, and emission measured 62 screen pixels at full resolution and 103.33 pixels at 60% before the correction. With the draw-time viewport uniform, it measured 62 and 60 pixels respectively; the small difference is rasterization. Probe receipt: ignored `artifacts/skill-obstruction/gpu-projection.json`.

`tests/fx-render-viewport.test.js` executes the actual engine with Three.js Points and checks both pools across full/80%/60% render targets, camera zoom and orthographic/perspective draws.

## Defined shader fades

GLSL `smoothstep` results are undefined when edge0 >= edge1. Ground decals use `fadeOut(lo, hi, x)`, an inverse smoothstep with ascending edges and a minimum edge separation, including a shock's zero-radius first frame. Boxer flame tips and the fullscreen PostFX vignette use ascending smoothstep followed by inversion. The grade keeps its existing center/edge profile and all lighting values. These preserve their intended fade profile without relying on GPU-specific handling.

Regression coverage: `tests/fx-shader-fades.test.js` rejects reversed constant edges and evaluates the actual helper with GLSL scalar semantics across zero and nonzero shock radii, plus the actual fullscreen grade expression from center to edge.

Specification: [Khronos GLSL 4.20, section 8.3](https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.20.pdf).

## Limits

A GPU portability error and measured particle enlargement are concrete rendering defects. The user-reported whole-screen opaque obstruction did not reproduce in the deployed baseline on headless SwiftShader. These checks do not establish behavior on the user's physical GPU or prove that every reported flicker has the same cause. Preserve baseline and candidate actual-cast captures in the QA report; do not describe screen-wide obstruction as reproduced without evidence.

The PostFX source edit changes the generated collision source fingerprint. `tools/export-collision.cjs` refreshed `server/data/collision.json`; all 14 maps remain byte-identical after extracting their geometry JSON. Receipt: ignored `artifacts/skill-obstruction/collision-refresh.json`.
