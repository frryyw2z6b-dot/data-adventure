export class BackendError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// رسائل عربية مفهومة لكل خطأ
export const ERROR_MESSAGES = {
  'class-not-found': 'رمز الفصل غير صحيح. تأكدي منه مع معلمتك.',
  'class-inactive': 'هذا الفصل مغلق الآن. اطلبي من معلمتك فتحه.',
  'bad-name': 'اكتبي اسمك من فضلك.',
  'not-in-roster': 'هذا الاسم ليس في قائمة الفصل. اختاري اسمك من القائمة.',
  'bad-code': 'رمز الفصل يتكون من 6 أحرف وأرقام إنجليزية.',
  'not-teacher': 'هذا الحساب غير مسجَّل كمعلمة في المشروع.',
  'auth-failed': 'البريد أو كلمة المرور غير صحيحة.',
  network: 'تعذّر الاتصال بالإنترنت. ستُحفَظ الإجابات وتُرسَل عند عودة الاتصال.',
  unknown: 'حدث خطأ غير متوقع. حاولي مرة أخرى.',
};

export function errorMessage(err) {
  if (err?.code === 'not-teacher' && err.message && err.message !== 'not-teacher') {
    return `${ERROR_MESSAGES['not-teacher']} (رمز الحساب: ${err.message})`;
  }
  return ERROR_MESSAGES[err?.code] || ERROR_MESSAGES.unknown;
}
