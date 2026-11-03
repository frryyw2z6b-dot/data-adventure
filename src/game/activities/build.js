// أنشطة البناء: رسم إشارات العد، وإنشاء تمثيل بالصور، وإنشاء أعمدة بيانية.
// كلها تتبع الحلقة نفسها: تبني الطالبة ← «تحقّقي» ← تغذية راجعة ← بعد ٣ محاولات خاطئة تُعرض الإجابة.
import * as THREE from 'three';
import { createItem, setGlow } from '../models.js';
import { MAX_TRIES } from '../../shared/scoring.js';
import { dropIn, onAbort, openDisplay, praise, tryAgain } from './common.js';
import { tallyView } from '../displays.js';

const MODEL_AR = { date: 'تَمْر', cup: 'فَنَاجِين', orange: 'بُرْتُقَال', apple: 'تُفَّاح', ball: 'كُرَات', cube: 'مُكَعَّبَات', star: 'نُجُوم', dallah: 'دِلَال' };

function runBuild(ctx, q, impl, view = null) {
  const { engine, audio, ui, pointer, fx } = ctx;
  const attempts = [];
  return new Promise((resolve, reject) => {
    let busy = false;
    const controls = ui.buildControls(impl.buttons, async (id) => {
      if (busy) return;
      if (id !== 'check') return impl.onButton?.(id);
      const value = impl.value();
      if (impl.isEmpty?.()) {
        tryAgain(ctx, impl.emptyHint);
        return;
      }
      attempts.push(value);
      if (value === String(q.answer)) {
        busy = true;
        audio.correct();
        praise(ctx);
        fx.burst(new THREE.Vector3(0, 1.6, -1.5), { count: 80 });
        finish(false);
      } else {
        audio.wrong();
        impl.showWrong?.();
        if (attempts.length >= MAX_TRIES) {
          busy = true;
          ui.toast(ctx.LINES.revealAnswer, 'hint', 2200);
          ctx.say(ctx.LINES.revealAnswer);
          await impl.reveal();
          finish(true);
        } else {
          tryAgain(ctx, ctx.LINES.recount);
        }
      }
    });
    async function finish(revealed) {
      pointer.clear();
      unlisten?.();
      await engine.tweens.wait(1.6);
      controls.hide();
      ui.dataCard(null);
      resolve({ attempts, revealed });
    }
    const unlisten = impl.update ? engine.onUpdate(impl.update) : null;
    pointer.set({
      down() {
        if (!busy) impl.onTap?.();
      },
      move() {
        engine.canvas.style.cursor = impl.hover?.() ? 'pointer' : '';
      },
    });
    onAbort(
      ctx,
      () => {
        busy = true;
        pointer.clear();
        unlisten?.();
        controls.hide();
        ui.dataCard(null);
      },
      reject,
    );
    ctx.debug.current = { type: q.type, ready: true, impl, view, items: impl.items || [], value: () => impl.value() };
  });
}

