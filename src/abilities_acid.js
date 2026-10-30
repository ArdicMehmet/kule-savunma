'use strict';

const ACID_COLORS = [0x7dff3a, 0x9cff5a, 0x5acc2a];
const poisonDps = (tw) => 2.2 * tw.dmgMult;

function acidSplash(game, x, z, radius) {
  game.fxA.burst(x, 0.3, z, 10 + Math.floor(radius * 6), { color: 0x8cff4a, speed: 2 + radius * 1.5, life: 0.5, size: 0.35, gravity: 8, up: 1.2 });
  game.addFx(new ScorchFx(game, x, z, radius, 0x6aff2a, 1.6, true, 0.35));
}

// ---------------- Zehir Bulutu ----------------
class PoisonCloudFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p; this.tick = 0;
    this.decal = this.add(makeDecal(TEX.soft, 0x3a8a1a, 0, false));
    this.decal.position.set(x, 0.08, z); this.decal.scale.setScalar(p.radius);
    this.puffs = [];
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.cloud, color: choice([0x7dff3a, 0x5acc2a, 0x9cff6a]), transparent: true, opacity: 0, depthWrite: false }));
      s.userData.ownMat = true;
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius * 0.65;
      s.userData.bx = x + Math.cos(a) * r; s.userData.bz = z + Math.sin(a) * r;
      s.userData.by = rand(0.5, 1.6); s.userData.ph = rand(0, 6);
      const sc = rand(2.4, 3.4) * (p.radius / 2.6);
      s.scale.set(sc, sc, 1);
      this.add(s); this.puffs.push(s);
    }
  }
  update(dt) {
    this.t += dt;
    const p = this.p, g = this.game;
    if (this.t >= p.dur) return false;
    const a = Math.min(1, this.t / 0.3) * Math.min(1, (p.dur - this.t) / 0.6);
    for (const s of this.puffs) {
      const u = s.userData;
      s.position.set(u.bx + Math.sin(this.t * 0.8 + u.ph) * 0.4, u.by + Math.sin(this.t * 1.3 + u.ph) * 0.15, u.bz + Math.cos(this.t * 0.7 + u.ph) * 0.4);
      s.material.opacity = a * 0.55;
      s.material.rotation += dt * 0.3;
    }
    this.decal.material.opacity = a * 0.4;
    if (Math.random() < dt * 12) {
      const ang = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius;
      g.fxA.emit({ x: this.x + Math.cos(ang) * r, y: 0.2, z: this.z + Math.sin(ang) * r, vy: rand(0.4, 1), life: 0.7, size: 0.2, size2: 0.35, color: choice(ACID_COLORS), alpha: 0.7 });
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) e.addPoison(p.stacks, poisonDps(this.tw), this.tw);
    }
    return true;
  }
}

