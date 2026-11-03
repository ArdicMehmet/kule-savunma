'use strict';

const SLIME_COLORS = [0x7dff6a, 0xb8ff7a, 0x3aaa2a, 0xd8ff90];

function applyMud(e, n, tw) {
  if (!e || e.dead || n <= 0) return;
  if (e.immuneTo('slime')) { e.onImmuneHit('slime'); return; }
  if (e.mudImmune > 0) return;
  e.mud = Math.min(10, (e.mud || 0) + n);
  e.mudSrc = tw;
  if (e.mud >= 10) {
    e.mud = 0;
    const stun = tw && tw.mudStun != null ? tw.mudStun : 1;
    e.applyRoot(stun, tw);
    e.mudImmune = 2;
    e.game.ui.floatText(e.x, e.visHeight + 0.3, e.z, 'BALÇIK!', '#7dff6a', 13);
    Sound.play('freeze', 0.45);
  }
}

class SlimeBombFx extends Fx {
  constructor(game, tw, x, z, p) {
    super(game);
    this.tw = tw; this.x = x; this.z = z; this.p = p;
    const mat = FXMAT.proj.slime.mat.clone();
    mat.transparent = true;
    mat.opacity = 0.9;
    this.blob = this.add(new THREE.Mesh(FXGEO.sph, mat));
    this.blob.userData.ownMat = true;
    this.blob.position.set(x, 0.4, z);
    this.ring = this.add(makeDecal(TEX.soft, 0x6adf4a, 0.7, false));
    this.ring.position.set(x, 0.08, z);
    game.fxA.burst(x, 0.5, z, 16, { color: choice(SLIME_COLORS), speed: 3.5, life: 0.5, size: 0.32, gravity: 3 });
    Sound.play('splash', 0.7);
    for (const e of game.enemiesInRadius(x, z, p.radius)) {
      e.takeDamage(p.dmg, { src: tw });
      applyMud(e, p.stacks, tw);
    }
  }
  update(dt) {
    this.t += dt;
    const k = 1 - this.t / 0.45;
    if (k <= 0) return false;
    this.blob.scale.setScalar(this.p.radius * 0.55 * (1.2 - this.t));
    this.blob.material.opacity = k;
    this.ring.scale.setScalar(this.p.radius * (0.6 + this.t * 2));
    this.ring.material.opacity = 0.55 * k;
    return true;
  }
}

ABILITY_IMPL.slime_bomb = {
  params(L, tw) {
    return { dmg: 16 * tw.dmgMult * (1 + 0.22 * (L - 1)), stacks: 1 + Math.floor((L - 1) / 3), radius: 2.3, cd: 7.5 };
  },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Yığın', p.stacks], ['Alan', fmt(p.radius) + ' m']]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.clusterTarget(tw.range, p.radius);
      if (!t) return false;
      const pr = t.predict(0.55, {});
      tw.game.addProjectile(new Projectile(tw.game, {
        kind: 'slime', x: tw.x, y: tw.muzzleY, z: tw.z, tx: pr.x, tz: pr.z, arc: true, dur: 0.55, arcH: 2.8,
        onHit: (x, y, z) => tw.game.addFx(new SlimeBombFx(tw.game, tw, x, z, p)),
      }));
      tw.castAnim();
      return true;
    });
  },
};

