# إعداد Firebase على الخطة المجانية Spark

هذا الدليل لا يتطلب ربط بطاقة بنكية ولا تفعيل أي خطة مدفوعة. المشروع يستخدم فقط خدمات متاحة مجانًا في Spark:
**Authentication** (دخول مجهول + بريد وكلمة مرور)، و**Cloud Firestore**، و**Hosting**.
لا يستخدم Cloud Functions ولا Storage، لأنهما يتطلبان الخطة المدفوعة.

> حدود Spark اليومية لـ Firestore: 50,000 قراءة و20,000 كتابة. تكتب الطالبة سجلًا واحدًا لكل سؤال، فالفصل المكوّن من 30 طالبة يكتب نحو 150 سجلًا في المرحلة الأولى، وهذا أقل كثيرًا من الحد.

## ١. إنشاء المشروع

1. ادخلي إلى [console.firebase.google.com](https://console.firebase.google.com) ثم **Add project / إضافة مشروع**.
2. اختاري اسمًا (مثل `data-adventure`). يمكنك إيقاف Google Analytics، فهو غير مطلوب.
3. تأكدي أن الخطة الظاهرة أسفل القائمة الجانبية هي **Spark**. لا تضغطي «Upgrade».

## ٢. إضافة تطبيق ويب

1. من **Project settings ← General ← Your apps** اضغطي أيقونة الويب `</>`.
2. اكتبي اسمًا للتطبيق. **لا** تفعّلي Firebase Hosting من هذه الشاشة، فسنفعّله من سطر الأوامر.
3. ستظهر قيم `firebaseConfig`. انسخيها إلى ملف `.env` في جذر المشروع (انسخيه من `.env.example`):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> هذه القيم ليست أسرارًا، فهي تظهر في أي موقع يستخدم Firebase. الحماية الفعلية تأتي من قواعد الأمان في `firestore.rules`.

## ٣. تفعيل طرق الدخول

**Build ← Authentication ← Get started ← Sign-in method**، ثم فعّلي:

- **Anonymous**: لدخول الطالبات دون بريد.
- **Email/Password**: لدخول المعلمات.

ثم من **Settings ← Authorized domains** تأكدي من وجود نطاق الاستضافة (`<project-id>.web.app`). يُضاف تلقائيًا عادةً.

## ٤. إنشاء قاعدة Cloud Firestore

**Build ← Firestore Database ← Create database**:

- الموقع: اختاري الأقرب، مثل `me-central2 (Dammam)` إن ظهر، وإلا فأي موقع في أوروبا. **لا يمكن تغيير الموقع لاحقًا.**
- اختاري **Start in production mode**. سنرفع قواعدنا الخاصة بعد قليل.

## ٥. حساب المعلمة

1. **Authentication ← Users ← Add user**: أدخلي بريد المعلمة وكلمة مرور قوية.
2. انسخي **User UID** الظاهر للحساب.
3. **Firestore Database ← Start collection**:
   - Collection ID: `teachers`
   - Document ID: الصقي الـ **UID** نفسه
   - أضيفي حقلًا: `name` (string) = اسم المعلمة
4. كرري الخطوات لكل معلمة. **أي حساب غير موجود في `teachers` لا يستطيع فتح اللوحة.**

## ٦. النشر

```bash
npm install
npx firebase login
cp .firebaserc.example .firebaserc     # ثم ضعي معرّف مشروعك داخله
npm run deploy                         # يبني ثم يرفع الموقع وقواعد الأمان
```

بعد النشر:

- اللعبة: `https://<project-id>.web.app/`
- لوحة المعلمة: `https://<project-id>.web.app/teacher.html`

## ٧. الاستخدام في الحصة

1. تدخل المعلمة إلى اللوحة، وتضغط **«+ فصل جديد»**، ثم تعرض رمز الفصل (٦ أحرف) على السبورة.
2. تفتح الطالبة رابط اللعبة، وتكتب اسمها والرمز، ثم تبدأ المغامرة.
3. تظهر كل إجابة في اللوحة فور حدوثها. اضغطي اسم طالبة لرؤية خطوات حلها سؤالًا بسؤال.
4. **«إغلاق الفصل»** يمنع أي انضمام أو إجابة جديدة. **«تصدير النتائج»** يحفظ ملف CSV يُفتح في Excel.

## اختبار قواعد الأمان محليًا (اختياري)

يتطلب Java 11 أو أحدث:

```bash
npm run test:rules
```

يشغّل محاكي Firestore الرسمي ويتحقق من أن الطالبة لا تقرأ بيانات غيرها، ولا تعدّل إجاباتها، ولا ترسل درجة مزوّرة، وأن المعلمة لا ترى إلا فصولها.
