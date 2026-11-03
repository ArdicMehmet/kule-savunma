'use strict';

const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

class Tower {
  constructor(game, x, z) {
    this.game = game; this.x = x; this.z = z;
    this.type = null; this.level = 0;
    this.isTower = true;
    this.cards = { as: 0, dmg: 0, range: 0, special: 0, l_poison: 0, l_haste: 0, l_summon: 0 };
    this.abilities = {};
    this.spent = 0; this.totalDamage = 0; this.kills = 0;
    this.souls = 0; this.zombies = 0; this.fairies = 0; this.seedCount = 0;
    this.buffHaste = 0; this.buffPoison = 0; this.buffSummon = 1; this.buffFrom = null; this.buffFxT = rand(0, 0.5);
    this.attackTimer = 0.3; this.overloadT = 0; this.overloadBonus = 0;
    this.castT = 0; this.buildT = 1; this.time = rand(0, 10); this.emberT = 0;
    this.frozenT = 0; this.waveFrozen = false; this.iceLock = null;
    this.removed = false;
    this.radius = CFG.foundationRadius;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.base = Models.foundation();
    this.group.add(this.base);
    this.top = null; this.anim = null; this.baseMuzzleY = 1; this.muzzleY = 1;
    this.label = makeTextSprite('TEMEL', { color: '#9fe8ff', font: 30, w: 192, h: 56, sx: 2.2, sy: 0.64 });
    this.label.position.y = 1.7;
    this.group.add(this.label);
    game.scene.add(this.group);
    this.recalc();
  }

  get isFoundation() { return !this.type; }
  get def() { return TOWER_TYPES[this.type]; }
  get name() { return this.type ? this.def.name : 'Kule Temeli'; }
  get icon() { return this.type ? this.def.icon : '🧱'; }
  get isSupport() { return !!(this.type && this.def.support); }
  get currentRate() { return this.rate * (1 + this.buffHaste) * (this.overloadT > 0 ? 1 + this.overloadBonus : 1); }
  levelScale() { return 1 + Math.min(0.3, 0.025 * Math.max(0, this.level - 1)); }

  setType(type) {
    this.type = type;
    this.level = 1;
    const t = Models.towerTop(type);
    this.top = t.group; this.anim = t.anim; this.baseMuzzleY = t.muzzleY;
    this.top.scale.setScalar(0.01);
    this.buildT = 0;
    this.group.add(this.top);
    this.base.userData.rune.visible = false;
    this.recalc();
    this.updateLabel();
  }

  recalc() {
    const c = this.cards;
    this.burnMult = 1; this.slowBonus = 0; this.bounces = 0; this.shredPerHit = 0; this.shredCap = 0;
    this.soulsPerKill = 0; this.auraHaste = 0; this.auraPoison = 0; this.auraSummon = 0;
    if (!this.type) {
      this.range = 0; this.damage = 0; this.rate = 0; this.dmgMult = 1;
      return;
    }
    const b = this.def.base;
    this.muzzleY = this.baseMuzzleY * this.levelScale();
    if (this.isSupport) {
      this.dmgMult = 1 + 0.06 * (this.level - 1);
      this.damage = 0; this.rate = 0;
      this.range = b.range + Math.min(3, 0.2 * (this.level - 1));
      this.auraHaste = 0.08 + 0.07 * c.l_haste;
      this.auraPoison = Math.min(0.56, 0.08 * c.l_poison);
      this.auraSummon = 0.25 * c.l_summon;
      return;
    }
    const sp = (t) => (this.type === t ? c.special : 0);
    const soulMult = this.type === 'death' ? 1 + soulBonus(this.souls) : 1;
    this.dmgMult = (1 + 0.15 * c.dmg) * (1 + 0.04 * (this.level - 1)) * soulMult;
    this.damage = b.damage * this.dmgMult;
    this.rate = b.rate * (1 + 0.12 * c.as);
    this.range = b.range * (1 + 0.08 * Math.min(c.range, BASIC_CARDS.range.max));
    this.burnMult = 1 + 0.25 * sp('fire');
    this.slowBonus = 0.06 * sp('ice');
    this.bounces = Math.min(12, 2 + sp('storm'));
    this.shredPerHit = 3 * (1 + 0.5 * sp('acid'));
    this.shredCap = 24 + 8 * sp('acid');
    this.soulsPerKill = 1 + sp('death');
  }

