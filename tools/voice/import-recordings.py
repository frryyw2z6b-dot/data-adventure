#!/usr/bin/env python3
"""استيراد تسجيلات صوت المعلمة من صفحة record.html إلى اللعبة.

الاستخدام:
  python tools/voice/import-recordings.py noura-voice-69.zip [--out public/voice]

لكل تسجيل: يقص الصمت من البداية والنهاية، ويزيل الطنين المنخفض، ويوحّد مستوى الصوت،
ثم يحفظه MP3 باسم مفتاح الجملة نفسه فيحل محل الصوت المولَّد آليًا.
الجمل غير المسجّلة تبقى بالصوت المولَّد.
"""
import argparse, json, os, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FILTER = ','.join([
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
    'areverse',
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15',
    'areverse',
    'highpass=f=80',
    'adelay=120|120',
    'apad=pad_dur=0.15',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('zip')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'voice'))
    a = ap.parse_args()
    lines = {l['key']: l['text'] for l in json.load(open(os.path.join(ROOT, 'public', 'voice', 'manifest.json')))}
    z = zipfile.ZipFile(a.zip)
    done, skipped = [], []
    with tempfile.TemporaryDirectory() as tmp:
        for name in z.namelist():
            key, ext = os.path.splitext(os.path.basename(name))
            if ext.lower() not in ('.webm', '.m4a', '.mp4', '.ogg', '.wav', '.mp3'):
                continue
            if key not in lines:
                skipped.append(name)
                continue
            src = os.path.join(tmp, os.path.basename(name))
            with open(src, 'wb') as f:
                f.write(z.read(name))
            dst = os.path.join(a.out, key + '.mp3')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', FILTER, '-ar', '24000', '-ac', '1', '-b:a', '64k', dst], check=True)
            done.append(key)
    missing = [k for k in lines if k not in done]
    print(f'imported {len(done)} recordings, {len(missing)} lines keep the generated voice, {len(skipped)} unknown files skipped')
    for k in missing:
        print('  not recorded:', lines[k])

if __name__ == '__main__':
    sys.exit(main())
