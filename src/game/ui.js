// واجهة اللعبة فوق المشهد ثلاثي الأبعاد (HTML من اليمين لليسار)
import { STAGES } from '../content/stages.js';

export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const ORDINALS = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// شاهين: صقر صغير بوشاح أخضر، دليل المستكشفات
export const FALCON_SVG = `
<svg viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="47" fill="#f6e6c6" stroke="#8a5a33" stroke-width="4"/>
  <path d="M28 92 C20 62 27 30 52 22 C70 17 83 30 80 45 C79 52 74 56 70 58 C77 67 79 80 75 92 Z" fill="#8a5a33"/>
  <path d="M57 29 C70 26 78 35 76 46 C70 50 62 50 56 46 C51 40 52 32 57 29Z" fill="#f3ead8"/>
  <path d="M75 37 C86 37 91 44 88 53 C86 50 82 49 78 50 C78 46 77 41 75 37Z" fill="#f2b632" stroke="#6b4223" stroke-width="1.6"/>
  <path d="M88 53 C87 56 85 57 83 56" stroke="#3b2216" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="65" cy="38" r="7.5" fill="#f2b632"/><circle cx="66" cy="38" r="4.4" fill="#1d1414"/><circle cx="67.6" cy="36.4" r="1.5" fill="#fff"/>
  <path d="M61 46 C59 53 57 57 55 61" stroke="#5a3a20" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M33 74 C42 68 53 68 61 74" stroke="#6b4223" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M31 84 C42 78 55 78 65 84" stroke="#6b4223" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M34 60 C47 67 62 67 73 60 L75 67 C62 75 46 75 32 67Z" fill="#1f6b45"/>
  <path d="M62 66 L66 80 L58 77Z" fill="#1f6b45"/>
</svg>`;

const ICONS = {
  speaker: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.3 6.1 20.5l1.4-6.6-5-4.5 6.6-.7z" fill="currentColor"/></svg>',
};

