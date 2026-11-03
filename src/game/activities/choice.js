// الاختيار من متعدد: مع مجموعات من الأشياء على السجادة، أو مع عرض بيانات (إشارات/صور/أعمدة)
import * as THREE from 'three';
import { createItem, createGroupRing } from '../models.js';
import { MAX_TRIES } from '../../shared/scoring.js';
import { dropIn, hop, onAbort, openDisplay, praise, tryAgain } from './common.js';

export async function runChoice(ctx, q) {
  const { engine, board, audio, fx, ui } = ctx;
  const all = [];
  let view = null;
  if (q.display) {
    view = await openDisplay(ctx, q.display);
  } else {
    ctx.director.frame('rug');
    const groups = q.groups || [q.items || []];
    const g = groups.length;
    const spread = g === 1 ? 0 : g === 2 ? 4.4 : 3;
    groups.forEach((group, gi) => {
      const cx = (gi - (g - 1) / 2) * spread * -1;
      const ring = createGroupRing(1.45);
      ring.position.set(cx, 0.05, 0.3);
      board.add(ring);
      group.forEach((spec, i) => {
        const it = createItem(spec);
        const a = (i / group.length) * Math.PI * 2 + Math.PI / 2;
        const r = group.length === 1 ? 0 : 0.78;
        it.position.set(cx + Math.cos(a) * r, 0.04, 0.3 + Math.sin(a) * r * 0.8);
        it.visible = false;
        board.add(it);
        all.push(it);
      });
    });
  }

  const attempts = [];
  return new Promise((resolve, reject) => {
    let busy = false;
    const unlisten = engine.onUpdate((dt) => all.forEach((it) => (it.userData.holder.rotation.y += dt * 0.5)));
    const done = async (revealed) => {
      await engine.tweens.wait(1.4);
      unlisten();
      panel.hide();
      resolve({ attempts, revealed });
    };
    const panel = ui.choices(q.options, async (id) => {
      if (busy) return;
      attempts.push(id);
      if (id === q.answer) {
        busy = true;
        panel.correct(id);
        audio.correct();
        praise(ctx);
        fx.burst(new THREE.Vector3(0, 1.4, q.display ? -1.6 : 0.3), { count: 70 });
        all.forEach((it, i) => setTimeout(() => hop(engine, it, 0.5, 0.5, 0), i * 60));
        done(false);
      } else {
        panel.wrong(id);
        audio.wrong();
        if (attempts.length >= MAX_TRIES) {
          busy = true;
          panel.correct(q.answer);
          ui.toast(ctx.LINES.revealAnswer, 'hint', 2200);
          ctx.say(ctx.LINES.revealAnswer);
          ctx.noura?.point(new THREE.Vector3(0, 0, 3));
          done(true);
        } else {
          tryAgain(ctx);
        }
      }
    }, (text) => ctx.say(text));
    onAbort(
      ctx,
      () => {
        busy = true;
        unlisten();
        panel.hide();
      },
      reject,
    );
    if (all.length) dropIn(engine, audio, all);
    ctx.debug.current = { type: 'choice', items: all, view, ready: true };
  });
}
