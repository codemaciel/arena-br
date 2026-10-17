/** Escolhe um ponto de spawn longe dos inimigos (sorteia entre os 3 melhores). */
export function pickSpawn(spawns, avoid = [], rng = Math.random) {
  const scored = spawns.map((s) => {
    let min = Infinity;
    for (const a of avoid) min = Math.min(min, Math.hypot(a.x - s.x, a.z - s.z));
    return { s, min };
  }).sort((a, b) => b.min - a.min);
  const top = scored.slice(0, Math.min(3, scored.length));
  return top[Math.floor(rng() * top.length)].s;
}
