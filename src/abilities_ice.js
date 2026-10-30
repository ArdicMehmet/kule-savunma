'use strict';

const ICE_COLORS = [0xbff0ff, 0x7fd8ff, 0xffffff];
let _sawGeo = null, _sawMat = null, _snowMat = null;
function sawAssets() {
  if (!_sawGeo) {
    const parts = [P(G.cyl(0.7, 0.7, 0.08, 16), 0xd8f6ff, [0, 0, 0])];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(P(G.cone(0.16, 0.45, 4), 0xeefcff, [Math.cos(a) * 0.82, 0, Math.sin(a) * 0.82], [0, -a, -Math.PI / 2]));
    }
    _sawGeo = mergeParts(parts);
    _sawMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x3fb8ff, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.92 });
  }
  return { geo: _sawGeo, mat: _sawMat };
}
function snowMat() {
  if (!_snowMat) _snowMat = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.9, flatShading: true, emissive: 0x9fd8ff, emissiveIntensity: 0.15 });
  return _snowMat;
}
function iceSparkle(game, x, y, z, o = {}) {
  game.fxA.emit({
    x, y, z, vx: o.vx ?? rand(-0.6, 0.6), vy: o.vy ?? rand(0.2, 1.5), vz: o.vz ?? rand(-0.6, 0.6),
    life: o.life ?? rand(0.3, 0.6), size: o.size ?? rand(0.15, 0.3), size2: 0, color: choice(ICE_COLORS), alpha: 0.95,
  });
}

