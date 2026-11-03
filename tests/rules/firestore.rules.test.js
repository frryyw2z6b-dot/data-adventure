// اختبارات قواعد الأمان على محاكي Firestore الحقيقي.
// التشغيل: npm run test:rules   (يتطلب Java)
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

const CODE = 'ABCD23';
const OTHER = 'WXYZ89';
let env;

const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const teacher = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } }).firestore();

const answer = (uid, extra = {}) => ({
  uid,
  stageId: 1,
  questionId: 's1-q1',
  attempts: ['a>red'],
  revealed: false,
  contentVersion: 's1-draft-1',
  ts: serverTimestamp(),
  ...extra,
});

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-data-adventure',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'teachers/t1'), { name: 'المعلمة' });
    await setDoc(doc(db, 'teachers/t2'), { name: 'معلمة أخرى' });
    await setDoc(doc(db, `classes/${CODE}`), { teacherUid: 't1', name: 'ثاني أ', active: true, createdAt: new Date() });
    await setDoc(doc(db, `classes/${OTHER}`), { teacherUid: 't2', name: 'ثاني ب', active: true, createdAt: new Date() });
    await setDoc(doc(db, `classes/${CODE}/students/s1`), { name: 'سارة', stage: 0, joinedAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, `classes/${CODE}/students/s2`), { name: 'نورة', stage: 0, joinedAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, `classes/${CODE}/answers/x1`), { ...answer('s2'), ts: new Date() });
  });
});

