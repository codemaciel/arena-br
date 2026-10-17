import * as THREE from 'three';

/** Arma em primeira pessoa (filha da câmera) com balanço, coice e animação de recarga. */
export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.base = new THREE.Vector3(0.24, -0.22, -0.5);
    this.group.position.copy(this.base);
    this.time = 0;
    this.kickAmt = 0;
    this.reloadAmt = 0;
    this.reloading = false;
    this.materials = [];
    this.geometries = [];

    const part = (w, h, d, color, x, y, z) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshLambertMaterial({ color });
      this.geometries.push(geo);
      this.materials.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };
    part(0.08, 0.12, 0.5, 0x2c3140, 0, 0, 0);
    part(0.04, 0.04, 0.3, 0x15171d, 0, 0.02, -0.38);
    part(0.07, 0.16, 0.1, 0x1c1f28, 0, -0.12, 0.08);
    part(0.07, 0.1, 0.22, 0x3a4152, 0, -0.02, 0.32);
    part(0.082, 0.02, 0.3, 0x19e3ff, 0, 0.07, -0.02);

    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.02, -0.55);
    this.group.add(this.muzzle);
    camera.add(this.group);
    this._v = new THREE.Vector3();
  }

  kick() {
    this.kickAmt = 1;
  }

  setReloading(value) {
    this.reloading = value;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  update(dt, speed) {
    this.time += dt * (1 + speed * 0.6);
    this.kickAmt = Math.max(0, this.kickAmt - dt * 9);
    this.reloadAmt += ((this.reloading ? 1 : 0) - this.reloadAmt) * Math.min(1, dt * 10);
    const bob = Math.min(1, speed / 6);
    this.group.position.set(
      this.base.x + Math.sin(this.time * 4) * 0.008 * bob,
      this.base.y + Math.abs(Math.sin(this.time * 4)) * 0.01 * bob - 0.14 * this.reloadAmt,
      this.base.z + 0.05 * this.kickAmt,
    );
    this.group.rotation.x = 0.06 * this.kickAmt - 0.7 * this.reloadAmt;
    this.group.rotation.z = 0.5 * this.reloadAmt;
  }

  getMuzzleWorld() {
    this.muzzle.updateWorldMatrix(true, false);
    return this.muzzle.getWorldPosition(this._v);
  }

  dispose() {
    this.camera.remove(this.group);
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
