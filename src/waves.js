'use strict';

const WAVE_UNITS = [
  { id: 'slime', cost: 2.6, w: 5, from: 1, pack: 4 },
  { id: 'goblin', cost: 1, w: 12, from: 1 },
  { id: 'rider', cost: 2.2, w: 6, from: 3 },
  { id: 'knight', cost: 3, w: 4, from: 6 },
  { id: 'orc', cost: 4.2, w: 3, from: 8 },
  { id: 'priest', cost: 3.6, w: 2.4, from: 11 },
  { id: 'witch', cost: 4, w: 2.2, from: 13 },
  { id: 'golem', cost: 6, w: 2, from: 16 },
];

class WaveManager {
  constructor(game) {
    this.game = game;
    this.wave = 0;
    this.state = 'break';
    this.timer = CFG.firstBreak;
    this.queue = [];
    this.t = 0;
    this.total = 0;
    this.seenTypes = new Set();
    this.seenImm = new Set();
    this.next = null;
  }

  update(dt) {
    if (this.state === 'break') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
      return;
    }
    if (this.game.enemies.length < CFG.maxEnemies) this.t += dt;
    while (this.queue.length && this.queue[0].t <= this.t) {
      const s = this.queue.shift();
      const extra = {};
      if (s.immune) extra.immune = s.immune;
      if (s.boss) extra.boss = s.boss;
      this.game.spawnEnemy(s.type, s.path, this.wave, s.lateral, extra);
    }
    if (!this.queue.length && this.game.aliveEnemies() === 0) this.waveCleared();
  }

  get remaining() { return this.queue.length + this.game.aliveEnemies(); }

  prepareNext() {
    const n = this.wave + 1;
    const queue = this.generate(n);
    const summary = this.summarize(queue, n);
    this.next = { wave: n, queue, summary };
    this.game.ui.showWavePreview(n, summary);
  }

  startWave() {
    if (!this.next) this.prepareNext();
    const planned = this.next;
    this.wave = planned.wave;
    this.queue = planned.queue;
    this.total = this.queue.length;
    this.t = 0;
    this.state = 'active';
    this.next = null;
    for (const u of planned.summary.units) {
      this.seenTypes.add(u.seenKey || u.id);
      for (const im of u.immunes) this.seenImm.add(im.id);
    }
    const n = this.wave;
    PATH_DEFS.forEach((d, i) => {
      if (d.unlock > n) return;
      if (!this.game.world.portals[i].active) {
        this.game.world.setPortalActive(i, true);
        if (n > 1) {
          this.game.ui.toast(`⚠️ ${d.name} geçidi açıldı! Düşmanlar artık oradan da gelecek.`, true);
          Sound.play('unlock');
        }
      }
    });
    const boss = isBossWave(n);
    const def = boss ? bossDefForWave(n) : null;
    let sub = this.hint(n, planned.summary);
    if (def) {
      const imm = def.immune && TOWER_TYPES[def.immune];
      sub = `${def.icon} ${def.name}` + (imm ? ` · ${imm.icon} ${elementLabel(def.immune)} bağışık` : '');
    }
    this.game.ui.banner(`DALGA ${n}`, sub, boss ? '#ff6b5b' : '#ffffff');
    this.game.ui.hideWavePreview(2400);
    Sound.play(boss ? 'boss_horn' : 'wave_start');
    Sound.setIntensity(boss ? 2 : 1);
    this.game.onWaveStart(n);
  }

  callEarly() {
    if (this.state !== 'break') return 0;
    const bonus = Math.ceil(this.timer) * CFG.earlyCallGoldPerSec;
    this.startWave();
    return bonus;
  }

  waveCleared() {
    const n = this.wave;
    const bonus = 25 + 8 * n;
    this.state = 'break';
    this.timer = CFG.breakTime;
    this.game.addGold(bonus);
    this.game.ui.banner(`Dalga ${n} temizlendi!`, `+${bonus} 💰 dalga bonusu`, '#7ee787');
    Sound.play('wave_clear');
    Sound.setIntensity(0);
    this.game.onWaveCleared(n);
    this.prepareNext();
  }

  hint(n, summary) {
    const debut = summary && summary.units.filter((u) => u.isNew);
    if (debut && debut.length) return debut.map((u) => u.name).join(', ') + ' ortaya çıktı!';
    const hints = {
      1: 'Kuzey geçidinden slimelar ve goblinler geliyor!',
      3: 'Kurt binicileri: önce kurt ölür, sonra binici iner!',
      4: 'Batı geçidi açılıyor!',
      6: 'Bozulmuş şövalyeler: yüksek zırh! (Asit zırhı eritir)',
      8: 'Doğu geçidi ve orklar!',
    };
    if (summary && summary.units.some((u) => u.immunes.some((im) => im.isNew))) {
      const ims = [];
      for (const u of summary.units) for (const im of u.immunes) if (im.isNew) ims.push(im.icon + ' ' + im.name);
      return 'Yeni bağışıklık: ' + [...new Set(ims)].join(', ');
    }
    return hints[n] || `Düşmanlar güçleniyor — Can x${WAVE_SCALE.hp(n).toFixed(1)}`;
  }

  summarize(list, n) {
    const map = {};
    for (const s of list) {
      const key = s.boss ? 'boss:' + s.boss.id : s.type;
      if (!map[key]) map[key] = { id: s.type, boss: s.boss || null, count: 0, immunes: {} };
      map[key].count++;
      if (s.immune) map[key].immunes[s.immune] = (map[key].immunes[s.immune] || 0) + 1;
    }
    const units = Object.values(map).map((u) => {
      const T = ENEMY_TYPES[u.id];
      const seenKey = u.boss ? 'boss:' + u.boss.id : u.id;
      return {
        id: u.id,
        seenKey,
        name: u.boss ? u.boss.name : (T ? T.name : u.id),
        icon: u.boss ? u.boss.icon : (T ? T.icon : '❓'),
        count: u.count,
        isNew: !this.seenTypes.has(seenKey),
        immunes: Object.keys(u.immunes).map((id) => {
          const tw = TOWER_TYPES[id];
          return {
            id, count: u.immunes[id],
            name: elementLabel(id),
            icon: tw ? tw.icon : '◆',
            color: tw ? tw.color : '#fff',
            isNew: !this.seenImm.has(id),
          };
        }),
      };
    });
    units.sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1));
    return { wave: n, units };
  }

  assignImmunities(list, n) {
    const elems = unlockedElements(n);
    if (!elems.length) return;
    const pool = list.filter((s) => s.type !== 'boss');
    const debut = elems.filter((id) => elementUnlockWave(id) === n);
    for (const el of debut) {
      const want = Math.max(3, Math.round(list.length * 0.12));
      const candidates = pool.filter((s) => !s.immune);
      for (let i = 0; i < want && candidates.length; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        candidates.splice(idx, 1)[0].immune = el;
      }
    }
    const frac = clamp(0.08 + (n - 5) * 0.012, 0.08, 0.34);
    for (const s of pool) {
      if (s.immune) continue;
      if (Math.random() < frac) s.immune = choice(elems);
    }
  }

  generate(n) {
    const types = WAVE_UNITS.filter((t) => t.from <= n);
    const paths = this.game.world.paths.filter((p) => p.def.unlock <= n);
    const newPath = paths.find((p) => p.def.unlock === n && n > 1);
    const budget = WAVE_SCALE.budget(n);
    const hordes = clamp(2 + Math.floor(n / 2.5), 2, 9);
    const interval = 0.38 * Math.max(0.6, 1 - n * 0.01);
    const list = [];
    let t = 0;
    const weight = (x) => {
      let w = x.w * (x.from === n ? 4.2 : 1);
      if (x.id === 'slime' && n >= 6) w *= 0.32;
      if (x.id === 'goblin' && n >= 10) w *= 0.5;
      return w;
    };
    for (let h = 0; h < hordes; h++) {
      const path = h === 0 && newPath ? newPath : choice(paths);
      const main = weightedPick(types, weight);
      let hb = budget / hordes;
      while (hb > 0) {
        const tp = Math.random() < 0.65 ? main : weightedPick(types, weight);
        const cnt = tp.pack || 1;
        for (let k = 0; k < cnt; k++) {
          list.push({ t, type: tp.id, path, lateral: rand(-1.1, 1.1) });
          t += tp.pack ? 0.14 : interval;
        }
        hb -= tp.cost;
      }
      t += Math.max(1.8, 4.5 - n * 0.1);
    }
    for (const u of WAVE_UNITS) {
      if (u.from !== n) continue;
      const have = list.filter((s) => s.type === u.id).length;
      const want = u.pack ? u.pack : (u.id === 'golem' ? 3 : 4);
      for (let i = have; i < want; i++) {
        list.push({ t: t + i * 0.35, type: u.id, path: choice(paths), lateral: rand(-1.1, 1.1) });
      }
    }
    if (isBossWave(n)) {
      const def = bossDefForWave(n);
      const escort = n >= 16 ? 'orc' : n >= 6 ? 'knight' : 'goblin';
      const path = choice(paths);
      t += 2;
      list.push({ t, type: 'boss', path, lateral: 0, immune: def.immune || undefined, boss: def });
      const esc = 4 + Math.floor(n / 5);
      for (let k = 0; k < esc; k++) list.push({ t: t + 0.6 + k * 0.35, type: escort, path, lateral: rand(-1.1, 1.1) });
    }
    this.assignImmunities(list, n);
    list.sort((a, b) => a.t - b.t);
    return list;
  }
}
