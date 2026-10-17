// Regras de dano e vida (puras, testáveis).

/** Dano final considerando zona atingida e queda por distância. */
export function calculateDamage({ base, zone, distance, headshotMultiplier = 2, falloffStart = Infinity, falloffEnd = Infinity, minMultiplier = 1 }) {
  let mult = zone === 'head' ? headshotMultiplier : 1;
  if (distance > falloffStart && falloffEnd > falloffStart) {
    const t = Math.min(1, (distance - falloffStart) / (falloffEnd - falloffStart));
    mult *= 1 - t * (1 - minMultiplier);
  }
  return Math.max(0, Math.round(base * mult));
}

export class Health {
  constructor(max) {
    this.max = max;
    this.current = max;
    this.timeSinceDamage = Infinity;
  }

  get alive() {
    return this.current > 0;
  }

  damage(amount) {
    if (!this.alive || !(amount > 0)) return { applied: 0, died: false };
    const applied = Math.min(this.current, amount);
    this.current -= applied;
    this.timeSinceDamage = 0;
    return { applied, died: this.current <= 0 };
  }

  update(dt, regenDelay = Infinity, regenRate = 0) {
    this.timeSinceDamage += dt;
    if (this.alive && regenRate > 0 && this.timeSinceDamage >= regenDelay && this.current < this.max) {
      this.current = Math.min(this.max, this.current + regenRate * dt);
    }
  }

  reset(max = this.max) {
    this.max = max;
    this.current = max;
    this.timeSinceDamage = Infinity;
  }
}
