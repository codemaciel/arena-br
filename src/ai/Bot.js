import { BOT } from '../config.js';
import { Health } from '../game/Damage.js';
import { moveBody, raycastWorld } from '../physics/Collision.js';

export const BotState = Object.freeze({
  PATRULHA: 'patrulha',
  BUSCA: 'busca',
  PERSEGUICAO: 'perseguicao',
  ATAQUE: 'ataque',
  REPOSICIONAMENTO: 'reposicionamento',
  MORTO: 'morto',
});

const FOV_COS = Math.cos((75 * Math.PI) / 180);

/**
 * Bot com máquina de estados. Não depende de Three.js:
 * o jogo apenas lê `body`/`yaw` para desenhar e consome os tiros retornados por update().
 */
export class Bot {
  constructor(id, name, difficulty, arena, rng = Math.random) {
    this.id = id;
    this.name = name;
    this.diff = difficulty;
    this.arena = arena;
    this.rng = rng;
    this.body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, radius: BOT.radius, height: BOT.height, onGround: true };
    this.yaw = 0;
    this.health = new Health(difficulty.hp);
    this.health.current = 0;
    this.state = BotState.MORTO;
    this.respawnTimer = 0;
    this.#resetTimers();
  }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get z() { return this.body.z; }
  get alive() { return this.health.alive; }

  #resetTimers() {
    this.stateTime = 0;
    this.seeTimer = 0;
    this.lostTimer = 0;
    this.shootCooldown = 0;
    this.attackWindow = 4;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.patrolTarget = null;
    this.repositionTarget = null;
    this.lastKnown = null;
    this.stuckTimer = 0;
    this.stuckEvents = 0;
    this.avoidTimer = 0;
    this.avoidSign = 1;
  }

  /** Aparece no mapa. Se há alvo, volta direto ao combate (busca a última posição conhecida). */
  spawn(x, z, target = null) {
    Object.assign(this.body, { x, y: 0, z, vx: 0, vy: 0, vz: 0, onGround: true });
    this.health.reset(this.diff.hp);
    this.#resetTimers();
    this.shootCooldown = this.diff.fireInterval;
    this.lastKnown = target ? { x: target.x, z: target.z } : null;
    this.#setState(this.lastKnown ? BotState.BUSCA : BotState.PATRULHA);
  }

  takeDamage(amount, fromPos = null) {
    const r = this.health.damage(amount);
    if (!r.applied) return r;
    if (r.died) {
      this.state = BotState.MORTO;
      this.respawnTimer = BOT.respawnDelay;
      this.body.vx = 0;
      this.body.vz = 0;
      return r;
    }
    if (fromPos) {
      this.lastKnown = { x: fromPos.x, z: fromPos.z };
      if (this.state === BotState.PATRULHA || this.state === BotState.BUSCA) this.#setState(BotState.PERSEGUICAO);
    }
    if (this.health.current / this.health.max < 0.3 && this.state !== BotState.REPOSICIONAMENTO) {
      this.#setState(BotState.REPOSICIONAMENTO);
    }
    return r;
  }

  /** Atualiza o bot. Retorna um tiro {origin, dir, damage} ou null. */
  update(dt, target, ctx = {}) {
    if (!this.alive) return null;
    const b = this.body;
    this.stateTime += dt;
    this.shootCooldown -= dt;

    const dx = target.x - b.x;
    const dz = target.z - b.z;
    const dist = Math.hypot(dx, dz);
    const passive = !!ctx.passive;
    const sees = !passive && target.alive && this.#canSee(target, dist);
    if (sees) {
      this.seeTimer += dt;
      this.lostTimer = 0;
      this.lastKnown = { x: target.x, z: target.z };
    } else {
      this.seeTimer = 0;
      this.lostTimer += dt;
    }
    const aware = sees && this.seeTimer >= this.diff.reaction;

    if (passive && this.state !== BotState.PATRULHA) this.#setState(BotState.PATRULHA);
    this.#think(dist, sees, aware);

    let shot = null;
    let dir = null;
    let speed = this.diff.speed;

    switch (this.state) {
      case BotState.PATRULHA:
        if (!this.patrolTarget || this.#reached(this.patrolTarget)) this.patrolTarget = this.#pickWaypoint();
        dir = this.#dirTo(this.patrolTarget);
        speed *= passive ? 0.5 : 0.6;
        break;
      case BotState.BUSCA:
        dir = this.lastKnown ? this.#dirTo(this.lastKnown) : null;
        break;
      case BotState.PERSEGUICAO:
        dir = this.#dirTo(sees ? target : (this.lastKnown ?? target));
        break;
      case BotState.ATAQUE: {
        const to = this.#norm(dx, dz);
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeDir *= -1;
          this.strafeTimer = 0.6 + this.rng() * 0.8;
        }
        dir = { x: -to.z * this.strafeDir, z: to.x * this.strafeDir, face: to };
        speed *= 0.5;
        if (sees && aware && ctx.botsAttack !== false && this.diff.damage > 0 && this.shootCooldown <= 0) {
          this.shootCooldown = this.diff.fireInterval * (0.8 + this.rng() * 0.4);
          shot = this.#makeShot(target);
        }
        break;
      }
      case BotState.REPOSICIONAMENTO:
        dir = this.#dirTo(this.repositionTarget);
        speed *= 1.1;
        break;
      default:
        break;
    }

    this.#move(dt, dir, speed);
    return shot;
  }

  // ---- decisão ----
  #think(dist, sees, aware) {
    const range = BOT.attackRange;
    switch (this.state) {
      case BotState.PATRULHA:
      case BotState.BUSCA:
        if (aware) this.#setState(dist <= range ? BotState.ATAQUE : BotState.PERSEGUICAO);
        else if (this.state === BotState.BUSCA && (!this.lastKnown || this.#reached(this.lastKnown) || this.stateTime > 8)) {
          this.#setState(BotState.PATRULHA);
        }
        break;
      case BotState.PERSEGUICAO:
        if (aware && dist <= range * 0.9) this.#setState(BotState.ATAQUE);
        else if (!sees && this.lostTimer > 1.5) this.#setState(BotState.BUSCA);
        break;
      case BotState.ATAQUE:
        if (this.health.current / this.health.max < 0.3 || this.stateTime > this.attackWindow) this.#setState(BotState.REPOSICIONAMENTO);
        else if ((!sees && this.lostTimer > 0.5) || dist > range * 1.15) this.#setState(BotState.PERSEGUICAO);
        break;
      case BotState.REPOSICIONAMENTO:
        if (!this.repositionTarget || this.#reached(this.repositionTarget) || this.stateTime > 4) {
          this.#setState(aware ? BotState.ATAQUE : BotState.BUSCA);
        }
        break;
      default:
        break;
    }
  }

  #setState(next) {
    this.state = next;
    this.stateTime = 0;
    if (next === BotState.ATAQUE) {
      this.attackWindow = 3 + this.rng() * 2;
      this.strafeDir = this.rng() < 0.5 ? -1 : 1;
      this.strafeTimer = 0;
    } else if (next === BotState.REPOSICIONAMENTO) {
      this.repositionTarget = this.#pickWaypoint(8, 32);
    } else if (next === BotState.PATRULHA) {
      this.patrolTarget = null;
    }
  }

  // ---- percepção ----
  #canSee(target, dist) {
    if (dist > this.diff.viewRange) return false;
    const b = this.body;
    if (dist > 10) {
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      if ((fx * (target.x - b.x) + fz * (target.z - b.z)) / dist < FOV_COS) return false;
    }
    const from = { x: b.x, y: b.y + BOT.eyeHeight, z: b.z };
    const to = { x: target.x, y: target.y + 1.2, z: target.z };
    const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    if (len < 1e-6) return true;
    const d = { x: (to.x - from.x) / len, y: (to.y - from.y) / len, z: (to.z - from.z) / len };
    return raycastWorld(from, d, len, this.arena.boxes) === null;
  }

  // ---- movimento ----
  #reached(p, r = 1.5) {
    return Math.hypot(p.x - this.body.x, p.z - this.body.z) < r;
  }

  #norm(x, z) {
    const l = Math.hypot(x, z);
    return l < 1e-6 ? { x: 0, z: 0 } : { x: x / l, z: z / l };
  }

  #dirTo(p) {
    if (!p || this.#reached(p, 1)) return null;
    return this.#norm(p.x - this.body.x, p.z - this.body.z);
  }

  #pickWaypoint(minDist = 6, maxDist = Infinity) {
    const b = this.body;
    const all = this.arena.waypoints;
    const cands = all.filter((w) => {
      const d = Math.hypot(w.x - b.x, w.z - b.z);
      return d >= minDist && d <= maxDist;
    });
    const pool = cands.length ? cands : all;
    return pool[Math.floor(this.rng() * pool.length)];
  }

  #move(dt, dir, speed) {
    const b = this.body;
    let vx = 0;
    let vz = 0;
    if (dir && (dir.x !== 0 || dir.z !== 0)) {
      let dx = dir.x;
      let dz = dir.z;
      if (this.avoidTimer > 0) {
        this.avoidTimer -= dt;
        const a = this.avoidSign * (Math.PI / 2);
        const c = Math.cos(a);
        const s = Math.sin(a);
        [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
      }
      vx = dx * speed;
      vz = dz * speed;
      const f = dir.face ?? { x: dx, z: dz };
      this.yaw = Math.atan2(-f.x, -f.z);
    }
    b.vx = vx;
    b.vz = vz;
    b.vy -= BOT.gravity * dt;
    const px = b.x;
    const pz = b.z;
    moveBody(b, dt, this.arena.boxes, this.arena.bounds);

    const wanted = Math.hypot(vx, vz) * dt;
    const moved = Math.hypot(b.x - px, b.z - pz);
    if (wanted > 1e-4 && moved < wanted * 0.25) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.35) {
        this.stuckTimer = 0;
        this.stuckEvents += 1;
        if (b.onGround && this.rng() < 0.5) {
          b.vy = BOT.jumpSpeed;
        } else {
          this.avoidTimer = 0.6 + this.rng() * 0.5;
          this.avoidSign = this.rng() < 0.5 ? -1 : 1;
        }
        if (this.stuckEvents > 2) {
          this.stuckEvents = 0;
          this.patrolTarget = null;
          if (this.state === BotState.REPOSICIONAMENTO) this.repositionTarget = this.#pickWaypoint(8, 32);
        }
      }
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    }
  }

  #makeShot(target) {
    const b = this.body;
    const origin = { x: b.x, y: b.y + BOT.eyeHeight, z: b.z };
    const to = { x: target.x, y: target.y + 1.2, z: target.z };
    let dx = to.x - origin.x;
    let dy = to.y - origin.y;
    let dz = to.z - origin.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const s = this.diff.spread;
    dx = dx / l + (this.rng() - 0.5) * 2 * s;
    dy = dy / l + (this.rng() - 0.5) * 2 * s;
    dz = dz / l + (this.rng() - 0.5) * 2 * s;
    const n = Math.hypot(dx, dy, dz) || 1;
    return { origin, dir: { x: dx / n, y: dy / n, z: dz / n }, damage: this.diff.damage };
  }
}
