// لوحة تشخيص الصوت — لا تظهر إلا بإضافة ?audiodebug=1 إلى الرابط.
// تعرض حالة سياق الصوت وتسمح باختبار الموسيقى والمؤثرات وصوت نورة كلًّا على حدة.
import { LINES } from '../content/lines.js';

export function mountAudioDebug(audio) {
  const box = document.createElement('div');
  box.id = 'audio-debug';
  box.dir = 'ltr';
  box.style.cssText =
    'position:fixed;z-index:99;bottom:8px;left:8px;max-width:min(420px,calc(100% - 16px));background:rgba(20,16,30,.92);color:#fff;font:13px/1.45 ui-monospace,Menlo,monospace;padding:10px;border-radius:12px;pointer-events:auto';
  box.innerHTML = `
    <div id="ad-info"></div>
    <div style="height:8px;background:#333;border-radius:4px;margin:6px 0"><i id="ad-meter" style="display:block;height:100%;width:0;background:#3cae5c;border-radius:4px"></i></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button data-t="music">music</button><button data-t="sfx">sfx</button><button data-t="voice">voice</button><button data-t="device">device TTS</button><button data-t="resume">resume()</button>
    </div>
    <div id="ad-log" style="margin-top:6px;max-height:120px;overflow:auto;white-space:pre-wrap"></div>`;
  document.body.appendChild(box);
  box.querySelectorAll('button').forEach((b) => (b.style.cssText = 'font:inherit;padding:6px 10px;border-radius:8px;border:0'));
  const log = (m) => (box.querySelector('#ad-log').textContent = `${new Date().toLocaleTimeString()} ${m}\n` + box.querySelector('#ad-log').textContent);
  let peak = 0;

  box.addEventListener('click', async (e) => {
    const t = e.target.dataset?.t;
    if (!t) return;
    audio.unlock();
    peak = 0;
    try {
      if (t === 'music') {
        if (!audio.musicEnabled) audio.setMusic(true);
        audio.startAmbience();
        audio.pluck(293.66 / 2, { gain: 0.5, dest: audio.musicBus });
        log('music: bus gain ' + audio.musicBus?.gain.value.toFixed(2));
      } else if (t === 'sfx') {
        audio.correct();
        log('sfx: correct()');
      } else if (t === 'voice') {
        const t0 = performance.now();
        await audio.loadClip(LINES.soundTest).then((b) => log(`clip decoded ${b.duration.toFixed(2)}s @${b.sampleRate}Hz`));
        await audio.say(LINES.soundTest);
        log(`voice done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      } else if (t === 'device') {
        const voices = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith('ar'));
        log('arabic device voices: ' + (voices.map((v) => v.name).join(', ') || 'none'));
        const u = new SpeechSynthesisUtterance(LINES.soundTest);
        u.lang = 'ar-SA';
        speechSynthesis.speak(u);
      } else if (t === 'resume') {
        await audio.ctx?.resume();
        log('resume → ' + audio.state);
      }
    } catch (err) {
      log('ERROR ' + t + ': ' + (err?.message || err));
    }
  });

  const info = box.querySelector('#ad-info');
  const meter = box.querySelector('#ad-meter');
  const tick = () => {
    const lv = audio.level();
    peak = Math.max(peak, lv);
    meter.style.width = Math.min(100, lv * 400) + '%';
    info.textContent = [
      `ctx: ${audio.state}  rate: ${audio.ctx?.sampleRate || '-'}  unlocked: ${Boolean(audio.unlocked)}`,
      `audioSession: ${navigator.audioSession ? navigator.audioSession.type : 'n/a'}  sessionEl: ${audio.sessionEl ? (audio.sessionEl.paused ? 'paused' : 'playing') : '-'}`,
      `sound: ${audio.enabled}  music: ${audio.musicEnabled} (on: ${Boolean(audio.musicOn)})  master: ${audio.master?.gain.value.toFixed(2) ?? '-'}`,
      `clips: ${audio.stats.clipsPlayed} played, ${audio.stats.clipFallbacks} fallback, ${audio.buffers.size} decoded  peak: ${peak.toFixed(3)}`,
      `last error: ${audio.lastError || '-'}`,
      navigator.userAgent.slice(0, 120),
    ].join('\n');
    requestAnimationFrame(tick);
  };
  tick();
  audio.onChange(() => log('state → ' + audio.state));
}
