'use strict';

const WAVE_EVENTS = {
  blood_moon: {
    id: 'blood_moon', name: 'Kanlı Ay', icon: '🌕', color: '#ff5a4a',
    desc: 'Düşmanlar daha hızlı ve daha dayanıklı.',
    hp: 1.28, speed: 1.22, gold: 1, cd: 1,
  },
  gold_rush: {
    id: 'gold_rush', name: 'Altın Hücumu', icon: '💰', color: '#ffd451',
    desc: 'Bu dalgada öldürülen düşmanlar daha çok altın düşürür.',
    hp: 1, speed: 1, gold: 1.85, cd: 1,
  },
  emp: {
    id: 'emp', name: 'EMP', icon: '📡', color: '#7ec8ff',
    desc: 'Kule yeteneklerinin bekleme süreleri uzar.',
    hp: 1, speed: 1, gold: 1, cd: 1.85,
  },
  wormhole: {
    id: 'wormhole', name: 'Solucan Deliği', icon: '🌀', color: '#c08cff',
    desc: 'Yolların ortasında delikler açılır; düşmanlar yol değiştirir.',
    hp: 1, speed: 1, gold: 1, cd: 1,
  },
};

function pickWaveEvent(n, lastWave) {
  if (n < 8) return null;
  if (lastWave && n - lastWave < 3) return null;
  if (Math.random() > 0.34) return null;
  return WAVE_EVENTS[choice(Object.keys(WAVE_EVENTS))];
}

function applyWaveEvent(game, ev) {
  game.eventHpMult = ev ? ev.hp : 1;
  game.eventSpeedMult = ev ? ev.speed : 1;
  game.eventGoldMult = ev ? ev.gold : 1;
  game.abilityCdMult = ev ? ev.cd : 1;
  game.activeEvent = ev || null;
  game.world.setMood(ev ? ev.id : null);
  if (ev && ev.id === 'wormhole') game.world.spawnWormholes();
  else game.world.clearWormholes();
}

function clearWaveEvent(game) {
  applyWaveEvent(game, null);
}