// ---------------- Buz Yolu ----------------
class IcePathFx extends Fx {
  constructor(game, tw, enemy, p) {
    super(game);
    this.tw = tw; this.p = p; this.path = enemy.path;
    const center = enemy.dist + 0.8;
    this.d0 = Math.max(0, center - p.len / 2);
    this.d1 = Math.min(this.path.length, center + p.len / 2);
    const steps = Math.max(2, Math.ceil((this.d1 - this.d0) / 0.5));
    const hw = p.width / 2;
    const pos = new Float32Array((steps + 1) * 2 * 3), uv = new Float32Array((steps + 1) * 2 * 2);
    const s = {};
    for (let i = 0; i <= steps; i++) {
      this.path.sample(this.d0 + (this.d1 - this.d0) * (i / steps), s);
      const nx = -s.tz, nz = s.tx;
      pos.set([s.x + nx * hw, 0.11, s.z + nz * hw, s.x - nx * hw, 0.11, s.z - nz * hw], i * 6);
      uv.set([0, i / steps, 1, i / steps], i * 4);
    }
    const idx = [];
    for (let i = 0; i < steps; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mesh = this.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: TEX.ice, color: 0xd8f6ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
    this.mesh.userData.ownMat = true; this.mesh.userData.ownGeo = true;
    this.mesh.renderOrder = 6;
    this.smp = {};
  }
  update(dt) {
    this.t += dt;
    const p = this.p, g = this.game;
    if (this.t >= p.dur) return false;
    this.mesh.material.opacity = Math.min(1, this.t / 0.3) * Math.min(1, (p.dur - this.t) / 0.6) * 0.9;
    if (Math.random() < dt * 25) {
      this.path.sample(rand(this.d0, this.d1), this.smp);
      const l = rand(-p.width / 2, p.width / 2);
      iceSparkle(g, this.smp.x - this.smp.tz * l, 0.2, this.smp.z + this.smp.tx * l, { vy: rand(0.3, 1) });
    }
    const hw = p.width / 2 + 0.3;
    for (const e of g.enemies) {
      if (e.dead || e.path !== this.path) continue;
      if (e.dist >= this.d0 && e.dist <= this.d1 && Math.abs(e.lateral) <= hw) e.applySlow(p.slow, 0.3);
    }
    return true;
  }
}

ABILITY_IMPL.ice_path = {
  params(L, tw) {
    return { len: 6 * (1 + 0.12 * (L - 1)), width: 3.4 * (1 + 0.08 * (L - 1)), slow: Math.min(0.85, 0.35 + 0.06 * (L - 1) + tw.slowBonus), dur: 6, cd: Math.max(4, 11 * Math.pow(0.92, L - 1)) };
  },
  stats(L, tw) { const p = this.params(L, tw); return [['Yavaşlatma', pct(p.slow)], ['Uzunluk', fmt(p.len) + ' m'], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range);
      if (!t) return false;
      tw.game.addFx(new IcePathFx(tw.game, tw, t, p));
      Sound.play('freeze', 0.7);
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Buz Dikenleri ----------------
class IceSpikesFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p;
    this.warnT = 0.3; this.erupted = false;
    this.hold = Math.max(1.2, p.root);
    this.warn = this.add(makeDecal(TEX.ring, 0x7fd8ff, 0));
    this.warn.position.set(x, 0.1, z); this.warn.scale.setScalar(p.radius);
    this.spikes = [];
    const count = Math.round(6 + p.radius * 5);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(FXGEO.spike, FXMAT.spike);
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius * 0.95;
      m.position.set(x + Math.cos(a) * r, -0.05, z + Math.sin(a) * r);
      m.rotation.set(rand(-0.35, 0.35), rand(0, 6), rand(-0.35, 0.35));
      m.userData.s = rand(0.6, 1.2) * (1 + p.radius * 0.1);
      m.scale.setScalar(0.001);
      m.castShadow = true;
      this.add(m); this.spikes.push(m);
    }
  }
  update(dt) {
    this.t += dt;
    const g = this.game, p = this.p;
    if (!this.erupted) {
      this.warn.material.opacity = (this.t / this.warnT) * 0.8;
      if (Math.random() < dt * 30) iceSparkle(g, this.x + rand(-p.radius, p.radius) * 0.7, 0.1, this.z + rand(-p.radius, p.radius) * 0.7);
      if (this.t >= this.warnT) {
        this.erupted = true;
        for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) {
          e.takeDamage(p.dmg, { src: this.tw });
          e.applyRoot(p.root);
        }
        g.fxA.burst(this.x, 0.4, this.z, 26, { color: 0xbff0ff, speed: 4 + p.radius, life: 0.6, size: 0.35, gravity: 6, up: 1 });
        Sound.play('freeze');
        g.shake(0.05);
      }
      return true;
    }
    const k = this.t - this.warnT;
    const grow = Math.min(1, k / 0.12);
    const shrink = k > this.hold ? Math.max(0, 1 - (k - this.hold) / 0.3) : 1;
    for (const m of this.spikes) {
      const s = m.userData.s * grow * shrink;
      m.scale.set(s * 0.9, s, s * 0.9);
    }
    this.warn.material.opacity = 0.8 * shrink;
    return k < this.hold + 0.3;
  }
}

