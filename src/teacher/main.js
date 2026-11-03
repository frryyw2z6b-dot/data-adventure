import '@fontsource/baloo-bhaijaan-2/500.css';
import '@fontsource/baloo-bhaijaan-2/700.css';
import '../styles/teacher.css';
import { getTeacherBackend } from '../backend/index.js';
import { errorMessage } from '../backend/errors.js';
import { STAGES, getQuestion } from '../content/stages.js';
import { scoreQuestion, firstRecords } from '../shared/scoring.js';
import { describeAttempt, questionShort } from './describe.js';

const $ = (s) => document.querySelector(s);
const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const pct = (x) => `${toAr(Math.round(x * 100))}٪`;
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

// كل الأسئلة المتاحة حاليًا مرتبة حسب المرحلة
const ALL_QUESTIONS = STAGES.filter((s) => s.content).flatMap((s) =>
  s.content.questions.map((q) => ({ ...q, stageId: s.id })),
);

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
};

async function boot() {
  const backend = await getTeacherBackend();
  state.backend = backend;
  if (backend.mode === 'local') {
    $('#mode-pill').hidden = false;
    $('#mode-pill').textContent = 'وضع تجريبي محلي — البيانات في هذا المتصفح فقط';
  }
  const drafts = STAGES.filter((s) => s.content?.status === 'draft');
  if (drafts.length) {
    $('#draft-note').hidden = false;
    $('#draft-note').textContent = `تنبيه: أسئلة ${drafts.map((s) => `«${s.title}»`).join('، ')} تجريبية حتى تُراجَع مع صفحات الكتاب.`;
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
  $('#new-class').addEventListener('click', createClass);
  $('#toggle-class').addEventListener('click', toggleClass);
  $('#export').addEventListener('click', exportCsv);
  $('#search').addEventListener('input', render);
  $('#sd-remove').addEventListener('click', removeStudent);
  setInterval(render, 30000); // تحديث «آخر نشاط»
}

async function loadClasses(selectCode) {
  state.classes = await state.backend.listMyClasses();
  const sel = $('#class-select');
  sel.innerHTML = state.classes
    .map((c) => `<option value="${esc(c.code)}">${esc(c.name)} (${esc(c.code)})</option>`)
    .join('');
  const remembered = selectCode || localStorage.getItem('da:v1:teacher-class');
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
  localStorage.setItem('da:v1:teacher-class', code);
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

async function createClass() {
  const name = prompt('اسم الفصل (مثال: الثاني أ):', 'الثاني أ');
  if (!name) return;
  try {
    const cls = await state.backend.createClass(name);
    await loadClasses(cls.code);
  } catch (err) {
    alert(errorMessage(err));
  }
}

async function toggleClass() {
  const c = state.current;
  if (!c) return;
  await state.backend.setClassActive(c.code, !c.active);
  c.active = !c.active;
  render();
}

// ── الحسابات ──
function summarize() {
  const byStudent = new Map(state.students.map((s) => [s.uid, { ...s, answers: [] }]));
  for (const a of state.answers) {
    if (!byStudent.has(a.uid)) byStudent.set(a.uid, { uid: a.uid, name: 'طالبة محذوفة', stage: 0, answers: [] });
    byStudent.get(a.uid).answers.push(a);
  }
  const rows = [...byStudent.values()].map((s) => {
    const { map, replays } = firstRecords(s.answers);
    let total = 0;
    let first = 0;
    const per = [];
    for (const [qid, rec] of map) {
      const q = getQuestion(rec.stageId, qid);
      const r = scoreQuestion(q, rec);
      total += r.score;
      if (r.firstTry) first++;
      per.push({ q, rec, r, replays: replays.get(qid) || 0 });
    }
    const answered = map.size;
    const last = s.answers.reduce((m, a) => Math.max(m, a.ts || 0), s.updatedAt || s.joinedAt || 0);
    return { ...s, answered, score: answered ? total / answered : null, first, per, last };
  });
  rows.sort((a, b) => b.last - a.last);
  return rows;
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
  const rows = summarize();
  const totalQs = ALL_QUESTIONS.length;
  const scored = rows.filter((r) => r.score != null);
  $('#k-students').textContent = toAr(state.students.length);
  $('#k-answers').textContent = toAr(state.answers.length);
  $('#k-avg').textContent = scored.length ? pct(scored.reduce((s, r) => s + r.score, 0) / scored.length) : '—';
  $('#k-done').textContent = toAr(state.students.filter((s) => (s.stage || 0) >= 1).length);

  // جدول الطالبات
  const term = $('#search').value.trim();
  const tbody = $('#students-table tbody');
  const visible = rows.filter((r) => !term || r.name?.includes(term));
  tbody.innerHTML = visible
    .map((r) => {
      const level = r.score == null ? '' : r.score >= 0.8 ? 'hi' : r.score >= 0.5 ? 'mid' : 'lo';
      return `<tr data-uid="${esc(r.uid)}" tabindex="0">
        <td class="name">${esc(r.name)}</td>
        <td>${r.stage >= 1 ? `أنهت ${toAr(r.stage)}` : r.answered ? 'تلعب الآن' : 'انضمت'}</td>
        <td><span class="mini-bar"><i style="width:${(r.answered / totalQs) * 100}%"></i></span> ${toAr(r.answered)}/${toAr(totalQs)}</td>
        <td><span class="score ${level}">${r.score == null ? '—' : pct(r.score)}</span></td>
        <td>${r.answered ? `${toAr(r.first)} من ${toAr(r.answered)}` : '—'}</td>
        <td class="muted">${ago(r.last)}</td>
      </tr>`;
    })
    .join('');
  $('#empty-students').hidden = rows.length > 0;
  tbody.querySelectorAll('tr').forEach((tr) => {
    const open = () => openStudent(tr.dataset.uid);
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', (e) => e.key === 'Enter' && open());
  });

  // آخر الإجابات (مباشر)
  const names = new Map(state.students.map((s) => [s.uid, s.name]));
  const recent = [...state.answers].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 14);
  $('#feed').innerHTML = recent
    .map((a) => {
      const q = getQuestion(a.stageId, a.questionId);
      const r = scoreQuestion(q, a);
      const fresh = !state.firstLoad && !state.seen.has(a.id);
      return `<li class="${fresh ? 'fresh' : ''}">
        <span class="res ${r.firstTry ? 'ok' : r.solved ? 'part' : 'no'}">${r.firstTry ? '✓' : r.solved ? '↻' : '✗'}</span>
        <span><b>${esc(names.get(a.uid) || '—')}</b> · ${esc(questionShort(q, a.questionId))}</span>
        <time>${ago(a.ts)}</time>
      </li>`;
    })
    .join('') || '<li class="empty">ستظهر الإجابات هنا فور وصولها.</li>';
  state.answers.forEach((a) => state.seen.add(a.id));

  // أداء الفصل لكل سؤال
  const perQ = ALL_QUESTIONS.map((q) => {
    const recs = rows.map((r) => r.per.find((p) => p.q?.id === q.id)).filter(Boolean);
    const avg = recs.length ? recs.reduce((s, p) => s + p.r.score, 0) / recs.length : null;
    return { q, n: recs.length, avg };
  });
  $('#questions').innerHTML = perQ
    .map(
      ({ q, n, avg }) => `<li>
        <div class="q-top"><span class="q-tag">م${toAr(q.stageId)}</span><span class="q-text">${esc(q.prompt)}</span></div>
        <div class="q-bar"><i class="${avg == null ? '' : avg >= 0.8 ? 'hi' : avg >= 0.5 ? 'mid' : 'lo'}" style="width:${(avg || 0) * 100}%"></i></div>
        <div class="q-meta"><span>${avg == null ? 'لا إجابات بعد' : `متوسط ${pct(avg)}`}</span><span>${toAr(n)} إجابة</span></div>
      </li>`,
    )
    .join('');

  if (state.openStudent) renderStudent(state.openStudent);
}

function openStudent(uid) {
  state.openStudent = uid;
  renderStudent(uid);
  const dlg = $('#student-dialog');
  if (!dlg.open) dlg.showModal();
  dlg.addEventListener('close', () => (state.openStudent = null), { once: true });
}

function renderStudent(uid) {
  const r = summarize().find((x) => x.uid === uid);
  if (!r) return;
  $('#sd-name').textContent = r.name;
  const byQ = new Map(r.per.map((p) => [p.q?.id, p]));
  $('#sd-body').innerHTML = `
    <p class="sd-summary">الدرجة: <b>${r.score == null ? '—' : pct(r.score)}</b> · أجابت ${toAr(r.answered)} من ${toAr(ALL_QUESTIONS.length)} سؤال</p>
    <ol class="sd-list">
      ${ALL_QUESTIONS.map((q) => {
        const p = byQ.get(q.id);
        if (!p) return `<li class="pending"><p class="q">${esc(q.prompt)}</p><p class="muted">لم تصل إليه بعد</p></li>`;
        const steps = p.rec.attempts.map((a) => describeAttempt(q, a));
        return `<li>
          <div class="sd-q"><span class="res ${p.r.firstTry ? 'ok' : p.r.solved ? 'part' : 'no'}">${p.r.firstTry ? '✓' : p.r.solved ? '↻' : '✗'}</span><p class="q">${esc(q.prompt)}</p><span class="score">${pct(p.r.score)}</span></div>
          <p class="muted">${esc(toAr(p.r.detail))}${p.rec.revealed ? ' · عُرضت عليها الإجابة' : ''}${p.replays ? ` · أعادت المحاولة ${toAr(p.replays)} مرة` : ''}</p>
          <ol class="steps">${steps.map((s) => `<li class="${s.ok ? 'ok' : 'no'}">${esc(s.text)}</li>`).join('')}</ol>
        </li>`;
      }).join('')}
    </ol>`;
}

async function removeStudent() {
  const uid = state.openStudent;
  const s = state.students.find((x) => x.uid === uid);
  if (!uid || !confirm(`حذف «${s?.name || ''}» وكل إجاباتها من هذا الفصل؟`)) return;
  await state.backend.removeStudent(state.current.code, uid);
  $('#student-dialog').close();
}

function exportCsv() {
  const rows = summarize();
  const header = ['الطالبة', 'المرحلة المكتملة', 'عدد الأسئلة المجابة', 'الدرجة %', ...ALL_QUESTIONS.map((q) => q.id)];
  const lines = [header];
  for (const r of rows) {
    const byQ = new Map(r.per.map((p) => [p.q?.id, p]));
    lines.push([
      r.name,
      r.stage || 0,
      r.answered,
      r.score == null ? '' : Math.round(r.score * 100),
      ...ALL_QUESTIONS.map((q) => (byQ.has(q.id) ? Math.round(byQ.get(q.id).r.score * 100) : '')),
    ]);
  }
  const csv = lines
    .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `نتائج-${state.current?.code || 'الفصل'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', '<p class="fatal">تعذّر تحميل اللوحة. حدّثي الصفحة.</p>');
});
