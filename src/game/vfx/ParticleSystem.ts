import * as THREE from 'three';

interface Particle {
  mesh: THREE.Sprite;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  gravity: number;
  startOpacity: number;
  active: boolean;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  maxRadius: number;
  active: boolean;
}

interface TracerBolt {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  active: boolean;
}

interface PersistentFire {
  parent: THREE.Object3D;
  localOffset: THREE.Vector3;
  intensity: number;
  timer: number;
}

function createSoftCircleTexture(innerColor: string, outerColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.45, outerColor);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private rings: ShockwaveRing[] = [];
  private tracers: TracerBolt[] = [];
  private fires: PersistentFire[] = [];
  private cursor = 0;

  private smokeTex: THREE.CanvasTexture;
  private fireTex: THREE.CanvasTexture;
  private waterTex: THREE.CanvasTexture;
  private sparkTex: THREE.CanvasTexture;

  constructor(scene: THREE.Scene, maxParticles = 550) {
    this.scene = scene;
    this.smokeTex = createSoftCircleTexture('rgba(220,225,232,0.85)', 'rgba(120,130,145,0.35)');
    this.fireTex = createSoftCircleTexture('rgba(255,250,200,1)', 'rgba(255,105,20,0.6)');
    this.waterTex = createSoftCircleTexture('rgba(240,250,255,0.9)', 'rgba(180,228,255,0.45)');
    this.sparkTex = createSoftCircleTexture('rgba(255,255,255,1)', 'rgba(255,180,60,0.7)');

    for (let i = 0; i < maxParticles; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.smokeTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.particles.push({
        mesh: sprite,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 1,
        startScale: 1,
        endScale: 3,
        gravity: 0,
        startOpacity: 1,
        active: false,
      });
    }

    // Shockwave ring pool
    const ringGeo = new THREE.RingGeometry(0.82, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd7a3,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, age: 0, maxAge: 1, maxRadius: 40, active: false });
    }

    // CIWS glowing tracer bolts pool
    const tracerGeo = new THREE.CylinderGeometry(0.14, 0.14, 4.8, 5);
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xff6238 });
    for (let i = 0; i < 80; i++) {
      const mesh = new THREE.Mesh(tracerGeo, tracerMat);
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({
        mesh,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.45,
        active: false,
      });
    }
  }

  private spawn(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    type: 'smoke' | 'dark_smoke' | 'fire' | 'water' | 'spark' | 'plasma',
    startScale: number,
    endScale: number,
    maxAge: number,
    gravity = 0,
    opacity = 0.85
  ) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % this.particles.length;

    const mat = p.mesh.material as THREE.SpriteMaterial;
    if (type === 'fire') {
      mat.map = this.fireTex;
      mat.color.setHex(0xffb347);
      mat.blending = THREE.AdditiveBlending;
    } else if (type === 'plasma') {
      mat.map = this.sparkTex;
      mat.color.setHex(0x38bdf8);
      mat.blending = THREE.AdditiveBlending;
    } else if (type === 'spark') {
      mat.map = this.sparkTex;
      mat.color.setHex(0xffe082);
      mat.blending = THREE.AdditiveBlending;
    } else if (type === 'water') {
      mat.map = this.waterTex;
      mat.color.setHex(0xe0f2fe);
      mat.blending = THREE.NormalBlending;
    } else if (type === 'dark_smoke') {
      mat.map = this.smokeTex;
      mat.color.setHex(0x1f242c);
      mat.blending = THREE.NormalBlending;
    } else {
      mat.map = this.smokeTex;
      mat.color.setHex(0xdbe2ea);
      mat.blending = THREE.NormalBlending;
    }

    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(startScale);
    p.mesh.visible = true;
    mat.opacity = opacity;

    p.vel.copy(vel);
    p.age = 0;
    p.maxAge = maxAge;
    p.startScale = startScale;
    p.endScale = endScale;
    p.gravity = gravity;
    p.startOpacity = opacity;
    p.active = true;
  }

  public emitTrail(pos: THREE.Vector3, kind: 'rocket' | 'hypersonic' | 'interceptor' | 'torpedo' | 'drone') {
    const jitter = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8
    );
    if (kind === 'torpedo') {
      // Surface foam + underwater supercavitation bubbles
      const surfacePos = new THREE.Vector3(pos.x, 0.45, pos.z);
      this.spawn(surfacePos, new THREE.Vector3(jitter.x * 2, 1.5, jitter.z * 2), 'water', 2.4, 7.5, 1.4, -0.5, 0.72);
    } else if (kind === 'hypersonic') {
      this.spawn(pos, jitter, 'plasma', 2.6, 8.5, 0.55, 0, 0.82);
      this.spawn(pos, jitter.multiplyScalar(0.5), 'smoke', 2.0, 9.5, 1.25, 0.8, 0.42);
    } else if (kind === 'interceptor') {
      this.spawn(pos, jitter, 'smoke', 1.4, 6.2, 1.1, 0.5, 0.65);
    } else if (kind === 'drone') {
      this.spawn(pos, jitter.multiplyScalar(0.3), 'smoke', 0.9, 2.8, 0.65, 0.2, 0.28);
    } else {
      this.spawn(pos, jitter, 'smoke', 2.2, 10.5, 1.5, 0.6, 0.58);
      if (Math.random() < 0.45) {
        this.spawn(pos, jitter, 'fire', 1.8, 0.6, 0.22, 0, 0.9);
      }
    }
  }

  public emitCiwsTracer(origin: THREE.Vector3, targetPos: THREE.Vector3) {
    const bolt = this.tracers.find((t) => !t.active);
    if (!bolt) return;
    const dir = targetPos.clone().sub(origin);
    const dist = dir.length();
    dir.normalize();
    // Realistic dispersion spread
    dir.x += (Math.random() - 0.5) * 0.045;
    dir.y += (Math.random() - 0.5) * 0.045;
    dir.z += (Math.random() - 0.5) * 0.045;
    dir.normalize();

    bolt.mesh.position.copy(origin);
    bolt.mesh.lookAt(origin.clone().add(dir));
    bolt.mesh.visible = true;
    bolt.vel.copy(dir).multiplyScalar(380);
    bolt.age = 0;
    bolt.maxAge = Math.min(0.65, dist / 370);
    bolt.active = true;

    // Muzzle flash
    this.spawn(origin, new THREE.Vector3(), 'fire', 2.5, 0.5, 0.08, 0, 0.95);
  }

  public emitExplosion(pos: THREE.Vector3, scale: number, isWaterImpact = false) {
    // Shockwave ring
    const ring = this.rings.find((r) => !r.active);
    if (ring) {
      ring.mesh.position.set(pos.x, Math.max(pos.y, 1.2), pos.z);
      ring.mesh.scale.setScalar(1);
      ring.mesh.visible = true;
      ring.age = 0;
      ring.maxAge = 0.7 + scale * 0.22;
      ring.maxRadius = 18 * scale;
      ring.active = true;
    }

    // Core fireballs
    const fireCount = Math.floor(14 * scale);
    for (let i = 0; i < fireCount; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 28 * scale,
        Math.random() * 24 * scale + 4,
        (Math.random() - 0.5) * 28 * scale
      );
      this.spawn(pos, v, 'fire', 5 * scale, 18 * scale, 0.55 + Math.random() * 0.55, -6, 0.95);
    }

    // Rising dark smoke plume
    const smokeCount = Math.floor(16 * scale);
    for (let i = 0; i < smokeCount; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 16 * scale,
        8 + Math.random() * 22 * scale,
        (Math.random() - 0.5) * 16 * scale
      );
      this.spawn(pos, v, 'dark_smoke', 6 * scale, 26 * scale, 1.8 + Math.random() * 1.4, 2.2, 0.78);
    }

    // Hot flying sparks / shrapnel
    const sparkCount = Math.floor(12 * scale);
    for (let i = 0; i < sparkCount; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 65 * scale,
        14 + Math.random() * 48 * scale,
        (Math.random() - 0.5) * 65 * scale
      );
      this.spawn(pos, v, 'spark', 1.8 * scale, 0.4, 0.8 + Math.random() * 0.6, -34, 1.0);
    }

    // Tall ocean water geyser if near waterline or torpedo hit
    if (isWaterImpact || pos.y < 8) {
      const geyserCount = Math.floor(14 * scale);
      for (let i = 0; i < geyserCount; i++) {
        const v = new THREE.Vector3(
          (Math.random() - 0.5) * 12 * scale,
          22 + Math.random() * 42 * scale,
          (Math.random() - 0.5) * 12 * scale
        );
        this.spawn(
          new THREE.Vector3(pos.x, 1.0, pos.z),
          v,
          'water',
          4.5 * scale,
          16 * scale,
          1.3 + Math.random() * 0.8,
          -28,
          0.85
        );
      }
    }
  }

  public emitInterceptPop(pos: THREE.Vector3) {
    for (let i = 0; i < 10; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28
      );
      this.spawn(pos, v, 'fire', 3.5, 9.5, 0.35 + Math.random() * 0.25, -4, 0.95);
    }
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        2 + Math.random() * 8,
        (Math.random() - 0.5) * 12
      );
      this.spawn(pos, v, 'dark_smoke', 4, 14, 1.5, 1.0, 0.65);
    }
  }

  public addPersistentFire(parent: THREE.Object3D, localOffset: THREE.Vector3, intensity = 1.0) {
    if (this.fires.length > 26) return;
    this.fires.push({ parent, localOffset: localOffset.clone(), intensity, timer: 0 });
  }

  public clearPersistentFires() {
    this.fires = [];
  }

  public clearAll() {
    this.fires = [];
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
    }
    for (const t of this.tracers) {
      t.active = false;
      t.mesh.visible = false;
    }
  }

  public update(dt: number) {
    // Update particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const t = p.age / p.maxAge;
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const scale = THREE.MathUtils.lerp(p.startScale, p.endScale, t);
      p.mesh.scale.setScalar(scale);
      (p.mesh.material as THREE.SpriteMaterial).opacity = p.startOpacity * (1 - t);
    }

    // Update shockwave rings
    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.age / r.maxAge;
      const rad = THREE.MathUtils.lerp(2, r.maxRadius, 1 - Math.pow(1 - t, 3));
      r.mesh.scale.setScalar(rad);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.72;
    }

    // Update CIWS tracer bolts
    for (const tr of this.tracers) {
      if (!tr.active) continue;
      tr.age += dt;
      if (tr.age >= tr.maxAge) {
        tr.active = false;
        tr.mesh.visible = false;
        continue;
      }
      tr.mesh.position.addScaledVector(tr.vel, dt);
    }

    // Emit persistent ship fires & smoke
    const worldPos = new THREE.Vector3();
    for (const f of this.fires) {
      f.timer += dt;
      if (f.timer >= 0.14) {
        f.timer = 0;
        worldPos.copy(f.localOffset);
        f.parent.localToWorld(worldPos);
        if (worldPos.y < -1) continue; // Extinguished once submerged!
        this.spawn(
          worldPos,
          new THREE.Vector3((Math.random() - 0.5) * 3, 6 + Math.random() * 5, (Math.random() - 0.5) * 3),
          'fire',
          3.2 * f.intensity,
          1.2 * f.intensity,
          0.45,
          2,
          0.85
        );
        this.spawn(
          worldPos.clone().add(new THREE.Vector3(0, 3, 0)),
          new THREE.Vector3(2.5 + (Math.random() - 0.5) * 4, 11 + Math.random() * 6, (Math.random() - 0.5) * 4),
          'dark_smoke',
          4.5 * f.intensity,
          19 * f.intensity,
          2.2,
          1.5,
          0.55
        );
      }
    }
  }
}
