import * as THREE from 'three';
import { smoothstep, wildness, cemeteryFactor } from './CityMap.js';
import { nightGlow } from './materials.js';
import { waterUniforms } from './Water.js';

// Lighting keyframes across the day. Sun direction comes from the north-west so
// shadows fall toward the camera and stay readable in the 2.5D view.
const KEYS = [
  { h: 0, sun: '#8ea7d8', si: .78, el: 52, az: -140, sky: '#5a6c92', ground: '#242b28', hi: 1.15, fog: '#2a3644', exp: 1, water: '#3d5470' },
  { h: 4.6, sun: '#8ea7d8', si: .7, el: 40, az: -150, sky: '#56678c', ground: '#242b28', hi: 1.1, fog: '#2c3646', exp: 1, water: '#3d5470' },
  { h: 5.7, sun: '#ffb98a', si: 1.2, el: 9, az: -165, sky: '#a99aa8', ground: '#3c3a36', hi: 1.3, fog: '#8e8794', exp: 1.08, water: '#b8a8b0' },
  { h: 7, sun: '#ffd2a0', si: 2.4, el: 24, az: -150, sky: '#d9d6c4', ground: '#5c5d44', hi: 2, fog: '#c6c2a6', exp: 1.15, water: '#cfcbb4' },
  { h: 9.5, sun: '#fff0c6', si: 3.1, el: 50, az: -130, sky: '#dde8d3', ground: '#5e6244', hi: 2.5, fog: '#b9c6a4', exp: 1.18, water: '#c7d6c4' },
  { h: 13, sun: '#fff6e2', si: 3.3, el: 64, az: -122, sky: '#e2ecdb', ground: '#61684a', hi: 2.55, fog: '#c1cdb2', exp: 1.14, water: '#cddccd' },
  { h: 16, sun: '#ffe2b0', si: 2.9, el: 40, az: -108, sky: '#d8d8c8', ground: '#5f5e45', hi: 2.2, fog: '#c3bea0', exp: 1.15, water: '#d2cdb4' },
  { h: 17.6, sun: '#ffd09c', si: 2.3, el: 20, az: -98, sky: '#c9c0bc', ground: '#5c5040', hi: 1.8, fog: '#bdab92', exp: 1.15, water: '#d6b89a' },
  { h: 18.8, sun: '#ff9e70', si: 1.2, el: 7, az: -90, sky: '#8f86a0', ground: '#3a3438', hi: 1.25, fog: '#7e7488', exp: 1.08, water: '#9a8094' },
  { h: 20, sun: '#8ea7d8', si: .78, el: 48, az: -140, sky: '#5d6f94', ground: '#252c2a', hi: 1.15, fog: '#2e3a48', exp: 1, water: '#40587a' },
  { h: 24, sun: '#8ea7d8', si: .78, el: 52, az: -140, sky: '#5a6c92', ground: '#242b28', hi: 1.15, fog: '#2a3644', exp: 1, water: '#3d5470' },
];
const c1 = new THREE.Color(), c2 = new THREE.Color();
const FOREST_FOG = [new THREE.Color('#3f4c3d'), new THREE.Color('#1b2421')], GRAVE_FOG = [new THREE.Color('#5d6764'), new THREE.Color('#1a2328')];

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.hemi = new THREE.HemisphereLight('#dde8d3', '#5e6244', 2.5); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0c6', 3.1);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 140 });
    this.sun.shadow.bias = -.0004; this.sun.shadow.normalBias = .04;
    scene.add(this.sun); scene.add(this.sun.target);
    scene.fog = new THREE.FogExp2('#b9c6a4', .012); scene.background = new THREE.Color('#b9c6a4');
    this.dir = new THREE.Vector3(); this.state = { hour: 9, night: 0, lantern: 0, wild: 0, cemetery: 0 };
    this.tmp = { right: new THREE.Vector3(), up: new THREE.Vector3(), snap: new THREE.Vector3() };
  }
  sample(hour) {
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = smoothstep(0, 1, (hour - a.h) / (b.h - a.h));
    const mix = key => c1.set(a[key]).lerp(c2.set(b[key]), t).clone(), num = key => a[key] + (b[key] - a[key]) * t;
    return { sun: mix('sun'), sky: mix('sky'), ground: mix('ground'), fog: mix('fog'), water: mix('water'), si: num('si'), hi: num('hi'), el: num('el'), az: num('az'), exp: num('exp') };
  }
  update(hour, focus) {
    const k = this.sample(hour), w = wildness(focus.z), cem = cemeteryFactor(focus.x, focus.z);
    const night = Math.max(1 - smoothstep(4.5, 6.2, hour), smoothstep(18.6, 20, hour));
    const lantern = Math.max(1 - smoothstep(5.4, 6.6, hour), smoothstep(17.4, 18.6, hour));
    Object.assign(this.state, { hour, night, lantern, wild: w, cemetery: cem });

    // Deeper forest and the cemetery: darker, greener, foggier and quieter.
    k.fog.lerp(FOREST_FOG[0].clone().lerp(FOREST_FOG[1], night), w * .7).lerp(GRAVE_FOG[0].clone().lerp(GRAVE_FOG[1], night), cem * .75);
    this.scene.fog.color.copy(k.fog); this.scene.background.copy(k.fog);
    this.scene.fog.density = .01 + w * .015 + cem * .007 + night * .003;
    this.sun.color.copy(k.sun); this.sun.intensity = k.si * (1 - .5 * w - .25 * cem);
    this.hemi.color.copy(k.sky).lerp(c1.set('#5d7a5a'), w * .35); this.hemi.groundColor.copy(k.ground);
    this.hemi.intensity = k.hi * (1 - .32 * w - .2 * cem);
    this.renderer.toneMappingExposure = k.exp * (1 - .07 * w);

    const el = THREE.MathUtils.degToRad(k.el), az = THREE.MathUtils.degToRad(k.az);
    this.dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    // Snap the shadow frustum to texels so shadows do not shimmer while walking.
    const { right, up, snap } = this.tmp, texel = 72 / this.sun.shadow.mapSize.x;
    right.crossVectors(THREE.Object3D.DEFAULT_UP, this.dir).normalize(); up.crossVectors(this.dir, right);
    const a = Math.round(focus.dot(right) / texel) * texel, b = Math.round(focus.dot(up) / texel) * texel, c = focus.dot(this.dir);
    snap.copy(right).multiplyScalar(a).addScaledVector(up, b).addScaledVector(this.dir, c);
    this.sun.target.position.copy(snap); this.sun.position.copy(snap).addScaledVector(this.dir, 70);

    waterUniforms.uSky.value.copy(k.water); waterUniforms.uNight.value = night; waterUniforms.uSun.value.copy(k.sun); waterUniforms.uSunDir.value.copy(this.dir);
    for (const m of nightGlow) m.emissiveIntensity = m.userData.glow * lantern;
    return this.state;
  }
}