ABILITY_IMPL.ice_spikes = {
  params(L, tw) { return { radius: Math.min(4.5, 1.8 + 0.25 * (L - 1)), dmg: 30 * tw.dmgMult * (1 + 0.3 * (L - 1)), root: 1.2, cd: 9 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Alan', fmt(p.radius) + ' m'], ['Sabitleme', sec(p.root)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range, p.radius);
      if (!t) return false;
      const c = t.predict(0.3, {});
      tw.game.addFx(new IceSpikesFx(tw.game, tw, c.x, c.z, p));
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Buz Testere ----------------
class IceSawFx extends Fx {
  constructor(game, tw, dx, dz, p) {
    super(game);
    this.tw = tw; this.dx = dx; this.dz = dz; this.p = p;
    this.d = 0; this.hit = new Set(); this.ox = tw.x; this.oz = tw.z;
    const a = sawAssets();
    this.saw = this.add(new THREE.Mesh(a.geo, a.mat));
    this.saw.castShadow = true;
    this.glow = this.add(makeGlow(0x5fd0ff, 2.2, 0.8));
  }
  update(dt) {
    const p = this.p, g = this.game;
    const prev = this.d;
    this.d += p.speed * dt;
    const x = this.ox + this.dx * this.d, z = this.oz + this.dz * this.d;
    if (this.d >= p.dist) {
      g.fxA.burst(x, 0.7, z, 16, { color: 0xbff0ff, speed: 3, life: 0.5, size: 0.3 });
      return false;
    }
    this.saw.position.set(x, 0.75, z);
    this.saw.rotation.y += dt * 22;
    this.glow.position.set(x, 0.75, z);
    iceSparkle(g, x + rand(-0.4, 0.4), 0.5, z + rand(-0.4, 0.4), { vy: rand(0, 0.6) });
    const ax = this.ox + this.dx * prev, az = this.oz + this.dz * prev;
    for (const e of g.enemiesInRadius(x, z, p.radius + p.speed * dt + 0.8)) {
      if (this.hit.has(e)) continue;
      const r = p.radius + e.radius;
      if (segDist2(e.x, e.z, ax, az, x, z) <= r * r) {
        this.hit.add(e);
        e.takeDamage(p.dmg, { src: this.tw });
        e.applySlow(p.slow, p.slowDur);
        g.fxA.burst(e.x, 0.8, e.z, 6, { color: 0xbff0ff, speed: 2.5, life: 0.35, size: 0.25 });
      }
    }
    return true;
  }
}

ABILITY_IMPL.ice_saw = {
  params(L, tw) {
    return { dmg: 12 * tw.dmgMult * (1 + 0.25 * (L - 1)), slow: Math.min(0.85, 0.45 + 0.05 * (L - 1) + tw.slowBonus), slowDur: 2.5, cd: 6, dist: tw.range + 6, radius: 0.9, speed: 12 };
  },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Yavaşlatma', pct(p.slow)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range);
      if (!t) return false;
      const l = Math.hypot(t.x - tw.x, t.z - tw.z) || 1;
      tw.game.addFx(new IceSawFx(tw.game, tw, (t.x - tw.x) / l, (t.z - tw.z) / l, p));
      Sound.play('saw');
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Çığ ----------------
const _rollAxis = new THREE.Vector3();
class SnowballFx extends Fx {
  constructor(game, tw, dx, dz, p) {
    super(game);
    this.tw = tw; this.dx = dx; this.dz = dz; this.p = p;
    this.d = 0; this.hit = new Set(); this.hits = 0; this.r = p.r0;
    this.ox = tw.x; this.oz = tw.z;
    this.ball = this.add(new THREE.Mesh(FXGEO.sph, snowMat()));
    this.ball.castShadow = true;
    this.ball.scale.setScalar(this.r);
    _rollAxis.set(dz, 0, -dx);
    this.axis = _rollAxis.clone();
  }
  update(dt) {
    const p = this.p, g = this.game;
    const prev = this.d;
    this.d += p.speed * dt;
    const x = this.ox + this.dx * this.d, z = this.oz + this.dz * this.d;
    if (this.d >= p.dist) {
      g.fxN.burst(x, this.r, z, 30, { color: 0xffffff, speed: 4 + this.r * 2, life: 0.8, size: 0.5, gravity: 7, up: 1 });
      g.fxA.burst(x, this.r, z, 14, { color: 0xbff0ff, speed: 3, life: 0.5, size: 0.4 });
      Sound.play('snowball');
      return false;
    }
    this.ball.position.set(x, this.r, z);
    this.ball.rotateOnWorldAxis(this.axis, (p.speed * dt) / this.r);
    this.ball.scale.setScalar(this.r);
    if (Math.random() < 0.7) g.fxN.emit({ x: x + rand(-this.r, this.r) * 0.6, y: 0.1, z: z + rand(-this.r, this.r) * 0.6, vy: rand(0.5, 1.5), life: 0.6, size: 0.3, size2: 0.1, color: 0xffffff, alpha: 0.8, gravity: 3 });
    const ax = this.ox + this.dx * prev, az = this.oz + this.dz * prev;
    for (const e of g.enemiesInRadius(x, z, this.r + p.speed * dt + 1)) {
      if (this.hit.has(e)) continue;
      const r = this.r + e.radius;
      if (segDist2(e.x, e.z, ax, az, x, z) <= r * r) {
        this.hit.add(e);
        this.hits++;
        e.takeDamage(p.dmg * (1 + 0.1 * this.hits), { src: this.tw });
        e.knockback(p.knock);
        e.applyRoot(p.root);
        e.applySlow(p.slow, p.root + 2.5);
        this.r = Math.min(2.8, this.r + 0.12);
        g.fxN.burst(e.x, 0.8, e.z, 10, { color: 0xffffff, speed: 3, life: 0.5, size: 0.35, gravity: 6 });
        Sound.play('snowball', 0.7);
      }
    }
    return true;
  }
}

ABILITY_IMPL.avalanche = {
  params(L, tw) {
    return { r0: Math.min(2.2, 0.8 * (1 + 0.15 * (L - 1))), dmg: 40 * tw.dmgMult * (1 + 0.3 * (L - 1)), knock: 2.5, root: 1.0, slow: Math.min(0.85, 0.4 + tw.slowBonus), cd: 12, dist: 26, speed: 9 };
  },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Boyut', fmt(p.r0 * 2) + ' m'], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range + 1);
      if (!t) return false;
      const l = Math.hypot(t.x - tw.x, t.z - tw.z) || 1;
      tw.game.addFx(new SnowballFx(tw.game, tw, (t.x - tw.x) / l, (t.z - tw.z) / l, p));
      Sound.play('whoosh');
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Kraliçenin Gözyaşları (pasif) ----------------
class SnowAuraFx extends Fx {
  constructor(game, tw) {
    super(game);
    this.tw = tw; this.tick = 0.5; this.acc = 0;
    this.decal = this.add(makeDecal(TEX.soft, 0x9fdcff, 0.1));
    this.decal.position.set(tw.x, 0.08, tw.z);
    this.ring = this.add(makeDecal(TEX.ring, 0xbfe8ff, 0.22));
    this.ring.position.set(tw.x, 0.09, tw.z);
  }
  update(dt) {
    const tw = this.tw, g = this.game;
    if (tw.removed || !tw.abilities.queen_tears) return false;
    this.t += dt;
    const p = ABILITY_IMPL.queen_tears.params(tw.abilities.queen_tears.level, tw);
    this.decal.scale.setScalar(p.radius);
    this.ring.scale.setScalar(p.radius);
    this.ring.material.opacity = 0.18 + Math.sin(this.t * 2) * 0.05;
    this.acc += dt * p.radius * p.radius * 0.45;
    while (this.acc >= 1) {
      this.acc -= 1;
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius;
      const y = rand(5, 8), vy = rand(1.4, 2.2);
      g.fxN.emit({ x: tw.x + Math.cos(a) * r, y, z: tw.z + Math.sin(a) * r, vx: rand(-0.3, 0.3), vy: -vy, vz: rand(-0.3, 0.3), life: y / vy, size: rand(0.12, 0.2), size2: 0.1, color: 0xffffff, alpha: 0.95, alpha2: 0.6 });
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 1;
      for (const e of g.enemiesInRadius(tw.x, tw.z, p.radius)) {
        e.takeDamage(p.dmg, { src: tw });
        e.applySlow(p.slow, 1.2);
      }
    }
    return true;
  }
}

ABILITY_IMPL.queen_tears = {
  params(L, tw) { return { dmg: 8 * tw.dmgMult * (1 + 0.4 * (L - 1)), radius: tw.range + 3, slow: Math.min(0.6, 0.15 + tw.slowBonus * 0.5) }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar/sn', fmt(p.dmg)], ['Alan', fmt(p.radius) + ' m'], ['Yavaşlatma', pct(p.slow)]]; },
  onAcquire(tw) { tw.game.addFx(new SnowAuraFx(tw.game, tw)); },
  update() {},
};
