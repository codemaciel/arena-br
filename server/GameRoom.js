import { PLAYER, WEAPON, NETWORK } from '../src/config.js';
import { ARENA } from '../src/map/arena.js';
import { overlapsBox } from '../src/physics/Collision.js';
import { resolveShot } from '../src/physics/Hitbox.js';
import { calculateDamage, Health } from '../src/game/Damage.js';
import { Match } from '../src/game/Match.js';
import { pickSpawn } from '../src/game/spawn.js';
import { Weapon } from '../src/weapons/Weapon.js';

const MAX_SPEED = PLAYER.runSpeed * 1.35; // tolerância para latência/jitter
const MAX_RISE = PLAYER.jumpSpeed * 1.3;
const MAX_FALL = 60;
const MAX_NAME = 16;

const finite = (...v) => v.every((n) => typeof n === 'number' && Number.isFinite(n));

/**
 * Sala de partida com o servidor como autoridade:
 * posição validada, munição/cadência controladas aqui, dano e placar calculados aqui.
 * Não depende de Socket.IO (testável isoladamente).
 */
export class GameRoom {
  constructor(id, { arena = ARENA, maxPlayers = NETWORK.maxPlayers, killLimit = NETWORK.killLimit, timeLimit = NETWORK.timeLimit, rng = Math.random } = {}) {
    this.id = id;
    this.arena = arena;
    this.maxPlayers = maxPlayers;
    this.rng = rng;
    this.killLimit = killLimit;
    this.timeLimit = timeLimit;
    this.players = new Map();
    this.match = new Match({ killLimit, timeLimit });
    this.restartIn = null;
  }

  get size() { return this.players.size; }
  get isEmpty() { return this.players.size === 0; }

  addPlayer(id, rawName, now = 0) {
    if (this.players.has(id) || this.players.size >= this.maxPlayers) return null;
    const name = String(rawName ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, MAX_NAME) || `Jogador${this.players.size + 1}`;
    const p = {
      id, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0,
      health: new Health(PLAYER.maxHealth),
      weapon: new Weapon(WEAPON),
      lastMoveAt: now, lastWeaponAt: now, respawnTimer: 0, alive: true,
    };
    this.players.set(id, p);
    this.match.addParticipant(id, name);
    this.#spawn(p, now);
    return p;
  }

  removePlayer(id) {
    this.players.delete(id);
    this.match.removeParticipant(id);
  }

