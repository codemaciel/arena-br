import './styles.css';

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado no HTML.`);
  return el;
};

const fmtTime = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function fillBoard(tbody, ranking) {
  tbody.replaceChildren(
    ...ranking.map((p, i) => {
      const tr = document.createElement('tr');
      if (p.isPlayer) tr.className = 'me';
      for (const v of [i + 1, p.name, p.kills, p.deaths, p.score]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      }
      return tr;
    }),
  );
}

/** Menus, HUD e telas. Só mexe no DOM; a lógica fica no Game. */
export class UI {
  constructor(handlers, settings) {
    this.h = handlers;
    this.settings = settings;
    this.screens = {
      menu: $('screen-menu'), settings: $('screen-settings'), pause: $('screen-pause'),
      end: $('screen-end'), error: $('screen-error'),
    };
    this.hud = $('hud');
    this.current = 'menu';
    this.settingsReturn = 'menu';
    this.last = {};
    this.timers = {};

    this.el = {
      time: $('hud-time'), score: $('hud-score'), stats: $('hud-stats'), mode: $('hud-mode'),
      hpBar: $('hud-hp-bar'), hpText: $('hud-hp-text'), ammo: $('hud-ammo'), reserve: $('hud-reserve'),
      reload: $('hud-reload'), killfeed: $('killfeed'), hit: $('hitmarker'), flash: $('damage-flash'),
      toast: $('toast'), scoreboard: $('scoreboard'), sbBody: $('sb-body'),
    };

    $('btn-play').onclick = () => this.h.onPlay('jogar');
    $('btn-training').onclick = () => this.h.onPlay('treino');
    $('btn-settings').onclick = () => this.openSettings('menu');
    $('btn-pause-settings').onclick = () => this.openSettings('pause');
    $('btn-settings-back').onclick = () => this.showScreen(this.settingsReturn);
    $('btn-resume').onclick = () => this.h.onResume();
    $('btn-restart').onclick = () => this.h.onRestart();
    $('btn-quit').onclick = () => this.h.onQuit();
    $('btn-again').onclick = () => this.h.onRestart();
    $('btn-end-menu').onclick = () => this.h.onQuit();

    document.querySelectorAll('#menu-difficulty button').forEach((btn) => {
      btn.onclick = () => this.#change({ difficulty: btn.dataset.diff });
    });
    $('set-sens').oninput = (e) => this.#change({ sensitivity: Number(e.target.value) });
    $('set-vol').oninput = (e) => this.#change({ volume: Number(e.target.value) / 100 });
    $('set-fov').oninput = (e) => this.#change({ fov: Number(e.target.value) });
    $('set-diff').onchange = (e) => this.#change({ difficulty: e.target.value });
    this.refreshSettings();
  }

  #change(patch) {
    this.h.onSettingsChange(patch);
    this.refreshSettings();
  }

  refreshSettings() {
    const s = this.settings;
    $('set-sens').value = s.sensitivity;
    $('set-sens-val').textContent = s.sensitivity.toFixed(2);
    $('set-vol').value = Math.round(s.volume * 100);
    $('set-vol-val').textContent = `${Math.round(s.volume * 100)}%`;
    $('set-fov').value = s.fov;
    $('set-fov-val').textContent = `${s.fov}°`;
    $('set-diff').value = s.difficulty;
    document.querySelectorAll('#menu-difficulty button').forEach((b) => b.classList.toggle('active', b.dataset.diff === s.difficulty));
  }

  openSettings(from) {
    this.settingsReturn = from;
    this.showScreen('settings');
  }

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) el.classList.toggle('hidden', key !== name);
    this.current = name;
  }

  hideScreens() {
    Object.values(this.screens).forEach((el) => el.classList.add('hidden'));
    this.current = null;
  }

  showHud(visible) {
    this.hud.classList.toggle('hidden', !visible);
    if (!visible) this.setScoreboard(false);
  }

  setPauseMessage(text) {
    $('pause-msg').textContent = text;
  }

  showError(text) {
    $('error-text').textContent = text;
    this.hud.classList.add('hidden');
    this.showScreen('error');
  }

  /** Atualiza o HUD só quando o valor muda (evita trabalho inútil no DOM). */
  updateHud(d) {
    const set = (key, el, text) => {
      if (this.last[key] !== text) { this.last[key] = text; el.textContent = text; }
    };
    set('time', this.el.time, d.time === null ? '∞' : fmtTime(d.time));
    set('score', this.el.score, `PONTOS ${d.score}`);
    set('stats', this.el.stats, `ELIMINAÇÕES ${d.kills} · MORTES ${d.deaths}`);
    set('mode', this.el.mode, d.mode);
    set('hp', this.el.hpText, String(Math.ceil(d.hp)));
    set('ammo', this.el.ammo, String(d.ammo));
    set('reserve', this.el.reserve, Number.isFinite(d.reserve) ? String(d.reserve) : '∞');
    const pct = Math.max(0, Math.min(100, (d.hp / d.maxHp) * 100));
    if (this.last.hpPct !== Math.round(pct)) {
      this.last.hpPct = Math.round(pct);
      this.el.hpBar.style.width = `${pct}%`;
      this.el.hpBar.style.background = pct > 60 ? 'var(--good)' : pct > 30 ? '#ffb020' : 'var(--bad)';
    }
    if (this.last.reloading !== d.reloading) {
      this.last.reloading = d.reloading;
      this.el.reload.classList.toggle('show', d.reloading);
    }
  }

  #pulse(el, cls, ms) {
    clearTimeout(this.timers[cls + el.id]);
    el.classList.add(cls);
    this.timers[cls + el.id] = setTimeout(() => el.classList.remove(cls), ms);
  }

  hitMarker(headshot) {
    this.el.hit.classList.toggle('head', !!headshot);
    this.#pulse(this.el.hit, 'show', 120);
  }

  damageFlash() {
    this.#pulse(this.el.flash, 'show', 120);
  }

  toast(text, ms = 1800) {
    this.el.toast.textContent = text;
    clearTimeout(this.timers.toast);
    this.el.toast.classList.add('show');
    this.timers.toast = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }

  addKillFeed(text, kind) {
    const div = document.createElement('div');
    div.textContent = text;
    div.className = kind;
    this.el.killfeed.prepend(div);
    while (this.el.killfeed.children.length > 5) this.el.killfeed.lastChild.remove();
    setTimeout(() => div.remove(), 5000);
  }

  clearFeed() {
    this.el.killfeed.replaceChildren();
  }

  setScoreboard(visible, ranking = null) {
    this.el.scoreboard.classList.toggle('hidden', !visible);
    if (visible && ranking) fillBoard(this.el.sbBody, ranking);
  }

  showEnd({ outcome, reason, ranking }) {
    const titles = { vitoria: 'VITÓRIA!', derrota: 'DERROTA', empate: 'EMPATE' };
    $('end-title').textContent = titles[outcome] ?? 'FIM DE PARTIDA';
    $('end-subtitle').textContent = reason === 'killLimit' ? 'Limite de eliminações atingido.' : 'Tempo esgotado.';
    fillBoard($('end-board'), ranking);
    this.showHud(false);
    this.showScreen('end');
  }
}
