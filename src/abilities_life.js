'use strict';

const LIFE_COLORS = [0x7dff9a, 0x5fe08a, 0xc8ffb0, 0xfff6b0];
const SEED_GLOBAL_MAX = 8;
const SEED_TRIGGER_R = 1.8;

function vineGeo() {
  return Models.geo('vine', () => mergeParts([
    P(G.cone(0.1, 1.3, 5), 0x2f6a24, [0, 0.65, 0]),
    P(G.cone(0.05, 0.22, 4), 0x9ac24a, [0.07, 0.45, 0], [0, 0, -1.1]),
    P(G.cone(0.05, 0.22, 4), 0x9ac24a, [-0.06, 0.8, 0], [0, 0, 1.1]),
    P(G.box(0.22, 0.03, 0.12), 0x5fb84a, [0.12, 0.62, 0.02], [0, 0.3, 0.5]),
    P(G.box(0.2, 0.03, 0.11), 0x4fa83a, [-0.1, 0.98, 0], [0, -0.4, -0.5]),
    P(G.ico(0.07, 0), 0xc060e0, [0, 1.26, 0]),
  ]));
}

function rockSpikeGeo() {
  return Models.geo('rock_spike', () => mergeParts([
    P(G.cone(0.38, 1.3, 5), 0x7a6650, [0, 0.65, 0], [0.12, 0, -0.1]),
    P(G.cone(0.22, 0.8, 4), 0x8a7458, [0.3, 0.4, 0.1], [0, 0, -0.45]),
    P(G.cone(0.2, 0.7, 4), 0x6a5a48, [-0.26, 0.35, -0.1], [0.2, 0, 0.5]),
  ]));
}

// ---------------- Zehirli Sarmaşıklar ----------------
class VinesFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p; this.life = p.dur;
    this.tick = 0; this.rooted = new Set();
    this.ground = this.add(makeDecal(TEX.soft, 0x1f4a1a, 0.8, false));
    this.ground.position.set(x, 0.07, z);
    this.ground.scale.setScalar(p.radius * 1.2);
    this.ring = this.add(makeDecal(TEX.ring, 0x7dff6a, 0.6));
    this.ring.position.set(x, 0.08, z);
    this.ring.scale.setScalar(p.radius * 1.05);
    this.vines = [];
    const n = Math.min(16, 6 + Math.round(p.radius * 2.5)), geo = vineGeo();
    for (let i = 0; i < n; i++) {
      const v = this.add(new THREE.Mesh(geo, MAT.vc));
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * p.radius * 0.9;
      v.position.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
      v.rotation.set(rand(-0.35, 0.35), rand(0, Math.PI * 2), rand(-0.35, 0.35));
      v.userData.h = rand(0.7, 1.35); v.userData.ph = rand(0, 6);
      v.scale.set(1, 0.01, 1);
      v.castShadow = true;
      this.vines.push(v);
    }
    game.fxN.burst(x, 0.3, z, 16, { color: 0x4a3a22, speed: 3, life: 0.6, size: 0.3, gravity: 6, up: 1.2 });
  }
  update(dt) {
    this.t += dt;
    const g = this.game, p = this.p;
    if (this.t >= this.life) return false;
    const k = Math.min(1, this.t / 0.3) * Math.min(1, (this.life - this.t) / 0.5);
    for (const v of this.vines) {
      v.scale.set(1, Math.max(0.01, v.userData.h * k), 1);
      v.rotation.z = Math.sin(this.t * 3 + v.userData.ph) * 0.15;
    }
    this.ground.material.opacity = 0.8 * k;
    this.ring.material.opacity = (0.45 + Math.sin(this.t * 6) * 0.15) * k;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) {
        if (!this.rooted.has(e)) { this.rooted.add(e); e.applyRoot(p.root, this.tw); }
        e.addPoison(p.stacks, poisonDps(this.tw), this.tw);
      }
    }
    if (Math.random() < 0.5) {
      const a = rand(0, Math.PI * 2), r = rand(0, p.radius);
      g.fxA.emit({ x: this.x + Math.cos(a) * r, y: rand(0.2, 1), z: this.z + Math.sin(a) * r, vy: rand(0.3, 0.8), life: 0.8, size: rand(0.12, 0.22), size2: 0, color: choice([0x9cff6a, 0x7dff3a, 0xd890ff]), alpha: 0.7 });
    }
    return true;
  }
}

