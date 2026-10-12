import * as THREE from 'three';
import { createRng, hashString } from '../rng.js';
import { CITY_STREETS } from '../compact-city-streets.js';
import { applyCityFoliageWind } from './cityFoliageWind.js';
import { buildCityStreetGardens } from './buildCityStreetGardens.js';

// Render-only planting. Main owns garden reservations/collision and replaces the
// old ground/trees with this output. Pass the SAME CITY used by the World builder.
// mat/geo/authoredTextures register everything with buildCityArt's disposer.
// Ground UVs: default picking plane is 180 x 146, centred at (0, -8.4),
// rotated -PI/2 about X. Canvas top corresponds to its northern (minZ) edge.
export function buildCityLandscape({
  root, mat, geo, box, cyl, beam, ball, M, CITY, authoredTextures,
  groundBounds = { minX: -90, maxX: 90, minZ: -81.4, maxZ: 64.6 },
}) {
  const rng = createRng(2026101207);
  const stats = { landscapeTrees: 0, landscapeShrubs: 0, landscapeFlowers: 0,
    landscapeGardens: 0, landscapePlanters: 0, landscapeTextures: 1,
    landscapeVariants: { banyan: 0, shade: 0, blossom: 0, palm: 0, banana: 0, riverside: 0 } };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('City landscape requires a 2D canvas');
  const width = groundBounds.maxX - groundBounds.minX;
  const depth = groundBounds.maxZ - groundBounds.minZ;
  const px = x => (x - groundBounds.minX) / width * canvas.width;
  const pz = z => (z - groundBounds.minZ) / depth * canvas.height;
  c.fillStyle = '#829b70'; c.fillRect(0, 0, 256, 256);
  function wash(x, z, rx, rz, color, opacity = .35) {
    c.save(); c.translate(px(x), pz(z)); c.scale(rx / width * 256, rz / depth * 256);
    const gradient = c.createRadialGradient(0, 0, .08, 0, 0, 1);
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = opacity; c.fillStyle = gradient;
    c.fillRect(-1, -1, 2, 2); c.restore();
  }
  // Large meadow washes and earth glazes, rather than high-frequency noise.
  for (let i = 0; i < 100; i++) wash(
    rng.range(groundBounds.minX, groundBounds.maxX), rng.range(groundBounds.minZ, groundBounds.maxZ),
    rng.range(5, 17), rng.range(4, 13), ['#67885d', '#b1c18b', '#81a576', '#b7b38b'][i % 4], .34,
  );
  for (const b of CITY.buildings) {
    const garden = b.kind === 'garden';
    wash(b.x, b.z, b.w / 2 + 4, b.d / 2 + 4, garden ? '#527949' : '#b6b48a', .48);
  }
  // Feathered warm verges agree with the composed street hierarchy. Painting
  // beneath paving introduces no raised edge, new obstacle or terrain change.
  for (const road of CITY_STREETS) {
    const vertical = road.w < road.d;
    const length = Math.max(road.w, road.d), across = Math.min(road.w, road.d);
    for (let i = -length / 2; i <= length / 2; i += 3) wash(
      road.x + (vertical ? 0 : i), road.z + (vertical ? i : 0),
      vertical ? across / 2 + 2 : 4, vertical ? 4 : across / 2 + 2, '#d7c59e', .32,
    );
  }
  // Quiet brush strokes break up the grass without becoming tiled speckle.
  c.lineCap = 'round';
  for (let i = 0; i < 360; i++) {
    const x = rng.range(0, 256), y = rng.range(0, 256);
    c.strokeStyle = i % 2 ? 'rgba(232,230,178,.12)' : 'rgba(83,122,78,.09)';
    c.lineWidth = rng.range(.5, 1.2); c.beginPath(); c.moveTo(x, y);
    c.quadraticCurveTo(x + 2, y - 1.5, x + rng.range(2, 5), y - .5); c.stroke();
  }
  const groundTexture = new THREE.CanvasTexture(canvas);
  authoredTextures.add(groundTexture);
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.wrapS = groundTexture.wrapT = THREE.ClampToEdgeWrapping;
  groundTexture.anisotropy = 4;
  const groundMaterial = mat('#ffffff', { map: groundTexture, roughness: .98 });

  // Rounded crown geometry stays inside its declared unit envelope. Painted
  // shade uses normals, surviving StaticBatcher (which strips vertex colours).
  function foliageGeometry() {
    const g = geo(new THREE.SphereGeometry(1, 18, 12));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // Scalloped leaf groups, with an uneven outline rather than a smooth ball.
      const shape = .87 + .08 * Math.sin(x * 13 + z * 9 + y * 5)
        + .05 * Math.cos(z * 17 - x * 7 + y * 11);
      p.setXYZ(i, x * shape, y * shape, z * shape);
    }
    g.computeVertexNormals(); return g;
  }
  function paintedLeaf(color, extra = {}) {
    const material = mat(color, { roughness: .96, ...extra }, true);
    const priorCompile = material.onBeforeCompile, priorKey = material.customProgramCacheKey;
    material.onBeforeCompile = function(shader, renderer) {
      priorCompile.call(this, shader, renderer);
      shader.vertexShader = 'varying float vCityLeafLight;\nvarying vec3 vCityLeafPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvCityLeafPosition = position;');
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvCityLeafLight = dot(normalize(objectNormal), normalize(vec3(-0.35, 1.0, 0.15)));');
      shader.fragmentShader = 'varying float vCityLeafLight;\nvarying vec3 vCityLeafPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
        float leafBrush = sin(vCityLeafPosition.x * 8.0 + sin(vCityLeafPosition.z * 6.0))
          * sin(vCityLeafPosition.z * 10.0 + vCityLeafPosition.y * 7.0);
        diffuseColor.rgb *= mix(vec3(0.58, 0.70, 0.55), vec3(1.06, 1.02, 0.84),
          clamp(vCityLeafLight * 0.45 + 0.5, 0.0, 1.0)) * (0.95 + leafBrush * 0.075);`);
    };
    material.customProgramCacheKey = function() { return `${priorKey.call(this)}|city-landscape-leaf-v2`; };
    return applyCityFoliageWind(material);
  }
  const crown = foliageGeometry();
  const leaf = ['#417546', '#598c4c', '#739954', '#628c50'].map(color => paintedLeaf(color));
  const shrubLeaf = ['#396840', '#59824b', '#739954'].map(color => paintedLeaf(color));
  const bark = mat('#967756', { roughness: .97 });
  const planter = mat('#c7b19a', { roughness: .95 });
  const soil = mat('#514c36', { roughness: 1 });
  const domesticGround = mat('#839566', { roughness: 1 });
  const flowers = ['#e8b5b0', '#efdaa1', '#d9d0e7'].map(color => mat(color, { roughness: .9 }));
  const blossomLeaf = ['#c690a7', '#e0adc0', '#efd0ca'].map(color => paintedLeaf(color));
  const palmLeaf = paintedLeaf('#729b65', { side: THREE.DoubleSide });
  const petal = geo(new THREE.SphereGeometry(1, 6, 4));
  const center = mat('#c7a360');
  const taperedWood = geo(new THREE.CylinderGeometry(.35, 1, 1, 8));
  // Opaque folded leaves add small silhouette tips without alpha sorting/cards.
  const spray = geo(new THREE.BufferGeometry());
  const sprayPositions = [], sprayIndices = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, cx = Math.cos(a) * .35, cz = Math.sin(a) * .35;
    const dx = Math.cos(a) * .30, dz = Math.sin(a) * .30;
    const n = sprayPositions.length / 3;
    sprayPositions.push(cx - dx, 0, cz - dz, cx - dz * .45, .09, cz + dx * .45,
      cx + dx, .02, cz + dz, cx + dz * .45, -.03, cz - dx * .45);
    sprayIndices.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  spray.setAttribute('position', new THREE.Float32BufferAttribute(sprayPositions, 3));
  spray.setIndex(sprayIndices); spray.computeVertexNormals();
  const tipLeaf = paintedLeaf('#64844d', { side: THREE.DoubleSide });
  function branch(a, b, radius, overhang = false) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start), middle = start.add(end).multiplyScalar(.5);
    const mesh = lobe(...middle.toArray(), radius, delta.length(), radius, bark, taperedWood);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    if (overhang) mesh.userData.cityLandscapeCanopy = true;
  }
  function lobe(x, y, z, rx, ry, rz, material, geometry = crown) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.scale.set(rx, ry, rz);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  function canopy(...args) {
    const mesh = lobe(...args); mesh.userData.cityLandscapeCanopy = true; return mesh;
  }
  function tree(x, z, radius, height, local, variant = 'shade', stemRoom = .75) {
    // A single low-forking stem supports a spreading, tiered crown. StemRoom
    // bounds every woody part independently of the permitted crown overhang.
    const trunk = height * .50, lean = stemRoom * .20;
    const angle = local.range(0, Math.PI * 2);
    const dx = Math.cos(angle) * lean, dz = Math.sin(angle) * lean;
    const thick = Math.min(.29, stemRoom * .25);
    branch([x, .08, z], [x + dx, trunk, z + dz], thick);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + angle;
      branch([x + dx * .55, trunk * .53, z + dz * .55],
        [x + Math.cos(a) * stemRoom * .62, height * .65, z + Math.sin(a) * stemRoom * .62], thick * .58);
      beam(root, bark, [x, .19, z],
        [x + Math.cos(a) * stemRoom * .72, .09, z + Math.sin(a) * stemRoom * .72], thick * .42);
    }
    // Three unequal branch fans carry seven modest tufts each. No central
    // filler hides the gaps between fans or turns their shadow into a disc.
    for (let fan = 0; fan < 3; fan++) {
      const a = angle + fan * 2.15 + local.range(-.20, .20);
      const fanX = Math.cos(a) * radius * local.range(.38, .53);
      const fanZ = Math.sin(a) * radius * local.range(.38, .53);
      const fanY = height * (.73 + fan * .045);
      branch([x + dx, height * .60, z + dz],
        [x + fanX, fanY, z + fanZ], thick * .33, true);
      for (let i = 0; i < 7; i++) {
        const t = a + i * 2.399, reach = i === 0 ? 0 : radius * local.range(.12, .30);
        const tx = x + fanX + Math.cos(t) * reach;
        const tz = z + fanZ + Math.sin(t) * reach;
        const size = radius * local.range(.20, .29);
        const ty = Math.max(2.65 + size * .72, fanY + local.range(-.25, .40));
        const mesh = canopy(tx, ty, tz, size, size * local.range(.48, .72),
          size * local.range(.75, 1.05), leaf[(i + fan) % leaf.length]);
        mesh.rotation.y = local.range(0, Math.PI);
        if (i % 2 === 0) {
          const tips = canopy(tx + Math.cos(t) * size * .8, ty + size * .1,
            tz + Math.sin(t) * size * .8, size * .70, size * .7, size * .70, tipLeaf, spray);
          tips.rotation.set(local.range(-.3, .3), t, local.range(-.2, .2));
        }
        if (variant === 'blossom' && i % 2 === 1) for (let j = 0; j < 4; j++) {
          const p = j * 2.4 + fan, r = size * local.range(.35, .75);
          const bloom = canopy(tx + Math.cos(p) * r, ty + size * .54,
            tz + Math.sin(p) * r, .09, .055, .11, blossomLeaf[(i + j) % 3], petal);
          bloom.castShadow = false;
        }
      }
    }
    stats.landscapeTrees++;
  }
  // Curved ribbon outline with a scalloped feather edge: one reusable mesh per
  // frond, no alpha cards or hundreds of individually modeled palm leaflets.
  const frond = geo(new THREE.BufferGeometry());
  const fp = [], fi = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, wide = Math.sin(Math.PI * t) * (i % 2 ? .12 : .19);
    const y = Math.sin(Math.PI * t) * .22 - t * t * .36;
    for (const side of [-1, 1]) {
      fp.push(t, y, wide * side);
    }
    if (i < 12) { const j = i * 2; fi.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
  }
  frond.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  frond.setIndex(fi); frond.computeVertexNormals();
  function palm(x, z, radius, height, local) {
    for (let i = 0; i < 4; i++) beam(root, bark,
      [x + Math.sin(i * .5) * .18, height * i / 4, z],
      [x + Math.sin((i + 1) * .5) * .18, height * (i + 1) / 4, z], .14 - i * .018);
    for (let i = 0; i < 9; i++) {
      const mesh = new THREE.Mesh(frond, palmLeaf);
      mesh.position.set(x + Math.sin(2) * .18, height, z);
      mesh.rotation.y = i * Math.PI * 2 / 9 + local.range(-.08, .08);
      mesh.scale.set(radius, radius * (i % 2 ? .8 : 1), radius);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.cityLandscapeCanopy = true; root.add(mesh);
    }
    canopy(x + .16, height, z, .30, .35, .30, leaf[2]);
    stats.landscapeTrees++;
  }
  function shrub(x, z, radius, local, bloom = false, base = 0) {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      lobe(x + Math.cos(a) * radius * .28, base + radius * .43, z + Math.sin(a) * radius * .28,
        radius * .66, radius * .45, radius * .66, shrubLeaf[i]);
    }
    stats.landscapeShrubs++;
    if (!bloom) return;
    for (let i = 0; i < 4; i++) {
      const a = i * 2.4, x1 = x + Math.cos(a) * radius * .38, z1 = z + Math.sin(a) * radius * .38;
      const size = Math.min(.14, radius * .16), y = base + radius * (.82 + local.range(0, .08));
      for (let j = 0; j < 5; j++) {
        const angle = j * Math.PI * 2 / 5;
        lobe(x1 + Math.cos(angle) * size * .55, y, z1 + Math.sin(angle) * size * .55,
          size * .55, size * .24, size * .55, flowers[i % flowers.length], petal).castShadow = false;
      }
      lobe(x1, y + .015, z1, size * .30, size * .18, size * .30, center, petal).castShadow = false;
      stats.landscapeFlowers++;
    }
  }
  function fits(b, x, z, radius, margin = .3) {
    return Math.abs(x - b.x) + radius + margin <= b.w / 2
      && Math.abs(z - b.z) + radius + margin <= b.d / 2;
  }
  Object.assign(stats,buildCityStreetGardens({root,CITY,mat,geo,box,cyl,beam,ball,M}));
  for (const b of CITY.buildings) {
    const local = createRng(hashString(`landscape:${b.id}`));
    if (b.kind === 'garden') {
      stats.landscapeGardens++;
      // Only high canopy geometry may overhang. Trunks, roots, shrubs and
      // planters remain fully inside Main's canonical solid garden reservation.
      const variant = Object.hasOwn(stats.landscapeVariants, b.variant) ? b.variant : 'shade';
      stats.landscapeVariants[variant]++;
      // Market's lotus fountain occupies this same canonical reservation.
      if (b.id === 'garden_civic') continue;
      if (Math.min(b.w, b.d) < 2) continue;
      // The curb describes the actual solid rectangle; packed underplanting
      // makes even the smallest collision plot read as a full garden bed.
      const inset = .06, rim = .16;
      if(variant==='banana'||variant==='riverside') {
        // Domestic pockets are grass-and-earth compositions with incomplete
        // low edging, not four identical pale walls around an empty soil pad.
        box(root,domesticGround,b.x,.07,b.z,b.w-.12,.10,b.d-.12);
        const edging=variant==='banana'?M.timber:planter;
        if(variant==='riverside') {
          // Quay approach arrives from the north, aligned with the lot centre.
          // Split edging leaves the complete 2.6m paved entrance unobstructed.
          const opening=1.38,edge=b.w/2-.15,span=edge-opening;
          for(const side of[-1,1])box(root,edging,b.x+side*(opening+span/2),.15,b.z-b.d/2+.15,span,.18,.17);
        }else box(root,edging,b.x-b.w*.10,.15,b.z-b.d/2+.15,b.w*.58,.18,.17);
        box(root,edging,b.x-b.w/2+.15,.13,b.z-b.d*.12,.17,.14,b.d*.53);
        // Two irregular low corner stones define the bed without a full front curb.
        for(const side of[-1,1])ball(root,planter,b.x+side*b.w*.37,.15,b.z+b.d*.35,.19,.12,.16);
        if(variant==='riverside')tree(b.x-b.w*.20,b.z+b.d*.12,2.65,5.45,local,'shade',
          Math.min(.65,b.w*.25-.25,b.d*.25-.25));
        continue;
      }
      box(root, soil, b.x, .11, b.z, b.w - inset * 2, .20, b.d - inset * 2);
      for (const side of [-1, 1]) {
        box(root, planter, b.x + side * (b.w / 2 - inset - rim / 2), .17, b.z,
          rim, .30, b.d - inset * 2);
        box(root, planter, b.x, .17, b.z + side * (b.d / 2 - inset - rim / 2),
          b.w - inset * 2, .30, rim);
      }
      const alongZ = b.d >= b.w, long = Math.max(b.w, b.d);
      const count = long > 8 ? Math.ceil(long / 6) : 1;
      for (let i = 0; i < count; i++) {
        const offset = count === 1 ? 0 : (i / (count - 1) - .5) * (long - 3);
        const x = b.x + (alongZ ? 0 : offset), z = b.z + (alongZ ? offset : 0);
        const radius = local.range(3.0, 3.8);
        if (variant === 'palm') palm(x, z, radius, local.range(5.3, 6.1), local);
        else tree(x, z, radius, local.range(5.2, 6.0), local, variant,
          Math.min(.85, Math.min(b.w, b.d) / 2 - .30));
      }
      const nx = Math.max(2, Math.ceil((b.w - .5) / 1.1));
      const nz = Math.max(2, Math.ceil((b.d - .5) / 1.1));
      const cellX = (b.w - .54) / nx, cellZ = (b.d - .54) / nz;
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
        const r = Math.min(.72, cellX * .57, cellZ * .57);
        const x = b.x + (ix + .5 - nx / 2) * cellX;
        const z = b.z + (iz + .5 - nz / 2) * cellZ;
        shrub(x, z, r, local, (ix + iz) % 3 === 0, .21);
      }
    } else if (['class', 'house', 'warehouse', 'forge', 'pharmacy', 'general', 'storage'].includes(b.kind)) {
      const front = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] }[b.front] ?? [0, 1];
      const radius = Math.min(1.15, b.w / 7, b.d / 7);
      const x = b.x - front[0] * b.w * .30 + front[1] * b.w * .27;
      const z = b.z - front[1] * b.d * .30 + front[0] * b.d * .27;
      if (fits(b, x, z, radius)) tree(x, z, radius, local.range(5.6, 6.7), local);
      // Two compact raised planter clusters at rear corners. Front-facing
      // contacts/counters and their waiting spaces are not planting locations.
      for (const side of [-1, 1]) {
        const px = b.x - front[0] * b.w * .33 + front[1] * side * b.w * .25;
        const pz = b.z - front[1] * b.d * .33 - front[0] * side * b.d * .25;
        if (!fits(b, px, pz, .65)) continue;
        cyl(root, planter, px, .23, pz, .65, .46);
        cyl(root, soil, px, .465, pz, .56, .018);
        shrub(px, pz, .53, local, true, .46); stats.landscapePlanters++;
      }
    }
  }
  // Layered groves behind the perimeter, never between a service and its road.
  // Entire crowns (not just trunks) stay outside the walk envelope.
  for (const side of [-1, 1]) for (const fraction of [.13, .43, .78]) {
    const anchorZ = CITY.bounds.minZ + fraction * (CITY.bounds.maxZ - CITY.bounds.minZ);
    const count = rng.range(0, 1) > .5 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const radius = rng.range(2.4, 4.4);
      const x = (side < 0 ? CITY.bounds.minX : CITY.bounds.maxX)
        + side * (radius * 1.2 + 3 + rng.range(0, 5));
      const z = anchorZ + rng.range(-7, 7);
      tree(x, z, radius, rng.range(4.8, 7.2), rng);
      shrub(x + side * .8, z + rng.range(-1.5, 1.5), rng.range(.8, 1.4), rng, i % 3 === 0);
    }
  }
  // Two uneven north groves leave the central gate corridor open (|x| < 12).
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const radius = rng.range(2.5, 4.0), x = side * rng.range(24, 49);
    const z = CITY.bounds.minZ - radius * 1.2 - rng.range(3, 8);
    tree(x, z, radius, rng.range(4.8, 7), rng);
    shrub(x + .8, z - .8, rng.range(.8, 1.3), rng, i % 3 === 0);
  }
  return { groundMaterial, groundTexture, groundBounds: { ...groundBounds }, stats };
}
