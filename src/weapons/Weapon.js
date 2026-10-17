import { WEAPON } from '../config.js';

/** Estado da arma: munição, cadência, recarga e dispersão. Puro e testável. */
export class Weapon {
  constructor(cfg = WEAPON) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.ammo = this.cfg.magazineSize;
    this.reserve = this.cfg.reserveAmmo;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.reloading = false;
    this.extraSpread = 0;
  }

  update(dt) {
    if (dt <= 0) return;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.extraSpread = Math.max(0, this.extraSpread - this.cfg.spreadRecovery * dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.#finishReload();
    }
  }

  canFire() {
    return !this.reloading && this.ammo > 0 && this.cooldown <= 0;
  }

  /** Tenta disparar. Retorna true se o tiro saiu. */
  fire() {
    if (!this.canFire()) {
      if (!this.reloading && this.ammo === 0) this.startReload();
      return false;
    }
    this.ammo -= 1;
    this.cooldown = this.cfg.fireInterval;
    this.extraSpread += this.cfg.spreadPerShot;
    if (this.ammo === 0) this.startReload();
    return true;
  }

  startReload() {
    if (this.reloading || this.ammo >= this.cfg.magazineSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTimer = this.cfg.reloadTime;
    return true;
  }

  cancelReload() {
    this.reloading = false;
    this.reloadTimer = 0;
  }

  /** Dispersão atual em radianos. */
  currentSpread({ moving = false, airborne = false } = {}) {
    const c = this.cfg;
    const base = c.spreadBase + (airborne ? c.spreadAir : moving ? c.spreadMoving : 0);
    return Math.min(c.spreadMax, base + this.extraSpread);
  }

  #finishReload() {
    const need = this.cfg.magazineSize - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    this.reloading = false;
    this.reloadTimer = 0;
  }
}
