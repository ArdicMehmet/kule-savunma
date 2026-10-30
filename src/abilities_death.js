'use strict';

const DEATH_COLORS = [0xa45cff, 0x7a2ad0, 0xd8b0ff, 0x5a1a9a];

// ---------------- Ruh (lanetli düşmandan kuleye süzülen ışık) ----------------
class SoulWispFx extends Fx {
  constructor(game, x, y, z, tw, n) {
    super(game);
    this.tw = tw;
    this.sx = x; this.sy = y; this.sz = z;
    this.life = rand(0.7, 0.95);
    this.side = rand(-1.6, 1.6);
    this.s = this.add(new THREE.Sprite(FXMAT.wisp));
    this.s.scale.setScalar(0.55 + Math.min(0.7, n * 0.07));
    this.s.position.set(x, y, z);
    game.wispN = (game.wispN || 0) + 1;
  }
  update(dt) {
    this.t += dt;
    const tw = this.tw, g = this.game;
    if (tw.removed) return false;
    const k = Math.min(1, this.t / this.life);
    const e = k * k * (3 - 2 * k);
    const tx = tw.x, ty = tw.muzzleY, tz = tw.z;
    const dx = tx - this.sx, dz = tz - this.sz, l = Math.hypot(dx, dz) || 1;
    const off = Math.sin(k * Math.PI) * this.side;
    const x = lerp(this.sx, tx, e) - (dz / l) * off;
    const z = lerp(this.sz, tz, e) + (dx / l) * off;
    const y = lerp(this.sy, ty, e) + Math.sin(k * Math.PI) * 2.2;
    this.s.position.set(x, y, z);
    if (Math.random() < 0.6) g.fxA.emit({ x, y, z, life: 0.35, size: 0.24, size2: 0, color: choice(DEATH_COLORS), alpha: 0.6 });
    if (k >= 1) {
      g.fxA.burst(tx, ty, tz, 6, { color: 0xd8b0ff, speed: 1.6, life: 0.35, size: 0.25, gravity: 0 });
      tw.castT = Math.max(tw.castT, 0.3);
      Sound.play('soul', 0.8);
      return false;
    }
    return true;
  }
  dispose() { this.game.wispN--; super.dispose(); }
}

function grantSouls(game, e, tw) {
  let n = tw.soulsPerKill * (e.isBoss ? 10 : 1);
  if (e.goldMark && e.goldMark.tw === tw) n += e.goldMark.souls;
  tw.addSouls(n);
  if ((game.wispN || 0) < 24) game.addFx(new SoulWispFx(game, e.x, e.T.height * 0.6, e.z, tw, n));
}

// ---------------- Kristal (Ölüm Altını) ----------------
class CrystalFx extends Fx {
  constructor(game, x, z, value) {
    super(game);
    this.value = value;
    this.m = this.add(new THREE.Mesh(FXGEO.oct, FXMAT.crystal));
    this.m.scale.set(0.24, 0.42, 0.24);
    this.m.castShadow = true;
    this.glow = this.add(new THREE.Sprite(FXMAT.crystalGlow));
    this.glow.scale.setScalar(1.2);
    const a = rand(0, Math.PI * 2), sp = rand(1.2, 2.8);
    this.x = x; this.z = z; this.y = 0.8;
    this.vx = Math.cos(a) * sp; this.vz = Math.sin(a) * sp; this.vy = rand(4.5, 6.5);
    this.state = 0;
  }
  update(dt) {
    this.t += dt;
    const h = this.game.hero, b = CFG.bounds;
    if (this.state === 0) {
      this.vy -= 18 * dt;
      this.x = clamp(this.x + this.vx * dt, b.minX, b.maxX);
      this.z = clamp(this.z + this.vz * dt, b.minZ, b.maxZ);
      this.y += this.vy * dt;
      if (this.y <= 0.5) { this.y = 0.5; this.state = 1; }
    } else if (this.state === 1) {
      if (dist(this.x, this.z, h.x, h.z) < 4.2 || this.t > 7) this.state = 2;
    } else {
      const dx = h.x - this.x, dy = 1.2 - this.y, dz = h.z - this.z;
      const d = Math.hypot(dx, dy, dz);
      const sp = (12 + this.t * 3) * dt;
      if (d <= sp + 0.3) { this.collect(); return false; }
      this.x += (dx / d) * sp; this.y += (dy / d) * sp; this.z += (dz / d) * sp;
      if (Math.random() < 0.5) this.game.fxA.emit({ x: this.x, y: this.y, z: this.z, life: 0.3, size: 0.2, size2: 0, color: 0xd8b0ff, alpha: 0.7 });
    }
    const bob = this.state === 1 ? 0.15 + Math.sin(this.t * 3.5) * 0.12 : 0;
    this.m.position.set(this.x, this.y + bob, this.z);
    this.m.rotation.y += dt * 3;
    this.glow.position.copy(this.m.position);
    this.glow.material.opacity = 0.55 + Math.sin(this.t * 6) * 0.15;
    return true;
  }
  collect() {
    const g = this.game;
    g.addGold(this.value);
    g.ui.floatText(this.x, 2.2, this.z, `+${this.value} 💎`, '#d8b0ff', 15);
    g.fxA.burst(this.x, this.y, this.z, 10, { color: 0xd8b0ff, speed: 2.5, life: 0.4, size: 0.25, gravity: 0 });
    Sound.play('crystal', 0.8);
  }
}

