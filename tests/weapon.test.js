import test from 'node:test';
import assert from 'node:assert/strict';
import { Weapon } from '../src/weapons/Weapon.js';

const cfg = { magazineSize: 5, reserveAmmo: 8, fireInterval: 0.1, reloadTime: 1, spreadBase: 0.01, spreadMoving: 0.02, spreadAir: 0.05, spreadPerShot: 0.005, spreadMax: 0.08, spreadRecovery: 0.01 };

test('disparo consome munição e respeita a cadência', () => {
  const w = new Weapon(cfg);
  assert.equal(w.fire(), true);
  assert.equal(w.ammo, 4);
  assert.equal(w.fire(), false); // ainda em cooldown
  w.update(0.1);
  assert.equal(w.fire(), true);
  assert.equal(w.ammo, 3);
});

test('recarga parcial transfere munição da reserva', () => {
  const w = new Weapon(cfg);
  w.fire(); w.update(0.1); w.fire(); // 3 no pente
  assert.equal(w.startReload(), true);
  assert.equal(w.canFire(), false);
  w.update(0.5);
  assert.equal(w.reloading, true);
  w.update(0.6);
  assert.equal(w.reloading, false);
  assert.equal(w.ammo, 5);
  assert.equal(w.reserve, 6);
});

test('recarga automática ao esvaziar e limite pela reserva', () => {
  const w = new Weapon({ ...cfg, reserveAmmo: 2 });
  for (let i = 0; i < 5; i++) { w.fire(); w.update(0.1); }
  assert.equal(w.ammo, 0);
  assert.equal(w.reloading, true);
  w.update(1);
  assert.equal(w.ammo, 2);
  assert.equal(w.reserve, 0);
  assert.equal(w.startReload(), false);
});

test('não recarrega com pente cheio nem sem reserva', () => {
  const w = new Weapon(cfg);
  assert.equal(w.startReload(), false);
  const v = new Weapon({ ...cfg, reserveAmmo: 0 });
  v.fire();
  assert.equal(v.startReload(), false);
});

test('dispersão aumenta com movimento, ar e tiros contínuos, e é limitada', () => {
  const w = new Weapon(cfg);
  const still = w.currentSpread();
  assert.ok(w.currentSpread({ moving: true }) > still);
  assert.ok(w.currentSpread({ airborne: true }) > w.currentSpread({ moving: true }));
  for (let i = 0; i < 4; i++) { w.fire(); w.update(0.1); }
  assert.ok(w.currentSpread() > still);
  w.extraSpread = 10;
  assert.equal(w.currentSpread({ airborne: true }), cfg.spreadMax);
});

test('munição infinita (Infinity) nunca acaba', () => {
  const w = new Weapon({ ...cfg, reserveAmmo: Infinity });
  for (let i = 0; i < 40; i++) { w.fire(); w.update(1.1); }
  assert.ok(w.ammo > 0);
  assert.equal(w.reserve, Infinity);
});
