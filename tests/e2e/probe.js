// يُحمَّل في صفحة طالبة أثناء الاختبار الشامل: يحاول قراءة بيانات الأخريات بجلسة الطالبة نفسها.
// المتوقع: كل المحاولات تُرفض من قواعد الأمان.
import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, where, serverTimestamp } from 'firebase/firestore';

export async function tryReadOthers(code, otherUid) {
  const app = getApp('student');
  const db = getFirestore(app);
  const me = getAuth(app).currentUser.uid;
  const attempt = async (label, fn) => {
    try {
      await fn();
      return [label, 'ALLOWED'];
    } catch (e) {
      return [label, e.code === 'permission-denied' ? 'denied' : e.code || e.message];
    }
  };
  return Object.fromEntries(
    await Promise.all([
      attempt('list all answers', () => getDocs(collection(db, 'classes', code, 'answers'))),
      attempt('own answers', () => getDocs(query(collection(db, 'classes', code, 'answers'), where('uid', '==', me)))),
      attempt('list students', () => getDocs(collection(db, 'classes', code, 'students'))),
      attempt('read other student', () => getDoc(doc(db, 'classes', code, 'students', otherUid))),
      attempt('forge answer as other', () =>
        addDoc(collection(db, 'classes', code, 'answers'), { uid: otherUid, stageId: 1, questionId: 's1-q1', attempts: ['x'], revealed: false, contentVersion: 'x', ts: serverTimestamp() }),
      ),
      attempt('add score field', () =>
        addDoc(collection(db, 'classes', code, 'answers'), { uid: me, stageId: 1, questionId: 's1-q1', attempts: ['x'], revealed: false, contentVersion: 'x', ts: serverTimestamp(), score: 100 }),
      ),
      attempt('jump to stage 5', () => updateDoc(doc(db, 'classes', code, 'students', me), { stage: 5, name: 'x', updatedAt: serverTimestamp() })),
    ]),
  );
}