// ── رسم إشارات العد لأشياء على السجادة ──
export async function runTallyMake(ctx, q) {
  const { board, engine, audio, ui, pointer, dataBoard } = ctx;
  ctx.director.frame('board');
  await dataBoard.show();
  const model = q.items[0].model;
  const row = { id: 'make', label: MODEL_AR[model] || '', icon: { model } };
  let count = 0;
  const view = tallyView(ctx, { title: 'اُرْسُمِي الْإِشَارَاتِ هُنَا', rows: [{ ...row, count: 0 }] });
  const redraw = (wrong = []) => view.draw([count], wrong);

  // الأشياء المطلوب عدّها في صفين على السجادة
  const n = q.items.length;
  const perRow = Math.ceil(n / 2);
  const items = q.items.map((spec, i) => {
    const it = createItem({ ...spec, size: 'big' });
    const r = i < perRow ? 0 : 1;
    const k = r ? i - perRow : i;
    const cnt = r ? n - perRow : perRow;
    it.position.set((k - (cnt - 1) / 2) * -1.0, 0.04, r ? 1.3 : 0.3);
    it.visible = false;
    board.add(it);
    return it;
  });
  await dropIn(engine, audio, items);
  ui.toast(ctx.LINES.tallyHint, 'hint', 2600);

  return runBuild(ctx, q, {
    buttons: [
      { id: 'add', label: '+ إِشَارَة', primary: false },
      { id: 'undo', label: '↶ اِمْسَحِي', primary: false },
      { id: 'check', label: 'تَحَقَّقِي', primary: true },
    ],
    emptyHint: ctx.LINES.tallyHint,
    isEmpty: () => count === 0,
    onButton(id) {
      if (id === 'add' && count < 12) {
        count++;
        audio.mark();
      }
      if (id === 'undo' && count > 0) {
        count--;
        audio.drop();
      }
      redraw();
    },
    // لمس شيء يضع عليه علامة «عُدَّ» تساعد على العدّ؛ لمس اللوح يضيف إشارة
    onTap() {
      const it = pointer.hit(items, 'itemId');
      if (it) {
        it.userData.counted = !it.userData.counted;
        setGlow(it, it.userData.counted ? 0.55 : 0, '#7fd3ff');
        audio.tap();
        return;
      }
      if (pointer.raycaster.intersectObject(dataBoard.face).length && count < 12) {
        count++;
        audio.mark();
        redraw();
      }
    },
    hover: () => Boolean(pointer.hit(items, 'itemId') || pointer.raycaster.intersectObject(dataBoard.face).length),
    value: () => String(count),
    showWrong: () => {
      redraw([0]);
      setTimeout(() => redraw(), 1200);
    },
    items,
    async reveal() {
      count = Number(q.answer);
      redraw();
      for (let i = 0; i < items.length; i++) {
        setGlow(items[i], 0.55, '#7fd3ff');
        await engine.tweens.wait(0.12);
      }
    },
  });
}

// ── إنشاء تمثيل بالصور من جدول على اللوح ──
export async function runPictoMake(ctx, q) {
  const { pointer, ui } = ctx;
  const view = await openDisplay(ctx, { type: 'picto', title: q.title, rows: q.rows.map((r) => ({ ...r, count: 0 })) }, {
    interactive: true,
    table: q.rows,
  });
  ui.toast(ctx.LINES.pictoHint, 'hint', 2800);
  return runBuild(ctx, q, {
    buttons: [
      { id: 'reset', label: '↶ اِبْدَئِي مِنْ جَدِيدٍ' },
      { id: 'check', label: 'تَحَقَّقِي', primary: true },
    ],
    emptyHint: ctx.LINES.pictoHint,
    isEmpty: () => view.counts().every((c) => c === 0),
    onButton(id) {
      if (id === 'reset') view.rowObjs.forEach((_, i) => view.setCount(i, 0));
    },
    onTap() {
      const h = view.hitRow(pointer);
      if (!h) return;
      if (h.onItem) view.removeLast(h.row);
      else view.add(h.row);
    },
    hover: () => Boolean(view.hitRow(pointer)),
    value: () => view.counts().join(','),
    showWrong() {
      const c = view.counts();
      view.flash(q.rows.map((r, i) => (c[i] !== r.count ? i : -1)).filter((i) => i >= 0));
    },
    async reveal() {
      q.rows.forEach((r, i) => view.setCount(i, r.count));
    },
  }, view);
}

// ── إنشاء أعمدة بيانية من جدول ──
export async function runBarMake(ctx, q) {
  const { pointer, ui } = ctx;
  const view = await openDisplay(ctx, { type: 'bar', title: q.title, rows: q.rows }, { interactive: true });
  ui.dataCard({ title: q.title, rows: q.rows });
  ui.toast(ctx.LINES.barHint, 'hint', 2600);
  return runBuild(ctx, q, {
    buttons: [
      { id: 'reset', label: '↶ اِبْدَئِي مِنْ جَدِيدٍ' },
      { id: 'check', label: 'تَحَقَّقِي', primary: true },
    ],
    emptyHint: ctx.LINES.barHint,
    isEmpty: () => view.counts().every((c) => c === 0),
    onButton(id) {
      if (id === 'reset') view.cols.forEach((_, i) => view.setLevel(i, 0));
    },
    onTap() {
      const h = view.hitLevel(pointer);
      if (h) view.setLevel(h.col, h.level);
    },
    hover: () => Boolean(view.hitLevel(pointer)),
    value: () => view.counts().join(','),
    showWrong() {
      const c = view.counts();
      view.flash(q.rows.map((r, i) => (c[i] !== r.count ? i : -1)).filter((i) => i >= 0));
    },
    async reveal() {
      q.rows.forEach((r, i) => view.setLevel(i, r.count));
    },
  }, view);
}
