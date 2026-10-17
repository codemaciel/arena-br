import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../server/GameRoom.js';
import { RateLimiter } from '../server/RateLimiter.js';
import { mulberry32 } from './helpers.js';

const openArena = { boxes: [], bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, spawns: [{ x: 0, z: 0 }] };
const mk = (opts = {}) => new GameRoom('t', { arena: openArena, rng: mulberry32(1), ...opts });

function place(room, id, x, z) {
  const p = room.players.get(id);
  p.x = x; p.z = z; p.y = 0;
}
const aimAt = (from, to, yTo = 1.2) => {
  const o = { x: from.x, y: 1.62, z: from.z };
  const d = { x: to.x - o.x, y: yTo - o.y, z: to.z - o.z };
  const l = Math.hypot(d.x, d.y, d.z);
  return { x: d.x / l, y: d.y / l, z: d.z / l };
};

test('RateLimiter: permite rajada, bloqueia excesso e recarrega com o tempo', () => {
  const rl = new RateLimiter(10, 3, () => 0);
  assert.equal(rl.allow(1, 0), true);
  assert.equal(rl.allow(1, 0), true);
  assert.equal(rl.allow(1, 0), true);
  assert.equal(rl.allow(1, 0), false);
  assert.equal(rl.allow(1, 0.1), true); // +1 ficha em 0,1 s
  assert.equal(rl.allow(1, 0.1), false);
});

test('sala: entrada, saída, lotação e nome sanitizado', () => {
  const r = mk({ maxPlayers: 2 });
  const a = r.addPlayer('a', '  <b>Ana</b>  ', 0);
  assert.equal(a.name, 'bAnab');
  assert.ok(r.addPlayer('b', '', 0).name.startsWith('Jogador'));
  assert.equal(r.addPlayer('c', 'Cris', 0), null);
  assert.equal(r.addPlayer('a', 'Dup', 0), null);
  r.removePlayer('a');
  assert.equal(r.size, 1);
  assert.equal(r.match.get('a'), null);
  assert.ok(r.addPlayer('c', 'Cris', 0));
});

