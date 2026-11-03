// الصوت في اللعبة — كله يمر عبر Web Audio حتى يمكن قياسه والتحكم فيه:
//
//   مؤثرات (sfx) ─┐
//   موسيقى (music)├─► master ─► analyser ─► السماعات
//   صوت نورة (voice)┘
//
// • المتصفحات تمنع الصوت قبل أول تفاعل؛ نفتح سياق الصوت عند أول لمسة أو نقرة أو ضغطة مفتاح في أي مكان.
// • صوت نورة ملفات MP3 مولَّدة مسبقًا (public/voice) لكل جملة؛ وإذا تعذّر تحميل ملف
//   نستخدم القارئ الصوتي العربي في الجهاز (speechSynthesis) إن وُجد.
// • الموسيقى تنخفض تلقائيًا أثناء كلام نورة.
import { voiceKey } from '../shared/voiceKey.js';

const HIJAZ_D = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];
const PREF_KEY = 'da:v1:audio';
const VOICE_BASE = new URL('./voice/', document.baseURI).href;

function loadPrefs() {
  try {
    return { sound: true, music: true, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
  } catch {
    return { sound: true, music: true };
  }
}

export class Audio {
  constructor() {
    const prefs = loadPrefs();
    this.enabled = prefs.sound;
    this.musicEnabled = prefs.music;
    this.ctx = null;
    this.buffers = new Map();
    this.pending = new Map();
    this.current = null; // الجملة التي تُنطق الآن
    this.listeners = new Set();
    this.speaking = false;
    this.deviceVoice = null;
    this.stats = { clipsPlayed: 0, clipFallbacks: 0, sfxPlayed: 0 };

    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.deviceVoice =
          voices.find((v) => v.lang === 'ar-SA') || voices.find((v) => v.lang?.toLowerCase().startsWith('ar')) || null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }

    // فتح الصوت عند أول تفاعل في أي مكان من الصفحة
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend?.();
      else if (this.unlocked) this.ctx.resume?.();
    });
  }

  get state() {
    return this.ctx?.state || 'none';
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn(this);
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 1 : 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    // محدِّد أمان يمنع أي تشوّه أو ارتفاع مفاجئ قبل السماعات
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;
    this.master.connect(this.limiter).connect(this.analyser).connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.75;
    this.sfx.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicEnabled ? 0.3 : 0;
    this.musicBus.connect(this.master);

    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1.0;
    this.voiceAnalyser = ctx.createAnalyser();
    this.voiceAnalyser.fftSize = 512;
    this.voiceBus.connect(this.voiceAnalyser);
    this.voiceBus.connect(this.master);

    this.noiseBuf = this.makeNoise();
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.32;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 2200;
    lp.Q.value = -6;
    this.echo.connect(lp).connect(fb).connect(this.echo);
    lp.connect(this.musicBus);
    this.levelBuf = new Float32Array(1024);
    return ctx;
  }

  /** تُستدعى داخل حدث لمس/نقر: تفتح الصوت (ومنه صوت iOS الصامت) */
  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.unlocked) {
      // تشغيل عيّنة صامتة داخل حدث المستخدم يفتح الصوت في Safari على iPad
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      if ('speechSynthesis' in window) {
        try {
          speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }
    }
    const first = !this.unlocked;
    if (ctx.state !== 'running') ctx.resume().then(() => this.emit()).catch(() => {});
    this.unlocked = true;
    if (this.wantMusic) this.startAmbience();
    if (first) this.emit();
  }

  savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ sound: this.enabled, music: this.musicEnabled }));
    } catch {
      /* ignore */
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.savePrefs();
    if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04);
    if (!on) this.stopVoice();
    this.emit();
  }

  setMusic(on) {
    this.musicEnabled = on;
    this.savePrefs();
    if (on) this.startAmbience();
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? this.musicLevel() : 0, this.ctx.currentTime, 0.2);
    this.emit();
  }

  musicLevel() {
    return this.speaking ? 0.1 : 0.3;
  }

  /** مستوى الصوت الخارج الآن (0..1) — للاختبار ولمؤشر «اختبار الصوت» */
  level(analyser = this.analyser) {
    if (!analyser || this.ctx?.state !== 'running') return 0;
    const buf = this.levelBuf.subarray(0, analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }
  voiceLevel() {
    return this.level(this.voiceAnalyser);
  }

  // ── صوت نورة ──
  clipUrl(text) {
    return VOICE_BASE + voiceKey(text) + '.mp3';
  }

  loadClip(text) {
    const key = voiceKey(text);
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const ctx = this.ensureContext();
    const p = fetch(this.clipUrl(text))
      .then((r) => {
        if (!r.ok) throw new Error('clip ' + r.status);
        return r.arrayBuffer();
      })
      .then(
        (data) =>
          new Promise((res, rej) => {
            // صيغة الاستدعاء القديمة تعمل على Safari القديم أيضًا؛ ونلتقط وعد الصيغة الحديثة حتى لا يُرمى خطأ غير معالج
            const p = ctx.decodeAudioData(data, res, rej);
            if (p && typeof p.catch === 'function') p.catch(rej);
          }),
      )
      .then((buf) => {
        this.buffers.set(key, buf);
        this.pending.delete(key);
        return buf;
      })
      .catch((err) => {
        this.pending.delete(key);
        throw err;
      });
    this.pending.set(key, p);
    return p;
  }

  /** تحميل مسبق لجمل المرحلة حتى تُنطق فورًا */
  preload(texts) {
    for (const t of texts) this.loadClip(t).catch(() => {});
  }

  stopVoice() {
    if (this.current?.src) {
      try {
        this.current.src.onended = null;
        this.current.src.stop();
      } catch {
        /* ignore */
      }
    }
    this.current?.resolve?.();
    this.current = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.setSpeaking(false);
  }

  setSpeaking(on) {
    this.speaking = on;
    if (this.musicBus && this.musicEnabled) this.musicBus.gain.setTargetAtTime(this.musicLevel(), this.ctx.currentTime, 0.15);
    this.onSpeaking?.(on);
  }

  /** تنطق الجملة؛ تعود بوعد يكتمل عند انتهاء الكلام */
  say(text) {
    this.stopVoice();
    if (!this.enabled || !text) return Promise.resolve();
    const ctx = this.ensureContext();
    const token = {};
    this.current = token;
    return new Promise((resolve) => {
      token.resolve = resolve;
      if (!ctx) return this.sayDevice(text, token, resolve);
      this.loadClip(text)
        .then((buf) => {
          if (this.current !== token) return resolve();
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(this.voiceBus);
          token.src = src;
          src.onended = () => {
            if (this.current === token) {
              this.current = null;
              this.setSpeaking(false);
            }
            resolve();
          };
          this.setSpeaking(true);
          src.start();
          this.stats.clipsPlayed++;
        })
        .catch(() => {
          if (this.current !== token) return resolve();
          this.stats.clipFallbacks++;
          this.sayDevice(text, token, resolve);
        });
    });
  }

  sayDevice(text, token, resolve) {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.deviceVoice?.lang || 'ar-SA';
    if (this.deviceVoice) u.voice = this.deviceVoice;
    u.rate = 0.9;
    u.pitch = 1.2;
    u.onstart = () => this.setSpeaking(true);
    u.onend = u.onerror = () => {
      if (this.current === token) {
        this.current = null;
        this.setSpeaking(false);
      }
      resolve();
    };
    speechSynthesis.speak(u);
  }

  // ── المؤثرات ──
  makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** بعد أول تفاعل تُجدوَل الأصوات حتى لو كان السياق ما زال يستأنف */
  ready() {
    return Boolean(this.ctx && this.unlocked && this.ctx.state !== 'closed');
  }

  get canSpeak() {
    return true;
  }

  tone(freq, { type = 'sine', start = 0, dur = 0.2, gain = 0.3, slideTo = null, dest = null } = {}) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
    if (!dest) this.stats.sfxPlayed++;
  }

  noise({ start = 0, dur = 0.5, gain = 0.2, from = 400, to = 2400, q = 1.2 } = {}) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  /** نقرة وترية بطابع العود (Karplus-Strong مبسّط) */
  pluck(freq, { start = 0, gain = 0.5, dest = null } = {}) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const burst = this.ctx.createGain();
    burst.gain.setValueAtTime(gain, t);
    burst.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    const delay = this.ctx.createDelay(0.05);
    delay.delayTime.value = 1 / freq;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.94;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    // بلا رنين: حلقة التغذية الراجعة يجب أن يبقى كسبها أقل من ١ في كل الترددات وإلا انفجر الصوت
    lp.Q.value = -6;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(1, t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    src.connect(burst).connect(delay);
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(out);
    out.connect(dest || this.sfx);
    if (dest === this.musicBus) out.connect(this.echo);
    src.start(t);
    src.stop(t + 0.05);
    setTimeout(() => {
      try {
        out.disconnect();
        delay.disconnect();
      } catch {
        /* ignore */
      }
    }, (start + 2.2) * 1000);
  }

  tap() {
    this.tone(880, { type: 'triangle', dur: 0.07, gain: 0.18 });
  }
  pickup() {
    this.tone(420, { type: 'sine', dur: 0.14, gain: 0.25, slideTo: 760 });
  }
  drop() {
    this.tone(180, { type: 'sine', dur: 0.18, gain: 0.35, slideTo: 90 });
  }
  mark() {
    this.tone(1200, { type: 'triangle', dur: 0.05, gain: 0.12 });
    this.noise({ dur: 0.08, gain: 0.08, from: 3000, to: 1500, q: 2 });
  }
  correct() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, { type: 'triangle', start: i * 0.07, dur: 0.35, gain: 0.22 });
      this.tone(f * 2, { type: 'sine', start: i * 0.07, dur: 0.25, gain: 0.05 });
    });
  }
  wrong() {
    this.tone(330, { type: 'sine', dur: 0.22, gain: 0.22 });
    this.tone(262, { type: 'sine', start: 0.16, dur: 0.3, gain: 0.2 });
  }
  whoosh() {
    this.noise({ dur: 1.1, gain: 0.22, from: 250, to: 3200, q: 0.8 });
  }
  pop() {
    this.tone(600, { type: 'sine', dur: 0.09, gain: 0.2, slideTo: 1200 });
  }
  fanfare() {
    const seq = [392, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => this.tone(f, { type: 'triangle', start: i * 0.12, dur: 0.4, gain: 0.22 }));
    [523.25, 659.25, 783.99].forEach((f) => this.tone(f, { type: 'sawtooth', start: 0.9, dur: 1.4, gain: 0.05 }));
    [0, 0.12, 0.24, 0.84].forEach((s) => this.drum(s));
  }
  drum(start = 0, dest = null) {
    this.tone(110, { type: 'sine', start, dur: 0.3, gain: 0.5, slideTo: 55, dest });
  }

  // ── الموسيقى الخلفية: نسيم + لحن عود هادئ على مقام الحجاز + دف خفيف ──
  startAmbience() {
    this.wantMusic = true;
    if (!this.ready() || this.musicOn) return;
    this.musicOn = true;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(f.frequency);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start();
    lfo.start();

    // قرار هادئ مستمر (درون) على الدوكاه
    const drone = ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.value = HIJAZ_D[0] / 4;
    const dg = ctx.createGain();
    dg.gain.value = 0.05;
    drone.connect(dg).connect(this.musicBus);
    drone.start();

    let degree = 0;
    const phrase = () => {
      if (!this.musicOn) return;
      if (this.ready()) {
        const notes = 4 + Math.floor(Math.random() * 3);
        let t = 0;
        for (let i = 0; i < notes; i++) {
          degree = Math.max(0, Math.min(7, degree + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
          if (i === notes - 1) degree = Math.random() > 0.5 ? 0 : 4;
          this.pluck(HIJAZ_D[degree] / 2, { start: t, gain: 0.34, dest: this.musicBus });
          if (Math.random() > 0.7) this.pluck(HIJAZ_D[degree] / 2, { start: t + 0.12, gain: 0.18, dest: this.musicBus });
          t += [0.36, 0.48, 0.72][Math.floor(Math.random() * 3)];
        }
        this.pluck(HIJAZ_D[0] / 4, { start: 0, gain: 0.25, dest: this.musicBus });
        for (let b = 0; b < t; b += 0.72) this.drum(b, this.musicBus);
        this.phraseTimer = setTimeout(phrase, (t + 2.2 + Math.random() * 1.6) * 1000);
      } else {
        this.phraseTimer = setTimeout(phrase, 1000);
      }
    };
    this.phraseTimer = setTimeout(phrase, 400);
  }
}
