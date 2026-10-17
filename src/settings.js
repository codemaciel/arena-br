import { DEFAULT_SETTINGS, DIFFICULTY, STORAGE_KEY } from './config.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Valida e normaliza configurações (nunca confia no que veio do localStorage). */
export function sanitizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    sensitivity: clamp(num(s.sensitivity, DEFAULT_SETTINGS.sensitivity), 0.1, 3),
    volume: clamp(num(s.volume, DEFAULT_SETTINGS.volume), 0, 1),
    fov: clamp(num(s.fov, DEFAULT_SETTINGS.fov), 60, 110),
    difficulty: Object.hasOwn(DIFFICULTY, s.difficulty) ? s.difficulty : DEFAULT_SETTINGS.difficulty,
  };
}

export function loadSettings() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return sanitizeSettings(null);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* armazenamento indisponível (modo privado): ignora */
  }
}
