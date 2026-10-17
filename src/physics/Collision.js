// Colisões AABB e raycast. Módulo puro (sem Three.js) para poder ser testado e usado no servidor.

export function createBox(x, y, z, w, h, d, props = {}) {
  return {
    minX: x - w / 2, maxX: x + w / 2,
    minY: y, maxY: y + h,
    minZ: z - d / 2, maxZ: z + d / 2,
    ...props,
  };
}

export function overlapsBox(px, py, pz, r, h, b) {
  return px + r > b.minX && px - r < b.maxX
    && py + h > b.minY && py < b.maxY
    && pz + r > b.minZ && pz - r < b.maxZ;
}

const MAX_STEP = 0.25; // deslocamento máximo por sub-passo (evita atravessar paredes finas)

/**
 * Move um corpo {x,y,z,vx,vy,vz,radius,height,onGround} eixo por eixo,
 * resolvendo colisões com as caixas e limitando ao mapa.
 * Divide o movimento em sub-passos quando a velocidade é alta.
 */
export function moveBody(body, dt, boxes, bounds) {
  const fastest = Math.max(Math.abs(body.vx), Math.abs(body.vy), Math.abs(body.vz)) * dt;
  const steps = Math.min(20, Math.max(1, Math.ceil(fastest / MAX_STEP)));
  let grounded = false;
  for (let i = 0; i < steps; i++) {
    stepBody(body, dt / steps, boxes, bounds);
    grounded ||= body.onGround; // um sub-passo apoiado já conta como "no chão"
  }
  body.onGround = grounded;
}

function stepBody(body, dt, boxes, bounds) {
  const r = body.radius;
  const h = body.height;

  body.x += body.vx * dt;
  for (const b of boxes) {
    if (overlapsBox(body.x, body.y, body.z, r, h, b)) {
      const cx = (b.minX + b.maxX) / 2;
      body.x = body.vx > 0 || (body.vx === 0 && body.x < cx) ? b.minX - r : b.maxX + r;
      body.vx = 0;
    }
  }

  body.z += body.vz * dt;
  for (const b of boxes) {
    if (overlapsBox(body.x, body.y, body.z, r, h, b)) {
      const cz = (b.minZ + b.maxZ) / 2;
      body.z = body.vz > 0 || (body.vz === 0 && body.z < cz) ? b.minZ - r : b.maxZ + r;
      body.vz = 0;
    }
  }

  body.onGround = false;
  body.y += body.vy * dt;
  for (const b of boxes) {
    if (overlapsBox(body.x, body.y, body.z, r, h, b)) {
      if (body.vy <= 0) {
        body.y = b.maxY;
        body.onGround = true;
      } else {
        body.y = b.minY - h;
      }
      body.vy = 0;
    }
  }
  if (body.y <= 0) {
    body.y = 0;
    if (body.vy < 0) body.vy = 0;
    body.onGround = true;
  }

  if (bounds) {
    body.x = Math.min(bounds.maxX - r, Math.max(bounds.minX + r, body.x));
    body.z = Math.min(bounds.maxZ - r, Math.max(bounds.minZ + r, body.z));
  }
}

const AXES = [
  ['x', 'minX', 'maxX'],
  ['y', 'minY', 'maxY'],
  ['z', 'minZ', 'maxZ'],
];

/** Interseção raio × AABB (método dos "slabs"). Retorna a distância ou null. */
export function rayBox(o, d, b, maxDist = Infinity) {
  let tmin = 0;
  let tmax = maxDist;
  for (const [axis, lo, hi] of AXES) {
    const dir = d[axis];
    const org = o[axis];
    if (Math.abs(dir) < 1e-9) {
      if (org < b[lo] || org > b[hi]) return null;
    } else {
      let t1 = (b[lo] - org) / dir;
      let t2 = (b[hi] - org) / dir;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

/** Distância até o primeiro obstáculo do mundo (caixas + chão) ou null. */
export function raycastWorld(o, d, maxDist, boxes) {
  let best = null;
  for (const b of boxes) {
    const t = rayBox(o, d, b, best ?? maxDist);
    if (t !== null && (best === null || t < best)) best = t;
  }
  if (d.y < -1e-9) {
    const t = -o.y / d.y;
    if (t >= 0 && t <= (best ?? maxDist)) best = t;
  }
  return best;
}

export function lineOfSight(from, to, boxes) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  return raycastWorld(from, dir, len, boxes) === null;
}
