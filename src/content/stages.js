// بيانات المراحل الخمس لوحدة «تمثيل البيانات» — الصف الثاني الابتدائي.
// `available: false` يعني أن المرحلة تظهر في الخريطة كـ«قريبًا» حتى يُبنى نشاطها.
import stage1 from './stage1.json';

export const STAGES = [
  {
    id: 1,
    title: 'الفرز والتصنيف',
    place: 'واحة النخيل',
    badge: 'مستكشفة الفرز',
    available: true,
    content: stage1,
  },
  { id: 2, title: 'جداول الإشارات', place: 'سوق القرية', badge: 'مستكشفة الإشارات', available: false, content: null },
  { id: 3, title: 'التمثيل بالصور', place: 'قلعة الحصن', badge: 'مستكشفة الصور', available: false, content: null },
  { id: 4, title: 'الأعمدة البيانية', place: 'برج المراقبة', badge: 'مستكشفة الأعمدة', available: false, content: null },
  { id: 5, title: 'قراءة البيانات والاستنتاج', place: 'خيمة الحكماء', badge: 'مستكشفة البيانات', available: false, content: null },
];

export function getStage(id) {
  return STAGES.find((s) => s.id === Number(id)) || null;
}

export function getQuestion(stageId, questionId) {
  const stage = getStage(stageId);
  return stage?.content?.questions.find((q) => q.id === questionId) || null;
}