  addSouls(n) {
    this.souls += n;
    this.recalc();
  }

  updateLabel() {
    if (!this.type) { this.label.userData.draw('TEMEL'); this.label.position.y = 1.7; return; }
    this.label.userData.draw('Sv. ' + this.level);
    this.label.position.y = this.muzzleY + 1.35;
  }

  // ---------- Hedefleme ----------
  firstTarget(range) { return this.game.firstEnemy(this.x, this.z, range); }
  clusterTarget(range, r) { return this.game.clusterTarget(this.x, this.z, range, r); }
  enemiesInRange(range) { return this.game.enemiesInRadius(this.x, this.z, range); }
  castAnim() { this.castT = 1; }

  freeze(dur, waveLock) {
    this.frozenT = Math.max(this.frozenT || 0, dur);
    if (waveLock) this.waveFrozen = true;
    if (!this.iceLock) {
      this.iceLock = glowSprite(0xbfeeff, 4.2, 0.7);
      this.iceLock.position.y = 2.4;
      this.group.add(this.iceLock);
    }
    this.iceLock.visible = true;
  }
  unfreeze() {
    this.frozenT = 0;
    this.waveFrozen = false;
    if (this.iceLock) this.iceLock.visible = false;
  }
  get isFrozen() { return this.waveFrozen || this.frozenT > 0; }

