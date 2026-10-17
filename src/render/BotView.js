import * as THREE from 'three';

/** Fábrica com geometrias compartilhadas entre todos os bots (menos objetos na GPU). */
export class BotViewFactory {
  constructor(scene) {
    this.scene = scene;
    this.geo = {
      leg: new THREE.BoxGeometry(0.22, 0.7, 0.24),
      torso: new THREE.BoxGeometry(0.7, 0.7, 0.4),
      head: new THREE.BoxGeometry(0.4, 0.4, 0.4),
      arm: new THREE.BoxGeometry(0.14, 0.6, 0.16),
      gun: new THREE.BoxGeometry(0.08, 0.1, 0.55),
    };
    this.skin = new THREE.MeshLambertMaterial({ color: 0xe0b48f });
    this.dark = new THREE.MeshLambertMaterial({ color: 0x23262e });
    this.gunMat = new THREE.MeshLambertMaterial({ color: 0x3b3f4a });
    this.views = new Set();
  }

  create(bot, hue) {
    const view = new BotView(this, bot, hue);
    this.views.add(view);
    return view;
  }

  dispose() {
    for (const v of this.views) v.dispose();
    this.views.clear();
    Object.values(this.geo).forEach((g) => g.dispose());
    [this.skin, this.dark, this.gunMat].forEach((m) => m.dispose());
  }
}

class BotView {
  constructor(factory, bot, hue) {
    this.factory = factory;
    this.phase = 0;
    this.flashTime = 0;
    const g = factory.geo;
    this.bodyMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.65, 0.5), emissive: 0x000000 });
    this.group = new THREE.Group();

    const mk = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };
    // Pivôs das pernas para balançar ao andar
    this.legL = new THREE.Group(); this.legL.position.set(-0.17, 0.7, 0);
    this.legR = new THREE.Group(); this.legR.position.set(0.17, 0.7, 0);
    for (const pivot of [this.legL, this.legR]) {
      const leg = new THREE.Mesh(g.leg, factory.dark);
      leg.position.y = -0.35;
      pivot.add(leg);
      this.group.add(pivot);
    }
    mk(g.torso, this.bodyMat, 0, 1.05, 0);
    mk(g.head, factory.skin, 0, 1.6, 0);
    mk(g.arm, this.bodyMat, -0.42, 1.05, -0.05);
    mk(g.arm, this.bodyMat, 0.42, 1.05, -0.2).rotation.x = -1.1;
    mk(g.gun, factory.gunMat, 0.3, 1.1, -0.55); // frente = -Z
    factory.scene.add(this.group);
    this.sync(bot, 0);
  }

  flash() {
    this.flashTime = 0.12;
  }

  sync(bot, dt) {
    this.group.visible = bot.alive;
    if (!bot.alive) return;
    const b = bot.body;
    this.group.position.set(b.x, b.y, b.z);
    this.group.rotation.y = bot.yaw;
    const speed = Math.hypot(b.vx, b.vz);
    this.phase += dt * Math.max(speed, 0.0) * 2.2;
    const swing = Math.sin(this.phase) * 0.7 * Math.min(1, speed / 3);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.bodyMat.emissive.setHex(this.flashTime > 0 ? 0xaa1111 : 0x000000);
    }
  }

  dispose() {
    this.factory.scene.remove(this.group);
    this.bodyMat.dispose();
    this.factory.views.delete(this);
  }
}
