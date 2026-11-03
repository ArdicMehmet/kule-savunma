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
    this.lastEventWave = 0;
    this.lastImmByType = {};
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
      if (s.immunes && s.immunes.length) extra.immunes = s.immunes;
      else if (s.immune) extra.immune = s.immune;
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
    const event = pickWaveEvent(n, this.lastEventWave);
    if (event) this.lastEventWave = n;
    summary.event = event;
    this.next = { wave: n, queue, summary, event };
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
    const ev = planned.event;
    let sub = this.hint(n, planned.summary);
    if (def) {
      const imm = def.immune && TOWER_TYPES[def.immune];
      sub = `${def.icon} ${def.name}` + (imm ? ` · ${imm.icon} ${elementLabel(def.immune)} bağışık` : '');
    }
    if (ev) this.game.ui.banner(`DALGA ${n} · ${ev.icon} ${ev.name}`, ev.desc, ev.color);
    else this.game.ui.banner(`DALGA ${n}`, sub, boss ? '#ff6b5b' : '#ffffff');
    this.game.ui.hideWavePreview(2400);
    Sound.play(boss ? 'boss_horn' : 'wave_start');
    Sound.setIntensity(boss ? 2 : 1);
    this.game.onWaveStart(n, planned.event);
  }

  callEarly() {
    if (this.state !== 'break') return 0;
    const bonus = Math.ceil(this.timer) * CFG.earlyCallGoldPerSec;
    this.startWave();
    return bonus;
  }

  waveCleared() {
    const n = this.wave;
    const bonus = 16 + 4 * n;
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
      const ims = s.immunes && s.immunes.length ? s.immunes : (s.immune ? [s.immune] : []);
      const imKey = ims.slice().sort().join('+');
      const key = (s.boss ? 'boss:' + s.boss.id : s.type) + '|' + imKey;
      if (!map[key]) map[key] = { id: s.type, boss: s.boss || null, count: 0, immunes: {} };
      map[key].count++;
      for (const im of ims) map[key].immunes[im] = (map[key].immunes[im] || 0) + 1;
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
    if (n < 8) return;
    const elems = unlockedElements(n);
    if (!elems.length) return;
    const fodder = { slime: 1, goblin: 1, skeleton: 1, wolf: 1 };
    const power = { rider: 1, knight: 2, priest: 2, witch: 2, orc: 3, ogre: 3, golem: 4 };
    const pool = list.filter((s) => s.type !== 'boss' && !fodder[s.type]);
    if (!pool.length) return;
    const pick = (arr) => arr.splice(Math.floor(Math.random() * arr.length), 1)[0];
    const pickElem = (type) => {
      const avoid = this.lastImmByType[type];
      const fresh = elems.filter((el) => el !== avoid);
      return choice(fresh.length ? fresh : elems);
    };
    const setOne = (s, el) => { s.immunes = [el]; s.immune = el; };

    const debut = elems.filter((id) => elementUnlockWave(id) === n);
    for (const el of debut) {
      const cands = pool.filter((s) => !s.immune);
      const nDebut = Math.min(cands.length, Math.max(2, Math.round(pool.length * 0.08)));
      for (let i = 0; i < nDebut && cands.length; i++) setOne(pick(cands), el);
    }

    const frac = clamp(0.10 + (n - 8) * 0.007, 0.10, 0.22);
    const want = Math.max(1, Math.round(pool.length * frac));
    const rest = pool.filter((s) => !s.immune);
    const remain = Math.max(0, want - pool.filter((s) => s.immune).length);
    for (let i = 0; i < remain && rest.length; i++) {
      const s = pick(rest);
      setOne(s, pickElem(s.type));
    }
    for (const s of pool) {
      if (s.immune) this.lastImmByType[s.type] = s.immunes[s.immunes.length - 1];
    }

    if (n < 16) return;
    const dualCands = pool.filter((s) => s.immunes && s.immunes.length === 1 && (power[s.type] || 0) >= 3);
    const dualWant = Math.min(dualCands.length, Math.round(dualCands.length * (n >= 22 ? 0.22 : 0.1)));
    for (let i = 0; i < dualWant && dualCands.length; i++) {
      const s = pick(dualCands);
      const second = choice(elems.filter((el) => el !== s.immune));
      if (!second) continue;
      s.immunes.push(second);
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
    this.assignImmunities(list, n);
    if (isBossWave(n)) {
      const def = bossDefForWave(n);
      const escort = n >= 16 ? 'orc' : n >= 6 ? 'knight' : 'goblin';
      const path = choice(paths);
      const lastT = list.length ? Math.max.apply(null, list.map((s) => s.t)) : t;
      const bt = lastT + 3.8;
      list.push({ t: bt, type: 'boss', path, lateral: 0, immune: def.immune || undefined, boss: def });
      const esc = 3 + Math.floor(n / 8);
      for (let k = 0; k < esc; k++) list.push({ t: bt + 1.1 + k * 0.4, type: escort, path, lateral: rand(-1.1, 1.1) });
    }
    list.sort((a, b) => a.t - b.t);
    return list;
  }
}
