import { firebaseConfig, isFirebaseConfigured } from './config.js';

let studentPromise = null;
let teacherPromise = null;

/** واجهة الطالبة: انضمام لفصل وتسجيل الإجابات */
export function getStudentBackend() {
  if (!studentPromise) {
    studentPromise = isFirebaseConfigured()
      ? import('./firebase.js').then((m) => m.createStudentBackend(firebaseConfig))
      : import('./local.js').then((m) => m.createStudentBackend());
  }
  return studentPromise;
}

/** واجهة المعلمة: الدخول وإدارة الفصول ومتابعة النتائج مباشرة */
export function getTeacherBackend() {
  if (!teacherPromise) {
    teacherPromise = isFirebaseConfigured()
      ? import('./firebase.js').then((m) => m.createTeacherBackend(firebaseConfig))
      : import('./local.js').then((m) => m.createTeacherBackend());
  }
  return teacherPromise;
}
