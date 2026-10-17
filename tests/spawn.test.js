import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSpawn } from '../src/game/spawn.js';

const spawns = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 20, z: 0 }, { x: 30, z: 0 }, { x: 40, z: 0 }];

test('escolhe entre os spawns mais distantes do inimigo', () => {
  for (let i = 0; i < 50; i++) {
    const s = pickSpawn(spawns, [{ x: 0, z: 0 }]);
    assert.ok(s.x >= 20);
  }
});

test('sem inimigos qualquer spawn é válido', () => {
  assert.ok(spawns.includes(pickSpawn(spawns, [])));
});