  #spawn(p, now) {
    const others = [...this.players.values()].filter((o) => o.id !== p.id && o.alive);
    const s = pickSpawn(this.arena.spawns, others, this.rng);
    Object.assign(p, { x: s.x, y: 0, z: s.z, alive: true, lastMoveAt: now, lastWeaponAt: now });
    p.health.reset(PLAYER.maxHealth);
    p.weapon.reset();
  }

  /** Valida o movimento enviado pelo cliente. Se inválido, devolve a posição autoritativa. */
  handleMove(id, m, now) {
    const p = this.players.get(id);
    if (!p || !p.alive || !m || !finite(m.x, m.y, m.z, m.yaw, m.pitch)) return { accepted: false, correction: this.#pos(p) };
    const dt = Math.min(0.5, Math.max(0.001, now - p.lastMoveAt));
    const dh = Math.hypot(m.x - p.x, m.z - p.z);
    const dy = m.y - p.y;
    const b = this.arena.bounds;
    const inside = m.x > b.minX && m.x < b.maxX && m.z > b.minZ && m.z < b.maxZ;
    const tooFast = dh > MAX_SPEED * dt + 0.3 || dy > MAX_RISE * dt + 0.3 || -dy > MAX_FALL * dt + 0.3;
    const stuck = this.arena.boxes.some((box) => overlapsBox(m.x, m.y + 0.02, m.z, PLAYER.radius - 0.05, PLAYER.height - 0.04, box));
    if (!inside || tooFast || stuck || m.y < -0.01 || m.y > 20) {
      p.lastMoveAt = now;
      return { accepted: false, correction: this.#pos(p) };
    }
    Object.assign(p, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch, lastMoveAt: now });
    return { accepted: true };
  }

  handleReload(id, now) {
    const p = this.players.get(id);
    if (!p || !p.alive) return false;
    p.weapon.update(now - p.lastWeaponAt);
    p.lastWeaponAt = now;
    return p.weapon.startReload();
  }

  /** Disparo: o servidor usa SUA posição do atirador; o cliente só envia a direção. */
  handleShoot(id, dir, now) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.match.over || !dir || !finite(dir.x, dir.y, dir.z)) return { events: [] };
    const len = Math.hypot(dir.x, dir.y, dir.z);
    if (len < 0.9 || len > 1.1) return { events: [] };
    p.weapon.update(now - p.lastWeaponAt);
    p.lastWeaponAt = now;
    if (!p.weapon.fire()) return { events: [] };

    const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
    const origin = { x: p.x, y: p.y + PLAYER.eyeHeight, z: p.z };
    const targets = [...this.players.values()].filter((t) => t.id !== id);
    const hit = resolveShot(origin, d, WEAPON.range, this.arena.boxes, targets, id);
    const events = [{ type: 'shot', shooter: id, origin, point: hit.point, hit: hit.type }];

    if (hit.type === 'target') {
      const victim = hit.target;
      const dmg = calculateDamage({
        base: WEAPON.damage, zone: hit.zone, distance: hit.distance,
        headshotMultiplier: WEAPON.headshotMultiplier, falloffStart: WEAPON.falloffStart,
        falloffEnd: WEAPON.falloffEnd, minMultiplier: WEAPON.minDamageMultiplier,
      });
      const r = victim.health.damage(dmg);
      events.push({ type: 'damage', attacker: id, victim: victim.id, amount: r.applied, headshot: hit.zone === 'head', health: victim.health.current });
      if (r.died) {
        victim.alive = false;
        victim.respawnTimer = PLAYER.respawnDelay;
        const res = this.match.registerKill(id, victim.id, { headshot: hit.zone === 'head' });
        events.push({ type: 'kill', killer: id, victim: victim.id, headshot: hit.zone === 'head', points: res?.points ?? 0 });
        if (this.match.over) events.push({ type: 'match_end', reason: this.match.endReason, winner: this.match.winnerId });
      }
    }
    return { events };
  }

  /** Avança respawns, regeneração e relógio da partida. */
  tick(dt, now) {
    const events = [];
    if (this.match.over) {
      this.restartIn = (this.restartIn ?? 10) - dt;
      if (this.restartIn <= 0) {
        this.match.reset();
        for (const p of this.players.values()) this.#spawn(p, now);
        this.restartIn = null;
        events.push({ type: 'match_restart' });
      }
      return events;
    }
    this.match.tick(dt);
    for (const p of this.players.values()) {
      if (p.alive) {
        p.health.update(dt, PLAYER.regenDelay, PLAYER.regenRate);
      } else {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          this.#spawn(p, now);
          events.push({ type: 'respawn', id: p.id, x: p.x, y: p.y, z: p.z });
        }
      }
    }
    if (this.match.over) events.push({ type: 'match_end', reason: this.match.endReason, winner: this.match.winnerId });
    return events;
  }

  snapshot() {
    return {
      room: this.id,
      time: this.match.remainingTime,
      over: this.match.over,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
        hp: Math.round(p.health.current), alive: p.alive, ammo: p.weapon.ammo, reloading: p.weapon.reloading,
      })),
      scoreboard: this.match.getRanking().map(({ id, name, kills, deaths, score }) => ({ id, name, kills, deaths, score })),
    };
  }

  #pos(p) {
    return p ? { x: p.x, y: p.y, z: p.z } : null;
  }
}
