'use strict';

const ENEMY_TYPES = {
  slime:  { name: 'Küçük Slime', icon: '🟣', hp: 14, speed: 2.7, armor: 0, gold: 2, dmg: 1, radius: 0.35, scale: 0.9, height: 0.75, color: 0xc060e0 },
  goblin: { name: 'Goblin', icon: '👺', hp: 42, speed: 2.85, armor: 0, gold: 6, dmg: 1, radius: 0.45, scale: 1.0, height: 1.35, color: 0x6cc04a },
  wolf:   { name: 'Kurt', icon: '🐺', hp: 28, speed: 4.0, armor: 0, gold: 5, dmg: 1, radius: 0.45, scale: 1.0, height: 1.15, color: 0x8c8176 },
  rider:  { name: 'Kurt Binicisi', icon: '🐺', hp: 34, speed: 4.05, armor: 0, gold: 5, dmg: 1, radius: 0.5, scale: 1.0, height: 1.7, color: 0x8c8176,
            mounted: true, riderHp: 46, riderSpeed: 2.2, riderGold: 6, riderHeight: 1.35 },
  knight: { name: 'Bozulmuş Şövalye', icon: '🛡️', hp: 120, speed: 1.9, armor: 45, gold: 13, dmg: 2, radius: 0.55, scale: 1.05, height: 1.85, color: 0x9aa6b8, armored: true },
  orc:    { name: 'Ork', icon: '👹', hp: 260, speed: 1.35, armor: 14, gold: 18, dmg: 3, radius: 0.8, scale: 1.32, height: 2.3, color: 0x6a8a3a, armored: true },
  ogre:   { name: 'Ogre', icon: '👹', hp: 230, speed: 1.4, armor: 12, gold: 20, dmg: 3, radius: 0.8, scale: 1.35, height: 2.35, color: 0x9c8a5a, armored: true },
  priest: { name: 'Bozulmuş Rahip', icon: '⛪', hp: 95, speed: 1.7, armor: 6, gold: 16, dmg: 2, radius: 0.5, scale: 1.05, height: 1.9, color: 0x7ee0ff, healer: true, healCd: 2.6, healR: 5.4 },
  witch:  { name: 'Cadı', icon: '🧙', hp: 88, speed: 1.75, armor: 4, gold: 17, dmg: 2, radius: 0.48, scale: 1.0, height: 1.95, color: 0xb26bff, summoner: true, summonCd: 6.2, summonMax: 3 },
  golem:  { name: 'Golem', icon: '🪨', hp: 480, speed: 1.12, armor: 28, gold: 28, dmg: 4, radius: 0.95, scale: 1.45, height: 2.55, color: 0x8a8478, armored: true },
  skeleton:{ name: 'İskelet', icon: '💀', hp: 22, speed: 2.95, armor: 0, gold: 1, dmg: 1, radius: 0.38, scale: 0.92, height: 1.15, color: 0xf2eadc, summoned: true },
  boss:   { name: 'İblis Lordu', icon: '👿', hp: 1800, speed: 1.15, armor: 30, gold: 150, dmg: 6, radius: 1.2, scale: 1.7, height: 4.3, color: 0xff3030, armored: true, boss: true },
};

