// الربط الفعلي مع Firebase (الخطة المجانية Spark):
//   • Authentication: دخول مجهول للطالبات + بريد وكلمة مرور للمعلمات
//   • Cloud Firestore: تخزين الإجابات وتحديث لوحة المعلمة لحظيًا عبر onSnapshot
// لا يستخدم أي خدمة تتطلب الخطة المدفوعة (لا Cloud Functions ولا Storage).
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  memoryLocalCache,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { BackendError } from './errors.js';
import { CODE_PATTERN, generateClassCode, normalizeCode, normalizeName } from '../shared/classCode.js';

const SESSION_KEY = 'da:v1:fb-session';

// للتطوير والاختبار فقط: VITE_FIREBASE_EMULATORS=true يوجّه الاتصال إلى المحاكيات المحلية
const USE_EMULATORS = import.meta.env.VITE_FIREBASE_EMULATORS === 'true';
function wireEmulators(auth, db) {
  if (!USE_EMULATORS) return;
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

// تطبيقان منفصلان حتى لا تختلط جلسة المعلمة بجلسة الطالبة على الجهاز نفسه
function appFor(name, config) {
  return getApps().find((a) => a.name === name) || initializeApp(config, name);
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

function mapError(err) {
  if (err instanceof BackendError) return err;
  const code = err?.code || '';
  if (code === 'unavailable' || code === 'auth/network-request-failed') return new BackendError('network');
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  )
    return new BackendError('auth-failed');
  console.error(err);
  return new BackendError('unknown', err?.message);
}

const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeSession = (s) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

export async function createStudentBackend(config) {
  const app = appFor('student', config);
  const auth = getAuth(app);
  let db;
  try {
    // ذاكرة محلية دائمة: إن انقطع الإنترنت تُحفظ الإجابات وتُرسَل تلقائيًا لاحقًا
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
  }
  wireEmulators(auth, db);

  await auth.authStateReady();
  let session = readSession();
  let currentStage = 0;

  async function ensureSignedIn() {
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser;
  }

  return {
    mode: 'firebase',

    restoreSession() {
      if (!session || !auth.currentUser || auth.currentUser.uid !== session.uid) return null;
      return { ...session };
    },

    async lookupClass(rawCode) {
      const code = normalizeCode(rawCode);
      if (!CODE_PATTERN.test(code)) throw new BackendError('bad-code');
      try {
        await ensureSignedIn();
        const snap = await getDoc(doc(db, 'classes', code));
        if (!snap.exists()) throw new BackendError('class-not-found');
        const cls = snap.data();
        if (!cls.active) throw new BackendError('class-inactive');
        return { code, name: cls.name, roster: Array.isArray(cls.roster) ? cls.roster : [] };
      } catch (err) {
        throw mapError(err);
      }
    },

    async joinClass(rawCode, rawName) {
      const code = normalizeCode(rawCode);
      const name = normalizeName(rawName);
      if (!name) throw new BackendError('bad-name');
      if (!CODE_PATTERN.test(code)) throw new BackendError('bad-code');
      try {
        const user = await ensureSignedIn();
        const clsSnap = await getDoc(doc(db, 'classes', code));
        if (!clsSnap.exists()) throw new BackendError('class-not-found');
        const cls = clsSnap.data();
        if (!cls.active) throw new BackendError('class-inactive');
        if (Array.isArray(cls.roster) && cls.roster.length && !cls.roster.includes(name)) throw new BackendError('not-in-roster');

        const meRef = doc(db, 'classes', code, 'students', user.uid);
        const meSnap = await getDoc(meRef);
        let finalName = name;
        if (meSnap.exists()) {
          finalName = meSnap.data().name;
          currentStage = meSnap.data().stage || 0;
        } else {
          await setDoc(meRef, { name, stage: 0, joinedAt: serverTimestamp(), updatedAt: serverTimestamp() });
          currentStage = 0;
        }
        session = { code, uid: user.uid, name: finalName, className: cls.name };
        writeSession(session);
        return { ...session, stage: currentStage };
      } catch (err) {
        throw mapError(err);
      }
    },

    async recordAnswer({ stageId, questionId, attempts, revealed, contentVersion }) {
      if (!session) throw new BackendError('unknown', 'no session');
      // لا ننتظر تأكيد الخادم: Firestore يحفظها محليًا ويرسلها عند توفر الاتصال
      addDoc(collection(db, 'classes', session.code, 'answers'), {
        uid: session.uid,
        stageId,
        questionId,
        attempts: attempts.map(String).slice(0, 80),
        revealed: Boolean(revealed),
        contentVersion,
        ts: serverTimestamp(),
      }).catch((err) => console.error('recordAnswer', err));
    },

    async reportStage(stage) {
      if (!session || stage <= currentStage) return;
      currentStage = stage;
      updateDoc(doc(db, 'classes', session.code, 'students', session.uid), {
        stage,
        updatedAt: serverTimestamp(),
      }).catch((err) => console.error('reportStage', err));
    },

    leave() {
      session = null;
      writeSession(null);
    },
  };
}

export async function createTeacherBackend(config) {
  const app = appFor('teacher', config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  wireEmulators(auth, db);

  async function assertTeacher(user) {
    const snap = await getDoc(doc(db, 'teachers', user.uid));
    if (!snap.exists()) {
      await signOut(auth);
      throw new BackendError('not-teacher');
    }
  }

  return {
    mode: 'firebase',

    onTeacherAuth(cb) {
      return onAuthStateChanged(auth, async (user) => {
        if (!user || user.isAnonymous) return cb(null);
        try {
          await assertTeacher(user);
          cb({ uid: user.uid, email: user.email });
        } catch {
          cb(null);
        }
      });
    },

    async teacherSignIn(email, password) {
      try {
        const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
        await assertTeacher(cred.user);
        return { uid: cred.user.uid, email: cred.user.email };
      } catch (err) {
        throw mapError(err);
      }
    },

    async teacherSignOut() {
      await signOut(auth);
    },

    async listMyClasses() {
      const uid = auth.currentUser?.uid;
      if (!uid) return [];
      const snap = await getDocs(query(collection(db, 'classes'), where('teacherUid', '==', uid)));
      return snap.docs
        .map((d) => ({ code: d.id, ...d.data(), createdAt: toMillis(d.data().createdAt) }))
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async createClass(rawName) {
      const uid = auth.currentUser?.uid;
      const name = String(rawName || '').trim().slice(0, 60) || 'فصل جديد';
      // في حال تصادم الرمز مع فصل موجود ترفض القواعد الكتابة، فنعيد المحاولة برمز آخر
      for (let i = 0; i < 5; i++) {
        const code = generateClassCode();
        try {
          await setDoc(doc(db, 'classes', code), { teacherUid: uid, name, active: true, createdAt: serverTimestamp() });
          return { code, teacherUid: uid, name, active: true, createdAt: Date.now() };
        } catch (err) {
          if (err?.code !== 'permission-denied') throw mapError(err);
        }
      }
      throw new BackendError('unknown', 'could not allocate class code');
    },

    async setRoster(code, names) {
      await updateDoc(doc(db, 'classes', code), { roster: names.map(normalizeName).filter(Boolean).slice(0, 40) });
    },

    async setClassActive(code, active) {
      await updateDoc(doc(db, 'classes', code), { active: Boolean(active) });
    },

    watchStudents(code, cb) {
      return onSnapshot(collection(db, 'classes', code, 'students'), (snap) => {
        cb(
          snap.docs.map((d) => {
            const v = d.data({ serverTimestamps: 'estimate' });
            return { uid: d.id, ...v, joinedAt: toMillis(v.joinedAt), updatedAt: toMillis(v.updatedAt) };
          }),
        );
      });
    },

    watchAnswers(code, cb) {
      return onSnapshot(collection(db, 'classes', code, 'answers'), (snap) => {
        cb(
          snap.docs.map((d) => {
            const v = d.data({ serverTimestamps: 'estimate' });
            return { id: d.id, ...v, ts: toMillis(v.ts) };
          }),
        );
      });
    },

    async removeStudent(code, uid) {
      const answers = await getDocs(query(collection(db, 'classes', code, 'answers'), where('uid', '==', uid)));
      const docs = [...answers.docs.map((d) => d.ref), doc(db, 'classes', code, 'students', uid)];
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    },
  };
}
