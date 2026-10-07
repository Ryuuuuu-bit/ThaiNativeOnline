import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Post-processing on the "high" quality setting: soft bloom (lanterns, fireflies, sun
// glints on water), a light colour grade and a vignette that both deepen at night.
// On "medium" the scene renders straight to the screen as before.
//
//   const fx = new PostFX(renderer, scene, camera)
//   fx.enabled = quality === 'high'
//   fx.setSize(width, height)            after the renderer is resized
//   fx.update({ night, lantern })        once per frame, from Environment.update()
//   fx.render()                          instead of renderer.render(scene, camera)
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uTint: { value: new THREE.Color(1, 1, 1) }, uVig: { value: .22 }, uSat: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uTint; uniform float uVig; uniform float uSat; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  c.rgb *= uTint;
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  c.rgb = mix(vec3(l), c.rgb, uSat);
  vec2 d = vUv - 0.5;
  c.rgb *= mix(1.0 - uVig, 1.0, smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.9))));
  gl_FragColor = c;
}`,
};
const DAY_TINT = new THREE.Color(1.02, 1, .96), NIGHT_TINT = new THREE.Color(.92, .97, 1.08);

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.enabled = true;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.pass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .18, .5, .9);
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.pass); this.composer.addPass(this.bloom); this.composer.addPass(this.grade); this.composer.addPass(new OutputPass());
    const size = renderer.getSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
  }
  setSize(width, height) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(Math.max(1, width), Math.max(1, height));
  }
  update({ night = 0, lantern = 0 } = {}) {
    this.bloom.strength = .16 + .42 * night + .12 * lantern;
    const u = this.grade.uniforms;
    u.uTint.value.copy(DAY_TINT).lerp(NIGHT_TINT, night);
    u.uVig.value = .2 + .16 * night;
    u.uSat.value = 1.08 - .06 * night;
  }
  render() {
    if (this.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
  dispose() { this.composer.dispose(); }
}
