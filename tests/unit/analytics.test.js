import { describe, it, expect } from 'vitest';
import { summarize, classSkills, toCsv } from '../../src/teacher/analytics.js';

const students = [
  { uid: 'a', name: 'سارة', stage: 1, joinedAt: 1, updatedAt: 1 },
  { uid: 'b', name: 'نورة', stage: 0, joinedAt: 1, updatedAt: 1 },
];
const answers = [
  { uid: 'a', stageId: 1, questionId: 's1-q6', attempts: ['color'], revealed: false, ts: 10 },
  { uid: 'a', stageId: 1, questionId: 's1-q5', attempts: ['a', 'b', 'd'], revealed: true, ts: 11 },
  { uid: 'b', stageId: 2, questionId: 's2-q3', attempts: ['5', '6'], revealed: false, ts: 12 },
  // إعادة لعب لا تغيّر الدرجة
  { uid: 'a', stageId: 1, questionId: 's1-q5', attempts: ['c'], revealed: false, ts: 20 },
];

describe('تحليلات لوحة المعلمة', () => {
  const rows = summarize(students, answers, ['سارة', 'نورة', 'هيا']);
  const sara = rows.find((r) => r.name === 'سارة');
  const noura = rows.find((r) => r.name === 'نورة');

  it('يحسب الدرجة من أول سجل لكل سؤال', () => {
    expect(sara.answered).toBe(2);
    expect(sara.score).toBeCloseTo(0.5);
    expect(sara.revealed).toBe(1);
    expect(sara.per.find((p) => p.q.id === 's1-q5').replays).toBe(1);
  });

  it('يعدّ المحاولات والخاطئة منها', () => {
    expect(sara.attempts).toBe(4);
    expect(sara.wrongAttempts).toBe(3);
    expect(noura.wrongAttempts).toBe(1);
  });

  it('يحدد المهارات التي تحتاج دعمًا', () => {
    expect(sara.weakSkills).toContain('sort-odd');
    expect(sara.weakSkills).not.toContain('sort-rule');
    expect(noura.weakSkills).toContain('tally-make'); // ٥٠٪ < ٦٠٪
  });

  it('يُظهر من في القائمة ولم تدخل', () => {
    const haya = rows.find((r) => r.name === 'هيا');
    expect(haya.joined).toBe(false);
  });

  it('ملخص المهارات للفصل', () => {
    const odd = classSkills(rows).find((s) => s.skill === 'sort-odd');
    expect(odd.avg).toBe(0);
    expect(odd.needSupport).toEqual(['سارة']);
  });

  it('CSV يبدأ بـ BOM ويحمي من حقن الصيغ', () => {
    const csv = toCsv(summarize([{ uid: 'x', name: '=HYPERLINK("x")', stage: 0 }], []));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.split('\r\n')[0]).toContain('مهارات تحتاج دعمًا');
  });
});
