'use strict';

// kuleler.txt kurallarına göre kule tanımları
const TOWER_TYPES = {
  fire: {
    id: 'fire', name: 'Alev Kulesi', icon: '🔥', color: '#ff7a2f', hex: 0xff7a2f,
    desc: 'Tekli atışlar. Vurduğu düşmanları yakar; zamanla yanma hasarı verir.',
    base: { damage: 15, rate: 1.0, range: 9 },
    special: { name: 'Yanma Gücü', icon: '♨️', desc: 'Kulenin ve yeteneklerinin tüm yanma hasarı +%25.' },
    abilities: ['fire_ring', 'fire_wave', 'phoenix', 'meteor', 'lava'],
  },
  ice: {
    id: 'ice', name: 'Buz Kulesi', icon: '❄️', color: '#6fd8ff', hex: 0x6fd8ff,
    desc: 'Tekli atışlar. Vuruşları düşmanları yavaşlatır.',
    base: { damage: 10, rate: 1.15, range: 9 },
    special: { name: 'Dondurucu Soğuk', icon: '🧊', desc: 'Kulenin ve yeteneklerinin tüm yavaşlatmaları +%6 güçlenir.' },
    abilities: ['ice_path', 'ice_spikes', 'ice_saw', 'avalanche', 'queen_tears'],
  },
  storm: {
    id: 'storm', name: 'Fırtına Kulesi', icon: '⚡', color: '#b48cff', hex: 0xb48cff,
    desc: 'Tekli atışlar. Şimşek, belirli sayıda düşman arasında seker.',
    base: { damage: 12, rate: 0.9, range: 9 },
    special: { name: 'Sekme', icon: '🔀', desc: 'Şimşek +1 düşmana daha seker.' },
    abilities: ['tornado', 'overload', 'wind_wall', 'thor', 'prison'],
  },
  acid: {
    id: 'acid', name: 'Asit Kulesi', icon: '🧪', color: '#8cff4a', hex: 0x8cff4a,
    desc: 'Alan hasarlı atışlar. Vuruşları düşmanın zırhını eritir.',
    base: { damage: 9, rate: 0.75, range: 8.5 },
    special: { name: 'Aşındırma', icon: '🛡️', desc: 'Zırh azaltma gücü ve azaltma sınırı artar.' },
    abilities: ['poison_cloud', 'poison_bomb', 'acid_spray', 'acid_rain', 'contagion'],
  },
  life: {
    id: 'life', name: 'Yaşam Kulesi', icon: '🌳', color: '#5fe08a', hex: 0x5fe08a,
    desc: 'Ateş etmez. Yakınındaki kuleleri güçlendirir: hasar, menzil ve buf süresi.',
    base: { damage: 0, rate: 0, range: 8 },
    support: true,
    basics: ['l_dur', 'range', 'l_dmg'],
    abilities: ['speed_life', 'fairies', 'seismic', 'decay', 'seeds'],
  },
  unity: {
    id: 'unity', name: 'Birlik Kulesi', icon: '🏹', color: '#e8c36a', hex: 0xe8c36a,
    desc: 'Tepesindeki okçu fiziksel hasar atar. Yetenekleri asker çağırır; askerler ölünce 10 sn sonra döner.',
    base: { damage: 11, rate: 1.05, range: 9.5 },
    element: false,
    basics: ['dmg', 'as', 'u_summon_dmg', 'u_summon_hp'],
    abilities: ['knights', 'guards', 'priests', 'general', 'last_stand'],
  },
  slime: {
    id: 'slime', name: 'Slime Kulesi', icon: '🟢', color: '#7dff6a', hex: 0x6adf4a,
    desc: 'Atışlar balçık biriktirir. 10 yığında düşman 1 sn sersemler, ardından 2 sn yığın alamaz.',
    base: { damage: 8, rate: 1.05, range: 8.5 },
    unlock: 16,
    basics: ['s_stun', 'as', 'dmg'],
    abilities: ['slime_bomb', 'slime_punch', 'snail', 'slime_prison', 'slime_king'],
  },
};

const DEFAULT_BASICS = ['as', 'dmg', 'range', 'special'];

