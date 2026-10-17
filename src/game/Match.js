import { SCORING } from '../config.js';

/** Regras da partida: pontuação, eliminações, tempo e vencedor. Sem dependência de render. */
export class Match {
  constructor({ killLimit = null, timeLimit = null, scoring = SCORING } = {}) {
    this.killLimit = killLimit;
    this.timeLimit = timeLimit;
    this.scoring = scoring;
    this.participants = new Map();
    this.elapsed = 0;
    this.over = false;
    this.endReason = null;
    this.winnerId = null;
  }

  addParticipant(id, name, { isPlayer = false } = {}) {
    this.participants.set(id, { id, name, isPlayer, kills: 0, deaths: 0, score: 0, streak: 0 });
  }

  removeParticipant(id) {
    this.participants.delete(id);
  }

  get(id) {
    return this.participants.get(id) ?? null;
  }

  /** Registra uma eliminação. Retorna {points, streak} ou null se inválida. */
  registerKill(killerId, victimId, { headshot = false } = {}) {
    if (this.over || killerId === victimId) return null;
    const killer = this.participants.get(killerId);
    const victim = this.participants.get(victimId);
    if (!killer || !victim) return null;

    killer.kills += 1;
    killer.streak += 1;
    victim.deaths += 1;
    victim.streak = 0;

    const s = this.scoring;
    const streakBonus = Math.min(s.streakBonusMax, s.streakBonus * (killer.streak - 1));
    const points = s.kill + (headshot ? s.headshotBonus : 0) + streakBonus;
    killer.score += points;

    if (this.killLimit !== null && killer.kills >= this.killLimit) this.#end('killLimit', killerId);
    return { points, streak: killer.streak };
  }

  tick(dt) {
    if (this.over) return;
    this.elapsed += dt;
    if (this.timeLimit !== null && this.elapsed >= this.timeLimit) {
      const ranking = this.getRanking();
      const [a, b] = ranking;
      const tie = a && b && a.kills === b.kills && a.score === b.score;
      this.#end('time', tie || !a ? null : a.id);
    }
  }

  get remainingTime() {
    return this.timeLimit === null ? null : Math.max(0, this.timeLimit - this.elapsed);
  }

  getRanking() {
    return [...this.participants.values()]
      .map((p) => ({ ...p }))
      .sort((a, b) => b.kills - a.kills || b.score - a.score || a.deaths - b.deaths);
  }

  reset() {
    for (const p of this.participants.values()) {
      p.kills = 0; p.deaths = 0; p.score = 0; p.streak = 0;
    }
    this.elapsed = 0;
    this.over = false;
    this.endReason = null;
    this.winnerId = null;
  }

  #end(reason, winnerId) {
    this.over = true;
    this.endReason = reason;
    this.winnerId = winnerId;
  }
}
