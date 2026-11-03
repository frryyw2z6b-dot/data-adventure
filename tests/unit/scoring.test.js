import { describe, it, expect } from 'vitest';
import { scoreQuestion, firstRecords, starsFor } from '../../src/shared/scoring.js';
import { normalizeCode, CODE_PATTERN, DEMO_CLASS_CODE } from '../../src/shared/classCode.js';
import { ALL_QUESTIONS } from '../../src/content/stages.js';

const q = (id) => ALL_QUESTIONS.find((x) => x.id === id);

describe('scoreQuestion', () => {
  it('الفرز: كل العناصر صحيحة من أول مرة = 1', () => {
    const r = scoreQuestion(q('s1-q1'), { attempts: ['a>red', 'b>yellow', 'c>red', 'd>yellow', 'e>yellow', 'f>red'] });
    expect(r.score).toBe(1);
    expect(r.firstTry).toBe(true);
    expect(r.solved).toBe(true);
  });

  it('الفرز: خطأ أول في عنصر واحد يحتسب جزئيًا', () => {
    const r = scoreQuestion(q('s1-q1'), {
      attempts: ['a>yellow', 'a>red', 'b>yellow', 'c>red', 'd>yellow', 'e>yellow', 'f>red'],
    });
    expect(r.score).toBeCloseTo(5 / 6);
    expect(r.solved).toBe(true);
  });

  it('الفرز: كشف الإجابة لا يُعد حلًا', () => {
    const r = scoreQuestion(q('s1-q1'), { attempts: ['a>yellow', 'a>red'], revealed: true });
    expect(r.solved).toBe(false);
  });

  it('الاختيار: أول محاولة 1، الثانية 0.5، وما بعدها 0', () => {
    expect(scoreQuestion(q('s1-q6'), { attempts: ['color'] }).score).toBe(1);
    expect(scoreQuestion(q('s1-q6'), { attempts: ['shape', 'color'] }).score).toBe(0.5);
    expect(scoreQuestion(q('s1-q6'), { attempts: ['shape', 'size', 'color'] }).score).toBe(0);
    expect(scoreQuestion(q('s1-q5'), { attempts: ['a', 'b', 'd'] }).solved).toBe(false);
  });

  it('أنشطة البناء تُصحَّح بمقارنة القيمة المرسلة', () => {
    expect(scoreQuestion(q('s2-q3'), { attempts: ['6'] }).score).toBe(1);
    expect(scoreQuestion(q('s2-q3'), { attempts: ['5', '6'] }).score).toBe(0.5);
    expect(scoreQuestion(q('s3-q4'), { attempts: ['4,2,3'] }).firstTry).toBe(true);
    expect(scoreQuestion(q('s4-q4'), { attempts: ['5,3,3', '5,3,4'] }).score).toBe(0.5);
  });

  it('لا يثق بسلاسل غريبة في المحاولات', () => {
    const r = scoreQuestion(q('s1-q1'), { attempts: ['zzz>red', '<script>', 'a>red'] });
    expect(r.score).toBeCloseTo(1 / 6);
  });
});

describe('firstRecords', () => {
  it('يعتمد أول سجل لكل سؤال ويعدّ الإعادات', () => {
    const { map, replays } = firstRecords([
      { questionId: 'q', ts: 20, attempts: ['x'] },
      { questionId: 'q', ts: 10, attempts: ['y'] },
    ]);
    expect(map.get('q').attempts).toEqual(['y']);
    expect(replays.get('q')).toBe(1);
  });
});

describe('helpers', () => {
  it('starsFor', () => {
    expect(starsFor(1)).toBe(3);
    expect(starsFor(0.7)).toBe(2);
    expect(starsFor(0.2)).toBe(1);
  });
  it('رمز الفصل يقبل الأرقام العربية والأحرف الصغيرة', () => {
    expect(normalizeCode(' najd٢٦ ')).toBe('NAJD26');
    expect(CODE_PATTERN.test(DEMO_CLASS_CODE)).toBe(true);
  });
});