const BASIC_CARDS = {
  as: { name: 'Saldırı Hızı', icon: '💨', desc: 'Kulenin saldırı hızı +%12.' },
  dmg: { name: 'Hasar Artışı', icon: '⚔️', desc: 'Kulenin hasarı +%15. Yeteneklerin hasarını da artırır.' },
  range: { name: 'Menzil', icon: '🎯', desc: 'Kulenin menzili +%8.', max: 8 },
  l_dur: { name: 'Kalıcı Buf', icon: '⏳', desc: 'Yaşam kulesinin verdiği buf süreleri +%12.' },
  l_dmg: { name: 'Canlandırma', icon: '💚', desc: 'Etki alanındaki kulelerin hasarı +%10.' },
  u_summon_dmg: { name: 'Birlik Hasarı', icon: '⚔️', desc: 'Çağrılan askerlerin hasarı +%18.' },
  u_summon_hp: { name: 'Birlik Canı', icon: '❤️', desc: 'Çağrılan askerlerin canı +%20.' },
  s_stun: { name: 'Balçık Sersemliği', icon: '💫', desc: '10 yığın sersemletmesi +0.1 sn.', max: 8 },
};

const ABILITY_DEFS = {
  // ---- Alev ----
  fire_ring: { tower: 'fire', name: 'Alev Çemberi', rarity: 'orta', icon: '⭕',
    desc: 'Belli aralıklarla düşmanların arasına bir alev çemberi atar. Çember bir süre kalır; içindekilere sürekli hasar verir ve yakar.',
    upg: 'Hasar ve kalma süresi artar, bekleme süresi azalır.' },
  fire_wave: { tower: 'fire', name: 'Alev Dalgası', rarity: 'orta', icon: '🌊',
    desc: 'Belli aralıklarla ileri doğru ilerleyen bir alev dalgası yollar. Çarptığı düşmanlara hasar verir ve yakar.',
    upg: 'Hasar artar.' },
  phoenix: { tower: 'fire', name: 'Anka Kuşu', rarity: 'nadir', icon: '🦅',
    desc: 'Belli aralıklarla bir hat boyunca ilerleyen geniş bir alev lazeri fırlatır. Vurduğu her düşman hasar alır ve yanar.',
    upg: 'Hasar ve genişlik artar.' },
  meteor: { tower: 'fire', name: 'Meteor Yağmuru', rarity: 'nadir', icon: '☄️',
    desc: 'Belli aralıklarla belirli bir alana meteorlar düşer; hasar verir ve yakar.',
    upg: 'Hasar ve meteor sayısı artar.' },
  lava: { tower: 'fire', name: 'Lav Fırlatma', rarity: 'nadir', icon: '🌋',
    desc: 'Belli aralıklarla birkaç düşmana, normal saldırıdan %25 fazla hasar veren lav fırlatır ve yakar.',
    upg: 'Bekleme süresi azalır, hedef sayısı artar.' },
  // ---- Buz ----
  ice_path: { tower: 'ice', name: 'Buz Yolu', rarity: 'orta', icon: '🛣️',
    desc: 'Belli aralıklarla düşmanların altına buzdan bir yol oluşturur. Üzerindeki düşmanlar yavaşlar.',
    upg: 'Yavaşlatma ve alan artar, bekleme süresi azalır.' },
  ice_spikes: { tower: 'ice', name: 'Buz Dikenleri', rarity: 'orta', icon: '🔱',
    desc: 'Düşmanların altından buz dikenleri çıkarır. İçinde kalanlar sabitlenir ve hasar alır.',
    upg: 'Dikenlerin alanı ve hasarı artar.' },
  ice_saw: { tower: 'ice', name: 'Buz Testere', rarity: 'orta', icon: '💠',
    desc: 'İleri doğru delip geçen bir buz testere atar. Hasarı az, yavaşlatması güçlüdür.',
    upg: 'Yavaşlatma ve hasar artar.' },
  avalanche: { tower: 'ice', name: 'Çığ', rarity: 'nadir', icon: '☃️',
    desc: 'Dev bir kartopu fırlatır. Çarptıklarını geri iter, sabitler, sonra yavaşlatır. Her çarpışmada büyüyerek ilerler.',
    upg: 'Kartopunun büyüklüğü ve hasarı artar.' },
  queen_tears: { tower: 'ice', name: 'Kraliçenin Gözyaşları', rarity: 'nadir', icon: '🌨️',
    desc: 'PASİF: Kulenin çevresine sürekli kar yağar. Alandaki düşmanlar saniyede bir hasar alır ve yavaşlar.',
    upg: 'Hasar artar.' },
  // ---- Fırtına ----
  tornado: { tower: 'storm', name: 'Hortum', rarity: 'orta', icon: '🌪️',
    desc: 'Düşmanlara bir hortum fırlatır. Hortum düşmanları içine çeker ve hasar verir; biraz durduktan sonra kaybolur.',
    upg: 'Hasar ve kalma süresi artar.' },
  overload: { tower: 'storm', name: 'Aşırı Yükleme', rarity: 'orta', icon: '🔋',
    desc: 'Kulenin saldırı hızını birkaç saniyeliğine büyük ölçüde artırır.',
    upg: 'Saldırı hızı bonusu ve süre artar.' },
  wind_wall: { tower: 'storm', name: 'Rüzgar Duvarı', rarity: 'orta', icon: '🌬️',
    desc: 'İleriye rüzgardan bir duvar yollar. Duvar bir süre kalır ve düşmanları geri iter. Bekleme süresi uzundur.',
    upg: 'Kalma süresi ve itme gücü artar.' },
  thor: { tower: 'storm', name: "Thor'un Gazabı", rarity: 'nadir', icon: '🔨',
    desc: 'PASİF: Belirli aralıklarla düşmanlara ağır hasar veren şimşekler düşer.',
    upg: 'Hasar ve şimşek sayısı artar.' },
  prison: { tower: 'storm', name: 'Yıldırım Hapsi', rarity: 'nadir', icon: '⛓️',
    desc: 'Bir bölgede elektrikli bir alan oluşturur. Alandaki düşmanlar yetenek bitene kadar hapsolur ve sürekli hasar alır.',
    upg: 'Hasar artar.' },
  // ---- Asit ----
  poison_cloud: { tower: 'acid', name: 'Zehir Bulutu', rarity: 'orta', icon: '☁️',
    desc: 'Düşmanların olduğu alana zehirli bir bulut atar. İçindekilere sürekli zehir yükü (stack) biner; her yük saniyede hasar verir.',
    upg: 'Verilen zehir yükü artar.' },
  poison_bomb: { tower: 'acid', name: 'Zehir Bombası', rarity: 'orta', icon: '💣',
    desc: 'Belli aralıklarla düşmanlara zehir bombası atar. Hasar ve zehir yükü verir.',
    upg: 'Bomba sayısı artar.' },
  acid_spray: { tower: 'acid', name: 'Asit Püskürtme', rarity: 'orta', icon: '💦',
    desc: 'Kulenin yakınındaki düşmanlara sürekli asit püskürtür. Zırhlarını azaltır ve hasar verir.',
    upg: 'Menzil ve hasar artar.' },
  acid_rain: { tower: 'acid', name: 'Asit Yağmuru', rarity: 'nadir', icon: '🌧️',
    desc: 'Düşmanların üzerine bir süre asit yağmuru yağar. Her saniye zehir yükü verir ve zırhı azaltır.',
    upg: 'Zehir yükü ve yağmur süresi artar.' },
  contagion: { tower: 'acid', name: 'Bulaşıcı Reaksiyon', rarity: 'nadir', icon: '☣️',
    desc: 'PASİF: Zehirli bir düşman öldüğünde patlar ve üzerindeki zehir yüklerini çevresindeki düşmanlara bulaştırır.',
    upg: 'Patlama alanı ve bulaşan zehir yüzdesi artar.' },
  // ---- Yaşam ----
  speed_life: { tower: 'life', name: 'Speed for Life', rarity: 'orta', icon: '🍃',
    desc: 'Etki alanındaki kulelerin saldırı hızını artırır.',
    upg: 'Saldırı hızı kazancı artar.' },
  fairies: { tower: 'life', name: 'Orman Sakinleri', rarity: 'orta', icon: '🧚',
    desc: 'Kulenin etrafında düşmanlara ateş eden periler belirir (kule başına en fazla 10). Periler yan kulelerin yetenek hasarını da artırır.',
    upg: 'Yetenek hasarı artar.' },
  seismic: { tower: 'life', name: 'Sismik Darbe', rarity: 'nadir', icon: '🪨',
    desc: 'Düşmanlara bir toprak dalgası yollar. Dalgaya yakalanan düşmanlar geriye savrulur ve sersemler.',
    upg: 'Sersemletme süresi ve savurma gücü artar.' },
  decay: { tower: 'life', name: 'Çürüme', rarity: 'orta', icon: '🍂',
    desc: 'Etki alanındaki kulelerin yanma ve zehir gibi zamanla hasarlarını güçlendirir.',
    upg: 'Zamanla hasar artışı büyür.' },
  seeds: { tower: 'life', name: 'Yaşam Tohumları', rarity: 'nadir', icon: '🌰',
    desc: 'Düşmanların yanında az sayıda tohum belirir. Herhangi bir kule yeteneği değince patlar: alan hasarı ve zehir. Kullanılmayan tohumlar kaybolur.',
    upg: 'Hasar ve tohum sayısı artar.' },
  // ---- Birlik ----
  knights: { tower: 'unity', name: 'Knights', rarity: 'orta', icon: '🗡️',
    desc: 'Menzilde 3 kılıçlı asker durur. Küçük menzillerine giren düşmana saldırırlar. Ölünce 10 sn sonra dönerler.',
    upg: 'Saldırı gücü artar.' },
  guards: { tower: 'unity', name: 'Guards', rarity: 'orta', icon: '🛡️',
    desc: 'Gelen düşmanlara doğru 3 kalkanlı asker dizilir. Saldırmazlar, düşmanlar onları geçemez. Ölünce 10 sn sonra dönerler.',
    upg: 'Canları artar.' },
  priests: { tower: 'unity', name: 'Priests', rarity: 'orta', icon: '✝️',
    desc: '3 rahip askerleri iyileştirir, düşmana vurmaz. Ölünce 10 sn sonra dönerler.',
    upg: 'İyileştirme hızı ve miktarı artar.' },
  general: { tower: 'unity', name: 'General', rarity: 'nadir', icon: '🎖️',
    desc: 'Güçlü bir general çağırır. Yaşarken etrafındaki askerlere aura verir. Ölünce 10 sn sonra döner.',
    upg: 'Auranın gücü artar.' },
  last_stand: { tower: 'unity', name: 'Not Ready to Die', rarity: 'nadir', icon: '💀',
    desc: 'Ölecek asker 3 sn daha güçlenip savaşır, sonra ölür.',
    upg: 'Güçlenme artar.' },
  // ---- Slime ----
  slime_bomb: { tower: 'slime', name: 'Balçık Bombası', rarity: 'orta', icon: '💣',
    desc: 'Bir alana balçık bombası atar. Hasar ve 1 balçık yığını verir.',
    upg: 'Yığın ve hasar artar.' },
  slime_punch: { tower: 'slime', name: 'Geri Dur!', rarity: 'orta', icon: '👊',
    desc: 'Yerden gelen düşmanlara doğru bir balçık vuruşu yapar. Geri iter ve 1 yığın verir.',
    upg: 'İtme mesafesi artar.' },
  snail: { tower: 'slime', name: 'Salyangoz!?', rarity: 'nadir', icon: '🐌',
    desc: 'Kulenin etrafında bir salyangoz gezer, arkasına balçık bırakır. Üzerinden geçenler hasar alır ve yığın birikir.',
    upg: 'Hasar ve saniyedeki yığın artar.' },
  slime_prison: { tower: 'slime', name: 'Balçık Hapsi', rarity: 'orta', icon: '🫙',
    desc: 'Bir düşmanı balçık hapsine kapatır. Hap kırılmadan ilerleyemez.',
    upg: 'Hapisin canı artar.' },
  slime_king: { tower: 'slime', name: 'Slime King', rarity: 'nadir', icon: '👑',
    desc: 'Menzilin uzak ucunda bir slime kralı durur. Dalga başında zıplayıp patlayan küçük slimelar çıkarır. Ölürse sonraki dalgada döner.',
    upg: 'Çıkan slime sayısı artar.' },
};

