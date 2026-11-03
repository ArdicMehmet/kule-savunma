'use strict';

const UNITY_COLORS = [0xe8c36a, 0xfff0b0, 0xc48a3a];

ABILITY_IMPL.knights = {
  params(L, tw) { const s = unitStats(tw, 'knight'); return { n: 3, dmg: s.dmg, hp: s.hp }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Asker', p.n], ['Hasar', fmt(p.dmg)], ['Can', fmt(p.hp)]]; },
  onAcquire(tw) { spawnSquad(tw, 'knight', 3); },
  update(tw) { if (countAlive(tw, 'knight') < 3) spawnSquad(tw, 'knight', 3); },
};

ABILITY_IMPL.guards = {
  params(L, tw) { const s = unitStats(tw, 'guard'); return { n: 3, hp: s.hp }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Muhafız', p.n], ['Can', fmt(p.hp)]]; },
  onAcquire(tw) { spawnSquad(tw, 'guard', 3); },
  update(tw) { if (countAlive(tw, 'guard') < 3) spawnSquad(tw, 'guard', 3); },
};

ABILITY_IMPL.priests = {
  params(L, tw) { const s = unitStats(tw, 'priest'); return { n: 3, heal: s.heal, cd: s.healCd }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Rahip', p.n], ['İyileştirme', fmt(p.heal)], ['Aralık', sec(p.cd)]]; },
  onAcquire(tw) { spawnSquad(tw, 'priest', 3); },
  update(tw) { if (countAlive(tw, 'priest') < 3) spawnSquad(tw, 'priest', 3); },
};

ABILITY_IMPL.general = {
  params(L, tw) { const s = unitStats(tw, 'general'); return { dmg: s.dmg, hp: s.hp, aura: s.aura }; },
  stats(L, tw) { const p = this.params(L, tw); return [['Hasar', fmt(p.dmg)], ['Can', fmt(p.hp)], ['Aura', '+' + pct(p.aura)]]; },
  onAcquire(tw) { spawnSquad(tw, 'general', 1); },
  update(tw) { if (countAlive(tw, 'general') < 1) spawnSquad(tw, 'general', 1); },
};

ABILITY_IMPL.last_stand = {
  params(L) { return { dur: 3, power: 1.35 + 0.12 * (L - 1) }; },
  stats(L) { const p = this.params(L); return [['Süre', sec(p.dur)], ['Güç', '+' + pct(p.power - 1)]]; },
  update() {},
};
