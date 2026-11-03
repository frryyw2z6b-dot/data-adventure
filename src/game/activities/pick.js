// نشاط «المسي الإجابة»: تلمس الطالبة الشيء المطلوب في المشهد
import * as THREE from 'three';
import { createItem, setGlow, setDim } from '../models.js';
import { MAX_TRIES } from '../../shared/scoring.js';
import { PRAISE, TRY_AGAIN, pickOne, shake, hop, dropIn } from './common.js';

export function runPick(ctx, q) {
  const { engine, board, pointer, audio, fx, ui } = ctx;
  const n = q.items.length;
  const gap = Math.min(1.7, 7 / Math.max(n - 1, 1));
  const order = [...q.items].sort(() => Math.random() - 0.5);
  const items = order.map((spec, i) => {
    const it = createItem({ ...spec, size: spec.size || 'big' });
    it.position.set((i - (n - 1) / 2) * gap, 0.04, 0.5);
    it.userData.phase = i * 1.3;
    it.visible = false;
    board.add(it);
    return it;
  });

  const attempts = [];
  const tried = new Set();
  let hovered = null;
  let locked = false;

  return new Promise((resolve) => {
    const unlisten = engine.onUpdate((dt, t) => {
      for (const it of items) {
        if (tried.has(it.userData.itemId)) continue;
        it.userData.holder.position.y = 0.05 + Math.sin(t * 2 + it.userData.phase) * 0.05;
        it.userData.holder.rotation.y += dt * 0.4;
      }
    });

    const finish = async (revealed) => {
      locked = true;
      pointer.clear();
      await engine.tweens.wait(1.1);
      unlisten();
      resolve({ attempts, revealed });
    };

    const live = () => items.filter((it) => !tried.has(it.userData.itemId));

    pointer.set({
      move() {
        if (locked) return;
        const it = pointer.hit(live(), 'itemId');
        if (it !== hovered) {
          if (hovered) setGlow(hovered, 0);
          hovered = it;
          if (it) setGlow(it, 0.25);
        }
        engine.canvas.style.cursor = it ? 'pointer' : '';
      },
      async down() {
        if (locked) return;
        const it = pointer.hit(live(), 'itemId');
        if (!it) return;
        const id = it.userData.itemId;
        attempts.push(id);
        if (id === q.answer) {
          locked = true;
          audio.correct();
          setGlow(it, 0.6);
          fx.burst(it.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 60 });
          ui.toast(pickOne(PRAISE), 'good');
          hop(engine, it, 0.9, 0.7, 1);
          finish(false);
        } else {
          tried.add(id);
          audio.wrong();
          setGlow(it, 0);
          shake(engine, it, 0.12);
          setDim(it, true);
          const remaining = live().filter((x) => x.userData.itemId !== q.answer).length;
          if (attempts.length >= MAX_TRIES || remaining === 0) {
            locked = true;
            const right = items.find((x) => x.userData.itemId === q.answer);
            ui.toast('انظري… هذه هي الإجابة', 'hint', 1800);
            setGlow(right, 0.7, '#7fd3ff');
            await hop(engine, right, 0.7, 0.7, 1);
            finish(true);
          } else {
            ui.toast(pickOne(TRY_AGAIN), 'try');
          }
        }
      },
    });

    dropIn(engine, audio, items);
    ctx.debug.current = { type: 'pick', items };
  });
}
