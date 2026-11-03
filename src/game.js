'use strict';

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hitP = new THREE.Vector3();
const _wantPos = new THREE.Vector3();
const _wantLook = new THREE.Vector3();
const _sa = new THREE.Vector3();
const _sb = new THREE.Vector3();

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

function flatRing(inner, outer, color, opacity, segs = 96) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, segs), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 6;
  return m;
}

function flatDisc(color, opacity) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, toneMapped: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 5;
  return m;
}

function enableShadows(obj) {
  obj.traverse((o) => { if (o.isMesh && o.material && !o.material.transparent) o.castShadow = true; });
}

class Game {
  constructor() {
    buildTextures();
    buildMaterials();
    initHpBars();
    initFxAssets();
    this.initRenderer();
    this.initScene();

    this.state = 'menu';
    this.gold = CFG.startGold;
    this.castleHp = CFG.castle.maxHp;
    this.speed = 1;
    this.luck = 0; this.heroLevel = 0; this.repairs = 0; this.foundationsBought = 0; this.rerollCount = 0;
    this.ownedRelics = new Set(); this.relics = {};
    this.goldMult = 1; this.abilityDmgMult = 1; this.moveMult = 1; this.durMult = 1;
    this.sellRatio = CFG.sellRatio; this.castleMax = CFG.castle.maxHp; this.heroShots = 1;
    this.rebornReady = false; this.rebornUsed = false;
    this.plagueStacks = 0; this.plagueMult = 1; this.weaponWaves = 0;
    this.snowCd = 0; this.king = null; this.relicPending = 0; this.snowSrc = null;
    this.eventHpMult = 1; this.eventSpeedMult = 1; this.eventGoldMult = 1; this.abilityCdMult = 1;
    this.activeEvent = null; this.wormholes = [];
    wrapAbilityDurations();
    this.enemies = []; this.towers = []; this.projectiles = []; this.effects = []; this.seeds = [];
    this.grid = new SpatialGrid(4); this._q = [];
    this.stats = { kills: 0, goldEarned: 0, towers: 0 };
    this.time = 0; this.camShake = 0; this.zoom = 1; this.zoomTarget = 1; this.smokeT = 0;
    this.placing = null; this.selectedTower = null; this.focusTower = null; this.nearTower = null; this.contagionTower = null;
    this.input = { up: false, down: false, left: false, right: false, sprint: false };
    this.mouse = { x: 0, y: 0, inside: false };

    this.fxA = new ParticleSystem(this.scene, 6000, true);
    this.fxN = new ParticleSystem(this.scene, 3000, false);
    this.world = new World(this);
    for (const d of this.world.decor) enableShadows(d.mesh);
    this.hero = new Hero(this);
    enableShadows(this.hero.mesh);
    this.waves = new WaveManager(this);
    this.ui = new UI(this);
    this.buildHelpers();

    this.camPos = new THREE.Vector3(0, 42, 44);
    this.camLook = new THREE.Vector3(0, 0, -6);
    this.bindInput();
    this.onResize();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));

    let auto = false;
    try { auto = sessionStorage.getItem('ks_autostart') === '1'; sessionStorage.removeItem('ks_autostart'); } catch (e) { /* file:// kısıtı */ }
    if (auto) this.start();
  }

  // ---------------- Kurulum ----------------
  initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('game-root').appendChild(r.domElement);
    this.renderer = r;
  }

  initScene() {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0xa8d8f0);
    s.fog = new THREE.Fog(0xa8d8f0, 70, 150);
    this.hemi = new THREE.HemisphereLight(0xd4ecff, 0x5a6b3a, 1.15);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 130;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);
    this.sun = sun;
    this.scene = s;
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 320);
  }

  buildHelpers() {
    const br = CFG.hero.buildRadius;
    this.ghost = Models.ghost();
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.buildRing = new THREE.Group();
    const fill = flatDisc(0x9fe8ff, 0.06);
    fill.scale.setScalar(br);
    this.buildRing.add(flatRing(br - 0.12, br, 0x9fe8ff, 0.75), fill);
    this.buildRing.visible = false;
    this.scene.add(this.buildRing);
    this.rangeRing = new THREE.Group();
    this.rangeLine = flatRing(0.975, 1, 0xffffff, 0.75);
    this.rangeFill = flatDisc(0xffffff, 0.07);
    this.rangeRing.add(this.rangeLine, this.rangeFill);
    this.rangeRing.visible = false;
    this.scene.add(this.rangeRing);
    this.selRing = flatRing(1.55, 1.75, 0xffd451, 0.9, 48);
    this.selRing.visible = false;
    this.scene.add(this.selRing);
  }

  bindInput() {
    const cv = this.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      const k = KEYMAP[e.code];
      if (k) { this.input[k] = true; if (e.code.startsWith('Arrow')) e.preventDefault(); }
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      if (this.state !== 'menu') Sound.init();
      if (!e.repeat) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) this.input[k] = false; });
    window.addEventListener('blur', () => { for (const k in this.input) this.input[k] = false; });
    window.addEventListener('pointerdown', () => { if (this.state !== 'menu') Sound.init(); });
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.togglePause(); });
    cv.addEventListener('pointermove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; });
    cv.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    cv.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomTarget = clamp(this.zoomTarget + Math.sign(e.deltaY) * 0.1, 0.55, 1.5);
    }, { passive: false });
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const ph = h * this.renderer.getPixelRatio();
    this.fxA.setScale(ph, this.camera.fov);
    this.fxN.setScale(ph, this.camera.fov);
  }

  // ---------------- Durum ----------------
  start() {
    if (this.state !== 'menu') return;
    Sound.init();
    this.state = 'playing';
    this.ui.showHUD();
    this.ui.banner('Kaleyi Savun!', `İlk dalga ${CFG.firstBreak} saniye sonra · Mağazadan (B) bir Kule Temeli al`, '#ffd451');
    this.waves.prepareNext();
  }

  restart() {
    try { sessionStorage.setItem('ks_autostart', '1'); } catch (e) { /* yok say */ }
    location.reload();
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; this.ui.setPause(true); }
    else if (this.state === 'paused') { this.state = 'playing'; this.ui.setPause(false); }
  }

  toggleSpeed() {
    if (this.state !== 'playing') return;
    this.speed = this.speed === 1 ? 2 : 1;
    Sound.play('click');
  }

  toggleMute() { Sound.setMuted(!Sound.muted); }

  callWave() {
    if (this.state !== 'playing') return;
    const bonus = this.waves.callEarly();
    if (bonus > 0) { this.addGold(bonus); this.ui.toast(`⚔️ Dalga erken çağrıldı: +${bonus} 💰`); }
  }

  onWaveStart(n, ev) {
    applyWaveEvent(this, ev || null);
    if (ev) Sound.play('unlock');
    if (this.relics.plague) {
      this.plagueStacks++;
      this.plagueMult = Math.max(0.4, Math.pow(0.9, this.plagueStacks));
    }
    if (this.relics.weapon) {
      this.weaponWaves = Math.min(10, this.weaponWaves + 1);
      this.syncHeroDmg();
    }
    if (this.snowCd > 0) { this.snowCd--; this.ui.updateSnowButton(); }
    if (this.king) this.king.onWaveStart();
  }

  onWaveCleared(n) {
    clearWaveEvent(this);
    if (this.king) this.king.onWaveCleared();
    for (const t of this.towers) if (t.waveFrozen || t.frozenT > 0) t.unfreeze();
    const tips = {
      1: '💡 Kulenin yanına gidip E ile yükselt: her yükseltmede 3 rastgele karttan birini seçersin.',
      2: '💡 Mağazadaki Şans Tılsımı, Orta ve Nadir kartların gelme şansını artırır.',
      3: '💡 Space ile dalgayı erken çağırırsan bonus altın kazanırsın.',
    };
    if (tips[n]) setTimeout(() => this.ui.toast(tips[n]), 2800);
  }

  syncHeroDmg() {
    this.hero.dmgMult = (1 + 0.22 * this.heroLevel) * (1 + 0.1 * this.weaponWaves);
  }

  oneReroll(draw) {
    return {
      cost: () => 0,
      fn: () => {
        if (this.rerollCount >= 1) return null;
        this.rerollCount++;
        return draw();
      },
    };
  }

  tryReborn() {
    if (!this.rebornReady || this.rebornUsed) return false;
    this.rebornReady = false;
    this.rebornUsed = true;
    this.castleHp = 1;
    this.waves.queue.length = 0;
    for (const e of this.enemies) if (!e.dead) e.takeDamage(1e9, {});
    this.ui.banner('🔥 REBORN', 'Kale 1 canla ayakta kaldı!', '#ff6b3b');
    this.ui.toast('🔥 Reborn: tüm düşmanlar yok oldu.');
    Sound.play('boss_horn');
    this.shake(0.85);
    this.ui.renderRelicBar();
    return true;
  }

  debugGiveRelic() {
    if (!DEBUG || this.state === 'cards' || this.state === 'gameover' || this.state === 'menu') return;
    const left = Object.values(RELIC_DEFS).filter((d) => !this.ownedRelics.has(d.id));
    if (!left.length) { this.ui.toast('Tüm relicler alındı.'); return; }
    if (this.state === 'paused') this.togglePause();
    this.relicPending++;
    this.flushRelics();
  }

  flushRelics() {
    if (this.state === 'cards' || this.state === 'gameover' || this.relicPending <= 0) return;
    const cards = drawRelics(this, 3);
    if (!cards.length) { this.relicPending = 0; this.ui.toast('Seçilecek relic kalmadı.'); return; }
    this.relicPending--;
    this.openRelicChoice(cards);
  }

  openRelicChoice(cards) {
    this.state = 'cards';
    this.rerollCount = 0;
    this.ui.openCards({
      title: '✨ Relic Seçimi',
      sub: 'Boss düştü! Üç relicten birini seç. Bir kez ücretsiz yenileyebilirsin.',
      cards,
      reroll: this.oneReroll(() => drawRelics(this, 3)),
      onPick: (c) => { this.state = 'playing'; applyRelic(this, c.id); this.flushRelics(); },
    });
  }

  gameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.ui.closeShop();
    this.placing = null;
    this.ghost.visible = false; this.buildRing.visible = false;
    Sound.play('game_over');
    Sound.setIntensity(0);
    const c = CFG.castle;
    fxExplosion(this, c.x, c.z, 6, 0xff7a2f);
    this.shake(0.9);
    const wave = this.waves.wave;
    let best = 0;
    try { best = +localStorage.getItem('ks_best_wave') || 0; } catch (e) { /* yok say */ }
    const record = wave > best;
    if (record) { try { localStorage.setItem('ks_best_wave', String(wave)); } catch (e) { /* yok say */ } }
    setTimeout(() => this.ui.showGameOver({
      wave, kills: this.stats.kills, towers: this.stats.towers,
      goldEarned: Math.floor(this.stats.goldEarned), record, best: Math.max(best, wave),
    }), 1200);
  }

  // ---------------- Girdi ----------------
  onKey(c) {
    const ui = this.ui;
    switch (this.state) {
      case 'menu': if (c === 'Enter' || c === 'Space') this.start(); return;
      case 'gameover': if (c === 'Enter') this.restart(); return;
      case 'paused':
        if (c === 'KeyP' || c === 'Escape') this.togglePause();
        else if (c === 'KeyM') this.toggleMute();
        return;
      case 'cards': {
        const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[c];
        if (n !== undefined) ui.pickCard(n);
        else if (c === 'KeyR') ui.reroll();
        else if (c === 'KeyM') this.toggleMute();
        return;
      }
    }
    switch (c) {
      case 'Escape':
        if (this.placing) this.cancelPlacing();
        else if (ui.shopOpen) ui.closeShop();
        else if (this.selectedTower) this.selectedTower = null;
        else this.togglePause();
        break;
      case 'KeyP': this.togglePause(); break;
      case 'KeyE': this.interact(); break;
      case 'KeyB': ui.toggleShop(); break;
      case 'KeyT': this.buy('foundation'); break;
      case 'Space': this.callWave(); break;
      case 'KeyF': this.toggleSpeed(); break;
      case 'KeyM': this.toggleMute(); break;
      case 'KeyC': fireSnowShower(this); break;
      case 'KeyG': if (DEBUG) this.addGold(1000); break;
      case 'KeyK': if (DEBUG) for (const e of this.enemies) e.takeDamage(1e9, {}); break;
      case 'KeyL': if (DEBUG) this.debugGiveRelic(); break;
      case 'KeyN':
        if (DEBUG && this.waves.state === 'break') {
          this.waves.wave = Math.max(this.waves.wave, 9);
          this.waves.next = null;
          this.waves.prepareNext();
          this.waves.timer = 0.15;
        }
        break;
      case 'KeyV':
        if (DEBUG && this.waves.next) {
          const ids = Object.keys(WAVE_EVENTS);
          const cur = this.waves.next.event;
          const ev = WAVE_EVENTS[ids[cur ? (ids.indexOf(cur.id) + 1) % ids.length : 0]];
          this.waves.next.event = ev;
          this.waves.next.summary.event = ev;
          this.waves.lastEventWave = this.waves.next.wave;
          this.ui.showWavePreview(this.waves.next.wave, this.waves.next.summary);
          this.ui.toast(`DEBUG event: ${ev.icon} ${ev.name}`);
        }
        break;
    }
  }

  onPointerDown(e) {
    if (this.state !== 'playing') return;
    if (e.button === 2) {
      if (this.placing) this.cancelPlacing();
      else this.selectedTower = null;
      return;
    }
    if (e.button !== 0) return;
    if (this.placing) { this.tryPlace(this.groundPoint(e.clientX, e.clientY)); return; }
    const t = this.pickTower(e.clientX, e.clientY);
    if (t !== this.selectedTower) {
      this.selectedTower = t;
      if (t) Sound.play('click');
    }
  }

  groundPoint(cx, cy) {
    _ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, this.camera);
    return _ray.ray.intersectPlane(_groundPlane, _hitP);
  }

  // Ekran uzayında kule gövdesine en yakın kule
  pickTower(mx, my) {
    const w = window.innerWidth, h = window.innerHeight, cam = this.camera;
    let best = null, bd = 40 * 40;
    for (const t of this.towers) {
      _sa.set(t.x, 0.2, t.z).project(cam);
      _sb.set(t.x, t.type ? t.muzzleY + 0.6 : 0.8, t.z).project(cam);
      const d = segDist2(mx, my, (_sa.x + 1) * w / 2, (1 - _sa.y) * h / 2, (_sb.x + 1) * w / 2, (1 - _sb.y) * h / 2);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ---------------- Ana döngü ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    if (this.state === 'playing') {
      for (let i = 0; i < this.speed && this.state === 'playing'; i++) this.step(dt);
    } else if (this.state === 'menu' || this.state === 'gameover') {
      this.world.update(dt);
      this.updateList(this.effects, dt);
      for (const e of this.enemies) if (e.dead && !e.removed) e.update(dt, this.time);
      this.fxA.update(dt);
      this.fxN.update(dt);
    }
    this.updateCamera(dt);
    const q = this.camera.quaternion;
    for (const e of this.enemies) if (e.hpBar.visible) e.hpBar.quaternion.copy(q);
    if (this.king && this.king.alive) this.king.hpBar.quaternion.copy(q);
    this.ui.update(this.state === 'playing' ? dt * this.speed : dt);
    this.renderer.render(this.scene, this.camera);
  }

  step(dt) {
    this.waves.update(dt);
    this.hero.update(dt, this.input);
    if (this.king) this.king.update(dt);
    const en = this.enemies;
    for (let i = 0; i < en.length; i++) en[i].update(dt, this.time);
    let w = 0;
    for (let i = 0; i < en.length; i++) {
      const e = en[i];
      if (e.removed) e.dispose(); else en[w++] = e;
    }
    en.length = w;
    this.grid.clear();
    for (let i = 0; i < w; i++) if (!en[i].dead) this.grid.insert(en[i]);
    for (const t of this.towers) t.update(dt);
    this.updateList(this.projectiles, dt);
    this.updateList(this.effects, dt);
    this.fxA.update(dt);
    this.fxN.update(dt);
    this.world.update(dt);
    this.updateCastleFx(dt);
    this.updateInteraction();
    if (this.placing) this.updatePlacement();
  }

  updateList(list, dt) {
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.update(dt)) list[w++] = o; else o.dispose();
    }
    list.length = w;
  }

  updateCamera(dt) {
    if (this.state === 'menu') {
      const a = this.time * 0.05;
      this.camPos.set(Math.sin(a) * 50, 42, -6 + Math.cos(a) * 50);
      this.camLook.set(0, 0, -6);
    } else {
      this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 8);
      const h = this.hero, k = Math.min(1, dt * 5);
      _wantLook.set(h.x, 0, h.z - 1.5);
      _wantPos.set(h.x, 24 * this.zoom, h.z - 1.5 + 17 * this.zoom);
      this.camPos.lerp(_wantPos, k);
      this.camLook.lerp(_wantLook, k);
    }
    const c = this.camera;
    c.position.copy(this.camPos);
    if (this.camShake > 0) {
      this.camShake *= Math.exp(-dt * 7);
      if (this.camShake < 0.005) this.camShake = 0;
      const s = this.camShake * 0.9;
      c.position.x += rand(-s, s); c.position.y += rand(-s, s) * 0.5; c.position.z += rand(-s, s);
    }
    c.lookAt(this.camLook);
    this.sun.position.set(this.camLook.x + 22, 42, this.camLook.z + 14);
    this.sun.target.position.copy(this.camLook);
  }

  shake(a) { this.camShake = Math.min(0.9, this.camShake + a); }

  updateCastleFx(dt) {
    const k = 1 - this.castleHp / this.castleMax;
    if (k < 0.25) return;
    this.smokeT -= dt;
    if (this.smokeT > 0) return;
    this.smokeT = 0.35 / k;
    const c = CFG.castle;
    this.fxN.emit({ x: c.x + rand(-3, 3), y: rand(4, 6.5), z: c.z + rand(-2.5, 2), vx: rand(-0.3, 0.3), vy: rand(1, 1.8), vz: rand(-0.3, 0.3), life: rand(1.8, 2.8), size: rand(0.6, 1), size2: rand(2, 3), color: 0x3a3a3a, alpha: 0.45, drag: 0.4 });
    if (k > 0.55) this.fxA.emit({ x: c.x + rand(-2.5, 2.5), y: rand(4, 6), z: c.z + rand(-2, 2), vy: rand(1, 2), life: 0.5, size: 0.6, size2: 0.1, color: choice([0xff6a10, 0xffa030]), alpha: 0.9 });
  }

  // Yakındaki kule, istem metni, menzil halkası
  updateInteraction() {
    const h = this.hero;
    let near = null, nd = CFG.hero.interactRadius * CFG.hero.interactRadius;
    for (const t of this.towers) {
      const d = dist2(h.x, h.z, t.x, t.z);
      if (d < nd) { nd = d; near = t; }
    }
    this.nearTower = near;
    if (this.selectedTower && this.selectedTower.removed) this.selectedTower = null;
    const f = this.focusTower = near || this.selectedTower;

    let html = '';
    if (this.placing) html = '🧱 Temeli yerleştirmek için <b>sol tık</b> &nbsp;·&nbsp; İptal: <b>sağ tık</b> / <kbd>Esc</kbd>';
    else if (near) {
      const cost = near.upgradeCost(), ok = this.gold >= cost;
      const what = near.type
        ? `${near.icon} ${near.name} yükselt <span style="opacity:.7">(Sv. ${near.level} → ${near.level + 1})</span>`
        : '🎲 Kule seç <span style="opacity:.7">(3 rastgele kule)</span>';
      html = `<kbd>E</kbd> ${what} — <b style="color:${ok ? '#ffd451' : '#ff6b5b'}">${cost} 💰</b>`;
    }
    this.ui.showPrompt(html);

    if (f && f.type) {
      const col = TOWER_TYPES[f.type].hex;
      this.rangeRing.visible = true;
      this.rangeRing.position.set(f.x, 0.06, f.z);
      this.rangeRing.scale.set(f.range, 1, f.range);
      this.rangeLine.material.color.setHex(col);
      this.rangeFill.material.color.setHex(col);
    } else this.rangeRing.visible = false;
    if (f) {
      this.selRing.visible = true;
      this.selRing.position.set(f.x, 0.07, f.z);
      this.selRing.scale.setScalar(1 + Math.sin(this.time * 5) * 0.05);
      this.selRing.material.color.setHex(near === f ? 0xffd451 : 0xffffff);
    } else this.selRing.visible = false;
  }

  // ---------------- Yerleştirme ----------------
  updatePlacement() {
    const h = this.hero;
    this.buildRing.position.set(h.x, 0.06, h.z);
    const p = this.mouse.inside ? this.groundPoint(this.mouse.x, this.mouse.y) : null;
    if (!p) { this.ghost.visible = false; return; }
    this.ghost.visible = true;
    this.ghost.position.set(p.x, 0, p.z);
    const ok = dist(p.x, p.z, h.x, h.z) <= CFG.hero.buildRadius && this.world.canPlace(p.x, p.z, this.towers).ok;
    this.ghost.userData.mat.color.setHex(ok ? 0x55ff77 : 0xff5544);
  }

  tryPlace(p) {
    if (!p || !this.placing) return;
    const h = this.hero;
    if (dist(p.x, p.z, h.x, h.z) > CFG.hero.buildRadius) {
      this.ui.toast('Kahramanına daha yakın bir yer seç! (mavi halka)', true);
      Sound.play('error');
      return;
    }
    const r = this.world.canPlace(p.x, p.z, this.towers);
    if (!r.ok) { this.ui.toast(r.reason + '!', true); Sound.play('error'); return; }
    const x = p.x, z = p.z;
    this.world.removeDecorAt(x, z, CFG.foundationRadius + 0.4);
    const t = new Tower(this, x, z);
    enableShadows(t.group);
    t.spent = this.placing.cost;
    this.towers.push(t);
    this.foundationsBought++;
    this.placing = null;
    this.ghost.visible = false;
    this.buildRing.visible = false;
    Sound.play('place');
    this.addFx(new RingPulseFx(this, x, z, 3.2, 0x9fe8ff, 0.5));
    this.fxN.burst(x, 0.3, z, 18, { color: 0xa08a6a, speed: 3, life: 0.6, size: 0.45, size2: 0.9, gravity: 3 });
    this.shake(0.12);
    this.selectedTower = t;
  }

  cancelPlacing() {
    if (!this.placing) return;
    this.gold += this.placing.cost;
    this.placing = null;
    this.ghost.visible = false;
    this.buildRing.visible = false;
    this.ui.toast('Yerleştirme iptal edildi, altının iade edildi.');
  }

  // ---------------- Kule etkileşimi ----------------
  interact() {
    if (this.placing) return;
    if (this.nearTower) this.interactWith(this.nearTower);
    else if (this.selectedTower) { this.ui.toast('Kuleyle etkileşim için kahramanınla yanına git!', true); Sound.play('error'); }
  }

  interactWith(t) {
    if (this.state !== 'playing' || !t || t.removed) return;
    if (dist(this.hero.x, this.hero.z, t.x, t.z) > CFG.hero.interactRadius + 0.3) {
      this.ui.toast('Kuleye yaklaşman gerekiyor!', true);
      Sound.play('error');
      return;
    }
    const cost = t.upgradeCost();
    if (!this.spend(cost)) return;
    t.spent += cost;
    if (t.type) this.openUpgrade(t); else this.openTowerChoice(t);
  }

  towerChoiceCards() {
    return shuffle(Object.keys(TOWER_TYPES)).slice(0, 3).map((id) => {
      const d = TOWER_TYPES[id];
      const stats = d.support ? [
        ['Saldırı', null, 'Yok (destek)'],
        ['Etki alanı', null, fmt(d.base.range) + ' m'],
        ['Alan bufu', null, '+%8 saldırı hızı'],
      ] : [
        ['Hasar', null, fmt(d.base.damage)],
        ['Saldırı hızı', null, fmt(d.base.rate) + '/sn'],
        ['Menzil', null, fmt(d.base.range) + ' m'],
      ];
      return {
        kind: 'tower', id, rarity: 'tower', icon: d.icon, name: d.name, levelText: 'YENİ KULE', desc: d.desc,
        preview: [...stats, ['Yetenekler', null, d.abilities.map((a) => ABILITY_DEFS[a].icon).join(' ')]],
      };
    });
  }

  openTowerChoice(t) {
    this.openCardModal({
      title: '🎲 Kule Seçimi',
      sub: 'Temelin üzerine kurulacak kuleyi seç. Bir kez ücretsiz yenileyebilirsin.',
      draw: () => this.towerChoiceCards(),
      onPick: (c) => this.buildTower(t, c.id),
    });
  }

  openUpgrade(t) {
    this.openCardModal({
      title: `${t.icon} ${t.name} — Yükseltme`,
      sub: `Seviye ${t.level} → ${t.level + 1}. Bir kart seç — bir kez ücretsiz yenileyebilirsin.`,
      draw: () => t.drawCards(3),
      onPick: (c) => this.applyUpgrade(t, c),
    });
  }

  openCardModal(o) {
    this.state = 'cards';
    this.rerollCount = 0;
    this.ui.openCards({
      title: o.title, sub: o.sub, cards: o.draw(),
      reroll: this.oneReroll(o.draw),
      onPick: (c) => { this.state = 'playing'; Sound.play('card_pick'); o.onPick(c); this.flushRelics(); },
    });
  }

  buildTower(t, type) {
    t.setType(type);
    enableShadows(t.group);
    this.stats.towers++;
    const d = TOWER_TYPES[type];
    Sound.play('build');
    this.addFx(new RingPulseFx(this, t.x, t.z, 4, d.hex, 0.6));
    this.fxA.burst(t.x, 1.5, t.z, 30, { color: d.hex, speed: 5, life: 0.7, size: 0.4, gravity: 3 });
    this.shake(0.15);
    this.ui.floatText(t.x, 4, t.z, `${d.icon} ${d.name}!`, d.color, 18);
    this.selectedTower = t;
    this.refreshGlobals();
  }

  applyUpgrade(t, c) {
    t.applyCard(c);
    Sound.play('upgrade');
    const hex = TOWER_TYPES[t.type].hex;
    this.addFx(new RingPulseFx(this, t.x, t.z, 3.5, hex, 0.5));
    this.fxA.burst(t.x, t.muzzleY, t.z, 24, { color: hex, speed: 4, life: 0.6, size: 0.35, gravity: 1 });
    const label = c.kind === 'ability' && !c.isNew ? `${c.icon} ${c.name} Sv.${t.abilities[c.id].level}` : `${c.icon} ${c.name}`;
    this.ui.floatText(t.x, t.muzzleY + 1.5, t.z, label, CFG.rarity[c.rarity].color, 16);
    if (c.kind === 'ability' && c.isNew && c.rarity === 'nadir') this.ui.banner(`${c.icon} ${c.name}`, 'NADİR yetenek kazanıldı!', CFG.rarity.nadir.color);
    this.refreshGlobals();
  }

  sellTower(t) {
    if (!t || t.removed || this.state !== 'playing') return;
    const v = t.sellValue();
    this.gold += v;
    this.ui.floatText(t.x, 2.5, t.z, `+${v} 💰`, '#ffd451', 16);
    this.fxN.burst(t.x, 0.8, t.z, 24, { color: 0x9a8a6a, speed: 3.5, life: 0.8, size: 0.5, size2: 1, gravity: 2 });
    Sound.play('coin');
    t.dispose();
    this.towers.splice(this.towers.indexOf(t), 1);
    if (this.selectedTower === t) this.selectedTower = null;
    if (this.focusTower === t) this.focusTower = null;
    if (this.nearTower === t) this.nearTower = null;
    this.refreshGlobals();
  }

  refreshGlobals() {
    let best = null;
    for (const t of this.towers) {
      const ab = t.abilities.contagion;
      if (ab && (!best || ab.level > best.abilities.contagion.level)) best = t;
    }
    this.contagionTower = best;
    // Yaşam Kulesi auraları: etki alanındaki kulelere buf
    for (const t of this.towers) {
      t.buffHaste = 0; t.buffPoison = 0; t.buffSummon = 1; t.buffFrom = null;
    }
    for (const L of this.towers) {
      if (!L.isSupport) continue;
      L.buffSummon += L.auraSummon;
      for (const t of this.towers) {
        if (t === L || !t.type || t.isSupport || dist(t.x, t.z, L.x, L.z) > L.range) continue;
        t.buffHaste += L.auraHaste;
        t.buffPoison += L.auraPoison;
        t.buffSummon += L.auraSummon;
        if (!t.buffFrom || L.level > t.buffFrom.level) t.buffFrom = L;
      }
    }
    for (const t of this.towers) {
      t.buffHaste = Math.min(0.8, t.buffHaste);
      t.buffPoison = Math.min(0.6, t.buffPoison);
      t.buffSummon = Math.min(3, t.buffSummon);
    }
  }

  triggerSeeds(x, z) {
    const r2 = SEED_TRIGGER_R * SEED_TRIGGER_R;
    for (const s of this.seeds) if (!s.exploded && dist2(s.x, s.z, x, z) <= r2) s.explode();
  }

  // ---------------- Mağaza ----------------
  luckCost() { return Math.round(180 * Math.pow(1.85, this.luck) / 5) * 5; }
  heroCost() { return Math.round(140 * Math.pow(1.75, this.heroLevel) / 5) * 5; }
  repairCost() { return 60 + 20 * this.repairs; }

  shopItems() {
    const nadirPct = (l) => {
      const w = (r) => Math.max(1, CFG.rarity[r].weight + CFG.luckShift[r] * l);
      const tot = w('temel') + w('orta') + w('nadir');
      return Math.round(100 * w('nadir') / tot);
    };
    const max = this.castleMax;
    return [
      { id: 'foundation', icon: '🧱', name: 'Kule Temeli',
        desc: 'Kahramanının yakınına bir temel yerleştir. Yanına gidip <kbd>E</kbd> ile 3 rastgele kuleden birini seç. Kısayol: <kbd>T</kbd>',
        cost: CFG.foundationCost(this.foundationsBought), disabled: !!this.placing },
      { id: 'repair', icon: '🛠️', name: 'Kale Onarımı', desc: `Kaleye +5 can verir. (${Math.ceil(this.castleHp)}/${max})`,
        cost: this.repairCost(), disabled: this.castleHp >= max },
      { id: 'luck', icon: '🍀', name: 'Şans Tılsımı',
        desc: `Nadir kart şansı: %${nadirPct(this.luck)}${this.luck < 4 ? ' → %' + nadirPct(this.luck + 1) : ''} (Sv. ${this.luck}/4)`,
        cost: this.luckCost(), maxed: this.luck >= 4 },
      { id: 'hero', icon: '🗡️', name: 'Kahraman Gücü', desc: `Hasar +%22, saldırı hızı +%7. (Sv. ${this.heroLevel}/6)`,
        cost: this.heroCost(), maxed: this.heroLevel >= 6 },
    ];
  }

  buy(id) {
    if (this.state !== 'playing') return;
    switch (id) {
      case 'foundation': {
        if (this.placing) return;
        const cost = CFG.foundationCost(this.foundationsBought);
        if (!this.spend(cost)) return;
        this.placing = { cost };
        this.ui.closeShop();
        this.buildRing.visible = true;
        Sound.play('buy');
        this.ui.toast('🧱 Temeli kahramanının çevresindeki mavi halkanın içine yerleştir (sol tık).');
        break;
      }
      case 'repair': {
        if (this.castleHp >= this.castleMax || !this.spend(this.repairCost())) return;
        this.repairs++;
        this.castleHp = Math.min(this.castleMax, this.castleHp + 5);
        Sound.play('build');
        const c = CFG.castle;
        this.ui.floatText(c.x, 6, c.z, '+5 ❤️', '#7ee787', 20);
        this.fxA.burst(c.x, 4, c.z, 30, { color: 0x7ee787, speed: 4, life: 0.8, size: 0.4, gravity: -1 });
        break;
      }
      case 'luck': {
        if (this.luck >= 4 || !this.spend(this.luckCost())) return;
        this.luck++;
        Sound.play('upgrade');
        this.ui.toast(`🍀 Şans seviyesi ${this.luck}. Nadir kartlar hâlâ seyrek gelir.`);
        break;
      }
      case 'hero': {
        if (this.heroLevel >= 6 || !this.spend(this.heroCost())) return;
        this.heroLevel++;
        this.syncHeroDmg();
        this.hero.rateMult = 1 + 0.07 * this.heroLevel;
        Sound.play('upgrade');
        this.addFx(new RingPulseFx(this, this.hero.x, this.hero.z, 3, 0x9ff4ff, 0.5));
        this.ui.toast(`🗡️ Kahraman güçlendi! (Sv. ${this.heroLevel})`);
        break;
      }
    }
  }

  addGold(n, earned = true) {
    this.gold += n;
    if (earned) this.stats.goldEarned += n;
  }

  spend(n) {
    if (this.gold < n) { Sound.play('error'); this.ui.toast('Yetersiz altın! 💰', true); return false; }
    this.gold -= n;
    return true;
  }

  // ---------------- Düşmanlar ----------------
  spawnEnemy(type, path, wave, lateral, extra) {
    const e = new Enemy(this, type, path, wave, lateral, extra);
    this.enemies.push(e);
    return e;
  }

  aliveEnemies() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead) n++;
    return n;
  }

  onEnemyKilled(e, src) {
    this.stats.kills++;
    const gold = Math.max(1, Math.round(e.gold * this.goldMult));
    this.addGold(gold);
    this.ui.floatText(e.x, e.visHeight + 0.6, e.z, `+${gold}`, '#ffd451', e.isBoss ? 24 : 14);
    Sound.play(e.isBoss ? 'boss_die' : 'enemy_die', 0.7);
    this.fxN.burst(e.x, e.T.height * 0.5, e.z, e.isBoss ? 40 : 10, { color: e.T.color, speed: 3, life: 0.6, size: 0.3, gravity: 6 });
    if (e.isBoss) {
      fxExplosion(this, e.x, e.z, 4, 0xff5030);
      this.shake(0.6);
      this.ui.toast(`☠️ ${e.T.name} yenildi! +${gold} 💰`);
      this.relicPending++;
      this.flushRelics();
    }
    if (e.poison > 0) {
      const ps = e.poisonSrc;
      const tw = ps && ps.abilities && ps.abilities.contagion ? ps : this.contagionTower;
      if (tw) contagionBurst(this, e, tw);
    }
    const ct = e.curseT > 0 ? e.curseSrc : null;
    if (ct && !ct.removed) grantSouls(this, e, ct);
    if (e.goldMark) { dropCrystals(this, e.x, e.z, e.goldMark.crystals); e.goldMark = null; }
  }

  enemyLeaked(e) {
    if (e.dead) return;
    e.dead = true;
    e.removed = true;
    e.hpBar.visible = false;
    const dmg = e.leakDamage, c = CFG.castle;
    this.castleHp = Math.max(0, Math.round((this.castleHp - dmg) * 100) / 100);
    this.ui.hitFlash();
    this.ui.floatText(c.x, 6, c.z, `-${fmt(dmg)} ❤️${dmg < e.T.dmg ? ' 🍂' : ''}`, '#ff6b5b', 20);
    this.fxA.burst(e.x, 1, e.z, 16, { color: 0xff5040, speed: 3, life: 0.5, size: 0.4, gravity: 2 });
    this.shake(0.3);
    Sound.play('leak');
    if (this.castleHp <= 0 && !this.tryReborn()) this.gameOver();
  }

  // ---------------- Sorgular ----------------
  enemiesInRadius(x, z, r) {
    this.grid.query(x, z, r, this._q);
    const out = [];
    for (const e of this._q) if (!e.dead) out.push(e);
    return out;
  }

  // Menzildeki, kaleye en yakın (yolda en ilerideki) düşman
  firstEnemy(x, z, range) {
    let best = null, br = Infinity;
    for (const e of this.enemiesInRadius(x, z, range)) {
      const r = e.remaining;
      if (r < br) { br = r; best = e; }
    }
    return best;
  }

  nearestEnemy(x, z, range) {
    let best = null, bd = Infinity;
    for (const e of this.enemiesInRadius(x, z, range)) {
      const d = dist2(x, z, e.x, e.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // Menzildeki en kalabalık grubun merkezindeki düşman
  clusterTarget(x, z, range, r) {
    const list = this.enemiesInRadius(x, z, range);
    if (list.length <= 2) return list[0] || null;
    const r2 = r * r;
    let best = null, bc = -1;
    for (const a of list) {
      let c = 0;
      for (const b of list) if (dist2(a.x, a.z, b.x, b.z) <= r2) c++;
      if (c > bc || (c === bc && a.remaining < best.remaining)) { bc = c; best = a; }
    }
    return best;
  }

  addFx(fx) { this.effects.push(fx); return fx; }
  addProjectile(p) { this.projectiles.push(p); return p; }
}

window.addEventListener('load', () => {
  try {
    window.game = new Game();
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML('beforeend',
      `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1a0d0d;color:#fff;font:16px sans-serif;padding:40px;z-index:9999;text-align:center">Oyun başlatılamadı:<br>${err && err.message}</div>`);
  }
});
