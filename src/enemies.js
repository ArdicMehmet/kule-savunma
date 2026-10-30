'use strict';

const ENEMY_TYPES = {
  goblin: { name: 'Goblin', hp: 42, speed: 2.3, armor: 0, gold: 6, dmg: 1, radius: 0.45, scale: 1.0, height: 1.35, color: 0x6cc04a },
  wolf:   { name: 'Kurt', hp: 28, speed: 4.0, armor: 0, gold: 5, dmg: 1, radius: 0.45, scale: 1.0, height: 1.15, color: 0x8c8176 },
  slime:  { name: 'Balçık', hp: 16, speed: 2.8, armor: 0, gold: 2, dmg: 1, radius: 0.35, scale: 0.9, height: 0.75, color: 0xc060e0 },
  knight: { name: 'Kara Şövalye', hp: 120, speed: 1.9, armor: 45, gold: 13, dmg: 2, radius: 0.55, scale: 1.05, height: 1.85, color: 0x9aa6b8, armored: true },
  ogre:   { name: 'Ogre', hp: 230, speed: 1.4, armor: 12, gold: 20, dmg: 3, radius: 0.8, scale: 1.35, height: 2.35, color: 0x9c8a5a, armored: true },
  boss:   { name: 'İblis Lordu', hp: 1800, speed: 1.15, armor: 30, gold: 150, dmg: 6, radius: 1.2, scale: 1.7, height: 4.3, color: 0xff3030, armored: true, boss: true },
};

const HPBAR = {};
function initHpBars() {
  HPBAR.geoBg = new THREE.PlaneGeometry(1, 0.16);
  HPBAR.geoFg = new THREE.PlaneGeometry(1, 0.11);
  HPBAR.geoFg.translate(0.5, 0, 0);
  const base = { depthTest: false, depthWrite: false, transparent: true, toneMapped: false };
  HPBAR.matBg = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.65, ...base });
  HPBAR.matFg = new THREE.MeshBasicMaterial({ color: 0xff4a3a, ...base });
  HPBAR.matBoss = new THREE.MeshBasicMaterial({ color: 0xffa21a, ...base });
  HPBAR.matArmor = new THREE.MeshBasicMaterial({ color: 0xb8c4d6, ...base });
}

const _smp = { x: 0, z: 0, tx: 0, tz: 1 };
const _smp2 = { x: 0, z: 0, tx: 0, tz: 1 };

class Enemy {
  constructor(game, typeId, path, wave, lateral) {
    const T = ENEMY_TYPES[typeId];
    this.game = game; this.type = typeId; this.T = T; this.path = path;
    this.maxHp = this.hp = T.hp * WAVE_SCALE.hp(wave);
    this.armor = T.armor + (T.armored ? WAVE_SCALE.armor(wave) : 0);
    this.speed = T.speed * WAVE_SCALE.speed(wave) * rand(0.94, 1.06);
    this.gold = Math.max(1, Math.round(T.gold * WAVE_SCALE.gold(wave)));
    this.radius = T.radius;
    this.isBoss = !!T.boss;
    this.dist = 0; this.lateral = lateral;
    this.x = 0; this.z = 0; this.baseX = 0; this.baseZ = 0; this.tx = 0; this.tz = 1;
    this.dispX = 0; this.dispZ = 0; this.pullT = 0;
    this.dead = false; this.dying = 0; this.removed = false;
    this.burnDps = 0; this.burnT = 0; this.burnSrc = null;
    this.slowAmt = 0; this.slowT = 0;
    this.rootT = 0; this.blockT = 0;
    this.poison = 0; this.poisonDps = 0; this.poisonT = 0; this.poisonSrc = null;
    this.shred = 0; this.shredT = 0;
    this.curseT = 0; this.curseSrc = null; this.goldMark = null;
    this.decayAmt = 0; this.decayT = 0; this.kb = 0;
    this.flash = 0; this.walk = rand(0, 6); this.fxT = rand(0, 1);

    this.mat = MAT.vc.clone();
    this.mesh = new THREE.Mesh(Models.enemyGeometry(typeId), this.mat);
    this.mesh.castShadow = true;
    this.mesh.scale.setScalar(T.scale);
    this.group = new THREE.Group();
    this.group.add(this.mesh);

    const w = this.isBoss ? 2.6 : (T.scale > 1.2 ? 1.5 : 1.1);
    this.barW = w;
    this.hpBar = new THREE.Group();
    const bg = new THREE.Mesh(HPBAR.geoBg, HPBAR.matBg);
    bg.scale.x = w + 0.08;
    this.hpFg = new THREE.Mesh(HPBAR.geoFg, this.isBoss ? HPBAR.matBoss : HPBAR.matFg);
    this.hpFg.position.x = -w / 2;
    this.hpFg.position.z = 0.001;
    this.hpFg.scale.x = w;
    bg.renderOrder = 30; this.hpFg.renderOrder = 31;
    this.hpBar.add(bg, this.hpFg);
    this.hpBar.position.y = T.height + 0.4;
    this.hpBar.visible = this.isBoss;
    if (this.isBoss) this.hpBar.scale.setScalar(1.3);
    this.group.add(this.hpBar);
    game.scene.add(this.group);
    this.updatePosition(0);
  }

