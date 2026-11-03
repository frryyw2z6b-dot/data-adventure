// حساب الدرجات من الإجابات الخام.
// جهاز الطالبة لا يرسل «درجة» أبدًا؛ يرسل محاولاتها فقط، وتُحسب الدرجة هنا
// في لوحة المعلمة بمقارنة المحاولات مع مفتاح الإجابة في ملفات المحتوى.
//
// صيغة المحاولات (attempts) قائمة نصوص:
//   • choice / pick : معرّف الخيار أو العنصر الذي اختارته الطالبة، مثل "color" أو "c"
//   • sort          : "معرّف_العنصر>معرّف_السلة" لكل إسقاط، مثل "a>red"
//   • tally-make    : العدد الذي رسمته بالإشارات، مثل "6"
//   • picto-make / bar-make : أعداد الصفوف أو الأعمدة مفصولة بفواصل، مثل "4,2,3"

export const MAX_TRIES = 3;

/** نتيجة سؤال واحد: score من 0 إلى 1 */
export function scoreQuestion(question, record) {
  const attempts = Array.isArray(record?.attempts) ? record.attempts : [];
  if (!question) return { score: 0, firstTry: false, solved: false, tries: attempts.length, known: false };

  if (question.type === 'sort') {
    const key = Object.fromEntries(question.items.map((it) => [it.id, it.bin]));
    const firstDrop = {};
    const solvedItems = new Set();
    for (const a of attempts) {
      const [itemId, binId] = String(a).split('>');
      if (!(itemId in key)) continue;
      if (!(itemId in firstDrop)) firstDrop[itemId] = binId;
      if (key[itemId] === binId) solvedItems.add(itemId);
    }
    const total = question.items.length;
    const firstCorrect = question.items.filter((it) => firstDrop[it.id] === it.bin).length;
    const score = total ? firstCorrect / total : 0;
    return {
      score,
      firstTry: firstCorrect === total,
      solved: solvedItems.size === total && !record?.revealed,
      tries: attempts.length,
      known: true,
      detail: `${firstCorrect} من ${total} صحيحة من أول مرة`,
    };
  }

  // choice / pick / tally-make / picto-make / bar-make
  const answer = String(question.answer);
  const idx = attempts.findIndex((a) => a === answer);
  const score = idx === 0 ? 1 : idx === 1 ? 0.5 : 0;
  return {
    score,
    firstTry: idx === 0,
    solved: idx >= 0,
    tries: attempts.length,
    known: true,
    detail: idx === 0 ? 'صحيحة من أول محاولة' : idx > 0 ? `صحيحة في المحاولة ${idx + 1}` : 'لم تصل للإجابة',
  };
}

/**
 * يجمع إجابات طالبة واحدة: يعتمد أول سجل لكل سؤال (الأقدم)،
 * وتُعدّ السجلات اللاحقة «إعادة لعب» لا تغيّر الدرجة.
 */
export function firstRecords(answers) {
  const sorted = [...answers].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  const map = new Map();
  const replays = new Map();
  for (const rec of sorted) {
    if (!map.has(rec.questionId)) map.set(rec.questionId, rec);
    else replays.set(rec.questionId, (replays.get(rec.questionId) || 0) + 1);
  }
  return { map, replays };
}

export function starsFor(score) {
  if (score >= 0.9) return 3;
  if (score >= 0.6) return 2;
  return 1;
}