export function createUI(audio) {
  const $ = (sel) => document.querySelector(sel);
  const screens = $('#screens');
  const hud = $('#hud');
  const prompt = $('#prompt');
  const choices = $('#choices');
  const toastEl = $('#toast');
  const letterbox = $('#letterbox');
  const titleCard = $('#title-card');

  // زر الصوت
  const soundBtn = $('#sound-btn');
  const renderSound = () => {
    soundBtn.innerHTML = audio.enabled ? ICONS.speaker : ICONS.mute;
    soundBtn.setAttribute('aria-label', audio.enabled ? 'كتم الصوت' : 'تشغيل الصوت');
  };
  soundBtn.addEventListener('click', () => {
    audio.unlock();
    audio.setEnabled(!audio.enabled);
    renderSound();
  });
  renderSound();

  function show(html) {
    screens.innerHTML = html;
    screens.hidden = false;
    requestAnimationFrame(() => screens.firstElementChild?.classList.add('in'));
    return screens.firstElementChild;
  }
  function clear() {
    screens.innerHTML = '';
    screens.hidden = true;
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
              <p class="sub">مع شاهين، دليلك في الواحة</p>
            </div>
            <a class="teacher-link" href="teacher.html">لوحة المعلمة</a>
          </section>`);
        el.querySelector('[data-go]').addEventListener('click', () => resolve(), { once: true });
      });
    },

    joinScreen({ mode, demoCode, onSubmit }) {
      const el = show(`
        <section class="screen center">
          <form class="card join-card" novalidate>
            <div class="guide-row">
              <div class="avatar">${FALCON_SVG}</div>
              <p class="bubble">أنا <b>شاهين</b>! ما اسمكِ يا مستكشفة؟</p>
            </div>
            <label class="field">
              <span>اسمكِ</span>
              <input name="name" autocomplete="off" maxlength="30" required placeholder="مثال: سارة" />
            </label>
            <label class="field">
              <span>رمز الفصل</span>
              <input name="code" autocomplete="off" maxlength="6" dir="ltr" inputmode="text" required placeholder="ABC234" class="code-input" />
            </label>
            ${
              mode === 'local'
                ? `<p class="hint">وضع تجريبي: رمز الفصل <button type="button" class="chip" data-demo>${demoCode}</button></p>`
                : ''
            }
            <p class="error" role="alert" hidden></p>
            <button class="btn primary big" type="submit">انطلقي</button>
          </form>
        </section>`);
      const form = el.querySelector('form');
      const err = el.querySelector('.error');
      el.querySelector('[data-demo]')?.addEventListener('click', () => {
        form.code.value = demoCode;
        audio.tap();
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.hidden = true;
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        btn.textContent = 'لحظة…';
        const msg = await onSubmit(form.name.value, form.code.value);
        if (msg) {
          err.textContent = msg;
          err.hidden = false;
          audio.wrong();
          btn.disabled = false;
          btn.textContent = 'انطلقي';
        }
      });
      setTimeout(() => form.name.focus(), 300);
    },

    mapScreen({ name, className, progress, onPick, onLeave }) {
      const stations = STAGES.map((s) => {
        const stars = progress.stars?.[s.id] || 0;
        const unlocked = s.available && (s.id === 1 || progress.stars?.[s.id - 1]);
        const state = !s.available ? 'soon' : unlocked ? (stars ? 'done' : 'open') : 'locked';
        return `
          <button class="station ${state}" data-stage="${s.id}" ${state === 'open' || state === 'done' ? '' : 'disabled'}>
            <span class="medal"><span class="num">${toAr(s.id)}</span>${state === 'soon' || state === 'locked' ? `<span class="lock">${ICONS.lock}</span>` : ''}</span>
            <span class="st-title">${esc(s.title)}</span>
            <span class="st-place">${esc(s.place)}</span>
            <span class="st-stars">${[1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}">${ICONS.star}</i>`).join('')}</span>
            ${state === 'soon' ? '<span class="tag">قريبًا</span>' : ''}
          </button>`;
      }).join('');
      const el = show(`
        <section class="screen map-screen">
          <header class="map-head">
            <div class="guide-row compact">
              <div class="avatar">${FALCON_SVG}</div>
              <div>
                <h2>خريطة المغامرة</h2>
                <p>مرحبًا يا <b>${esc(name)}</b>${className ? ` · ${esc(className)}` : ''}</p>
              </div>
            </div>
            <button class="btn ghost small" data-leave>تغيير الاسم</button>
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
    },

    guideDialog(text, button = 'هيا نبدأ!') {
      return new Promise((resolve) => {
        const el = show(`
          <section class="screen bottom">
            <div class="card dialog">
              <div class="avatar big">${FALCON_SVG}</div>
              <div class="dialog-body">
                <p class="who">شاهين</p>
                <p class="speech">${esc(text)}</p>
                <div class="row">
                  <button class="btn primary" data-go>${esc(button)}</button>
                  ${audio.canSpeak ? `<button class="btn icon" data-say aria-label="استمعي">${ICONS.speaker}</button>` : ''}
                </div>
              </div>
            </div>
          </section>`);
        el.querySelector('[data-say]')?.addEventListener('click', () => audio.say(text));
        el.querySelector('[data-go]').addEventListener(
          'click',
          () => {
            audio.tap();
            clear();
            resolve();
          },
          { once: true },
        );
        audio.say(text);
      });
    },

    resultsScreen({ name, stage, stars, onMap, onReplay }) {
      const el = show(`
        <section class="screen center">
          <div class="card results">
            <div class="badge-medal"><span>${toAr(stage.id)}</span></div>
            <h2>أحسنتِ يا ${esc(name)}!</h2>
            <p>أنهيتِ المرحلة ${ORDINALS[stage.id]}: <b>${esc(stage.title)}</b></p>
            <div class="big-stars">${[1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}" style="--d:${i * 0.25}s">${ICONS.star}</i>`).join('')}</div>
            <p class="earned">حصلتِ على وسام <b>«${esc(stage.badge)}»</b></p>
            <div class="row">
              <button class="btn primary" data-map>العودة إلى الخريطة</button>
              <button class="btn ghost" data-replay>العبي مرة أخرى</button>
            </div>
          </div>
        </section>`);
      el.querySelector('[data-map]').addEventListener('click', onMap);
      el.querySelector('[data-replay]').addEventListener('click', onReplay);
    },

    // ── أثناء اللعب ──
    hud(stage, draft, onHome) {
      hud.hidden = false;
      hud.querySelector('.stage-name').textContent = `المرحلة ${ORDINALS[stage.id]} · ${stage.title}`;
      hud.querySelector('.draft').hidden = !draft;
      const home = hud.querySelector('[data-home]');
      home.innerHTML = ICONS.home;
      home.onclick = onHome;
    },
    hideHud() {
      hud.hidden = true;
      prompt.hidden = true;
      choices.hidden = true;
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
        <div class="avatar small">${FALCON_SVG}</div>
        <p>${esc(text)}</p>
        ${audio.canSpeak ? `<button class="btn icon" aria-label="استمعي للسؤال">${ICONS.speaker}</button>` : ''}`;
      prompt.querySelector('button')?.addEventListener('click', () => audio.say(text));
      prompt.classList.remove('pop');
      void prompt.offsetWidth;
      prompt.classList.add('pop');
      audio.say(text);
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

    choices(options, onPick) {
      choices.hidden = false;
      choices.innerHTML = options.map((o) => `<button class="btn choice" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('');
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

    async letterbox(on) {
      letterbox.classList.toggle('on', on);
    },

    async stageTitle(stage) {
      titleCard.innerHTML = `
        <p class="tc-kicker">المرحلة ${ORDINALS[stage.id]}</p>
        <h2>${esc(stage.title)}</h2>
        <p class="tc-place">${esc(stage.place)}</p>`;
      titleCard.classList.add('show');
      await new Promise((r) => setTimeout(r, 3200));
      titleCard.classList.remove('show');
    },

    modeBadge(mode) {
      const el = $('#mode-badge');
      el.hidden = mode !== 'local';
      el.textContent = 'وضع تجريبي محلي';
    },
  };
  return ui;
}
