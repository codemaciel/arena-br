import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, Health } from '../src/game/Damage.js';
import { WEAPON } from '../src/config.js';

const base = { base: 22, headshotMultiplier: 2, falloffStart: 25, falloffEnd: 80, minMultiplier: 0.55 };

test('dano no corpo a curta distância é o dano base', () => {
  assert.equal(calculateDamage({ ...base, zone: 'body', distance: 10 }), 22);
});

test('headshot multiplica o dano', () => {
  assert.equal(calculateDamage({ ...base, zone: 'head', distance: 10 }), 44);
});

test('dano cai linearmente entre falloffStart e falloffEnd', () => {
  const mid = calculateDamage({ ...base, zone: 'body', distance: 52.5 });
  assert.ok(mid < 22 && mid > Math.round(22 * 0.55));
  assert.equal(calculateDamage({ ...base, zone: 'body', distance: 500 }), Math.round(22 * 0.55));
});

test('Health: dano, morte e dano em alvo morto', () => {
  const h = new Health(100);
  assert.deepEqual(h.damage(30), { applied: 30, died: false });
  assert.equal(h.current, 70);
  assert.deepEqual(h.damage(500), { applied: 70, died: true });
  assert.equal(h.alive, false);
  assert.deepEqual(h.damage(10), { applied: 0, died: false });
});

test('Health: ignora dano inválido e regenera após o atraso', () => {
  const h = new Health(100);
  assert.equal(h.damage(-5).applied, 0);
  assert.equal(h.damage(NaN).applied, 0);
  h.damage(50);
  h.update(2, 5, 10);
  assert.equal(h.current, 50);
  h.update(4, 5, 10); // passou do atraso
  assert.ok(h.current > 50);
  h.update(100, 5, 10);
  assert.equal(h.current, 100);
});

test('dano da arma configurada mata em 5 tiros no corpo e 3 na cabeça', () => {
  const body = calculateDamage({ base: WEAPON.damage, zone: 'body', distance: 5, ...{ headshotMultiplier: WEAPON.headshotMultiplier } });
  const head = calculateDamage({ base: WEAPON.damage, zone: 'head', distance: 5, headshotMultiplier: WEAPON.headshotMultiplier });
  assert.equal(Math.ceil(100 / body), 5);
  assert.equal(Math.ceil(100 / head), 3);
});
