import '@fontsource/baloo-bhaijaan-2/500.css';
import '@fontsource/baloo-bhaijaan-2/700.css';
import '../styles/teacher.css';
import { getTeacherBackend } from '../backend/index.js';
import { errorMessage } from '../backend/errors.js';
import { STAGES, SKILLS, ALL_QUESTIONS, getQuestion } from '../content/stages.js';
import { scoreQuestion } from '../shared/scoring.js';
import { summarize, classSkills, questionStats, toCsv } from './analytics.js';
import { describeAttempt, questionShort } from './describe.js';

const $ = (s) => document.querySelector(s);
const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const pct = (x) => `${toAr(Math.round(x * 100))}٪`;
const level = (x) => (x == null ? '' : x >= 0.8 ? 'hi' : x >= 0.6 ? 'mid' : 'lo');
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto', style: 'short' });
function ago(ms) {
  if (!ms) return '—';
  const s = Math.round((ms - Date.now()) / 1000);
  if (s > -45) return 'الآن';
  if (s > -3600) return rtf.format(Math.round(s / 60), 'minute');
  if (s > -86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

const state = {
  backend: null,
  classes: [],
  current: null,
  students: [],
  answers: [],
  unsub: [],
  seen: new Set(),
  firstLoad: true,
  openStudent: null,
  rows: [],
};
// للفحص الآلي
window.__teacher = state;

async function boot() {
  const backend = await getTeacherBackend();
  state.backend = backend;
  if (backend.mode === 'local') {
    $('#mode-pill').hidden = false;
    $('#mode-pill').textContent = 'وضع تجريبي محلي — البيانات في هذا المتصفح فقط';
  }

  backend.onTeacherAuth(async (user) => {
    if (!user) {
      $('#app-view').hidden = true;
      $('#login-view').hidden = false;
      $('#logout').hidden = true;
      $('#who').textContent = '';
      stopWatching();
      return;
    }
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#who').textContent = user.email || '';
    $('#logout').hidden = backend.mode === 'local';
    await loadClasses();
  });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $('#login-error');
    err.hidden = true;
    f.querySelector('button').disabled = true;
    try {
      await backend.teacherSignIn(f.email.value, f.password.value);
    } catch (ex) {
      err.textContent = errorMessage(ex);
      err.hidden = false;
    } finally {
      f.querySelector('button').disabled = false;
    }
  });
  $('#logout').addEventListener('click', () => backend.teacherSignOut());
  $('#class-select').addEventListener('change', (e) => selectClass(e.target.value));
  $('#new-class').addEventListener('click', () => {
    $('#class-form').reset();
    $('#class-error').hidden = true;
    $('#class-dialog').showModal();
  });
  $('#class-form').addEventListener('submit', submitClass);
  $('#roster-btn').addEventListener('click', openRoster);
  $('#roster-form').addEventListener('submit', saveRoster);
  $('#roster-text').addEventListener('input', countRoster);
  document.querySelectorAll('dialog [data-cancel]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('#join-screen').addEventListener('click', openJoin);
  $('#copy-link').addEventListener('click', copyLink);
  $('#toggle-class').addEventListener('click', toggleClass);
  $('#export').addEventListener('click', exportCsv);
  $('#search').addEventListener('input', render);
  $('#sd-remove').addEventListener('click', () => askRemove(true));
  $('#sd-remove-no').addEventListener('click', () => askRemove(false));
  $('#sd-remove-yes').addEventListener('click', removeStudent);
  setInterval(render, 30000); // تحديث «آخر نشاط»
}

async function loadClasses(selectCode) {
  state.classes = await state.backend.listMyClasses();
  const sel = $('#class-select');
  sel.innerHTML = state.classes.map((c) => `<option value="${esc(c.code)}">${esc(c.name)} (${esc(c.code)})</option>`).join('');
  let remembered = selectCode;
  try {
    remembered ||= localStorage.getItem('da:v1:teacher-class');
  } catch {
    /* ignore */
  }
  const code = state.classes.find((c) => c.code === remembered)?.code || state.classes.at(-1)?.code;
  if (code) {
    sel.value = code;
    selectClass(code);
  } else {
    $('#class-code').textContent = '——';
    render();
  }
}

function stopWatching() {
  state.unsub.forEach((u) => u());
  state.unsub = [];
}

function selectClass(code) {
  stopWatching();
  state.current = state.classes.find((c) => c.code === code) || null;
  state.students = [];
  state.answers = [];
  state.seen = new Set();
  state.firstLoad = true;
  if (!state.current) return render();
  try {
    localStorage.setItem('da:v1:teacher-class', code);
  } catch {
    /* ignore */
  }
  $('#class-code').textContent = code;
  // الاستماع اللحظي (Realtime) لطالبات الفصل وإجاباتهن
  state.unsub.push(
    state.backend.watchStudents(code, (list) => {
      state.students = list;
      render();
    }),
    state.backend.watchAnswers(code, (list) => {
      state.answers = list;
      render();
      state.firstLoad = false;
    }),
  );
  render();
}

async function submitClass(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const cls = await state.backend.createClass($('#class-name').value);
    $('#class-dialog').close();
    await loadClasses(cls.code);
  } catch (err) {
    $('#class-error').textContent = errorMessage(err);
    $('#class-error').hidden = false;
  } finally {
    btn.disabled = false;
  }
}