ABILITY_IMPL.speed_life = {
  params(L, tw) { return { haste: 0.10 + 0.04 * (L - 1) }; },
  stats(L, tw) { return [['Saldırı hızı', '+' + pct(this.params(L, tw).haste)]]; },
  update(tw, ab) {
    tw.auraHaste = this.params(ab.level, tw).haste;
  },
};

// ---------------- Orman Sakinleri: periler ----------------
class FairyFx extends Fx {
  constructor(game, tw, p) {
    super(game);
    this.tw = tw; this.shots = p.shots;
    this.a = rand(0, Math.PI * 2); this.orbitR = rand(1.7, 2.7); this.h = rand(2.4, 4.0);
    this.spd = rand(0.9, 1.4) * (Math.random() < 0.5 ? 1 : -1);
    this.shotT = rand(0.2, 0.6); this.fade = 0; this.leaving = -1;
    this.glow = this.add(new THREE.Sprite(FXMAT.fairyGlow));
    this.glow.scale.setScalar(0.85);
    this.body = this.add(new THREE.Group());
    const core = new THREE.Mesh(FXGEO.sph, FXMAT.proj.fairy.mat);
    core.scale.setScalar(0.09);
    this.wl = new THREE.Mesh(FXGEO.wing, FXMAT.fairyWing);
    this.wr = new THREE.Mesh(FXGEO.wing, FXMAT.fairyWing);
    this.wr.scale.x = -1;
    this.body.add(core, this.wl, this.wr);
    this.pos = new THREE.Vector3();
    this.place(0);
    tw.fairies++;
    game.fxA.burst(this.pos.x, this.pos.y, this.pos.z, 12, { color: choice(LIFE_COLORS), speed: 2.5, life: 0.5, size: 0.22, gravity: 0 });
  }
  place(dt) {
    const tw = this.tw;
    this.a += this.spd * dt;
    const bob = Math.sin(this.t * 3 + this.orbitR) * 0.25;
    this.pos.set(tw.x + Math.cos(this.a) * this.orbitR, this.h + bob, tw.z + Math.sin(this.a) * this.orbitR);
    this.glow.position.copy(this.pos);
    this.body.position.copy(this.pos);
    this.body.rotation.y = -this.a + (this.spd > 0 ? 0 : Math.PI);
    const f = Math.sin(this.t * 40) * 0.7;
    this.wl.rotation.y = f; this.wr.rotation.y = -f;
  }
  leave() {
    if (this.leaving >= 0) return;
    this.leaving = 0;
    this.game.fxA.burst(this.pos.x, this.pos.y, this.pos.z, 14, { color: choice(LIFE_COLORS), speed: 3, life: 0.5, size: 0.22, gravity: -1 });
  }
  update(dt) {
    this.t += dt;
    const g = this.game, tw = this.tw;
    this.place(dt);
    if (this.leaving >= 0) {
      this.leaving += dt;
      const k = 1 - this.leaving / 0.35;
      this.glow.scale.setScalar(0.85 * Math.max(0.01, k));
      this.body.scale.setScalar(Math.max(0.01, k));
      return k > 0;
    }
    if (tw.removed) { this.leave(); return true; }
    this.fade = Math.min(1, this.fade + dt * 3);
    this.glow.scale.setScalar(0.85 * this.fade * (1 + Math.sin(this.t * 9) * 0.12));
    this.body.scale.setScalar(this.fade);
    if (Math.random() < 0.25) g.fxA.emit({ x: this.pos.x, y: this.pos.y, z: this.pos.z, vy: -0.4, life: 0.5, size: 0.12, size2: 0, color: choice(LIFE_COLORS), alpha: 0.8 });
    this.shotT -= dt;
    if (this.shotT <= 0) {
      const p = ABILITY_IMPL.fairies.params(tw.abilities.fairies ? tw.abilities.fairies.level : 1, tw);
      const e = g.firstEnemy(this.pos.x, this.pos.z, p.range);
      if (!e) { this.shotT = 0.25; return true; }
      this.shotT = 1 / p.rate;
      g.addProjectile(new Projectile(g, {
        kind: 'fairy', x: this.pos.x, y: this.pos.y, z: this.pos.z, target: e, speed: 21,
        onHit: (x, y, z, t) => {
          if (t) t.takeDamage(p.dmg, { src: tw });
          g.fxA.burst(x, y, z, 5, { color: choice(LIFE_COLORS), speed: 2, life: 0.3, size: 0.2, gravity: 1 });
        },
      }));
      Sound.play('fairy_shot', 0.6);
      if (--this.shots <= 0) this.leave();
    }
    return true;
  }
  dispose() { this.tw.fairies--; super.dispose(); }
}

