// يتحقق من صحة محتوى المراحل الخمس رياضيًا وبنيويًا
import { describe, it, expect } from 'vitest';
import { STAGES, SKILLS, ALL_QUESTIONS } from '../../src/content/stages.js';
import { allLines } from '../../src/content/lines.js';

function evalCalc(q) {
  const rows = q.display.rows;
  const by = Object.fromEntries(rows.map((r) => [r.id, r.count]));
  const c = q.calc;
  switch (c.op) {
    case 'count': return String(by[c.row]);
    case 'max': return rows.reduce((a, b) => (b.count > a.count ? b : a)).id;
    case 'min': return rows.reduce((a, b) => (b.count < a.count ? b : a)).id;
    case 'diff': return String(by[c.a] - by[c.b]);
    case 'sum': return String(c.rows.reduce((s, r) => s + by[r], 0));
    case 'add': return String(by[c.row] + c.n);
    case 'equals': return rows.filter((r) => r.count === c.n).map((r) => r.id).join('|');
    case 'equalPair': {
      for (let i = 0; i < rows.length; i++)
        for (let j = i + 1; j < rows.length; j++) if (rows[i].count === rows[j].count) return `${rows[i].id}+${rows[j].id}`;
      return null;
    }
    default: throw new Error('unknown calc ' + c.op);
  }
}

describe('محتوى المراحل', () => {
  it('خمس مراحل متاحة ونهائية (لا أسئلة تجريبية)', () => {
    expect(STAGES).toHaveLength(5);
    for (const s of STAGES) {
      expect(s.content.status).toBe('final');
      expect(s.content.questions.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('معرّفات الأسئلة فريدة في كل المراحل', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('كل سؤال له مهارة معروفة ونص قصير', () => {
    for (const q of ALL_QUESTIONS) {
      expect(SKILLS[q.skill], q.id).toBeTruthy();
      const words = q.prompt.split(/\s+/).length;
      expect(words, q.id).toBeLessThanOrEqual(10);
    }
  });

  it('أسئلة الفرز: كل شيء له سلة موجودة', () => {
    for (const q of ALL_QUESTIONS.filter((x) => x.type === 'sort')) {
      const bins = new Set(q.bins.map((b) => b.id));
      for (const it of q.items) expect(bins.has(it.bin), q.id).toBe(true);
      for (const b of q.bins) expect(q.items.some((it) => it.bin === b.id), `${q.id} bin ${b.id} empty`).toBe(true);
    }
  });

  it('مفتاح الإجابة ضمن الخيارات، والخيارات بلا تكرار', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type === 'choice') {
        const ids = q.options.map((o) => o.id);
        expect(new Set(ids).size, q.id).toBe(ids.length);
        expect(ids, q.id).toContain(q.answer);
      }
      if (q.type === 'pick') expect(q.items.map((o) => o.id), q.id).toContain(q.answer);
    }
  });

  it('الإجابات المحسوبة تطابق البيانات المعروضة', () => {
    const withCalc = ALL_QUESTIONS.filter((q) => q.calc);
    expect(withCalc.length).toBeGreaterThan(15);
    for (const q of withCalc) expect(evalCalc(q), q.id).toBe(q.answer);
  });

  it('أنشطة البناء: إجابة مشتقة وأعداد مناسبة للصف الثاني', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type === 'tally-make') expect(Number(q.answer)).toBeLessThanOrEqual(10);
      if (q.type === 'picto-make' || q.type === 'bar-make') {
        for (const r of q.rows) expect(r.count >= 1 && r.count <= 8, q.id).toBe(true);
        expect(q.answer).toBe(q.rows.map((r) => r.count).join(','));
      }
      if (q.display) for (const r of q.display.rows) expect(r.count >= 1 && r.count <= 10, q.id).toBe(true);
    }
  });

  it('الجمل الثابتة موجودة', () => {
    expect(allLines().length).toBeGreaterThan(15);
  });
});
