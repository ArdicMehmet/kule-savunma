'use strict';

const RELIC_RARITY = {
  common: { name: 'Yaygın', color: '#aeb8c2', weight: 58 },
  epic: { name: 'Destansı', color: '#c08cff', weight: 27 },
  legendary: { name: 'Efsanevi', color: '#ffb52e', weight: 15 },
};

const RELIC_DEFS = {
  midas: { id: 'midas', rarity: 'common', icon: '✋', name: "Midas'ın Dokunuşu",
    desc: 'Öldürülen düşmanlardan gelen altın %10 artar.' },
  elementalist: { id: 'elementalist', rarity: 'common', icon: '🔮', name: 'Elementalist',
    desc: 'Düşmanlar kule yetenek hasarından %10 fazla hasar alır.' },
  sticky: { id: 'sticky', rarity: 'common', icon: '🕸️', name: 'Yapışkan Zemin',
    desc: 'Tüm düşmanların hareket hızı %20 azalır.' },
  weapon: { id: 'weapon', rarity: 'common', icon: '🗡️', name: 'Weapon Damage+',
    desc: 'Kahramanının atışları her dalgada %10 güçlenir.' },
  stay: { id: 'stay', rarity: 'epic', icon: '🏰', name: 'Stay Strong',
    desc: 'Kalenin maksimum canı %25 artar.' },
  triple: { id: 'triple', rarity: 'epic', icon: '🎯', name: 'Triple Shot',
    desc: 'Kahraman aynı anda 3 düşmana ateş eder. Tek hedef varsa üç atış da ona gider.' },
  lucky: { id: 'lucky', rarity: 'epic', icon: '🍀', name: 'Lucky',
    desc: 'Nadir kartların ve reliclerin gelme şansı %15 artar.' },
  patient: { id: 'patient', rarity: 'epic', icon: '⏳', name: 'Patient',
    desc: 'Kule yeteneklerinin etki süresi artar.' },
  contract: { id: 'contract', rarity: 'epic', icon: '📜', name: 'Good Contract',
    desc: 'Kule satınca harcadığın altının tamamını geri alırsın.' },
  reborn: { id: 'reborn', rarity: 'legendary', icon: 'phoenix', name: 'Reborn',
    desc: 'Kale 0 cana düşerse bir kez tüm düşmanlar ölür ve 1 canla devam edersin. (Tek alınır)' },
  king: { id: 'king', rarity: 'legendary', icon: '👑', name: 'The King!!!',
    desc: 'Kaleden bir kral çıkar. En kalabalık yola gider, düşmanlar onu geçemez. Ölürse bir dalga dinlenir; yaşarsa sonraki dalgaya full canla başlar.' },
  snow: { id: 'snow', rarity: 'legendary', icon: '🌨️', name: 'Snowball Shower',
    desc: 'Bir buton verir: tüm yollara çığ yağdırır. 5 dalga bekleme süresi vardır.' },
  plague: { id: 'plague', rarity: 'legendary', icon: '☣️', name: 'Plague',
    desc: 'Her dalgada düşmanların maksimum canı %10 azalır (üst üste biner).' },
};
RELIC_DEFS.reborn.icon = '🔥';

function wrapAbilityDurations() {
  if (wrapAbilityDurations.done) return;
  wrapAbilityDurations.done = true;
  for (const id in ABILITY_IMPL) {
    const impl = ABILITY_IMPL[id];
    if (!impl.params) continue;
    const orig = impl.params.bind(impl);
    impl.params = function (L, tw) {
      const p = orig(L, tw);
      const m = tw && tw.game ? tw.game.durMult : 1;
      if (m === 1) return p;
      for (const k of ['dur', 'life', 'root', 'stun', 'slowDur', 'hold']) if (p[k]) p[k] *= m;
      return p;
    };
  }
}

