import { BotManager } from '../ai/BotManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { BOT, DIFFICULTY, MODES, PLAYER, WEAPON } from '../config.js';
import { Health } from '../game/Damage.js';
import { Match } from '../game/Match.js';
import { pickSpawn } from '../game/spawn.js';
import { ARENA } from '../map/arena.js';
import { resolveShot } from '../physics/Hitbox.js';
import { PlayerController } from '../player/PlayerController.js';
import { BotViewFactory } from '../render/BotView.js';
import { Effects } from '../render/Effects.js';
import { GameRenderer } from '../render/Renderer.js';
import { World } from '../render/World.js';
import { loadSettings, sanitizeSettings, saveSettings } from '../settings.js';
import { UI } from '../ui/UI.js';
import { ViewModel } from '../weapons/ViewModel.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';

const yawToward = (x, z) => Math.atan2(x, z); // olhar do ponto (x,z) para a origem

/** Orquestra o jogo: estados, laço principal, partida, jogador, bots, UI e áudio. */
export class Game {
  constructor(container) {
    this.container = container;
    this.settings = loadSettings();
    this.state = 'menu'; // menu | playing | paused | ended
    this.mode = 'jogar';
    this.modeCfg = MODES.jogar;
    this.pendingResume = false;
    this.respawnTimer = 0;
    this.scoreboardHeld = false;
    this.scoreboardTimer = 0;
    this.reloadingPrev = false;
    this.disposed = false;
    this.match = new Match();
    this.botViews = new Map();
    this.health = new Health(PLAYER.maxHealth);
    this.audio = new AudioManager(this.settings.volume);

    this.ui = new UI({
      onPlay: (mode) => this.startMatch(mode),
      onResume: () => this.resume(),
      onRestart: () => this.startMatch(this.mode),
      onQuit: () => this.quitToMenu(),
      onSettingsChange: (patch) => this.applySettings(patch),
    }, this.settings);

    try {
      this.#initScene();
    } catch (err) {
      console.error(err);
      this.ui.showError('Não foi possível iniciar o WebGL. Ative a aceleração de hardware do navegador, atualize o driver de vídeo ou tente outro navegador (Chrome, Edge ou Firefox).');
      return;
    }
    this.#bindEvents();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this._frame);
  }

