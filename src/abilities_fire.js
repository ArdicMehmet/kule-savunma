'use strict';

const FIRE_COLORS = [0xff6a10, 0xffa030, 0xff3a00, 0xffd060];
let _meteorMat = null, _wingGeo = null;
function meteorMat() {
  if (!_meteorMat) _meteorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, emissive: 0xff4a00, emissiveIntensity: 0.7, flatShading: true });
  return _meteorMat;
}
function wingGeo() {
  if (!_wingGeo) {
    _wingGeo = new THREE.BufferGeometry();
    _wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, 0.35, 0, 0, -0.35, 1.8, 0.15, -0.55,
      0, 0, 0.35, 1.8, 0.15, -0.55, 1.25, 0.05, 0.25,
    ]), 3));
  }
  return _wingGeo;
}

function fireParticle(game, x, y, z, o = {}) {
  game.fxA.emit({
    x, y, z, vx: o.vx ?? rand(-0.4, 0.4), vy: o.vy ?? rand(1.2, 2.6), vz: o.vz ?? rand(-0.4, 0.4),
    life: o.life ?? rand(0.35, 0.6), size: o.size ?? rand(0.4, 0.65), size2: 0.05, color: choice(FIRE_COLORS), alpha: 0.9,
  });
}

// ---------------- Alev Çemberi ----------------
class FireRingFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p; this.tick = 0;
    this.ring = this.add(makeDecal(TEX.ring, 0xff6a10, 0));
    this.ring.position.set(x, 0.1, z); this.ring.scale.setScalar(p.radius);
    this.inner = this.add(makeDecal(TEX.soft, 0xff3a00, 0));
    this.inner.position.set(x, 0.09, z); this.inner.scale.setScalar(p.radius * 0.95);
  }
  update(dt) {
    this.t += dt;
    const p = this.p, g = this.game;
    if (this.t >= p.dur) return false;
    const a = Math.min(1, this.t / 0.2) * Math.min(1, (p.dur - this.t) / 0.4);
    this.ring.material.opacity = a * (0.85 + 0.15 * Math.sin(this.t * 12));
    this.inner.material.opacity = a * 0.3;
    const n = Math.ceil(dt * 70 * p.radius * a);
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2), r = p.radius * rand(0.82, 1.0);
      fireParticle(g, this.x + Math.cos(ang) * r, 0.15, this.z + Math.sin(ang) * r, { vy: rand(1.5, 3.2) });
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) {
        e.takeDamage(p.dps * 0.25, { src: this.tw });
        e.applyBurn(p.dps * 0.4 * this.tw.burnMult, 2, this.tw);
      }
    }
    return true;
  }
}