function dropCrystals(game, x, z, n) {
  const value = Math.max(2, Math.round(2 + game.waves.wave * 0.6));
  for (let i = 0; i < n; i++) game.addFx(new CrystalFx(game, x, z, value));
}

// ---------------- Mezarlık: zombiler ----------------
class ZombieFx extends Fx {
  constructor(game, tw, x, z, life) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.homeX = x; this.homeZ = z;
    this.life = life;
    this.mesh = this.add(Models.zombie());
    this.mesh.position.set(x, -1.3, z);
    this.mesh.rotation.y = rand(0, Math.PI * 2);
    this.ud = this.mesh.userData;
    this.rise = 0; this.dying = -1; this.boom = false;
    this.target = null; this.retarget = 0; this.atkT = 0.3; this.swing = 0; this.walk = rand(0, 6);
    this.speed = rand(3.3, 3.8);
    tw.zombies++;
    game.fxN.burst(x, 0.3, z, 12, { color: 0x5a4632, speed: 2.5, life: 0.6, size: 0.3, gravity: 6, up: 1.2 });
  }
  startDie() {
    this.dying = 0;
    const tw = this.tw, ab = tw.abilities.boomer;
    if (ab && !tw.removed) {
      const p = ABILITY_IMPL.boomer.params(ab.level, tw);
      const g = this.game;
      for (const e of g.enemiesInRadius(this.x, this.z, p.radius)) e.takeDamage(p.dmg, { src: tw });
      fxExplosion(g, this.x, this.z, p.radius, 0xa45cff, { color2: 0x9cff6a, smokeColor: 0x3a2a4a });
      Sound.play('explosion', 0.7);
      g.shake(0.08);
      this.boom = true;
      this.mesh.visible = false;
    } else {
      this.game.fxN.burst(this.x, 0.6, this.z, 10, { color: 0x6d6a5a, speed: 2, life: 0.6, size: 0.3, gravity: 4 });
    }
  }
  update(dt) {
    this.t += dt;
    const g = this.game, tw = this.tw, ud = this.ud, m = this.mesh;
    if (this.dying >= 0) {
      this.dying += dt;
      if (!this.boom) { m.position.y = -this.dying * 2.2; m.rotation.x = Math.min(1.2, this.dying * 3); }
      return this.dying < 0.6;
    }
    if (tw.removed) { this.startDie(); return true; }
    if (this.rise < 1) {
      this.rise = Math.min(1, this.rise + dt * 1.5);
      m.position.y = -1.3 * (1 - this.rise);
      if (Math.random() < 0.5) g.fxN.emit({ x: this.x + rand(-0.4, 0.4), y: 0.15, z: this.z + rand(-0.4, 0.4), vy: rand(1, 2.5), life: 0.5, size: 0.2, size2: 0.05, color: 0x5a4632, gravity: 6, alpha: 0.9 });
      return true;
    }
    this.life -= dt;
    if (this.life <= 0) { this.startDie(); return true; }

    this.retarget -= dt;
    if (!this.target || this.target.dead || this.retarget <= 0) {
      this.retarget = 0.3;
      const e = g.nearestEnemy(this.x, this.z, 8);
      this.target = e && dist(e.x, e.z, tw.x, tw.z) <= tw.range + 3 ? e : null;
    }
    let moving = false;
    const e = this.target;
    if (e) {
      const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz) || 1;
      m.rotation.y = lerpAngle(m.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10));
      if (d > e.radius + 0.55) {
        const step = Math.min(d, this.speed * dt);
        this.x += (dx / d) * step; this.z += (dz / d) * step;
        moving = true;
      } else {
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = 0.8;
          this.swing = 1;
          e.takeDamage(ABILITY_IMPL.graveyard.hitDmg(tw), { src: tw });
          e.applySlow(0.35, 0.9);
          g.fxA.burst(e.x, e.T.height * 0.5, e.z, 4, { color: choice(DEATH_COLORS), speed: 2, life: 0.3, size: 0.22, gravity: 2 });
          Sound.play('zombie_hit', 0.5);
        }
      }
    } else {
      const dx = this.homeX - this.x, dz = this.homeZ - this.z, d = Math.hypot(dx, dz);
      if (d > 0.6) {
        const step = Math.min(d, 1.6 * dt);
        this.x += (dx / d) * step; this.z += (dz / d) * step;
        m.rotation.y = lerpAngle(m.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 5));
        moving = true;
      }
    }
    if (moving) this.walk += dt * 9;
    const s = Math.sin(this.walk);
    ud.legL.rotation.x = moving ? s * 0.6 : 0;
    ud.legR.rotation.x = moving ? -s * 0.6 : 0;
    this.swing = Math.max(0, this.swing - dt * 4);
    ud.body.rotation.x = -this.swing * 0.45 + (moving ? 0.05 : 0);
    ud.body.rotation.z = Math.sin(this.t * 2.3) * 0.06;
    m.position.set(this.x, Math.abs(s) * (moving ? 0.06 : 0), this.z);
    if (this.life < 1.2) m.scale.setScalar(1.15 * (1 + Math.sin(this.t * 30) * 0.06 * (1.2 - this.life)));
    return true;
  }
  dispose() { this.tw.zombies--; super.dispose(); }
}

