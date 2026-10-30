'use strict';

const WAVE_UNITS = [
  { id: 'goblin', cost: 1, w: 10, from: 1 },
  { id: 'wolf', cost: 1, w: 6, from: 3 },
  { id: 'slime', cost: 2, w: 5, from: 4, pack: 6 },
  { id: 'knight', cost: 3, w: 4, from: 7 },
  { id: 'ogre', cost: 4.5, w: 3, from: 9 },
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
      this.game.spawnEnemy(s.type, s.path, this.wave, s.lateral);
    }
    if (!this.queue.length && this.game.aliveEnemies() === 0) this.waveCleared();
  }

  get remaining() { return this.queue.length + this.game.aliveEnemies(); }

  startWave() {
    this.wave++;
    const n = this.wave;
    this.queue = this.generate(n);
    this.total = this.queue.length;
    this.t = 0;
    this.state = 'active';
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
    const boss = n % 5 === 0;
    this.game.ui.banner(`DALGA ${n}`, boss ? '☠️ BOSS DALGASI! ☠️' : this.hint(n), boss ? '#ff6b5b' : '#ffffff');
    Sound.play(boss ? 'boss_horn' : 'wave_start');
    Sound.setIntensity(boss ? 2 : 1);
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
  }

  hint(n) {
    const hints = {
      1: 'Kuzey geçidinden goblinler geliyor!',
      3: 'Kurtlar geliyor — çok hızlıdırlar!',
      4: 'Balçık sürüleri ve Batı geçidi!',
      7: 'Kara Şövalyeler: yüksek zırh! (Asit zırhı eritir)',
      8: 'Doğu geçidi açılıyor!',
      9: 'Ogreler: dayanıklı devler!',
    };
    return hints[n] || `Düşmanlar güçleniyor — Can x${WAVE_SCALE.hp(n).toFixed(1)}`;
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
    for (let h = 0; h < hordes; h++) {
      const path = h === 0 && newPath ? newPath : choice(paths);
      const main = weightedPick(types, (x) => x.w);
      let hb = budget / hordes;
      while (hb > 0) {
        const tp = Math.random() < 0.65 ? main : choice(types);
        const cnt = tp.pack || 1;
        for (let k = 0; k < cnt; k++) {
          list.push({ t, type: tp.id, path, lateral: rand(-1.1, 1.1) });
          t += tp.pack ? 0.14 : interval;
        }
        hb -= tp.cost;
      }
      t += Math.max(1.8, 4.5 - n * 0.1);
    }
    if (n % 5 === 0) {
      const bosses = 1 + Math.floor(n / 20);
      for (let b = 0; b < bosses; b++) {
        const path = choice(paths);
        t += 2;
        list.push({ t, type: 'boss', path, lateral: 0 });
        const esc = 4 + Math.floor(n / 5);
        for (let k = 0; k < esc; k++) list.push({ t: t + 0.6 + k * 0.35, type: n >= 10 ? 'knight' : 'goblin', path, lateral: rand(-1.1, 1.1) });
      }
    }
    list.sort((a, b) => a.t - b.t);
    return list;
  }
}
