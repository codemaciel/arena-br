import { WEAPON } from '../config.js';
import { calculateDamage } from '../game/Damage.js';
import { resolveShot } from '../physics/Hitbox.js';
import { Weapon } from './Weapon.js';

/** Liga o estado da arma ao disparo hitscan (dispersão, acerto, dano). */
export class WeaponSystem {
  constructor(cfg = WEAPON) {
    this.cfg = cfg;
    this.weapon = new Weapon(cfg);
  }

  update(dt) {
    this.weapon.update(dt);
  }

  /** Retorna null se não atirou; senão {dir, type, point, distance, target?, zone?, damage?}. */
  shoot({ origin, direction, moving, airborne, boxes, targets, ignoreId, rng = Math.random }) {
    const spread = this.weapon.currentSpread({ moving, airborne });
    if (!this.weapon.fire()) return null;

    let x = direction.x + (rng() - 0.5) * 2 * spread;
    let y = direction.y + (rng() - 0.5) * 2 * spread;
    let z = direction.z + (rng() - 0.5) * 2 * spread;
    const len = Math.hypot(x, y, z) || 1;
    const dir = { x: x / len, y: y / len, z: z / len };

    const res = resolveShot(origin, dir, this.cfg.range, boxes, targets, ignoreId);
    const out = { dir, ...res };
    if (res.type === 'target') {
      out.damage = calculateDamage({
        base: this.cfg.damage,
        zone: res.zone,
        distance: res.distance,
        headshotMultiplier: this.cfg.headshotMultiplier,
        falloffStart: this.cfg.falloffStart,
        falloffEnd: this.cfg.falloffEnd,
        minMultiplier: this.cfg.minDamageMultiplier,
      });
    }
    return out;
  }
}
