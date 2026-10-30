'use strict';

// ---------- Matematik ----------
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function weightedPick(items, weightFn) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// Noktanın (px,pz) AB doğru parçasına uzaklığının karesi
function segDist2(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const l2 = abx * abx + abz * abz;
  let t = l2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / l2 : 0;
  t = clamp(t, 0, 1);
  return dist2(px, pz, ax + abx * t, az + abz * t);
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'B';
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, '');
  return n.toFixed(2).replace(/\.?0+$/, '') || '0';
}

// ---------- Basit değer gürültüsü ----------
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function fbm(x, y) {
  return noise2(x, y) * 0.6 + noise2(x * 2.1, y * 2.1) * 0.3 + noise2(x * 4.3, y * 4.3) * 0.1;
}

// Renkleri doğrudan (sRGB) 0..1 olarak çözer – özel shader'lar için
function hexToRgb(hex) {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

// ---------- Prosedürel dokular ----------
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX = {};
function buildTextures() {
  TEX.glow = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.soft = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.ring = canvasTex(256, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.10)');
    gr.addColorStop(0.72, 'rgba(255,255,255,0.22)');
    gr.addColorStop(0.88, 'rgba(255,255,255,1)');
    gr.addColorStop(0.95, 'rgba(255,255,255,0.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.swirl = canvasTex(256, (g, s) => {
    g.translate(s / 2, s / 2);
    for (let arm = 0; arm < 4; arm++) {
      g.rotate(Math.PI / 2);
      for (let i = 0; i < 70; i++) {
        const t = i / 70, ang = t * 5.5, r = t * s * 0.48;
        g.fillStyle = `rgba(255,255,255,${(1 - t) * 0.55})`;
        g.beginPath();
        g.arc(Math.cos(ang) * r, Math.sin(ang) * r, 10 * (1 - t) + 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-s / 2, -s / 2, s, s);
  });
  TEX.cloud = canvasTex(128, (g, s) => {
    for (let i = 0; i < 14; i++) {
      const x = s / 2 + rand(-s * 0.2, s * 0.2), y = s / 2 + rand(-s * 0.2, s * 0.2), r = rand(s * 0.15, s * 0.3);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }
  });
  TEX.ice = canvasTex(256, (g, s) => {
    g.fillStyle = 'rgba(190,235,255,0.55)'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++) {
      g.lineWidth = rand(0.5, 2.2);
      g.beginPath();
      let x = rand(0, s), y = rand(0, s);
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rand(-40, 40); y += rand(-40, 40); g.lineTo(x, y); }
      g.stroke();
    }
    const gr = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  TEX.wind = canvasTex(256, (g, s) => {
    for (let i = 0; i < 26; i++) {
      const y = rand(10, s - 10), x = rand(0, s * 0.4), w = rand(s * 0.3, s * 0.6);
      const gr = g.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, `rgba(255,255,255,${rand(0.3, 0.8)})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x, y, w, rand(2, 5));
    }
    const fade = g.createLinearGradient(0, 0, 0, s);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.25, 'rgba(0,0,0,0)');
    fade.addColorStop(0.75, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = fade; g.fillRect(0, 0, s, s);
  });
  TEX.wind.wrapS = THREE.RepeatWrapping;
  TEX.flame = canvasTex(128, (g, s) => {
    const gr = g.createLinearGradient(0, s, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    const side = g.createLinearGradient(0, 0, s, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.2, 'rgba(0,0,0,0)');
    side.addColorStop(0.8, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side; g.fillRect(0, 0, s, s);
  });
}

function makeTextSprite(text, opts = {}) {
  const w = opts.w || 128, h = opts.h || 64;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const sp = new THREE.Sprite(mat);
  sp.userData.canvas = c;
  sp.userData.draw = (t) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.font = `900 ${opts.font || 34}px Segoe UI, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,0.85)';
    g.strokeText(t, w / 2, h / 2);
    g.fillStyle = opts.color || '#ffd451';
    g.fillText(t, w / 2, h / 2);
    tex.needsUpdate = true;
  };
  sp.userData.draw(text);
  sp.scale.set(opts.sx || 1.6, opts.sy || 0.8, 1);
  return sp;
}

// ---------- Geometri birleştirme (vertex color'lu low-poly modeller) ----------
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _col = new THREE.Color();

function mergeParts(parts) {
  const list = [];
  let total = 0;
  for (const part of parts) {
    let g = part.g.index ? part.g.toNonIndexed() : part.g.clone();
    part.g.dispose();
    const p = part.p || [0, 0, 0], r = part.r || [0, 0, 0];
    const s = part.s === undefined || part.s === null ? [1, 1, 1] : (typeof part.s === 'number' ? [part.s, part.s, part.s] : part.s);
    _e.set(r[0], r[1], r[2]);
    _q.setFromEuler(_e);
    _m4.compose(_v.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
    g.applyMatrix4(_m4);
    if (!g.attributes.normal) g.computeVertexNormals();
    list.push({ g, c: _col.setHex(part.c).clone() });
    total += g.attributes.position.count;
  }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const { g, c } of list) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) {
      col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b;
    }
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// ---------- Uzamsal ızgara (düşman sorguları) ----------
class SpatialGrid {
  constructor(cell = 4) {
    this.cell = cell;
    this.cells = new Map();
    this.pool = [];
  }
  clear() {
    for (const arr of this.cells.values()) { arr.length = 0; this.pool.push(arr); }
    this.cells.clear();
  }
  key(cx, cz) { return (cx + 512) * 1024 + (cz + 512); }
  insert(e) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.z / this.cell));
    let arr = this.cells.get(k);
    if (!arr) { arr = this.pool.pop() || []; this.cells.set(k, arr); }
    arr.push(e);
  }
  query(x, z, r, out) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const arr = this.cells.get(this.key(cx, cz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const e = arr[i];
          const rr = r + e.radius * 0.6;
          if (dist2(x, z, e.x, e.z) <= rr * rr) out.push(e);
        }
      }
    }
    return out;
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------- Temizlik ----------
function disposeObject(obj, disposeGeometry = false) {
  obj.traverse((o) => {
    if (o.material && o.userData.ownMat) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
    if (disposeGeometry && o.geometry && o.userData.ownGeo) o.geometry.dispose();
  });
}
