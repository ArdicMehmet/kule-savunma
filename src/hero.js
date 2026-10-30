'use strict';

const _gemPos = new THREE.Vector3();

class Hero {
  constructor(game) {
    this.game = game;
    this.mesh = Models.hero();
    game.scene.add(this.mesh);
    this.x = 0; this.z = 13; this.vx = 0; this.vz = 0;
    this.facing = Math.PI;
    this.attackT = 0; this.attackAnim = 0; this.walkPhase = 0; this.dustT = 0; this.time = 0;
    this.dmgMult = 1; this.rateMult = 1;
    this.totalDamage = 0; this.kills = 0;
    this.target = null;
    this.mesh.position.set(this.x, 0, this.z);
  }

  update(dt, input) {
    this.time += dt;
    const H = CFG.hero;
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let mz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, mz);
    const speed = H.speed * (input.sprint ? H.sprintMult : 1);
    const tvx = len ? (mx / len) * speed : 0, tvz = len ? (mz / len) * speed : 0;
    const k = Math.min(1, dt * 12);
    this.vx += (tvx - this.vx) * k;
    this.vz += (tvz - this.vz) * k;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.collide();
    const b = CFG.bounds;
    this.x = clamp(this.x, b.minX, b.maxX);
    this.z = clamp(this.z, b.minZ, b.maxZ);

    const spd = Math.hypot(this.vx, this.vz);
    const moving = spd > 0.6;
    let face = this.facing;
    if (moving) face = Math.atan2(this.vx, this.vz);
    else if (this.target && !this.target.dead && this.attackAnim > 0) face = Math.atan2(this.target.x - this.x, this.target.z - this.z);
    this.facing = lerpAngle(this.facing, face, Math.min(1, dt * 14));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.facing;

    // Animasyon
    const u = this.mesh.userData;
    const amp = Math.min(1, spd / 8);
    this.walkPhase += dt * spd * 1.6;
    const sw = Math.sin(this.walkPhase) * 0.75 * amp;
    u.legL.rotation.x = sw;
    u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw * 0.7;
    u.armR.rotation.x = this.attackAnim > 0 ? -1.4 * (this.attackAnim / 0.25) : sw * 0.35;
    u.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.09 * amp + Math.sin(this.time * 2.5) * 0.015;
    u.ring.material.opacity = 0.4 + Math.sin(this.time * 3) * 0.12;
    u.gemGlow.scale.setScalar(0.9 + Math.sin(this.time * 6) * 0.12 + (this.attackAnim > 0 ? 0.6 : 0));

    if (moving) {
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = input.sprint ? 0.12 : 0.22;
        this.game.fxN.emit({ x: this.x + rand(-0.2, 0.2), y: 0.1, z: this.z + rand(-0.2, 0.2), vx: -this.vx * 0.1, vy: 0.6, vz: -this.vz * 0.1, life: 0.6, size: 0.35, size2: 0.8, color: 0x9a8a6a, alpha: 0.4, drag: 2 });
      }
    }

    // Otomatik saldırı
    if (this.attackAnim > 0) this.attackAnim -= dt;
    this.attackT -= dt;
    if (this.attackT <= 0) {
      const t = this.game.nearestEnemy(this.x, this.z, H.range);
      if (t) { this.shoot(t); this.attackT = 1 / (H.rate * this.rateMult); }
      else this.attackT = 0;
    }
  }

  shoot(t) {
    const g = this.game;
    this.target = t;
    this.attackAnim = 0.25;
    this.mesh.userData.gem.getWorldPosition(_gemPos);
    g.addProjectile(new Projectile(g, {
      kind: 'hero', x: _gemPos.x, y: _gemPos.y, z: _gemPos.z, target: t, speed: CFG.hero.projSpeed,
      onHit: (x, y, z, e) => {
        if (e) e.takeDamage(CFG.hero.dmg * this.dmgMult, { src: this });
        g.fxA.burst(x, y, z, 6, { color: 0x9ff4ff, speed: 2.5, life: 0.3, size: 0.25, gravity: 2 });
      },
    }));
    Sound.play('hero_shot');
  }

  collide() {
    const r = CFG.hero.radius;
    const push = (cx, cz, cr) => {
      const dx = this.x - cx, dz = this.z - cz;
      const d = Math.hypot(dx, dz), min = cr + r;
      if (d < min && d > 1e-4) { this.x = cx + (dx / d) * min; this.z = cz + (dz / d) * min; }
    };
    const c = CFG.castle;
    push(c.x, c.z, c.radius);
    for (const t of this.game.towers) push(t.x, t.z, t.radius);
    for (const d of this.game.world.decor) if (d.solid && d.inside) push(d.x, d.z, d.r);
  }
}
