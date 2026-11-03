// يجمع كل الجمل المنطوقة في اللعبة: التعليمات والأسئلة والخيارات النصية والجمل الثابتة
// الاستخدام: node tools/voice/list-lines.mjs > tools/voice/lines.json
import { readFileSync } from 'node:fs';
import { LINES } from '../../src/content/lines.js';
import { voiceKey, normalizeSpeech } from '../../src/shared/voiceKey.js';

const texts = new Set(Object.values(LINES).flat());
for (let i = 1; i <= 5; i++) {
  const c = JSON.parse(readFileSync(new URL(`../../src/content/stage${i}.json`, import.meta.url)));
  texts.add(c.intro);
  for (const q of c.questions) {
    texts.add(q.prompt);
    // الخيارات النصية (بلا أيقونة ولا أرقام) تُقرأ للطالبة عند الطلب
    for (const o of q.options || []) if (typeof o === 'object' && !o.icon) texts.add(o.label);
  }
}
const out = [...texts].map((t) => ({ key: voiceKey(t), text: normalizeSpeech(t) }));
process.stdout.write(JSON.stringify(out, null, 1));