test('movimento válido é aceito; teletransporte e velocidade impossível são rejeitados', () => {
  const r = mk();
  r.addPlayer('a', 'Ana', 0);
  place(r, 'a', 0, 0);
  assert.equal(r.handleMove('a', { x: 0.5, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.1).accepted, true);
  const bad = r.handleMove('a', { x: 40, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.2);
  assert.equal(bad.accepted, false);
  assert.deepEqual(bad.correction, { x: 0.5, y: 0, z: 0 });
  assert.equal(r.handleMove('a', { x: NaN, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.3).accepted, false);
  assert.equal(r.handleMove('a', { x: 60, y: 0, z: 0, yaw: 0, pitch: 0 }, 10).accepted, false); // fora do mapa
  assert.equal(r.handleMove('a', { x: 0.5, y: 15, z: 0, yaw: 0, pitch: 0 }, 10.1).accepted, false); // voo
});

test('movimento para dentro de uma parede é rejeitado', () => {
  const arena = { ...openArena, boxes: [{ minX: 1, maxX: 3, minY: 0, maxY: 3, minZ: -2, maxZ: 2 }] };
  const r = new GameRoom('t', { arena, rng: mulberry32(1) });
  r.addPlayer('a', 'Ana', 0);
  place(r, 'a', 0, 0);
  assert.equal(r.handleMove('a', { x: 2, y: 0, z: 0, yaw: 0, pitch: 0 }, 0.2).accepted, false);
});

test('tiro: servidor decide o acerto, aplica dano e ignora direção inválida', () => {
  const r = mk();
  r.addPlayer('a', 'Ana', 0);
  r.addPlayer('b', 'Beto', 0);
  place(r, 'a', 0, 0);
  place(r, 'b', 0, -10);
  assert.deepEqual(r.handleShoot('a', { x: 0, y: 0, z: -5 }, 1).events, []); // vetor não normalizado
  assert.deepEqual(r.handleShoot('a', { x: NaN, y: 0, z: -1 }, 1).events, []);
  const { events } = r.handleShoot('a', aimAt({ x: 0, z: 0 }, { x: 0, z: -10 }), 1);
  const dmg = events.find((e) => e.type === 'damage');
  assert.ok(dmg && dmg.victim === 'b' && dmg.amount === 22);
  assert.equal(r.players.get('b').health.current, 78);
});

test('tiro: cadência e munição são controladas pelo servidor', () => {
  const r = mk();
  r.addPlayer('a', 'Ana', 0);
  place(r, 'a', 0, 0);
  const dir = { x: 0, y: 0, z: -1 };
  assert.equal(r.handleShoot('a', dir, 1).events.length > 0, true);
  assert.equal(r.handleShoot('a', dir, 1.01).events.length, 0); // rápido demais
  assert.equal(r.handleShoot('a', dir, 1.2).events.length > 0, true);
  // esvazia o pente respeitando a cadência
  let t = 1.2;
  let shots = 2;
  while (shots < 40) {
    t += 0.11;
    if (r.handleShoot('a', dir, t).events.length) shots++; else break;
  }
  assert.equal(shots, 30);
  assert.equal(r.players.get('a').weapon.reloading, true);
});

test('eliminação: pontua, respawn após o atraso e fim de partida', () => {
  const r = mk({ killLimit: 2 });
  r.addPlayer('a', 'Ana', 0);
  r.addPlayer('b', 'Beto', 0);
  let t = 0;
  const kill = () => {
    place(r, 'a', 0, 0); place(r, 'b', 0, -5);
    const dir = aimAt({ x: 0, z: 0 }, { x: 0, z: -5 }, 1.75); // cabeça
    let all = [];
    for (let i = 0; i < 5; i++) { t += 0.2; all = all.concat(r.handleShoot('a', dir, t).events); if (all.some((e) => e.type === 'kill')) break; }
    return all;
  };
  const ev = kill();
  const k = ev.find((e) => e.type === 'kill');
  assert.ok(k && k.headshot && k.points === 150);
  assert.equal(r.players.get('b').alive, false);
  assert.deepEqual(r.handleShoot('b', { x: 0, y: 0, z: -1 }, t + 5).events, []); // morto não atira
  const respawn = r.tick(3.1, t + 3.1);
  assert.ok(respawn.some((e) => e.type === 'respawn' && e.id === 'b'));
  assert.equal(r.players.get('b').alive, true);
  assert.equal(r.players.get('b').health.current, 100);
  t += 3.1;
  const ev2 = kill();
  assert.ok(ev2.some((e) => e.type === 'match_end' && e.winner === 'a'));
  assert.equal(r.match.over, true);
  assert.deepEqual(r.handleShoot('a', { x: 0, y: 0, z: -1 }, t + 1).events, []); // partida acabou
  const restart = r.tick(10.5, t + 12);
  assert.ok(restart.some((e) => e.type === 'match_restart'));
  assert.equal(r.match.over, false);
  assert.equal(r.match.get('a').kills, 0);
});

test('desconexão no meio da partida não quebra tiros nem placar', () => {
  const r = mk();
  r.addPlayer('a', 'Ana', 0);
  r.addPlayer('b', 'Beto', 0);
  place(r, 'a', 0, 0); place(r, 'b', 0, -5);
  r.removePlayer('b');
  assert.doesNotThrow(() => r.handleShoot('a', { x: 0, y: 0, z: -1 }, 1));
  assert.doesNotThrow(() => r.tick(1, 2));
  assert.equal(r.snapshot().players.length, 1);
  assert.equal(r.snapshot().scoreboard.length, 1);
});

test('snapshot não vaza objetos internos e traz placar', () => {
  const r = mk();
  r.addPlayer('a', 'Ana', 0);
  const s = r.snapshot();
  assert.equal(s.players[0].hp, 100);
  assert.equal('health' in s.players[0], false);
  assert.equal(s.scoreboard[0].name, 'Ana');
  assert.doesNotThrow(() => JSON.stringify(s));
});
