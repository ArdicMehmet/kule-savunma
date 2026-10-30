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
};

const BASIC_CARDS = {
  as: { name: 'Saldırı Hızı', icon: '💨', desc: 'Kulenin saldırı hızı +%12.' },
  dmg: { name: 'Hasar Artışı', icon: '⚔️', desc: 'Kulenin hasarı +%15. Yeteneklerin hasarını da artırır.' },
  range: { name: 'Menzil', icon: '🎯', desc: 'Kulenin menzili +%8.', max: 8 },
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
    desc: 'İleriye rüzgardan bir duvar yollar. Duvar bir süre kalır ve düşmanları sürekli geri iterek ilerlemelerini engeller.',
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
};

// Her yetenek dosyası buraya { params, stats, update, onAcquire?, dispose? } kaydeder.
const ABILITY_IMPL = {};

// Yetenek bekleme süresi yardımcısı: hazır olunca fire() çağrılır; hedef bulunamazsa kısa süre sonra tekrar dener.
function abilityTick(ab, dt, cd, fire) {
  ab.timer -= dt;
  if (ab.timer <= 0) ab.timer = fire() ? cd : 0.3;
}

const sec = (v) => v.toFixed(1) + ' sn';
const pct = (v) => '%' + Math.round(v * 100);
