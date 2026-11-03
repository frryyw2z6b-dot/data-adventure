// يدير مرحلة كاملة: أجواء المكان ← لقطة دخول سينمائية ← نورة تشرح ← الأسئلة ← الاحتفال
import * as THREE from 'three';
import { runSort } from './activities/sort.js';
import { runPick } from './activities/pick.js';
import { runChoice } from './activities/choice.js';
import { runTallyMake, runPictoMake, runBarMake } from './activities/build.js';
import { clearBoard } from './activities/common.js';
import { scoreQuestion, starsFor } from '../shared/scoring.js';
import { LINES } from '../content/lines.js';

const ACTIVITIES = {
  sort: runSort,
  pick: runPick,
  choice: runChoice,
  'tally-make': runTallyMake,
  'picto-make': runPictoMake,
  'bar-make': runBarMake,
};

// مكان نورة أثناء اللعب: يمين اللوح، مرئية في لقطتي السجادة واللوح
export const NOURA_PLAY = { x: 4.7, z: -2.75 };

/** يعيد عدد النجوم، أو null إذا خرجت الطالبة إلى الخريطة قبل الإنهاء */
export async function runStage(ctx, stage, { skipIntro = false } = {}) {
  const { ui, director, audio, engine, fx, board, backend, noura, sets, dataBoard } = ctx;
  const content = stage.content;
  const questions = content.questions.filter((q) => ACTIVITIES[q.type]);
  const controller = new AbortController();
  ctx.signal = controller.signal;
  const onHome = async () => {
    const leave = await ui.confirm(LINES.leave, 'نعم، إلى الخريطة', 'أكملي اللعب');
    if (leave) controller.abort();
  };

  // تحميل أصوات المرحلة مسبقًا
  audio.preload([content.intro, LINES.stageTitles[stage.id - 1], ...questions.map((q) => q.prompt), ...LINES.praise, ...LINES.tryAgain]);

  ui.clear();
  ui.hideHud();
  fx.stopCelebrate();
  ui.letterbox(true);
  audio.whoosh();
  sets.setStage(stage.id);
  noura.place(NOURA_PLAY.x, NOURA_PLAY.z);
  ctx.say(LINES.stageTitles[stage.id - 1]);
  const title = ui.stageTitle(stage, () => engine.tweens.skipAll());
  if (skipIntro) director.frame('rug');
  else await director.stageIntro(5.6);
  await title;
  ui.letterbox(false);
  noura.wave();

  await ui.guideDialog(content.intro);
  ui.hud(stage, onHome);

  let total = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    ui.progress(i, questions.length);
    ctx.debug.qIndex = i;
    ctx.debug.question = q;
    ctx.debug.current = null;
    ui.prompt(q.prompt);
    noura.point(new THREE.Vector3(0, 0.5, q.display || q.type.endsWith('make') ? -2.2 : 0.5));
    let result;
    try {
      result = await ACTIVITIES[q.type](ctx, q);
    } catch (err) {
      if (err?.name !== 'AbortError') throw err;
      audio.stopVoice();
      ui.hideHud();
      ui.clear();
      ui.dataCard(null);
      await Promise.all([clearBoard(engine, board), dataBoard.hide()]);
      return null;
    }
    // تُرسل المحاولات الخام فقط؛ الدرجة الرسمية تُحسب في لوحة المعلمة
    backend
      .recordAnswer({
        stageId: stage.id,
        questionId: q.id,
        attempts: result.attempts,
        revealed: result.revealed,
        contentVersion: content.version,
      })
      .catch((err) => console.error(err));
    total += scoreQuestion(q, result).score;
    await engine.tweens.wait(0.3);
    const nextUsesBoard = questions[i + 1] && (questions[i + 1].display || questions[i + 1].type.endsWith('make'));
    await Promise.all([clearBoard(engine, board), nextUsesBoard ? null : dataBoard.hide()]);
  }

  ui.progress(questions.length, questions.length);
  ui.hidePrompt();
  ctx.debug.qIndex = questions.length;
  const stars = starsFor(questions.length ? total / questions.length : 0);
  backend.reportStage(stage.id);
  director.frame('rug');
  noura.cheer();
  audio.fanfare();
  fx.celebrate();
  await engine.tweens.wait(0.8);
  ui.hideHud();
  return stars;
}