class SlimePunchFx extends Fx {
  constructor(game, tw, dx, dz, p) {
    super(game);
    this.tw = tw; this.dx = dx; this.dz = dz; this.p = p;
    this.ox = tw.x; this.oz = tw.z; this.front = 0.4; this.hit = new Set();
    const mat = FXMAT.proj.slime.mat.clone();
    mat.transparent = true;
    this.fist = this.add(new THREE.Mesh(FXGEO.sph, mat));
    this.fist.userData.ownMat = true;
  }
  update(dt) {
    const p = this.p, g = this.game;
    this.t += dt;
    this.front = Math.min(p.dist, this.front + p.speed * dt);
    const x = this.ox + this.dx * this.front, z = this.oz + this.dz * this.front;
    this.fist.position.set(x, 0.7 + Math.sin(this.t * 18) * 0.1, z);
    this.fist.scale.setScalar(1.1);
    if (Math.random() < 0.5) g.fxA.emit({ x, y: 0.3, z, vy: 1.2, life: 0.4, size: 0.22, color: choice(SLIME_COLORS), alpha: 0.85 });
    for (const e of g.enemiesInRadius(x, z, 1.5)) {
      if (this.hit.has(e)) continue;
      this.hit.add(e);
      e.takeDamage(p.dmg, { src: this.tw });
      e.knockback(p.knock, true, this.tw);
      applyMud(e, 1, this.tw);
    }
    return this.front < p.dist;
  }
}

ABILITY_IMPL.slime_punch = {
  params(L, tw) {
    return { dmg: 14 * tw.dmgMult, knock: 1.8 + 0.45 * (L - 1), dist: tw.range + 1.5, speed: 14, cd: 8 };
  },
  stats(L, tw) { const p = this.params(L, tw); return [['İtme', fmt(p.knock) + ' m'], ['Hasar', fmt(p.dmg)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range);
      if (!t) return false;
      const l = Math.hypot(t.x - tw.x, t.z - tw.z) || 1;
      tw.game.addFx(new SlimePunchFx(tw.game, tw, (t.x - tw.x) / l, (t.z - tw.z) / l, p));
      Sound.play('whoosh', 0.7);
      tw.castAnim();
      return true;
    });
  },
};

class SnailFx extends Fx {
  constructor(game, tw, p) {
    super(game);
    this.tw = tw; this.p = p;
    this.a = rand(0, Math.PI * 2); this.r = 3.2;
    this.mesh = this.add(Models.ally('snail'));
    this.trail = []; this.tick = 0;
    tw.snail = this;
  }
  update(dt) {
    const tw = this.tw, g = this.game, p = ABILITY_IMPL.snail.params(tw.abilities.snail.level, tw);
    if (tw.removed) return false;
    this.t += dt;
    this.a += dt * 0.55;
    const x = tw.x + Math.cos(this.a) * this.r, z = tw.z + Math.sin(this.a) * this.r;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = this.a + Math.PI / 2;
    this.trail.push({ x, z, t: 3.5 });
    if (this.trail.length > 40) this.trail.shift();
    for (const s of this.trail) s.t -= dt;
    this.trail = this.trail.filter((s) => s.t > 0);
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 1 / Math.max(1, p.rate);
      for (const e of g.enemies) {
        if (e.dead) continue;
        for (const s of this.trail) {
          if (dist2(e.x, e.z, s.x, s.z) < 0.85 * 0.85) {
            e.takeDamage(p.dmg, { src: tw, dot: true, elem: 'slime' });
            applyMud(e, p.stacks, tw);
            break;
          }
        }
      }
    }
    if (Math.random() < 0.4) {
      const last = this.trail[this.trail.length - 1];
      if (last) g.fxA.emit({ x: last.x, y: 0.12, z: last.z, vy: 0.2, life: 0.8, size: 0.28, size2: 0.5, color: 0x6adf4a, alpha: 0.5, gravity: 1 });
    }
    return true;
  }
  dispose() { if (this.tw.snail === this) this.tw.snail = null; super.dispose(); }
}

