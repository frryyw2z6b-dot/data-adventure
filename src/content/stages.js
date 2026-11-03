// المراحل الخمس لوحدة «تمثيل البيانات» — الصف الثاني الابتدائي.
import stage1 from './stage1.json';
import stage2 from './stage2.json';
import stage3 from './stage3.json';
import stage4 from './stage4.json';
import stage5 from './stage5.json';

/** المهارات التي تتابعها لوحة المعلمة */
export const SKILLS = {
  'sort-attribute': 'الفرز حسب اللون أو الشكل',
  'sort-category': 'التصنيف في مجموعات',
  'sort-odd': 'تمييز الشيء المختلف',
  'sort-rule': 'معرفة قاعدة الفرز',
  'tally-read': 'قراءة إشارات العد',
  'tally-make': 'العدّ وتسجيل الإشارات',
  'tally-compare': 'المقارنة في جدول الإشارات',
  'picto-read': 'قراءة التمثيل بالصور',
  'picto-compare': 'المقارنة في التمثيل بالصور',
  'picto-make': 'إنشاء تمثيل بالصور',
  'bar-read': 'قراءة الأعمدة البيانية',
  'bar-compare': 'المقارنة بالأعمدة البيانية',
  'bar-make': 'إنشاء أعمدة بيانية',
  'data-diff': 'إيجاد الفرق (كم يزيد/ينقص)',
  'data-total': 'إيجاد المجموع',
  'data-compare': 'المقارنة والتساوي',
  'data-infer': 'الاستنتاج من البيانات',
};

// خيارات الأرقام تُكتب في الملفات كنصوص ("3") وتُعرض بالأرقام العربية
const AR = (s) => String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
function normalize(content) {
  for (const q of content.questions) {
    if (Array.isArray(q.options)) {
      q.options = q.options.map((o) => (typeof o === 'object' ? o : { id: String(o), label: AR(o) }));
    }
    // إجابة أنشطة البناء تُشتق من بيانات الجدول
    if (q.type === 'tally-make') q.answer = String(q.items.length);
    if (q.type === 'picto-make' || q.type === 'bar-make') q.answer = q.rows.map((r) => r.count).join(',');
  }
  return content;
}

export const STAGES = [
  { id: 1, title: 'الفرز والتصنيف', place: 'واحة النخيل', badge: 'مستكشفة الفرز', content: normalize(stage1) },
  { id: 2, title: 'جداول الإشارات', place: 'سوق القرية', badge: 'مستكشفة الإشارات', content: normalize(stage2) },
  { id: 3, title: 'التمثيل بالصور', place: 'قلعة الحصن', badge: 'مستكشفة الصور', content: normalize(stage3) },
  { id: 4, title: 'الأعمدة البيانية', place: 'برج المراقبة', badge: 'مستكشفة الأعمدة', content: normalize(stage4) },
  { id: 5, title: 'قراءة البيانات والاستنتاج', place: 'خيمة الحكماء', badge: 'مستكشفة البيانات', content: normalize(stage5) },
].map((s) => ({ ...s, available: true }));

export const ALL_QUESTIONS = STAGES.flatMap((s) => s.content.questions.map((q) => ({ ...q, stageId: s.id })));

export function getStage(id) {
  return STAGES.find((s) => s.id === Number(id)) || null;
}

export function getQuestion(stageId, questionId) {
  const stage = getStage(stageId);
  return stage?.content?.questions.find((q) => q.id === questionId) || null;
}
