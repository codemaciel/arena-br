import { PLAYER } from '../config.js';
import { moveBody } from '../physics/Collision.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX_PITCH = (89 * Math.PI) / 180;

/** Controles em primeira pessoa: teclado, mouse (Pointer Lock) e física do jogador. */
export class PlayerController {
  constructor(element, camera, arena, settings) {
    this.element = element;
    this.camera = camera;
    this.arena = arena;
    this.settings = settings; // objeto compartilhado: mudanças valem na hora
    this.id = 'player';
    this.alive = true;
    this.body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, radius: PLAYER.radius, height: PLAYER.height, onGround: true };
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.mouseDown = false;
    this.reloadRequested = false;
    this.frozen = false;
    this.enabled = false;

    this._keydown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.reloadRequested = true;
    };
    this._keyup = (e) => this.keys.delete(e.code);
    this._mousemove = (e) => {
      if (document.pointerLockElement !== this.element || this.frozen) return;
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return; // salto espúrio de alguns navegadores
      const k = 0.0022 * this.settings.sensitivity;
      this.yaw -= e.movementX * k;
      this.pitch = clamp(this.pitch - e.movementY * k, -MAX_PITCH, MAX_PITCH);
    };
    this._mousedown = (e) => { if (e.button === 0) this.mouseDown = true; };
    this._mouseup = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._blur = () => this.releaseInputs();
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    document.addEventListener('keydown', this._keydown);
    document.addEventListener('keyup', this._keyup);
    document.addEventListener('mousemove', this._mousemove);
    document.addEventListener('mousedown', this._mousedown);
    document.addEventListener('mouseup', this._mouseup);
    window.addEventListener('blur', this._blur);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    document.removeEventListener('keydown', this._keydown);
    document.removeEventListener('keyup', this._keyup);
    document.removeEventListener('mousemove', this._mousemove);
    document.removeEventListener('mousedown', this._mousedown);
    document.removeEventListener('mouseup', this._mouseup);
    window.removeEventListener('blur', this._blur);
    this.releaseInputs();
  }

  releaseInputs() {
    this.keys.clear();
    this.mouseDown = false;
    this.reloadRequested = false;
  }

  spawn(x, z) {
    Object.assign(this.body, { x, y: 0, z, vx: 0, vy: 0, vz: 0, onGround: true });
    this.alive = true;
    this.frozen = false;
    this.pitch = 0;
    this.syncCamera();
  }

  get x() { return this.body.x; }
  get y() { return this.body.y; }
  get z() { return this.body.z; }
  get eye() { return { x: this.body.x, y: this.body.y + PLAYER.eyeHeight, z: this.body.z }; }
  get speed() { return Math.hypot(this.body.vx, this.body.vz); }
  get moving() { return this.speed > 0.5; }
  get airborne() { return !this.body.onGround; }
  get firing() { return this.mouseDown && document.pointerLockElement === this.element && this.alive && !this.frozen; }

  consumeReload() {
    const r = this.reloadRequested;
    this.reloadRequested = false;
    return r;
  }

  getForward() {
    const cp = Math.cos(this.pitch);
    return { x: -Math.sin(this.yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cp };
  }

  addRecoil(amount) {
    this.pitch = clamp(this.pitch + amount, -MAX_PITCH, MAX_PITCH);
  }

  update(dt) {
    const b = this.body;
    const active = document.pointerLockElement === this.element && !this.frozen && this.alive;
    let fwd = active ? (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) : 0;
    let side = active ? (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) : 0;
    const len = Math.hypot(fwd, side);
    if (len > 0) { fwd /= len; side /= len; }

    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    const wx = -sy * fwd + cy * side;
    const wz = -cy * fwd - sy * side;
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const step = (b.onGround ? PLAYER.groundAccel : PLAYER.airAccel) * dt;
    b.vx += clamp(wx * speed - b.vx, -step, step);
    b.vz += clamp(wz * speed - b.vz, -step, step);

    if (active && this.keys.has('Space') && b.onGround) b.vy = PLAYER.jumpSpeed;
    b.vy -= PLAYER.gravity * dt;
    moveBody(b, dt, this.arena.boxes, this.arena.bounds);
    if (b.y < -20) this.spawn(0, 10);
    this.syncCamera();
  }

  syncCamera() {
    const b = this.body;
    this.camera.position.set(b.x, b.y + PLAYER.eyeHeight, b.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