ABILITY_IMPL.snail = {
  params(L, tw) { return { dmg: 8 * tw.dmgMult * (1 + 0.2 * (L - 1)), stacks: 1 + Math.floor((L - 1) / 4), rate: 1 + 0.25 * (L - 1) }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar / sn', fmt(p.dmg)], ['Yığın / sn', fmt(p.rate)]]; },
  onAcquire(tw, ab) { tw.game.addFx(new SnailFx(tw.game, tw, this.params(ab.level, tw))); },
  update(tw, ab) {
    if (!tw.snail) this.onAcquire(tw, ab);
  },
};

ABILITY_IMPL.slime_prison = {
  params(L, tw) { return { hp: unitStats(tw, 'prison').hp, cd: 11 }; },
  stats(L, tw) { return [['Hapis canı', fmt(this.params(L, tw).hp)]]; },
  update(tw, ab, dt) {
    const p = this.params(ab.level, tw);
    abilityTick(ab, dt, p.cd, () => {
      const t = tw.firstTarget(tw.range);
      if (!t || t.prison) return false;
      const a = pathAnchor(tw.game, t.x, t.z);
      const prison = new Ally(tw.game, tw, {
        kind: 'prison', x: t.x, z: t.z, path: t.path, dist: t.dist, block: true,
        prisoner: t, radius: 0.9, height: 1.4,
      });
      t.prison = prison;
      t.rootT = Math.max(t.rootT, 0.4);
      Sound.play('bubble', 0.8);
      tw.castAnim();
      return true;
    });
  },
};

class SlimeletFx extends Fx {
  constructor(game, tw, king) {
    super(game);
    this.tw = tw; this.king = king;
    this.x = king.x + rand(-0.6, 0.6); this.z = king.z + rand(-0.6, 0.6);
    this.mesh = this.add(Models.ally('slimelet'));
    this.mesh.position.set(this.x, 0.2, this.z);
    this.target = null; this.hop = 0;
  }
  update(dt) {
    const g = this.game, tw = this.tw, king = this.king;
    this.t += dt;
    if (tw.removed || !king.alive) { king.slimelets = Math.max(0, king.slimelets - 1); return false; }
    if (!this.target || this.target.dead) this.target = g.nearestEnemy(this.x, this.z, tw.range + 2);
    if (!this.target) {
      this.x += (king.x - this.x) * dt; this.z += (king.z - this.z) * dt;
      this.mesh.position.set(this.x, 0.15 + Math.abs(Math.sin(this.t * 8)) * 0.12, this.z);
      return true;
    }
    const e = this.target;
    const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz) || 1;
    this.x += (dx / d) * 5.2 * dt; this.z += (dz / d) * 5.2 * dt;
    this.hop += dt * 14;
    this.mesh.position.set(this.x, 0.2 + Math.abs(Math.sin(this.hop)) * 0.45, this.z);
    this.mesh.rotation.y = Math.atan2(dx, dz);
    if (d < e.radius + 0.45) {
      const p = ABILITY_IMPL.slime_king.params(tw.abilities.slime_king.level, tw);
      e.takeDamage(p.dmg, { src: tw });
      applyMud(e, p.stacks, tw);
      g.fxA.burst(this.x, 0.5, this.z, 12, { color: choice(SLIME_COLORS), speed: 3, life: 0.4, size: 0.24, gravity: 2 });
      Sound.play('splash', 0.45);
      king.slimelets = Math.max(0, king.slimelets - 1);
      return false;
    }
    return true;
  }
}

ABILITY_IMPL.slime_king = {
  params(L, tw) {
    return { slimes: Math.min(8, 2 + L), dmg: 12 * tw.dmgMult * (1 + 0.15 * (L - 1)), stacks: 1, hp: unitStats(tw, 'slimeking').hp };
  },
  stats(L, tw) { const p = this.params(L, tw); return [['Slime sayısı', p.slimes], ['Patlama hasarı', fmt(p.dmg)], ['Kral canı', fmt(p.hp)]]; },
  onAcquire(tw) {
    if (countAlive(tw, 'slimeking') >= 1) return;
    const p = incomingPoint(tw.game, tw, 0.85);
    new Ally(tw.game, tw, { kind: 'slimeking', x: p.x, z: p.z, path: p.path, dist: p.dist, radius: 0.85, height: 2.2 });
  },
  update(tw) { if (countAlive(tw, 'slimeking') < 1) this.onAcquire(tw); },
};