// Her yetenek dosyası buraya { params, stats, update, onAcquire?, dispose? } kaydeder.
const ABILITY_IMPL = {};

// Yetenek bekleme süresi yardımcısı: hazır olunca fire() çağrılır; hedef bulunamazsa kısa süre sonra tekrar dener.
function abilityTick(ab, dt, cd, fire) {
  ab.timer -= dt;
  const m = (window.game && window.game.abilityCdMult) || 1;
  if (ab.timer <= 0) ab.timer = fire() ? cd * m : 0.3;
}

const sec = (v) => v.toFixed(1) + ' sn';
const pct = (v) => '%' + Math.round(v * 100);

// Yeni kule tipi eklenince bağışıklık da otomatik açılır (dalga 5, 7, 9, 12, 15, 18, ...)
const ELEMENT_UNLOCK = [8, 11, 14, 17, 20, 23, 26, 29];
function elementUnlockWave(id) {
  const t = TOWER_TYPES[id];
  if (!t || t.element === false) return 99;
  if (t.unlock != null) return t.unlock;
  const i = Object.keys(TOWER_TYPES).filter((k) => TOWER_TYPES[k].element !== false).indexOf(id);
  if (i < 0) return 99;
  return ELEMENT_UNLOCK[i] || (ELEMENT_UNLOCK[ELEMENT_UNLOCK.length - 1] + (i - ELEMENT_UNLOCK.length + 1) * 3);
}
function unlockedElements(wave) {
  return Object.keys(TOWER_TYPES).filter((id) => TOWER_TYPES[id].element !== false && wave >= elementUnlockWave(id));
}
function elementLabel(id) {
  const t = TOWER_TYPES[id];
  return t ? t.name.replace(' Kulesi', '') : id;
}
