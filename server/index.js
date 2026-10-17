// Servidor multiplayer (etapa 2). Uso: npm run server
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { NETWORK } from '../src/config.js';
import { GameRoom } from './GameRoom.js';
import { RateLimiter } from './RateLimiter.js';

const PORT = Number(process.env.PORT) || NETWORK.port;
const ORIGIN = process.env.CORS_ORIGIN || '*'; // em produção, defina o domínio do seu site
const nowSec = () => Date.now() / 1000;

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, { cors: { origin: ORIGIN }, maxHttpBufferSize: 1e4 });
const rooms = new Map();

const cleanRoomId = (v) => String(v ?? 'geral').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'geral';

function emitEvents(room, events) {
  for (const e of events) io.to(room.id).emit(`game:${e.type}`, e);
}

io.on('connection', (socket) => {
  let room = null;
  const limits = {
    move: new RateLimiter(NETWORK.moveRate.perSecond, NETWORK.moveRate.burst),
    shoot: new RateLimiter(NETWORK.shootRate.perSecond, NETWORK.shootRate.burst),
    reload: new RateLimiter(NETWORK.reloadRate.perSecond, NETWORK.reloadRate.burst),
    join: new RateLimiter(0.5, 3),
  };

  socket.on('join', (payload, ack) => {
    if (room || !limits.join.allow()) return;
    const id = cleanRoomId(payload?.room);
    let target = rooms.get(id);
    if (!target) {
      target = new GameRoom(id);
      rooms.set(id, target);
    }
    const player = target.addPlayer(socket.id, payload?.name, nowSec());
    if (!player) {
      ack?.({ ok: false, error: 'Sala cheia.' });
      return;
    }
    room = target;
    socket.join(room.id);
    ack?.({ ok: true, id: socket.id, room: room.id, snapshot: room.snapshot() });
    socket.to(room.id).emit('game:player_joined', { id: socket.id, name: player.name });
  });

  socket.on('move', (m) => {
    if (!room || !limits.move.allow()) return;
    const r = room.handleMove(socket.id, m, nowSec());
    if (!r.accepted && r.correction) socket.emit('game:correction', r.correction);
  });

  socket.on('shoot', (dir) => {
    if (!room || !limits.shoot.allow()) return;
    emitEvents(room, room.handleShoot(socket.id, dir, nowSec()).events);
  });

  socket.on('reload', () => {
    if (!room || !limits.reload.allow()) return;
    room.handleReload(socket.id, nowSec());
  });

  socket.on('disconnect', () => {
    if (!room) return;
    room.removePlayer(socket.id);
    io.to(room.id).emit('game:player_left', { id: socket.id });
    if (room.isEmpty) rooms.delete(room.id);
    room = null;
  });
});

let lastTick = nowSec();
const tickTimer = setInterval(() => {
  const t = nowSec();
  const dt = Math.min(0.2, t - lastTick);
  lastTick = t;
  for (const r of rooms.values()) emitEvents(r, r.tick(dt, t));
}, 1000 / NETWORK.tickRate);

const snapshotTimer = setInterval(() => {
  for (const r of rooms.values()) io.to(r.id).emit('game:snapshot', r.snapshot());
}, 1000 / NETWORK.snapshotRate);

httpServer.listen(PORT, () => console.log(`[ARENA BR] servidor multiplayer na porta ${PORT}`));

function shutdown() {
  clearInterval(tickTimer);
  clearInterval(snapshotTimer);
  io.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