  #initScene() {
    this.gfx = new GameRenderer(this.container, this.settings.fov);
    this.world = new World(this.gfx.scene);
    this.effects = new Effects(this.gfx.scene);
    this.viewModel = new ViewModel(this.gfx.camera);
    this.viewModel.setVisible(false);
    this.player = new PlayerController(this.gfx.canvas, this.gfx.camera, ARENA, this.settings);
    this.weapons = new WeaponSystem(WEAPON);
    this.botFactory = new BotViewFactory(this.gfx.scene);
    this.bots = new BotManager(ARENA);
  }

  #bindEvents() {
    this._onLockChange = () => {
      const locked = document.pointerLockElement === this.gfx.canvas;
      if (locked && this.pendingResume) {
        this.pendingResume = false;
        this.state = 'playing';
        this.ui.hideScreens();
        this.lastTime = performance.now();
      } else if (!locked && this.state === 'playing') {
        this.pause('Mouse liberado.');
      }
    };
    this._onLockError = () => {
      if (this.pendingResume) {
        this.pendingResume = false;
        this.ui.setPauseMessage('Não foi possível capturar o mouse. Aguarde um instante e clique em CONTINUAR.');
      } else if (this.state === 'playing') {
        this.ui.toast('CLIQUE NA TELA PARA CAPTURAR O MOUSE', 2500);
      }
    };
    this._onCanvasClick = () => {
      if (this.state === 'playing' && document.pointerLockElement !== this.gfx.canvas) this.#requestLock();
    };
    this._onVisibility = () => {
      if (document.hidden && this.state === 'playing') this.pause('Jogo pausado ao sair da aba.');
    };
    this._onKeyDown = (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.state === 'playing' && !this.scoreboardHeld) {
          this.scoreboardHeld = true;
          this.scoreboardTimer = 0;
          this.ui.setScoreboard(true, this.match.getRanking());
        }
      }
    };
    this._onKeyUp = (e) => {
      if (e.code === 'Tab') {
        this.scoreboardHeld = false;
        this.ui.setScoreboard(false);
      }
    };
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('pointerlockerror', this._onLockError);
    document.addEventListener('visibilitychange', this._onVisibility);
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    this.gfx.canvas.addEventListener('click', this._onCanvasClick);
  }

  #requestLock() {
    try {
      const result = this.gfx.canvas.requestPointerLock();
      result?.catch?.(() => {});
    } catch {
      /* tratado por pointerlockerror */
    }
  }

  // ---------- configurações ----------
  applySettings(patch) {
    const next = sanitizeSettings({ ...this.settings, ...patch });
    Object.assign(this.settings, next); // mesmo objeto: o controle do jogador enxerga a mudança
    saveSettings(this.settings);
    this.audio.setVolume(next.volume);
    this.gfx?.setFov(next.fov);
  }

  // ---------- ciclo de vida da partida ----------
  startMatch(mode) {
    if (!this.gfx || this.disposed) return;
    this.audio.init();
    this.mode = mode;
    this.modeCfg = MODES[mode];
    const diff = DIFFICULTY[this.settings.difficulty];
    const count = this.modeCfg.botCount ?? diff.botCount;

    this.match = new Match({ killLimit: this.modeCfg.killLimit, timeLimit: this.modeCfg.timeLimit });
    this.match.addParticipant('player', 'Você', { isPlayer: true });

    this.#clearBotViews();
    const spawn = pickSpawn(ARENA.spawns, []);
    const bots = this.bots.reset(count, diff, [spawn]);
    bots.forEach((bot, i) => {
      this.match.addParticipant(bot.id, bot.name);
      this.botViews.set(bot.id, this.botFactory.create(bot, i / count));
    });

    this.health.reset(PLAYER.maxHealth);
    this.weapons.weapon.reset();
    this.player.spawn(spawn.x, spawn.z);
    this.player.yaw = yawToward(spawn.x, spawn.z);
    this.player.syncCamera();
    this.player.enable();
    this.reloadingPrev = false;
    this.respawnTimer = 0;
    this.pendingResume = false;

    this.state = 'playing';
    this.lastTime = performance.now();
    this.ui.hideScreens();
    this.ui.clearFeed();
    this.ui.setScoreboard(false);
    this.ui.showHud(true);
    this.viewModel.setVisible(true);
    this.ui.toast(mode === 'jogar' ? `PRIMEIRO A ${this.modeCfg.killLimit} ELIMINAÇÕES` : 'TREINAMENTO — OS ALVOS NÃO ATIRAM', 2400);
    this.#requestLock();
  }

  pause(message = '') {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.player.releaseInputs();
    this.scoreboardHeld = false;
    this.ui.setScoreboard(false);
    this.ui.setPauseMessage(message);
    this.ui.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.init();
    this.pendingResume = true;
    this.ui.setPauseMessage('');
    this.#requestLock();
  }

  quitToMenu() {
    this.state = 'menu';
    this.pendingResume = false;
    document.exitPointerLock?.();
    this.player?.disable();
    this.#clearBotViews();
    this.viewModel?.setVisible(false);
    this.ui.showHud(false);
    this.ui.showScreen('menu');
  }

  #endMatch() {
    this.state = 'ended';
    document.exitPointerLock?.();
    this.player.releaseInputs();
    const winner = this.match.winnerId;
    const outcome = winner === null ? 'empate' : winner === 'player' ? 'vitoria' : 'derrota';
    if (outcome === 'vitoria') this.audio.win(); else if (outcome === 'derrota') this.audio.lose();
    this.viewModel.setVisible(false);
    this.ui.showEnd({ outcome, reason: this.match.endReason, ranking: this.match.getRanking() });
  }

  #clearBotViews() {
    for (const view of this.botViews.values()) view.dispose();
    this.botViews.clear();
  }

  // ---------- laço principal ----------
  _frame = (now) => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this._frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    try {
      if (this.state === 'playing') this.#update(dt);
      else if (this.state === 'menu' || this.state === 'ended') this.#idleCamera(now);
      this.effects.update(dt);
      const viewDt = this.state === 'playing' ? dt : 0;
      for (const bot of this.bots.bots) this.botViews.get(bot.id)?.sync(bot, viewDt);
      if (this.state === 'playing' || this.state === 'paused') this.viewModel.update(viewDt, this.player.speed);
      this.gfx.render();
    } catch (err) {
      this.#fatal(err);
    }
  };

  #fatal(err) {
    console.error(err);
    cancelAnimationFrame(this.rafId);
    document.exitPointerLock?.();
    this.ui.showError(`Ocorreu um erro inesperado: ${err?.message ?? err}. Recarregue a página.`);
  }

  #idleCamera(now) {
    const t = now / 1000 * 0.07;
    this.gfx.camera.position.set(Math.cos(t) * 34, 15, Math.sin(t) * 34);
    this.gfx.camera.lookAt(0, 2, 0);
  }

  #update(dt) {
    const p = this.player;
    this.match.tick(dt);
    if (this.match.over) {
      this.#endMatch();
      return;
    }

    if (p.alive) {
      p.update(dt);
      this.weapons.update(dt);
      this.health.update(dt, PLAYER.regenDelay, PLAYER.regenRate);
      if (p.consumeReload()) this.weapons.weapon.startReload();
      if (p.firing) this.#playerShoot();
      const reloading = this.weapons.weapon.reloading;
      if (reloading && !this.reloadingPrev) this.audio.reload();
      this.reloadingPrev = reloading;
      this.viewModel.setReloading(reloading);
    } else {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.#respawnPlayer();
    }

    const target = { id: 'player', x: p.x, y: p.y, z: p.z, alive: p.alive };
    const ctx = { passive: this.modeCfg.passive, botsAttack: !this.modeCfg.passive };
    for (const shot of this.bots.update(dt, target, ctx)) this.#botShoot(shot);

    this.#refreshHud();
  }

  #playerShoot() {
    const p = this.player;
    const res = this.weapons.shoot({
      origin: p.eye,
      direction: p.getForward(),
      moving: p.moving,
      airborne: p.airborne,
      boxes: ARENA.boxes,
      targets: this.bots.bots,
      ignoreId: 'player',
    });
    if (!res) return;

    this.audio.shoot();
    this.viewModel.kick();
    p.addRecoil(WEAPON.recoilPitch);
    const muzzle = this.viewModel.getMuzzleWorld();
    this.effects.muzzleFlash(muzzle);
    this.effects.tracer(muzzle, res.point);

    if (res.type === 'world') {
      this.effects.impact(res.point);
    } else if (res.type === 'target') {
      const bot = res.target;
      const headshot = res.zone === 'head';
      this.effects.impact(res.point, 4);
      const r = bot.takeDamage(res.damage, p);
      this.ui.hitMarker(headshot);
      this.audio.hit(headshot);
      this.botViews.get(bot.id)?.flash();
      if (r.died) {
        const k = this.match.registerKill('player', bot.id, { headshot });
        this.audio.kill();
        this.ui.addKillFeed(`Você eliminou ${bot.name}${headshot ? ' (cabeça)' : ''}${k ? ` +${k.points}` : ''}`, 'you');
      }
    }
  }

  #botShoot(shot) {
    const p = this.player;
    const res = resolveShot(shot.origin, shot.dir, 120, ARENA.boxes, p.alive ? [p] : [], shot.bot.id);
    this.effects.tracer(shot.origin, res.point, 0xff7a4d);
    this.audio.enemyShoot(Math.hypot(shot.origin.x - p.x, shot.origin.z - p.z));
    if (res.type === 'world') {
      this.effects.impact(res.point, 3);
    } else if (res.type === 'target' && p.alive) {
      const headshot = res.zone === 'head';
      const dmg = Math.round(shot.damage * (headshot ? BOT.headshotMultiplier : 1));
      const r = this.health.damage(dmg);
      this.ui.damageFlash();
      this.audio.hurt();
      if (r.died) this.#playerDied(shot.bot, headshot);
    }
  }

  #playerDied(bot, headshot) {
    const p = this.player;
    p.alive = false;
    p.releaseInputs();
    this.respawnTimer = PLAYER.respawnDelay;
    this.match.registerKill(bot.id, 'player', { headshot });
    this.ui.addKillFeed(`${bot.name} eliminou você`, 'die');
    this.ui.toast(`ELIMINADO POR ${bot.name.toUpperCase()}`, 2600);
    this.viewModel.setVisible(false);
    this.gfx.camera.position.y = p.y + 0.4; // câmera "cai" ao morrer
    this.scoreboardHeld = false;
    this.ui.setScoreboard(false);
  }

  #respawnPlayer() {
    const p = this.player;
    const avoid = this.bots.bots.filter((b) => b.alive);
    const s = pickSpawn(ARENA.spawns, avoid);
    p.spawn(s.x, s.z);
    p.yaw = yawToward(s.x, s.z);
    p.syncCamera();
    this.health.reset(PLAYER.maxHealth);
    this.weapons.weapon.reset();
    this.viewModel.setVisible(true);
    this.audio.respawn();
  }

  #refreshHud() {
    const me = this.match.get('player');
    const w = this.weapons.weapon;
    this.ui.updateHud({
      time: this.match.remainingTime,
      score: me.score,
      kills: me.kills,
      deaths: me.deaths,
      mode: this.modeCfg.label,
      hp: this.health.current,
      maxHp: this.health.max,
      ammo: w.ammo,
      reserve: w.reserve,
      reloading: w.reloading,
    });
    if (this.scoreboardHeld) {
      this.scoreboardTimer -= 1 / 60;
      if (this.scoreboardTimer <= 0) {
        this.scoreboardTimer = 0.25;
        this.ui.setScoreboard(true, this.match.getRanking());
      }
    }
  }

  // ---------- limpeza ----------
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('pointerlockerror', this._onLockError);
    document.removeEventListener('visibilitychange', this._onVisibility);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this.gfx?.canvas.removeEventListener('click', this._onCanvasClick);
    this.player?.disable();
    this.#clearBotViews();
    this.botFactory?.dispose();
    this.viewModel?.dispose();
    this.effects?.dispose();
    this.world?.dispose();
    this.audio.dispose();
    this.gfx?.dispose();
  }
}
