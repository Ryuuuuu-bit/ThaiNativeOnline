/* ---------------- ยันต์วงกลม for the ward: double ring of script, tiered chedi blocks around it, radiating lines with zigzag tails, outer glyph clusters ---------------- */
const WARD_YANT_TEX = (() => {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), C0 = S / 2;
  g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  const LET = 'กขคฆงจฉชซญฎฏฐฑฒณดตถทธนบปผพภมยรลวศษสหฬอฮ', rl = () => LET[(Math.random() * LET.length) | 0];
  const ringText = (r, n, size, rot = 0) => { g.font = `600 ${size}px "Srisakdi","Anuphan",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rot; g.save(); g.translate(C0 + Math.cos(a) * r, C0 + Math.sin(a) * r); g.rotate(a + Math.PI / 2); g.fillText(rl(), 0, 0); g.restore(); } };
  /* rings */
  g.lineWidth = 6; [300, 236].forEach(r => { g.beginPath(); g.arc(C0, C0, r, 0, 7); g.stroke(); });
  g.lineWidth = 2.5; [288, 248].forEach(r => { g.beginPath(); g.arc(C0, C0, r, 0, 7); g.stroke(); });
  ringText(268, 46, 24); ringText(206, 34, 24, .05); ringText(170, 26, 22, .1);
  /* centre: three short lines of script */
  g.font = '600 30px "Srisakdi","Anuphan",serif'; g.textAlign = 'center';
  [-44, 0, 44].forEach((dy, i) => g.fillText(Array.from({ length: 5 - Math.abs(i - 1) }, rl).join(''), C0, C0 + dy));
  /* tiered chedi blocks pointing outward */
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2 - Math.PI / 2; g.save(); g.translate(C0 + Math.cos(a) * 306, C0 + Math.sin(a) * 306); g.rotate(a + Math.PI / 2);
    g.lineWidth = 3.5; const tiers = [[92, 30], [70, 26], [48, 22]]; let y = 0;
    tiers.forEach(([w, h], k) => { g.strokeRect(-w / 2, y - h, w, h); g.font = `600 ${h - 8}px "Srisakdi","Anuphan",serif`; g.textBaseline = 'middle'; g.fillText(Array.from({ length: 3 - (k === 2 ? 1 : 0) }, rl).join(''), 0, y - h / 2 + 1); y -= h; });
    g.beginPath(); g.arc(0, y - 14, 12, 0, 7); g.stroke(); g.beginPath(); g.arc(0, y - 14, 4, 0, 7); g.fill();
    g.beginPath(); g.moveTo(0, y - 26); g.lineTo(0, y - 44); g.stroke();
    g.restore();
    /* radiating line between blocks, ending in a zigzag tail and a small loop glyph */
    const b = a + Math.PI / N; g.save(); g.translate(C0, C0); g.rotate(b); g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(312, 0); g.lineTo(420, 0); for (let z = 0; z < 5; z++) g.lineTo(420 + z * 9 + 4.5, z % 2 ? -6 : 6); g.lineTo(470, 0); g.stroke();
    g.beginPath(); g.arc(440, -22, 8, Math.PI * .2, Math.PI * 2); g.lineTo(448, -40); g.stroke();
    g.font = '600 26px "Srisakdi","Anuphan",serif'; g.save(); g.translate(395, 26); g.rotate(Math.PI / 2); g.fillText(rl() + rl(), 0, 0); g.restore();
    g.restore();
  }
  /* outer scatter of glyph clusters */
  ringText(470, 30, 26, .1);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
})();
function wardYantMat() {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: WARD_YANT_TEX }, uReveal: { value: 0 }, uA: { value: 1 }, uPulse: { value: 0 }, uT: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uReveal,uA,uPulse,uT;
      void main(){ float ink=texture2D(uMap,vUv).a; float r=length(vUv-.5)*2.;
        float halo=0.; for(int i=0;i<6;i++){ float a=float(i)*1.047; halo+=texture2D(uMap,vUv+vec2(cos(a),sin(a))*.004).a; } halo/=6.;
        float rv=smoothstep(r-.06,r,uReveal), front=smoothstep(r-.12,r,uReveal)-rv;
        vec3 herb=vec3(.55,1.35,.4), gold=vec3(1.5,1.15,.4);
        vec3 col=mix(herb,gold,smoothstep(.55,.75,r)+.35*sin(r*30.-uT*4.)*.5)*ink*(1.+uPulse*.9) + herb*halo*.35 + vec3(2,2.2,1.2)*front*halo*1.6;
        gl_FragColor=vec4(col*rv*uA,1.); }` });
}

