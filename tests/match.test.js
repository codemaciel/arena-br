import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/game/Match.js';

function setup(opts) {
  const m = new Match(opts);
  m.addParticipant('p', 'Você', { isPlayer: true });
  m.addParticipant('b1', 'Zeca');
  m.addParticipant('b2', 'Bia');
  return m;
}

test('eliminação soma 100 pontos, headshot +50', () => {
  const m = setup();
  assert.deepEqual(m.registerKill('p', 'b1'), { points: 100, streak: 1 });
  m.registerKill('b1', 'p'); // quebra a sequência de b1, zera a do jogador
  assert.deepEqual(m.registerKill('p', 'b1', { headshot: true }), { points: 150, streak: 1 });
  assert.equal(m.get('p').kills, 2);
  assert.equal(m.get('p').score, 250);
});

test('bônus de sequência cresce e tem teto', () => {
  const m = setup();
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(m.registerKill('p', 'b1').points);
  assert.deepEqual(pts.slice(0, 3), [100, 125, 150]);
  assert.equal(Math.max(...pts), 200); // 100 + teto 100
  m.registerKill('b1', 'p');
  assert.equal(m.get('p').streak, 0);
  assert.equal(m.registerKill('p', 'b1').points, 100);
});

test('mortes são contadas e auto-eliminação é rejeitada', () => {
  const m = setup();
  m.registerKill('p', 'b1');
  assert.equal(m.get('b1').deaths, 1);
  assert.equal(m.registerKill('p', 'p'), null);
  assert.equal(m.registerKill('p', 'inexistente'), null);
});

test('partida termina ao atingir o limite de eliminações', () => {
  const m = setup({ killLimit: 3 });
  m.registerKill('p', 'b1'); m.registerKill('p', 'b1');
  assert.equal(m.over, false);
  m.registerKill('p', 'b2');
  assert.equal(m.over, true);
  assert.equal(m.endReason, 'killLimit');
  assert.equal(m.winnerId, 'p');
  assert.equal(m.registerKill('p', 'b1'), null); // depois do fim, nada conta
});

test('tempo esgotado: vence quem tem mais eliminações; empate = sem vencedor', () => {
  const m = setup({ timeLimit: 10 });
  m.registerKill('b1', 'p');
  m.tick(9);
  assert.equal(m.over, false);
  assert.equal(m.remainingTime, 1);
  m.tick(2);
  assert.equal(m.endReason, 'time');
  assert.equal(m.winnerId, 'b1');

  const t = setup({ timeLimit: 5 });
  t.tick(6);
  assert.equal(t.winnerId, null);
});

test('modo treino não tem limites e reset zera tudo', () => {
  const m = setup();
  m.tick(10000);
  assert.equal(m.over, false);
  assert.equal(m.remainingTime, null);
  m.registerKill('p', 'b1');
  m.reset();
  assert.equal(m.get('p').kills, 0);
  assert.equal(m.elapsed, 0);
});

test('ranking ordena por eliminações, pontos e mortes', () => {
  const m = setup();
  m.registerKill('b1', 'p');
  m.registerKill('b2', 'p');
  m.registerKill('b2', 'p');
  const r = m.getRanking();
  assert.deepEqual(r.map((x) => x.id), ['b2', 'b1', 'p']);
});