ABILITY_IMPL.graveyard = {
  params(L, tw) { return { max: Math.min(10, 1 + L), cd: Math.max(1.2, 5 * Math.pow(0.88, L - 1)), life: 10 }; },
  hitDmg(tw) { return 7 * tw.dmgMult * tw.buffSummon; },
  stats(L, tw) {
    const p = this.params(L, tw);
    return [['Zombi sayısı', p.max], ['Doğma süresi', sec(p.cd)], ['Vuruş hasarı', fmt(this.hitDmg(tw))]];
  },
  update(tw, ab, dt) {
    ab.timer -= dt;
    if (ab.timer > 0) return;
    const p = this.params(ab.level, tw), g = tw.game;
    if (tw.zombies >= p.max || !g.enemies.length) { ab.timer = 0.3; return; }
    const a = rand(0, Math.PI * 2), r = rand(1.7, 2.6);
    g.addFx(new ZombieFx(g, tw, tw.x + Math.cos(a) * r, tw.z + Math.sin(a) * r, p.life));
    Sound.play('zombie', 0.8);
    ab.timer = p.cd;
  },
};

// ---------------- BOOM-er (pasif) ----------------
ABILITY_IMPL.boomer = {
  params(L, tw) { return { dmg: 34 * tw.dmgMult * tw.buffSummon * (1 + 0.35 * (L - 1)), radius: 2.4 + 0.08 * (L - 1) }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Patlama hasarı', fmt(p.dmg)], ['Patlama alanı', fmt(p.radius) + ' m']]; },
  update() {},
};

// ---------------- Ölüm Altını ----------------
ABILITY_IMPL.death_gold = {
  params(L, tw) {
    return { shots: 1 + Math.floor(L / 2), souls: 1 + L, crystals: 1 + Math.floor((L - 1) / 3), dmg: tw.damage * 2.5, cd: 7 };
  },
  stats(L, tw) {
    const p = this.params(L, tw);
    return [['Atış sayısı', p.shots], ['Hasar', fmt(p.dmg)], ['Ekstra ruh', '+' + p.souls], ['Kristal', p.crystals]];
  },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const g = tw.game;
      const list = tw.enemiesInRange(tw.range + 1);
      if (!list.length) return false;
      list.sort((a, b) => a.hp - b.hp);
      list.slice(0, p.shots).forEach((t, i) => {
        g.addFx(new DelayFx(g, i * 0.12, () => {
          if (tw.removed) return;
          g.addProjectile(new Projectile(g, {
            kind: 'gold', x: tw.x, y: tw.muzzleY, z: tw.z, target: t, speed: 20,
            onHit: (x, y, z, e) => {
              g.fxA.burst(x, y, z, 12, { color: choice([0xffd85a, 0xb45cff]), speed: 3, life: 0.45, size: 0.32, gravity: 1 });
              if (!e) return;
              e.applyCurse(tw, 6);
              e.goldMark = { tw, souls: p.souls, crystals: p.crystals };
              e.takeDamage(p.dmg, { src: tw });
              if (!e.dead) e.goldMark = null;
            },
          }));
          Sound.play('gold_shot', 0.8);
        }));
      });
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Ölüm Dalgası ----------------
class DeathWaveFx extends Fx {
  constructor(game, tw, dx, dz, p) {
    super(game);
    this.tw = tw; this.dx = dx; this.dz = dz; this.p = p;
    this.front = 0.8; this.hit = new Set();
    this.ox = tw.x; this.oz = tw.z;
    const mat = new THREE.MeshBasicMaterial({ map: TEX.cloud, color: 0x6a1fc0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.wall = this.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 2), mat));
    this.wall.userData.ownMat = true; this.wall.userData.ownGeo = true;
    this.wall.rotation.y = Math.atan2(dx, dz);
    this.floor = this.add(makeDecal(TEX.soft, 0x5a1a9a, 0.7));
  }
  update(dt) {
    const p = this.p, g = this.game;
    const prev = this.front;
    this.front += p.speed * dt;
    if (this.front >= p.dist) return false;
    const w = p.width0 + this.front * 0.25;
    const cx = this.ox + this.dx * this.front, cz = this.oz + this.dz * this.front;
    const fade = Math.min(1, (p.dist - this.front) / 2.5);
    this.wall.position.set(cx, 1.0, cz);
    this.wall.scale.set(w, 1 + 0.2 * Math.sin(this.front * 2.5), 1);
    this.wall.material.opacity = 0.6 * fade;
    this.floor.position.set(cx, 0.08, cz);
    this.floor.scale.set(w * 0.6, 1.2, 1);
    this.floor.rotation.z = -Math.atan2(this.dx, this.dz);
    this.floor.material.opacity = 0.7 * fade;
    for (let i = 0; i < 5; i++) {
      const s = rand(-w / 2, w / 2);
      g.fxA.emit({ x: cx - this.dz * s, y: rand(0.2, 1.6), z: cz + this.dx * s, vx: this.dx * 3, vy: rand(0.8, 2), vz: this.dz * 3, life: rand(0.4, 0.7), size: rand(0.25, 0.45), size2: 0, color: choice(DEATH_COLORS), alpha: 0.8 });
    }
    if (Math.random() < 0.4) g.fxN.emit({ x: cx + rand(-1, 1), y: 0.4, z: cz + rand(-1, 1), vy: 0.8, life: 0.9, size: 0.6, size2: 1.4, color: 0x2a1a3a, alpha: 0.4, drag: 2 });
    for (const e of g.enemiesInRadius(cx, cz, w / 2 + 1.5)) {
      if (this.hit.has(e)) continue;
      const rx = e.x - this.ox, rz = e.z - this.oz;
      const along = rx * this.dx + rz * this.dz;
      const across = Math.abs(-rx * this.dz + rz * this.dx);
      if (along >= prev - 0.7 && along <= this.front + 0.7 && across <= w / 2 + e.radius) {
        this.hit.add(e);
        e.applyCurse(this.tw, 8);
        e.takeDamage(p.dmg, { src: this.tw });
      }
    }
    return true;
  }
}

ABILITY_IMPL.death_wave = {
  params(L, tw) { return { dmg: 26 * tw.dmgMult * (1 + 0.3 * (L - 1)), width0: 2.6 + 0.35 * (L - 1), cd: 9, speed: 10, dist: tw.range + 4 + 0.3 * (L - 1) }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Genişlik', fmt(p.width0) + ' m'], ['Mesafe', fmt(p.dist) + ' m'], ['Bekleme', sec(p.cd)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range, 3);
      if (!t) return false;
      const l = Math.hypot(t.x - tw.x, t.z - tw.z) || 1;
      tw.game.addFx(new DeathWaveFx(tw.game, tw, (t.x - tw.x) / l, (t.z - tw.z) / l, p));
      Sound.play('death_wave', 1.2);
      tw.castAnim();
      return true;
    });
  },
};

