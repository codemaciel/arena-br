import * as THREE from 'three';
import { ARENA } from '../map/arena.js';

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Texturas procedurais simples: nenhum arquivo externo é necessário.
const TEXTURES = {
  building: (ctx, s) => {
    ctx.fillStyle = '#2d3b57'; ctx.fillRect(0, 0, s, s);
    const n = 4; const c = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i * 7 + j * 3) % 5 === 0 ? '#f2c55c' : '#18213a';
      ctx.fillRect(i * c + c * 0.2, j * c + c * 0.2, c * 0.6, c * 0.6);
    }
  },
  crate: (ctx, s) => {
    ctx.fillStyle = '#b07a35'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#6b4519'; ctx.lineWidth = s * 0.08; ctx.strokeRect(0, 0, s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.stroke();
  },
  barrier: (ctx, s) => {
    ctx.fillStyle = '#16181f'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#f5c518';
    for (let i = -s; i < s * 2; i += s / 2) {
      ctx.beginPath(); ctx.moveTo(i, s); ctx.lineTo(i + s / 4, s); ctx.lineTo(i + s / 4 + s, 0); ctx.lineTo(i + s, 0); ctx.fill();
    }
  },
  platform: (ctx, s) => {
    ctx.fillStyle = '#7b8594'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#59616e'; ctx.lineWidth = 3; ctx.strokeRect(1, 1, s - 2, s - 2);
  },
  wall: (ctx, s) => {
    ctx.fillStyle = '#262e42'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#2f3951';
    for (let y = 0; y < s; y += s / 4) ctx.fillRect(0, y, s, 3);
  },
  ground: (ctx, s) => {
    ctx.fillStyle = '#2a303c'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.04)`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  },
};

// Tamanho (em metros) que cada tile de textura cobre.
const TILE = { building: 4, crate: 1.6, barrier: 2, platform: 4, wall: 4 };

/** Escala as UVs para que a textura mantenha tamanho constante no mundo. */
function boxGeometry(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x,-x,+y,-y,+z,-z
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/** Constrói a arena 3D a partir dos dados do mapa. */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.textures = [];
    this.materials = {};
    this.geometries = [];
    this.#build();
    scene.add(this.group);
  }

  #texture(key) {
    const t = canvasTexture(128, TEXTURES[key]);
    this.textures.push(t);
    return t;
  }

  #build() {
    for (const key of Object.keys(TILE)) {
      this.materials[key] = new THREE.MeshLambertMaterial({ map: this.#texture(key) });
    }

    // Luzes estilizadas (poucas e baratas). Intensidades altas porque o Three.js moderno usa unidades físicas.
    this.group.add(new THREE.HemisphereLight(0xaecbff, 0x20263a, 2.0));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(30, 50, 20);
    this.group.add(sun);

    // Chão
    const groundTex = this.#texture('ground');
    groundTex.repeat.set(84 / 8, 84 / 8);
    const groundGeo = new THREE.PlaneGeometry(84, 84);
    this.geometries.push(groundGeo);
    this.materials.ground = new THREE.MeshLambertMaterial({ map: groundTex });
    const ground = new THREE.Mesh(groundGeo, this.materials.ground);
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    // Obstáculos
    const neonA = new THREE.MeshBasicMaterial({ color: 0x19e3ff });
    const neonB = new THREE.MeshBasicMaterial({ color: 0xff3d81 });
    this.materials.neonA = neonA;
    this.materials.neonB = neonB;
    let n = 0;
    for (const b of ARENA.boxes) {
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const d = b.maxZ - b.minZ;
      const geo = boxGeometry(w, h, d, TILE[b.type] ?? 4);
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, this.materials[b.type] ?? this.materials.wall);
      mesh.position.set((b.minX + b.maxX) / 2, b.minY + h / 2, (b.minZ + b.maxZ) / 2);
      this.group.add(mesh);

      if (b.type === 'building') {
        const strip = new THREE.BoxGeometry(w + 0.12, 0.25, d + 0.12);
        this.geometries.push(strip);
        const neon = new THREE.Mesh(strip, n++ % 2 ? neonA : neonB);
        neon.position.set(mesh.position.x, b.maxY - 0.6, mesh.position.z);
        this.group.add(neon);
      }
    }

    this.#addRoadMarks();
  }

  #addRoadMarks() {
    const geo = new THREE.BoxGeometry(0.25, 0.02, 2);
    this.geometries.push(geo);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd9dde5 });
    this.materials.marks = mat;
    const spots = [];
    for (let z = -38; z <= 38; z += 4) if (Math.abs(z) > 6 && z > -27 && !(z > 15 && z < 27)) spots.push({ x: 0, z, rot: 0 });
    for (let x = -38; x <= 38; x += 4) if (Math.abs(x) > 6 && !(Math.abs(x) > 24 && Math.abs(x) < 32)) spots.push({ x, z: 0, rot: Math.PI / 2 });
    const marks = new THREE.InstancedMesh(geo, mat, spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach((s, i) => {
      dummy.position.set(s.x, 0.015, s.z);
      dummy.rotation.set(0, s.rot, 0);
      dummy.updateMatrix();
      marks.setMatrixAt(i, dummy.matrix);
    });
    marks.instanceMatrix.needsUpdate = true;
    this.group.add(marks);
    this.marks = marks;
  }

  dispose() {
    this.scene.remove(this.group);
    this.marks?.dispose();
    this.geometries.forEach((g) => g.dispose());
    Object.values(this.materials).forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.geometries.length = 0;
    this.textures.length = 0;
  }
}
