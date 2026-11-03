'use strict';

const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s),
  cone: (r, h, s = 8) => new THREE.ConeGeometry(r, h, s),
  sph: (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  dod: (r) => new THREE.DodecahedronGeometry(r, 0),
  oct: (r) => new THREE.OctahedronGeometry(r, 0),
  tor: (r, t, rs = 5, ts = 14) => new THREE.TorusGeometry(r, t, rs, ts),
};
const P = (g, c, p, r, s) => ({ g, c, p, r, s });
const PI = Math.PI;

const MAT = {};
function buildMaterials() {
  MAT.vc = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05 });
  MAT.glowAdd = (color, opacity = 1) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
}

function glowSprite(color, scale, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const s = new THREE.Sprite(m);
  s.scale.set(scale, scale, 1);
  s.userData.ownMat = true;
  return s;
}

const Models = {
  _geo: {},
  geo(key, build) {
    if (!this._geo[key]) this._geo[key] = build();
    return this._geo[key];
  },
  mesh(key, build, shadow = true) {
    const m = new THREE.Mesh(this.geo(key, build), MAT.vc);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  },

  // ---------------- Düşmanlar ----------------
  enemyGeometry(type) {
    return this.geo('enemy_' + type, () => {
      switch (type) {
        case 'goblin': return mergeParts([
          P(G.box(0.22, 0.4, 0.22), 0x4a3a2a, [-0.14, 0.2, 0]),
          P(G.box(0.22, 0.4, 0.22), 0x4a3a2a, [0.14, 0.2, 0]),
          P(G.box(0.55, 0.5, 0.4), 0x5aa83a, [0, 0.65, 0]),
          P(G.box(0.6, 0.18, 0.44), 0x6b4a2a, [0, 0.45, 0]),
          P(G.ico(0.32, 0), 0x6cc04a, [0, 1.08, 0.02]),
          P(G.cone(0.1, 0.38, 4), 0x6cc04a, [-0.38, 1.12, 0], [0, 0, PI / 2]),
          P(G.cone(0.1, 0.38, 4), 0x6cc04a, [0.38, 1.12, 0], [0, 0, -PI / 2]),
          P(G.box(0.09, 0.07, 0.05), 0xffe14a, [-0.11, 1.12, 0.3]),
          P(G.box(0.09, 0.07, 0.05), 0xffe14a, [0.11, 1.12, 0.3]),
          P(G.box(0.14, 0.42, 0.14), 0x5aa83a, [-0.36, 0.68, 0.05]),
          P(G.box(0.14, 0.42, 0.14), 0x5aa83a, [0.36, 0.68, 0.05]),
          P(G.cyl(0.06, 0.12, 0.75, 6), 0x7a5230, [0.42, 0.78, 0.25], [PI / 3, 0, 0]),
        ]);
        case 'wolf': return mergeParts([
          P(G.box(0.5, 0.45, 1.0), 0x7d7268, [0, 0.62, 0]),
          P(G.box(0.42, 0.4, 0.42), 0x8c8176, [0, 0.82, 0.6]),
          P(G.box(0.24, 0.2, 0.3), 0x6d635a, [0, 0.74, 0.9]),
          P(G.box(0.09, 0.08, 0.06), 0x111111, [0, 0.8, 1.06]),
          P(G.cone(0.09, 0.24, 4), 0x6d635a, [-0.13, 1.1, 0.55]),
          P(G.cone(0.09, 0.24, 4), 0x6d635a, [0.13, 1.1, 0.55]),
          P(G.box(0.07, 0.06, 0.04), 0xff3b2f, [-0.11, 0.88, 0.82]),
          P(G.box(0.07, 0.06, 0.04), 0xff3b2f, [0.11, 0.88, 0.82]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [-0.17, 0.21, 0.35]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [0.17, 0.21, 0.35]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [-0.17, 0.21, -0.35]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [0.17, 0.21, -0.35]),
          P(G.cone(0.1, 0.55, 5), 0x8c8176, [0, 0.78, -0.68], [-PI / 2.6, 0, 0]),
        ]);
        case 'slime': return mergeParts([
          P(G.sph(0.42, 10, 8), 0xb04ad0, [0, 0.32, 0], null, [1, 0.78, 1]),
          P(G.sph(0.18, 8, 6), 0xd98cf0, [0.12, 0.5, 0.1]),
          P(G.sph(0.085, 6, 4), 0xffffff, [-0.13, 0.42, 0.34]),
          P(G.sph(0.085, 6, 4), 0xffffff, [0.13, 0.42, 0.34]),
          P(G.sph(0.045, 6, 4), 0x111111, [-0.13, 0.42, 0.41]),
          P(G.sph(0.045, 6, 4), 0x111111, [0.13, 0.42, 0.41]),
        ]);
        case 'knight': return mergeParts([
          P(G.box(0.22, 0.5, 0.24), 0x4b5260, [-0.15, 0.25, 0]),
          P(G.box(0.22, 0.5, 0.24), 0x4b5260, [0.15, 0.25, 0]),
          P(G.box(0.62, 0.62, 0.42), 0x6f7a8c, [0, 0.8, 0]),
          P(G.box(0.5, 0.4, 0.08), 0xa3afc1, [0, 0.86, 0.22]),
          P(G.sph(0.18, 6, 4), 0xa3afc1, [-0.38, 1.08, 0]),
          P(G.sph(0.18, 6, 4), 0xa3afc1, [0.38, 1.08, 0]),
          P(G.box(0.16, 0.5, 0.16), 0x6f7a8c, [-0.4, 0.78, 0]),
          P(G.box(0.16, 0.5, 0.16), 0x6f7a8c, [0.4, 0.78, 0]),
          P(G.cyl(0.25, 0.27, 0.42, 8), 0xa3afc1, [0, 1.36, 0]),
          P(G.box(0.36, 0.05, 0.05), 0x111111, [0, 1.4, 0.26]),
          P(G.box(0.08, 0.26, 0.38), 0xc0262d, [0, 1.68, -0.04]),
          P(G.box(0.08, 0.62, 0.48), 0x2a4a9a, [-0.52, 0.82, 0.12]),
          P(G.box(0.03, 0.22, 0.22), 0xe0c050, [-0.57, 0.84, 0.12]),
          P(G.box(0.06, 0.85, 0.1), 0xdfe6ee, [0.52, 0.95, 0.25], [0.4, 0, 0]),
          P(G.box(0.26, 0.05, 0.08), 0x8a6a2a, [0.52, 0.62, 0.12], [0.4, 0, 0]),
        ]);
        case 'ogre':
        case 'orc': return mergeParts([
          P(G.box(0.32, 0.5, 0.34), 0x3d4a22, [-0.22, 0.25, 0]),
          P(G.box(0.32, 0.5, 0.34), 0x3d4a22, [0.22, 0.25, 0]),
          P(G.ico(0.55, 1), 0x6a8a3a, [0, 0.98, 0], null, [1.1, 1, 0.9]),
          P(G.box(0.85, 0.26, 0.62), 0x4a3218, [0, 0.56, 0]),
          P(G.box(0.42, 0.38, 0.4), 0x6a8a3a, [0, 1.6, 0.08]),
          P(G.cone(0.05, 0.22, 4), 0xf0ead6, [-0.12, 1.5, 0.28], [0.6, 0, 0]),
          P(G.cone(0.05, 0.22, 4), 0xf0ead6, [0.12, 1.5, 0.28], [0.6, 0, 0]),
          P(G.box(0.08, 0.05, 0.04), 0xff4040, [-0.1, 1.66, 0.28]),
          P(G.box(0.08, 0.05, 0.04), 0xff4040, [0.1, 1.66, 0.28]),
          P(G.box(0.24, 0.72, 0.26), 0x6a8a3a, [-0.64, 0.96, 0.05]),
          P(G.box(0.24, 0.72, 0.26), 0x6a8a3a, [0.64, 0.96, 0.05]),
          P(G.cyl(0.1, 0.22, 1.15, 6), 0x4a3218, [0.72, 0.92, 0.46], [1.0, 0, 0]),
        ]);
        case 'golem': return mergeParts([
          P(G.box(0.38, 0.55, 0.4), 0x6a655c, [-0.24, 0.28, 0]),
          P(G.box(0.38, 0.55, 0.4), 0x5c574e, [0.24, 0.28, 0]),
          P(G.box(1.05, 1.05, 0.72), 0x8a8478, [0, 1.15, 0]),
          P(G.box(0.7, 0.18, 0.2), 0xc9a24a, [0, 1.22, 0.38]),
          P(G.box(0.55, 0.5, 0.5), 0x7a7468, [0, 1.85, 0.04]),
          P(G.box(0.12, 0.08, 0.05), 0xff8a3a, [-0.12, 1.9, 0.28]),
          P(G.box(0.12, 0.08, 0.05), 0xff8a3a, [0.12, 1.9, 0.28]),
          P(G.box(0.32, 0.85, 0.32), 0x8a8478, [-0.72, 1.15, 0]),
          P(G.box(0.32, 0.85, 0.32), 0x6a655c, [0.72, 1.15, 0]),
          P(G.box(0.28, 0.28, 0.28), 0xc9a24a, [0.72, 1.55, 0.12]),
        ]);
        case 'rider': return mergeParts([
          P(G.box(0.5, 0.45, 1.0), 0x7d7268, [0, 0.62, 0]),
          P(G.box(0.42, 0.4, 0.42), 0x8c8176, [0, 0.82, 0.6]),
          P(G.box(0.24, 0.2, 0.3), 0x6d635a, [0, 0.74, 0.9]),
          P(G.box(0.09, 0.08, 0.06), 0x111111, [0, 0.8, 1.06]),
          P(G.cone(0.09, 0.24, 4), 0x6d635a, [-0.13, 1.1, 0.55]),
          P(G.cone(0.09, 0.24, 4), 0x6d635a, [0.13, 1.1, 0.55]),
          P(G.box(0.07, 0.06, 0.04), 0xff3b2f, [-0.11, 0.88, 0.82]),
          P(G.box(0.07, 0.06, 0.04), 0xff3b2f, [0.11, 0.88, 0.82]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [-0.17, 0.21, 0.35]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [0.17, 0.21, 0.35]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [-0.17, 0.21, -0.35]),
          P(G.box(0.14, 0.42, 0.14), 0x5f554c, [0.17, 0.21, -0.35]),
          P(G.cone(0.1, 0.55, 5), 0x8c8176, [0, 0.78, -0.68], [-PI / 2.6, 0, 0]),
          P(G.box(0.38, 0.42, 0.3), 0x4a7a32, [0, 1.28, -0.05]),
          P(G.ico(0.2, 0), 0x6cc04a, [0, 1.58, 0.02]),
          P(G.cone(0.07, 0.22, 4), 0x6cc04a, [-0.22, 1.6, 0], [0, 0, PI / 2]),
          P(G.cone(0.07, 0.22, 4), 0x6cc04a, [0.22, 1.6, 0], [0, 0, -PI / 2]),
          P(G.box(0.06, 0.05, 0.04), 0xffe14a, [-0.07, 1.6, 0.18]),
          P(G.box(0.06, 0.05, 0.04), 0xffe14a, [0.07, 1.6, 0.18]),
          P(G.cyl(0.04, 0.07, 0.55, 5), 0x7a5230, [0.28, 1.35, 0.18], [PI / 3.2, 0, 0]),
        ]);
        case 'rider_down': return mergeParts([
          P(G.box(0.22, 0.4, 0.22), 0x4a3a2a, [-0.14, 0.2, 0]),
          P(G.box(0.22, 0.4, 0.22), 0x4a3a2a, [0.14, 0.2, 0]),
          P(G.box(0.55, 0.5, 0.4), 0x5aa83a, [0, 0.65, 0]),
          P(G.box(0.62, 0.22, 0.48), 0x7d7268, [0, 0.52, 0]),
          P(G.ico(0.3, 0), 0x6cc04a, [0, 1.06, 0.02]),
          P(G.cone(0.09, 0.32, 4), 0x6cc04a, [-0.34, 1.1, 0], [0, 0, PI / 2]),
          P(G.cone(0.09, 0.32, 4), 0x6cc04a, [0.34, 1.1, 0], [0, 0, -PI / 2]),
          P(G.box(0.08, 0.06, 0.05), 0xffe14a, [-0.1, 1.08, 0.28]),
          P(G.box(0.08, 0.06, 0.05), 0xffe14a, [0.1, 1.08, 0.28]),
          P(G.cyl(0.05, 0.1, 0.7, 5), 0x7a5230, [0.4, 0.75, 0.22], [PI / 3, 0, 0]),
        ]);
        case 'priest': return mergeParts([
          P(G.box(0.2, 0.45, 0.22), 0x2a2438, [-0.12, 0.22, 0]),
          P(G.box(0.2, 0.45, 0.22), 0x2a2438, [0.12, 0.22, 0]),
          P(G.box(0.58, 0.85, 0.42), 0x3a3358, [0, 0.88, 0]),
          P(G.box(0.64, 0.16, 0.48), 0xc9a24a, [0, 0.52, 0]),
          P(G.box(0.2, 0.7, 0.08), 0xc9a24a, [0, 0.95, 0.22]),
          P(G.sph(0.22, 8, 6), 0xe8d4b8, [0, 1.48, 0.02]),
          P(G.box(0.28, 0.06, 0.28), 0x1a1428, [0, 1.62, 0]),
          P(G.box(0.08, 0.05, 0.04), 0x66ddff, [-0.08, 1.5, 0.2]),
          P(G.box(0.08, 0.05, 0.04), 0x66ddff, [0.08, 1.5, 0.2]),
          P(G.cyl(0.045, 0.05, 1.45, 6), 0xc9a24a, [0.38, 1.05, 0.12]),
          P(G.oct(0.12), 0x7ee0ff, [0.38, 1.8, 0.12]),
        ]);
        case 'witch': return mergeParts([
          P(G.box(0.18, 0.4, 0.2), 0x1a1028, [-0.12, 0.2, 0]),
          P(G.box(0.18, 0.4, 0.2), 0x1a1028, [0.12, 0.2, 0]),
          P(G.box(0.52, 0.78, 0.4), 0x4a2270, [0, 0.82, 0]),
          P(G.sph(0.2, 8, 6), 0xc9b8a0, [0, 1.38, 0.02]),
          P(G.cone(0.42, 0.7, 6), 0x2a1048, [0, 1.85, 0]),
          P(G.cyl(0.46, 0.46, 0.06, 8), 0x2a1048, [0, 1.52, 0]),
          P(G.box(0.07, 0.05, 0.04), 0xff66dd, [-0.07, 1.4, 0.18]),
          P(G.box(0.07, 0.05, 0.04), 0xff66dd, [0.07, 1.4, 0.18]),
          P(G.cyl(0.04, 0.05, 1.35, 6), 0x5a3a1a, [-0.36, 0.95, 0.1], [0.25, 0, 0.2]),
          P(G.ico(0.12, 0), 0xb26bff, [-0.42, 1.62, 0.22]),
        ]);
        case 'skeleton': return mergeParts([
          P(G.box(0.12, 0.38, 0.12), 0xe8e0d0, [-0.1, 0.19, 0]),
          P(G.box(0.12, 0.38, 0.12), 0xe8e0d0, [0.1, 0.19, 0]),
          P(G.box(0.32, 0.42, 0.22), 0xf2eadc, [0, 0.62, 0]),
          P(G.box(0.28, 0.08, 0.08), 0xd8d0c0, [0, 0.52, 0.08]),
          P(G.box(0.28, 0.08, 0.08), 0xd8d0c0, [0, 0.72, 0.08]),
          P(G.sph(0.2, 7, 5), 0xf2eadc, [0, 1.02, 0.02]),
          P(G.box(0.16, 0.08, 0.04), 0x111111, [0, 1.0, 0.18]),
          P(G.box(0.05, 0.04, 0.03), 0xff4040, [-0.07, 1.06, 0.18]),
          P(G.box(0.05, 0.04, 0.03), 0xff4040, [0.07, 1.06, 0.18]),
          P(G.box(0.08, 0.38, 0.08), 0xe8e0d0, [-0.24, 0.62, 0]),
          P(G.box(0.08, 0.38, 0.08), 0xe8e0d0, [0.24, 0.62, 0]),
        ]);
        case 'boss':
        case 'brute': return mergeParts([
          P(G.box(0.36, 0.7, 0.4), 0x3a0d10, [-0.25, 0.35, 0]),
          P(G.box(0.36, 0.7, 0.4), 0x3a0d10, [0.25, 0.35, 0]),
          P(G.box(1.0, 0.9, 0.6), 0x7a1a1a, [0, 1.15, 0]),
          P(G.box(0.7, 0.42, 0.1), 0x4a0d0d, [0, 1.25, 0.31]),
          P(G.cone(0.15, 0.48, 5), 0x2a2a2a, [-0.58, 1.75, 0], [0, 0, 0.4]),
          P(G.cone(0.15, 0.48, 5), 0x2a2a2a, [0.58, 1.75, 0], [0, 0, -0.4]),
          P(G.box(0.28, 0.85, 0.3), 0x7a1a1a, [-0.68, 1.05, 0]),
          P(G.box(0.28, 0.85, 0.3), 0x7a1a1a, [0.68, 1.05, 0]),
          P(G.box(0.5, 0.48, 0.46), 0x8a2020, [0, 1.88, 0.05]),
          P(G.cone(0.1, 0.55, 5), 0xe8dcc0, [-0.22, 2.3, 0], [0, 0, 0.5]),
          P(G.cone(0.1, 0.55, 5), 0xe8dcc0, [0.22, 2.3, 0], [0, 0, -0.5]),
          P(G.box(0.11, 0.07, 0.04), 0xffd23a, [-0.12, 1.92, 0.29]),
          P(G.box(0.11, 0.07, 0.04), 0xffd23a, [0.12, 1.92, 0.29]),
          P(G.box(0.05, 0.95, 0.75), 0x3a0d10, [-0.62, 1.5, -0.45], [0, 0.6, 0.3]),
          P(G.box(0.05, 0.95, 0.75), 0x3a0d10, [0.62, 1.5, -0.45], [0, -0.6, -0.3]),
          P(G.cyl(0.05, 0.05, 1.7, 6), 0x3b2a1a, [0.85, 1.05, 0.3]),
          P(G.box(0.08, 0.55, 0.62), 0xb0b0b8, [0.85, 1.7, 0.48]),
        ]);
        case 'dragon': return mergeParts([
          P(G.box(0.4, 0.55, 0.9), 0x8a2010, [0, 0.9, 0]),
          P(G.box(0.55, 0.48, 0.7), 0xc43a18, [0, 1.45, -0.05]),
          P(G.box(0.42, 0.38, 0.5), 0xc43a18, [0, 1.85, 0.22]),
          P(G.cone(0.12, 0.45, 5), 0xffd23a, [-0.16, 2.2, 0.1], [0, 0, 0.4]),
          P(G.cone(0.12, 0.45, 5), 0xffd23a, [0.16, 2.2, 0.1], [0, 0, -0.4]),
          P(G.box(0.1, 0.08, 0.05), 0xffee66, [-0.1, 1.88, 0.46]),
          P(G.box(0.1, 0.08, 0.05), 0xffee66, [0.1, 1.88, 0.46]),
          P(G.box(0.22, 0.08, 0.55), 0xff6a10, [0, 1.7, 0.55]),
          P(G.box(1.15, 0.08, 0.55), 0x6a1408, [-0.85, 1.35, -0.1], [0.2, 0.4, 0.5]),
          P(G.box(1.15, 0.08, 0.55), 0x6a1408, [0.85, 1.35, -0.1], [0.2, -0.4, -0.5]),
          P(G.box(0.22, 0.5, 0.22), 0x8a2010, [-0.22, 0.28, 0.22]),
          P(G.box(0.22, 0.5, 0.22), 0x8a2010, [0.22, 0.28, 0.22]),
          P(G.box(0.22, 0.5, 0.22), 0x8a2010, [-0.22, 0.28, -0.28]),
          P(G.box(0.22, 0.5, 0.22), 0x8a2010, [0.22, 0.28, -0.28]),
          P(G.cone(0.12, 0.7, 5), 0xc43a18, [0, 1.2, -0.7], [-1.1, 0, 0]),
        ]);
        case 'frostboss': return mergeParts([
          P(G.box(0.4, 0.6, 0.42), 0x7ec8e8, [-0.26, 0.3, 0]),
          P(G.box(0.4, 0.6, 0.42), 0x6ab8dc, [0.26, 0.3, 0]),
          P(G.box(1.1, 1.15, 0.75), 0xc8eefc, [0, 1.2, 0]),
          P(G.cone(0.22, 0.7, 5), 0xe8f8ff, [-0.35, 2.15, 0]),
          P(G.cone(0.22, 0.7, 5), 0xe8f8ff, [0.35, 2.15, 0]),
          P(G.box(0.14, 0.1, 0.06), 0x4ad0ff, [-0.14, 1.85, 0.4]),
          P(G.box(0.14, 0.1, 0.06), 0x4ad0ff, [0.14, 1.85, 0.4]),
          P(G.box(0.32, 0.9, 0.32), 0xa8d8f0, [-0.78, 1.15, 0]),
          P(G.box(0.32, 0.9, 0.32), 0xa8d8f0, [0.78, 1.15, 0]),
          P(G.oct(0.18), 0x7fd8ff, [0.78, 1.7, 0.12]),
        ]);
        case 'king': return mergeParts([
          P(G.box(0.22, 0.48, 0.22), 0x4a3524, [-0.14, 0.24, 0]),
          P(G.box(0.22, 0.48, 0.22), 0x4a3524, [0.14, 0.24, 0]),
          P(G.box(0.58, 0.62, 0.4), 0xc9a24a, [0, 0.85, 0]),
          P(G.box(0.62, 0.14, 0.44), 0xffd451, [0, 0.58, 0]),
          P(G.sph(0.22, 8, 6), 0xf1c27d, [0, 1.38, 0.02]),
          P(G.cyl(0.24, 0.24, 0.12, 8), 0xffd451, [0, 1.55, 0]),
          P(G.cone(0.06, 0.22, 4), 0xffd451, [0, 1.78, 0]),
          P(G.cone(0.05, 0.16, 4), 0xffd451, [-0.16, 1.68, 0]),
          P(G.cone(0.05, 0.16, 4), 0xffd451, [0.16, 1.68, 0]),
          P(G.box(0.08, 0.06, 0.04), 0x1b1b1b, [-0.08, 1.38, 0.2]),
          P(G.box(0.08, 0.06, 0.04), 0x1b1b1b, [0.08, 1.38, 0.2]),
          P(G.box(0.5, 0.7, 0.06), 0xc8323c, [0, 0.82, -0.24], [0.15, 0, 0]),
          P(G.box(0.16, 0.5, 0.16), 0xc9a24a, [-0.4, 0.85, 0]),
          P(G.box(0.16, 0.5, 0.16), 0xc9a24a, [0.4, 0.85, 0]),
          P(G.cyl(0.04, 0.04, 1.15, 6), 0xf0ead6, [0.48, 1.05, 0.2], [0.6, 0, 0]),
        ]);
        default: return mergeParts([P(G.box(0.4, 0.8, 0.4), 0xff00ff, [0, 0.4, 0])]);
      }
    });
  },

  // ---------------- Kahraman ----------------
  hero() {
    const mk = (geo, color, opts = {}) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...opts }));
      m.castShadow = true;
      m.userData.ownMat = true;
      return m;
    };
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const legGeo = G.box(0.2, 0.55, 0.22);
    const legL = new THREE.Group(); legL.position.set(-0.14, 0.55, 0);
    const legR = new THREE.Group(); legR.position.set(0.14, 0.55, 0);
    const lmL = mk(legGeo, 0x4a3524); lmL.position.y = -0.27; legL.add(lmL);
    const lmR = mk(legGeo, 0x4a3524); lmR.position.y = -0.27; legR.add(lmR);
    body.add(legL, legR);
    const torso = mk(G.box(0.56, 0.6, 0.36), 0x2d6cdf); torso.position.y = 0.86; body.add(torso);
    const belt = mk(G.box(0.6, 0.12, 0.4), 0x5a3b22); belt.position.y = 0.6; body.add(belt);
    const buckle = mk(G.box(0.14, 0.1, 0.05), 0xffcc33, { metalness: 0.6 }); buckle.position.set(0, 0.6, 0.21); body.add(buckle);
    const head = mk(G.sph(0.24, 10, 8), 0xf1c27d); head.position.y = 1.38; body.add(head);
    const helm = mk(new THREE.SphereGeometry(0.27, 10, 6, 0, PI * 2, 0, PI / 2), 0xc9d3de, { metalness: 0.5, roughness: 0.35 });
    helm.position.y = 1.42; body.add(helm);
    const plume = mk(G.box(0.07, 0.22, 0.4), 0xd8333f); plume.position.set(0, 1.72, -0.04); body.add(plume);
    const eyeGeo = G.box(0.05, 0.06, 0.03);
    const eL = mk(eyeGeo, 0x1b1b1b); eL.position.set(-0.08, 1.36, 0.23); body.add(eL);
    const eR = mk(eyeGeo, 0x1b1b1b); eR.position.set(0.08, 1.36, 0.23); body.add(eR);
    const cape = mk(G.box(0.52, 0.78, 0.05), 0xc8323c); cape.position.set(0, 0.82, -0.22); cape.rotation.x = 0.12; body.add(cape);
    const armGeo = G.box(0.15, 0.5, 0.17);
    const armL = new THREE.Group(); armL.position.set(-0.37, 1.1, 0);
    const armR = new THREE.Group(); armR.position.set(0.37, 1.1, 0);
    const amL = mk(armGeo, 0x2d6cdf); amL.position.y = -0.24; armL.add(amL);
    const amR = mk(armGeo, 0x2d6cdf); amR.position.y = -0.24; armR.add(amR);
    const staff = mk(G.cyl(0.035, 0.035, 1.5, 6), 0x6b4423); staff.position.set(0, -0.35, 0.14); armR.add(staff);
    const gem = new THREE.Mesh(G.oct(0.13), new THREE.MeshBasicMaterial({ color: 0x7ff0ff, toneMapped: false }));
    gem.userData.ownMat = true;
    gem.position.set(0, 0.5, 0.14); armR.add(gem);
    const gemGlow = glowSprite(0x6fe8ff, 0.9, 0.9); gemGlow.position.copy(gem.position); armR.add(gemGlow);
    body.add(armL, armR);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32), MAT.glowAdd(0x5fb4ff, 0.55));
    ring.userData.ownMat = true;
    ring.rotation.x = -PI / 2; ring.position.y = 0.04;
    root.add(ring);
    root.userData = { body, legL, legR, armL, armR, gem, gemGlow, ring };
    return root;
  },

  // ---------------- Temel ve kuleler ----------------
  foundation() {
    const g = new THREE.Group();
    const base = this.mesh('foundation', () => {
      const parts = [
        P(G.cyl(1.3, 1.42, 0.45, 6), 0x80848b, [0, 0.225, 0]),
        P(G.cyl(1.12, 1.2, 0.12, 6), 0x9da2a9, [0, 0.5, 0]),
      ];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + 0.5;
        parts.push(P(G.dod(0.2), 0x6e737a, [Math.cos(a) * 1.5, 0.08, Math.sin(a) * 1.5], [i, i * 2, 0], [1, 0.6, 1]));
      }
      return mergeParts(parts);
    });
    g.add(base);
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 6), MAT.glowAdd(0x6fe3ff, 0.85));
    rune.userData.ownMat = true;
    rune.rotation.x = -PI / 2; rune.position.y = 0.575;
    g.add(rune);
    g.userData.rune = rune;
    return g;
  },

  towerTop(type) {
    const g = new THREE.Group();
    const anim = { type, parts: {} };
    let muzzleY = 4.2;
    if (type === 'fire') {
      g.add(this.mesh('tower_fire', () => {
        const parts = [
          P(G.cyl(0.82, 0.98, 1.5, 6), 0x6e3226, [0, 1.31, 0]),
          P(G.cyl(0.92, 0.92, 0.16, 6), 0x3b1f1a, [0, 1.1, 0]),
          P(G.cyl(0.62, 0.8, 1.3, 6), 0x8a3c2a, [0, 2.71, 0]),
          P(G.cyl(0.86, 0.86, 0.14, 6), 0x3b1f1a, [0, 2.15, 0]),
          P(G.cyl(0.95, 0.66, 0.5, 8), 0x2e2422, [0, 3.61, 0]),
          P(G.tor(0.9, 0.07, 5, 12), 0xc9a227, [0, 3.86, 0], [PI / 2, 0, 0]),
          P(G.box(0.14, 0.42, 0.06), 0xffa040, [0, 1.6, 0.9]),
          P(G.box(0.14, 0.42, 0.06), 0xffa040, [0, 2.9, 0.68]),
        ];
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * PI * 2 + 0.3;
          parts.push(P(G.oct(0.24), 0xff7a2a, [Math.cos(a) * 1.05, 0.95, Math.sin(a) * 1.05], [0.2, a, 0.15], [0.7, 1.7, 0.7]));
        }
        return mergeParts(parts);
      }));
      const flame = new THREE.Group();
      flame.position.y = 3.85;
      const f1 = new THREE.Mesh(G.cone(0.55, 1.5, 7), MAT.glowAdd(0xff5a00, 0.75));
      const f2 = new THREE.Mesh(G.cone(0.38, 1.15, 7), MAT.glowAdd(0xffa020, 0.85));
      const f3 = new THREE.Mesh(G.cone(0.2, 0.75, 6), MAT.glowAdd(0xfff0a0, 0.95));
      [f1, f2, f3].forEach((f, i) => { f.position.y = [0.75, 0.58, 0.38][i]; f.userData.ownMat = true; flame.add(f); });
      g.add(flame);
      const glow = glowSprite(0xff7a20, 3.4, 0.9); glow.position.y = 4.4; g.add(glow);
      anim.parts = { flame, f1, f2, f3, glow };
      muzzleY = 4.4;
    } else if (type === 'ice') {
      g.add(this.mesh('tower_ice', () => {
        const parts = [
          P(G.cyl(0.8, 0.98, 1.7, 8), 0xb9d4e6, [0, 1.41, 0]),
          P(G.cyl(0.9, 0.9, 0.2, 8), 0xffffff, [0, 2.26, 0]),
          P(G.cyl(0.58, 0.78, 1.1, 8), 0xd6eaf6, [0, 2.81, 0]),
          P(G.cyl(0.78, 0.55, 0.3, 8), 0x9cc7e2, [0, 3.51, 0]),
          P(G.box(0.16, 0.5, 0.06), 0x5ab8e8, [0, 1.6, 0.93]),
        ];
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * PI * 2 + 0.4;
          parts.push(P(G.oct(0.27), 0x8fe3ff, [Math.cos(a) * 1.08, 0.95, Math.sin(a) * 1.08], [0.25, a, -0.2], [0.6, 1.8, 0.6]));
          parts.push(P(G.cone(0.1, 0.5, 4), 0xe8f7ff, [Math.cos(a + 0.8) * 0.62, 3.88, Math.sin(a + 0.8) * 0.62]));
        }
        return mergeParts(parts);
      }));
      const crystal = new THREE.Mesh(G.oct(0.42), new THREE.MeshStandardMaterial({
        color: 0xaef0ff, emissive: 0x2fa8ff, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1,
        transparent: true, opacity: 0.92, flatShading: true,
      }));
      crystal.userData.ownMat = true;
      crystal.scale.set(0.85, 1.7, 0.85);
      crystal.position.y = 4.55;
      crystal.castShadow = true;
      g.add(crystal);
      const shards = [];
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(G.oct(0.12), crystal.material);
        g.add(s); shards.push(s);
      }
      const glow = glowSprite(0x66d9ff, 2.6, 0.8); glow.position.y = 4.55; g.add(glow);
      anim.parts = { crystal, shards, glow };
      muzzleY = 4.55;
    } else if (type === 'storm') {
      g.add(this.mesh('tower_storm', () => {
        const parts = [
          P(G.cyl(0.74, 0.98, 1.5, 6), 0x3e4458, [0, 1.31, 0]),
          P(G.tor(0.82, 0.09, 5, 14), 0xc87533, [0, 1.2, 0], [PI / 2, 0, 0]),
          P(G.tor(0.76, 0.09, 5, 14), 0xc87533, [0, 1.65, 0], [PI / 2, 0, 0]),
          P(G.cyl(0.5, 0.7, 1.5, 6), 0x4a5068, [0, 2.81, 0]),
          P(G.tor(0.62, 0.08, 5, 14), 0xc87533, [0, 2.5, 0], [PI / 2, 0, 0]),
          P(G.tor(0.55, 0.08, 5, 14), 0xc87533, [0, 3.0, 0], [PI / 2, 0, 0]),
          P(G.cyl(0.62, 0.5, 0.22, 6), 0x2a2e3d, [0, 3.67, 0]),
        ];
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * PI * 2;
          parts.push(P(G.cone(0.07, 0.8, 4), 0xd98a40, [Math.cos(a) * 0.45, 4.12, Math.sin(a) * 0.45], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]));
        }
        return mergeParts(parts);
      }));
      const orb = new THREE.Mesh(G.sph(0.36, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe6dcff, toneMapped: false }));
      orb.userData.ownMat = true;
      orb.position.y = 4.4;
      g.add(orb);
      const r1 = new THREE.Mesh(G.tor(0.62, 0.025, 4, 32), MAT.glowAdd(0xb48cff, 0.9));
      const r2 = new THREE.Mesh(G.tor(0.7, 0.02, 4, 32), MAT.glowAdd(0x8cc8ff, 0.8));
      r1.userData.ownMat = r2.userData.ownMat = true;
      r1.position.y = r2.position.y = 4.4;
      g.add(r1, r2);
      const glow = glowSprite(0xa070ff, 3.2, 0.9); glow.position.y = 4.4; g.add(glow);
      anim.parts = { orb, r1, r2, glow };
      muzzleY = 4.4;
    } else if (type === 'acid') {
      g.add(this.mesh('tower_acid', () => mergeParts([
        P(G.cyl(0.95, 1.08, 1.3, 8), 0x56624a, [0, 1.21, 0]),
        P(G.cyl(1.03, 1.03, 0.12, 8), 0x2f3a2c, [0, 0.85, 0]),
        P(G.cyl(1.0, 1.0, 0.12, 8), 0x2f3a2c, [0, 1.6, 0]),
        P(G.cyl(0.72, 0.9, 1.0, 8), 0x6b7a5a, [0, 2.36, 0]),
        P(G.cyl(0.92, 0.62, 0.75, 10), 0x2e3436, [0, 3.24, 0]),
        P(G.tor(0.9, 0.08, 5, 16), 0x50585a, [0, 3.61, 0], [PI / 2, 0, 0]),
        P(G.cyl(0.08, 0.08, 1.8, 6), 0x8a8f7a, [0.93, 1.85, 0.25], [0, 0, 0.12]),
        P(G.cyl(0.08, 0.08, 1.8, 6), 0x8a8f7a, [-0.9, 1.85, -0.3], [0, 0, -0.12]),
        P(G.cyl(0.09, 0.16, 0.5, 6), 0x9aa08a, [0, 3.05, 0.98], [1.2, 0, 0]),
        P(G.box(0.3, 0.3, 0.3), 0x3d4a33, [0.7, 0.75, 0.75]),
        P(G.box(0.25, 0.25, 0.25), 0x3d4a33, [-0.75, 0.72, 0.7]),
      ])));
      const surf = new THREE.Mesh(new THREE.CircleGeometry(0.84, 18), new THREE.MeshBasicMaterial({ color: 0x7dff3a, toneMapped: false }));
      surf.userData.ownMat = true;
      surf.rotation.x = -PI / 2; surf.position.y = 3.5;
      g.add(surf);
      const glow = glowSprite(0x7dff3a, 2.4, 0.55); glow.position.y = 3.8; g.add(glow);
      anim.parts = { surf, glow };
      muzzleY = 3.75;
    } else if (type === 'death') {
      g.add(this.mesh('tower_death', () => {
        const parts = [
          P(G.cyl(0.8, 1.0, 1.45, 6), 0x3a3346, [0, 1.28, 0]),
          P(G.cyl(0.92, 0.92, 0.14, 6), 0x1f1a26, [0, 1.95, 0]),
          P(G.cyl(0.52, 0.76, 1.35, 6), 0x4a3f5c, [0, 2.7, 0]),
          P(G.cyl(0.85, 0.55, 0.32, 6), 0x2a2333, [0, 3.52, 0]),
          P(G.tor(0.82, 0.06, 4, 12), 0xd8cfb4, [0, 3.7, 0], [PI / 2, 0, 0]),
          P(G.ico(0.3, 0), 0xe6dcc0, [0, 2.75, 0.62], null, [1, 1.05, 0.9]),
          P(G.box(0.1, 0.09, 0.05), 0x2a0838, [-0.1, 2.8, 0.89]),
          P(G.box(0.1, 0.09, 0.05), 0x2a0838, [0.1, 2.8, 0.89]),
          P(G.box(0.18, 0.06, 0.05), 0xcfc6aa, [0, 2.58, 0.84]),
          P(G.box(0.12, 0.5, 0.06), 0xa45cff, [0, 1.35, 0.94]),
        ];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * PI * 2 + PI / 6;
          parts.push(P(G.cone(0.09, 0.62, 4), 0xe6dcc0, [Math.cos(a) * 0.72, 3.95, Math.sin(a) * 0.72], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]));
        }
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * PI * 2 + 0.9;
          const x = Math.cos(a) * 1.18, z = Math.sin(a) * 1.18;
          parts.push(P(G.box(0.42, 0.62, 0.14), 0x6d6a78, [x, 0.86, z], [0.12, -a + PI / 2, 0.08]));
          parts.push(P(G.cyl(0.21, 0.21, 0.14, 8, 1), 0x6d6a78, [x, 1.17, z], [PI / 2, 0, -a + PI / 2], [1, 1, 1]));
        }
        return mergeParts(parts);
      }));
      const core = new THREE.Mesh(G.sph(0.34, 14, 10), new THREE.MeshBasicMaterial({ color: 0x1a0626, toneMapped: false }));
      core.userData.ownMat = true;
      core.position.y = 4.35;
      g.add(core);
      const ring = new THREE.Mesh(G.tor(0.58, 0.03, 4, 28), MAT.glowAdd(0xc890ff, 0.9));
      ring.userData.ownMat = true;
      ring.position.y = 4.35;
      g.add(ring);
      const wisps = [];
      for (let i = 0; i < 3; i++) { const w = glowSprite(0xb070ff, 0.55, 0.9); g.add(w); wisps.push(w); }
      const glow = glowSprite(0x9b4dff, 3.0, 0.85); glow.position.y = 4.35; g.add(glow);
      anim.parts = { core, ring, wisps, glow };
      muzzleY = 4.35;
    } else if (type === 'life') {
      g.add(this.mesh('tower_life', () => {
        const parts = [
          P(G.cyl(0.5, 0.82, 1.6, 7), 0x6b4a2e, [0, 1.35, 0]),
          P(G.cyl(0.36, 0.5, 1.2, 7), 0x7a5634, [0, 2.75, 0], [0, 0, 0.06]),
          P(G.tor(0.62, 0.07, 4, 12), 0x4a8a3a, [0, 1.75, 0], [PI / 2, 0, 0]),
          P(G.ico(0.18, 0), 0x5fb84a, [0.6, 1.82, 0.2]),
          P(G.ico(0.15, 0), 0x6fd05a, [-0.45, 1.8, -0.4]),
          P(G.ico(0.16, 0), 0xffd0e8, [0.1, 1.84, 0.62]),
        ];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2 + 0.3;
          parts.push(P(G.cone(0.18, 0.95, 5), 0x5a3e26, [Math.cos(a) * 0.82, 0.78, Math.sin(a) * 0.82], [Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15]));
        }
        return mergeParts(parts);
      }));
      const canopy = new THREE.Group();
      canopy.position.y = 3.35;
      canopy.add(this.mesh('tower_life_canopy', () => mergeParts([
        P(G.ico(0.95, 0), 0x3f9a4a, [0, 0.25, 0], null, [1.1, 0.8, 1.1]),
        P(G.ico(0.7, 0), 0x52b35a, [0.62, 0.05, 0.3]),
        P(G.ico(0.66, 0), 0x2f7a3a, [-0.55, 0.1, 0.42]),
        P(G.ico(0.62, 0), 0x48a852, [0.1, 0.0, -0.66]),
        P(G.ico(0.55, 0), 0x5cc464, [-0.2, 0.75, -0.1]),
        P(G.ico(0.12, 0), 0xff8fc8, [0.7, 0.55, 0.55]),
        P(G.ico(0.12, 0), 0xfff08a, [-0.75, 0.45, -0.3]),
        P(G.ico(0.11, 0), 0xff8fc8, [-0.3, 0.6, 0.8]),
      ])));
      g.add(canopy);
      const bloom = new THREE.Mesh(G.oct(0.26), new THREE.MeshBasicMaterial({ color: 0xc8ffd8, toneMapped: false }));
      bloom.userData.ownMat = true;
      bloom.scale.set(1, 1.5, 1);
      bloom.position.y = 4.55;
      g.add(bloom);
      const leaves = [];
      for (let i = 0; i < 4; i++) {
        const l = new THREE.Mesh(FXGEO.wing, MAT.glowAdd(0x8dffa0, 0.75));
        l.userData.ownMat = true;
        g.add(l); leaves.push(l);
      }
      const glow = glowSprite(0x5fe08a, 3.2, 0.75); glow.position.y = 4.5; g.add(glow);
      anim.parts = { canopy, bloom, leaves, glow };
      muzzleY = 4.4;
    }
    g.traverse((o) => { if (o.isMesh && o.material === MAT.vc) o.castShadow = true; });
    return { group: g, anim, muzzleY };
  },

  // ---------------- Çağrılan yaratıklar ----------------
  zombie() {
    const g = new THREE.Group();
    const legL = this.mesh('zombie_leg', () => mergeParts([P(G.box(0.17, 0.42, 0.18), 0x3f3d52, [0, -0.21, 0])]));
    const legR = new THREE.Mesh(legL.geometry, MAT.vc);
    legL.position.set(-0.12, 0.42, 0); legR.position.set(0.12, 0.42, 0);
    const body = this.mesh('zombie_body', () => mergeParts([
      P(G.box(0.46, 0.5, 0.3), 0x5f6e48, [0, 0.66, 0], [0.18, 0, 0.06]),
      P(G.box(0.3, 0.12, 0.31), 0x4a3a52, [0.06, 0.48, 0]),
      P(G.box(0.34, 0.32, 0.32), 0x8fae7a, [0.02, 1.08, 0.1], [0.3, 0.2, -0.12]),
      P(G.box(0.08, 0.06, 0.04), 0xd86bff, [-0.07, 1.12, 0.27]),
      P(G.box(0.08, 0.06, 0.04), 0xd86bff, [0.11, 1.1, 0.27]),
      P(G.box(0.12, 0.12, 0.5), 0x8fae7a, [-0.3, 0.86, 0.26], [-0.12, 0.1, 0]),
      P(G.box(0.12, 0.12, 0.46), 0x7f9e6a, [0.3, 0.8, 0.24], [0.1, -0.1, 0]),
    ]));
    g.add(legL, legR, body);
    legR.castShadow = true;
    const aura = new THREE.Mesh(FXGEO.plane, FXMAT.zombieAura);
    aura.rotation.x = -PI / 2; aura.position.y = 0.06; aura.scale.setScalar(0.65);
    aura.renderOrder = 4;
    g.add(aura);
    g.userData = { legL, legR, body };
    g.scale.setScalar(1.15);
    return g;
  },

  seed() {
    return this.mesh('seed', () => mergeParts([
      P(G.ico(0.26, 0), 0x7a5a2a, [0, 0.22, 0], null, [1, 1.25, 1]),
      P(G.cyl(0.22, 0.27, 0.12, 7), 0x4a3a1e, [0, 0.42, 0]),
      P(G.cone(0.05, 0.3, 4), 0x6fd05a, [0, 0.62, 0]),
      P(G.box(0.2, 0.03, 0.09), 0x7ce060, [0.09, 0.72, 0], [0, 0, 0.5]),
      P(G.box(0.2, 0.03, 0.09), 0x7ce060, [-0.09, 0.7, 0], [0, 0, -0.5]),
    ]), false);
  },

  ghost() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x55ff77, transparent: true, opacity: 0.45, depthWrite: false });
    const m = new THREE.Mesh(G.cyl(1.3, 1.42, 0.55, 6), mat);
    m.position.y = 0.28;
    g.add(m);
    g.userData.mat = mat;
    return g;
  },

  // ---------------- Kale ----------------
  castle() {
    const g = new THREE.Group();
    g.add(this.mesh('castle', () => {
      const parts = [
        P(G.box(5.8, 0.5, 5.8), 0x8f887c, [0, 0.25, 0]),
        P(G.box(5.2, 4.2, 5.2), 0xb8b0a2, [0, 2.1, 0]),
        P(G.cone(3.0, 2.6, 4), 0x3f5fcf, [0, 5.6, 0], [0, PI / 4, 0]),
        P(G.box(2.3, 2.9, 0.2), 0x8f887c, [0, 1.45, -2.58]),
        P(G.box(1.8, 2.5, 0.2), 0x4a3426, [0, 1.25, -2.7]),
        P(G.box(0.2, 2.9, 2.3), 0x8f887c, [-2.58, 1.45, 0]),
        P(G.box(0.2, 2.5, 1.8), 0x4a3426, [-2.7, 1.25, 0]),
        P(G.box(0.2, 2.9, 2.3), 0x8f887c, [2.58, 1.45, 0]),
        P(G.box(0.2, 2.5, 1.8), 0x4a3426, [2.7, 1.25, 0]),
      ];
      for (let i = -2; i <= 2; i++) {
        parts.push(P(G.box(0.55, 0.55, 0.55), 0xa79f91, [i * 1.15, 4.45, -2.4]));
        parts.push(P(G.box(0.55, 0.55, 0.55), 0xa79f91, [i * 1.15, 4.45, 2.4]));
        parts.push(P(G.box(0.55, 0.55, 0.55), 0xa79f91, [-2.4, 4.45, i * 1.15]));
        parts.push(P(G.box(0.55, 0.55, 0.55), 0xa79f91, [2.4, 4.45, i * 1.15]));
      }
      for (const sx of [-1, 1]) {
        parts.push(P(G.box(0.5, 0.8, 0.1), 0x2b2b35, [sx * 1.5, 3.1, -2.62]));
        parts.push(P(G.box(0.5, 0.8, 0.1), 0x2b2b35, [sx * 1.5, 3.1, 2.62]));
        for (const sz of [-1, 1]) {
          const x = sx * 3.2, z = sz * 3.2;
          parts.push(P(G.cyl(1.0, 1.12, 5.6, 8), 0xa79f91, [x, 2.8, z]));
          parts.push(P(G.cyl(1.2, 1.2, 0.32, 8), 0x8f887c, [x, 5.66, z]));
          parts.push(P(G.cone(1.35, 2.0, 8), 0xc23b3b, [x, 6.8, z]));
          parts.push(P(G.box(0.3, 0.6, 0.1), 0x2b2b35, [x + sx * 0.2, 3.8, z + sz * 0.98]));
        }
      }
      return mergeParts(parts);
    }));
    const flags = [];
    const poleGeo = G.cyl(0.04, 0.04, 1.4, 5);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a });
    const flagGeo = new THREE.PlaneGeometry(0.95, 0.55);
    flagGeo.translate(0.48, 0, 0);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0x2d6cdf, side: THREE.DoubleSide, roughness: 0.8 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(sx * 3.2, 8.4, sz * 3.2);
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(sx * 3.2, 8.85, sz * 3.2);
      flag.castShadow = true;
      g.add(pole, flag);
      flags.push(flag);
    }
    g.userData.flags = flags;
    return g;
  },

  portal() {
    const g = new THREE.Group();
    g.add(this.mesh('portal', () => mergeParts([
      P(G.box(0.9, 4.4, 0.9), 0x55505f, [-2.75, 2.2, 0]),
      P(G.box(0.9, 4.4, 0.9), 0x55505f, [2.75, 2.2, 0]),
      P(G.box(6.7, 0.8, 1.1), 0x48434f, [0, 4.6, 0]),
      P(G.box(7.3, 0.25, 2.4), 0x6b6576, [0, 0.12, 0]),
      P(G.cone(0.38, 0.9, 4), 0x3b3644, [-2.75, 5.45, 0]),
      P(G.cone(0.38, 0.9, 4), 0x3b3644, [2.75, 5.45, 0]),
      P(G.box(0.14, 0.5, 0.05), 0xb27bff, [-2.75, 1.5, 0.47]),
      P(G.box(0.14, 0.5, 0.05), 0xb27bff, [-2.75, 2.6, 0.47]),
      P(G.box(0.14, 0.5, 0.05), 0xb27bff, [2.75, 1.5, 0.47]),
      P(G.box(0.14, 0.5, 0.05), 0xb27bff, [2.75, 2.6, 0.47]),
    ])));
    const dark = new THREE.Mesh(new THREE.CircleGeometry(2.25, 32), new THREE.MeshBasicMaterial({ color: 0x14061f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    dark.position.y = 2.25;
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(2.25, 32), new THREE.MeshBasicMaterial({
      map: TEX.swirl, color: 0xb070ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }));
    swirl.position.set(0, 2.25, 0.02);
    const glow = glowSprite(0x9a50ff, 7, 0.6); glow.position.y = 2.3;
    g.add(dark, swirl, glow);
    g.userData = { swirl, dark, glow };
    return g;
  },

  // ---------------- Doğa ----------------
  tree(kind) {
    const key = 'tree_' + kind;
    return this.mesh(key, () => {
      if (kind === 'pine') return mergeParts([
        P(G.cyl(0.15, 0.22, 0.9, 6), 0x6b4a2b, [0, 0.45, 0]),
        P(G.cone(1.05, 1.5, 7), 0x2f6b3a, [0, 1.4, 0]),
        P(G.cone(0.82, 1.25, 7), 0x377a42, [0, 2.1, 0]),
        P(G.cone(0.55, 1.05, 7), 0x3f8a4a, [0, 2.75, 0]),
      ]);
      if (kind === 'autumn') return mergeParts([
        P(G.cyl(0.14, 0.2, 1.1, 6), 0x6b4a2b, [0, 0.55, 0]),
        P(G.ico(0.95, 0), 0xd98a2b, [0, 1.7, 0]),
        P(G.ico(0.6, 0), 0xe8a83a, [0.4, 2.05, 0.25]),
      ]);
      return mergeParts([
        P(G.cyl(0.14, 0.2, 1.1, 6), 0x6b4a2b, [0, 0.55, 0]),
        P(G.ico(0.95, 0), 0x4f9a3e, [0, 1.7, 0]),
        P(G.ico(0.62, 0), 0x5fae48, [0.38, 2.05, 0.22]),
      ]);
    });
  },
  rock() {
    return this.mesh('rock', () => mergeParts([
      P(G.dod(0.6), 0x8a8a8a, [0, 0.3, 0], null, [1, 0.7, 1]),
      P(G.dod(0.35), 0x9a9a9a, [0.45, 0.18, 0.2], [0.5, 0.3, 0], [1, 0.8, 1]),
    ]));
  },
  bush() {
    return this.mesh('bush', () => mergeParts([
      P(G.ico(0.48, 0), 0x3f8f3a, [0, 0.32, 0]),
      P(G.ico(0.36, 0), 0x4fa046, [0.34, 0.26, 0.12]),
      P(G.ico(0.3, 0), 0x47973f, [-0.3, 0.22, -0.1]),
    ]));
  },
};
