import * as THREE from 'three';

const TRACERS = 24;
const SPARKS = 60;

/** Efeitos com pools reutilizáveis (sem alocar objetos a cada tiro). */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.sparks = [];

    for (let i = 0; i < TRACERS; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 1 });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0, max: 0.07 });
    }

    this.sparkGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let i = 0; i < SPARKS; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.visible = false;
      scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }

    this.flash = new THREE.PointLight(0xffc266, 0, 14, 2);
    scene.add(this.flash);
    this.flashTime = 0;
    this._tracerIdx = 0;
    this._sparkIdx = 0;
  }

  tracer(from, to, color = 0xffe08a) {
    const t = this.tracers[this._tracerIdx++ % TRACERS];
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    t.line.material.color.setHex(color);
    t.line.material.opacity = 1;
    t.line.visible = true;
    t.life = t.max;
  }

  impact(point, count = 6) {
    for (let i = 0; i < count; i++) {
      const s = this.sparks[this._sparkIdx++ % SPARKS];
      s.mesh.position.set(point.x, point.y, point.z);
      s.vel.set((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
      s.life = 0.35 + Math.random() * 0.2;
      s.mesh.visible = true;
      s.mesh.scale.setScalar(1);
    }
  }

  muzzleFlash(pos) {
    this.flash.position.set(pos.x, pos.y, pos.z);
    this.flash.intensity = 80; // candelas (unidades físicas)
    this.flashTime = 0.05;
  }

  update(dt) {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / t.max);
      if (t.life <= 0) t.line.visible = false;
    }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vel.y -= 12 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.scale.setScalar(Math.max(0.1, s.life * 2.5));
      if (s.life <= 0) s.mesh.visible = false;
    }
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flash.intensity = 0;
    }
  }

  dispose() {
    for (const t of this.tracers) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
    }
    for (const s of this.sparks) this.scene.remove(s.mesh);
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    this.scene.remove(this.flash);
    this.flash.dispose?.();
  }
}