describe('الطالبة', () => {
  it('تنضم إلى فصل نشط بحسابها فقط', async () => {
    const db = anon('s3');
    await assertSucceeds(
      setDoc(doc(db, `classes/${CODE}/students/s3`), {
        name: 'ريم',
        stage: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db, `classes/${CODE}/students/s4`), {
        name: 'انتحال',
        stage: 0,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('لا تنضم بمرحلة متقدمة أو حقول إضافية', async () => {
    const db = anon('s3');
    await assertFails(
      setDoc(doc(db, `classes/${CODE}/students/s3`), {
        name: 'ريم',
        stage: 5,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db, `classes/${CODE}/students/s3`), {
        name: 'ريم',
        stage: 0,
        score: 100,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('لا تقرأ بيانات طالبة أخرى ولا تسرد الطالبات', async () => {
    const db = anon('s1');
    await assertSucceeds(getDoc(doc(db, `classes/${CODE}/students/s1`)));
    await assertFails(getDoc(doc(db, `classes/${CODE}/students/s2`)));
    await assertFails(getDocs(collection(db, `classes/${CODE}/students`)));
  });

  it('لا تقرأ أي إجابات (حتى إجاباتها)', async () => {
    const db = anon('s1');
    await assertFails(getDoc(doc(db, `classes/${CODE}/answers/x1`)));
    await assertFails(getDocs(collection(db, `classes/${CODE}/answers`)));
    await assertFails(getDocs(query(collection(db, `classes/${CODE}/answers`), where('uid', '==', 's1'))));
  });

  it('تسجّل إجابتها باسمها فقط', async () => {
    const db = anon('s1');
    await assertSucceeds(addDoc(collection(db, `classes/${CODE}/answers`), answer('s1')));
    await assertFails(addDoc(collection(db, `classes/${CODE}/answers`), answer('s2')));
  });

  it('لا تستطيع إرسال درجة أو وقت مزوّر', async () => {
    const db = anon('s1');
    await assertFails(addDoc(collection(db, `classes/${CODE}/answers`), answer('s1', { score: 1 })));
    await assertFails(addDoc(collection(db, `classes/${CODE}/answers`), answer('s1', { ts: new Date(2020, 1, 1) })));
  });

  it('لا تعدّل إجابة ولا تحذفها بعد إرسالها', async () => {
    const db = anon('s2');
    await assertFails(updateDoc(doc(db, `classes/${CODE}/answers/x1`), { attempts: ['a>yellow'] }));
    await assertFails(deleteDoc(doc(db, `classes/${CODE}/answers/x1`)));
  });

  it('لا تكتب في فصل لم تنضم إليه', async () => {
    const db = anon('s1');
    await assertFails(addDoc(collection(db, `classes/${OTHER}/answers`), answer('s1')));
  });

  it('لا تكتب في فصل مغلق', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), `classes/${CODE}`), { active: false }));
    const db = anon('s1');
    await assertFails(addDoc(collection(db, `classes/${CODE}/answers`), answer('s1')));
  });

  it('تحدّث مرحلتها للأمام فقط ولا تغيّر اسمها', async () => {
    const db = anon('s1');
    const me = doc(db, `classes/${CODE}/students/s1`);
    await assertSucceeds(updateDoc(me, { stage: 1, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(me, { stage: 0, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(me, { name: 'اسم آخر', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, `classes/${CODE}/students/s2`), { stage: 1, updatedAt: serverTimestamp() }));
  });

  it('لا تسرد الفصول ولا تنشئ فصلًا ولا تمنح نفسها صفة معلمة', async () => {
    const db = anon('s1');
    await assertSucceeds(getDoc(doc(db, `classes/${CODE}`)));
    await assertFails(getDocs(collection(db, 'classes')));
    await assertFails(
      setDoc(doc(db, 'classes/QQQQ22'), { teacherUid: 's1', name: 'x', active: true, createdAt: serverTimestamp() }),
    );
    await assertFails(setDoc(doc(db, 'teachers/s1'), { name: 'x' }));
  });

  it('لا يصل غير المسجّل لأي شيء', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `classes/${CODE}`)));
    await assertFails(addDoc(collection(db, `classes/${CODE}/answers`), answer('s1')));
  });
});

describe('قائمة الأسماء', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), `classes/${CODE}`), { roster: ['ريم', 'هيا'] }));
  });

  it('لا تنضم إلا طالبة اسمها في القائمة', async () => {
    await assertSucceeds(
      setDoc(doc(anon('s5'), `classes/${CODE}/students/s5`), { name: 'ريم', stage: 0, joinedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(anon('s6'), `classes/${CODE}/students/s6`), { name: 'غريبة', stage: 0, joinedAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
  });

  it('المعلمة فقط تعدّل القائمة، وبحد أعلى ٤٠ اسمًا', async () => {
    await assertSucceeds(updateDoc(doc(teacher('t1'), `classes/${CODE}`), { roster: ['ريم'] }));
    await assertFails(updateDoc(doc(anon('s1'), `classes/${CODE}`), { roster: ['ريم'] }));
    await assertFails(updateDoc(doc(teacher('t2'), `classes/${CODE}`), { roster: ['ريم'] }));
    await assertFails(updateDoc(doc(teacher('t1'), `classes/${CODE}`), { roster: Array.from({ length: 41 }, (_, i) => `ط${i}`) }));
  });
});

describe('المعلمة', () => {
  it('تقرأ طالبات وإجابات فصلها لحظيًا', async () => {
    const db = teacher('t1');
    await assertSucceeds(getDocs(collection(db, `classes/${CODE}/students`)));
    await assertSucceeds(getDocs(collection(db, `classes/${CODE}/answers`)));
  });

  it('لا ترى فصل معلمة أخرى', async () => {
    const db = teacher('t1');
    await assertFails(getDocs(collection(db, `classes/${OTHER}/students`)));
    await assertFails(getDocs(collection(db, `classes/${OTHER}/answers`)));
    await assertFails(getDocs(collection(db, 'classes')));
    await assertSucceeds(getDocs(query(collection(db, 'classes'), where('teacherUid', '==', 't1'))));
  });

  it('لا تعدّل إجابات الطالبات', async () => {
    const db = teacher('t1');
    await assertFails(updateDoc(doc(db, `classes/${CODE}/answers/x1`), { attempts: ['a>red'] }));
  });

  it('تنشئ فصلًا برمز صالح باسمها فقط', async () => {
    const db = teacher('t1');
    await assertSucceeds(
      setDoc(doc(db, 'classes/NEWC23'), { teacherUid: 't1', name: 'ثاني ج', active: true, createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db, 'classes/NEWC24'), { teacherUid: 't2', name: 'x', active: true, createdAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(db, 'classes/bad'), { teacherUid: 't1', name: 'x', active: true, createdAt: serverTimestamp() }),
    );
    // لا تستولي على فصل موجود لمعلمة أخرى
    await assertFails(
      setDoc(doc(db, `classes/${OTHER}`), { teacherUid: 't1', name: 'x', active: true, createdAt: serverTimestamp() }),
    );
  });

  it('حساب بريد غير مسجّل في قائمة المعلمات لا يرى شيئًا', async () => {
    const db = teacher('intruder');
    await assertFails(getDocs(collection(db, `classes/${CODE}/answers`)));
    await assertFails(
      setDoc(doc(db, 'classes/NEWC25'), { teacherUid: 'intruder', name: 'x', active: true, createdAt: serverTimestamp() }),
    );
  });

  it('حساب مجهول يحمل uid معلمة لا يُعامل كمعلمة', async () => {
    const db = anon('t1');
    await assertFails(getDocs(collection(db, `classes/${CODE}/answers`)));
  });
});
