import { Game } from './core/Game.js';

try {
  const game = new Game(document.getElementById('game-root'));
  // Em desenvolvimento (HMR), libera recursos antes de recarregar o módulo.
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
} catch (err) {
  console.error(err);
  const msg = document.createElement('pre');
  msg.style.cssText = 'color:#ff5468;padding:24px;white-space:pre-wrap';
  msg.textContent = `Falha ao iniciar o ARENA BR:\n${err?.message ?? err}`;
  document.body.appendChild(msg);
}