// ---------------- Ölüm Çukuru ----------------
const _rp = { x: 0, z: 0, tx: 0, tz: 1 };
function roadPointsNear(game, x, z, range) {
  const out = [], r2 = range * range;
  for (const pt of game.world.portals) {
    if (!pt.active) continue;
    const path = pt.path;
    for (let d = 0; d < path.length; d += 1.5) {
      path.sample(d, _rp);
      if (dist2(_rp.x, _rp.z, x, z) <= r2) out.push({ x: _rp.x, z: _rp.z, tx: _rp.tx, tz: _rp.tz });
    }
  }
  return out;
}

class DeathPitFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.r = p.radius; this.life = p.dur;
    this.hole = this.add(makeDecal(TEX.soft, 0x000000, 0.95, false));
    this.hole.position.set(x, 0.075, z);
    this.swirl = this.add(makeDecal(TEX.swirl, 0x7a2ad0, 0.8));
    this.swirl.position.set(x, 0.085, z);
    this.rim = this.add(makeDecal(TEX.ring, 0xb070ff, 0.9));
    this.rim.position.set(x, 0.09, z);
    game.fxN.burst(x, 0.3, z, 16, { color: 0x4a3a2a, speed: 3, life: 0.6, size: 0.35, gravity: 7, up: 1.3 });
    game.addFx(new RingPulseFx(game, x, z, this.r * 1.8, 0xa45cff, 0.5));
  }
  update(dt) {
    this.t += dt;
    const g = this.game;
    const open = Math.min(1, this.t / 0.35) * Math.min(1, (this.life - this.t) / 0.4);
    if (this.t >= this.life) return false;
    const s = this.r * open;
    this.hole.scale.setScalar(Math.max(0.01, s * 1.3));
    this.swirl.scale.setScalar(Math.max(0.01, s * 1.05));
    this.swirl.rotation.z += dt * 3;
    this.rim.scale.setScalar(Math.max(0.01, s * 1.25));
    this.rim.material.opacity = 0.6 + Math.sin(this.t * 8) * 0.3;
    if (Math.random() < 0.7) {
      const a = rand(0, Math.PI * 2);
      g.fxA.emit({ x: this.x + Math.cos(a) * s, y: 0.15, z: this.z + Math.sin(a) * s, vx: -Math.cos(a) * 0.6, vy: rand(0.8, 1.8), vz: -Math.sin(a) * 0.6, life: 0.6, size: rand(0.18, 0.3), size2: 0, color: choice(DEATH_COLORS), alpha: 0.8 });
    }
    if (open > 0.6 && !this.tw.removed) {
      for (const e of g.enemiesInRadius(this.x, this.z, s + 1)) {
        if (e.isBoss) continue;
        if (dist(e.x, e.z, this.x, this.z) <= s * 0.85 + e.radius * 0.4) this.swallow(e);
      }
    }
    return true;
  }
  swallow(e) {
    const g = this.game;
    e.sink = true;
    e.takeDamage(e.hp + 1, { src: this.tw, dot: true });
    g.fxA.burst(e.x, 0.5, e.z, 12, { color: choice(DEATH_COLORS), speed: 2.5, life: 0.5, size: 0.35, gravity: -2 });
    Sound.play('pit_fall', 0.8);
  }
}

ABILITY_IMPL.death_pit = {
  params(L, tw) {
    return { cd: Math.max(4, 15 * Math.pow(0.88, L - 1)), radius: Math.min(1.9, 0.9 + 0.11 * (L - 1)), dur: 4.5, count: L >= 6 ? 2 : 1 };
  },
  stats(L, tw) {
    const p = this.params(L, tw);
    return [['Bekleme', sec(p.cd)], ['Çukur boyutu', fmt(p.radius * 2) + ' m'], ['Çukur sayısı', p.count], ['Süre', sec(p.dur)]];
  },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const g = tw.game;
      if (!tw.firstTarget(tw.range + 3)) return false;
      const pts = roadPointsNear(g, tw.x, tw.z, tw.range);
      if (!pts.length) return false;
      for (let i = 0; i < p.count; i++) {
        const pt = choice(pts);
        const lat = rand(-0.6, 0.6);
        g.addFx(new DeathPitFx(g, tw, pt.x - pt.tz * lat, pt.z + pt.tx * lat, p));
      }
      Sound.play('pit', 1);
      g.shake(0.12);
      tw.castAnim();
      return true;
    });
  },
};
