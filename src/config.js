'use strict';

const DEBUG = /[?&]debug/.test(location.search);

const CFG = {
  bounds: { minX: -46, maxX: 46, minZ: -46, maxZ: 33 },
  castle: { x: 0, z: 23, radius: 4.6, maxHp: 30 },
  roadHalfWidth: 1.7,

  hero: {
    speed: 8.5, sprintMult: 1.45, radius: 0.55,
    buildRadius: 8, interactRadius: 3.8,
    dmg: 9, rate: 1.4, range: 8.5, projSpeed: 22,
  },

  startGold: DEBUG ? 20000 : 300,
  foundationRadius: 1.25,
  foundationCost: (n) => 50 + n * 25,
  towerChoiceCost: 100,
  upgradeCost: (level) => Math.round(60 * Math.pow(1.24, level - 1) / 5) * 5,
  rerollCost: (n) => 20 + n * 15,
  sellRatio: 0.6,

  rarity: {
    temel: { name: 'Temel', color: '#aeb8c2', weight: 58 },
    orta:  { name: 'Orta',  color: '#4da3ff', weight: 30 },
    nadir: { name: 'Nadir', color: '#ffb52e', weight: 12 },
  },
  luckShift: { temel: -6, orta: 2, nadir: 4 },
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
  hp: (n) => (1 + 0.12 * (n - 1)) * Math.pow(1.06, n - 1),
  armor: (n) => Math.floor(1.2 * (n - 1)),
  speed: (n) => 1 + Math.min(0.25, 0.008 * (n - 1)),
  gold: (n) => 1 + 0.06 * (n - 1),
  budget: (n) => 6 + n * 4.5 + n * n * 0.12,
};
