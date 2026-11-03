import * as THREE from 'three';
import { ease } from '../tween.js';

export const PRAISE = ['أحسنتِ!', 'رائع!', 'ممتاز يا مستكشفة!', 'عمل جميل!', 'صحيح!', 'بطلة!'];
export const TRY_AGAIN = ['حاولي مرة أخرى', 'فكّري قليلًا وجرّبي', 'قريبة! جرّبي مجددًا'];
export const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** مؤشر موحّد للفأرة واللمس مع إسقاط الأشعة على المشهد */
export function createPointer(engine) {
  const canvas = engine.canvas;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let handlers = null;
  const screen = { x: 0, y: 0 };

  function update(e) {
    const r = canvas.getBoundingClientRect();
    screen.x = e.clientX;
    screen.y = e.clientY;
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, engine.camera);
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (!handlers) return;
    update(e);
    canvas.setPointerCapture?.(e.pointerId);
    handlers.down?.(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!handlers) return;
    update(e);
    handlers.move?.(e);
  });
  const up = (e) => {
    if (!handlers) return;
    update(e);
    handlers.up?.(e);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  return {
    screen,
    raycaster,
    set(h) {
      handlers = h;
    },
    clear() {
      handlers = null;
      canvas.style.cursor = '';
    },
    /** أول جذر من roots تصيبه الأشعة */
    hit(roots, key) {
      const hits = raycaster.intersectObjects(roots, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !roots.includes(o)) o = o.parent;
        if (o && (!key || o.userData[key] !== undefined)) return o;
      }
      return null;
    },
    ground(y = 0) {
      const p = new THREE.Vector3();
      return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
    },
  };
}

/** يحرك جسمًا في قوس من موضعه إلى هدف */
export function arcTo(engine, obj, target, { height = 1.2, duration = 0.55, scaleTo = null } = {}) {
  const from = obj.position.clone();
  const s0 = obj.scale.x;
  return engine.tweens.run(
    duration,
    (k) => {
      obj.position.lerpVectors(from, target, k);
      obj.position.y += Math.sin(Math.PI * k) * height;
      if (scaleTo != null) obj.scale.setScalar(s0 + (scaleTo - s0) * k);
    },
    ease.inOutSine,
  );
}

export function shake(engine, obj, amount = 0.12, duration = 0.45) {
  const x0 = obj.position.x;
  return engine.tweens
    .run(duration, (k) => (obj.position.x = x0 + Math.sin(k * Math.PI * 7) * amount * (1 - k)), ease.linear)
    .then(() => (obj.position.x = x0));
}

export function hop(engine, obj, height = 0.6, duration = 0.5, spins = 1) {
  const y0 = obj.position.y;
  const r0 = obj.rotation.y;
  return engine.tweens.run(
    duration,
    (k) => {
      obj.position.y = y0 + Math.sin(Math.PI * k) * height;
      obj.rotation.y = r0 + k * Math.PI * 2 * spins;
    },
    ease.outCubic,
  );
}

/** يُسقط الأشياء من الأعلى بارتداد لطيف */
export function dropIn(engine, audio, objs, stagger = 0.09) {
  return Promise.all(
    objs.map((o, i) => {
      const target = o.position.clone();
      o.position.y = 5;
      o.visible = true;
      return engine.tweens.run(0.7, (k) => (o.position.y = target.y + (1 - k) * 5), ease.outElastic, i * stagger).then(() => {
        if (i % 2 === 0) audio.pop();
      });
    }),
  );
}

/** يُخفي الأشياء بتصغيرها ثم يزيلها من اللوحة */
export async function clearBoard(engine, board) {
  const kids = [...board.children];
  await Promise.all(
    kids.map((o, i) => {
      const s = o.scale.x;
      return engine.tweens.run(0.35, (k) => o.scale.setScalar(Math.max(0.0001, s * (1 - k))), ease.inCubic, i * 0.02);
    }),
  );
  kids.forEach((o) => board.remove(o));
}

/** أماكن الأشياء على السجادة: صف أو صفان متناوبان */
export function layoutSpots(n, { zFront = 1.3, z2 = [0.55, 1.95], maxWidth = 7.4 } = {}) {
  const shuffled = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  const spots = [];
  if (n <= 5) {
    const gap = Math.min(1.5, maxWidth / Math.max(n - 1, 1));
    for (let i = 0; i < n; i++) spots.push(new THREE.Vector3((i - (n - 1) / 2) * gap, 0.04, zFront));
  } else {
    const perRow = Math.ceil(n / 2);
    const gap = Math.min(1.5, maxWidth / Math.max(perRow - 1, 1));
    for (let i = 0; i < n; i++) {
      const row = i < perRow ? 0 : 1;
      const idx = row ? i - perRow : i;
      const count = row ? n - perRow : perRow;
      spots.push(new THREE.Vector3((idx - (count - 1) / 2) * gap, 0.04, z2[row]));
    }
  }
  return shuffled.map((k) => spots[k]);
}

/** يربط نشاطًا بإشارة الإلغاء: ينظّف ثم يرفض الوعد */
export function onAbort(ctx, cleanup, reject) {
  const sig = ctx.signal;
  if (!sig) return;
  sig.addEventListener(
    'abort',
    () => {
      cleanup();
      reject(new DOMException('stage aborted', 'AbortError'));
    },
    { once: true },
  );
}

/** يبني عرض البيانات للسؤال ويضبط الكاميرا على اللوح */
export async function openDisplay(ctx, display, opts = {}) {
  const { tallyView, pictoView, barView } = await import('../displays.js');
  ctx.director.frame('board');
  await ctx.dataBoard.show();
  if (display.type === 'tally') return tallyView(ctx, { title: display.title, rows: display.rows, ...opts });
  if (display.type === 'picto') return pictoView(ctx, { title: display.title, keyText: display.key, rows: display.rows, ...opts });
  if (display.type === 'bar') return barView(ctx, { title: display.title, rows: display.rows, ...opts });
  throw new Error('unknown display ' + display.type);
}

/** حلقة المحاولات المشتركة لأنشطة البناء والاختيار */
export const praise = (ctx) => {
  const { LINES } = ctx;
  const t = pickOne(LINES.praise);
  ctx.ui.toast(t, 'good');
  ctx.say(t);
  ctx.noura?.cheer();
};
export const tryAgain = (ctx, text) => {
  const t = text || pickOne(ctx.LINES.tryAgain);
  ctx.ui.toast(t, 'try');
  ctx.say(t);
  ctx.noura?.nod();
};
