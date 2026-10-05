import * as THREE from 'three';

export const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .92, ...extra });

// Emissive materials whose glow follows the world clock (lanterns, candles, windows).
export const nightGlow = [];
function glowing(color, emissive, strength) {
  const m = mat(color, { emissive, emissiveIntensity: 0 });
  m.userData.glow = strength; nightGlow.push(m); return m;
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
// Roof UVs are in world units (u along the ridge, v down the slope): one row of tiles per half unit.
const tileTexture = canvasTexture(64, (g, s) => {
  for (let row = 0; row < 4; row++) {
    const y = row * 16, grad = g.createLinearGradient(0, y, 0, y + 16);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(.7, '#ddd5cc'); grad.addColorStop(1, '#8a827b');
    g.fillStyle = grad; g.fillRect(0, y, s, 16);
    g.fillStyle = '#827a73'; for (let x = (row % 2) * 8; x < s; x += 16) g.fillRect(x, y, 1.6, 16);
  }
});
const thatchTexture = canvasTexture(64, (g, s) => {
  g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * s, shade = 150 + Math.random() * 105;
    g.strokeStyle = `rgba(${shade},${shade * .92},${shade * .7},.8)`; g.lineWidth = .8 + Math.random();
    g.beginPath(); g.moveTo(x, Math.random() * s); g.lineTo(x + Math.random() * 2 - 1, Math.random() * s); g.stroke();
  }
  g.fillStyle = '#9a8f78'; for (let y = 0; y < s; y += 21) g.fillRect(0, y, s, 2);
});
export const yantraTexture = canvasTexture(64, (g, s) => {
  g.fillStyle = '#efe2bd'; g.fillRect(0, 0, s, s);
  g.strokeStyle = '#8a2a1e'; g.lineWidth = 2; g.strokeRect(5, 5, s - 10, s - 10);
  g.beginPath(); g.moveTo(s / 2, 9); g.lineTo(s - 10, s - 12); g.lineTo(10, s - 12); g.closePath(); g.stroke();
  g.beginPath(); g.arc(s / 2, s / 2 + 5, 9, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#8a2a1e'; for (let i = 0; i < 12; i++) g.fillRect(12 + (i % 6) * 7, i < 6 ? 12 : s - 18, 3, 4);
});

const side = THREE.DoubleSide;
export const M = {
  bark: mat('#65503a'), branch: mat('#7f6545'), darkBark: mat('#3f3a31'), palmBark: mat('#7d6a52'),
  brick: mat('#9f6547'), brickDark: mat('#7a4a37'), brickOld: mat('#87705f'), stone: mat('#aba58a'), stoneDark: mat('#787769'), sandstone: mat('#c6b78c'),
  plaster: mat('#ebe2cc'), plasterOld: mat('#bdb39c'),
  wood: mat('#71523b'), woodLight: mat('#9a7650'), woodPale: mat('#b39268'), darkWood: mat('#423a2c'), teak: mat('#5b3c27'), woodRed: mat('#7c3a2a'),
  tile: mat('#b0663f', { map: tileTexture, side }), tileDark: mat('#704536', { map: tileTexture, side }),
  tileGreen: mat('#58745c', { map: tileTexture, side }), tileOrange: mat('#c97a3c', { map: tileTexture, side }),
  thatch: mat('#a68d5d', { map: thatchTexture, side }), thatchDark: mat('#7a6a4b', { map: thatchTexture, side }),
  gold: mat('#c9a35a', { metalness: .35, roughness: .5 }),
  goldBright: mat('#e5bf62', { metalness: .5, roughness: .36, emissive: '#3d2c08' }),
  moss: mat('#647347'), earth: mat('#7b6548'), clay: mat('#9b5a3a'), clayLight: mat('#c08458'), rope: mat('#a99268'),
  iron: mat('#4c4b48', { metalness: .4, roughness: .6 }), steel: mat('#a9aeb1', { metalness: .6, roughness: .35 }),
  hay: mat('#cdb063'), net: mat('#6d6a58', { side, transparent: true, opacity: .55 }),
  yantra: mat('#ffffff', { map: yantraTexture, side }),
  cloth: {
    red: mat('#a8432f', { side }), yellow: mat('#d4a443', { side }), indigo: mat('#3d4a6b', { side }), green: mat('#5f7a4a', { side }),
    white: mat('#ece4cf', { side }), saffron: mat('#d4802e', { side }), black: mat('#2b2622', { side }), blue: mat('#4f7a8c', { side }),
    pink: mat('#c98a8a', { side }), purple: mat('#6d4a6e', { side }), cream: mat('#d8c9a3', { side }),
  },
  ember: mat('#ff8a3a', { emissive: '#ff6a1a', emissiveIntensity: 2.4 }),
  spiritFlame: mat('#a6f4ff', { emissive: '#6fe8ff', emissiveIntensity: 2.6 }),
  candle: glowing('#f3e1b5', '#ffc46a', 2.4),
  lantern: glowing('#c4503a', '#ff8a3a', 2.6),
  lanternPaper: glowing('#e9d7a8', '#ffcf7a', 2),
  window: glowing('#3b2c1f', '#ffb04f', 1.6),
};
