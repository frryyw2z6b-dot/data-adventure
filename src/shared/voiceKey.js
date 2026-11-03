// مفتاح ثابت لكل جملة منطوقة (FNV-1a) — يستخدمه المتصفح وأداة توليد الأصوات معًا
export function normalizeSpeech(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

export function voiceKey(text) {
  const s = normalizeSpeech(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
