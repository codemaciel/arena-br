/** Balde de fichas (token bucket) para limitar a frequência de eventos por jogador. */
export class RateLimiter {
  constructor(perSecond, burst = perSecond, nowFn = () => Date.now() / 1000) {
    this.perSecond = perSecond;
    this.burst = burst;
    this.now = nowFn;
    this.tokens = burst;
    this.last = nowFn();
  }

  allow(cost = 1, at = this.now()) {
    const elapsed = Math.max(0, at - this.last);
    this.last = at;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.perSecond);
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }
}
