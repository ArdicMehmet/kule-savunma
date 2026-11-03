'use strict';

const RARITY_LABEL = { temel: 'TEMEL', orta: 'ORTA', nadir: 'NADİR', tower: 'KULE', common: 'YAYGIN', epic: 'DESTANSI', legendary: 'EFSANEVİ' };
const _proj = new THREE.Vector3();

class UI {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {};
    ['hud', 'gold-val', 'castle-bar', 'castle-val', 'wave-val', 'wave-status', 'btn-call', 'btn-shop', 'btn-speed', 'btn-sound', 'btn-pause',
      'btn-snow', 'relic-bar', 'debug-bar', 'btn-debug-relic',
      'prompt', 'tower-panel', 'shop-panel', 'shop-items', 'shop-close', 'minimap', 'banner', 'banner-title', 'banner-sub', 'floaters',
      'wave-preview', 'wave-preview-head', 'wave-preview-list',
      'toast', 'vignette', 'card-modal', 'card-title', 'card-sub', 'cards', 'btn-reroll', 'reroll-cost', 'start-screen', 'btn-start',
      'best-record', 'pause-screen', 'btn-resume', 'opt-music', 'opt-sfx', 'btn-restart', 'gameover-screen', 'go-stats', 'btn-again',
    ].forEach((id) => { this.el[id.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = $(id); });
    const e = this.el;

    this.floaters = [];
    for (let i = 0; i < 40; i++) {
      const d = document.createElement('div');
      d.className = 'floater';
      d.style.display = 'none';
      e.floaters.appendChild(d);
      this.floaters.push({ el: d, active: false, x: 0, y: 0, z: 0, t: 0, life: 1 });
    }

    e.btnCall.onclick = () => game.callWave();
    e.btnShop.onclick = () => this.toggleShop();
    e.btnSpeed.onclick = () => game.toggleSpeed();
    e.btnSound.onclick = () => game.toggleMute();
    e.btnPause.onclick = () => game.togglePause();
    if (e.btnSnow) e.btnSnow.onclick = () => fireSnowShower(game);
    if (e.btnDebugRelic) e.btnDebugRelic.onclick = () => game.debugGiveRelic();
    if (DEBUG && e.debugBar) e.debugBar.classList.remove('hidden');
    e.shopClose.onclick = () => this.closeShop();
    e.btnStart.onclick = () => game.start();
    e.btnResume.onclick = () => game.togglePause();
    e.btnRestart.onclick = () => game.restart();
    e.btnAgain.onclick = () => game.restart();
    e.btnReroll.onclick = () => this.reroll();
    e.optMusic.onchange = () => Sound.setMusic(e.optMusic.checked);
    e.optSfx.onchange = () => Sound.setSfx(e.optSfx.checked);
    document.addEventListener('click', (ev) => { const b = ev.target.closest && ev.target.closest('button'); if (b) b.blur(); });

    const best = +localStorage.getItem('ks_best_wave') || 0;
    if (best) e.bestRecord.textContent = `🏆 En iyi rekor: Dalga ${best}`;

    this.hudT = 0; this.panelT = 0; this.mapT = 0; this.shopT = 0;
    this.lastGold = -1; this.promptHtml = ''; this.panelBody = ''; this.panelButtons = '';
    this.shopOpen = false; this.cardState = null; this.panelTower = null; this.sellConfirm = null;
    this.prepareMinimap();
  }

  // ---------------- Genel ----------------
  showHUD() { this.el.hud.classList.remove('hidden'); this.el.startScreen.classList.add('hidden'); }
  setPause(on) { this.el.pauseScreen.classList.toggle('hidden', !on); }

  banner(title, sub, color = '#fff') {
    const e = this.el;
    e.bannerTitle.textContent = title;
    e.bannerTitle.style.color = color;
    e.bannerSub.textContent = sub || '';
    e.banner.classList.add('show');
    clearTimeout(this.bannerTO);
    this.bannerTO = setTimeout(() => e.banner.classList.remove('show'), 2600);
  }

