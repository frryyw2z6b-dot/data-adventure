// نشاط الفرز: تسحب الطالبة كل شيء إلى سلته (أو تلمسه ثم تلمس السلة)
import * as THREE from 'three';
import { createItem, createBasket, setGlow } from '../models.js';
import { MAX_TRIES } from '../../shared/scoring.js';
import { PRAISE, TRY_AGAIN, pickOne, arcTo, shake, dropIn, layoutSpots, hop, onAbort } from './common.js';
import { ease } from '../tween.js';

const DRAG_Y = 0.85;
const BIN_RADIUS = 1.2;

export function runSort(ctx, q) {
  const { engine, board, pointer, audio, fx, ui } = ctx;

  // السلال في الصف الخلفي
  const n = q.bins.length;
  const gap = n === 2 ? 4.2 : 2.9;
  const baskets = q.bins.map((bin, i) => {
    const b = createBasket(bin);
    b.position.set((i - (n - 1) / 2) * gap * -1, 0.03, -1.45); // من اليمين لليسار
    b.scale.setScalar(0.0001);
    board.add(b);
    return b;
  });
  const binById = Object.fromEntries(baskets.map((b) => [b.userData.binId, b]));

  // الأشياء في الأمام
  const spots = layoutSpots(q.items.length);
  const items = q.items.map((spec, i) => {
    const it = createItem(spec);
    it.position.copy(spots[i]);
    it.rotation.y = (Math.random() - 0.5) * 0.8;
    it.userData.home = spots[i].clone();
    it.visible = false;
    board.add(it);
    return it;
  });

  const attempts = [];
  const mistakes = {};
  const placed = new Set();
  let revealed = false;
  let candidate = null;
  let dragging = null;
  let selected = null;
  let hoverBin = null;
  let downAt = null;
  const dragTarget = new THREE.Vector3();
  let unlisten = null;

  const free = () => items.filter((it) => !placed.has(it.userData.itemId) && !it.userData.busy);

  function setHover(b) {
    if (hoverBin === b) return;
    if (hoverBin) {
      hoverBin.userData.rimMat.emissive.set('#000000');
      hoverBin.userData.targetScale = 1;
    }
    hoverBin = b;
    if (b) {
      b.userData.rimMat.emissive.set('#ffbe3b');
      b.userData.rimMat.emissiveIntensity = 1.2;
      b.userData.targetScale = 1.08;
    }
  }

  function nearestBin(p) {
    if (!p) return null;
    let best = null;
    let bd = BIN_RADIUS;
    for (const b of baskets) {
      const d = Math.hypot(b.position.x - p.x, b.position.z - p.z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  function select(it) {
    if (selected && selected !== it) unselect();
    selected = it;
    setGlow(it, 0.55);
    audio.pickup();
    engine.tweens.run(0.25, (k) => (it.position.y = it.userData.home.y + k * 0.45), ease.outCubic);
  }
  function unselect() {
    if (!selected) return;
    const it = selected;
    selected = null;
    setGlow(it, 0);
    engine.tweens.run(0.25, (k) => (it.position.y = it.userData.home.y + (1 - k) * 0.45), ease.outCubic);
  }

  async function goHome(it) {
    it.userData.busy = true;
    await arcTo(engine, it, it.userData.home, { height: 0.8, duration: 0.5 });
    it.userData.busy = false;
  }

  async function intoBasket(it, basket) {
    it.userData.busy = true;
    const k = basket.userData.filled++;
    const a = k * 2.1 + 0.4;
    const r = k === 0 ? 0 : 0.33;
    const target = new THREE.Vector3(
      basket.position.x + Math.cos(a) * r,
      0.12 + Math.floor(k / 5) * 0.18,
      basket.position.z + Math.sin(a) * r,
    );
    await arcTo(engine, it, target, { height: 1.1, duration: 0.5, scaleTo: 0.72 });
    basket.userData.targetScale = 1.12;
    setTimeout(() => (basket.userData.targetScale = hoverBin === basket ? 1.08 : 1), 160);
    audio.drop();
  }

  let finishResolve;
  let finishReject;
  const done = new Promise((res, rej) => {
    finishResolve = res;
    finishReject = rej;
  });

  async function evaluate(it, basket) {
    const id = it.userData.itemId;
    const binId = basket.userData.binId;
    attempts.push(`${id}>${binId}`);
    setHover(null);
    setGlow(it, 0);
    if (it.userData.spec.bin === binId) {
      placed.add(id);
      await intoBasket(it, basket);
      audio.correct();
      fx.burst(new THREE.Vector3(basket.position.x, 0.9, basket.position.z));
      ui.toast(pickOne(PRAISE), 'good');
    } else {
      mistakes[id] = (mistakes[id] || 0) + 1;
      audio.wrong();
      shake(engine, basket, 0.1);
      if (mistakes[id] >= MAX_TRIES) {
        // بعد ثلاث محاولات: يرشدها شاهين إلى المكان الصحيح
        revealed = true;
        placed.add(id);
        ui.toast('انظري… هذا مكانها الصحيح', 'hint', 1800);
        const right = binById[it.userData.spec.bin];
        setGlow(it, 0.7, '#7fd3ff');
        await intoBasket(it, right);
        setGlow(it, 0);
      } else {
        ui.toast(pickOne(TRY_AGAIN), 'try');
        await goHome(it);
      }
    }
    it.userData.busy = false;
    if (placed.size === items.length) {
      pointer.clear();
      unlisten?.();
      await engine.tweens.wait(0.5);
      await Promise.all(baskets.map((b, i) => hop(engine, b, 0.3, 0.6, 0).then(() => i)));
      finishResolve({ attempts, revealed });
    }
  }

  const handlers = {
    down() {
      downAt = { ...pointer.screen };
      const it = pointer.hit(free(), 'itemId');
      if (it) {
        candidate = it;
        return;
      }
      // لمس سلة بعد اختيار شيء
      const b = pointer.hit(baskets, 'binId') || nearestBin(pointer.ground(0));
      if (selected && b) {
        const it2 = selected;
        selected = null;
        evaluate(it2, b);
      } else {
        unselect();
      }
    },
    move() {
      if (candidate && !dragging) {
        const d = Math.hypot(pointer.screen.x - downAt.x, pointer.screen.y - downAt.y);
        if (d > 8) {
          if (selected && selected !== candidate) unselect();
          dragging = candidate;
          dragTarget.copy(dragging.position);
          selected = null;
          setGlow(dragging, 0.45);
          audio.pickup();
        }
      }
      if (dragging) {
        const p = pointer.ground(DRAG_Y);
        if (p) {
          p.x = THREE.MathUtils.clamp(p.x, -5, 5);
          p.z = THREE.MathUtils.clamp(p.z, -2.8, 3);
          dragTarget.copy(p);
        }
        setHover(nearestBin(pointer.ground(0.4)));
      } else if (!candidate) {
        engine.canvas.style.cursor = pointer.hit(free(), 'itemId') ? 'grab' : selected && nearestBin(pointer.ground(0)) ? 'pointer' : '';
      }
    },
    up() {
      if (dragging) {
        const it = dragging;
        dragging = null;
        candidate = null;
        if (hoverBin) evaluate(it, hoverBin);
        else {
          setGlow(it, 0);
          goHome(it);
        }
      } else if (candidate) {
        const it = candidate;
        candidate = null;
        if (selected === it) unselect();
        else select(it);
      }
    },
  };

  // تحديث كل إطار: السحب السلس + نبض السلال + تمايل الشيء المختار
  unlisten = engine.onUpdate((dt, t) => {
    if (dragging) {
      dragging.position.lerp(dragTarget, Math.min(1, dt * 18));
      dragging.rotation.z = Math.sin(t * 6) * 0.08;
    }
    if (selected && !selected.userData.busy) selected.userData.holder.position.y = Math.sin(t * 5) * 0.06;
    for (const b of baskets) {
      const s = b.userData.targetScale ?? 0.0001;
      b.scale.setScalar(THREE.MathUtils.lerp(b.scale.x, s, Math.min(1, dt * 10)));
      if (b.userData.icon) b.userData.icon.rotation.y += dt * 0.8;
    }
  });

  // دخول المشهد
  (async () => {
    baskets.forEach((b, i) => setTimeout(() => (b.userData.targetScale = 1), i * 150));
    await engine.tweens.wait(0.5);
    await dropIn(engine, audio, items);
    if (ctx.signal?.aborted) return;
    pointer.set(handlers);
    ctx.debug.current.ready = true;
  })();

  onAbort(
    ctx,
    () => {
      pointer.clear();
      unlisten?.();
    },
    (e) => finishReject(e),
  );

  // للاختبار الآلي والمعاينة
  ctx.debug.current = {
    type: 'sort',
    items,
    baskets,
    ready: false,
    peek: () => ({ selected: selected?.userData.itemId, placed: placed.size }),
  };

  return done;
}
