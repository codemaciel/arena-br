import test from 'node:test';
import assert from 'node:assert/strict';
import { Bot, BotState } from '../src/ai/Bot.js';
import { BotManager } from '../src/ai/BotManager.js';
import { ARENA } from '../src/map/arena.js';
import { createBox, overlapsBox } from '../src/physics/Collision.js';
import { DIFFICULTY } from '../src/config.js';
import { mulberry32 } from './helpers.js';

const openArena = { boxes: [], bounds: ARENA.bounds, waypoints: [{ x: 10, z: 0 }, { x: -10, z: 0 }, { x: 0, z: 20 }], spawns: [{ x: 0, z: 0 }] };
const dt = 1 / 60;
const player = (x, z) => ({ id: 'p', x, y: 0, z, alive: true });

function run(bot, target, seconds, ctx = {}) {
  const shots = [];
  for (let i = 0; i < seconds / dt; i++) {
    const s = bot.update(dt, target, ctx);
    if (s) shots.push(s);
  }
  return shots;
}

test('bot reaparecendo com alvo conhecido começa buscando (retorno ao combate)', () => {
  const bot = new Bot('b', 'Zeca', DIFFICULTY.normal, openArena, mulberry32(1));
  bot.spawn(0, 0, player(20, 0));
  assert.equal(bot.state, BotState.BUSCA);
  bot.spawn(0, 0, null);
  assert.equal(bot.state, BotState.PATRULHA);
});

test('vê o jogador a distância -> persegue -> ataca e dispara', () => {
  const bot = new Bot('b', 'Zeca', DIFFICULTY.normal, openArena, mulberry32(2));
  bot.spawn(0, 0, player(40, 0)); // vai à posição conhecida, olhando para +x
  const seen = new Set();
  const target = player(40, 0);
  const shots = [];
  for (let i = 0; i < 20 / dt; i++) {
    const s = bot.update(dt, target, {});
    seen.add(bot.state);
    if (s) shots.push(s);
  }
  assert.ok(seen.has(BotState.PERSEGUICAO) || seen.has(BotState.ATAQUE));
  assert.ok(seen.has(BotState.ATAQUE), 'deveria atacar');
  assert.ok(shots.length > 5, `poucos tiros: ${shots.length}`);
  for (const s of shots) assert.equal(s.damage, DIFFICULTY.normal.damage);
});

test('treinamento (passivo): bot patrulha e nunca atira', () => {
  const bot = new Bot('b', 'Zeca', DIFFICULTY.dificil, openArena, mulberry32(3));
  bot.spawn(0, 0, null);
  const shots = run(bot, player(5, 0), 15, { passive: true, botsAttack: false });
  assert.equal(shots.length, 0);
  assert.equal(bot.state, BotState.PATRULHA);
});

test('parede bloqueia a visão: bot não atira através dela', () => {
  const arena = { ...openArena, boxes: [createBox(15, 0, 0, 1, 6, 40)] };
  const bot = new Bot('b', 'Zeca', DIFFICULTY.dificil, arena, mulberry32(4));
  bot.spawn(0, 0, null);
  bot.yaw = Math.atan2(-1, 0);
  const shots = run(bot, player(30, 0), 1.0);
  assert.equal(shots.length, 0);
});

test('bot ferido (<30%) reposiciona; morto fica MORTO', () => {
  const bot = new Bot('b', 'Zeca', DIFFICULTY.normal, openArena, mulberry32(5));
  bot.spawn(0, 0, null);
  bot.takeDamage(75, { x: 20, z: 0 });
  assert.equal(bot.state, BotState.REPOSICIONAMENTO);
  const r = bot.takeDamage(500);
  assert.equal(r.died, true);
  assert.equal(bot.state, BotState.MORTO);
  assert.equal(bot.alive, false);
  assert.equal(bot.update(dt, player(0, 0)), null);
});

test('dano recebido fora da vista faz o bot ir atrás do atacante', () => {
  const bot = new Bot('b', 'Zeca', DIFFICULTY.normal, openArena, mulberry32(6));
  bot.spawn(0, 0, null);
  bot.takeDamage(10, { x: -15, z: 5 });
  assert.equal(bot.state, BotState.PERSEGUICAO);
  assert.deepEqual(bot.lastKnown, { x: -15, z: 5 });
});

test('no mapa real: bots em patrulha nunca entram em paredes nem saem dos limites', () => {
  const rng = mulberry32(42);
  const mgr = new BotManager(ARENA, { rng });
  const bots = mgr.reset(8, DIFFICULTY.dificil);
  const far = player(0, 0);
  const r = 0.4;
  let moved = 0;
  const start = bots.map((b) => ({ x: b.x, z: b.z }));
  for (let i = 0; i < 60 * 60; i++) { // 60 s simulados
    mgr.update(dt, far, { passive: true });
    for (const b of bots) {
      for (const box of ARENA.boxes) {
        assert.ok(!overlapsBox(b.x, b.y + 0.05, b.z, r - 0.05, 1.7, box), `bot dentro de parede em (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`);
      }
      assert.ok(b.x >= ARENA.bounds.minX && b.x <= ARENA.bounds.maxX);
      assert.ok(b.z >= ARENA.bounds.minZ && b.z <= ARENA.bounds.maxZ);
    }
  }
  bots.forEach((b, i) => { moved += Math.hypot(b.x - start[i].x, b.z - start[i].z) > 3 ? 1 : 0; });
  assert.ok(moved >= 6, `bots travados: só ${moved} se moveram`);
});

test('bots mortos reaparecem após o tempo e voltam ao combate', () => {
  const rng = mulberry32(7);
  let respawned = 0;
  const mgr = new BotManager(ARENA, { rng, onRespawn: () => { respawned++; } });
  const [bot] = mgr.reset(1, DIFFICULTY.normal);
  bot.takeDamage(1000);
  assert.equal(bot.alive, false);
  for (let i = 0; i < 60 * 3; i++) mgr.update(dt, player(0, 10), {});
  assert.equal(bot.alive, false); // ainda em espera (4 s)
  for (let i = 0; i < 60 * 2; i++) mgr.update(dt, player(0, 10), {});
  assert.equal(bot.alive, true);
  assert.equal(respawned, 1);
  assert.equal(bot.health.current, DIFFICULTY.normal.hp);
});

test('combate completo no mapa real: bots que enxergam o jogador acabam atirando', () => {
  const rng = mulberry32(11);
  const mgr = new BotManager(ARENA, { rng });
  mgr.reset(6, DIFFICULTY.normal, [{ x: 0, z: 0 }]);
  let total = 0;
  const onPlatform = { id: 'p', x: 0, y: 1.2, z: 0, alive: true }; // praça central elevada
  for (let i = 0; i < 60 * 90; i++) total += mgr.update(dt, onPlatform, {}).length;
  assert.ok(total > 0, 'nenhum bot chegou a atirar em 90 s');
});
