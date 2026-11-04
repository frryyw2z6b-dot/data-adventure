#!/usr/bin/env python3
"""توليد أصوات نورة لكل جمل اللعبة (دون إنترنت).

المتطلبات (مرة واحدة):
  pip install sherpa-onnx==1.12.40 soundfile numpy
  نموذج الصوت: vits-piper-ar_JO-SA_dii-high من إصدارات sherpa-onnx على GitHub
    https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-ar_JO-SA_dii-high.tar.bz2
  ffmpeg مع مرشح rubberband

الاستخدام (صوت نورة المعتمد: صوت نسائي سعودي ar_JO-SA_dii-high):
  node tools/voice/list-lines.mjs > tools/voice/lines.json
  python tools/voice/generate.py --model-dir <vits-piper-ar_JO-SA_dii-high> --asr-dir <whisper> --speed 0.88

يوحّد مستوى الصوت،
ثم (اختياريًا) يتحقق من وضوح كل ملف بتفريغه بنموذج Whisper ومقارنته بالنص.
"""
import argparse, json, os, re, subprocess, difflib, tempfile
import numpy as np, soundfile as sf, sherpa_onnx

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'voice')

def tts(model_dir, noise=0.5, noise_w=0.6):
    name = [f for f in os.listdir(model_dir) if f.endswith('.onnx')][0]
    cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=os.path.join(model_dir, name), tokens=os.path.join(model_dir, 'tokens.txt'),
        data_dir=os.path.join(model_dir, 'espeak-ng-data'), noise_scale=noise, noise_scale_w=noise_w), num_threads=4))
    return sherpa_onnx.OfflineTts(cfg)

def strip(t):
    t = re.sub(r'[ً-ْٰـ،.!؟?,:]', '', t)
    for a, b in (('ة', 'ه'), ('أ', 'ا'), ('إ', 'ا'), ('آ', 'ا'), ('ى', 'ي'), ('ٱ', 'ا')):
        t = t.replace(a, b)
    return ' '.join(t.split())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model-dir', required=True)
    ap.add_argument('--asr-dir')
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--speed', type=float, default=0.88)
    ap.add_argument('--pitch', type=float, default=1.0, help='رفع الطبقة (1.0 = دون تغيير)')
    ap.add_argument('--noise', type=float, default=0.4)
    ap.add_argument('--noise-w', type=float, default=0.5)
    ap.add_argument('--takes', type=int, default=3, help='عدد المحاولات لكل جملة؛ يُختار أوضحها حسب Whisper')
    a = ap.parse_args()
    lines = json.load(open(os.path.join(ROOT, 'tools', 'voice', 'lines.json')))
    if a.only: lines = [l for l in lines if l['key'] in a.only]
    os.makedirs(OUT, exist_ok=True)
    engine = tts(a.model_dir, a.noise, a.noise_w)
    shift = f'rubberband=pitch={a.pitch}:formant=shifted:pitchq=quality,' if abs(a.pitch - 1) > 1e-3 else ''
    rec = None
    if a.asr_dir:
        d = a.asr_dir
        rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{d}/small-encoder.int8.onnx', decoder=f'{d}/small-decoder.int8.onnx',
                                                         tokens=f'{d}/small-tokens.txt', language='ar', task='transcribe', num_threads=4)
    report = []
    with tempfile.TemporaryDirectory() as tmp:
        for l in lines:
            best = None
            for take in range(a.takes if rec else 1):
                audio = engine.generate(l['text'], sid=0, speed=a.speed)
                raw = os.path.join(tmp, 'raw.wav')
                # صمت قصير في البداية والنهاية حتى لا تُقص الحروف
                pad = np.zeros(int(audio.sample_rate * 0.12), dtype=np.float32)
                sf.write(raw, np.concatenate([pad, np.array(audio.samples, dtype=np.float32), pad]), audio.sample_rate)
                mp3 = os.path.join(tmp, f'take{take}.mp3')
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af',
                                shift + 'highpass=f=90,loudnorm=I=-16:TP=-1.5:LRA=11',
                                '-ar', '24000', '-ac', '1', '-b:a', '48k', mp3], check=True)
                row = {'key': l['key'], 'text': l['text'], 'seconds': round(len(audio.samples) / audio.sample_rate, 2), 'file': mp3}
                if rec:
                    wav = os.path.join(tmp, 'chk.wav')
                    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ar', '16000', '-ac', '1', wav], check=True)
                    x, sr = sf.read(wav, dtype='float32')
                    s = rec.create_stream(); s.accept_waveform(sr, x); rec.decode_stream(s)
                    hyp = s.result.text.strip()
                    row['heard'] = hyp
                    row['score'] = round(difflib.SequenceMatcher(None, strip(l['text']), strip(hyp)).ratio(), 2)
                if best is None or row.get('score', 0) > best.get('score', 0):
                    best = dict(row)
                    os.replace(mp3, os.path.join(tmp, 'best.mp3'))
                if row.get('score', 0) >= 0.95:
                    break
            os.replace(os.path.join(tmp, 'best.mp3'), os.path.join(OUT, l['key'] + '.mp3'))
            best.pop('file', None)
            report.append(best)
            print(best.get('score', '-'), l['key'], l['text'], '=>', best.get('heard', ''), flush=True)
    json.dump(report, open(os.path.join(ROOT, 'tools', 'voice', 'report.json'), 'w'), ensure_ascii=False, indent=1)
    if not a.only:
        json.dump([{'key': l['key'], 'text': l['text']} for l in lines], open(os.path.join(OUT, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    if rec:
        sc = [r['score'] for r in report]
        print(f'mean intelligibility {np.mean(sc):.2f}, below 0.7: {sum(s < 0.7 for s in sc)}')

if __name__ == '__main__':
    main()