function openRoster() {
  if (!state.current) return;
  $('#roster-text').value = (state.current.roster || []).join('\n');
  countRoster();
  $('#roster-dialog').showModal();
}
function rosterNames() {
  return [...new Set($('#roster-text').value.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 40);
}
function countRoster() {
  $('#roster-count').textContent = `عدد الأسماء: ${toAr(rosterNames().length)} (الحد الأعلى ٤٠)`;
}
async function saveRoster(e) {
  e.preventDefault();
  const names = rosterNames();
  await state.backend.setRoster(state.current.code, names);
  state.current.roster = names;
  $('#roster-dialog').close();
  render();
}

function gameLink() {
  const url = new URL('./', location.href);
  if (state.current) url.searchParams.set('class', state.current.code);
  return url.href;
}
function openJoin() {
  if (!state.current) return;
  $('#jd-code').textContent = state.current.code;
  $('#jd-link').textContent = gameLink();
  $('#join-dialog').showModal();
}
async function copyLink() {
  const btn = $('#copy-link');
  try {
    await navigator.clipboard.writeText(gameLink());
    btn.textContent = 'نُسخ ✓';
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('#jd-link'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    btn.textContent = 'انسخيه يدويًا';
  }
  setTimeout(() => (btn.textContent = 'نسخ الرابط'), 2000);
}

async function toggleClass() {
  const c = state.current;
  if (!c) return;
  await state.backend.setClassActive(c.code, !c.active);
  c.active = !c.active;
  render();
}

function stageChips(r) {
  return `<span class="stages">${STAGES.map((s) => {
    const v = r.stageScores[s.id];
    if (!v) return `<i class="chip empty" title="${esc(s.title)}">${toAr(s.id)}</i>`;
    if (!v.done) return `<i class="chip wip" title="${esc(s.title)}: ${toAr(v.answered)} من ${toAr(v.total)}">${toAr(v.answered)}/${toAr(v.total)}</i>`;
    return `<i class="chip ${level(v.score)}" title="${esc(s.title)}">${pct(v.score)}</i>`;
  }).join('')}</span>`;
}

function render() {
  const c = state.current;
  const btn = $('#toggle-class');
  btn.hidden = !c;
  if (c) {
    btn.textContent = c.active ? 'إغلاق الفصل' : 'فتح الفصل';
    btn.classList.toggle('danger', c.active);
    $('#class-code').classList.toggle('closed', !c.active);
  }
  const roster = c?.roster || [];
  const rows = summarize(state.students, state.answers, roster);
  state.rows = rows;
  const joined = rows.filter((r) => r.joined);
  const scored = joined.filter((r) => r.score != null);
  $('#k-students').textContent = roster.length ? `${toAr(joined.length)} / ${toAr(roster.length)}` : toAr(joined.length);
  $('#k-answers').textContent = toAr(state.answers.length);
  $('#k-avg').textContent = scored.length ? pct(scored.reduce((s, r) => s + r.score, 0) / scored.length) : '—';
  $('#k-done').textContent = toAr(joined.filter((r) => r.stagesDone === STAGES.length).length);

  // جدول الطالبات
  const term = $('#search').value.trim();
  const sorted = [...rows].sort((a, b) => Number(b.joined) - Number(a.joined) || b.last - a.last || a.name.localeCompare(b.name, 'ar'));
  const visible = sorted.filter((r) => !term || r.name?.includes(term));
  const tbody = $('#students-table tbody');
  tbody.innerHTML = visible
    .map((r) => {
      if (!r.joined) {
        return `<tr class="absent"><td class="name">${esc(r.name)}</td><td colspan="5" class="muted">لم تدخل بعد</td></tr>`;
      }
      return `<tr data-uid="${esc(r.uid)}" tabindex="0">
        <td class="name">${esc(r.name)}${r.duplicate ? ' <span class="warn" title="دخلت بالاسم نفسه من أكثر من جهاز">⚠</span>' : ''}</td>
        <td>${stageChips(r)}</td>
        <td><span class="score ${level(r.score)}">${r.score == null ? '—' : pct(r.score)}</span></td>
        <td>${toAr(r.attempts)}${r.wrongAttempts ? ` <span class="muted">(${toAr(r.wrongAttempts)} خطأ)</span>` : ''}</td>
        <td class="skills-cell">${r.weakSkills.length ? r.weakSkills.slice(0, 3).map((k) => `<i class="skill-chip">${esc(SKILLS[k])}</i>`).join('') : r.answered ? '<span class="ok-text">لا شيء</span>' : '—'}</td>
        <td class="muted">${ago(r.last)}</td>
      </tr>`;
    })
    .join('');
  $('#empty-students').hidden = rows.length > 0;
  tbody.querySelectorAll('tr[data-uid]').forEach((tr) => {
    const open = () => openStudent(tr.dataset.uid);
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => e.key === 'Enter' && open());
  });

  // مهارات الفصل
  $('#skills').innerHTML = classSkills(joined)
    .map(
      (s) => `<li>
        <div class="q-top"><span class="q-text">${esc(s.label)}</span></div>
        <div class="q-bar"><i class="${level(s.avg)}" style="width:${(s.avg || 0) * 100}%"></i></div>
        <div class="q-meta"><span>${s.avg == null ? 'لا إجابات بعد' : `متوسط ${pct(s.avg)}`}</span><span>${s.needSupport.length ? `تحتاج دعمًا: ${esc(s.needSupport.slice(0, 4).join('، '))}${s.needSupport.length > 4 ? '…' : ''}` : ''}</span></div>
      </li>`,
    )
    .join('');

  // آخر الإجابات (مباشر)
  const names = new Map(state.students.map((s) => [s.uid, s.name]));
  const recent = [...state.answers].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 14);
  $('#feed').innerHTML =
    recent
      .map((a) => {
        const q = getQuestion(a.stageId, a.questionId);
        const r = scoreQuestion(q, a);
        const fresh = !state.firstLoad && !state.seen.has(a.id);
        return `<li class="${fresh ? 'fresh' : ''}">
        <span class="res ${r.firstTry ? 'ok' : r.solved ? 'part' : 'no'}">${r.firstTry ? '✓' : r.solved ? '↻' : '✗'}</span>
        <span><b>${esc(names.get(a.uid) || '—')}</b> · م${toAr(a.stageId)} · ${esc(questionShort(q, a.questionId))}</span>
        <time>${ago(a.ts)}</time>
      </li>`;
      })
      .join('') || '<li class="empty">ستظهر الإجابات هنا فور وصولها.</li>';
  state.answers.forEach((a) => state.seen.add(a.id));

  // أداء الفصل لكل سؤال
  $('#questions').innerHTML = questionStats(joined)
    .map(
      ({ q, n, avg }) => `<li>
        <div class="q-top"><span class="q-tag">م${toAr(q.stageId)}</span><span class="q-text">${esc(q.prompt)}</span></div>
        <div class="q-bar"><i class="${level(avg)}" style="width:${(avg || 0) * 100}%"></i></div>
        <div class="q-meta"><span>${avg == null ? 'لا إجابات بعد' : `متوسط ${pct(avg)}`}</span><span>${toAr(n)} إجابة</span></div>
      </li>`,
    )
    .join('');

  if (state.openStudent) renderStudent(state.openStudent);
}