  get remaining() { return this.path.length - this.dist; }
  get targetable() { return !this.dead; }

  takeDamage(amount, opts) {
    if (this.dead || amount <= 0) return 0;
    let dmg = amount;
    const dot = opts && opts.dot;
    if (!dot) {
      const a = this.armor - this.shred;
      dmg *= a >= 0 ? 100 / (100 + a) : 2 - 100 / (100 - a);
      this.flash = 0.07;
    }
    this.hp -= dmg;
    const src = opts && opts.src;
    if (src) src.totalDamage += dmg;
    this.hpBar.visible = true;
    this.hpFg.scale.x = Math.max(0.001, (this.hp / this.maxHp) * this.barW);
    // Yaşam Tohumları: kule yetenekleri (temel atış ve DoT hariç) yakındaki tohumları patlatır
    if (!dot && src && src.isTower && !opts.basic && this.game.seeds.length) this.game.triggerSeeds(this.x, this.z);
    if (this.hp <= 0) this.die(src);
    return dmg;
  }

  die(src) {
    if (this.dead) return;
    this.dead = true;
    this.dying = 0.35;
    this.hpBar.visible = false;
    if (src) src.kills++;
    this.game.onEnemyKilled(this, src);
  }

  applyBurn(dps, dur, src) {
    if (this.dead) return;
    if (dps >= this.burnDps || this.burnT <= 0) { this.burnDps = dps; this.burnSrc = src; }
    this.burnT = Math.max(this.burnT, dur);
  }
  applySlow(amt, dur) {
    if (this.dead) return;
    amt = Math.min(amt, 0.85) * (this.isBoss ? 0.6 : 1);
    if (amt >= this.slowAmt || this.slowT <= 0) { this.slowAmt = amt; this.slowT = Math.max(this.slowT, dur); }
  }
  applyRoot(dur) {
    if (this.dead) return;
    if (this.isBoss) { this.applySlow(0.6, dur); return; }
    this.rootT = Math.max(this.rootT, dur);
  }
  addPoison(stacks, dpsPerStack, src) {
    if (this.dead || stacks <= 0) return;
    this.poison = Math.min(60, this.poison + stacks);
    this.poisonDps = Math.max(this.poisonDps, dpsPerStack);
    this.poisonT = 4;
    this.poisonSrc = src;
  }
  addShred(amount, cap, dur) {
    if (this.dead) return;
    if (this.shred < cap) this.shred = Math.min(cap, this.shred + amount);
    this.shredT = Math.max(this.shredT, dur);
  }
  knockback(d, smooth = false) {
    d *= this.isBoss ? 0.3 : 1;
    if (smooth) this.kb = Math.max(this.kb, d);
    else this.dist = Math.max(0, this.dist - d);
  }
  applyCurse(src, dur) {
    if (this.dead) return;
    this.curseT = Math.max(this.curseT, dur);
    this.curseSrc = src;
  }
  applyDecay(amt, dur) {
    if (this.dead) return;
    if (amt >= this.decayAmt || this.decayT <= 0) this.decayAmt = amt;
    this.decayT = Math.max(this.decayT, dur);
  }
  get leakDamage() { return this.T.dmg * (this.decayT > 0 ? 1 - this.decayAmt : 1); }
  pushBack(amount) {
    this.dist = Math.max(0, this.dist - amount * (this.isBoss ? 0.4 : 1));
    this.blockT = 0.1;
  }
  pull(cx, cz, dt, strength) {
    if (this.dead) return;
    if (this.isBoss) { this.applySlow(0.5, 0.2); return; }
    const k = Math.min(1, strength * dt);
    this.dispX += ((cx - this.baseX) * 0.8 - this.dispX) * k;
    this.dispZ += ((cz - this.baseZ) * 0.8 - this.dispZ) * k;
    this.pullT = 0.15;
    this.rootT = Math.max(this.rootT, 0.15);
  }

