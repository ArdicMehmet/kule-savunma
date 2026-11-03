'use strict';

function pathAnchor(game, x, z) {
  let best = null, bd = Infinity, along = 0;
  for (const p of game.world.paths) {
    for (let i = 0; i <= p.n; i += 3) {
      const d = dist2(x, z, p.xs[i], p.zs[i]);
      if (d < bd) { bd = d; best = p; along = p.cum[i]; }
    }
  }
  return { path: best, dist: along };
}

function incomingPoint(game, tw, frac) {
  const a = pathAnchor(game, tw.x, tw.z);
  if (!a.path) return { x: tw.x, z: tw.z - tw.range * Math.max(0.3, frac), path: null, dist: 0, tx: 0, tz: -1 };
  const d = clamp(a.dist - tw.range * frac, 1.5, a.path.length - 2);
  const s = { x: 0, z: 0, tx: 0, tz: 1 };
  a.path.sample(d, s);
  return { x: s.x, z: s.z, path: a.path, dist: d, tx: s.tx, tz: s.tz };
}

function allyBar(w, y) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(HPBAR.geoBg, HPBAR.matBg);
  bg.scale.x = w + 0.08;
  const fg = new THREE.Mesh(HPBAR.geoFg, HPBAR.matFg);
  fg.position.x = -w / 2; fg.position.z = 0.001; fg.scale.x = w;
  bg.renderOrder = 30; fg.renderOrder = 31;
  g.add(bg, fg);
  g.position.y = y;
  g.userData.fg = fg;
  g.userData.w = w;
  return g;
}

function unitStats(tw, kind) {
  const L = (id) => (tw.abilities[id] ? tw.abilities[id].level : 1);
  const sd = (1 + 0.18 * (tw.cards.u_summon_dmg || 0)) * (tw.buffSummon || 1) * tw.dmgMult;
  const sh = 1 + 0.20 * (tw.cards.u_summon_hp || 0);
  switch (kind) {
    case 'knight': return { hp: 58 * sh, dmg: 9 * sd * (1 + 0.18 * (L('knights') - 1)), range: 1.55 };
    case 'guard': return { hp: 110 * sh * (1 + 0.22 * (L('guards') - 1)), dmg: 0, range: 0 };
    case 'priest': return { hp: 42 * sh, dmg: 0, heal: 9 * (1 + 0.16 * (L('priests') - 1)) * tw.dmgMult, healCd: Math.max(0.65, 1.75 - 0.1 * (L('priests') - 1)), range: 4.2 };
    case 'general': return { hp: 160 * sh, dmg: 18 * sd * (1 + 0.12 * (L('general') - 1)), range: 2.1, aura: 0.12 + 0.04 * (L('general') - 1), auraR: 5.5 };
    case 'slimeking': {
      const n = Math.min(8, 2 + L('slime_king'));
      return { hp: 220 * (1 + 0.12 * (L('slime_king') - 1)), dmg: 0, range: 0, slimes: n };
    }
    case 'prison': return { hp: 70 * (1 + 0.28 * (L('slime_prison') - 1)) * tw.dmgMult, dmg: 0 };
    default: return { hp: 40, dmg: 6, range: 1.4 };
  }
}

function ensureSquad(tw) {
  if (!tw.squad) tw.squad = [];
  return tw.squad;
}

function countAlive(tw, kind) {
  let n = 0;
  for (const a of tw.squad || []) if (a.kind === kind && (a.alive || a.respawnT > 0 || a.waveWait)) n++;
  return n;
}

function disposeTowerUnits(tw) {
  if (!tw.squad) return;
  for (const a of tw.squad) a.remove();
  tw.squad.length = 0;
}

