'use strict';

const DEBUG = /[?&]debug/.test(location.search);

const CFG = {
  bounds: { minX: -46, maxX: 46, minZ: -46, maxZ: 33 },
  castle: { x: 0, z: 23, radius: 4.6, maxHp: 36 },
  roadHalfWidth: 1.7,

  hero: {
    speed: 8.5, sprintMult: 1.45, radius: 0.55,
    buildRadius: 8, interactRadius: 3.8,
    dmg: 9, rate: 1.4, range: 8.5, projSpeed: 22,
  },

  startGold: DEBUG ? 20000 : 420,
  foundationRadius: 1.25,
  foundationCost: (n) => 40 + n * 32,
  towerChoiceCost: 80,
  upgradeCost: (level) => Math.round(55 * Math.pow(1.30, level - 1) / 5) * 5,
  rerollCost: () => 0,
  sellRatio: 0.6,

  rarity: {
    temel: { name: 'Temel', color: '#aeb8c2', weight: 80 },
    orta:  { name: 'Orta',  color: '#4da3ff', weight: 17 },
    nadir: { name: 'Nadir', color: '#ffb52e', weight: 3 },
  },
  luckShift: { temel: -2.0, orta: 1.4, nadir: 0.5 },
  abilityMaxLevel: 10,

  firstBreak: 30,
  breakTime: 16,
  earlyCallGoldPerSec: 3,
  maxEnemies: 300,
};

// Düşmanların takip ettiği yollar (x, z). İlk nokta geçit (portal), son nokta kale kapısı.
const PATH_DEFS = [
  { id: 'north', name: 'Kuzey', unlock: 1,
    pts: [[2,-44],[-6,-37],[-13,-28],[-8,-19],[4,-16],[13,-9],[11,1],[1,5],[-3,11],[0,16.5],[0,20]] },
  { id: 'west', name: 'Batı', unlock: 4,
    pts: [[-44,-6],[-38,-15],[-30,-20],[-22,-13],[-26,-3],[-33,4],[-27,12],[-18,14],[-11,21],[-6,23],[-3,23]] },
  { id: 'east', name: 'Doğu', unlock: 8,
    pts: [[44,-11],[38,-23],[29,-27],[22,-19],[28,-8],[33,2],[26,10],[18,15],[11,21],[6,23],[3,23]] },
];

// Dalga güçlenme eğrileri
const WAVE_SCALE = {
  hp: (n) => {
    const early = 0.68 * Math.pow(1.055, n - 1);
    const late = n <= 12 ? 1 : Math.pow(1.115, n - 12);
    return early * late;
  },
  armor: (n) => Math.floor((n < 12 ? 0.7 : 1.55) * Math.max(0, n - 1)),
  speed: (n) => 1 + Math.min(0.4, 0.005 * (n - 1) + 0.014 * Math.max(0, n - 14)),
  gold: (n) => Math.max(0.62, 1.02 - 0.014 * (n - 1)),
  budget: (n) => 4.2 + n * 2.9 + Math.pow(Math.max(0, n - 6), 1.7) * 0.28,
};
