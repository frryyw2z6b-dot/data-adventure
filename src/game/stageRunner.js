// يدير مرحلة كاملة: لقطة دخول سينمائية ← حوار شاهين ← الأسئلة ← الاحتفال
import { runSort } from './activities/sort.js';
import { runPick } from './activities/pick.js';
import { runChoice } from './activities/choice.js';
import { clearBoard } from './activities/common.js';
import { scoreQuestion, starsFor } from '../shared/scoring.js';

const ACTIVITIES = { sort: runSort, pick: runPick, choice: runChoice };

/** يعيد عدد النجوم، أو null إذا خرجت الطالبة إلى الخريطة قبل الإنهاء */
export async function runStage(ctx, stage) {
  const { ui, director, audio, engine, fx, board, backend } = ctx;
  const controller = new AbortController();
  ctx.signal = controller.signal;
  const onHome = async () => {
    const leave = await ui.confirm('هل تريدين العودة إلى الخريطة؟ ستبدئين هذه المرحلة من أولها لاحقًا.', 'نعم، إلى الخريطة', 'أكملي اللعب');
    if (leave) controller.abort();
  };
  const content = stage.content;
  const questions = content.questions.filter((q) => ACTIVITIES[q.type]);

  ui.clear();
  ui.hideHud();
  ui.letterbox(true);
  audio.whoosh();
  const title = ui.stageTitle(stage);
  await director.stageIntro(5.6);
  await title;
  ui.letterbox(false);

  await ui.guideDialog(content.intro);
  ui.hud(stage, content.status === 'draft', onHome);

  let total = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    ui.progress(i, questions.length);
    ui.prompt(q.prompt);
    ctx.debug.qIndex = i;
    let result;
    try {
      result = await ACTIVITIES[q.type](ctx, q);
    } catch (err) {
      if (err?.name !== 'AbortError') throw err;
      ui.hideHud();
      ui.clear();
      await clearBoard(engine, board);
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
    await clearBoard(engine, board);
  }

  ui.progress(questions.length, questions.length);
  ui.hidePrompt();
  const stars = starsFor(questions.length ? total / questions.length : 0);
  backend.reportStage(stage.id);
  audio.fanfare();
  fx.celebrate();
  await engine.tweens.wait(0.8);
  ui.hideHud();
  return stars;
}