class Ally {
  constructor(game, tw, def) {
    this.game = game; this.tw = tw; this.kind = def.kind;
    this.alive = true; this.waveWait = !!def.waveWait;
    this.respawnT = 0; this.lastStand = 0; this.raged = false;
    this.x = def.x; this.z = def.z;
    this.homeX = def.x; this.homeZ = def.z;
    this.path = def.path || null;
    this.dist = def.dist || 0;
    this.block = !!def.block;
    this.prisoner = def.prisoner || null;
    this.radius = def.radius || 0.42;
    this.height = def.height || 1.55;
    this.atkT = rand(0.15, 0.5);
    this.healT = rand(0.2, 0.8);
    this.walk = rand(0, 6);
    this.spawnT = 0.4;
    this.slimelets = 0;
    this.slot = def.slot || 0;
    this.pendingRemove = false;
    this.syncStats();
    this.hp = this.maxHp;
    this.mesh = Models.ally(this.kind);
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    this.hpBar = allyBar(this.kind === 'slimeking' ? 1.8 : 1.05, this.height + 0.4);
    this.hpBar.visible = false;
    this.group.add(this.hpBar);
    if (this.kind === 'general') {
      this.auraRing = makeDecal(TEX.ring, 0xffd451, 0.45);
      this.auraRing.scale.setScalar(5);
      this.group.add(this.auraRing);
    }
    this.group.position.set(this.x, 0, this.z);
    game.scene.add(this.group);
    game.allies.push(this);
    ensureSquad(tw).push(this);
  }

  syncStats() {
    const s = unitStats(this.tw, this.kind);
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.maxHp = s.hp; this.hp = Math.max(1, s.hp * (this.alive ? ratio : 0));
    this.dmg = s.dmg || 0;
    this.range = s.range || 0;
    this.heal = s.heal || 0;
    this.healCd = s.healCd || 1.6;
    this.auraPow = s.aura || 0;
    this.auraR = s.auraR || 0;
    this.slimeCap = s.slimes || 0;
    if (this.hpBar && this.hpBar.userData.fg) this.hpBar.userData.fg.scale.x = Math.max(0.001, (this.hp / this.maxHp) * this.hpBar.userData.w);
  }

  auraBonus() {
    let m = 1;
    for (const a of this.game.allies) {
      if (a === this || !a.alive || a.kind !== 'general' || a.tw !== this.tw) continue;
      if (dist2(a.x, a.z, this.x, this.z) <= a.auraR * a.auraR) m += a.auraPow;
    }
    return m;
  }

  takeHit(n) {
    if (!this.alive || n <= 0) return;
    this.hp -= n;
    this.hpBar.visible = true;
    this.hpBar.userData.fg.scale.x = Math.max(0.001, (this.hp / this.maxHp) * this.hpBar.userData.w);
    this.hitT = 0.12;
    if (this.hp > 0) return;
    const tw = this.tw, ls = tw.abilities && tw.abilities.last_stand;
    if (ls && !this.raged && this.kind !== 'prison' && this.kind !== 'slimeking') {
      const L = ls.level;
      this.raged = true;
      this.lastStand = 3;
      this.hp = 1;
      this.dmg *= 1.35 + 0.12 * (L - 1);
      this.game.ui.floatText(this.x, this.height + 0.4, this.z, 'ÖLMEZ!', '#ff6b3b', 13);
      return;
    }
    this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.hpBar.visible = false;
    this.group.visible = false;
    this.game.fxN.burst(this.x, 0.8, this.z, 12, { color: 0xc8b070, speed: 3, life: 0.5, size: 0.22, gravity: 4 });
    Sound.play('enemy_die', 0.35);
    if (this.prisoner) { this.prisoner.prison = null; this.prisoner = null; }
    if (this.kind === 'slimeking') this.waveWait = true;
    else if (this.kind === 'prison') this.respawnT = 0;
    else this.respawnT = 10;
  }

  revive() {
    this.alive = true; this.raged = false; this.lastStand = 0; this.waveWait = false;
    this.syncStats(); this.hp = this.maxHp;
    this.x = this.homeX; this.z = this.homeZ;
    this.group.position.set(this.x, 0, this.z);
    this.group.visible = true;
    this.hpBar.visible = false;
    this.game.fxA.burst(this.x, 0.6, this.z, 10, { color: 0xffe08a, speed: 2.4, life: 0.4, size: 0.2, gravity: 1 });
    Sound.play('summon', 0.45);
  }

  onWaveStart() {
    if (this.kind === 'slimeking' && this.waveWait) this.revive();
    this.slimelets = 0;
  }

  remove() {
    if (this.pendingRemove) return;
    this.alive = false;
    this.pendingRemove = true;
    if (this.group.parent) this.game.scene.remove(this.group);
    disposeObject(this.group);
  }

