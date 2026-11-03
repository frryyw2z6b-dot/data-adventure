import '@fontsource/baloo-bhaijaan-2/500.css';
import '@fontsource/baloo-bhaijaan-2/700.css';
import '@fontsource/baloo-bhaijaan-2/800.css';
import './styles/game.css';
import * as THREE from 'three';
import { Engine } from './game/engine.js';
import { buildWorld } from './game/world.js';
import { createDirector } from './game/camera.js';
import { createFx } from './game/fx.js';
import { Audio } from './game/audio.js';
import { createUI } from './game/ui.js';
import { createPointer } from './game/activities/common.js';
import { runStage } from './game/stageRunner.js';
import { getStage } from './content/stages.js';
import { getStudentBackend } from './backend/index.js';
import { errorMessage } from './backend/errors.js';
import { DEMO_CLASS_CODE } from './shared/classCode.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function loadProgress(session) {
  try {
    return JSON.parse(localStorage.getItem(`da:v1:progress:${session.code}:${session.uid}`) || '{"stars":{}}');
  } catch {
    return { stars: {} };
  }
}
function saveProgress(session, progress) {
  try {
    localStorage.setItem(`da:v1:progress:${session.code}:${session.uid}`, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

async function boot() {
  if (!webglAvailable()) {
    loading.innerHTML = '<p>هذا الجهاز أو المتصفح لا يدعم الرسوم ثلاثية الأبعاد (WebGL).<br>جرّبي متصفح Chrome أو Safari حديثًا.</p>';
    return;
  }

  const engine = new Engine(canvas);
  buildWorld(engine);
  const director = createDirector(engine);
  const fx = createFx(engine);
  const audio = new Audio();
  const ui = createUI(audio);
  const pointer = createPointer(engine);
  const board = new THREE.Group();
  engine.scene.add(board);

  await Promise.race([
    Promise.all([
      document.fonts.load('800 40px "Baloo Bhaijaan 2"', 'مرحبا'),
      document.fonts.load('700 40px "Baloo Bhaijaan 2"', 'مرحبا'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const backend = await getStudentBackend();
  ui.modeBadge(backend.mode);

  const ctx = { engine, director, fx, audio, ui, pointer, board, backend, debug: {} };
  // نافذة للفحص الآلي والمعاينة
  window.__da = ctx;

  loading.classList.add('done');
  setTimeout(() => loading.remove(), 900);

  let session = backend.restoreSession();

  const goMap = async () => {
    ui.clear();
    ui.hideHud();
    if (director.mode !== 'aerial') director.toAerial();
    ui.mapScreen({
      name: session.name,
      className: session.className,
      progress: loadProgress(session),
      onPick: (id) => playStage(id),
      onLeave: () => {
        backend.leave();
        session = null;
        goJoin();
      },
    });
  };

  const goJoin = () => {
    ui.joinScreen({
      mode: backend.mode,
      demoCode: DEMO_CLASS_CODE,
      onSubmit: async (name, code) => {
        try {
          session = await backend.joinClass(code, name);
          audio.correct();
          goMap();
          return null;
        } catch (err) {
          return errorMessage(err);
        }
      },
    });
  };

  const playStage = async (id) => {
    const stage = getStage(id);
    if (!stage?.available) return;
    ui.clear();
    const stars = await runStage(ctx, stage);
    if (stars == null) {
      goMap();
      return;
    }
    const progress = loadProgress(session);
    progress.stars[id] = Math.max(progress.stars[id] || 0, stars);
    saveProgress(session, progress);
    ui.resultsScreen({
      name: session.name,
      stage,
      stars,
      onMap: () => goMap(),
      onReplay: () => playStage(id),
    });
  };

  await ui.titleScreen();
  audio.unlock();
  audio.startAmbience();
  audio.whoosh();
  if (session) goMap();
  else {
    director.toAerial();
    goJoin();
  }
}

boot().catch((err) => {
  console.error(err);
  loading.innerHTML = '<p>تعذّر تشغيل اللعبة. حدّثي الصفحة وحاولي مرة أخرى.</p>';
});
