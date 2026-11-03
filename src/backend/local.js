// الوضع التجريبي المحلي: يحاكي Firestore داخل المتصفح (localStorage)
// ويبث التحديثات مباشرة بين التبويبات عبر BroadcastChannel،
// فتفتح المعلمة لوحة النتائج في تبويب والطالبة تلعب في تبويب آخر وترى النتائج تتحدث فورًا.
// البيانات هنا لا تغادر هذا المتصفح.
import { BackendError } from './errors.js';
import { CODE_PATTERN, DEMO_CLASS_CODE, generateClassCode, normalizeCode, normalizeName } from '../shared/classCode.js';

const PREFIX = 'da:v1:';
const LOCAL_TEACHER = 'local-teacher';

const safeStorage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* التخزين غير متاح (نافذة خاصة مثلًا) — نتابع في الذاكرة */
    }
  },
};

let channel = null;
try {
  channel = new BroadcastChannel('data-adventure');
} catch {
  channel = null;
}
const listeners = new Set();

function notify(code) {
  for (const fn of listeners) fn(code);
  channel?.postMessage({ code });
}
channel?.addEventListener('message', (e) => {
  for (const fn of listeners) fn(e.data?.code);
});
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith(PREFIX)) for (const fn of listeners) fn(null);
  });
}

function subscribe(code, read, cb) {
  const handler = (changed) => {
    if (!changed || changed === code) cb(read());
  };
  listeners.add(handler);
  queueMicrotask(() => cb(read()));
  return () => listeners.delete(handler);
}

function classes() {
  const all = safeStorage.get('classes', {});
  if (!all[DEMO_CLASS_CODE]) {
    all[DEMO_CLASS_CODE] = { teacherUid: LOCAL_TEACHER, name: 'الفصل التجريبي', active: true, createdAt: Date.now() };
    safeStorage.set('classes', all);
  }
  return all;
}

const studentsOf = (code) => safeStorage.get(`students:${code}`, {});
const answersOf = (code) => safeStorage.get(`answers:${code}`, []);

function randomId(len = 20) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}

export function createStudentBackend() {
  let session = safeStorage.get('session', null);

  return {
    mode: 'local',

    restoreSession() {
      if (!session) return null;
      const cls = classes()[session.code];
      if (!cls || !studentsOf(session.code)[session.uid]) return null;
      return { ...session };
    },

    async joinClass(rawCode, rawName) {
      const code = normalizeCode(rawCode);
      const name = normalizeName(rawName);
      if (!name) throw new BackendError('bad-name');
      if (!CODE_PATTERN.test(code)) throw new BackendError('bad-code');
      const cls = classes()[code];
      if (!cls) throw new BackendError('class-not-found');
      if (!cls.active) throw new BackendError('class-inactive');

      const students = studentsOf(code);
      // في الوضع المحلي: الاسم نفسه في الفصل نفسه يعيد الطالبة لسجلها
      let uid = Object.keys(students).find((id) => students[id].name === name);
      if (!uid) {
        uid = 'local-' + randomId(12);
        students[uid] = { name, stage: 0, joinedAt: Date.now(), updatedAt: Date.now() };
        safeStorage.set(`students:${code}`, students);
        notify(code);
      }
      session = { code, uid, name: students[uid].name, className: cls.name };
      safeStorage.set('session', session);
      return { ...session };
    },

    async recordAnswer({ stageId, questionId, attempts, revealed, contentVersion }) {
      if (!session) throw new BackendError('unknown', 'no session');
      const cls = classes()[session.code];
      if (!cls?.active) throw new BackendError('class-inactive');
      const list = answersOf(session.code);
      list.push({
        id: randomId(),
        uid: session.uid,
        stageId,
        questionId,
        attempts: attempts.map(String).slice(0, 80),
        revealed: Boolean(revealed),
        contentVersion,
        ts: Date.now(),
      });
      safeStorage.set(`answers:${session.code}`, list);
      notify(session.code);
    },

    async reportStage(stage) {
      if (!session) return;
      const students = studentsOf(session.code);
      const me = students[session.uid];
      if (!me || stage <= me.stage) return;
      me.stage = stage;
      me.updatedAt = Date.now();
      safeStorage.set(`students:${session.code}`, students);
      notify(session.code);
    },

    leave() {
      session = null;
      safeStorage.set('session', null);
    },
  };
}

export function createTeacherBackend() {
  const user = { uid: LOCAL_TEACHER, email: '' };

  return {
    mode: 'local',

    onTeacherAuth(cb) {
      queueMicrotask(() => cb(user));
      return () => {};
    },
    async teacherSignIn() {
      return user;
    },
    async teacherSignOut() {},

    async listMyClasses() {
      return Object.entries(classes())
        .filter(([, c]) => c.teacherUid === LOCAL_TEACHER)
        .map(([code, c]) => ({ code, ...c }))
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    async createClass(rawName) {
      const name = String(rawName || '').trim().slice(0, 60) || 'فصل جديد';
      const all = classes();
      let code = generateClassCode();
      while (all[code]) code = generateClassCode();
      all[code] = { teacherUid: LOCAL_TEACHER, name, active: true, createdAt: Date.now() };
      safeStorage.set('classes', all);
      return { code, ...all[code] };
    },

    async setClassActive(code, active) {
      const all = classes();
      if (!all[code]) return;
      all[code].active = Boolean(active);
      safeStorage.set('classes', all);
      notify(code);
    },

    watchStudents(code, cb) {
      return subscribe(code, () => Object.entries(studentsOf(code)).map(([uid, s]) => ({ uid, ...s })), cb);
    },

    watchAnswers(code, cb) {
      return subscribe(code, () => answersOf(code), cb);
    },

    async removeStudent(code, uid) {
      const students = studentsOf(code);
      delete students[uid];
      safeStorage.set(`students:${code}`, students);
      safeStorage.set(
        `answers:${code}`,
        answersOf(code).filter((a) => a.uid !== uid),
      );
      notify(code);
    },
  };
}