  update(dt) {
    if (this.tw.removed || this.pendingRemove) { this.remove(); return; }
    if (!this.alive) {
      if (this.respawnT > 0) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.revive();
      }
      return;
    }
    this.syncStats();
    if (this.lastStand > 0) {
      this.lastStand -= dt;
      this.mesh.scale.setScalar(1.18 + 0.08 * Math.sin(this.game.time * 14));
      if (this.lastStand <= 0) { this.die(); return; }
    } else this.mesh.scale.setScalar(1);
    const g = this.game, q = g.camera.quaternion;
    this.hpBar.quaternion.copy(q);
    if (this.hitT > 0) this.hitT -= dt;

    if (this.kind === 'prison') {
      const e = this.prisoner;
      if (!e || e.dead) { this.die(); return; }
      e.rootT = Math.max(e.rootT, 0.2);
      this.x = e.x; this.z = e.z;
      this.group.position.set(this.x, 0, this.z);
      this.mesh.rotation.y += dt * 1.4;
      return;
    }

    if (this.path && this.block) {
      const s = { x: 0, z: 0, tx: 0, tz: 1 };
      this.path.sample(this.dist, s);
      this.x = s.x; this.z = s.z;
      this.mesh.rotation.y = Math.atan2(-s.tx, -s.tz);
    }

    const bonus = this.auraBonus();
    if (this.kind === 'priest') {
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = this.healCd;
        let best = null, bh = 1;
        for (const a of this.tw.squad) {
          if (!a.alive || a === this) continue;
          if (a.hp >= a.maxHp) continue;
          if (dist2(a.x, a.z, this.x, this.z) > this.range * this.range) continue;
          const r = a.hp / a.maxHp;
          if (r < bh) { bh = r; best = a; }
        }
        if (best) {
          best.hp = Math.min(best.maxHp, best.hp + this.heal);
          best.hpBar.visible = true;
          best.hpBar.userData.fg.scale.x = (best.hp / best.maxHp) * best.hpBar.userData.w;
          g.fxA.burst(best.x, best.height, best.z, 6, { color: 0xfff08a, speed: 1.4, life: 0.4, size: 0.16, gravity: -1 });
          Sound.play('heal', 0.35);
        }
      }
    } else if (this.dmg > 0) {
      const e = g.nearestEnemy(this.x, this.z, this.range);
      if (e) {
        this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, Math.atan2(e.x - this.x, e.z - this.z), 0.25);
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = this.kind === 'general' ? 0.7 : 0.85;
          e.takeDamage(this.dmg * bonus, { src: this.tw });
          g.fxA.burst(e.x, e.T.height * 0.5, e.z, 5, { color: 0xffe08a, speed: 2.2, life: 0.28, size: 0.18, gravity: 2 });
          Sound.play('hit', 0.4);
        }
      }
    }

    if (this.kind === 'slimeking' && g.waves.state === 'active') {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.slimelets < this.slimeCap) {
        this.spawnT = 1.8;
        g.addFx(new SlimeletFx(g, this.tw, this));
        this.slimelets++;
      }
    }

    if (this.kind === 'general' && this.auraRing) {
      this.auraRing.scale.setScalar(this.auraR * 0.36);
      this.auraRing.material.opacity = 0.3 + 0.15 * Math.sin(g.time * 3);
    }

    this.walk += dt * 7;
    const bob = this.kind === 'guard' ? 0 : Math.abs(Math.sin(this.walk)) * 0.05;
    this.mesh.position.y = bob + (this.hitT > 0 ? 0.05 : 0);
    this.group.position.set(this.x, 0, this.z);
  }
}

function spawnSquad(tw, kind, n, opts) {
  const g = tw.game;
  opts = opts || {};
  for (let i = 0; i < n; i++) {
    if (countAlive(tw, kind) >= n) return;
    let pos;
    if (kind === 'guard') {
      const p = incomingPoint(g, tw, 0.55);
      const off = (i - (n - 1) / 2) * 1.15;
      pos = { x: p.x - p.tz * off, z: p.z + p.tx * off, path: p.path, dist: p.dist, block: true };
    } else if (kind === 'general') {
      const p = incomingPoint(g, tw, 0.35);
      pos = { x: p.x, z: p.z, path: p.path, dist: p.dist };
    } else {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2), r = kind === 'priest' ? 2.1 : 2.6;
      pos = { x: tw.x + Math.cos(a) * r, z: tw.z + Math.sin(a) * r };
    }
    new Ally(g, tw, { kind, slot: i, radius: kind === 'guard' ? 0.55 : 0.42, height: kind === 'general' ? 2.1 : 1.55, ...pos });
  }
}
