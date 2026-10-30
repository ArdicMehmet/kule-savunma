'use strict';

const FXGEO = {};
const FXMAT = {};
function initFxAssets() {
  FXGEO.plane = new THREE.PlaneGeometry(2, 2);
  FXGEO.sph = new THREE.IcosahedronGeometry(1, 1);
  FXGEO.ico0 = new THREE.IcosahedronGeometry(1, 0);
  FXGEO.oct = new THREE.OctahedronGeometry(1, 0);
  FXGEO.cone = new THREE.ConeGeometry(1, 1, 6);
  FXGEO.spike = new THREE.ConeGeometry(0.28, 1.5, 5);
  FXGEO.spike.translate(0, 0.75, 0);
  FXMAT.spike = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x2a8fd0, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 });

  const P = {};
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const glowMat = (c) => new THREE.SpriteMaterial({ map: TEX.glow, color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  P.fire = { geo: FXGEO.sph, mat: basic(0xffb050), s: [0.22, 0.22, 0.22], glow: glowMat(0xff6a10), gs: 1.5, trail: [0xff7a20, 0xffb040], tsize: 0.35 };
  P.ice = { geo: FXGEO.oct, mat: basic(0xd8f6ff), s: [0.12, 0.12, 0.36], glow: glowMat(0x5fd0ff), gs: 1.1, trail: [0xbff0ff, 0x7fd8ff], tsize: 0.2 };
  P.acid = { geo: FXGEO.sph, mat: basic(0x9cff5a), s: [0.24, 0.24, 0.24], glow: glowMat(0x6aff2a), gs: 1.3, trail: [0x7dff3a, 0xb0ff6a], tsize: 0.25 };
  P.lava = { geo: FXGEO.ico0, mat: basic(0xff5a1a), s: [0.3, 0.3, 0.3], glow: glowMat(0xff3a00), gs: 1.8, trail: [0xff4a00, 0xffa020], tsize: 0.45 };
  P.bomb = { geo: FXGEO.ico0, mat: new THREE.MeshStandardMaterial({ color: 0x2f5a1f, flatShading: true }), s: [0.3, 0.3, 0.3], glow: glowMat(0x8cff4a), gs: 0.9, trail: [0x6aff2a, 0x3a8a1a], tsize: 0.3 };
  P.hero = { geo: FXGEO.sph, mat: basic(0xe0fcff), s: [0.14, 0.14, 0.14], glow: glowMat(0x6fe8ff), gs: 1.0, trail: [0x9ff4ff, 0x6fe8ff], tsize: 0.2 };
  FXMAT.proj = P;
}

function makeProjectileMesh(kind) {
  const P = FXMAT.proj[kind];
  const g = new THREE.Group();
  const m = new THREE.Mesh(P.geo, P.mat);
  m.scale.set(P.s[0], P.s[1], P.s[2]);
  g.add(m);
  const s = new THREE.Sprite(P.glow);
  s.scale.set(P.gs, P.gs, 1);
  g.add(s);
  g.userData.core = m;
  return g;
}

// ---------- Temel efekt sınıfı ----------
class Fx {
  constructor(game) { this.game = game; this.t = 0; this.alive = true; this.objs = []; }
  add(o) { this.game.scene.add(o); this.objs.push(o); return o; }
  update(dt) { this.t += dt; return this.alive; }
  dispose() {
    for (const o of this.objs) { this.game.scene.remove(o); disposeObject(o, true); }
    this.objs.length = 0;
  }
}

function makeDecal(tex, color, opacity, additive = true) {
  const m = new THREE.Mesh(FXGEO.plane, new THREE.MeshBasicMaterial({
    map: tex, color, transparent: true, opacity, depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 5;
  m.userData.ownMat = true;
  return m;
}

function makeGlow(color, scale, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.set(scale, scale, 1);
  s.userData.ownMat = true;
  return s;
}

// Genişleyip sönen zemin halkası
class RingPulseFx extends Fx {
  constructor(game, x, z, radius, color, life = 0.45, y = 0.1) {
    super(game);
    this.life = life; this.radius = radius;
    this.d = this.add(makeDecal(TEX.ring, color, 1));
    this.d.position.set(x, y, z);
    this.d.scale.setScalar(radius * 0.3);
  }
  update(dt) {
    this.t += dt;
    const k = this.t / this.life;
    if (k >= 1) return false;
    this.d.scale.setScalar(this.radius * (0.3 + 0.75 * Math.sqrt(k)));
    this.d.material.opacity = 1 - k;
    return true;
  }
}

// Kısa parlama
class FlashFx extends Fx {
  constructor(game, x, y, z, color, size, life = 0.25) {
    super(game);
    this.life = life; this.size = size;
    this.s = this.add(makeGlow(color, size));
    this.s.position.set(x, y, z);
  }
  update(dt) {
    this.t += dt;
    const k = this.t / this.life;
    if (k >= 1) return false;
    this.s.scale.setScalar(this.size * (1 + k * 0.6));
    this.s.material.opacity = 1 - k;
    return true;
  }
}

// Zamanla solan zemin izi (yanık, asit lekesi vb.)
class ScorchFx extends Fx {
  constructor(game, x, z, radius, color, life = 2, additive = false, opacity = 0.55) {
    super(game);
    this.life = life; this.op = opacity;
    this.d = this.add(makeDecal(TEX.soft, color, opacity, additive));
    this.d.position.set(x, 0.07, z);
    this.d.scale.setScalar(radius);
  }
  update(dt) {
    this.t += dt;
    const k = this.t / this.life;
    if (k >= 1) return false;
    this.d.material.opacity = this.op * (1 - k * k);
    return true;
  }
}

function fxExplosion(game, x, z, radius, color, opts = {}) {
  const n = Math.min(60, 14 + Math.floor(radius * 10));
  game.fxA.burst(x, 0.4, z, n, { color, speed: 2.5 + radius * 2.2, life: 0.55, size: 0.55, gravity: 4, up: 0.9 });
  if (opts.color2) game.fxA.burst(x, 0.4, z, n / 2, { color: opts.color2, speed: 2 + radius * 1.5, life: 0.7, size: 0.4, gravity: 3, up: 1.2 });
  if (opts.smoke !== false) game.fxN.burst(x, 0.5, z, 6, { color: opts.smokeColor ?? 0x4a4a4a, speed: 1.2, life: 1.1, size: 0.9, size2: 1.8, gravity: -1.2, up: 0.6, alpha: 0.45, drag: 2 });
  game.addFx(new RingPulseFx(game, x, z, radius * 1.1, color, 0.4));
  game.addFx(new FlashFx(game, x, 0.8, z, color, radius * 2.4, 0.22));
}

// ---------- Şimşek ----------
const _camDir = new THREE.Vector3();
class LightningFx extends Fx {
  constructor(game, pts, color, width = 0.12, life = 0.2, jag = 0.35) {
    super(game);
    this.life = life;
    const path = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      const segs = Math.max(2, Math.ceil(len / 0.7));
      for (let k = 0; k < segs; k++) {
        const t = k / segs;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        if (k > 0) p.add(new THREE.Vector3(rand(-jag, jag), rand(-jag, jag), rand(-jag, jag)));
        path.push(p);
      }
    }
    path.push(pts[pts.length - 1].clone());
    game.camera.getWorldDirection(_camDir);
    this.core = this.add(this.ribbon(path, width, 0xffffff, 1));
    this.glow = this.add(this.ribbon(path, width * 4, color, 0.55));
  }
  ribbon(path, w, color, opacity) {
    const n = path.length;
    const pos = new Float32Array(n * 2 * 3);
    const dir = new THREE.Vector3(), side = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      dir.subVectors(b, a).normalize();
      side.crossVectors(dir, _camDir).normalize().multiplyScalar(w);
      const p = path[i];
      pos.set([p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z], i * 6);
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.userData.ownMat = true; m.userData.ownGeo = true;
    m.renderOrder = 15;
    m.frustumCulled = false;
    return m;
  }
  update(dt) {
    this.t += dt;
    const k = this.t / this.life;
    if (k >= 1) return false;
    const f = 1 - k;
    this.core.material.opacity = f;
    this.glow.material.opacity = 0.55 * f;
    return true;
  }
}

// ---------- Mermiler ----------
class Projectile {
  // o: { kind, x,y,z, target?, tx?, tz?, speed, arc?, dur?, arcH?, onHit(x,y,z,target) }
  constructor(game, o) {
    this.game = game;
    this.kind = o.kind;
    this.mesh = makeProjectileMesh(o.kind);
    this.pos = new THREE.Vector3(o.x, o.y, o.z);
    this.mesh.position.copy(this.pos);
    game.scene.add(this.mesh);
    this.target = o.target || null;
    this.speed = o.speed || 18;
    this.onHit = o.onHit;
    this.arc = !!o.arc;
    this.trailT = 0;
    if (this.arc) {
      this.sx = o.x; this.sy = o.y; this.sz = o.z;
      this.ex = o.tx; this.ez = o.tz;
      this.dur = o.dur || 0.6; this.arcH = o.arcH ?? 3; this.t = 0;
    } else if (this.target) {
      this.lx = this.target.x; this.ly = this.target.T.height * 0.55; this.lz = this.target.z;
    }
  }

  update(dt) {
    const p = this.pos;
    if (this.arc) {
      this.t += dt;
      const k = Math.min(1, this.t / this.dur);
      p.set(lerp(this.sx, this.ex, k), lerp(this.sy, 0.3, k) + this.arcH * 4 * k * (1 - k), lerp(this.sz, this.ez, k));
      this.mesh.position.copy(p);
      this.mesh.userData.core.rotation.x += dt * 8;
      if (k >= 1) { this.onHit(p.x, 0.3, p.z, null); return false; }
    } else {
      const tg = this.target;
      if (tg && !tg.dead) { this.lx = tg.x; this.ly = tg.T.height * 0.55; this.lz = tg.z; }
      const dx = this.lx - p.x, dy = this.ly - p.y, dz = this.lz - p.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const step = this.speed * dt;
      if (d <= step + 0.1) {
        p.set(this.lx, this.ly, this.lz);
        this.onHit(p.x, p.y, p.z, tg && !tg.dead ? tg : null);
        return false;
      }
      p.x += (dx / d) * step; p.y += (dy / d) * step; p.z += (dz / d) * step;
      this.mesh.position.copy(p);
      this.mesh.lookAt(this.lx, this.ly, this.lz);
    }
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.025;
      const P = FXMAT.proj[this.kind];
      this.game.fxA.emit({
        x: p.x + rand(-0.06, 0.06), y: p.y + rand(-0.06, 0.06), z: p.z + rand(-0.06, 0.06),
        vx: rand(-0.3, 0.3), vy: rand(0, 0.6), vz: rand(-0.3, 0.3),
        life: rand(0.2, 0.4), size: P.tsize * rand(0.8, 1.3), size2: 0, color: choice(P.trail), alpha: 0.85,
      });
    }
    return true;
  }

  dispose() { this.game.scene.remove(this.mesh); }
}