ABILITY_IMPL.fire_ring = {
  params(L, tw) {
    return { radius: 2.2 + 0.08 * (L - 1), dur: 3.5 + 0.6 * (L - 1), dps: 14 * tw.dmgMult * (1 + 0.3 * (L - 1)), cd: Math.max(3.5, 9 * Math.pow(0.92, L - 1)) };
  },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar/sn', fmt(p.dps)], ['Süre', sec(p.dur)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range, p.radius);
      if (!t) return false;
      const g = tw.game, pr = t.predict(0.45, {});
      g.addProjectile(new Projectile(g, {
        kind: 'fire', x: tw.x, y: tw.muzzleY, z: tw.z, tx: pr.x, tz: pr.z, arc: true, dur: 0.45, arcH: 2.5,
        onHit: (x, y, z) => { g.addFx(new FireRingFx(g, tw, x, z, p)); Sound.play('fire_whoosh'); },
      }));
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Alev Dalgası ----------------
class FireWaveFx extends Fx {
  constructor(game, tw, dx, dz, p) {
    super(game);
    this.tw = tw; this.dx = dx; this.dz = dz; this.p = p;
    this.front = 0.8; this.hit = new Set();
    this.ox = tw.x; this.oz = tw.z;
    const mat = new THREE.MeshBasicMaterial({ map: TEX.flame, color: 0xff6a10, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.wall = this.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1.8), mat));
    this.wall.userData.ownMat = true; this.wall.userData.ownGeo = true;
    this.wall.rotation.y = Math.atan2(dx, dz);
  }
  update(dt) {
    const p = this.p, g = this.game;
    const prev = this.front;
    this.front += p.speed * dt;
    if (this.front >= p.dist) return false;
    const w = p.width0 + this.front * 0.35;
    const cx = this.ox + this.dx * this.front, cz = this.oz + this.dz * this.front;
    this.wall.position.set(cx, 0.85, cz);
    this.wall.scale.set(w, 1 + 0.25 * Math.sin(this.front * 3), 1);
    this.wall.material.opacity = 0.9 * Math.min(1, (p.dist - this.front) / 2);
    for (let i = 0; i < 7; i++) {
      const s = rand(-w / 2, w / 2);
      fireParticle(g, cx - this.dz * s, rand(0.1, 0.7), cz + this.dx * s, { vx: this.dx * 4, vz: this.dz * 4, vy: rand(1.5, 3), life: 0.4 });
    }
    for (const e of g.enemiesInRadius(cx, cz, w / 2 + 1.5)) {
      if (this.hit.has(e)) continue;
      const rx = e.x - this.ox, rz = e.z - this.oz;
      const along = rx * this.dx + rz * this.dz;
      const across = Math.abs(-rx * this.dz + rz * this.dx);
      if (along >= prev - 0.7 && along <= this.front + 0.7 && across <= w / 2 + e.radius) {
        this.hit.add(e);
        e.takeDamage(p.dmg, { src: this.tw });
        e.applyBurn(p.dmg * 0.3 * this.tw.burnMult, 3, this.tw);
      }
    }
    return true;
  }
}

