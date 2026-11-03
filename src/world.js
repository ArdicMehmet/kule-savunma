'use strict';

// Düşmanların izlediği yol: Catmull-Rom eğrisinden eşit aralıklı örneklenmiş çoklu çizgi.
class GamePath {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    const pts = def.pts.map((p) => new THREE.Vector3(p[0], 0, p[1]));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const n = Math.ceil(curve.getLength() / 0.4);
    const sp = curve.getSpacedPoints(n);
    this.n = n;
    this.xs = new Float32Array(n + 1);
    this.zs = new Float32Array(n + 1);
    this.cum = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) {
      this.xs[i] = sp[i].x; this.zs[i] = sp[i].z;
      if (i > 0) this.cum[i] = this.cum[i - 1] + dist(this.xs[i - 1], this.zs[i - 1], this.xs[i], this.zs[i]);
    }
    this.length = this.cum[n];
    this.step = this.length / n;
  }

  sample(d, out) {
    d = clamp(d, 0, this.length);
    let i = Math.min(this.n - 1, Math.floor(d / this.step));
    while (i < this.n - 1 && this.cum[i + 1] < d) i++;
    while (i > 0 && this.cum[i] > d) i--;
    const seg = (this.cum[i + 1] - this.cum[i]) || 1e-6;
    const t = (d - this.cum[i]) / seg;
    const x0 = this.xs[i], z0 = this.zs[i], x1 = this.xs[i + 1], z1 = this.zs[i + 1];
    out.x = x0 + (x1 - x0) * t;
    out.z = z0 + (z1 - z0) * t;
    out.tx = (x1 - x0) / seg;
    out.tz = (z1 - z0) / seg;
    return out;
  }

  distTo(x, z) {
    let best = Infinity;
    for (let i = 0; i < this.n; i += 2) {
      const j = Math.min(this.n, i + 2);
      const d2 = segDist2(x, z, this.xs[i], this.zs[i], this.xs[j], this.zs[j]);
      if (d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }
}

class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.paths = PATH_DEFS.map((d, i) => new GamePath(d, i));
    this.decor = [];
    this.portals = [];
    this.wormholeFx = [];
    this.time = 0;
    this.mood = null;
    this.buildGround();
    this.paths.forEach((p, i) => this.buildRoad(p, i));
    this.buildCastle();
    this.buildPortals();
    this.buildDecor();
    this.buildGrass();
  }

  roadDist(x, z) {
    let best = Infinity;
    for (const p of this.paths) best = Math.min(best, p.distTo(x, z));
    return best;
  }

  buildGround() {
    const size = 260, seg = 130;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(0x5c9a3a), c2 = new THREE.Color(0x7cb24c), c3 = new THREE.Color(0x4a7d30), c4 = new THREE.Color(0x8a9a52);
    const c = new THREE.Color();
    const b = CFG.bounds;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = fbm(x * 0.06 + 10, z * 0.06 + 10);
      c.copy(c1).lerp(c2, n);
      if (fbm(x * 0.15, z * 0.15) > 0.72) c.lerp(c4, 0.5);
      const ex = Math.max(0, b.minX - 6 - x, x - b.maxX - 6, b.minZ - 6 - z, z - b.maxZ - 8);
      if (ex > 0) {
        c.lerp(c3, Math.min(0.6, ex * 0.04));
        pos.setY(i, Math.pow(ex, 1.25) * 0.14 * (0.5 + fbm(x * 0.05, z * 0.05)));
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.ground = mesh;
  }

  buildRoad(path, idx) {
    const pts = [];
    const s0 = path.sample(0, {});
    for (let k = 14; k >= 1; k--) pts.push([s0.x - s0.tx * k * 0.8, s0.z - s0.tz * k * 0.8]);
    for (let i = 0; i <= path.n; i++) pts.push([path.xs[i], path.zs[i]]);
    const hw = CFG.roadHalfWidth, edge = 0.45;
    const offs = [-(hw + edge), -hw, -hw * 0.25, hw * 0.25, hw, hw + edge];
    const cEdge = new THREE.Color(0x7d8a4c), cDirt = new THREE.Color(0x9b7b52), cMid = new THREE.Color(0xa88a5e), c = new THREE.Color();
    const V = offs.length;
    const positions = new Float32Array(pts.length * V * 3);
    const colors = new Float32Array(pts.length * V * 3);
    const y = 0.03 + idx * 0.004;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], bb = pts[Math.min(pts.length - 1, i + 1)];
      let tx = bb[0] - a[0], tz = bb[1] - a[1];
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = -tz, nz = tx;
      for (let k = 0; k < V; k++) {
        const o = (i * V + k) * 3;
        positions[o] = pts[i][0] + nx * offs[k];
        positions[o + 1] = y;
        positions[o + 2] = pts[i][1] + nz * offs[k];
        const nn = noise2(positions[o] * 0.7, positions[o + 2] * 0.7);
        if (k === 0 || k === V - 1) c.copy(cEdge);
        else if (k === 1 || k === V - 2) c.copy(cDirt).lerp(cEdge, 0.15);
        else c.copy(cMid);
        c.multiplyScalar(0.88 + nn * 0.2);
        colors[o] = c.r; colors[o + 1] = c.g; colors[o + 2] = c.b;
      }
    }
    const index = [];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k < V - 1; k++) {
        const a = i * V + k, b2 = a + 1, cc = a + V, d = cc + 1;
        index.push(a, b2, cc, b2, d, cc);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Yol kenarı çakılları
    const count = Math.floor(path.length / 2.2);
    const peb = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0x8c8274, flatShading: true }), count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const smp = {};
    for (let i = 0; i < count; i++) {
      path.sample(rand(0, path.length), smp);
      const side = rand(-hw * 1.15, hw * 1.15);
      p.set(smp.x - smp.tz * side, 0.05, smp.z + smp.tx * side);
      q.setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0));
      const sc = rand(0.6, 1.5);
      s.set(sc, sc * 0.6, sc);
      m.compose(p, q, s);
      peb.setMatrixAt(i, m);
    }
    peb.receiveShadow = true;
    this.scene.add(peb);
  }

  buildCastle() {
    const c = CFG.castle;
    this.castle = Models.castle();
    this.castle.position.set(c.x, 0, c.z);
    this.castle.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(this.castle);
  }

  buildPortals() {
    const smp = {};
    for (const path of this.paths) {
      const g = Models.portal();
      path.sample(0.5, smp);
      const s0 = path.sample(0, {});
      g.position.set(s0.x, 0, s0.z);
      g.rotation.y = Math.atan2(smp.tx, smp.tz);
      this.scene.add(g);
      const light = new THREE.PointLight(0xa060ff, 0, 14, 2);
      light.position.set(s0.x, 2.5, s0.z);
      this.scene.add(light);
      this.portals.push({ group: g, x: s0.x, z: s0.z, active: false, light, path });
      this.setPortalActive(path.index, false);
    }
  }

  setPortalActive(i, active) {
    const p = this.portals[i];
    if (!p) return;
    p.active = active;
    p.group.userData.swirl.visible = active;
    p.group.userData.glow.visible = active;
    p.group.userData.dark.material.opacity = active ? 0.8 : 0.35;
    p.light.intensity = active ? 30 : 0;
  }

  addDecor(kind, x, z, inside) {
    let mesh, r = 0, solid = true;
    const sc = rand(0.8, 1.35);
    if (kind === 'rock') { mesh = Models.rock(); r = 0.65 * sc; }
    else if (kind === 'bush') { mesh = Models.bush(); r = 0.5 * sc; solid = false; }
    else { mesh = Models.tree(kind); r = 0.45 * sc; }
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rand(0, Math.PI * 2);
    mesh.scale.setScalar(sc);
    this.scene.add(mesh);
    this.decor.push({ mesh, x, z, r, solid, inside, kind });
  }

  validDecorSpot(x, z, roadMargin) {
    const c = CFG.castle;
    if (dist(x, z, c.x, c.z) < 10) return false;
    if (this.roadDist(x, z) < CFG.roadHalfWidth + roadMargin) return false;
    for (const p of this.portals) if (dist(x, z, p.x, p.z) < 7) return false;
    if (dist(x, z, 0, 14) < 5) return false;
    return true;
  }

  buildDecor() {
    const b = CFG.bounds;
    const kinds = ['pine', 'round', 'round', 'pine', 'autumn', 'rock', 'bush', 'bush'];
    let placed = 0, tries = 0;
    while (placed < 46 && tries++ < 2000) {
      const x = rand(b.minX + 2, b.maxX - 2), z = rand(b.minZ + 2, b.maxZ - 2);
      if (!this.validDecorSpot(x, z, 2.6)) continue;
      if (this.decor.some((d) => dist2(x, z, d.x, d.z) < 9)) continue;
      this.addDecor(choice(kinds), x, z, true);
      placed++;
    }
    placed = 0; tries = 0;
    while (placed < 300 && tries++ < 5000) {
      const x = rand(-85, 85), z = rand(-85, 75);
      const inside = x > b.minX - 1 && x < b.maxX + 1 && z > b.minZ - 1 && z < b.maxZ + 1;
      if (inside) continue;
      if (!this.validDecorSpot(x, z, 2.0)) continue;
      this.addDecor(choice(['pine', 'pine', 'round', 'autumn', 'pine', 'rock']), x, z, false);
      const d = this.decor[this.decor.length - 1];
      const ex = Math.max(0, b.minX - 6 - x, x - b.maxX - 6, b.minZ - 6 - z, z - b.maxZ - 8);
      d.mesh.position.y = ex > 0 ? Math.pow(ex, 1.25) * 0.14 * (0.5 + fbm(x * 0.05, z * 0.05)) : 0;
      placed++;
    }
  }

  buildGrass() {
    const blade = mergeParts([
      P(G.cone(0.05, 0.38, 3), 0xffffff, [0, 0.19, 0], [0, 0, 0.15]),
      P(G.cone(0.05, 0.3, 3), 0xffffff, [0.06, 0.15, 0.03], [0.2, 0, -0.25]),
      P(G.cone(0.05, 0.33, 3), 0xffffff, [-0.05, 0.16, -0.02], [-0.2, 0, 0.3]),
    ]);
    const count = 1800;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    const grass = new THREE.InstancedMesh(blade, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    let i = 0, tries = 0;
    while (i < count && tries++ < 8000) {
      const x = rand(-60, 60), z = rand(-58, 48);
      if (this.roadDist(x, z) < CFG.roadHalfWidth + 0.5) continue;
      if (dist(x, z, CFG.castle.x, CFG.castle.z) < 6) continue;
      p.set(x, 0, z);
      q.setFromEuler(e.set(0, rand(0, 6.28), 0));
      const sc = rand(0.7, 1.6);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      grass.setMatrixAt(i, m);
      col.setHSL(rand(0.24, 0.3), rand(0.45, 0.6), rand(0.3, 0.42));
      grass.setColorAt(i, col);
      i++;
    }
    grass.count = i;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const fc = 260;
    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), fc);
    const palette = [0xffffff, 0xffe14a, 0xff7eb6, 0xb28cff, 0xff6b4a];
    i = 0; tries = 0;
    while (i < fc && tries++ < 3000) {
      const x = rand(-58, 58), z = rand(-56, 46);
      if (this.roadDist(x, z) < CFG.roadHalfWidth + 0.6) continue;
      p.set(x, 0.22, z);
      m.compose(p, q.identity(), s.set(1, 1, 1));
      flowers.setMatrixAt(i, m);
      flowers.setColorAt(i, col.setHex(choice(palette)));
      i++;
    }
    flowers.count = i;
    this.scene.add(flowers);
  }

  removeDecorAt(x, z, r) {
    for (let i = this.decor.length - 1; i >= 0; i--) {
      const d = this.decor[i];
      if (!d.inside) continue;
      if (dist(x, z, d.x, d.z) < r + d.r) {
        this.scene.remove(d.mesh);
        this.game.fxN.burst(d.x, 0.8, d.z, 14, { color: d.kind === 'rock' ? 0x9a9a9a : 0x4f9a3e, speed: 3, life: 0.7, size: 0.35, gravity: 5 });
        this.decor.splice(i, 1);
      }
    }
  }

  // Temel yerleştirilebilir mi? { ok, reason }
  canPlace(x, z, towers) {
    const b = CFG.bounds, fr = CFG.foundationRadius;
    if (x < b.minX + 1.5 || x > b.maxX - 1.5 || z < b.minZ + 1.5 || z > b.maxZ - 1.5) return { ok: false, reason: 'Harita dışı' };
    if (this.roadDist(x, z) < CFG.roadHalfWidth + fr + 0.15) return { ok: false, reason: 'Yolun üstüne kurulamaz' };
    const c = CFG.castle;
    if (dist(x, z, c.x, c.z) < c.radius + 2.4) return { ok: false, reason: 'Kaleye çok yakın' };
    for (const p of this.portals) if (dist(x, z, p.x, p.z) < 4.5) return { ok: false, reason: 'Geçide çok yakın' };
    for (const t of towers) if (dist(x, z, t.x, t.z) < fr * 2 + 0.2) return { ok: false, reason: 'Başka bir kuleye çok yakın' };
    return { ok: true };
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    for (const p of this.portals) {
      if (!p.active) continue;
      const u = p.group.userData;
      u.swirl.rotation.z -= dt * 1.6;
      u.glow.material.opacity = 0.45 + Math.sin(t * 3) * 0.15;
      if (Math.random() < dt * 14) {
        const a = rand(-2, 2);
        const rx = Math.cos(p.group.rotation.y), rz = -Math.sin(p.group.rotation.y);
        this.game.fxA.emit({
          x: p.x + rx * a, y: rand(0.2, 4), z: p.z + rz * a,
          vx: rand(-0.3, 0.3), vy: rand(0.5, 1.5), vz: rand(-0.3, 0.3),
          life: rand(0.8, 1.6), size: rand(0.25, 0.5), size2: 0, color: choice([0xa060ff, 0xd090ff, 0x7040ff]), alpha: 0.9,
        });
      }
    }
    const flags = this.castle.userData.flags;
    for (let i = 0; i < flags.length; i++) {
      flags[i].rotation.y = Math.sin(t * 2.2 + i) * 0.35 + 0.4;
      flags[i].scale.x = 1 + Math.sin(t * 4 + i * 2) * 0.06;
    }
    for (const w of this.wormholeFx) {
      w.ring.rotation.z += dt * 2.4;
      w.glow.material.opacity = 0.5 + 0.25 * Math.sin(t * 4 + w.phase);
      if (Math.random() < dt * 10) {
        this.game.fxA.emit({
          x: w.x + rand(-0.6, 0.6), y: rand(0.4, 2.4), z: w.z + rand(-0.6, 0.6),
          vy: rand(0.4, 1.4), life: 0.7, size: 0.28, size2: 0, color: choice([0xc08cff, 0x7ec8ff, 0xffffff]), alpha: 0.9,
        });
      }
    }
  }

  setMood(id) {
    const g = this.game, s = g.scene;
    this.mood = id;
    const moods = {
      blood_moon: { sky: 0x4a1420, fog: 0x3a1018, hemi: 0xff6a6a, ground: 0x3a1a18, sun: 0xff7040, sunI: 1.4, exp: 0.85 },
      gold_rush: { sky: 0xc8b060, fog: 0xb8a050, hemi: 0xffe9a0, ground: 0x6a5a28, sun: 0xffe080, sunI: 2.8, exp: 1.15 },
      emp: { sky: 0x6a88aa, fog: 0x5a78a0, hemi: 0xa8d8ff, ground: 0x3a4a58, sun: 0xc0e8ff, sunI: 2.1, exp: 1.0 },
      wormhole: { sky: 0x3a2858, fog: 0x2a1848, hemi: 0xc08cff, ground: 0x2a1a40, sun: 0xb080ff, sunI: 1.7, exp: 0.9 },
    };
    const m = moods[id] || { sky: 0xa8d8f0, fog: 0xa8d8f0, hemi: 0xd4ecff, ground: 0x5a6b3a, sun: 0xfff0d0, sunI: 2.6, exp: 1.05 };
    s.background.setHex(m.sky);
    s.fog.color.setHex(m.fog);
    g.hemi.color.setHex(m.hemi);
    g.hemi.groundColor.setHex(m.ground);
    g.sun.color.setHex(m.sun);
    g.sun.intensity = m.sunI;
    g.renderer.toneMappingExposure = m.exp;
  }

  spawnWormholes() {
    this.clearWormholes();
    const g = this.game, n = g.waves.wave;
    const paths = this.paths.filter((p) => p.def.unlock <= n);
    if (paths.length < 2) return;
    const counts = new Map();
    for (const p of paths) counts.set(p, 0);
    for (const s of g.waves.queue) if (counts.has(s.path)) counts.set(s.path, counts.get(s.path) + 1);
    let busy = paths[0], sparse = paths[0], bc = -1, sc = Infinity;
    for (const p of paths) {
      const c = counts.get(p) || 0;
      if (c > bc) { bc = c; busy = p; }
      if (c < sc) { sc = c; sparse = p; }
    }
    if (busy === sparse) sparse = paths.find((p) => p !== busy) || busy;
    const fromDist = busy.length * 0.48;
    const toDist = sparse.length * 0.48;
    const mk = (path, dist, color) => {
      const s = { x: 0, z: 0, tx: 0, tz: 1 };
      path.sample(dist, s);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.14, 8, 24), new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false,
      }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(s.x, 1.15, s.z);
      const glow = glowSprite(color, 3.2, 0.6);
      glow.position.set(s.x, 1.15, s.z);
      this.scene.add(ring, glow);
      const light = new THREE.PointLight(color, 18, 10, 2);
      light.position.set(s.x, 1.6, s.z);
      this.scene.add(light);
      this.wormholeFx.push({ ring, glow, light, x: s.x, z: s.z, phase: rand(0, 6) });
      return { x: s.x, z: s.z };
    };
    mk(busy, fromDist, 0xc08cff);
    mk(sparse, toDist, 0x7ec8ff);
    g.wormholes = [{ from: busy, fromDist, to: sparse, toDist }];
    g.ui.toast('🌀 Solucan delikleri yolların ortasında açıldı!');
  }

  clearWormholes() {
    for (const w of this.wormholeFx) {
      this.scene.remove(w.ring, w.glow, w.light);
      if (w.ring.geometry) w.ring.geometry.dispose();
      if (w.ring.material) w.ring.material.dispose();
      if (w.glow.material) w.glow.material.dispose();
    }
    this.wormholeFx.length = 0;
    this.game.wormholes = [];
  }
}