  showWavePreview(n, summary) {
    const e = this.el;
    e.wavePreviewHead.textContent = `Dalga ${n} — gelenler`;
    e.wavePreviewList.innerHTML = summary.units.map((u) => {
      const ims = u.immunes.map((im) =>
        `<span class="wp-imm${im.isNew ? ' new' : ''}" style="--imm:${im.color}">${im.icon}${im.isNew ? ' NEW' : ''}</span>`
      ).join('');
      return `<div class="wp-unit${u.isNew ? ' new' : ''}">
        ${u.isNew ? '<div class="wp-new">NEW</div>' : ''}
        <div class="wp-ico">${u.icon}</div>
        <div class="wp-name">${u.name}</div>
        <div class="wp-count">×${u.count}</div>
        ${ims ? `<div class="wp-imms">${ims}</div>` : ''}
      </div>`;
    }).join('');
    e.wavePreview.classList.remove('hidden', 'leave');
    e.wavePreview.classList.add('show');
    clearTimeout(this.wpTO);
  }

  hideWavePreview(delay = 0) {
    const e = this.el;
    clearTimeout(this.wpTO);
    const go = () => {
      e.wavePreview.classList.add('leave');
      e.wavePreview.classList.remove('show');
      setTimeout(() => e.wavePreview.classList.add('hidden'), 400);
    };
    if (delay > 0) this.wpTO = setTimeout(go, delay);
    else go();
  }

