'use strict';

const STORM_COLORS = [0xd8c8ff, 0xb48cff, 0x8cc8ff, 0xffffff];

class DelayFx extends Fx {
  constructor(game, delay, fn) { super(game); this.delay = delay; this.fn = fn; }
  update(dt) {
    this.t += dt;
    if (this.t >= this.delay) { this.fn(); return false; }
    return true;
  }
}

function sparkBurst(game, x, y, z, n = 8) {
  game.fxA.burst(x, y, z, n, { color: choice(STORM_COLORS), speed: 5, life: 0.3, size: 0.25, gravity: 2, up: 0.6 });
}

// ---------------- Hortum ----------------
class TornadoFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.p = p; this.tick = 0;
    this.sx = tw.x; this.sz = tw.z; this.tx = x; this.tz = z; this.x = tw.x; this.z = tw.z;
    this.travel = 0.4;
    this.group = this.add(new THREE.Group());
    this.layers = [];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.CylinderGeometry(0.6 + i * 0.55, 0.25 + i * 0.45, 1.5, 16, 1, true);
      const mat = new THREE.MeshBasicMaterial({ map: TEX.wind, color: 0xdfe4ee, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const m = new THREE.Mesh(geo, mat);
      m.userData.ownMat = m.userData.ownGeo = true;
      m.position.y = 0.75 + i * 1.3;
      this.group.add(m);
      this.layers.push(m);
    }
    this.dust = this.add(makeDecal(TEX.ring, 0xb0a58a, 0.5, false));
    this.vx = rand(-0.6, 0.6); this.vz = rand(-0.6, 0.6);
  }
  update(dt) {
    this.t += dt;
    const p = this.p, g = this.game;
    const life = this.travel + p.dur;
    if (this.t >= life) return false;
    if (this.t < this.travel) {
      const k = this.t / this.travel;
      this.x = lerp(this.sx, this.tx, k); this.z = lerp(this.sz, this.tz, k);
    } else {
      this.x += this.vx * dt; this.z += this.vz * dt;
    }
    const a = Math.min(1, this.t / 0.3) * Math.min(1, (life - this.t) / 0.5);
    this.group.position.set(this.x, 0, this.z);
    this.group.scale.setScalar(0.4 + 0.6 * a);
    this.dust.position.set(this.x, 0.08, this.z);
    this.dust.scale.setScalar(p.radius * (0.9 + 0.1 * Math.sin(this.t * 8)));
    this.dust.material.opacity = 0.45 * a;
    this.layers.forEach((m, i) => {
      m.rotation.y += dt * (7 - i);
      m.material.opacity = 0.55 * a;
      m.position.x = Math.sin(this.t * 3 + i) * 0.15 * i;
    });
    if (Math.random() < 0.8) {
      const ang = rand(0, Math.PI * 2), r = rand(0.5, p.radius), y = rand(0.2, 4);
      g.fxN.emit({ x: this.x + Math.cos(ang) * r, y, z: this.z + Math.sin(ang) * r, vx: -Math.sin(ang) * 6, vy: rand(1, 3), vz: Math.cos(ang) * 6, life: 0.5, size: rand(0.12, 0.25), size2: 0.05, color: choice([0x8a7a5a, 0x6a6a6a, 0x5a7a3a]), alpha: 0.9, drag: 1 });
    }
    if (this.t < this.travel) return true;
    const list = g.enemiesInRadius(this.x, this.z, p.radius);
    for (const e of list) e.pull(this.x, this.z, dt, 4);
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      for (const e of list) e.takeDamage(p.dps * 0.25, { src: this.tw });
    }
    return true;
  }
}

