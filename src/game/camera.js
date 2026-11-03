// مخرج الكاميرا: لقطات سينمائية للعنوان والخريطة والمراحل
import * as THREE from 'three';
import { ease } from './tween.js';

export const PLAY_POS = new THREE.Vector3(0, 7.4, 7.9);
export const PLAY_LOOK = new THREE.Vector3(0, 0, -0.55);
// لقطات اللعب: السجادة وحدها، أو اللوح مع السجادة
export const FRAMES = {
  rug: { pos: PLAY_POS, look: PLAY_LOOK },
  board: { pos: new THREE.Vector3(0, 4.2, 8.2), look: new THREE.Vector3(0, 1.75, -1.5) },
  // الشاشات القصيرة (جوال أفقي): من أعلى قليلًا حتى يظهر اللوح وصفوف السجادة معًا
  boardShort: { pos: new THREE.Vector3(0, 7.2, 7.6), look: new THREE.Vector3(0, 0.55, -0.4) },
};
const isShort = () => window.innerHeight < 520;

export function createDirector(engine) {
  const cam = engine.camera;
  const look = new THREE.Vector3(0, 2, -4);
  let mode = 'orbit';
  let modeT = 0;
  let frame = FRAMES.rug;
  let frameName = 'rug';

  cam.position.set(18, 7, 16);
  cam.lookAt(look);

  engine.onUpdate((dt, t) => {
    modeT += dt;
    if (mode === 'orbit') {
      const a = 0.55 + t * 0.045;
      cam.position.set(Math.sin(a) * 21, 6.5 + Math.sin(t * 0.2) * 0.8, Math.cos(a) * 19 - 3);
      look.set(0, 2.3, -4);
    } else if (mode === 'aerial') {
      cam.position.set(Math.sin(t * 0.05) * 6, 30, 34 + Math.cos(t * 0.06) * 2);
      look.set(0, 0, -8);
    } else if (mode === 'play') {
      // تنفّس خفيف للكاميرا يجعل المشهد حيًّا
      cam.position.set(frame.pos.x + Math.sin(t * 0.35) * 0.08, frame.pos.y + Math.sin(t * 0.5) * 0.05, frame.pos.z);
      look.copy(frame.look);
    }
    if (mode !== 'manual') cam.lookAt(look);
  });

  async function flyTo(pos, target, duration = 2, easing = ease.inOutCubic) {
    mode = 'manual';
    const p0 = cam.position.clone();
    const l0 = look.clone();
    await engine.tweens.run(
      duration,
      (k) => {
        cam.position.lerpVectors(p0, pos, k);
        look.lerpVectors(l0, target, k);
        cam.lookAt(look);
      },
      easing,
    );
  }

  /** لقطة دخول المرحلة: من فوق الكثبان إلى السجادة */
  async function stageIntro(duration = 5.5) {
    mode = 'manual';
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-46, 26, 64),
      new THREE.Vector3(-22, 12, 30),
      new THREE.Vector3(-4, 5.5, 17),
      new THREE.Vector3(3.5, 6.5, 11),
      PLAY_POS.clone(),
    ]);
    const lookPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 6, -14),
      new THREE.Vector3(0, 3, -10),
      new THREE.Vector3(0, 1.5, -4),
      PLAY_LOOK.clone(),
    ]);
    await engine.tweens.run(
      duration,
      (k) => {
        cam.position.copy(path.getPoint(k));
        look.copy(lookPath.getPoint(k));
        cam.lookAt(look);
      },
      ease.inOutSine,
    );
    frame = FRAMES.rug;
    frameName = 'rug';
    setMode('play');
  }

  function setMode(m) {
    mode = m;
    modeT = 0;
  }

  return {
    flyTo,
    stageIntro,
    setMode,
    get mode() {
      return mode;
    },
    toPlay: () => flyTo(frame.pos, frame.look, 1.6).then(() => setMode('play')),
    /** ينقل الكاميرا بسلاسة إلى لقطة اللعب المطلوبة */
    frame(name) {
      if (frameName === name && mode === 'play') return Promise.resolve();
      frameName = name;
      frame = (isShort() && FRAMES[name + 'Short']) || FRAMES[name];
      return flyTo(frame.pos, frame.look, 1.0).then(() => setMode('play'));
    },
    toAerial: () =>
      flyTo(new THREE.Vector3(0, 30, 34), new THREE.Vector3(0, 0, -8), 2.2).then(() => setMode('aerial')),
  };
}
