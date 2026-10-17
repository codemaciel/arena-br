import { BOT_NAMES } from '../config.js';
import { pickSpawn } from '../game/spawn.js';
import { Bot } from './Bot.js';

/** Cria, atualiza, separa e faz reaparecer os bots. */
export class BotManager {
  constructor(arena, { onRespawn = null, rng = Math.random } = {}) {
    this.arena = arena;
    this.onRespawn = onRespawn;
    this.rng = rng;
    this.bots = [];
  }

  reset(count, difficulty, avoid = []) {
    this.bots = [];
    for (let i = 0; i < count; i++) {
      const bot = new Bot(`bot-${i + 1}`, BOT_NAMES[i % BOT_NAMES.length], difficulty, this.arena, this.rng);
      const taken = [...avoid, ...this.bots.filter((b) => b.alive)];
      const s = pickSpawn(this.arena.spawns, taken, this.rng);
      bot.spawn(s.x, s.z, null);
      this.bots.push(bot);
    }
    return this.bots;
  }

  /** Retorna a lista de tiros {bot, origin, dir, damage} feitos neste quadro. */
  update(dt, target, ctx = {}) {
    const shots = [];
    for (const bot of this.bots) {
      if (!bot.alive) {
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0 && !ctx.holdRespawn) {
          const avoid = [target, ...this.bots.filter((b) => b.alive)];
          const s = pickSpawn(this.arena.spawns, avoid, this.rng);
          bot.spawn(s.x, s.z, ctx.passive ? null : target);
          this.onRespawn?.(bot);
        }
        continue;
      }
      const shot = bot.update(dt, target, ctx);
      if (shot) shots.push({ bot, ...shot });
    }
    this.#separate();
    return shots;
  }

  #separate() {
    const alive = this.bots.filter((b) => b.alive);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i].body;
        const b = alive[j].body;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4 && d < 0.9) {
          const push = (0.9 - d) / 2;
          a.x -= (dx / d) * push; a.z -= (dz / d) * push;
          b.x += (dx / d) * push; b.z += (dz / d) * push;
        }
      }
    }
  }
}
