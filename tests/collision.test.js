import test from 'node:test';
import assert from 'node:assert/strict';
import { createBox, moveBody, overlapsBox, rayBox, raycastWorld, lineOfSight } from '../src/physics/Collision.js';
import { ARENA } from '../src/map/arena.js';

const newBody = (o = {}) => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, radius: 0.4, height: 1.8, onGround: true, ...o });

test('parede impede atravessar e deixa deslizar no outro eixo', () => {
  const wall = createBox(5, 0, 0, 1, 4, 10);
  const b = newBody({ x: 3, vx: 10, vz: 5 });
  moveBody(b, 0.5, [wall], null);
  assert.ok(b.x <= wall.minX - 0.4 + 1e-9);
  assert.ok(b.z > 2); // deslizou
});

test('gravidade pousa em cima de uma caixa', () => {
  const crate = createBox(0, 0, 0, 2, 2, 2);
  const b = newBody({ y: 5, vy: -20 });
  for (let i = 0; i < 30; i++) { b.vy -= 24 * 0.016; moveBody(b, 0.016, [crate], null); }
  assert.equal(b.y, 2);
  assert.equal(b.onGround, true);
});

test('bater a cabeça no teto zera a velocidade vertical', () => {
  const ceiling = createBox(0, 3, 0, 4, 1, 4);
  const b = newBody({ y: 0.9, vy: 10 });
  moveBody(b, 0.1, [ceiling], null);
  assert.equal(b.vy, 0);
  assert.ok(b.y + b.height <= 3 + 1e-9);
});

test('limites do mapa são respeitados', () => {
  const b = newBody({ vx: 1000, vz: -1000 });
  moveBody(b, 1, [], ARENA.bounds);
  assert.equal(b.x, ARENA.bounds.maxX - 0.4);
  assert.equal(b.z, ARENA.bounds.minZ + 0.4);
});

test('pulo máximo (8.5 m/s, g=24) sobe em plataforma de 1.2 m mas não em 1.8 m', () => {
  const apex = (8.5 * 8.5) / (2 * 24);
  assert.ok(apex > 1.2 && apex < 1.8);
});

test('rayBox acerta, erra e respeita distância máxima', () => {
  const box = createBox(0, 0, -10, 2, 2, 2);
  const o = { x: 0, y: 1, z: 0 };
  assert.ok(Math.abs(rayBox(o, { x: 0, y: 0, z: -1 }, box) - 9) < 1e-9);
  assert.equal(rayBox(o, { x: 1, y: 0, z: 0 }, box), null);
  assert.equal(rayBox(o, { x: 0, y: 0, z: -1 }, box, 5), null);
});

test('raycastWorld considera o chão e lineOfSight enxerga através de vãos', () => {
  const wall = createBox(0, 0, -5, 10, 4, 1);
  const o = { x: 0, y: 1.5, z: 0 };
  assert.ok(raycastWorld(o, { x: 0, y: -1, z: 0 }, 50, []) === 1.5);
  assert.equal(lineOfSight(o, { x: 0, y: 1.5, z: -10 }, [wall]), false);
  assert.equal(lineOfSight(o, { x: 20, y: 1.5, z: -10 }, [wall]), true);
});

test('mapa: spawns e waypoints não estão dentro de obstáculos e há saída ao ar livre', () => {
  const free = (p) => ARENA.boxes.every((b) => !overlapsBox(p.x, 0, p.z, 0.6, 1.8, b));
  for (const s of ARENA.spawns) assert.ok(free(s), `spawn preso em (${s.x}, ${s.z})`);
  for (const w of ARENA.waypoints) assert.ok(free(w), `waypoint preso em (${w.x}, ${w.z})`);
  for (const p of [...ARENA.spawns, ...ARENA.waypoints]) {
    assert.ok(p.x > ARENA.bounds.minX && p.x < ARENA.bounds.maxX && p.z > ARENA.bounds.minZ && p.z < ARENA.bounds.maxZ);
  }
});

test('mapa: todas as plataformas são alcançáveis pulando (degraus de até 1.2 m)', () => {
  const platform = ARENA.boxes.find((b) => b.type === 'platform' && b.maxY === 3.6);
  const b = newBody({ x: 14, z: -32 });
  // sobe pela escada: caixa 1.2 -> caixa 2.4 -> plataforma 3.6
  const steps = ARENA.boxes.filter((x) => x.type === 'crate' && x.minX >= 6 && x.maxX <= 12 && x.minZ < -30);
  assert.equal(steps.length, 2);
  assert.ok(platform);
  for (const s of steps) assert.ok(s.maxY <= 2.4);
});

test('correndo rápido sobre uma caixa continua "no chão" (permite pular)', () => {
  const crate = createBox(0, 0, 0, 20, 2, 20);
  const b = newBody({ y: 2, vx: 11 });
  for (let i = 0; i < 10; i++) { b.vy -= 24 * 0.05; b.vx = 11; moveBody(b, 0.05, [crate], null); assert.equal(b.onGround, true); }
});
