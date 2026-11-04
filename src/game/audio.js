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

/** ملف WAV صامت قصير (لعنصر <audio> الذي يفتح جلسة التشغيل في iOS القديم) */
function silentWav() {
  const n = 2205; // ٠٫١ ثانية بتردد 22050
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 22050, true);
  v.setUint32(28, 44100, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  let bin = '';
  new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
  return 'data:audio/wav;base64,' + btoa(bin);
}

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

    this.raw = new Map(); // ملفات صوت محمّلة قبل وجود سياق الصوت (لم تُفك بعد)
    this.lastError = '';

    // فتح الصوت داخل أحداث «تفعيل المستخدم» فقط. في Safari على iPad لا يُعدّ pointerdown باللمس
    // تفعيلًا، فلا نستخدمه؛ ونكرر المحاولة مع كل لمسة حتى تصبح حالة السياق running فعلًا.
    const unlock = () => this.unlock();
    for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend?.().catch(() => {});
      // الاستئناف خارج اللمس قد يُرفض على iPad؛ اللمسة التالية تستأنفه عبر unlock()
      else this.ctx.resume?.().catch(() => {});
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

  /** يُنشأ السياق داخل لمسة المستخدم فقط (create=true من unlock)؛ إنشاؤه عند تحميل الصفحة يجعله معلّقًا على iPad */
  ensureContext(create = false) {
    if (this.ctx || !create) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    let ctx;
    try {
      ctx = new Ctx({ latencyHint: 'interactive' });
    } catch {
      ctx = new Ctx(); // Safari القديم لا يقبل خيارات
    }
    this.ctx = ctx;
    ctx.onstatechange = () => this.onState();
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
    this.musicBus.gain.value = this.musicEnabled ? this.musicLevel() : 0;
    this.musicBus.connect(this.master);

    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1.0;
    this.voiceAnalyser = ctx.createAnalyser();
    this.voiceAnalyser.fftSize = 512;
    this.voiceBus.connect(this.voiceAnalyser);
    this.voiceBus.connect(this.master);

    this.noiseBuf = this.makeNoise();
    // صدى بنقرتين ثابتتين دون حلقة تغذية راجعة (الحلقات غير موثوقة في Safari)
    this.echo = ctx.createGain();
    for (const [time, g] of [[0.3, 0.22], [0.6, 0.1]]) {
      const d = ctx.createDelay(1);
      d.delayTime.value = time;
      const dg = ctx.createGain();
      dg.gain.value = g;
      this.echo.connect(d).connect(dg).connect(this.musicBus);
    }
    this.pluckBuf = this.makePluck(220);
    this.levelBuf = new Float32Array(1024);
    return ctx;
  }

  /** تُستدعى داخل حدث لمس/نقر/ضغطة مفتاح (تفعيل المستخدم) */
  unlock() {
    this.setPlaybackSession();
    const ctx = this.ensureContext(true);
    if (!ctx) return;
    if (ctx.state !== 'running') {
      // عيّنة صامتة + resume() داخل الحدث نفسه: الطريقة التي يقبلها Safari على iPad
      try {
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        s.start(0);
      } catch (e) {
        this.lastError = 'silent-buffer: ' + e.message;
      }
      const p = ctx.resume?.();
      if (p && p.catch) p.catch((e) => (this.lastError = 'resume: ' + (e?.message || e)));
    }
    this.decodePending();
    this.onState();
  }

  /**
   * في iPadOS يتبع Web Audio وضع «الصامت» في الجهاز (فئة ambient) فلا يُسمع شيء.
   * نطلب فئة playback (Safari 16.4+)، وفي الإصدارات الأقدم نشغّل عنصر <audio> صامتًا
   * داخل اللمسة لأن عناصر الوسائط تحوّل جلسة الصوت إلى playback.
   */
  setPlaybackSession() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
    } catch (e) {
      this.lastError = 'audioSession: ' + e.message;
    }
    if (navigator.audioSession || !/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
    if (!this.sessionEl) {
      const el = document.createElement('audio');
      el.setAttribute('playsinline', '');
      el.setAttribute('x-webkit-airplay', 'deny');
      el.loop = true;
      el.preload = 'auto';
      el.src = silentWav();
      this.sessionEl = el;
    }
    if (this.sessionEl.paused) this.sessionEl.play().catch((e) => (this.lastError = 'session-audio: ' + e.message));
  }

  /** عند تغيّر حالة السياق: نبدأ الموسيقى المؤجلة ونحدّث الواجهة */
  onState() {
    const running = this.ctx?.state === 'running';
    if (running && !this.unlocked) {
      this.unlocked = true;
      this.decodePending();
    }
    if (running && this.wantMusic && !this.musicOn) this.startAmbience();
    this.emit();
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
    return this.speaking ? 0.2 : 0.55;
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

  fetchClip(key, text) {
    if (this.raw.has(key)) return this.raw.get(key);
    const p = fetch(this.clipUrl(text)).then((r) => {
      if (!r.ok) throw new Error('clip ' + r.status);
      return r.arrayBuffer();
    });
    p.catch(() => this.raw.delete(key));
    this.raw.set(key, p);
    return p;
  }

  decode(data) {
    return new Promise((res, rej) => {
      // صيغة الاستدعاء القديمة تعمل على Safari القديم أيضًا؛ ونلتقط وعد الصيغة الحديثة حتى لا يُرمى خطأ غير معالج
      // slice: Safari يستهلك المخزن عند فكّه، فنعطيه نسخة
      const p = this.ctx.decodeAudioData(data.slice(0), res, rej);
      if (p && typeof p.catch === 'function') p.catch(rej);
    });
  }

  loadClip(text) {
    const key = voiceKey(text);
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const raw = this.fetchClip(key, text);
    if (!this.ctx) return raw.then(() => Promise.reject(new Error('no-audio-context')));
    const p = raw
      .then((data) => this.decode(data))
      .then((buf) => {
        this.buffers.set(key, buf);
        this.pending.delete(key);
        return buf;
      })
      .catch((err) => {
        this.pending.delete(key);
        this.lastError = 'clip: ' + (err?.message || err);
        throw err;
      });
    this.pending.set(key, p);
    return p;
  }

  /** بعد إنشاء السياق: فك الملفات التي حُمّلت مسبقًا */
  decodePending() {
    if (!this.ctx || !this.preloadTexts) return;
    for (const t of this.preloadTexts) this.loadClip(t).catch(() => {});
    this.preloadTexts.clear();
  }

  /** تحميل مسبق لجمل المرحلة حتى تُنطق فورًا */
  preload(texts) {
    this.preloadTexts ||= new Set();
    for (const t of texts) {
      this.fetchClip(voiceKey(t), t).catch(() => {});
      if (this.ctx) this.loadClip(t).catch(() => {});
      else this.preloadTexts.add(t);
    }
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
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(); // قبل أول لمسة لا يمكن تشغيل أي صوت
    if (ctx.state !== 'running') ctx.resume?.().catch(() => {});
    const token = {};
    this.current = token;
    return new Promise((resolve) => {
      token.resolve = resolve;
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

  /** لا نجدول أصواتًا إلا والسياق يعمل فعلًا (وإلا تتراكم وتنطلق دفعة واحدة لاحقًا) */
  ready() {
    return this.ctx?.state === 'running';
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

  /**
   * نغمة وترية بطابع العود تُحسب مرة واحدة في JavaScript (خوارزمية Karplus-Strong)
   * ثم تُشغَّل بأي طبقة عبر playbackRate — دون عقد تغذية راجعة داخل Web Audio.
   */
  makePluck(base) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 2.2);
    const buf = this.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const period = Math.round(sr / base);
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % period;
      const v = 0.497 * (ring[idx] + ring[next]);
      out[i] = ring[idx];
      ring[idx] = v;
      idx = next;
      peak = Math.max(peak, Math.abs(out[i]));
    }
    for (let i = 0; i < len; i++) out[i] /= peak || 1;
    return buf;
  }

  pluck(freq, { start = 0, gain = 0.5, dest = null, dur = 1.6 } = {}) {
    if (!this.ready() || !this.pluckBuf) return;
    const t = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pluckBuf;
    src.playbackRate.value = freq / 220;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(g);
    g.connect(dest || this.sfx);
    if (dest === this.musicBus) g.connect(this.echo);
    src.start(t);
    src.stop(t + dur + 0.05);
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

  // ── الموسيقى الخلفية: لحن عود على مقام الحجاز + دف + قرار هادئ + نسيم ──
  // النغمات في المدى المتوسط (٢٩٠–٥٩٠ هرتز) حتى تُسمع من سماعات الأجهزة اللوحية الصغيرة.
  startAmbience() {
    this.wantMusic = true;
    if (!this.ready() || this.musicOn) return;
    this.musicOn = true;
    const ctx = this.ctx;

    // نسيم صحراوي
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 700;
    wf.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    wind.connect(wf).connect(wg).connect(this.musicBus);
    wind.start();

    // قرار هادئ مستمر (دوكاه وخامستها) يملأ الفراغ بين الجمل
    const pad = ctx.createGain();
    pad.gain.value = 0.045;
    pad.connect(this.musicBus);
    for (const [f, type] of [[146.83, 'triangle'], [220, 'sine'], [293.66, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(pad);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = ctx.createGain();
    lg.gain.value = 0.015;
    lfo.connect(lg).connect(pad.gain);
    lfo.start();

    let degree = 4;
    const BEAT = 0.42;
    const phrase = () => {
      if (!this.musicOn) return;
      if (!this.ready()) {
        this.phraseTimer = setTimeout(phrase, 800);
        return;
      }
      // جملة من ٨ نبضات: لحن متدرّج على مقام الحجاز ينتهي على القرار أو الخامسة
      const notes = 5 + Math.floor(Math.random() * 3);
      let t = 0.05;
      for (let i = 0; i < notes; i++) {
        degree = Math.max(0, Math.min(7, degree + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        if (i === notes - 1) degree = Math.random() > 0.5 ? 0 : 4;
        this.pluck(HIJAZ_D[degree], { start: t, gain: 0.5, dest: this.musicBus });
        if (Math.random() > 0.65) this.pluck(HIJAZ_D[degree], { start: t + BEAT / 2, gain: 0.28, dest: this.musicBus, dur: 0.8 });
        t += BEAT * (Math.random() > 0.7 ? 2 : 1);
      }
      this.pluck(HIJAZ_D[0] / 2, { start: 0.05, gain: 0.4, dest: this.musicBus, dur: 2 });
      // إيقاع دف: دُم ... تك تك
      const bars = Math.ceil(t / (BEAT * 4));
      for (let bar = 0; bar < bars; bar++) {
        const b0 = 0.05 + bar * BEAT * 4;
        this.daf(b0, 'dum');
        this.daf(b0 + BEAT * 2, 'tak');
        this.daf(b0 + BEAT * 3, 'tak');
      }
      this.phraseTimer = setTimeout(phrase, (bars * BEAT * 4 + 0.6 + Math.random() * 0.8) * 1000);
    };
    this.phraseTimer = setTimeout(phrase, 200);
  }

  daf(start, kind) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime + start;
    if (kind === 'dum') {
      this.tone(95, { start, dur: 0.28, gain: 0.35, slideTo: 60, dest: this.musicBus });
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = kind === 'dum' ? 900 : 2200;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(kind === 'dum' ? 0.18 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'dum' ? 0.12 : 0.07));
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random());
    src.stop(t + 0.15);
  }
}