function drawRelics(game, count = 3) {
  const owned = game.ownedRelics;
  const pool = Object.values(RELIC_DEFS).filter((d) => !owned.has(d.id));
  if (!pool.length) return [];
  const luck = game.relics.lucky ? 1.15 : 1;
  const weight = (r) => {
    let w = RELIC_RARITY[r].weight;
    if (r === 'epic') w *= luck;
    if (r === 'legendary') w *= luck;
    if (r === 'common' && luck > 1) w *= 0.85;
    return Math.max(1, w);
  };
  const result = [];
  for (let i = 0; i < count; i++) {
    const remaining = pool.filter((d) => !result.includes(d));
    if (!remaining.length) break;
    const rarities = [...new Set(remaining.map((d) => d.rarity))];
    const r = weightedPick(rarities, weight);
    result.push(choice(remaining.filter((d) => d.rarity === r)));
  }
  return result.map((d) => ({
    kind: 'relic', id: d.id, rarity: d.rarity, icon: d.icon, name: d.name, desc: d.desc,
    levelText: RELIC_RARITY[d.rarity].name, preview: [],
  }));
}

function applyRelic(game, id) {
  const d = RELIC_DEFS[id];
  if (!d || game.ownedRelics.has(id)) return;
  game.ownedRelics.add(id);
  game.relics[id] = true;
  switch (id) {
    case 'midas': game.goldMult *= 1.1; break;
    case 'elementalist': game.abilityDmgMult *= 1.1; break;
    case 'sticky': game.moveMult *= 0.8; break;
    case 'weapon': game.syncHeroDmg(); break;
    case 'stay': {
      const extra = Math.round(game.castleMax * 0.25);
      game.castleMax += extra;
      game.castleHp += extra;
      break;
    }
    case 'triple': game.heroShots = 3; break;
    case 'lucky': break;
    case 'patient': game.durMult *= 1.35; break;
    case 'contract': game.sellRatio = 1; break;
    case 'reborn': game.rebornReady = true; break;
    case 'king':
      if (!game.king) game.king = new King(game);
      game.king.respawn();
      break;
    case 'snow':
      game.snowCd = 0;
      game.ui.setSnowVisible(true);
      break;
    case 'plague': game.plagueStacks = 0; break;
  }
  game.ui.renderRelicBar();
  game.ui.banner(`${d.icon} ${d.name}`, d.rarity === 'legendary' ? 'EFSANEVİ RELİC!' : 'Relic kazanıldı', RELIC_RARITY[d.rarity].color);
  Sound.play(d.rarity === 'legendary' ? 'card_nadir' : 'card_orta');
}

// ---------------- Çığ (tüm yollar) ----------------
class PathAvalancheFx extends Fx {
  constructor(game, path, p, src) {
    super(game);
    this.path = path; this.p = p; this.src = src;
    this.d = 0; this.hit = new Set(); this.hits = 0; this.r = p.r0;
    this.ball = this.add(new THREE.Mesh(FXGEO.sph, snowMat()));
    this.ball.castShadow = true;
    this.ball.scale.setScalar(this.r);
    this.s = { x: 0, z: 0, tx: 0, tz: 1 };
    this.prev = { x: 0, z: 0 };
    path.sample(0, this.s);
    this.prev.x = this.s.x; this.prev.z = this.s.z;
  }
  update(dt) {
    const p = this.p, g = this.game;
    const prevD = this.d;
    this.d += p.speed * dt;
    this.path.sample(Math.min(this.d, this.path.length), this.s);
    const x = this.s.x, z = this.s.z;
    if (this.d >= this.path.length) {
      g.fxN.burst(x, this.r, z, 24, { color: 0xffffff, speed: 4, life: 0.7, size: 0.45, gravity: 7, up: 1 });
      return false;
    }
    this.ball.position.set(x, this.r, z);
    this.ball.rotation.x += dt * 8;
    this.ball.scale.setScalar(this.r);
    if (Math.random() < 0.6) g.fxN.emit({ x: x + rand(-this.r, this.r) * 0.5, y: 0.12, z: z + rand(-this.r, this.r) * 0.5, vy: rand(0.4, 1.2), life: 0.5, size: 0.28, color: 0xffffff, alpha: 0.8, gravity: 3 });
    for (const e of g.enemiesInRadius(x, z, this.r + p.speed * dt + 1.2)) {
      if (this.hit.has(e)) continue;
      const r = this.r + e.radius;
      if (segDist2(e.x, e.z, this.prev.x, this.prev.z, x, z) <= r * r) {
        this.hit.add(e);
        this.hits++;
        e.takeDamage(p.dmg * (1 + 0.08 * this.hits), { src: this.src });
        e.knockback(p.knock, false, this.src);
        e.applyRoot(p.root, this.src);
        e.applySlow(p.slow, p.root + 2.5, this.src);
        this.r = Math.min(2.8, this.r + 0.1);
      }
    }
    this.prev.x = x; this.prev.z = z;
    return true;
  }
}

