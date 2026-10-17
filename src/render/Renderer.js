import * as THREE from 'three';
import { GRAPHICS } from '../config.js';

/** Encapsula WebGLRenderer, cena e câmera. */
export class GameRenderer {
  constructor(container, fov = 80) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, GRAPHICS.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f1830');
    this.scene.fog = new THREE.Fog('#0f1830', GRAPHICS.fogNear, GRAPHICS.fogFar);

    this.camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.05, 250);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera); // necessário para a arma (filha da câmera) ser desenhada

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  get canvas() {
    return this.renderer.domElement;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setFov(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