ABILITY_IMPL.poison_cloud = {
  params(L) { return { radius: 2.6, dur: 5, stacks: 1 + (L - 1), cd: 10 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Zehir yükü', '+' + p.stacks * 2 + '/sn'], ['Süre', sec(p.dur)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range, p.radius);
      if (!t) return false;
      const g = tw.game, c = t.predict(0.6, {});
      g.addProjectile(new Projectile(g, {
        kind: 'bomb', x: tw.x, y: tw.muzzleY, z: tw.z, tx: c.x, tz: c.z, arc: true, dur: 0.6, arcH: 3,
        onHit: (x, y, z) => { g.addFx(new PoisonCloudFx(g, tw, x, z, p)); acidSplash(g, x, z, 1.2); Sound.play('bubble'); },
      }));
      Sound.play('acid_shot');
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Zehir Bombası ----------------
ABILITY_IMPL.poison_bomb = {
  params(L, tw) { return { count: Math.min(10, 1 + (L - 1)), dmg: 26 * tw.dmgMult, stacks: 3, radius: 1.7, cd: 7 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Bomba', p.count + ' adet'], ['Hasar', fmt(p.dmg)], ['Zehir yükü', '+' + p.stacks]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const list = tw.enemiesInRange(tw.range).sort((a, b) => a.remaining - b.remaining);
      if (!list.length) return false;
      const g = tw.game;
      for (let i = 0; i < p.count; i++) {
        const e = list[i % list.length];
        const dur = 0.65 + i * 0.05;
        const c = e.predict(dur, {});
        if (i >= list.length) { c.x += rand(-1.2, 1.2); c.z += rand(-1.2, 1.2); }
        g.addProjectile(new Projectile(g, {
          kind: 'bomb', x: tw.x + rand(-0.3, 0.3), y: tw.muzzleY, z: tw.z + rand(-0.3, 0.3), tx: c.x, tz: c.z, arc: true, dur, arcH: 3.5,
          onHit: (x, y, z) => {
            for (const en of g.enemiesInRadius(x, z, p.radius)) {
              en.takeDamage(p.dmg, { src: tw });
              en.addPoison(p.stacks, poisonDps(tw), tw);
            }
            fxExplosion(g, x, z, p.radius, 0x7dff3a, { color2: 0xd0ff8a, smokeColor: 0x2a4a1a });
            Sound.play('explosion', 0.45);
            Sound.play('bubble');
          },
        }));
      }
      Sound.play('acid_shot', 1.2);
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Asit Püskürtme ----------------
class SprayRingFx extends Fx {
  constructor(game, tw) {
    super(game);
    this.tw = tw;
    this.ring = this.add(makeDecal(TEX.ring, 0x7dff3a, 0.18));
    this.ring.position.set(tw.x, 0.09, tw.z);
  }
  update(dt) {
    const tw = this.tw;
    if (tw.removed || !tw.abilities.acid_spray) return false;
    this.t += dt;
    const p = ABILITY_IMPL.acid_spray.params(tw.abilities.acid_spray.level, tw);
    this.ring.scale.setScalar(p.radius);
    this.ring.material.opacity = 0.14 + Math.sin(this.t * 3) * 0.04;
    return true;
  }
}

ABILITY_IMPL.acid_spray = {
  params(L, tw) { return { radius: Math.min(8, 3.5 + 0.5 * (L - 1)), dmg: 6 * tw.dmgMult * (1 + 0.3 * (L - 1)), shred: 2, tick: 0.4 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar/sn', fmt(p.dmg / p.tick)], ['Menzil', fmt(p.radius) + ' m'], ['Zırh azaltma', '-' + p.shred + '/vuruş']]; },
  onAcquire(tw) { tw.game.addFx(new SprayRingFx(tw.game, tw)); },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    ab.timer -= dt;
    if (ab.timer > 0) return;
    ab.timer = p.tick;
    const g = tw.game;
    const list = g.enemiesInRadius(tw.x, tw.z, p.radius);
    if (!list.length) return;
    const nx = tw.x, ny = tw.muzzleY - 0.6, nz = tw.z;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      e.takeDamage(p.dmg, { src: tw });
      e.addShred(p.shred, tw.shredCap, 4);
      if (k < 6) {
        const T = 0.35;
        for (let j = 0; j < 4; j++) {
          g.fxA.emit({
            x: nx + rand(-0.15, 0.15), y: ny, z: nz + rand(-0.15, 0.15),
            vx: (e.x - nx) / T + rand(-0.8, 0.8), vy: (0.8 - ny) / T + 0.5 * 8 * T, vz: (e.z - nz) / T + rand(-0.8, 0.8),
            life: T * rand(0.9, 1.1), size: rand(0.18, 0.3), size2: 0.1, color: choice(ACID_COLORS), alpha: 0.9, gravity: 8,
          });
        }
      }
    }
    Sound.play('splash', 0.35);
  },
};

// ---------------- Asit Yağmuru ----------------
class AcidRainFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p; this.tick = 0.3; this.acc = 0;
    this.decal = this.add(makeDecal(TEX.soft, 0x4aaa1a, 0, true));
    this.decal.position.set(x, 0.08, z); this.decal.scale.setScalar(p.radius);
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.cloud, color: choice([0x2f5a1f, 0x3d6b25, 0x26461a]), transparent: true, opacity: 0, depthWrite: false }));
      s.userData.ownMat = true;
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius * 0.7;
      s.position.set(x + Math.cos(a) * r, rand(6, 7), z + Math.sin(a) * r);
      const sc = rand(3.5, 5);
      s.scale.set(sc, sc * 0.7, 1);
      this.add(s); this.clouds.push(s);
    }
  }
  update(dt) {
    this.t += dt;
    const p = this.p, g = this.game;
    if (this.t >= p.dur) return false;
    const a = Math.min(1, this.t / 0.4) * Math.min(1, (p.dur - this.t) / 0.6);
    for (const s of this.clouds) { s.material.opacity = 0.85 * a; s.material.rotation += dt * 0.1; }
    this.decal.material.opacity = 0.3 * a;
    this.acc += dt * 140 * a;
    while (this.acc >= 1) {
      this.acc -= 1;
      const ang = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius;
      g.fxA.emit({ x: this.x + Math.cos(ang) * r, y: 6, z: this.z + Math.sin(ang) * r, vy: -16, life: 6 / 16, size: rand(0.1, 0.16), size2: 0.08, color: choice(ACID_COLORS), alpha: 0.85, alpha2: 0.6 });
    }
    if (Math.random() < dt * 20) {
      const ang = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius;
      g.fxA.burst(this.x + Math.cos(ang) * r, 0.1, this.z + Math.sin(ang) * r, 3, { color: 0x9cff5a, speed: 1.5, life: 0.3, size: 0.15, gravity: 8, up: 1.5 });
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 1;
      for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) {
        e.addPoison(p.stacks, poisonDps(this.tw), this.tw);
        e.addShred(5, this.tw.shredCap, 5);
      }
    }
    return true;
  }
}