ABILITY_IMPL.fire_wave = {
  params(L, tw) { return { dmg: 32 * tw.dmgMult * (1 + 0.35 * (L - 1)), cd: 8, width0: 3, speed: 11, dist: tw.range + 4 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Mesafe', fmt(p.dist) + ' m'], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range);
      if (!t) return false;
      const l = Math.hypot(t.x - tw.x, t.z - tw.z) || 1;
      tw.game.addFx(new FireWaveFx(tw.game, tw, (t.x - tw.x) / l, (t.z - tw.z) / l, p));
      Sound.play('fire_whoosh', 1.3);
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Anka Kuşu ----------------
class PhoenixFx extends Fx {
  constructor(game, tw, dx, dz, p) {
    super(game);
    this.tw = tw; this.dx = dx; this.dz = dz; this.p = p;
    this.d = 0; this.fade = 0; this.hit = new Set();
    this.ox = tw.x; this.oz = tw.z;
    const ang = Math.atan2(dx, dz);
    const bird = new THREE.Group();
    const body = new THREE.Mesh(FXGEO.oct, MAT.glowAdd(0xffd060, 1));
    body.scale.set(0.35, 0.3, 1.0); body.userData.ownMat = true;
    this.wingL = new THREE.Mesh(wingGeo(), MAT.glowAdd(0xff7a20, 0.95));
    this.wingR = new THREE.Mesh(wingGeo(), MAT.glowAdd(0xff7a20, 0.95));
    this.wingL.userData.ownMat = this.wingR.userData.ownMat = true;
    this.wingL.scale.x = -1;
    const tail = new THREE.Mesh(FXGEO.cone, MAT.glowAdd(0xff4a00, 0.9));
    tail.userData.ownMat = true;
    tail.scale.set(0.35, 1.2, 0.35); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.9;
    bird.add(body, this.wingL, this.wingR, tail);
    bird.rotation.y = ang;
    bird.scale.setScalar(1.1 + p.halfWidth * 0.35);
    this.bird = this.add(bird);
    this.glow = this.add(makeGlow(0xff6a10, 4 + p.halfWidth * 1.5, 0.9));
    const beamMat = new THREE.MeshBasicMaterial({ map: TEX.soft, color: 0xff5a10, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.beam = this.add(new THREE.Mesh(FXGEO.plane, beamMat));
    this.beam.userData.ownMat = true;
    this.beam.rotation.order = 'YXZ';
    this.beam.rotation.set(-Math.PI / 2, ang, 0);
    this.beam.renderOrder = 5;
  }
  update(dt) {
    const p = this.p, g = this.game;
    this.t += dt;
    if (this.d < p.length) {
      const prev = this.d;
      this.d = Math.min(p.length, this.d + p.speed * dt);
      const x = this.ox + this.dx * this.d, z = this.oz + this.dz * this.d;
      this.bird.position.set(x, 1.4, z);
      this.glow.position.set(x, 1.4, z);
      const flap = Math.sin(this.t * 16) * 0.55;
      this.wingL.rotation.z = -flap; this.wingR.rotation.z = flap;
      this.beam.position.set(this.ox + this.dx * this.d / 2, 0.12, this.oz + this.dz * this.d / 2);
      this.beam.scale.set(p.halfWidth, Math.max(0.01, this.d / 2), 1);
      for (let i = 0; i < 10; i++) {
        const s = rand(-p.halfWidth, p.halfWidth), back = rand(0, 1.2);
        fireParticle(g, x - this.dz * s - this.dx * back, rand(0.4, 1.8), z + this.dx * s - this.dz * back, { vx: -this.dx * 2, vz: -this.dz * 2, vy: rand(0.5, 2), life: rand(0.3, 0.6) });
      }
      const ax = this.ox + this.dx * prev, az = this.oz + this.dz * prev;
      const mx = (ax + x) / 2, mz = (az + z) / 2;
      for (const e of g.enemiesInRadius(mx, mz, (this.d - prev) / 2 + p.halfWidth + 0.8)) {
        if (this.hit.has(e)) continue;
        const r = p.halfWidth + e.radius;
        if (segDist2(e.x, e.z, ax, az, x, z) <= r * r) {
          this.hit.add(e);
          e.takeDamage(p.dmg, { src: this.tw });
          e.applyBurn(p.dmg * 0.25 * this.tw.burnMult, 3, this.tw);
          g.fxA.burst(e.x, 1, e.z, 6, { color: 0xffa030, speed: 3, life: 0.4, size: 0.4 });
        }
      }
      return true;
    }
    this.fade += dt;
    const k = this.fade / 0.5;
    if (k >= 1) return false;
    this.beam.material.opacity = 0.5 * (1 - k);
    this.glow.material.opacity = 0.9 * (1 - k);
    this.bird.scale.setScalar((1.1 + p.halfWidth * 0.35) * (1 - k));
    return true;
  }
}

ABILITY_IMPL.phoenix = {
  params(L, tw) { return { dmg: 60 * tw.dmgMult * (1 + 0.35 * (L - 1)), halfWidth: Math.min(3.5, 1.1 + 0.25 * (L - 1)), cd: 10, length: 28, speed: 20 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Genişlik', fmt(p.halfWidth * 2) + ' m'], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range + 2);
      if (!t) return false;
      const l = Math.hypot(t.x - tw.x, t.z - tw.z) || 1;
      tw.game.addFx(new PhoenixFx(tw.game, tw, (t.x - tw.x) / l, (t.z - tw.z) / l, p));
      Sound.play('phoenix');
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Meteor Yağmuru ----------------
class MeteorFx extends Fx {
  constructor(game, tw, x, z, delay, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.delay = delay; this.fall = 0.6; this.p = p;
    this.warn = this.add(makeDecal(TEX.ring, 0xff3a00, 0));
    this.warn.position.set(x, 0.1, z); this.warn.scale.setScalar(p.radius);
    this.rock = this.add(new THREE.Mesh(FXGEO.ico0, meteorMat()));
    this.rock.scale.setScalar(0.55);
    this.rock.visible = false;
    this.glow = this.add(makeGlow(0xff5a10, 2.6));
    this.glow.visible = false;
    this.sx = x + 7; this.sy = 22; this.sz = z - 6;
  }
  update(dt) {
    this.t += dt;
    const g = this.game, p = this.p;
    if (this.t < this.delay) { this.warn.material.opacity = 0.5 * (this.t / this.delay); return true; }
    const k = (this.t - this.delay) / this.fall;
    this.warn.material.opacity = 0.55 + 0.3 * Math.sin(this.t * 20);
    if (k < 1) {
      this.rock.visible = this.glow.visible = true;
      const x = lerp(this.sx, this.x, k), y = lerp(this.sy, 0.3, k), z = lerp(this.sz, this.z, k);
      this.rock.position.set(x, y, z); this.glow.position.set(x, y, z);
      this.rock.rotation.x += dt * 6; this.rock.rotation.z += dt * 4;
      for (let i = 0; i < 4; i++) fireParticle(g, x + rand(-0.3, 0.3), y + rand(-0.3, 0.3), z + rand(-0.3, 0.3), { vx: 0, vy: rand(0, 1), vz: 0, size: rand(0.5, 0.9), life: 0.45 });
      g.fxN.emit({ x, y, z, vy: 0.5, life: 0.9, size: 0.6, size2: 1.4, color: 0x3a3a3a, alpha: 0.45 });
      return true;
    }
    for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) {
      e.takeDamage(p.dmg, { src: this.tw });
      e.applyBurn(p.dmg * 0.3 * this.tw.burnMult, 3, this.tw);
    }
    fxExplosion(g, this.x, this.z, p.radius, 0xff6a10, { color2: 0xffd040 });
    g.addFx(new ScorchFx(g, this.x, this.z, p.radius * 1.1, 0x140a04, 3));
    Sound.play('explosion', 0.8);
    g.shake(0.12);
    return false;
  }
}

ABILITY_IMPL.meteor = {
  params(L, tw) { return { dmg: 42 * tw.dmgMult * (1 + 0.25 * (L - 1)), count: Math.min(12, 3 + (L - 1)), cd: 12, radius: 1.8, area: 3.2 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Meteor', p.count + ' adet'], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range + 1, p.area);
      if (!t) return false;
      const c = t.predict(0.9, {});
      for (let i = 0; i < p.count; i++) {
        let x = c.x, z = c.z;
        if (i > 0) { const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.area; x += Math.cos(a) * r; z += Math.sin(a) * r; }
        tw.game.addFx(new MeteorFx(tw.game, tw, x, z, 0.15 + i * 0.16, p));
      }
      Sound.play('meteor_fall');
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Lav Fırlatma ----------------
ABILITY_IMPL.lava = {
  params(L, tw) { return { dmg: 1.25 * tw.damage, targets: Math.min(10, 2 + (L - 1)), cd: Math.max(2, 7 * Math.pow(0.88, L - 1)) }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Hedef', p.targets + ' düşman'], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const list = tw.enemiesInRange(tw.range).sort((a, b) => a.remaining - b.remaining).slice(0, p.targets);
      if (!list.length) return false;
      const g = tw.game;
      list.forEach((e, i) => {
        const pr = e.predict(0.55 + i * 0.04, {});
        g.addProjectile(new Projectile(g, {
          kind: 'lava', x: tw.x + rand(-0.3, 0.3), y: tw.muzzleY, z: tw.z + rand(-0.3, 0.3), tx: pr.x, tz: pr.z,
          arc: true, dur: 0.55 + i * 0.04, arcH: 3.2,
          onHit: (x, y, z) => {
            for (const en of g.enemiesInRadius(x, z, 1.1)) {
              en.takeDamage(p.dmg, { src: tw });
              en.applyBurn(p.dmg * 0.5 * tw.burnMult, 3, tw);
            }
            g.fxA.burst(x, 0.3, z, 14, { color: 0xff5a10, speed: 3.5, life: 0.5, size: 0.4, gravity: 9, up: 1.2 });
            g.addFx(new ScorchFx(g, x, z, 0.9, 0xff4a00, 1.5, true, 0.6));
            Sound.play('splash', 0.8);
          },
        }));
      });
      Sound.play('fire_shot', 1.4);
      tw.castAnim();
      return true;
    });
  },
};