  // t saniye sonraki tahmini konum (yay atışları için)
  predict(t, out) {
    const moving = this.rootT > 0 || this.blockT > 0 ? 0 : 1 - this.slowAmt;
    this.path.sample(this.dist + this.speed * moving * t, _smp2);
    out.x = _smp2.x - _smp2.tz * this.lateral + this.dispX;
    out.z = _smp2.z + _smp2.tx * this.lateral + this.dispZ;
    return out;
  }

  update(dt, time) {
    if (this.dead) {
      this.dying -= dt;
      const k = Math.max(0.01, this.dying / 0.35);
      this.mesh.scale.setScalar(this.T.scale * k);
      this.mesh.rotation.x += dt * 4;
      if (this.sink) this.group.position.y -= dt * 6;
      if (this.dying <= 0) this.removed = true;
      return;
    }
    if (this.flash > 0) this.flash -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    if (this.blockT > 0) this.blockT -= dt;
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowAmt = 0; }
    if (this.shredT > 0) { this.shredT -= dt; if (this.shredT <= 0) this.shred = 0; }
    if (this.curseT > 0) this.curseT -= dt;
    if (this.decayT > 0) { this.decayT -= dt; if (this.decayT <= 0) this.decayAmt = 0; }
    if (this.kb > 0) { const s = Math.min(this.kb, 16 * dt); this.dist = Math.max(0, this.dist - s); this.kb -= s; }
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.takeDamage(this.burnDps * dt, { dot: true, src: this.burnSrc });
    }
    if (this.poison > 0 && !this.dead) {
      this.poisonT -= dt;
      this.takeDamage(this.poison * this.poisonDps * dt, { dot: true, src: this.poisonSrc });
      if (this.poisonT <= 0) { this.poison = 0; this.poisonDps = 0; }
    }
    if (this.dead) return;

    const mult = this.rootT > 0 || this.blockT > 0 ? 0 : 1 - this.slowAmt;
    this.dist += this.speed * mult * dt;
    if (this.dist >= this.path.length) { this.game.enemyLeaked(this); return; }
    if (this.pullT > 0) this.pullT -= dt;
    else if (this.dispX !== 0 || this.dispZ !== 0) {
      const k = Math.exp(-3 * dt);
      this.dispX *= k; this.dispZ *= k;
      if (Math.abs(this.dispX) + Math.abs(this.dispZ) < 0.01) this.dispX = this.dispZ = 0;
    }
    this.updatePosition(dt * mult);
    this.updateVisuals(dt, time);
  }

  updatePosition(animDt) {
    this.path.sample(this.dist, _smp);
    this.tx = _smp.tx; this.tz = _smp.tz;
    this.baseX = _smp.x - _smp.tz * this.lateral;
    this.baseZ = _smp.z + _smp.tx * this.lateral;
    this.x = this.baseX + this.dispX;
    this.z = this.baseZ + this.dispZ;
    this.group.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, Math.atan2(_smp.tx, _smp.tz), 0.15);
    this.walk += animDt * this.speed * 3.2;
    const s = Math.sin(this.walk), bob = Math.abs(s), sc = this.T.scale;
    if (this.type === 'slime') {
      this.mesh.position.y = bob * 0.28;
      this.mesh.scale.set(sc * (1 + 0.1 * (1 - bob)), sc * (0.85 + 0.25 * bob), sc * (1 + 0.1 * (1 - bob)));
    } else if (this.type === 'wolf') {
      this.mesh.position.y = bob * 0.12;
      this.mesh.rotation.x = s * 0.08;
    } else {
      this.mesh.position.y = bob * 0.1 * sc;
      this.mesh.rotation.z = s * 0.09;
    }
    if (this.kb > 0) this.mesh.position.y += Math.min(0.7, this.kb * 0.35);
  }

  updateVisuals(dt, time) {
    let r = 0, g = 0, b = 0;
    if (this.flash > 0) { r += 0.7; g += 0.7; b += 0.7; }
    if (this.burnT > 0) { const f = 0.55 + 0.3 * Math.sin(time * 18 + this.walk); r += 0.75 * f; g += 0.22 * f; }
    if (this.poison > 0) { g += 0.32; r += 0.06; }
    if (this.slowAmt > 0) { b += 0.5; g += 0.22; }
    if (this.rootT > 0 && this.pullT <= 0) { b += 0.5; g += 0.45; r += 0.25; }
    if (this.shred > 0) { r += 0.12; g += 0.1; }
    if (this.curseT > 0) { const f = 0.75 + 0.25 * Math.sin(time * 6 + this.walk); r += 0.32 * f; b += 0.6 * f; }
    if (this.decayT > 0) { r += 0.2; g += 0.1; }
    this.mat.emissive.setRGB(Math.min(r, 1), Math.min(g, 1), Math.min(b, 1));

    this.fxT -= dt;
    if (this.fxT <= 0) {
      this.fxT = 0.09;
      const h = this.T.height * 0.6;
      if (this.burnT > 0) {
        this.game.fxA.emit({ x: this.x + rand(-0.25, 0.25), y: h * rand(0.5, 1.1), z: this.z + rand(-0.25, 0.25), vy: rand(1.2, 2.2), life: rand(0.35, 0.6), size: rand(0.35, 0.55), size2: 0.05, color: choice([0xff6a10, 0xffa030, 0xff3a00]), alpha: 0.9 });
      }
      if (this.poison > 0 && Math.random() < 0.6) {
        this.game.fxA.emit({ x: this.x + rand(-0.3, 0.3), y: h * rand(0.4, 1), z: this.z + rand(-0.3, 0.3), vy: rand(0.5, 1.2), life: 0.6, size: rand(0.18, 0.3), size2: 0.35, color: 0x7dff3a, alpha: 0.7 });
      }
      if (this.slowAmt > 0 && Math.random() < 0.4) {
        this.game.fxA.emit({ x: this.x + rand(-0.35, 0.35), y: h * rand(0.3, 1.2), z: this.z + rand(-0.35, 0.35), vy: rand(-0.3, 0.3), life: 0.5, size: rand(0.15, 0.25), size2: 0, color: 0xbff0ff, alpha: 0.9 });
      }
      if (this.curseT > 0 && Math.random() < 0.35) {
        this.game.fxA.emit({ x: this.x + rand(-0.3, 0.3), y: h * rand(0.6, 1.4), z: this.z + rand(-0.3, 0.3), vy: rand(0.6, 1.2), life: 0.7, size: rand(0.2, 0.32), size2: 0, color: choice([0xa45cff, 0x7a2ad0, 0xd8b0ff]), alpha: 0.75 });
      }
      if (this.decayT > 0 && Math.random() < 0.3) {
        this.game.fxN.emit({ x: this.x + rand(-0.35, 0.35), y: h * rand(0.8, 1.3), z: this.z + rand(-0.35, 0.35), vx: rand(-0.4, 0.4), vy: rand(-0.6, -0.2), life: 0.9, size: rand(0.14, 0.22), size2: 0.08, color: choice([0x8a6a2a, 0x6a4a1e, 0xa8803a]), alpha: 0.85 });
      }
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.mat.dispose();
  }
}
