// حسابات لوحة المعلمة (دوال صافية قابلة للاختبار)
import { STAGES, SKILLS, ALL_QUESTIONS, getQuestion } from '../content/stages.js';
import { scoreQuestion, firstRecords } from '../shared/scoring.js';

export const SUPPORT_THRESHOLD = 0.6; // أقل من ٦٠٪ في مهارة = تحتاج دعمًا

/**
 * يلخّص نتائج كل طالبة.
 * students: [{uid, name, stage, joinedAt, updatedAt}]
 * answers:  [{uid, stageId, questionId, attempts, revealed, ts}]
 * roster:   أسماء الفصل (اختيارية) لإظهار من لم تدخل بعد
 */
export function summarize(students, answers, roster = []) {
  const byStudent = new Map(students.map((s) => [s.uid, { ...s, answers: [] }]));
  for (const a of answers) {
    if (!byStudent.has(a.uid)) byStudent.set(a.uid, { uid: a.uid, name: 'طالبة محذوفة', stage: 0, answers: [] });
    byStudent.get(a.uid).answers.push(a);
  }
  const rows = [...byStudent.values()].map((s) => {
    const { map, replays } = firstRecords(s.answers);
    const per = [];
    const stages = {};
    const skills = {};
    let total = 0;
    let first = 0;
    let attempts = 0;
    let wrongAttempts = 0;
    let revealed = 0;
    for (const [qid, rec] of map) {
      const q = getQuestion(rec.stageId, qid);
      if (!q) continue;
      const r = scoreQuestion(q, rec);
      per.push({ q, rec, r, replays: replays.get(qid) || 0 });
      total += r.score;
      if (r.firstTry) first++;
      attempts += rec.attempts?.length || 0;
      if (rec.revealed) revealed++;
      wrongAttempts += Math.max(0, (rec.attempts?.length || 0) - (r.solved ? 1 : 0));
      const st = (stages[rec.stageId] ||= { sum: 0, n: 0 });
      st.sum += r.score;
      st.n++;
      const sk = (skills[q.skill] ||= { sum: 0, n: 0 });
      sk.sum += r.score;
      sk.n++;
    }
    const answered = per.length;
    const stageScores = Object.fromEntries(
      STAGES.map((st) => {
        const v = stages[st.id];
        const totalQs = st.content.questions.length;
        return [st.id, v ? { score: v.sum / v.n, answered: v.n, total: totalQs, done: v.n >= totalQs } : null];
      }),
    );
    const skillScores = Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { score: v.sum / v.n, n: v.n }]));
    const weakSkills = Object.entries(skillScores)
      .filter(([, v]) => v.score < SUPPORT_THRESHOLD)
      .sort((a, b) => a[1].score - b[1].score)
      .map(([k]) => k);
    const last = s.answers.reduce((m, a) => Math.max(m, a.ts || 0), s.updatedAt || s.joinedAt || 0);
    const stagesDone = STAGES.filter((st) => stageScores[st.id]?.done).length;
    return {
      ...s,
      joined: true,
      answered,
      score: answered ? total / answered : null,
      first,
      attempts,
      wrongAttempts,
      revealed,
      per,
      stageScores,
      skillScores,
      weakSkills,
      stagesDone,
      last,
    };
  });
  // من في القائمة ولم تدخل بعد
  const names = new Set(rows.map((r) => r.name));
  for (const name of roster) {
    if (!names.has(name))
      rows.push({ uid: `roster:${name}`, name, joined: false, answered: 0, score: null, attempts: 0, wrongAttempts: 0, revealed: 0, per: [], stageScores: {}, skillScores: {}, weakSkills: [], stagesDone: 0, last: 0, stage: 0 });
  }
  // أكثر من جهاز بالاسم نفسه
  const counts = {};
  rows.forEach((r) => r.joined && (counts[r.name] = (counts[r.name] || 0) + 1));
  rows.forEach((r) => (r.duplicate = r.joined && counts[r.name] > 1));
  return rows;
}

/** متوسط الفصل في كل مهارة وعدد من يحتجن دعمًا فيها */
export function classSkills(rows) {
  return Object.keys(SKILLS).map((skill) => {
    const vals = rows.map((r) => r.skillScores[skill]).filter(Boolean);
    const avg = vals.length ? vals.reduce((s, v) => s + v.score, 0) / vals.length : null;
    const needSupport = rows.filter((r) => r.weakSkills.includes(skill)).map((r) => r.name);
    return { skill, label: SKILLS[skill], avg, students: vals.length, needSupport };
  });
}

/** أداء الفصل في كل سؤال */
export function questionStats(rows) {
  return ALL_QUESTIONS.map((q) => {
    const recs = rows.map((r) => r.per.find((p) => p.q.id === q.id)).filter(Boolean);
    const avg = recs.length ? recs.reduce((s, p) => s + p.r.score, 0) / recs.length : null;
    return { q, n: recs.length, avg };
  });
}

/** ملف CSV يُفتح في Excel مباشرة (UTF-8 مع BOM) */
export function toCsv(rows) {
  const pct = (x) => (x == null ? '' : Math.round(x * 100));
  const header = [
    'الطالبة',
    'دخلت',
    'المراحل المكتملة',
    'الأسئلة المجابة',
    'الدرجة %',
    ...STAGES.map((s) => `م${s.id} ${s.title} %`),
    'عدد المحاولات',
    'محاولات خاطئة',
    'عُرضت الإجابة',
    'مهارات تحتاج دعمًا',
    ...ALL_QUESTIONS.map((q) => q.id),
  ];
  const lines = [header];
  for (const r of rows) {
    const byQ = new Map(r.per.map((p) => [p.q.id, p]));
    lines.push([
      r.name,
      r.joined ? 'نعم' : 'لا',
      r.stagesDone,
      r.answered,
      pct(r.score),
      ...STAGES.map((s) => pct(r.stageScores[s.id]?.score)),
      r.attempts,
      r.wrongAttempts,
      r.revealed,
      r.weakSkills.map((k) => SKILLS[k]).join('، '),
      ...ALL_QUESTIONS.map((q) => (byQ.has(q.id) ? pct(byQ.get(q.id).r.score) : '')),
    ]);
  }
  // تُسبق القيم التي تبدأ بـ = + - @ بعلامة ' لمنع حقن الصيغ في Excel
  return '﻿' + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(',')).join('\r\n');
}
