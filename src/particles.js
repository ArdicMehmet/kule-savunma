'use strict';

// Tek bir THREE.Points ile çizilen, havuzlanmış CPU parçacık sistemi.
class ParticleSystem {
  constructor(scene, max, additive) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.a1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    this.uniforms = { uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        attribute vec4 aColor;
        attribute float aSize;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec4 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float a = smoothstep(1.0, 0.0, r);
          a *= a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor.rgb, vColor.a * a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 12 : 11;
    scene.add(this.points);
  }

  setScale(viewportHeight, fov) {
    this.uniforms.uScale.value = viewportHeight / (2 * Math.tan((fov * Math.PI) / 360));
  }

  // o: {x,y,z, vx,vy,vz, life, size, size2, color(hex), alpha, alpha2, gravity, drag}
  emit(o) {
    if (this.n >= this.max) return;
    const i = this.n++;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = o.x; this.pos[i3 + 1] = o.y; this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx || 0; this.vel[i3 + 1] = o.vy || 0; this.vel[i3 + 2] = o.vz || 0;
    const c = o.rgb || hexToRgb(o.color ?? 0xffffff);
    this.col[i4] = c[0]; this.col[i4 + 1] = c[1]; this.col[i4 + 2] = c[2];
    this.a0[i] = o.alpha ?? 1;
    this.a1[i] = o.alpha2 ?? 0;
    this.col[i4 + 3] = this.a0[i];
    this.s0[i] = o.size ?? 0.5;
    this.s1[i] = o.size2 ?? this.s0[i];
    this.size[i] = this.s0[i];
    this.life[i] = this.maxLife[i] = o.life ?? 1;
    this.grav[i] = o.gravity || 0;
    this.drag[i] = o.drag || 0;
  }

  // Rastgele yönlere saçılan patlama
  burst(x, y, z, count, o) {
    const rgb = hexToRgb(o.color ?? 0xffffff);
    const sp = o.speed ?? 4, up = o.up ?? 0.5;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = sp * rand(0.3, 1);
      const r = o.spread ?? 0;
      this.emit({
        x: x + (r ? rand(-r, r) : 0), y: y + rand(0, o.yJitter || 0), z: z + (r ? rand(-r, r) : 0),
        vx: Math.cos(a) * s, vy: rand(up * 0.3, up) * sp, vz: Math.sin(a) * s,
        life: (o.life ?? 0.6) * rand(0.6, 1.2), size: (o.size ?? 0.4) * rand(0.7, 1.3), size2: o.size2 ?? 0,
        rgb, alpha: o.alpha ?? 1, alpha2: 0, gravity: o.gravity ?? 6, drag: o.drag ?? 1.5,
      });
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 2] *= dr;
      this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.02 && this.grav[i] > 0) { this.pos[i3 + 1] = 0.02; this.vel[i3 + 1] *= -0.3; }
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.col[i * 4 + 3] = this.a0[i] + (this.a1[i] - this.a0[i]) * t;
      i++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }

  kill(i) {
    const last = --this.n;
    if (i === last) return;
    const i3 = i * 3, l3 = last * 3, i4 = i * 4, l4 = last * 4;
    for (let k = 0; k < 3; k++) { this.pos[i3 + k] = this.pos[l3 + k]; this.vel[i3 + k] = this.vel[l3 + k]; }
    for (let k = 0; k < 4; k++) this.col[i4 + k] = this.col[l4 + k];
    this.size[i] = this.size[last]; this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
    this.s0[i] = this.s0[last]; this.s1[i] = this.s1[last]; this.a0[i] = this.a0[last]; this.a1[i] = this.a1[last];
    this.grav[i] = this.grav[last]; this.drag[i] = this.drag[last];
  }

  clear() { this.n = 0; }
}
