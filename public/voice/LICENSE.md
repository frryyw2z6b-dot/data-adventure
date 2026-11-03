# أصوات نورة

ولِّدت هذه الملفات آليًا ودون إنترنت بالأداة `tools/voice/generate.py` من نموذج النطق المفتوح
**Piper ar_JO-kareem-medium** (عبر مشروع sherpa-onnx)، ثم رُفعت طبقة الصوت والرنين ليقترب من صوت طفلة.

- النموذج: https://github.com/k2-fsa/sherpa-onnx/releases (tts-models / vits-piper-ar_JO-kareem-medium)
- بيانات التدريب: https://github.com/AliMokhammad/arabicttstrain
- تحقّقنا من وضوح كل ملف بتفريغه آليًا بنموذج Whisper (التقرير في `tools/voice/report.json`).

للاستخدام التعليمي غير التجاري. لإعادة التوليد بعد تعديل الأسئلة راجعي `docs/CONTENT.md`.
