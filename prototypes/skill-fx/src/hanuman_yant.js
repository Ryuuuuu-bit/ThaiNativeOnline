/* ---------------- Hanuman sak-yant (PixelLab line art) → glowing gold linework with อักขระ arcs, inked-on reveal ---------------- */
let HANUMAN_TEX = null;
function buildHanumanTex() {
  if (HANUMAN_TEX) return HANUMAN_TEX;
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  /* dark ink → white lines on transparent (luminance keyed) */
  const src = document.createElement('canvas'); src.width = src.height = 256; const sg = src.getContext('2d'); sg.drawImage(HANUMAN_IMG, 0, 0);
  const d = sg.getImageData(0, 0, 256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const l = (d.data[i] * .3 + d.data[i + 1] * .59 + d.data[i + 2] * .11) / 255, a = d.data[i + 3] / 255; const ink = Math.max(0, Math.min(1, (.62 - l) / .4)) * a;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = ink * 255; }
  sg.putImageData(d, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(src, 96, 96, 320, 320);
  /* อักขระ: looped script strokes on an arc below, a short row above, and side ticks like the tattoo layout */
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 3;
  const glyph = (x, y, s, rot, k) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
    g.arc(0, 0, 3.2 * s, Math.PI * .2, Math.PI * 2.1); g.moveTo(3 * s, 0); g.lineTo(3 * s, -8 * s - (k % 3) * 2 * s);
    if (k % 2) { g.moveTo(-3 * s, 0); g.quadraticCurveTo(-6 * s, -6 * s, -1 * s, -9 * s); } g.stroke(); g.restore(); };
  for (let i = 0; i < 22; i++) { const a = Math.PI * (.18 + .64 * i / 21), r = 228; glyph(256 + Math.cos(a) * r, 236 + Math.sin(a) * r * .95, 1.6, a - Math.PI / 2, i); }
  for (let i = 0; i < 4; i++) { const x = 214 + i * 28; g.beginPath(); g.moveTo(x, 18); g.lineTo(x, 52); g.stroke(); glyph(x, 60, 1.5, 0, i); }
  [[52, 250, -1], [460, 250, 1]].forEach(([x, y, s]) => { g.beginPath(); g.moveTo(x - 30 * s, y); g.lineTo(x + 30 * s, y); g.stroke(); for (let k = 0; k < 3; k++) glyph(x + s * (k * 14 - 14), y - 12, 1.1, 0, k); });
  HANUMAN_TEX = new THREE.CanvasTexture(c); HANUMAN_TEX.colorSpace = THREE.SRGBColorSpace; return HANUMAN_TEX;
}
const HANUMAN_IMG = (() => { const i = new Image(); i.src = A.hanuman_yant; return i; })();
function hanumanYant() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uMap: { value: buildHanumanTex() }, uReveal: { value: 0 }, uA: { value: 1 }, uPulse: { value: 0 }, uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uReveal,uA,uPulse,uT;
      float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){ float ink=texture2D(uMap,vUv).a;
        /* soft halo: sample around for a glow under the lines */
        float halo=0.; for(int i=0;i<8;i++){ float a=float(i)*.785; halo+=texture2D(uMap,vUv+vec2(cos(a),sin(a))*.006).a; } halo/=8.;
        float order=length(vUv-vec2(.5,.48))*1.25+h(floor(vUv*64.))*.12; float rv=smoothstep(order-.04,order,uReveal);
        float edge=smoothstep(order-.1,order,uReveal)-rv; /* bright ink tip at the reveal front */
        vec3 gold=vec3(2.2,1.55,.55)*(1.+uPulse*.8), deep=vec3(1.4,.55,.12);
        vec3 col=gold*ink*rv + deep*halo*.6*rv + vec3(2.6,2.4,1.8)*edge*halo*2.;
        col*=.85+.15*sin(uT*6.+vUv.y*20.);
        gl_FragColor=vec4(col*uA,1.); }` }));
  m.renderOrder = 2; scene.add(m); return m;
}
