// رموز الفصول: 6 أحرف وأرقام بلا أحرف ملتبسة (بلا I و O و 0 و 1).
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
export const DEMO_CLASS_CODE = 'NAJD26';

export function generateClassCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function normalizeCode(raw) {
  // يقبل الأرقام العربية-الهندية ويحوّلها، ويزيل المسافات
  const map = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
  return String(raw || '')
    .replace(/[٠-٩]/g, (d) => map[d])
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function normalizeName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 30);
}