function fireSnowShower(game) {
  if (!game.relics.snow || game.snowCd > 0 || game.state !== 'playing') return false;
  if (!game.snowSrc) game.snowSrc = { isTower: true, type: 'ice', dmgMult: 1.2, slowBonus: 0.25, removed: false, totalDamage: 0, kills: 0 };
  const wave = Math.max(1, game.waves.wave);
  const p = { r0: 1.35, dmg: 28 * WAVE_SCALE.hp(wave) * 0.35, knock: 2.2, root: 1.1, slow: 0.55, speed: 14 };
  const paths = game.world.paths.filter((path) => path.def.unlock <= wave);
  for (const path of paths) game.addFx(new PathAvalancheFx(game, path, p, game.snowSrc));
  game.snowCd = 5;
  game.ui.updateSnowButton();
  game.ui.banner('🌨️ ÇIĞ YAĞMURU', 'Tüm yollar buz kesti!', '#bff0ff');
  Sound.play('snowball');
  Sound.play('whoosh');
  game.shake(0.25);
  return true;
}

// ---------------- Kral ----------------
class King {
  constructor(game) {
    this.game = game;
    this.maxHp = 360;
    this.hp = 360;
    this.alive = false;
    this.resting = false;
    this.diedThisWave = false;
    this.path = null;
    this.dist = 0;
    this.reach = 14;
    this.speed = 3.4;
    this.range = 2.4;
    this.dmg = 26;
    this.atkT = 0;
    this.hitT = 0;
    this.walk = 0;
    this.mesh = Models.mesh('king', () => Models.enemyGeometry('king'));
    this.mesh.scale.setScalar(1.15);
    this.group = new THREE.Group();
    this.group.add(this.mesh);
    const w = 1.6;
    this.barW = w;
    this.hpBar = new THREE.Group();
    const bg = new THREE.Mesh(HPBAR.geoBg, HPBAR.matBg);
    bg.scale.x = w + 0.08;
    this.hpFg = new THREE.Mesh(HPBAR.geoFg, HPBAR.matBoss);
    this.hpFg.position.x = -w / 2;
    this.hpFg.position.z = 0.001;
    this.hpFg.scale.x = w;
    bg.renderOrder = 30; this.hpFg.renderOrder = 31;
    this.hpBar.add(bg, this.hpFg);
    this.hpBar.position.y = 2.6;
    this.group.add(this.hpBar);
    this.crownGlow = glowSprite(0xffd451, 1.8, 0.55);
    this.crownGlow.position.y = 2.2;
    this.group.add(this.crownGlow);
    this.group.visible = false;
    game.scene.add(this.group);
    this.s = { x: 0, z: 0, tx: 0, tz: 1 };
    this.x = 0; this.z = 0;
    this.totalDamage = 0; this.kills = 0;
  }

  pickPath() {
    const g = this.game, n = g.waves.wave;
    const paths = g.world.paths.filter((p) => p.def.unlock <= n);
    if (!paths.length) return g.world.paths[0];
    const counts = new Map();
    for (const p of paths) counts.set(p, 0);
    for (const s of g.waves.queue) if (counts.has(s.path)) counts.set(s.path, counts.get(s.path) + 1);
    for (const e of g.enemies) if (!e.dead && counts.has(e.path)) counts.set(e.path, counts.get(e.path) + 1);
    let best = paths[0], bc = -1;
    for (const p of paths) {
      const c = counts.get(p) || 0;
      if (c > bc) { bc = c; best = p; }
    }
    return best;
  }

