import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShot } from '../src/physics/Hitbox.js';
import { createBox } from '../src/physics/Collision.js';

const target = { id: 't', x: 0, y: 0, z: -10, alive: true };
const origin = { x: 0, y: 1.62, z: 0 };

test('acerta o corpo e a cabeça conforme a altura da mira', () => {
  const body = resolveShot(origin, { x: 0, y: -0.07, z: -1 }, 100, [], [target], 'p');
  assert.equal(body.type, 'target');
  const dir = { x: 0, y: (1.65 - 1.62) / 10, z: -1 };
  const head = resolveShot(origin, dir, 100, [], [target], 'p');
  assert.equal(head.zone, 'head');
  const low = resolveShot(origin, { x: 0, y: -0.1, z: -1 }, 100, [], [target], 'p');
  assert.equal(low.zone, 'body');
});

test('parede entre atirador e alvo bloqueia o tiro', () => {
  const wall = createBox(0, 0, -5, 6, 4, 1);
  const r = resolveShot(origin, { x: 0, y: -0.05, z: -1 }, 100, [wall], [target], 'p');
  assert.equal(r.type, 'world');
});

test('ignora alvo morto, o próprio atirador e tiros ao céu', () => {
  const dead = { ...target, alive: false };
  assert.equal(resolveShot(origin, { x: 0, y: -0.05, z: -1 }, 100, [], [dead], 'p').type, 'world'); // só o chão
  assert.equal(resolveShot(origin, { x: 0, y: -0.05, z: -1 }, 100, [], [{ ...target, id: 'p' }], 'p').type, 'world');
  assert.equal(resolveShot(origin, { x: 0, y: 1, z: 0 }, 100, [], [target], 'p').type, 'none');
});
