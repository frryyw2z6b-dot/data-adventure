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
import { createNoura } from './game/character.js';
import { createBoard } from './game/board.js';
import { createStageSets } from './game/stageSets.js';
import { createPointer } from './game/activities/common.js';
import { runStage } from './game/stageRunner.js';
import { STAGES, getStage } from './content/stages.js';
import { LINES } from './content/lines.js';
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

const progressKey = (s) => `da:v1:progress:${s.code}:${s.uid}`;
function loadProgress(session) {
  try {
    return { stars: {}, ...JSON.parse(localStorage.getItem(progressKey(session)) || '{}') };
  } catch {
    return { stars: {} };
  }
}
function saveProgress(session, progress) {
  try {
    localStorage.setItem(progressKey(session), JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

async function boot() {
  if (!webglAvailable()) {
    loading.innerHTML = '<p>هذا الجهاز أو المتصفح لا يدعم الرسوم ثلاثية الأبعاد (WebGL).<br>جرّبي متصفح Chrome أو Edge أو Safari حديثًا.</p>';
    return;
  }

  const engine = new Engine(canvas);
  const world = buildWorld(engine);
  const sets = createStageSets(engine, world);
  const director = createDirector(engine);
  const fx = createFx(engine);
  const audio = new Audio();
  const noura = createNoura(engine, audio);
  audio.onSpeaking = (on) => noura.setTalking(on);
  const say = (text) => audio.say(text);
  const ui = createUI(audio, { say });
  const pointer = createPointer(engine);
  const board = new THREE.Group();
  engine.scene.add(board);
  const dataBoard = createBoard(engine);

  await Promise.race([
    Promise.all([
      document.fonts.load('800 40px "Baloo Bhaijaan 2"', 'مرحبا'),
      document.fonts.load('700 40px "Baloo Bhaijaan 2"', 'مرحبا'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  const backend = await getStudentBackend();
  ui.modeBadge(backend.mode);

  const ctx = { engine, director, fx, audio, ui, pointer, board, dataBoard, backend, noura, sets, say, LINES, debug: {} };
  // نافذة للفحص الآلي والمعاينة
  window.__da = ctx;

  // نورة بجانب السجادة في شاشة البداية
  noura.place(2.6, 2.3);
  audio.preload([LINES.welcome, LINES.askCode, LINES.askName, LINES.typeName, LINES.map, LINES.soundTest, ...LINES.praise]);

  loading.classList.add('done');
  setTimeout(() => loading.remove(), 900);

  let session = backend.restoreSession();
  const params = new URLSearchParams(location.search);
  const linkCode = params.get('class') || params.get('code') || '';

  const goMap = () => {
    ui.clear();
    ui.hideHud();
    sets.setStage(0);
    noura.place(1.2, 0.6);
    if (director.mode !== 'aerial') director.toAerial();
    const progress = loadProgress(session);
    progress.serverStage = session.stage || 0;
    ui.mapScreen({
      name: session.name,
      className: session.className,
      progress,
      onPick: (id) => playStage(id),
      onLeave: () => {
        backend.leave();
        session = null;
        goCode();
      },
    });
  };

  const goName = (cls) => {
    ui.nameScreen({
      className: cls.name,
      roster: cls.roster,
      onBack: () => goCode(),
      onSubmit: async (name) => {
        try {
          session = await backend.joinClass(cls.code, name);
          audio.correct();
          noura.cheer();
          goMap();
          return null;
        } catch (err) {
          return errorMessage(err);
        }
      },
    });
  };

  const goCode = (initial = '') => {
    noura.place(2.6, 2.3);
    ui.codeScreen({
      mode: backend.mode,
      demoCode: DEMO_CLASS_CODE,
      initialCode: initial,
      onSubmit: async (code) => {
        try {
          const cls = await backend.lookupClass(code);
          audio.tap();
          goName(cls);
          return null;
        } catch (err) {
          return errorMessage(err);
        }
      },
    });
  };

  const playStage = async (id, { skipIntro = false } = {}) => {
    const stage = getStage(id);
    if (!stage) return;
    ui.clear();
    const progress = loadProgress(session);
    const stars = await runStage(ctx, stage, { skipIntro: skipIntro || Boolean(progress.stars[id]) });
    if (stars == null) {
      goMap();
      return;
    }
    progress.stars[id] = Math.max(progress.stars[id] || 0, stars);
    saveProgress(session, progress);
    session.stage = Math.max(session.stage || 0, id);
    const isLast = id === STAGES.length;
    ui.resultsScreen({
      name: session.name,
      stage,
      stars,
      isLast,
      onMap: () => (isLast ? ui.certificate({ name: session.name, onMap: goMap }) : goMap()),
      onReplay: () => playStage(id, { skipIntro: true }),
      onNext: () => playStage(id + 1),
    });
    if (isLast) setTimeout(() => noura.spin(), 600);
  };

  await ui.titleScreen();
  audio.unlock();
  audio.startAmbience();
  audio.whoosh();
  noura.wave();
  if (session) goMap();
  else {
    director.toAerial();
    goCode(linkCode);
  }
}

boot().catch((err) => {
  console.error(err);
  loading.innerHTML = '<p>تعذّر تشغيل اللعبة. حدّثي الصفحة وحاولي مرة أخرى.</p>';
});
