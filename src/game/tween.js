// محرك حركة بسيط قائم على الوعود (Promises)
export const ease = {
  linear: (t) => t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

export class Tweens {
  constructor() {
    this.list = [];
  }

  /** يشغّل onUpdate(k) من 0 إلى 1 خلال duration ثانية */
  run(duration, onUpdate, easing = ease.inOutCubic, delay = 0) {
    return new Promise((resolve) => {
      this.list.push({ t: -delay, duration: Math.max(duration, 0.0001), onUpdate, easing, resolve });
    });
  }

  /** يُنهي كل الحركات الجارية فورًا (لزر «تخطّي») */
  skipAll() {
    for (const tw of this.list) tw.t = Math.max(tw.t, tw.duration);
  }

  wait(seconds) {
    return this.run(seconds, () => {}, ease.linear);
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = Math.min(tw.t / tw.duration, 1);
      tw.onUpdate(tw.easing(k), k);
      if (k >= 1) {
        this.list.splice(i, 1);
        tw.resolve();
      }
    }
  }
}