  respawn() {
    this.path = this.pickPath();
    this.dist = this.path.length - 1.6;
    this.hp = this.maxHp;
    this.alive = true;
    this.resting = false;
    this.diedThisWave = false;
    this.group.visible = true;
    this.hpFg.scale.x = this.barW;
    this.updatePose(0);
    this.game.ui.toast('👑 Kral yola çıktı!');
  }

  onWaveStart() {
    if (!this.game.relics.king) return;
    if (this.resting) {
      this.resting = false;
      this.game.ui.toast('👑 Kral kalede dinleniyor… sonraki dalgada döner.');
      return;
    }
    this.path = this.pickPath();
    this.dist = this.path.length - 1.6;
    this.hp = this.maxHp;
    this.alive = true;
    this.diedThisWave = false;
    this.group.visible = true;
    this.hpFg.scale.x = this.barW;
    this.updatePose(0);
  }

  onWaveCleared() {
    if (!this.alive) return;
    this.hp = this.maxHp;
    this.hpFg.scale.x = this.barW;
  }

  takeHit(amount) {
    if (!this.alive || amount <= 0) return;
    this.hp -= amount;
    this.hitT = 0.12;
    this.hpBar.visible = true;
    this.hpFg.scale.x = Math.max(0.001, (this.hp / this.maxHp) * this.barW);
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.diedThisWave = true;
    this.resting = true;
    this.group.visible = false;
    const g = this.game;
    g.fxN.burst(this.x, 1.2, this.z, 28, { color: 0xffd451, speed: 4, life: 0.7, size: 0.35, gravity: 4 });
    g.ui.toast('👑 Kral düştü! Bir dalga dinlenecek.', true);
    Sound.play('boss_die', 0.5);
  }

  update(dt) {
    if (!this.alive) return;
    const g = this.game, path = this.path;
    if (!path) return;
    const minD = Math.max(0, path.length - this.reach);
    const maxD = path.length - 1.4;
    let want = maxD;
    let nearest = null, nd = Infinity;
    for (const e of g.enemies) {
      if (e.dead || e.path !== path) continue;
      const d = Math.abs(e.dist - this.dist);
      if (e.dist < this.dist && this.dist - e.dist < nd) { nd = this.dist - e.dist; nearest = e; }
      if (e.dist < want && e.dist >= minD) want = Math.max(minD, e.dist + 0.9);
    }
    want = clamp(want, minD, maxD);
    if (this.dist > want) this.dist = Math.max(want, this.dist - this.speed * dt);
    else if (this.dist < want) this.dist = Math.min(want, this.dist + this.speed * dt);

    this.atkT -= dt;
    if (this.hitT > 0) this.hitT -= dt;
    const t = nearest && dist(nearest.x, nearest.z, this.x, this.z) < this.range + nearest.radius ? nearest : g.nearestEnemy(this.x, this.z, this.range);
    if (t && this.atkT <= 0) {
      this.atkT = 0.7;
      t.takeDamage(this.dmg * (1 + 0.04 * g.waves.wave), { src: this });
      g.fxA.burst(t.x, 1, t.z, 6, { color: 0xffd451, speed: 2.2, life: 0.3, size: 0.22, gravity: 2 });
      Sound.play('hit', 0.5);
    }
    this.updatePose(dt);
  }

  updatePose(dt) {
    if (!this.path) return;
    this.path.sample(this.dist, this.s);
    this.x = this.s.x; this.z = this.s.z;
    this.group.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, Math.atan2(-this.s.tx, -this.s.tz), 0.2);
    this.walk += dt * 8;
    const bob = Math.abs(Math.sin(this.walk)) * 0.08;
    this.mesh.position.y = bob + (this.hitT > 0 ? 0.04 : 0);
    this.crownGlow.material.opacity = 0.4 + 0.2 * Math.sin(this.game.time * 4);
  }
}