function damageElem(opts) {
  if (!opts) return null;
  if (opts.elem) return opts.elem;
  const src = opts.src;
  if (src && src.isTower) return src.type;
  if (src && src.elem) return src.elem;
  return null;
}

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
  HPBAR.imm = {};
}
function hpMatFor(immune, boss) {
  if (immune && TOWER_TYPES[immune]) {
    if (!HPBAR.imm[immune]) {
      HPBAR.imm[immune] = new THREE.MeshBasicMaterial({ color: TOWER_TYPES[immune].hex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
    }
    return HPBAR.imm[immune];
  }
  return boss ? HPBAR.matBoss : HPBAR.matFg;
}

const _smp = { x: 0, z: 0, tx: 0, tz: 1 };
const _smp2 = { x: 0, z: 0, tx: 0, tz: 1 };

class Enemy {
  constructor(game, typeId, path, wave, lateral, extra) {
    extra = extra || {};
    const T = ENEMY_TYPES[typeId];
    this.game = game; this.type = typeId; this.T = T; this.path = path; this.wave = wave;
    this.maxHp = this.hp = T.hp * WAVE_SCALE.hp(wave);
    this.armor = T.armor + (T.armored ? WAVE_SCALE.armor(wave) : 0);
    this.speed = T.speed * WAVE_SCALE.speed(wave) * rand(0.94, 1.06);
    this.gold = Math.max(1, Math.round(T.gold * WAVE_SCALE.gold(wave)));
    this.radius = T.radius;
    this.isBoss = !!T.boss;
    this.dist = extra.dist != null ? extra.dist : 0; this.lateral = lateral;
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
    this.immune = extra.immune || null;
    this.immFlash = 0;
    this.mounted = !!T.mounted;
    this.summoner = extra.summoner || null;
    this.summoned = !!T.summoned || !!extra.summoned;
    this.summons = 0;
    this.castT = T.healer || T.summoner ? rand(0.8, 1.8) : 0;

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
    this.hpFg = new THREE.Mesh(HPBAR.geoFg, hpMatFor(this.immune, this.isBoss));
    this.hpFg.position.x = -w / 2;
    this.hpFg.position.z = 0.001;
    this.hpFg.scale.x = w;
    bg.renderOrder = 30; this.hpFg.renderOrder = 31;
    this.hpBar.add(bg, this.hpFg);
    this.hpBar.position.y = T.height + 0.4;
    this.hpBar.visible = this.isBoss;
    if (this.isBoss) this.hpBar.scale.setScalar(1.3);
    this.group.add(this.hpBar);

    if (this.immune && TOWER_TYPES[this.immune]) {
      const hex = TOWER_TYPES[this.immune].hex;
      this.immGlow = glowSprite(hex, this.isBoss ? 2.6 : 1.55, 0.5);
      this.immGlow.position.y = 0.15;
      this.group.add(this.immGlow);
    }

    game.scene.add(this.group);
    this.updatePosition(0);
  }

  get remaining() { return this.path.length - this.dist; }
  get targetable() { return !this.dead; }
  get visHeight() { return this.mounted ? this.T.height : (this.T.riderHeight || this.T.height); }
  immuneTo(elem) { return !!(elem && this.immune === elem); }
  blockedBy(src, elem) { return this.immuneTo(elem || damageElem({ src })); }

  takeDamage(amount, opts) {
    if (this.dead || amount <= 0) return 0;
    const src = opts && opts.src;
    const elem = damageElem(opts);
    if (this.immuneTo(elem)) {
      this.onImmuneHit(elem);
      return 0;
    }
    let dmg = amount;
    const dot = opts && opts.dot;
    if (!dot) {
      const a = this.armor - this.shred;
      dmg *= a >= 0 ? 100 / (100 + a) : 2 - 100 / (100 - a);
      this.flash = 0.07;
    }
    this.hp -= dmg;
    if (src) src.totalDamage += dmg;
    this.hpBar.visible = true;
    this.hpFg.scale.x = Math.max(0.001, (this.hp / this.maxHp) * this.barW);
    if (!dot && src && src.isTower && !opts.basic && this.game.seeds.length) this.game.triggerSeeds(this.x, this.z);
    if (this.hp <= 0) this.die(src);
    return dmg;
  }

  onImmuneHit(elem) {
    if (this.immFlash > 0) return;
    this.immFlash = 0.55;
    const tw = TOWER_TYPES[elem];
    this.game.ui.floatText(this.x, this.visHeight + 0.5, this.z, (tw ? tw.icon + ' ' : '') + 'BAĞIŞIK', tw ? tw.color : '#fff', 13);
    Sound.play('immune', 0.45);
  }

  die(src) {
    if (this.dead) return;
    if (this.mounted) { this.dismount(); return; }
    this.dead = true;
    this.dying = 0.35;
    this.hpBar.visible = false;
    if (this.immGlow) this.immGlow.visible = false;
    if (this.summoner) this.summoner.summons = Math.max(0, this.summoner.summons - 1);
    if (src) src.kills++;
    this.game.onEnemyKilled(this, src);
  }

  dismount() {
    this.mounted = false;
    const wolfGold = Math.max(1, Math.round(this.gold));
    this.game.addGold(wolfGold);
    this.game.ui.floatText(this.x, this.T.height + 0.4, this.z, `+${wolfGold}`, '#ffd451', 13);
    this.game.fxN.burst(this.x, 0.5, this.z, 14, { color: 0x8c8176, speed: 2.6, life: 0.55, size: 0.28, gravity: 5 });
    Sound.play('dismount', 0.7);
    this.gold = Math.max(1, Math.round((this.T.riderGold || 6) * WAVE_SCALE.gold(this.wave)));
    this.speed = this.T.riderSpeed * WAVE_SCALE.speed(this.wave) * rand(0.94, 1.06);
    this.maxHp = this.hp = this.T.riderHp * WAVE_SCALE.hp(this.wave);
    this.radius = 0.45;
    this.mesh.geometry = Models.enemyGeometry('rider_down');
    this.mesh.scale.setScalar(1);
    this.hpBar.position.y = (this.T.riderHeight || 1.35) + 0.4;
    this.hpFg.scale.x = this.barW;
    this.hpBar.visible = true;
    this.mesh.rotation.x = 0;
    this.mesh.rotation.z = 0;
  }

  applyBurn(dps, dur, src) {
    if (this.dead || this.immuneTo('fire')) return;
    if (dps >= this.burnDps || this.burnT <= 0) { this.burnDps = dps; this.burnSrc = src; }
    this.burnT = Math.max(this.burnT, dur);
  }
  applySlow(amt, dur, src) {
    if (this.dead || this.blockedBy(src, src && src.isTower ? src.type : null)) return;
    amt = Math.min(amt, 0.85) * (this.isBoss ? 0.6 : 1);
    if (amt >= this.slowAmt || this.slowT <= 0) { this.slowAmt = amt; this.slowT = Math.max(this.slowT, dur); }
  }
  applyRoot(dur, src) {
    if (this.dead || this.blockedBy(src, src && src.isTower ? src.type : null)) return;
    if (this.isBoss) { this.applySlow(0.6, dur, src); return; }
    this.rootT = Math.max(this.rootT, dur);
  }
  addPoison(stacks, dpsPerStack, src) {
    if (this.dead || stacks <= 0) return;
    const el = src && src.isTower ? src.type : 'acid';
    if (this.immuneTo(el)) return;
    this.poison = Math.min(60, this.poison + stacks);
    this.poisonDps = Math.max(this.poisonDps, dpsPerStack);
    this.poisonT = 4;
    this.poisonSrc = src;
  }
  addShred(amount, cap, dur, src) {
    if (this.dead || this.immuneTo('acid')) return;
    if (this.shred < cap) this.shred = Math.min(cap, this.shred + amount);
    this.shredT = Math.max(this.shredT, dur);
  }
  knockback(d, smooth = false, src) {
    if (this.blockedBy(src, src && src.isTower ? src.type : null)) return;
    d *= this.isBoss ? 0.3 : 1;
    if (smooth) this.kb = Math.max(this.kb, d);
    else this.dist = Math.max(0, this.dist - d);
  }
  applyCurse(src, dur) {
    if (this.dead || this.immuneTo('death')) return;
    this.curseT = Math.max(this.curseT, dur);
    this.curseSrc = src;
  }
  applyDecay(amt, dur, src) {
    if (this.dead || this.immuneTo('life')) return;
    if (amt >= this.decayAmt || this.decayT <= 0) this.decayAmt = amt;
    this.decayT = Math.max(this.decayT, dur);
  }
  get leakDamage() { return this.T.dmg * (this.decayT > 0 ? 1 - this.decayAmt : 1); }
  pushBack(amount) {
    this.dist = Math.max(0, this.dist - amount * (this.isBoss ? 0.4 : 1));
    this.blockT = 0.1;
  }
  pull(cx, cz, dt, strength, src) {
    if (this.dead || this.blockedBy(src, src && src.isTower ? src.type : null)) return;
    if (this.isBoss) { this.applySlow(0.5, 0.2, src); return; }
    const k = Math.min(1, strength * dt);
    this.dispX += ((cx - this.baseX) * 0.8 - this.dispX) * k;
    this.dispZ += ((cz - this.baseZ) * 0.8 - this.dispZ) * k;
    this.pullT = 0.15;
    this.rootT = Math.max(this.rootT, 0.15);
  }

  predict(t, out) {
    const moving = this.rootT > 0 || this.blockT > 0 ? 0 : 1 - this.slowAmt;
    this.path.sample(this.dist + this.speed * moving * t, _smp2);
    out.x = _smp2.x - _smp2.tz * this.lateral + this.dispX;
    out.z = _smp2.z + _smp2.tx * this.lateral + this.dispZ;
    return out;
  }

  pulseHeal() {
    const g = this.game, r2 = this.T.healR * this.T.healR;
    let n = 0;
    const amtMul = 0.045 * WAVE_SCALE.hp(this.wave);
    for (const e of g.enemies) {
      if (e.dead || e === this) continue;
      if (dist2(e.x, e.z, this.x, this.z) > r2) continue;
      const heal = Math.max(8, e.maxHp * amtMul);
      if (e.hp >= e.maxHp) continue;
      e.hp = Math.min(e.maxHp, e.hp + heal);
      e.hpBar.visible = true;
      e.hpFg.scale.x = Math.max(0.001, (e.hp / e.maxHp) * e.barW);
      n++;
    }
    g.addFx(new RingPulseFx(g, this.x, this.z, this.T.healR * 0.7, 0x7ee0ff, 0.45));
    g.fxA.burst(this.x, this.T.height * 0.7, this.z, 10, { color: 0x9ee8ff, speed: 1.8, life: 0.5, size: 0.22, gravity: -1 });
    if (n) Sound.play('heal', 0.55);
    this.castFlash = 0.35;
  }

  summonSkeleton() {
    if (this.summons >= this.T.summonMax) return;
    const g = this.game;
    let skelN = 0;
    for (const e of g.enemies) if (!e.dead && e.type === 'skeleton') skelN++;
    if (skelN >= 24) return;
    const e = g.spawnEnemy('skeleton', this.path, this.wave, this.lateral + rand(-0.5, 0.5), {
      dist: Math.max(0, this.dist - rand(0.4, 1.2)), summoner: this, summoned: true, immune: this.immune,
    });
    this.summons++;
    g.fxA.burst(e.x, 0.6, e.z, 12, { color: 0xd8b0ff, speed: 2.2, life: 0.45, size: 0.22, gravity: 2 });
    Sound.play('summon', 0.65);
    this.castFlash = 0.4;
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
    if (this.immFlash > 0) this.immFlash -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    if (this.blockT > 0) this.blockT -= dt;
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowAmt = 0; }
    if (this.shredT > 0) { this.shredT -= dt; if (this.shredT <= 0) this.shred = 0; }
    if (this.curseT > 0) this.curseT -= dt;
    if (this.decayT > 0) { this.decayT -= dt; if (this.decayT <= 0) this.decayAmt = 0; }
    if (this.kb > 0) { const s = Math.min(this.kb, 16 * dt); this.dist = Math.max(0, this.dist - s); this.kb -= s; }
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.takeDamage(this.burnDps * dt, { dot: true, src: this.burnSrc, elem: 'fire' });
    }
    if (this.poison > 0 && !this.dead) {
      this.poisonT -= dt;
      const pel = this.poisonSrc && this.poisonSrc.isTower ? this.poisonSrc.type : 'acid';
      this.takeDamage(this.poison * this.poisonDps * dt, { dot: true, src: this.poisonSrc, elem: pel });
      if (this.poisonT <= 0) { this.poison = 0; this.poisonDps = 0; }
    }
    if (this.dead) return;

    if (this.T.healer) {
      this.castT -= dt;
      if (this.castT <= 0) { this.castT = this.T.healCd; this.pulseHeal(); }
    }
    if (this.T.summoner) {
      this.castT -= dt;
      if (this.castT <= 0) { this.castT = Math.max(3.4, this.T.summonCd - this.wave * 0.08); this.summonSkeleton(); }
    }
    if (this.castFlash > 0) this.castFlash -= dt;

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
    const s = Math.sin(this.walk), bob = Math.abs(s), sc = this.mounted ? this.T.scale : (this.type === 'rider' ? 1 : this.T.scale);
    if (this.type === 'slime') {
      this.mesh.position.y = bob * 0.28;
      this.mesh.scale.set(sc * (1 + 0.1 * (1 - bob)), sc * (0.85 + 0.25 * bob), sc * (1 + 0.1 * (1 - bob)));
    } else if (this.type === 'wolf' || this.mounted) {
      this.mesh.position.y = bob * 0.12;
      this.mesh.rotation.x = s * 0.08;
    } else if (this.type === 'golem') {
      this.mesh.position.y = bob * 0.04;
      this.mesh.rotation.z = s * 0.04;
    } else {
      this.mesh.position.y = bob * 0.1 * sc;
      this.mesh.rotation.z = s * 0.09;
    }
    if (this.kb > 0) this.mesh.position.y += Math.min(0.7, this.kb * 0.35);
  }

  updateVisuals(dt, time) {
    let r = 0, g = 0, b = 0;
    if (this.immune && TOWER_TYPES[this.immune]) {
      const hex = TOWER_TYPES[this.immune].hex;
      const p = 0.18 + 0.08 * Math.sin(time * 3 + this.walk);
      r += ((hex >> 16) & 255) / 255 * p;
      g += ((hex >> 8) & 255) / 255 * p;
      b += (hex & 255) / 255 * p;
    }
    if (this.flash > 0) { r += 0.7; g += 0.7; b += 0.7; }
    if (this.immFlash > 0) { r += 0.4; g += 0.4; b += 0.4; }
    if (this.castFlash > 0) { r += 0.25; g += 0.45; b += 0.5; }
    if (this.burnT > 0) { const f = 0.55 + 0.3 * Math.sin(time * 18 + this.walk); r += 0.75 * f; g += 0.22 * f; }
    if (this.poison > 0) { g += 0.32; r += 0.06; }
    if (this.slowAmt > 0) { b += 0.5; g += 0.22; }
    if (this.rootT > 0 && this.pullT <= 0) { b += 0.5; g += 0.45; r += 0.25; }
    if (this.shred > 0) { r += 0.12; g += 0.1; }
    if (this.curseT > 0) { const f = 0.75 + 0.25 * Math.sin(time * 6 + this.walk); r += 0.32 * f; b += 0.6 * f; }
    if (this.decayT > 0) { r += 0.2; g += 0.1; }
    this.mat.emissive.setRGB(Math.min(r, 1), Math.min(g, 1), Math.min(b, 1));

    if (this.immGlow) {
      const s = (this.isBoss ? 2.6 : 1.55) * (1 + 0.12 * Math.sin(time * 4 + this.walk));
      this.immGlow.scale.set(s, s, 1);
      this.immGlow.material.opacity = 0.4 + 0.18 * Math.sin(time * 5);
    }

    this.fxT -= dt;
    if (this.fxT <= 0) {
      this.fxT = 0.09;
      const h = this.visHeight * 0.6;
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
      if (this.immune && Math.random() < 0.25) {
        const hex = TOWER_TYPES[this.immune] ? TOWER_TYPES[this.immune].hex : 0xffffff;
        this.game.fxA.emit({ x: this.x + rand(-0.35, 0.35), y: h * rand(0.2, 1.1), z: this.z + rand(-0.35, 0.35), vy: rand(0.4, 1.1), life: 0.5, size: rand(0.12, 0.2), size2: 0, color: hex, alpha: 0.7 });
      }
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.mat.dispose();
    if (this.immGlow && this.immGlow.material) this.immGlow.material.dispose();
  }
}
