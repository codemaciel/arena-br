import { PLAYER } from '../config.js';
import { raycastWorld, rayBox } from './Collision.js';

const HEAD_HEIGHT = 0.35;
const HEAD_HALF = 0.22;

/** Duas caixas de acerto: cabeça e corpo. `pos` = pés da entidade. */
export function getHitboxes(pos, radius = PLAYER.radius, height = PLAYER.height) {
  const bodyTop = height - HEAD_HEIGHT;
  return [
    {
      zone: 'head',
      box: {
        minX: pos.x - HEAD_HALF, maxX: pos.x + HEAD_HALF,
        minY: pos.y + bodyTop, maxY: pos.y + height,
        minZ: pos.z - HEAD_HALF, maxZ: pos.z + HEAD_HALF,
      },
    },
    {
      zone: 'body',
      box: {
        minX: pos.x - radius, maxX: pos.x + radius,
        minY: pos.y, maxY: pos.y + bodyTop,
        minZ: pos.z - radius, maxZ: pos.z + radius,
      },
    },
  ];
}

/** Alvos: objetos com {id, x, y, z, alive}. */
export function raycastTargets(origin, dir, maxDist, targets, ignoreId) {
  let best = null;
  for (const t of targets) {
    if (t.id === ignoreId || !t.alive) continue;
    for (const hb of getHitboxes(t)) {
      const d = rayBox(origin, dir, hb.box, best ? best.distance : maxDist);
      if (d !== null && (!best || d < best.distance)) best = { target: t, zone: hb.zone, distance: d };
    }
  }
  return best;
}

/** Resolve um disparo hitscan: alvo mais próximo antes de qualquer parede. */
export function resolveShot(origin, dir, maxDist, boxes, targets, ignoreId) {
  const worldT = raycastWorld(origin, dir, maxDist, boxes);
  const limit = worldT ?? maxDist;
  const hit = raycastTargets(origin, dir, limit, targets, ignoreId);
  const at = (dist) => ({
    x: origin.x + dir.x * dist,
    y: origin.y + dir.y * dist,
    z: origin.z + dir.z * dist,
  });
  if (hit) return { type: 'target', target: hit.target, zone: hit.zone, distance: hit.distance, point: at(hit.distance) };
  if (worldT !== null) return { type: 'world', distance: worldT, point: at(worldT) };
  return { type: 'none', distance: maxDist, point: at(maxDist) };
}