ABILITY_IMPL.fairies = {
  params(L, tw) {
    return { max: 10, range: 6.8, cd: 2.2, shots: 10, rate: 1.6, dmg: 6 * tw.dmgMult, abil: 0.08 + 0.04 * (L - 1) };
  },
  stats(L, tw) {
    const p = this.params(L, tw);
    return [['Peri tavanı', p.max], ['Yetenek hasarı', '+' + pct(p.abil)], ['Peri hasarı', fmt(p.dmg)]];
  },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    tw.auraAbil = p.abil;
    ab.timer -= dt;
    if (ab.timer > 0) return;
    if (tw.fairies >= p.max) { ab.timer = 0.4; return; }
    tw.game.addFx(new FairyFx(tw.game, tw, p));
    Sound.play('fairy', 0.8);
    ab.timer = p.cd;
  },
};

// ---------------- Sismik Darbe ----------------
class SeismicFx extends Fx {
  constructor(game, tw, dx, dz, p) {
    super(game);
    this.tw = tw; this.dx = dx; this.dz = dz; this.p = p;
    this.ox = tw.x; this.oz = tw.z;
    this.front = 1; this.hit = new Set(); this.spawnT = 0;
    this.spikes = [];
    const geo = rockSpikeGeo();
    for (let i = 0; i < 14; i++) {
      const m = this.add(new THREE.Mesh(geo, MAT.vc));
      m.visible = false; m.castShadow = true;
      this.spikes.push({ m, t: -1 });
    }
    this.si = 0;
  }
  update(dt) {
    const p = this.p, g = this.game;
    this.t += dt;
    const prev = this.front;
    if (this.front < p.dist) this.front = Math.min(p.dist, this.front + p.speed * dt);
    const w = p.width;
    const cx = this.ox + this.dx * this.front, cz = this.oz + this.dz * this.front;
    if (this.front < p.dist) {
      this.spawnT -= dt;
      while (this.spawnT <= 0) {
        this.spawnT += 0.05;
        const s = this.spikes[this.si++ % this.spikes.length];
        const off = rand(-w / 2, w / 2);
        s.t = 0;
        s.m.visible = true;
        s.m.position.set(cx - this.dz * off, 0, cz + this.dx * off);
        s.m.rotation.set(rand(-0.2, 0.2), rand(0, Math.PI * 2), rand(-0.2, 0.2));
        s.sc = rand(0.6, 1.1);
      }
      for (let i = 0; i < 3; i++) {
        const off = rand(-w / 2, w / 2);
        g.fxN.emit({ x: cx - this.dz * off, y: 0.3, z: cz + this.dx * off, vx: rand(-1, 1), vy: rand(2, 4.5), vz: rand(-1, 1), life: 0.7, size: rand(0.2, 0.35), size2: 0.1, color: choice([0x7a6650, 0x5a4632, 0x8a7458]), gravity: 9, alpha: 0.95 });
      }
      g.fxN.emit({ x: cx, y: 0.4, z: cz, vy: 0.6, life: 1, size: 0.8, size2: 2, color: 0x8a7a62, alpha: 0.4, drag: 2 });
      for (const e of g.enemiesInRadius(cx, cz, w / 2 + 1.5)) {
        if (this.hit.has(e)) continue;
        const rx = e.x - this.ox, rz = e.z - this.oz;
        const along = rx * this.dx + rz * this.dz;
        const across = Math.abs(-rx * this.dz + rz * this.dx);
        if (along >= prev - 0.8 && along <= this.front + 0.8 && across <= w / 2 + e.radius) {
          this.hit.add(e);
          e.takeDamage(p.dmg, { src: this.tw });
          e.knockback(p.knock, true, this.tw);
          e.applyRoot(p.stun, this.tw);
          g.fxA.burst(e.x, e.T.height + 0.2, e.z, 5, { color: 0xfff08a, speed: 1.5, life: 0.5, size: 0.2, gravity: 0 });
        }
      }
    }
    let any = false;
    for (const s of this.spikes) {
      if (s.t < 0) continue;
      s.t += dt;
      const k = s.t / 0.6;
      if (k >= 1) { s.t = -1; s.m.visible = false; continue; }
      any = true;
      const h = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      s.m.scale.set(s.sc, Math.max(0.01, s.sc * h), s.sc);
    }
    return this.front < p.dist || any;
  }
}