ABILITY_IMPL.tornado = {
  params(L, tw) { return { radius: 3.0, dur: 3 + 0.6 * (L - 1), dps: 12 * tw.dmgMult * (1 + 0.3 * (L - 1)), cd: 10 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar/sn', fmt(p.dps)], ['Süre', sec(p.dur)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range + 1, p.radius);
      if (!t) return false;
      const c = t.predict(0.4, {});
      tw.game.addFx(new TornadoFx(tw.game, tw, c.x, c.z, p));
      Sound.play('wind');
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Aşırı Yükleme ----------------
ABILITY_IMPL.overload = {
  params(L) { return { bonus: 0.6 + 0.15 * (L - 1), dur: 4 + 0.8 * (L - 1), cd: 14 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Saldırı hızı', '+' + pct(p.bonus)], ['Süre', sec(p.dur)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    const g = tw.game;
    abilityTick(ab, dt, p.cd, () => {
      if (!tw.firstTarget(tw.range)) return false;
      tw.overloadT = p.dur;
      tw.overloadBonus = p.bonus;
      Sound.play('charge');
      g.addFx(new RingPulseFx(g, tw.x, tw.z, 3.5, 0xb48cff, 0.5));
      tw.castAnim();
      return true;
    });
    if (tw.overloadT > 0 && Math.random() < dt * 25) {
      const a = rand(0, Math.PI * 2);
      g.fxA.emit({ x: tw.x + Math.cos(a) * 0.7, y: tw.muzzleY + rand(-0.4, 0.4), z: tw.z + Math.sin(a) * 0.7, vx: Math.cos(a) * 3, vy: rand(-1, 2), vz: Math.sin(a) * 3, life: 0.25, size: 0.25, size2: 0, color: choice(STORM_COLORS) });
    }
  },
};

// ---------------- Rüzgar Duvarı ----------------
class WindWallFx extends Fx {
  constructor(game, tw, enemy, p) {
    super(game);
    this.tw = tw; this.p = p;
    const s = enemy.path.sample(Math.min(enemy.path.length, enemy.dist + 1.2), {});
    this.wx = s.x; this.wz = s.z; this.tx = s.tx; this.tz = s.tz;
    this.sx = tw.x; this.sz = tw.z;
    this.travel = 0.35; this.on = false;
    this.group = this.add(new THREE.Group());
    this.group.rotation.y = Math.atan2(s.tx, s.tz);
    this.planes = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.halfWidth * 2, 3), new THREE.MeshBasicMaterial({
        map: TEX.wind, color: 0x9fc8ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      m.userData.ownMat = m.userData.ownGeo = true;
      m.position.set(0, 1.5, (i - 1) * 0.6);
      this.group.add(m);
      this.planes.push(m);
    }
  }
  update(dt) {
    this.t += dt;
    const p = this.p, g = this.game;
    if (!this.on) {
      const k = Math.min(1, this.t / this.travel);
      this.group.position.set(lerp(this.sx, this.wx, k), 0, lerp(this.sz, this.wz, k));
      if (k >= 1) { this.on = true; Sound.play('wind'); }
      return true;
    }
    const tt = this.t - this.travel;
    if (tt >= p.dur) return false;
    const a = Math.min(1, tt / 0.2) * Math.min(1, (p.dur - tt) / 0.4);
    this.planes.forEach((m, i) => {
      m.material.opacity = a * (0.4 + 0.15 * Math.sin(this.t * 10 + i * 2));
      m.position.z = (i - 1) * 0.6 + Math.sin(this.t * 6 + i) * 0.15;
    });
    const nx = -this.tz, nz = this.tx;
    for (let i = 0; i < 3; i++) {
      const across = rand(-p.halfWidth, p.halfWidth);
      g.fxA.emit({
        x: this.wx + nx * across, y: rand(0.2, 2.6), z: this.wz + nz * across,
        vx: -this.tx * rand(6, 10), vy: 0, vz: -this.tz * rand(6, 10),
        life: 0.45, size: rand(0.15, 0.3), size2: 0.05, color: 0xcfe6ff, alpha: 0.6 * a,
      });
    }
    for (const e of g.enemiesInRadius(this.wx, this.wz, p.halfWidth + 4.5)) {
      const rx = e.x - this.wx, rz = e.z - this.wz;
      const along = rx * this.tx + rz * this.tz;
      const acr = Math.abs(rx * nx + rz * nz);
      if (along >= -4 && along <= 1.2 && acr <= p.halfWidth + e.radius) e.pushBack(p.push * dt);
    }
    return true;
  }
}

ABILITY_IMPL.wind_wall = {
  params(L) { return { dur: 3 + 0.6 * (L - 1), push: 3.5 + 0.6 * (L - 1), cd: 12, halfWidth: 3.2 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['İtme', fmt(p.push) + ' m/sn'], ['Süre', sec(p.dur)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range);
      if (!t) return false;
      tw.game.addFx(new WindWallFx(tw.game, tw, t, p));
      Sound.play('whoosh');
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Thor'un Gazabı (pasif) ----------------
function thorStrike(game, tw, e, p) {
  const x = e.x, z = e.z;
  const top = new THREE.Vector3(x + rand(-3, 3), 24, z + rand(-3, 3));
  game.addFx(new LightningFx(game, [top, new THREE.Vector3(x, 0.2, z)], 0xb8a0ff, 0.22, 0.35, 1.3));
  game.addFx(new FlashFx(game, x, 1.2, z, 0xc8b0ff, 6, 0.3));
  game.addFx(new RingPulseFx(game, x, z, p.radius * 1.8, 0xb48cff, 0.4));
  game.addFx(new ScorchFx(game, x, z, 1.2, 0x0c0c18, 2));
  sparkBurst(game, x, 0.4, z, 18);
  for (const en of game.enemiesInRadius(x, z, p.radius)) en.takeDamage(p.dmg, { src: tw });
  game.shake(0.1);
}

ABILITY_IMPL.thor = {
  params(L, tw) { return { dmg: 70 * tw.dmgMult * (1 + 0.3 * (L - 1)), count: Math.min(10, 2 + (L - 1)), interval: 4.5, radius: 1.3, area: tw.range * 2 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Şimşek', p.count + ' adet'], ['Aralık', sec(p.interval)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.interval, () => {
      const list = shuffle(tw.enemiesInRange(p.area));
      if (!list.length) return false;
      const g = tw.game;
      for (let i = 0; i < p.count; i++) {
        const e = list[i % list.length];
        g.addFx(new DelayFx(g, i * 0.12, () => thorStrike(g, tw, e, p)));
      }
      Sound.play('thunder');
      return true;
    });
  },
};

// ---------------- Yıldırım Hapsi ----------------
class PrisonFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p; this.tick = 0; this.arcT = 0;
    const geo = new THREE.SphereGeometry(p.radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    this.wire = this.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xa88cff, wireframe: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    this.wire.userData.ownMat = true; this.wire.userData.ownGeo = true;
    this.shell = this.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x5a3aff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
    this.shell.userData.ownMat = true;
    this.wire.position.set(x, 0, z); this.shell.position.set(x, 0, z);
    this.ring = this.add(makeDecal(TEX.ring, 0xb48cff, 0.9));
    this.ring.position.set(x, 0.1, z); this.ring.scale.setScalar(p.radius);
  }
  update(dt) {
    this.t += dt;
    const p = this.p, g = this.game;
    if (this.t >= p.dur) return false;
    const a = Math.min(1, this.t / 0.2) * Math.min(1, (p.dur - this.t) / 0.3);
    const s = 0.3 + 0.7 * Math.min(1, this.t / 0.2);
    this.wire.scale.setScalar(s); this.shell.scale.setScalar(s);
    this.wire.rotation.y += dt * 1.5;
    this.wire.material.opacity = 0.6 * a * (0.8 + 0.2 * Math.sin(this.t * 25));
    this.shell.material.opacity = 0.18 * a;
    this.ring.material.opacity = 0.9 * a;
    const list = g.enemiesInRadius(this.x, this.z, p.radius);
    for (const e of list) e.applyRoot(0.15);
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      for (const e of list) e.takeDamage(p.dps * 0.25, { src: this.tw });
    }
    this.arcT -= dt;
    if (this.arcT <= 0) {
      this.arcT = 0.09;
      const r = p.radius * 0.9;
      const a1 = rand(0, Math.PI * 2), a2 = a1 + rand(1, 3);
      const from = new THREE.Vector3(this.x + Math.cos(a1) * r, rand(0.2, 1.5), this.z + Math.sin(a1) * r);
      const victim = list.length && Math.random() < 0.6 ? choice(list) : null;
      const to = victim
        ? new THREE.Vector3(victim.x, 0.8, victim.z)
        : new THREE.Vector3(this.x + Math.cos(a2) * r, rand(0.2, 1.5), this.z + Math.sin(a2) * r);
      g.addFx(new LightningFx(g, [from, to], 0x9a7aff, 0.05, 0.12, 0.3));
    }
    return true;
  }
}

ABILITY_IMPL.prison = {
  params(L, tw) { return { radius: 2.4, dur: 3.5, dps: 16 * tw.dmgMult * (1 + 0.35 * (L - 1)), cd: 13 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar/sn', fmt(p.dps)], ['Hapis süresi', sec(p.dur)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range, p.radius);
      if (!t) return false;
      const c = t.predict(0.15, {});
      const g = tw.game;
      g.addFx(new LightningFx(g, [new THREE.Vector3(tw.x, tw.muzzleY, tw.z), new THREE.Vector3(c.x, 1, c.z)], 0xb48cff, 0.1, 0.25, 0.5));
      g.addFx(new PrisonFx(g, tw, c.x, c.z, p));
      Sound.play('charge', 0.7);
      Sound.play('zap', 1.3);
      tw.castAnim();
      return true;
    });
  },
};
