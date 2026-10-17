// Todas as constantes de jogo ficam aqui (separadas da lógica).

export const PLAYER = {
  radius: 0.4,
  height: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 7,
  runSpeed: 11,
  jumpSpeed: 8.5,
  gravity: 24,
  groundAccel: 70,
  airAccel: 18,
  maxHealth: 100,
  regenDelay: 5,
  regenRate: 12,
  respawnDelay: 3,
};

export const WEAPON = {
  name: 'Fuzil ARENA',
  damage: 22,
  headshotMultiplier: 2,
  magazineSize: 30,
  reserveAmmo: Infinity, // munição reserva ilimitada (estilo arcade)
  fireInterval: 0.1, // 600 disparos/min
  reloadTime: 1.6,
  range: 150,
  falloffStart: 25,
  falloffEnd: 80,
  minDamageMultiplier: 0.55,
  spreadBase: 0.004, // radianos
  spreadMoving: 0.014,
  spreadAir: 0.03,
  spreadPerShot: 0.0035,
  spreadMax: 0.05,
  spreadRecovery: 0.02, // rad/s (menor que o ganho em tiro contínuo: 0.035 rad/s)
  recoilPitch: 0.005,
};

export const BOT = {
  radius: 0.4,
  height: 1.8,
  eyeHeight: 1.5,
  jumpSpeed: 8.5,
  gravity: 24,
  attackRange: 24,
  respawnDelay: 4,
  headshotMultiplier: 1.5,
};

// Dificuldades dos bots (chaves usadas nas configurações salvas).
export const DIFFICULTY = {
  facil: { label: 'Fácil', botCount: 4, hp: 80, speed: 4.5, reaction: 0.9, spread: 0.06, damage: 8, fireInterval: 0.5, viewRange: 35 },
  normal: { label: 'Normal', botCount: 6, hp: 100, speed: 5.5, reaction: 0.55, spread: 0.035, damage: 10, fireInterval: 0.32, viewRange: 45 },
  dificil: { label: 'Difícil', botCount: 8, hp: 100, speed: 6.5, reaction: 0.3, spread: 0.018, damage: 12, fireInterval: 0.22, viewRange: 60 },
};

export const MODES = {
  jogar: { label: 'PARTIDA', killLimit: 20, timeLimit: 300, passive: false },
  treino: { label: 'TREINAMENTO', killLimit: null, timeLimit: null, passive: true, botCount: 5 },
};

export const SCORING = {
  kill: 100,
  headshotBonus: 50,
  streakBonus: 25,
  streakBonusMax: 100,
};

export const GRAPHICS = {
  maxPixelRatio: 2,
  fogNear: 45,
  fogFar: 130,
};

export const DEFAULT_SETTINGS = {
  sensitivity: 1,
  volume: 0.6,
  fov: 80,
  difficulty: 'normal',
};

export const STORAGE_KEY = 'arena-br:settings:v1';

export const NETWORK = {
  port: 3001,
  tickRate: 30,
  snapshotRate: 20,
  maxPlayers: 8,
  killLimit: 20,
  timeLimit: 300,
  moveRate: { perSecond: 40, burst: 60 },
  shootRate: { perSecond: 15, burst: 20 },
  reloadRate: { perSecond: 2, burst: 3 },
};

export const BOT_NAMES = ['Zeca', 'Bia', 'Tião', 'Duda', 'Neto', 'Lia', 'Caco', 'Vivi'];
