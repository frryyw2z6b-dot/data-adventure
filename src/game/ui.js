// واجهة اللعبة فوق المشهد ثلاثي الأبعاد (HTML من اليمين لليسار)
import { STAGES } from '../content/stages.js';
import { LINES } from '../content/lines.js';
import { iconUrl } from './icons2d.js';

export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const ORDINALS = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// نورة: صورة مصغّرة مطابقة للشخصية ثلاثية الأبعاد (بخنق داكن بحافة ذهبية وثوب أخضر)
export const NOURA_SVG = `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><clipPath id="nc"><circle cx="50" cy="50" r="46"/></clipPath></defs>
  <circle cx="50" cy="50" r="47" fill="#f6e6c6" stroke="#b9764a" stroke-width="3"/>
  <g clip-path="url(#nc)">
    <path d="M24 100 C26 86 37 80 50 80 C63 80 74 86 76 100Z" fill="#1d7a4c"/>
    <path d="M47 81 h6 v19 h-6z" fill="#e0b04a"/>
    <path d="M50 9 C25 9 13 30 14 53 C15 72 20 85 25 96 L75 96 C80 85 85 72 86 53 C87 30 75 9 50 9Z" fill="#2a1838"/>
    <g fill="#e0b04a"><circle cx="27" cy="34" r="1.6"/><circle cx="73" cy="34" r="1.6"/><circle cx="21" cy="55" r="1.6"/><circle cx="79" cy="55" r="1.6"/><circle cx="26" cy="76" r="1.6"/><circle cx="74" cy="76" r="1.6"/><circle cx="50" cy="15" r="1.6"/></g>
    <ellipse cx="50" cy="54" rx="22.5" ry="23.5" fill="#e3ab84"/>
    <path d="M28 46 C29 34 39 29 50 29 C61 29 71 34 72 46 C65 40 58 38.5 50 39 C42 38.5 35 40 28 46Z" fill="#24150f"/>
    <ellipse cx="50" cy="54" rx="25.5" ry="26.5" fill="none" stroke="#e0b04a" stroke-width="3.2"/>
    <g fill="#f3d27a"><circle cx="25" cy="54" r="2"/><circle cx="75" cy="54" r="2"/><circle cx="31" cy="72" r="2"/><circle cx="69" cy="72" r="2"/><circle cx="50" cy="27.5" r="2"/></g>
    <ellipse cx="41.5" cy="53" rx="3.2" ry="4.3" fill="#1b120e"/><ellipse cx="58.5" cy="53" rx="3.2" ry="4.3" fill="#1b120e"/>
    <circle cx="42.6" cy="51.4" r="1.1" fill="#fff"/><circle cx="59.6" cy="51.4" r="1.1" fill="#fff"/>
    <path d="M37 46.5 q4.5 -2.4 8 0 M55 46.5 q4.5 -2.4 8 0" stroke="#2a1a12" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <circle cx="35.5" cy="61" r="4" fill="#ff8b8b" opacity=".4"/><circle cx="64.5" cy="61" r="4" fill="#ff8b8b" opacity=".4"/>
    <path d="M44 63.5 Q50 69 56 63.5" stroke="#9b3a3a" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

const ICONS = {
  speaker:
    '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  music:
    '<svg viewBox="0 0 24 24"><path d="M9 18V6l11-2v12" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.6" fill="currentColor"/><circle cx="17.5" cy="16" r="2.6" fill="currentColor"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.3 6.1 20.5l1.4-6.6-5-4.5 6.6-.7z" fill="currentColor"/></svg>',
};

export function createUI(audio, { say } = {}) {
  const $ = (sel) => document.querySelector(sel);
  const screens = $('#screens');
  const hud = $('#hud');
  const prompt = $('#prompt');
  const choices = $('#choices');
  const toastEl = $('#toast');
  const letterbox = $('#letterbox');
  const titleCard = $('#title-card');
  const dataCardEl = $('#datacard');
  const speak = say || ((t) => audio.say(t));

  // أزرار الصوت والموسيقى (ظاهرة دائمًا)
  const soundBtn = $('#sound-btn');
  const musicBtn = $('#music-btn');
  // لا نعيد بناء محتوى الزر إلا إذا تغيّرت حالته؛ استبدال العنصر تحت الإصبع أثناء اللمس يُضيع النقرة
  const setHTML = (el, html) => {
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
  };
  const renderSound = () => {
    setHTML(soundBtn, `${audio.enabled ? ICONS.speaker : ICONS.mute}<span>${audio.enabled ? 'الصوت يعمل' : 'الصوت مكتوم'}</span>`);
    soundBtn.setAttribute('aria-pressed', String(!audio.enabled));
    soundBtn.classList.toggle('off', !audio.enabled);
    setHTML(musicBtn, `${ICONS.music}<span>${audio.musicEnabled ? 'الموسيقى' : 'بلا موسيقى'}</span>`);
    musicBtn.classList.toggle('off', !audio.musicEnabled || !audio.enabled);
    musicBtn.setAttribute('aria-pressed', String(!audio.musicEnabled));
  };
  soundBtn.addEventListener('click', () => {
    audio.unlock();
    audio.setEnabled(!audio.enabled);
    if (audio.enabled) audio.tap();
  });
  musicBtn.addEventListener('click', () => {
    audio.unlock();
    audio.setMusic(!audio.musicEnabled);
  });
  audio.onChange(renderSound);
  renderSound();

  function show(html) {
    screens.innerHTML = html;
    screens.hidden = false;
    const el = screens.firstElementChild;
    // الظهور التدريجي، مع ضمان الظهور حتى لو تأخرت إطارات الرسم على الأجهزة البطيئة
    requestAnimationFrame(() => el?.classList.add('in'));
    setTimeout(() => el?.classList.add('in'), 120);
    return el;
  }
  function clear() {
    screens.innerHTML = '';
    screens.hidden = true;
  }

  // مؤشر مستوى الصوت لزر «اختبري الصوت»
  function soundTest(btn) {
    const meter = btn.querySelector('.meter i');
    audio.unlock();
    audio.correct();
    speak(LINES.soundTest);
    const t0 = performance.now();
    let heard = 0;
    const tick = () => {
      const lv = audio.level();
      heard = Math.max(heard, lv);
      meter.style.width = `${Math.min(100, lv * 400)}%`;
      if (performance.now() - t0 < 4500) requestAnimationFrame(tick);
      else {
        meter.style.width = '0';
        btn.classList.toggle('ok', heard > 0.01);
      }
    };
    tick();
  }

  let toastTimer = null;

  const ui = {
    clear,

    titleScreen() {
      return new Promise((resolve) => {
        const el = show(`
          <section class="screen title-screen">
            <div class="title-block">
              <div class="najdi-crest" aria-hidden="true"></div>
              <p class="kicker">وحدة تمثيل البيانات · الصف الثاني الابتدائي</p>
              <h1 class="game-title"><span class="l1">مغامرة</span><span class="l2">مستكشفي البيانات</span></h1>
              <button class="btn primary big" data-go>ابدئي المغامرة</button>
              <p class="sub">مع نورة، رفيقتك في المغامرة</p>
            </div>
            <a class="teacher-link" href="teacher.html">لوحة المعلمة</a>
          </section>`);
        el.querySelector('[data-go]').addEventListener('click', () => resolve(), { once: true });
      });
    },

    /** الخطوة ١: رمز الفصل */
    codeScreen({ mode, demoCode, initialCode = '', onSubmit }) {
      const el = show(`
        <section class="screen center">
          <form class="card join-card" novalidate>
            <div class="guide-row">
              <div class="avatar">${NOURA_SVG}</div>
              <p class="bubble">${esc(LINES.askCode)}</p>
            </div>
            <label class="field">
              <span>رَمْزُ الْفَصْلِ</span>
              <input id="code" name="code" autocomplete="off" maxlength="6" dir="ltr" required placeholder="ABC234" class="code-input" value="${esc(initialCode)}" />
            </label>
            ${mode === 'local' ? `<p class="hint">وضع تجريبي: رمز الفصل <button type="button" class="chip" data-demo>${demoCode}</button></p>` : ''}
            <p class="error" role="alert" hidden></p>
            <div class="row between">
              <button type="button" class="btn ghost sound-test" data-test>${ICONS.speaker}<span>اِخْتَبِرِي الصَّوْتَ</span><span class="meter"><i></i></span></button>
              <button class="btn primary big" type="submit">التَّالِي</button>
            </div>
          </form>
        </section>`);
      const form = el.querySelector('form');
      const err = el.querySelector('.error');
      el.querySelector('[data-demo]')?.addEventListener('click', () => {
        form.code.value = demoCode;
        audio.tap();
      });
      el.querySelector('[data-test]').addEventListener('click', (e) => soundTest(e.currentTarget));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        const msg = await onSubmit(form.code.value);
        if (msg) {
          err.textContent = msg;
          err.hidden = false;
          audio.wrong();
          btn.disabled = false;
        }
      });
      // ترحيب نورة ثم طلب الرمز (إن بقيت الطالبة في هذه الشاشة)
      speak(LINES.welcome).then(() => {
        if (document.body.contains(form)) speak(LINES.askCode);
      });
      setTimeout(() => form.code.focus(), 300);
    },

    /** الخطوة ٢: الاسم — أزرار من قائمة المعلمة، أو كتابة الاسم */
    nameScreen({ className, roster, onSubmit, onBack }) {
      const hasRoster = roster && roster.length > 0;
      const el = show(`
        <section class="screen center">
          <form class="card join-card ${hasRoster ? 'wide' : ''}" novalidate>
            <div class="guide-row">
              <div class="avatar">${NOURA_SVG}</div>
              <p class="bubble">${esc(hasRoster ? LINES.askName : LINES.typeName)}</p>
            </div>
            <p class="class-name">${esc(className || '')}</p>
            ${
              hasRoster
                ? `<div class="roster">${roster.map((n) => `<button type="button" class="btn name-btn" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>`
                : `<label class="field"><span>اِسْمُكِ</span><input id="name" name="name" autocomplete="off" maxlength="30" required placeholder="مثال: سارة" /></label>`
            }
            <p class="error" role="alert" hidden></p>
            <div class="row between">
              <button type="button" class="btn ghost" data-back>رُجُوعٌ</button>
              ${hasRoster ? '' : '<button class="btn primary big" type="submit">اِنْطَلِقِي</button>'}
            </div>
          </form>
        </section>`);
      const form = el.querySelector('form');
      const err = el.querySelector('.error');
      const submit = async (name, btn) => {
        err.hidden = true;
        btn.disabled = true;
        const msg = await onSubmit(name);
        if (msg) {
          err.textContent = msg;
          err.hidden = false;
          audio.wrong();
          btn.disabled = false;
        }
      };
      el.querySelector('[data-back]').addEventListener('click', onBack);
      el.querySelectorAll('[data-name]').forEach((b) =>
        b.addEventListener('click', () => {
          audio.tap();
          submit(b.dataset.name, b);
        }),
      );
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!hasRoster) submit(form.name.value, form.querySelector('[type=submit]'));
      });
      speak(hasRoster ? LINES.askName : LINES.typeName);
      if (!hasRoster) setTimeout(() => form.name?.focus(), 300);
    },

    mapScreen({ name, className, progress, onPick, onLeave }) {
      const stations = STAGES.map((s) => {
        const stars = progress.stars?.[s.id] || 0;
        const unlocked = s.id === 1 || progress.stars?.[s.id - 1] || (progress.serverStage || 0) >= s.id - 1;
        const state = unlocked ? (stars ? 'done' : 'open') : 'locked';
        return `
          <button class="station ${state}" data-stage="${s.id}" ${state === 'locked' ? 'disabled' : ''}>
            <span class="medal"><span class="num">${toAr(s.id)}</span>${state === 'locked' ? `<span class="lock">${ICONS.lock}</span>` : ''}</span>
            <span class="st-title">${esc(s.title)}</span>
            <span class="st-place">${esc(s.place)}</span>
            <span class="st-stars">${[1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span>
          </button>`;
      }).join('');
      const el = show(`
        <section class="screen map-screen">
          <header class="map-head">
            <div class="guide-row compact">
              <div class="avatar">${NOURA_SVG}</div>
              <div>
                <h2>خريطة المغامرة</h2>
                <p>مرحبًا يا <b>${esc(name)}</b>${className ? ` · ${esc(className)}` : ''}</p>
              </div>
            </div>
            <button class="btn ghost small" data-leave>لستُ ${esc(name)}</button>
          </header>
          <div class="trail">${stations}</div>
        </section>`);
      el.querySelectorAll('.station:not([disabled])').forEach((b) =>
        b.addEventListener('click', () => {
          audio.tap();
          onPick(Number(b.dataset.stage));
        }),
      );
      el.querySelector('[data-leave]').addEventListener('click', onLeave);
      speak(LINES.map);
    },

    /** نافذة تأكيد داخل اللعبة (بديل confirm) */
    confirm(text, yes = 'نعم', no = 'لا') {
      return new Promise((resolve) => {
        const el = show(`
          <section class="screen center dim">
            <div class="card confirm" role="alertdialog" aria-modal="true">
              <div class="avatar">${NOURA_SVG}</div>
              <p>${esc(text)}</p>
              <div class="row">
                <button class="btn primary" data-no>${esc(no)}</button>
                <button class="btn ghost" data-yes>${esc(yes)}</button>
              </div>
            </div>
          </section>`);
        const done = (v) => {
          audio.tap();
          clear();
          resolve(v);
        };
        el.querySelector('[data-yes]').addEventListener('click', () => done(true), { once: true });
        el.querySelector('[data-no]').addEventListener('click', () => done(false), { once: true });
        el.querySelector('[data-no]').focus();
        speak(LINES.leave);
      });
    },

    guideDialog(text, button = 'هيا نبدأ!') {
      return new Promise((resolve) => {
        const el = show(`
          <section class="screen bottom">
            <div class="card dialog">
              <div class="avatar big">${NOURA_SVG}</div>
              <div class="dialog-body">
                <p class="who">نورة</p>
                <p class="speech">${esc(text)}</p>
                <div class="row">
                  <button class="btn primary" data-go>${esc(button)}</button>
                  <button class="btn icon" data-say aria-label="استمعي مرة أخرى">${ICONS.speaker}</button>
                </div>
              </div>
            </div>
          </section>`);
        el.querySelector('[data-say]').addEventListener('click', () => speak(text));
        el.querySelector('[data-go]').addEventListener(
          'click',
          () => {
            audio.tap();
            clear();
            resolve();
          },
          { once: true },
        );
        speak(text);
      });
    },

    resultsScreen({ name, stage, stars, isLast, onMap, onReplay, onNext }) {
      const el = show(`
        <section class="screen center">
          <div class="card results">
            <div class="badge-medal"><span>${toAr(stage.id)}</span></div>
            <h2>أحسنتِ يا ${esc(name)}!</h2>
            <p>أنهيتِ المرحلة ${ORDINALS[stage.id]}: <b>${esc(stage.title)}</b></p>
            <div class="big-stars">${[1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}" style="--d:${i * 0.25}s">${ICONS.star}</i>`).join('')}</div>
            <p class="earned">حصلتِ على وسام <b>«${esc(stage.badge)}»</b></p>
            <div class="row">
              ${isLast ? '' : '<button class="btn primary" data-next>المرحلة التالية</button>'}
              <button class="btn ${isLast ? 'primary' : 'ghost'}" data-map>الخريطة</button>
              <button class="btn ghost" data-replay>العبي مرة أخرى</button>
            </div>
          </div>
        </section>`);
      el.querySelector('[data-map]').addEventListener('click', onMap);
      el.querySelector('[data-replay]').addEventListener('click', onReplay);
      el.querySelector('[data-next]')?.addEventListener('click', onNext);
      speak(LINES.stageDone);
    },

    certificate({ name, onMap }) {
      const el = show(`
        <section class="screen center">
          <div class="card certificate">
            <div class="avatar big">${NOURA_SVG}</div>
            <p class="cert-kicker">شهادة إنجاز</p>
            <h2>مستكشفة البيانات</h2>
            <p class="cert-name">${esc(name)}</p>
            <p>أنهت الطالبة مراحل المغامرة الخمس في وحدة تمثيل البيانات.</p>
            <div class="medals">${STAGES.map((s) => `<span title="${esc(s.badge)}">${toAr(s.id)}</span>`).join('')}</div>
            <button class="btn primary" data-map>الخريطة</button>
          </div>
        </section>`);
      el.querySelector('[data-map]').addEventListener('click', onMap);
      speak(LINES.allDone);
    },

    // ── أثناء اللعب ──
    hud(stage, onHome) {
      hud.hidden = false;
      hud.querySelector('.stage-name').textContent = `المرحلة ${ORDINALS[stage.id]} · ${stage.title}`;
      const home = hud.querySelector('[data-home]');
      home.innerHTML = ICONS.home;
      home.onclick = onHome;
    },
    hideHud() {
      hud.hidden = true;
      prompt.hidden = true;
      choices.hidden = true;
      dataCardEl.hidden = true;
    },
    progress(i, n) {
      hud.querySelector('.dots').innerHTML = Array.from(
        { length: n },
        (_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`,
      ).join('');
    },

    prompt(text) {
      prompt.hidden = false;
      prompt.innerHTML = `
        <div class="avatar small">${NOURA_SVG}</div>
        <p>${esc(text)}</p>
        <button class="btn icon" aria-label="استمعي للسؤال">${ICONS.speaker}</button>`;
      prompt.querySelector('button').addEventListener('click', () => speak(text));
      prompt.classList.remove('pop');
      void prompt.offsetWidth;
      prompt.classList.add('pop');
      return speak(text);
    },
    hidePrompt() {
      prompt.hidden = true;
    },

    toast(text, kind = 'good', ms = 1400) {
      clearTimeout(toastTimer);
      toastEl.textContent = text;
      toastEl.className = `toast show ${kind}`;
      toastTimer = setTimeout(() => (toastEl.className = 'toast'), ms);
    },

    /** أزرار الإجابة: نص، أو أيقونة ونص؛ الخيارات النصية لها زر استماع */
    choices(options, onPick, onSpeak) {
      choices.hidden = false;
      choices.className = 'choices';
      choices.innerHTML = options
        .map((o) => {
          const icon = o.icon ? `<img alt="" src="${iconUrl(o.icon)}" />` : '';
          const isNum = /^[٠-٩]+$/.test(o.label);
          const listen = !o.icon && !isNum ? `<span class="listen" role="button" aria-label="استمعي" data-say="${esc(o.label)}">${ICONS.speaker}</span>` : '';
          return `<button class="btn choice ${isNum ? 'num' : ''}" data-id="${esc(o.id)}">${icon}<span>${esc(o.label)}</span>${listen}</button>`;
        })
        .join('');
      choices.querySelectorAll('[data-say]').forEach((s) =>
        s.addEventListener('click', (e) => {
          e.stopPropagation();
          onSpeak?.(s.dataset.say);
        }),
      );
      choices.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.id)));
      const btn = (id) => choices.querySelector(`[data-id="${CSS.escape(id)}"]`);
      return {
        wrong(id) {
          const b = btn(id);
          b.classList.add('wrong');
          b.disabled = true;
        },
        correct(id) {
          btn(id).classList.add('right');
          choices.querySelectorAll('button').forEach((b) => (b.disabled = true));
        },
        hide() {
          choices.hidden = true;
          choices.innerHTML = '';
        },
      };
    },

    /** أزرار أنشطة البناء (إضافة/مسح/تحقق) */
    buildControls(buttons, onClick) {
      choices.hidden = false;
      choices.className = 'choices build';
      choices.innerHTML = buttons
        .map((b) => `<button class="btn ${b.primary ? 'primary' : 'tool'}" data-id="${esc(b.id)}">${esc(b.label)}</button>`)
        .join('');
      choices.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          audio.tap();
          onClick(b.dataset.id);
        }),
      );
      return {
        hide() {
          choices.hidden = true;
          choices.innerHTML = '';
        },
      };
    },

    /** بطاقة جدول البيانات (للأعمدة البيانية) */
    dataCard(data) {
      if (!data) {
        dataCardEl.hidden = true;
        return;
      }
      dataCardEl.hidden = false;
      dataCardEl.innerHTML = `
        <p class="dc-title">${esc(data.title)}</p>
        ${data.rows.map((r) => `<div class="dc-row"><img alt="" src="${iconUrl(r.icon, 72)}"/><span>${esc(r.label)}</span><b>${toAr(r.count)}</b></div>`).join('')}`;
    },

    letterbox(on) {
      letterbox.classList.toggle('on', on);
    },

    /** بطاقة عنوان المرحلة مع زر تخطٍّ */
    stageTitle(stage, onSkip) {
      titleCard.innerHTML = `
        <p class="tc-kicker">المرحلة ${ORDINALS[stage.id]}</p>
        <h2>${esc(stage.title)}</h2>
        <p class="tc-place">${esc(stage.place)}</p>`;
      titleCard.classList.add('show');
      const skip = $('#skip-btn');
      skip.hidden = false;
      return new Promise((resolve) => {
        const end = () => {
          clearTimeout(timer);
          titleCard.classList.remove('show');
          skip.hidden = true;
          resolve();
        };
        const timer = setTimeout(end, 3600);
        skip.onclick = () => {
          onSkip?.();
          end();
        };
      });
    },

    modeBadge(mode) {
      const el = $('#mode-badge');
      el.hidden = mode !== 'local';
      el.textContent = 'وضع تجريبي محلي';
    },
  };
  return ui;
}
