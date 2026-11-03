// كل الأصوات مولَّدة داخل المتصفح (Web Audio) — لا ملفات صوتية ولا حقوق نشر:
//   • نغمات تفاعل (التقاط، إسقاط، صحيح، حاولي مجددًا، احتفال)
//   • نسيم صحراوي ولحن هادئ بنقرات وترية تشبه العود على مقام الحجاز
//   • قراءة السؤال بصوت عربي إن توفر في الجهاز (speechSynthesis)

const HIJAZ_D = [293.66, 311.13, 369.99, 392.0, 440.0, 466.16, 523.25, 587.33];

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = false;
    try {
      this.enabled = localStorage.getItem('da:v1:sound') !== 'off';
    } catch {
      /* ignore */
    }
    this.voice = null;
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice =
          voices.find((v) => v.lang === 'ar-SA') || voices.find((v) => v.lang?.toLowerCase().startsWith('ar')) || null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  /** يجب استدعاؤها بعد أول لمسة من المستخدم (سياسة المتصفحات) */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.8;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.32;
      this.music.connect(this.master);
      this.noiseBuf = this.makeNoise();
      // صدى خفيف للحن
      this.echo = this.ctx.createDelay(1);
      this.echo.delayTime.value = 0.32;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.28;
      const lp = this.ctx.createBiquadFilter();
      lp.frequency.value = 2200;
      this.echo.connect(lp).connect(fb).connect(this.echo);
      lp.connect(this.music);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem('da:v1:sound', on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  get canSpeak() {
    return 'speechSynthesis' in window;
  }

  say(text) {
    if (!this.enabled || !this.canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.voice?.lang || 'ar-SA';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.88;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  tone(freq, { type = 'sine', start = 0, dur = 0.2, gain = 0.3, slideTo = null, dest = null } = {}) {
    if (!this.ctx) return;
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
  }

  noise({ start = 0, dur = 0.5, gain = 0.2, from = 400, to = 2400, q = 1.2 } = {}) {
    if (!this.ctx) return;
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

  /** نقرة وترية (Karplus-Strong مبسّط) بطابع العود */
  pluck(freq, { start = 0, gain = 0.5, dest = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const burst = this.ctx.createGain();
    burst.gain.setValueAtTime(gain, t);
    burst.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    const delay = this.ctx.createDelay(0.05);
    delay.delayTime.value = 1 / freq;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.965;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(1, t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    src.connect(burst).connect(delay);
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(out);
    out.connect(dest || this.sfx);
    if (dest === this.music) out.connect(this.echo);
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

  // ── مؤثرات اللعب ──
  tap() {
    this.tone(880, { type: 'triangle', dur: 0.07, gain: 0.18 });
  }
  pickup() {
    this.tone(420, { type: 'sine', dur: 0.14, gain: 0.25, slideTo: 760 });
  }
  drop() {
    this.tone(180, { type: 'sine', dur: 0.18, gain: 0.35, slideTo: 90 });
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
  drum(start = 0) {
    this.tone(110, { type: 'sine', start, dur: 0.3, gain: 0.5, slideTo: 55 });
    this.noise({ start, dur: 0.12, gain: 0.08, from: 1200, to: 600, q: 0.6 });
  }

  // ── الأجواء: نسيم + لحن هادئ ──
  startAmbience() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    f.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(f.frequency);
    src.connect(f).connect(g).connect(this.music);
    src.start();
    lfo.start();

    let degree = 0;
    const phrase = () => {
      if (!this.musicOn) return;
      // مسار لحني هادئ عشوائي على مقام الحجاز مع ارتكاز على القرار
      const notes = 4 + Math.floor(Math.random() * 3);
      let t = 0;
      for (let i = 0; i < notes; i++) {
        degree = Math.max(0, Math.min(7, degree + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        if (i === notes - 1) degree = Math.random() > 0.5 ? 0 : 4;
        this.pluck(HIJAZ_D[degree] / 2, { start: t, gain: 0.32, dest: this.music });
        if (Math.random() > 0.7) this.pluck(HIJAZ_D[degree] / 2, { start: t + 0.12, gain: 0.18, dest: this.music });
        t += [0.36, 0.48, 0.72][Math.floor(Math.random() * 3)];
      }
      this.pluck(HIJAZ_D[0] / 4, { start: 0, gain: 0.25, dest: this.music });
      this.phraseTimer = setTimeout(phrase, (t + 2.5 + Math.random() * 2) * 1000);
    };
    this.phraseTimer = setTimeout(phrase, 800);
  }
}