function openStudent(uid) {
  state.openStudent = uid;
  renderStudent(uid);
  askRemove(false);
  const dlg = $('#student-dialog');
  if (!dlg.open) dlg.showModal();
  dlg.addEventListener('close', () => (state.openStudent = null), { once: true });
}

function renderStudent(uid) {
  const r = state.rows.find((x) => x.uid === uid);
  if (!r) return;
  $('#sd-name').textContent = r.name;
  const byQ = new Map(r.per.map((p) => [p.q.id, p]));
  const skillList = Object.entries(r.skillScores).sort((a, b) => a[1].score - b[1].score);
  $('#sd-body').innerHTML = `
    <p class="sd-summary">الدرجة: <b>${r.score == null ? '—' : pct(r.score)}</b> · أجابت ${toAr(r.answered)} من ${toAr(ALL_QUESTIONS.length)} سؤالًا · ${toAr(r.attempts)} محاولة</p>
    <div class="sd-stages">${stageChips(r)}</div>
    ${skillList.length ? `<h3>المهارات</h3><ul class="sd-skills">${skillList.map(([k, v]) => `<li><span>${esc(SKILLS[k])}</span><span class="score ${level(v.score)}">${pct(v.score)}</span></li>`).join('')}</ul>` : ''}
    ${STAGES.map(
      (s) => `<h3>المرحلة ${toAr(s.id)}: ${esc(s.title)}</h3>
      <ol class="sd-list">
      ${s.content.questions
        .map((q) => {
          const p = byQ.get(q.id);
          if (!p) return `<li class="pending"><p class="q">${esc(q.prompt)}</p><p class="muted">لم تصل إليه بعد</p></li>`;
          const steps = p.rec.attempts.map((a) => describeAttempt(q, a));
          return `<li>
            <div class="sd-q"><span class="res ${p.r.firstTry ? 'ok' : p.r.solved ? 'part' : 'no'}">${p.r.firstTry ? '✓' : p.r.solved ? '↻' : '✗'}</span><p class="q">${esc(q.prompt)}</p><span class="score">${pct(p.r.score)}</span></div>
            <p class="muted">${esc(toAr(p.r.detail))}${p.rec.revealed ? ' · عُرضت عليها الإجابة' : ''}${p.replays ? ` · أعادت المحاولة ${toAr(p.replays)} مرة` : ''}</p>
            <ol class="steps">${steps.map((st) => `<li class="${st.ok ? 'ok' : 'no'}">${esc(st.text)}</li>`).join('')}</ol>
          </li>`;
        })
        .join('')}
      </ol>`,
    ).join('')}`;
}

function askRemove(show) {
  $('#sd-remove').hidden = show;
  $('#sd-confirm').hidden = !show;
}

async function removeStudent() {
  const uid = state.openStudent;
  if (!uid) return;
  await state.backend.removeStudent(state.current.code, uid);
  askRemove(false);
  $('#student-dialog').close();
}

function exportCsv() {
  const csv = toCsv(state.rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `نتائج-${state.current?.code || 'الفصل'}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', '<p class="fatal">تعذّر تحميل اللوحة. حدّثي الصفحة.</p>');
});