ABILITY_IMPL.seismic = {
  params(L, tw) {
    return { dmg: 18 * tw.dmgMult * (1 + 0.15 * (L - 1)), knock: 2.2 + 0.45 * (L - 1), stun: 0.9 + 0.15 * (L - 1), width: 3.4, speed: 12, dist: tw.range + 3, cd: 11 };
  },
  stats(L, tw) {
    const p = this.params(L, tw);
    return [['Sersemletme', sec(p.stun)], ['Savurma', fmt(p.knock) + ' m'], ['Hasar', fmt(p.dmg)], ['Bekleme', sec(p.cd)]];
  },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range, 3);
      if (!t) return false;
      const l = Math.hypot(t.x - tw.x, t.z - tw.z) || 1;
      tw.game.addFx(new SeismicFx(tw.game, tw, (t.x - tw.x) / l, (t.z - tw.z) / l, p));
      tw.game.addFx(new RingPulseFx(tw.game, tw.x, tw.z, 3, 0x9a7a4a, 0.5));
      Sound.play('quake', 1.1);
      tw.game.shake(0.25);
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Çürüme ----------------
ABILITY_IMPL.decay = {
  params(L, tw) { return { amt: 0.18 + 0.07 * (L - 1) }; },
  stats(L, tw) { return [['Zamanla hasar', '+' + pct(this.params(L, tw).amt)]]; },
  update(tw, ab) { tw.auraDot = this.params(ab.level, tw).amt; },
};

