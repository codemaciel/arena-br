import { createBox } from '../physics/Collision.js';

// Mapa "Arena Urbana": 80 x 80 m. Tudo é feito de caixas (AABB), usadas
// tanto para desenhar quanto para colisão (e também pelo servidor).
// box(tipo, x, z, largura, profundidade, altura, y)
const box = (type, x, z, w, d, h, y = 0) => createBox(x, y, z, w, h, d, { type });

const boxes = [
  // Muros do perímetro
  box('wall', 0, -40.5, 84, 2, 8),
  box('wall', 0, 40.5, 84, 2, 8),
  box('wall', -40.5, 0, 2, 80, 8),
  box('wall', 40.5, 0, 2, 80, 8),

  // Edifícios
  box('building', -20, -20, 14, 14, 10),
  box('building', 22, -22, 12, 12, 8),
  box('building', -22, 22, 12, 10, 12),
  box('building', 24, 24, 10, 14, 7),

  // Praça central elevada com degraus
  box('platform', 0, 0, 10, 10, 1.2),
  box('platform', 0, 5.6, 4, 1.2, 0.6),
  box('platform', 0, -5.6, 4, 1.2, 0.6),

  // Plataforma alta ao sul, com escada de caixas
  box('platform', 0, -32, 12, 6, 3.6),
  box('crate', 7.5, -32, 3, 3, 2.4),
  box('crate', 10.5, -32, 3, 3, 1.2),

  // Corredor ao norte
  box('wall', 0, 18, 22, 1, 4),
  box('wall', 0, 24, 22, 1, 4),

  // Barreiras (cobertura baixa)
  box('barrier', -10, 8, 4, 0.6, 1.3),
  box('barrier', 10, -8, 4, 0.6, 1.3),
  box('barrier', 8, 10, 0.6, 4, 1.3),
  box('barrier', -8, -10, 0.6, 4, 1.3),
  box('barrier', -28, 0, 6, 0.6, 1.3),
  box('barrier', 28, 0, 6, 0.6, 1.3),
  box('barrier', 0, -20, 6, 0.6, 1.3),

  // Caixas
  box('crate', -16, 8, 1.6, 1.6, 1.6),
  box('crate', -14.4, 8, 1.6, 1.6, 1.6),
  box('crate', -15.2, 8, 1.6, 1.6, 1.6, 1.6),
  box('crate', 14, -6, 1.6, 1.6, 1.6),
  box('crate', 15.6, -6, 1.6, 1.6, 1.6),
  box('crate', 30, 10, 1.6, 1.6, 1.6),
  box('crate', -30, 12, 1.6, 1.6, 1.6),
  box('crate', 12, 28, 1.6, 1.6, 1.6),
  box('crate', -8, 30, 1.6, 1.6, 1.6),
  box('crate', -6.4, 30, 1.6, 1.6, 1.6),
  box('crate', 34, -8, 1.6, 1.6, 1.6),
  box('crate', -34, -10, 1.6, 1.6, 1.6),
  box('crate', 20, -4, 1.6, 1.6, 1.6),
  box('crate', -20, 4, 1.6, 1.6, 1.6),
  box('crate', -6, -20, 1.6, 1.6, 1.6),
];

export const ARENA = {
  name: 'Arena Urbana',
  size: 80,
  bounds: { minX: -39.5, maxX: 39.5, minZ: -39.5, maxZ: 39.5 },
  boxes,
  spawns: [
    { x: -32, z: 0 }, { x: 32, z: 0 }, { x: 0, z: 34 }, { x: 0, z: -26 },
    { x: -34, z: -34 }, { x: 34, z: -34 }, { x: -34, z: 34 }, { x: 34, z: 34 },
    { x: -12, z: -4 }, { x: 14, z: 14 }, { x: 10, z: -14 }, { x: -10, z: 14 },
  ],
  waypoints: [
    { x: -32, z: 0 }, { x: 32, z: 0 }, { x: 0, z: 34 }, { x: -34, z: -34 },
    { x: 34, z: -34 }, { x: -34, z: 34 }, { x: 34, z: 34 }, { x: 0, z: 10 },
    { x: 0, z: -12 }, { x: -20, z: 0 }, { x: 20, z: 0 }, { x: 0, z: 21 },
    { x: -6, z: 12 }, { x: 6, z: -14 }, { x: -12, z: -4 }, { x: 14, z: 14 },
    { x: 10, z: -14 }, { x: -10, z: 14 }, { x: -30, z: -16 }, { x: 30, z: -10 },
  ],
};
