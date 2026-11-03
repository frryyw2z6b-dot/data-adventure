import * as THREE from 'three';
import { Tweens } from './tween.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
    this.baseFov = 42;
    this.minHFov = 54;

    this.tweens = new Tweens();
    this.updaters = new Set();
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.time = 0;

    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();

    renderer.setAnimationLoop((ts) => this.frame(ts));
  }

  /** يضبط زاوية الرؤية حتى تظهر منطقة اللعب كاملة على الشاشات العمودية (الجوال) */
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const needed = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.minHFov) / 2) / aspect));
    this.camera.fov = Math.min(Math.max(this.baseFov, needed), 85);
    this.camera.updateProjectionMatrix();
  }

  onUpdate(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  frame(ts) {
    this.timer.update(ts);
    const raw = this.timer.getDelta();
    // الحركات السينمائية تتبع الوقت الحقيقي حتى على الأجهزة البطيئة
    this.tweens.update(Math.min(raw, 0.25));
    const dt = Math.min(raw, 0.05);
    this.time += dt;
    this.frames = (this.frames || 0) + 1;
    for (const fn of this.updaters) fn(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }

  /** موضع نقطة ثلاثية الأبعاد على الشاشة بالبكسل */
  toScreen(vec3) {
    const v = vec3.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }
}