ABILITY_IMPL.acid_rain = {
  params(L) { return { radius: 3.6, dur: Math.min(12, 4 + (L - 1)), stacks: 2 + (L - 1), cd: 14 }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Zehir yükü', '+' + p.stacks + '/sn'], ['Süre', sec(p.dur)], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range + 1, p.radius);
      if (!t) return false;
      const c = t.predict(0.8, {});
      tw.game.addFx(new AcidRainFx(tw.game, tw, c.x, c.z, p));
      Sound.play('bubble');
      Sound.play('whoosh', 0.6);
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Bulaşıcı Reaksiyon (pasif) ----------------
ABILITY_IMPL.contagion = {
  params(L) { return { radius: 2.5 + 0.4 * (L - 1), pct: Math.min(2, 0.6 + 0.15 * (L - 1)) }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Patlama alanı', fmt(p.radius) + ' m'], ['Bulaşma', pct(p.pct)]]; },
  update() {},
};

// Zehirli düşman öldüğünde Game tarafından çağrılır.
function contagionBurst(game, enemy, tw) {
  const p = ABILITY_IMPL.contagion.params(tw.abilities.contagion.level, tw);
  const stacks = Math.max(1, Math.round(enemy.poison * p.pct));
  for (const e of game.enemiesInRadius(enemy.x, enemy.z, p.radius)) {
    if (e !== enemy) e.addPoison(stacks, Math.max(enemy.poisonDps, poisonDps(tw)), tw);
  }
  game.fxA.burst(enemy.x, 0.6, enemy.z, 22, { color: 0x7dff3a, speed: 3 + p.radius, life: 0.5, size: 0.4, gravity: 3, up: 0.8 });
  game.addFx(new RingPulseFx(game, enemy.x, enemy.z, p.radius, 0x7dff3a, 0.45));
  Sound.play('splash', 0.7);
}