  // ---------- Güncelleme ----------
  update(dt) {
    this.time += dt;
    this.animate(dt);
    if (this.isFrozen) {
      if (this.iceLock) this.iceLock.material.opacity = 0.4 + 0.25 * Math.sin(this.time * 6);
      if (!this.waveFrozen) {
        this.frozenT -= dt;
        if (this.frozenT <= 0) this.unfreeze();
      }
      return;
    }
    if (!this.type) return;
    if (!this.isSupport) {
      if (this.overloadT > 0) this.overloadT -= dt;
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        const t = this.firstTarget(this.range);
        if (t) {
          this.attack(t);
          this.attackTimer = Math.max(0.02, this.attackTimer + 1 / this.currentRate);
        } else this.attackTimer = 0;
      }
    }
    for (const id in this.abilities) ABILITY_IMPL[id].update(this, this.abilities[id], dt);
  }

  // Temel atış isabeti: yetenek sayılmaz (tohum patlatmaz); Yaşam Kulesi bufu varsa zehir şansı
  basicHit(e, dmg) {
    e.takeDamage(dmg, { src: this, basic: true });
    if (this.buffPoison > 0 && !e.dead && Math.random() < this.buffPoison) {
      const L = this.buffFrom;
      e.addPoison(2 + Math.floor(L.cards.l_poison / 2), poisonDps(L), L);
    }
  }

  attack(t) {
    const g = this.game;
    const mx = this.x, my = this.muzzleY, mz = this.z;
    switch (this.type) {
      case 'fire':
        g.addProjectile(new Projectile(g, {
          kind: 'fire', x: mx, y: my, z: mz, target: t, speed: 18,
          onHit: (x, y, z, e) => {
            if (e) { this.basicHit(e, this.damage); e.applyBurn(this.damage * 0.4 * this.burnMult, 3, this); }
            g.fxA.burst(x, y, z, 16, { color: 0xff8a30, speed: 4.2, life: 0.5, size: 0.48, gravity: 1.2 });
            g.fxA.burst(x, y, z, 6, { color: 0xffee66, speed: 2.4, life: 0.35, size: 0.28, gravity: -1 });
          },
        }));
        Sound.play('fire_shot');
        break;
      case 'ice':
        g.addProjectile(new Projectile(g, {
          kind: 'ice', x: mx, y: my, z: mz, target: t, speed: 22,
          onHit: (x, y, z, e) => {
            if (e) { this.basicHit(e, this.damage); e.applySlow(0.3 + this.slowBonus, 1.6, this); }
            g.fxA.burst(x, y, z, 16, { color: 0xbff0ff, speed: 3.6, life: 0.5, size: 0.38, gravity: 2 });
            g.fxA.burst(x, y, z, 6, { color: 0xffffff, speed: 1.8, life: 0.4, size: 0.22, gravity: 0.5 });
          },
        }));
        Sound.play('ice_shot');
        break;
      case 'death':
        g.addProjectile(new Projectile(g, {
          kind: 'death', x: mx, y: my, z: mz, target: t, speed: 17,
          onHit: (x, y, z, e) => {
            if (e) { e.applyCurse(this, 6); this.basicHit(e, this.damage); }
            g.fxA.burst(x, y, z, 14, { color: choice(DEATH_COLORS), speed: 3.2, life: 0.5, size: 0.42, gravity: -1.5 });
          },
        }));
        Sound.play('curse', 0.85);
        break;
      case 'storm':
        this.chainLightning(t);
        Sound.play('zap');
        Sound.play('thunder', 0.28);
        break;
      case 'acid': {
        const pr = t.predict(0.6, {});
        g.addProjectile(new Projectile(g, {
          kind: 'acid', x: mx, y: my, z: mz, tx: pr.x, tz: pr.z, arc: true, dur: 0.6, arcH: 2.5,
          onHit: (x, y, z) => {
            for (const e of g.enemiesInRadius(x, z, 1.8)) {
              this.basicHit(e, this.damage);
              e.addShred(this.shredPerHit, this.shredCap, 5);
            }
            acidSplash(g, x, z, 1.8);
            Sound.play('splash', 0.5);
          },
        }));
        Sound.play('acid_shot');
        break;
      }
    }
  }

  chainLightning(first) {
    const g = this.game;
    const hits = [first];
    let cur = first;
    for (let i = 0; i < this.bounces; i++) {
      let best = null, bd = 4.5 * 4.5;
      for (const e of g.enemiesInRadius(cur.x, cur.z, 4.5)) {
        if (hits.includes(e)) continue;
        const d = dist2(cur.x, cur.z, e.x, e.z);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hits.push(best);
      cur = best;
    }
    const pts = [new THREE.Vector3(this.x, this.muzzleY, this.z)];
    hits.forEach((e, i) => {
      const y = e.T.height * 0.6;
      pts.push(new THREE.Vector3(e.x, y, e.z));
      this.basicHit(e, this.damage * Math.max(0.4, 1 - 0.12 * i));
      sparkBurst(g, e.x, y, e.z, 14);
    });
    g.addFx(new LightningFx(g, pts, 0xb48cff, 0.07, 0.18, 0.35));
  }

  animate(dt) {
    const t = this.time;
    if (!this.type) {
      const rune = this.base.userData.rune;
      rune.material.opacity = 0.5 + 0.35 * Math.sin(t * 3);
      rune.rotation.z += dt * 0.6;
      return;
    }
    this.castT = Math.max(0, this.castT - dt * 3);
    if (this.buildT < 1) this.buildT = Math.min(1, this.buildT + dt * 2.2);
    this.top.scale.setScalar(easeOutBack(this.buildT) * this.levelScale() * (1 + this.castT * 0.08));
    const P = this.anim.parts, g = this.game;
    const s = this.levelScale();
    switch (this.type) {
      case 'fire':
        P.flame.scale.set(1 + Math.sin(t * 13) * 0.08, 1 + Math.sin(t * 17) * 0.15 + this.castT * 0.7, 1 + Math.cos(t * 11) * 0.08);
        P.glow.material.opacity = 0.75 + Math.sin(t * 11) * 0.15;
        P.glow.scale.setScalar(3.4 + this.castT * 2);
        this.emberT -= dt;
        if (this.emberT <= 0) {
          this.emberT = 0.12;
          g.fxA.emit({ x: this.x + rand(-0.4, 0.4), y: 4.6 * s, z: this.z + rand(-0.4, 0.4), vx: rand(-0.3, 0.3), vy: rand(1, 2.2), vz: rand(-0.3, 0.3), life: rand(0.5, 1), size: rand(0.12, 0.22), size2: 0, color: choice(FIRE_COLORS) });
        }
        break;
      case 'ice': {
        P.crystal.rotation.y += dt * 1.2;
        P.crystal.position.y = 4.55 + Math.sin(t * 2) * 0.12;
        P.shards.forEach((m, i) => {
          const a = t * 1.5 + i * 2.094;
          m.position.set(Math.cos(a) * 0.85, 4.55 + Math.sin(t * 3 + i) * 0.2, Math.sin(a) * 0.85);
          m.rotation.y = a;
        });
        P.glow.scale.setScalar(2.6 + this.castT * 2);
        break;
      }
      case 'storm': {
        const ov = this.overloadT > 0 ? 1 : 0;
        P.orb.scale.setScalar(1 + Math.sin(t * 9) * 0.06 + ov * 0.25 + this.castT * 0.3);
        P.r1.rotation.set(t * 2, t * 1.3, 0);
        P.r2.rotation.set(Math.PI / 2 + Math.sin(t) * 0.5, 0, t * 1.7);
        P.glow.scale.setScalar(3.2 + ov * 1.5 + this.castT * 2 + Math.sin(t * 20) * 0.2);
        this.emberT -= dt;
        if (this.emberT <= 0) {
          this.emberT = ov ? 0.05 : 0.25;
          const a = rand(0, Math.PI * 2);
          g.fxA.emit({ x: this.x + Math.cos(a) * 0.4 * s, y: 4.4 * s, z: this.z + Math.sin(a) * 0.4 * s, vx: Math.cos(a) * 2, vy: rand(-0.5, 1.5), vz: Math.sin(a) * 2, life: 0.2, size: 0.2, size2: 0, color: choice(STORM_COLORS) });
        }
        break;
      }
      case 'acid':
        P.surf.position.y = 3.5 + Math.sin(t * 2) * 0.03;
        P.glow.scale.setScalar(2.4 + this.castT * 1.5);
        this.emberT -= dt;
        if (this.emberT <= 0) {
          this.emberT = 0.15;
          g.fxA.emit({ x: this.x + rand(-0.5, 0.5) * s, y: 3.6 * s, z: this.z + rand(-0.5, 0.5) * s, vy: rand(0.4, 1), life: 0.6, size: rand(0.12, 0.22), size2: 0.3, color: choice(ACID_COLORS), alpha: 0.8 });
        }
        break;
      case 'death': {
        const cy = 4.35 + Math.sin(t * 2) * 0.1;
        P.core.position.y = cy;
        P.core.scale.setScalar(1 + this.castT * 0.35 + Math.sin(t * 5) * 0.04);
        P.ring.position.y = cy;
        P.ring.rotation.set(Math.PI / 2 + Math.sin(t * 0.8) * 0.45, t * 1.2, 0);
        P.wisps.forEach((w, i) => {
          const a = t * 1.6 + i * 2.094;
          w.position.set(Math.cos(a) * 0.95, cy - 0.15 + Math.sin(t * 2.5 + i) * 0.35, Math.sin(a) * 0.95);
        });
        P.glow.position.y = cy;
        P.glow.scale.setScalar(3 + this.castT * 1.8 + Math.min(1.5, this.souls * 0.004) + Math.sin(t * 3) * 0.15);
        this.emberT -= dt;
        if (this.emberT <= 0) {
          this.emberT = 0.18;
          const a = rand(0, Math.PI * 2);
          g.fxA.emit({ x: this.x + Math.cos(a) * 0.8 * s, y: 3.9 * s, z: this.z + Math.sin(a) * 0.8 * s, vx: -Math.cos(a) * 0.5, vy: rand(0.6, 1.3), vz: -Math.sin(a) * 0.5, life: rand(0.6, 1), size: rand(0.14, 0.24), size2: 0, color: choice(DEATH_COLORS), alpha: 0.8 });
        }
        break;
      }
      case 'life': {
        P.canopy.rotation.z = Math.sin(t * 1.1) * 0.05;
        P.canopy.rotation.x = Math.cos(t * 0.9) * 0.035;
        P.canopy.scale.setScalar(1 + this.castT * 0.1 + Math.sin(t * 1.7) * 0.015);
        P.bloom.rotation.y += dt * 1.5;
        P.bloom.position.y = 4.55 + Math.sin(t * 2) * 0.08;
        P.leaves.forEach((l, i) => {
          const a = t * 0.9 + i * Math.PI / 2;
          l.position.set(Math.cos(a) * 1.65, 3.1 + Math.sin(t * 1.7 + i) * 0.5, Math.sin(a) * 1.65);
          l.rotation.set(t * 2 + i, a, Math.sin(t * 4 + i) * 0.6);
        });
        P.glow.scale.setScalar(3.2 + this.castT * 1.8 + Math.sin(t * 2) * 0.2);
        this.emberT -= dt;
        if (this.emberT <= 0) {
          this.emberT = 0.22;
          const a = rand(0, Math.PI * 2), r = rand(0.4, 1.4) * s;
          g.fxA.emit({ x: this.x + Math.cos(a) * r, y: rand(2.8, 4.2) * s, z: this.z + Math.sin(a) * r, vx: rand(-0.2, 0.2), vy: rand(0.2, 0.6), vz: rand(-0.2, 0.2), life: rand(0.9, 1.5), size: rand(0.1, 0.18), size2: 0, color: choice(LIFE_COLORS), alpha: 0.85 });
        }
        break;
      }
    }
    if (this.buffFrom) {
      this.buffFxT -= dt;
      if (this.buffFxT <= 0) {
        this.buffFxT = 0.4;
        const a = rand(0, Math.PI * 2);
        g.fxA.emit({ x: this.x + Math.cos(a) * 1.1, y: rand(0.5, 1.6), z: this.z + Math.sin(a) * 1.1, vy: rand(0.5, 1), life: 0.9, size: rand(0.12, 0.18), size2: 0, color: choice(LIFE_COLORS), alpha: 0.75 });
      }
    }
  }

  // ---------- Kartlar ----------
  upgradeCost() { return this.type ? CFG.upgradeCost(this.level) : CFG.towerChoiceCost; }
  sellValue() { return Math.floor(this.spent * (this.game.sellRatio != null ? this.game.sellRatio : CFG.sellRatio)); }

  basicCardInfo(id) {
    if (id !== 'special') return BASIC_CARDS[id];
    return this.def.special;
  }
  get basics() { return this.def.basics || DEFAULT_BASICS; }

  // Değişikliğin önizlemesi için geçici olarak uygular ve geri alır
  withPreview(mutate, read) {
    const cards = { ...this.cards }, level = this.level, abs = {};
    for (const k in this.abilities) abs[k] = this.abilities[k].level;
    const before = read();
    mutate();
    this.level = level + 1;
    this.recalc();
    const after = read();
    this.cards = cards; this.level = level;
    for (const k in abs) this.abilities[k].level = abs[k];
    this.recalc();
    return [before, after];
  }

  basicReader(id) {
    switch (id) {
      case 'as': return ['Saldırı hızı', () => fmt(this.rate) + '/sn'];
      case 'dmg': return ['Hasar', () => fmt(this.damage)];
      case 'range': return ['Menzil', () => fmt(this.range) + ' m'];
      case 'l_poison': return ['Zehir şansı (alan)', () => pct(this.auraPoison)];
      case 'l_haste': return ['Hız bonusu (alan)', () => '+' + pct(this.auraHaste)];
      case 'l_summon': return ['Çağrı hasarı (alan)', () => '+' + pct(this.auraSummon)];
    }
    switch (this.type) {
      case 'fire': return ['Yanma gücü', () => pct(this.burnMult)];
      case 'ice': return ['Yavaşlatma', () => pct(0.3 + this.slowBonus)];
      case 'storm': return ['Sekme', () => this.bounces + ' düşman'];
      case 'death': return ['Ruh / öldürme', () => this.soulsPerKill + ' ruh'];
      default: return ['Zırh azaltma', () => '-' + fmt(this.shredPerHit) + ' (max ' + this.shredCap + ')'];
    }
  }

  describeCard(c) {
    const out = { kind: c.kind, id: c.id, rarity: c.rarity, preview: [] };
    if (c.kind === 'basic') {
      const info = this.basicCardInfo(c.id);
      out.icon = info.icon; out.name = info.name; out.desc = info.desc;
      out.levelText = 'Kart x' + (this.cards[c.id] + 1);
      const [label, read] = this.basicReader(c.id);
      const [b, a] = this.withPreview(() => { this.cards[c.id]++; }, read);
      out.preview.push([label, b, a]);
      if (this.isSupport) {
        const [b2, a2] = this.withPreview(() => { this.cards[c.id]++; }, () => fmt(this.range) + ' m');
        out.preview.push(['Etki alanı (Sv. bonusu)', b2, a2]);
      } else if (c.id !== 'dmg') {
        const [b2, a2] = this.withPreview(() => { this.cards[c.id]++; }, () => fmt(this.damage));
        out.preview.push(['Hasar (Sv. bonusu)', b2, a2]);
      }
    } else {
      const d = ABILITY_DEFS[c.id], impl = ABILITY_IMPL[c.id];
      const ab = this.abilities[c.id];
      out.icon = d.icon; out.name = d.name;
      out.isNew = !ab;
      out.levelText = ab ? `Sv. ${ab.level} → ${ab.level + 1}` : 'YENİ YETENEK!';
      out.desc = ab ? d.upg : d.desc;
      if (ab) {
        const [b, a] = this.withPreview(() => { ab.level++; }, () => impl.stats(ab.level, this));
        out.preview = b.map((row, i) => [row[0], row[1], a[i][1]]);
      } else {
        const [, a] = this.withPreview(() => {}, () => impl.stats(1, this));
        out.preview = a.map((row) => [row[0], null, row[1]]);
      }
    }
    return out;
  }

  drawCards(count = 3) {
    const pool = [];
    for (const id of this.basics) {
      const info = this.basicCardInfo(id);
      if (info.max && this.cards[id] >= info.max) continue;
      if (id === 'special' && this.type === 'storm' && this.bounces >= 12) continue;
      pool.push({ kind: 'basic', id, rarity: 'temel' });
    }
    for (const id of this.def.abilities) {
      const ab = this.abilities[id], d = ABILITY_DEFS[id];
      if (ab && ab.level >= CFG.abilityMaxLevel) continue;
      if (d.requires && !this.abilities[d.requires]) continue;
      pool.push({ kind: 'ability', id, rarity: d.rarity });
    }
    const luck = this.game.luck;
    const weight = (r) => {
      let w = CFG.rarity[r].weight + CFG.luckShift[r] * luck;
      if (this.game.relics && this.game.relics.lucky && r === 'nadir') w *= 1.15;
      return Math.max(1, w);
    };
    const result = [];
    for (let i = 0; i < count; i++) {
      const remaining = pool.filter((c) => !result.includes(c));
      if (!remaining.length) break;
      const rarities = Object.keys(CFG.rarity).filter((r) => remaining.some((c) => c.rarity === r));
      const r = weightedPick(rarities, weight);
      result.push(choice(remaining.filter((c) => c.rarity === r)));
    }
    return result.map((c) => this.describeCard(c));
  }

  applyCard(card) {
    if (card.kind === 'basic') this.cards[card.id]++;
    else {
      const ab = this.abilities[card.id];
      if (ab) ab.level++;
      else {
        const nab = { id: card.id, level: 1, timer: rand(0.6, 1.6) };
        this.abilities[card.id] = nab;
        const impl = ABILITY_IMPL[card.id];
        if (impl.onAcquire) impl.onAcquire(this, nab);
      }
    }
    this.level++;
    this.recalc();
    this.updateLabel();
    this.castT = 1;
  }

  dispose() {
    this.removed = true;
    this.game.scene.remove(this.group);
    this.label.material.map.dispose();
    this.label.material.dispose();
    disposeObject(this.group);
  }
}