// ---------------- Yaşam Tohumları ----------------
class SeedFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p; this.life = p.life;
    this.exploded = false;
    this.m = this.add(Models.seed());
    this.m.position.set(x, 0, z);
    this.m.scale.setScalar(0.01);
    this.m.rotation.y = rand(0, Math.PI * 2);
    this.glow = this.add(new THREE.Mesh(FXGEO.plane, FXMAT.seedGlow));
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(x, 0.07, z);
    this.glow.renderOrder = 5;
    game.seeds.push(this);
    tw.seedCount++;
    game.fxN.burst(x, 0.2, z, 6, { color: 0x4a3a22, speed: 1.5, life: 0.4, size: 0.2, gravity: 6, up: 1.2 });
  }
  update(dt) {
    this.t += dt;
    if (this.exploded) return false;
    if (this.t >= this.life || this.tw.removed) {
      this.game.fxN.burst(this.x, 0.3, this.z, 6, { color: 0x6a5a32, speed: 1, life: 0.5, size: 0.2, gravity: 3 });
      return false;
    }
    const pop = Math.min(1, this.t / 0.3);
    const blink = this.life - this.t < 2.5 ? 0.6 + 0.4 * Math.sin(this.t * 16) : 1;
    this.m.scale.setScalar(Math.max(0.01, easeOutBack(pop)) * (1 + Math.sin(this.t * 4) * 0.05));
    this.glow.scale.setScalar(0.75 + Math.sin(this.t * 4) * 0.1);
    this.glow.visible = blink > 0.5;
    if (Math.random() < 0.12) this.game.fxA.emit({ x: this.x + rand(-0.2, 0.2), y: 0.7, z: this.z + rand(-0.2, 0.2), vy: rand(0.4, 0.8), life: 0.8, size: 0.14, size2: 0, color: choice(LIFE_COLORS), alpha: 0.8 });
    return true;
  }
  explode() {
    if (this.exploded) return;
    this.exploded = true;
    const g = this.game, p = this.p, tw = this.tw;
    fxExplosion(g, this.x, this.z, p.radius, 0x5fe08a, { color2: 0xc8ffb0, smokeColor: 0x2f5a2a });
    g.fxN.burst(this.x, 0.5, this.z, 14, { color: choice([0x4fa83a, 0x7ce060]), speed: 4, life: 0.9, size: 0.22, gravity: 5, up: 1 });
    Sound.play('seed_pop', 1);
    for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) {
      e.takeDamage(p.dmg, { src: tw });
      e.addPoison(p.stacks, poisonDps(tw), tw);
    }
  }
  dispose() {
    const i = this.game.seeds.indexOf(this);
    if (i >= 0) this.game.seeds.splice(i, 1);
    this.tw.seedCount--;
    super.dispose();
  }
}

ABILITY_IMPL.seeds = {
  params(L, tw) {
    const dur = tw.auraDur || 1;
    return { max: Math.min(6, 1 + L), dmg: 30 * tw.dmgMult * (1 + 0.3 * (L - 1)), radius: 2.4, stacks: 2, cd: 4.6, life: 12 * dur };
  },
  stats(L, tw) {
    const p = this.params(L, tw);
    return [['Tohum sayısı', p.max], ['Patlama hasarı', fmt(p.dmg)], ['Zehir yükü', p.stacks], ['Ömür', sec(p.life)]];
  },
  update(tw, ab, dt) {
    ab.timer -= dt;
    if (ab.timer > 0) return;
    const p = this.params(ab.level, tw), g = tw.game;
    if (tw.seedCount >= p.max || g.seeds.length >= SEED_GLOBAL_MAX) { ab.timer = 0.4; return; }
    const alive = g.enemies.filter((e) => !e.dead);
    if (!alive.length) { ab.timer = 0.4; return; }
    const casters = g.towers.filter((t) => t.type && !t.removed && Object.keys(t.abilities).length);
    const near = alive.filter((e) => casters.some((t) => dist2(t.x, t.z, e.x, e.z) <= (t.range + 2) * (t.range + 2)));
    const e = choice(near.length ? near : alive);
    const pr = e.predict(rand(0.5, 1.4), {});
    const a = rand(0, Math.PI * 2), r = rand(0.5, 1.2), b = CFG.bounds;
    const x = clamp(pr.x + Math.cos(a) * r, b.minX, b.maxX), z = clamp(pr.z + Math.sin(a) * r, b.minZ, b.maxZ);
    g.addFx(new SeedFx(g, tw, x, z, p));
    Sound.play('sprout', 0.6);
    ab.timer = p.cd;
  },
};
