// تحويل المحاولات الخام إلى نص عربي مفهوم للمعلمة
const MODEL = {
  ball: 'كرة',
  cube: 'مكعب',
  cone: 'مخروط',
  star: 'نجمة',
  date: 'تمرة',
  orange: 'برتقالة',
  apple: 'تفاحة',
  cup: 'فنجان',
  dallah: 'دلة',
};
const COLOR = {
  red: 'أحمر',
  yellow: 'أصفر',
  blue: 'أزرق',
  green: 'أخضر',
  orange: 'برتقالي',
  purple: 'بنفسجي',
  brown: 'بني',
  white: 'أبيض',
};

export function itemName(spec) {
  if (!spec) return '؟';
  const m = MODEL[spec.model] || spec.model;
  return spec.color && COLOR[spec.color] ? `${m} (${COLOR[spec.color]})` : m;
}

function findItem(q, id) {
  const all = [...(q.items || []), ...(q.groups || []).flat()];
  return all.find((it) => it.id === id);
}

export function describeAttempt(q, raw) {
  const a = String(raw);
  if (!q) return { text: a, ok: false };
  if (q.type === 'sort') {
    const [itemId, binId] = a.split('>');
    const item = findItem(q, itemId);
    const bin = q.bins.find((b) => b.id === binId);
    return { text: `${itemName(item)} ← سلة «${bin?.label || binId}»`, ok: item?.bin === binId };
  }
  if (q.type === 'pick') return { text: `اختارت: ${itemName(findItem(q, a))}`, ok: a === q.answer };
  if (q.type === 'choice') {
    const o = q.options.find((x) => x.id === a);
    return { text: `اختارت: ${o?.label || a}`, ok: a === q.answer };
  }
  return { text: a, ok: false };
}

export function questionShort(q, fallback) {
  if (!q) return fallback;
  return q.prompt.length > 42 ? q.prompt.slice(0, 40) + '…' : q.prompt;
}