  toast(msg, bad = false) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.toggle('bad', bad);
    t.classList.add('show');
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => t.classList.remove('show'), 3000);
  }

  hitFlash() {
    const v = this.el.vignette;
    v.classList.add('hit');
    clearTimeout(this.vigTO);
    this.vigTO = setTimeout(() => v.classList.remove('hit'), 160);
  }

  floatText(x, y, z, text, color = '#ffd451', size = 15) {
    const f = this.floaters.find((q) => !q.active);
    if (!f) return;
    Object.assign(f, { active: true, x, y, z, t: 0, life: 1.1 });
    f.el.textContent = text;
    f.el.style.color = color;
    f.el.style.fontSize = size + 'px';
    f.el.style.display = 'block';
  }

  showPrompt(html) {
    if (html === this.promptHtml) return;
    this.promptHtml = html;
    this.el.prompt.innerHTML = html;
    this.el.prompt.classList.toggle('hidden', !html);
  }

  // ---------------- Her kare ----------------
  update(dt) {
    const g = this.game;
    const cam = g.camera, w = window.innerWidth, h = window.innerHeight;
    for (const f of this.floaters) {
      if (!f.active) continue;
      f.t += dt;
      if (f.t >= f.life) { f.active = false; f.el.style.display = 'none'; continue; }
      _proj.set(f.x, f.y + f.t * 1.6, f.z).project(cam);
      const sx = (_proj.x * 0.5 + 0.5) * w, sy = (-_proj.y * 0.5 + 0.5) * h;
      const k = f.t / f.life;
      f.el.style.opacity = String(1 - k * k);
      f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${1 + 0.35 * Math.max(0, 1 - f.t * 6)})`;
    }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.updateHUD(); }
    this.panelT -= dt;
    if (this.panelT <= 0) { this.panelT = 0.25; this.renderTowerPanel(); }
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.1; this.drawMinimap(); }
    if (this.shopOpen) {
      this.shopT -= dt;
      if (this.shopT <= 0) { this.shopT = 0.25; this.refreshShopButtons(); }
    }
  }

  updateHUD() {
    const g = this.game, e = this.el, W = g.waves;
    const gold = Math.floor(g.gold);
    if (gold !== this.lastGold) {
      e.goldVal.textContent = gold;
      if (gold > this.lastGold && this.lastGold >= 0) {
        e.goldVal.classList.remove('flash'); void e.goldVal.offsetWidth; e.goldVal.classList.add('flash');
      }
      this.lastGold = gold;
    }
    const max = g.castleMax || CFG.castle.maxHp;
    e.castleBar.style.width = (100 * Math.max(0, g.castleHp) / max) + '%';
    e.castleVal.textContent = `${Math.ceil(Math.max(0, g.castleHp))}/${max}`;
    e.waveVal.textContent = `Dalga ${W.wave}`;
    if (W.state === 'break') {
      e.waveStatus.textContent = `Sonraki dalga: ${Math.ceil(W.timer)} sn`;
      e.btnCall.classList.remove('disabled');
      e.btnCall.innerHTML = `⚔️ Dalgayı Çağır <span style="color:#ffd451">+${Math.ceil(W.timer) * CFG.earlyCallGoldPerSec}💰</span> <kbd>Space</kbd>`;
    } else {
      e.waveStatus.textContent = `Kalan düşman: ${W.remaining}`;
      e.btnCall.classList.add('disabled');
      e.btnCall.innerHTML = '⚔️ Dalga sürüyor…';
    }
    e.btnSpeed.innerHTML = `⏩ ${g.speed}x <kbd>F</kbd>`;
    e.btnSound.innerHTML = `${Sound.muted ? '🔇' : '🔊'} <kbd>M</kbd>`;
  }

  // ---------------- Mağaza ----------------
  toggleShop() { this.shopOpen ? this.closeShop() : this.openShop(); }
  openShop() {
    this.shopOpen = true;
    this.el.shopPanel.classList.remove('hidden');
    this.renderShop();
    Sound.play('click');
  }
  closeShop() {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    this.el.shopPanel.classList.add('hidden');
  }
  renderShop() {
    const items = this.game.shopItems();
    const box = this.el.shopItems;
    box.innerHTML = '';
    this.shopButtons = [];
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'shop-item';
      row.innerHTML = `<div class="si-icon">${it.icon}</div><div class="si-body"><div class="si-name">${it.name}</div><div class="si-desc">${it.desc}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.onclick = () => { this.game.buy(it.id); this.renderShop(); };
      row.appendChild(btn);
      box.appendChild(row);
      this.shopButtons.push({ btn, it });
    }
    this.refreshShopButtons();
  }
  refreshShopButtons() {
    if (!this.shopButtons) return;
    for (const { btn, it } of this.shopButtons) {
      if (it.maxed) { btn.textContent = 'MAKS'; btn.disabled = true; continue; }
      btn.textContent = `${it.cost} 💰`;
      btn.disabled = !!it.disabled || this.game.gold < it.cost;
    }
  }

  // ---------------- Kule paneli ----------------
  renderTowerPanel() {
    const g = this.game, t = g.focusTower;
    const panel = this.el.towerPanel;
    if (!t || t.removed) {
      panel.classList.add('hidden');
      this.panelTower = null; this.panelBody = ''; this.panelButtons = '';
      return;
    }
    if (this.panelTower !== t) {
      this.panelTower = t; this.sellConfirm = null;
      panel.innerHTML = '<div class="tp-body"></div><div class="tp-btns"></div>';
      this.panelBody = ''; this.panelButtons = '';
    }
    panel.classList.remove('hidden');
    const near = g.nearTower === t;
    let body = `<div class="tp-head"><div class="tp-icon">${t.icon}</div><div><div class="tp-name">${t.name}</div>` +
      `<div class="tp-level">${t.type ? 'Seviye ' + t.level : 'Kurulum bekliyor'}</div></div></div>`;
    if (!t.type) {
      body += `<div class="tp-desc">Bu temelin yanına git ve <kbd>E</kbd> bas: rastgele gelen <b>3 kuleden</b> birini seçerek kuleni kur.</div>`;
    } else {
      let rows;
      if (t.isSupport) {
        const buffed = g.towers.filter((o) => o.type && !o.isSupport && dist(o.x, o.z, t.x, t.z) <= t.range).length;
        rows = [['Etki alanı', fmt(t.range) + ' m'], ['Güçlenen kule', buffed], ['Hız bonusu', '+' + pct(t.auraHaste)],
          ['Zehir şansı', pct(t.auraPoison)], ['Çağrı hasarı', '+' + pct(t.auraSummon)], ['Toplam hasar', fmt(t.totalDamage)]];
      } else {
        const sp = t.basicReader('special');
        rows = [['Hasar', fmt(t.damage)], ['Hız', fmt(t.currentRate) + '/sn'], ['Menzil', fmt(t.range) + ' m'], [sp[0], sp[1]()]];
        if (t.type === 'death') rows.push(['👻 Ruhlar', fmt(t.souls)], ['Ruh bonusu', '+' + pct(soulBonus(t.souls))]);
        rows.push(['Toplam hasar', fmt(t.totalDamage)], ['Öldürme', t.kills]);
      }
      if (t.isFrozen) body += `<div class="tp-buff" style="color:#9fe8ff">❄️ ${t.waveFrozen ? 'Bu dalga boyunca dondu' : 'Sersemledi'}</div>`;
      body += `<div class="tp-desc">${t.def.desc}</div><div class="tp-stats">` +
        rows.map(([a, b]) => `<div class="tp-stat"><span>${a}</span><span>${b}</span></div>`).join('') + '</div>';
      if (t.buffFrom) {
        const parts = ['+' + pct(t.buffHaste) + ' saldırı hızı'];
        if (t.buffPoison > 0) parts.push(pct(t.buffPoison) + ' zehir şansı');
        if (t.buffSummon > 1 && t.type === 'death') parts.push('+' + pct(t.buffSummon - 1) + ' zombi hasarı');
        body += `<div class="tp-buff">🌳 Yaşam bufu: ${parts.join(', ')}</div>`;
      }
      const chips = t.basics.filter((k) => t.cards[k] > 0)
        .map((k) => { const i = t.basicCardInfo(k); return `<span class="tp-chip">${i.icon} ${i.name} x${t.cards[k]}</span>`; }).join('');
      body += `<div class="tp-section">Temel kartlar</div><div class="tp-cards">${chips || '<span class="tp-none">Henüz yok</span>'}</div>`;
      const abs = Object.values(t.abilities).map((ab) => {
        const d = ABILITY_DEFS[ab.id];
        return `<div class="tp-abil ${d.rarity}"><span class="ai">${d.icon}</span><span class="an">${d.name}</span><span class="al">Sv.${ab.level}${ab.level >= CFG.abilityMaxLevel ? ' MAKS' : ''}</span></div>`;
      }).join('');
      body += `<div class="tp-section">Yetenekler</div>${abs || '<div class="tp-none">Yükselterek yetenek kartları kazan!</div>'}`;
    }
    const cost = t.upgradeCost();
    const canAfford = g.gold >= cost;
    const sellTxt = this.sellConfirm === t ? `Emin misin? +${t.sellValue()}💰` : `Sat (+${t.sellValue()}💰)`;
    let buttons = `<div class="tp-buttons"><button class="btn flex" data-act="up" ${near && canAfford ? '' : 'disabled'}>` +
      `${t.type ? '⬆️ Yükselt' : '🏗️ Kule Seç'} — ${cost}💰</button>` +
      `<button class="btn red" data-act="sell">${sellTxt}</button></div>`;
    if (!near) buttons += `<div class="tp-note">Etkileşim için kahramanınla kuleye yaklaş.</div>`;
    else if (!canAfford) buttons += `<div class="tp-note">Yetersiz altın.</div>`;
    const bodyEl = panel.querySelector('.tp-body'), btnEl = panel.querySelector('.tp-btns');
    if (body !== this.panelBody) { bodyEl.innerHTML = body; this.panelBody = body; }
    if (buttons !== this.panelButtons) {
      btnEl.innerHTML = buttons; this.panelButtons = buttons;
      btnEl.querySelector('[data-act="up"]').onclick = () => g.interactWith(t);
      btnEl.querySelector('[data-act="sell"]').onclick = () => {
        if (this.sellConfirm === t) { this.sellConfirm = null; g.sellTower(t); }
        else { this.sellConfirm = t; }
        this.panelT = 0;
      };
    }
  }

  // ---------------- Kart seçimi ----------------
  openCards({ title, sub, cards, onPick, reroll }) {
    const e = this.el;
    this.closeShop();
    this.cardState = { cards, onPick, reroll, picking: false };
    e.cardTitle.textContent = title;
    e.cardSub.textContent = sub;
    e.cardModal.classList.remove('hidden');
    e.btnReroll.classList.toggle('hidden', !reroll);
    this.updateRerollButton();
    this.renderCards(cards);
  }
  updateRerollButton() {
    const s = this.cardState;
    if (!s || !s.reroll) return;
    const c = s.reroll.cost();
    this.el.rerollCost.textContent = `(${c} 💰)`;
    this.el.btnReroll.disabled = this.game.gold < c;
  }
  renderCards(cards) {
    const box = this.el.cards;
    box.innerHTML = '';
    clearTimeout(this.flipTO);
    cards.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = `card r-${c.rarity}`;
      const stats = (c.preview || []).map(([l, b, a]) => `<div><span>${l}</span><span>${b ? b + ' → ' : ''}${a}</span></div>`).join('');
      d.innerHTML = `<div class="back">🎴</div><div class="face"><div class="rar">${RARITY_LABEL[c.rarity]}</div>` +
        `<div class="cicon">${c.icon}</div><div class="cname">${c.name}</div>` +
        `<div class="clevel ${c.isNew ? 'new' : ''}">${c.levelText}</div><div class="cdesc">${c.desc}</div>` +
        `<div class="cstats">${stats}</div></div><div class="ckey"><kbd>${i + 1}</kbd></div>`;
      d.onclick = () => this.pickCard(i);
      box.appendChild(d);
      setTimeout(() => {
        d.classList.add('revealed');
        Sound.play('card_flip');
        if (c.rarity === 'nadir' || c.rarity === 'legendary') Sound.play('card_nadir');
        else if (c.rarity === 'orta' || c.rarity === 'epic') Sound.play('card_orta');
      }, 200 + i * 260);
    });
  }
  pickCard(i) {
    const s = this.cardState;
    if (!s || s.picking || !s.cards[i]) return;
    s.picking = true;
    const card = s.cards[i];
    const el = this.el.cards.children[i];
    if (el) el.style.transform = 'translateY(-24px) scale(1.08)';
    setTimeout(() => {
      this.el.cardModal.classList.add('hidden');
      this.cardState = null;
      s.onPick(card);
    }, 160);
  }
  reroll() {
    const s = this.cardState;
    if (!s || !s.reroll || s.picking) return;
    const cards = s.reroll.fn();
    if (!cards) return;
    s.cards = cards;
    Sound.play('whoosh', 0.6);
    this.renderCards(cards);
    this.updateRerollButton();
  }

  // ---------------- Bitiş ----------------
  renderRelicBar() {
    const el = this.el.relicBar;
    if (!el) return;
    const ids = [...this.game.ownedRelics];
    if (!ids.length) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    el.classList.remove('hidden');
    el.innerHTML = ids.map((id) => {
      const d = RELIC_DEFS[id];
      const used = id === 'reborn' && this.game.rebornUsed;
      return `<div class="relic-chip r-${d.rarity}${used ? ' used' : ''}" title="${d.name}: ${d.desc}">${d.icon}</div>`;
    }).join('');
  }
  setSnowVisible(on) {
    if (!this.el.btnSnow) return;
    this.el.btnSnow.classList.toggle('hidden', !on);
    this.updateSnowButton();
  }
  updateSnowButton() {
    const b = this.el.btnSnow;
    if (!b || !this.game.relics.snow) return;
    const cd = this.game.snowCd;
    b.disabled = cd > 0;
    b.classList.toggle('disabled', cd > 0);
    b.innerHTML = cd > 0 ? `🌨️ Çığ (${cd} dalga)` : '🌨️ Çığ <kbd>C</kbd>';
  }

  showGameOver(stats) {
    const e = this.el;
    e.goStats.innerHTML = `Ulaştığın dalga: <b>${stats.wave}</b><br>Öldürülen düşman: <b>${stats.kills}</b><br>` +
      `Kurulan kule: <b>${stats.towers}</b><br>Kazanılan altın: <b>${stats.goldEarned}</b><br>` +
      (stats.record ? '<span style="color:#7ee787">🏆 Yeni rekor!</span>' : `En iyi rekor: Dalga ${stats.best}`);
    e.gameoverScreen.classList.remove('hidden');
  }

  // ---------------- Mini harita ----------------
  prepareMinimap() {
    const c = this.el.minimap;
    this.mm = { w: c.width, h: c.height, minX: -50, maxX: 50, minZ: -50, maxZ: 36 };
    const m = this.mm;
    m.s = Math.min(m.w / (m.maxX - m.minX), m.h / (m.maxZ - m.minZ));
    m.ox = (m.w - (m.maxX - m.minX) * m.s) / 2;
    m.oy = (m.h - (m.maxZ - m.minZ) * m.s) / 2;
    const bg = document.createElement('canvas');
    bg.width = m.w; bg.height = m.h;
    const g = bg.getContext('2d');
    g.fillStyle = '#2f5a24'; g.fillRect(0, 0, m.w, m.h);
    const b = CFG.bounds;
    g.fillStyle = '#4a7d32';
    g.fillRect(this.mx(b.minX), this.my(b.minZ), (b.maxX - b.minX) * m.s, (b.maxZ - b.minZ) * m.s);
    g.strokeStyle = '#a88a5e'; g.lineWidth = CFG.roadHalfWidth * 2 * m.s; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of this.game.world.paths) {
      g.beginPath();
      for (let i = 0; i <= p.n; i += 3) {
        const x = this.mx(p.xs[i]), y = this.my(p.zs[i]);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineTo(this.mx(p.xs[p.n]), this.my(p.zs[p.n]));
      g.stroke();
    }
    const cs = CFG.castle;
    g.fillStyle = '#5b8cff'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.fillRect(this.mx(cs.x) - 7, this.my(cs.z) - 7, 14, 14);
    g.strokeRect(this.mx(cs.x) - 7, this.my(cs.z) - 7, 14, 14);
    this.mmBg = bg;
  }
  mx(x) { return this.mm.ox + (x - this.mm.minX) * this.mm.s; }
  my(z) { return this.mm.oy + (z - this.mm.minZ) * this.mm.s; }

  drawMinimap() {
    const g = this.el.minimap.getContext('2d'), game = this.game;
    g.drawImage(this.mmBg, 0, 0);
    for (const p of game.world.portals) {
      g.fillStyle = p.active ? '#b070ff' : '#4a3a5a';
      g.beginPath(); g.arc(this.mx(p.x), this.my(p.z), 5, 0, Math.PI * 2); g.fill();
    }
    for (const t of game.towers) {
      g.fillStyle = t.type ? TOWER_TYPES[t.type].color : '#9aa4ae';
      g.fillRect(this.mx(t.x) - 3.5, this.my(t.z) - 3.5, 7, 7);
    }
    for (const e of game.enemies) {
      if (e.dead) continue;
      g.fillStyle = e.immune && TOWER_TYPES[e.immune] ? TOWER_TYPES[e.immune].color : (e.isBoss ? '#ffa21a' : '#ff4a3a');
      const r = e.isBoss ? 4 : 2.4;
      g.fillRect(this.mx(e.x) - r / 2, this.my(e.z) - r / 2, r, r);
    }
    if (game.king && game.king.alive) {
      g.fillStyle = '#ffd451'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(this.mx(game.king.x), this.my(game.king.z), 5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    const h = game.hero;
    g.fillStyle = '#ffffff'; g.strokeStyle = '#1f6feb'; g.lineWidth = 2;
    g.beginPath(); g.arc(this.mx(h.x), this.my(h.z), 4, 0, Math.PI * 2); g.fill(); g.stroke();
  }
}
