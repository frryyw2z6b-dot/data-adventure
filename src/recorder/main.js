// صفحة تسجيل صوت نورة بصوت المعلمة.
// تعرض جمل اللعبة واحدة واحدة، وتحفظ كل تسجيل في الجهاز (IndexedDB)،
// ثم تنزّل التسجيلات في ملف ZIP واحد تُسمّى ملفاته بمفاتيح الجمل نفسها التي تستخدمها اللعبة.
import '@fontsource/baloo-bhaijaan-2/700.css';
import '@fontsource/baloo-bhaijaan-2/800.css';
import './style.css';

const $ = (s) => document.querySelector(s);
const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// ── التخزين في الجهاز ──
const DB = 'da-recorder';
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('takes');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbOp(mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('takes', mode);
    const req = fn(tx.objectStore('takes'));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
  });
}
const putTake = (key, value) => dbOp('readwrite', (s) => s.put(value, key));
const getTake = (key) => dbOp('readonly', (s) => s.get(key));
const allKeys = () => dbOp('readonly', (s) => s.getAllKeys());

// ── ملف ZIP بسيط (تخزين دون ضغط) ──
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true);
    cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cenSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

// ── التسجيل ──
function pickMime() {
  for (const m of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  }
  return '';
}
const extFor = (mime) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

const state = { lines: [], i: 0, done: new Set(), stream: null, rec: null, chunks: [], player: null };

async function ensureMic() {
  if (state.stream) return state.stream;
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  // مؤشر مستوى الصوت أثناء التسجيل
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const an = ctx.createAnalyser();
  an.fftSize = 1024;
  ctx.createMediaStreamSource(state.stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  const tick = () => {
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    $('#meter').style.width = state.rec ? `${Math.min(100, Math.sqrt(s / buf.length) * 500)}%` : '0';
    requestAnimationFrame(tick);
  };
  tick();
  return state.stream;
}

async function toggleRecord() {
  const btn = $('#rec');
  if (state.rec) {
    state.rec.stop();
    return;
  }
  try {
    const stream = await ensureMic();
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    state.chunks = [];
    rec.ondataavailable = (e) => e.data.size && state.chunks.push(e.data);
    rec.onstop = async () => {
      const type = rec.mimeType || mime || 'audio/webm';
      const blob = new Blob(state.chunks, { type });
      state.rec = null;
      btn.classList.remove('recording');
      btn.textContent = '● أعيدي التسجيل';
      const line = state.lines[state.i];
      await putTake(line.key, { blob, type, text: line.text, at: Date.now() });
      state.done.add(line.key);
      setStatus('حُفظ التسجيل ✓ استمعي إليه، ثم انتقلي للتالية.');
      render();
    };
    rec.start();
    state.rec = rec;
    btn.classList.add('recording');
    btn.textContent = '■ أوقفي التسجيل';
    setStatus('جارٍ التسجيل… اقرئي الجملة ثم اضغطي «أوقفي».');
  } catch (e) {
    setStatus('لم يُسمح باستخدام الميكروفون. اسمحي للمتصفح باستخدامه من الإعدادات ثم حاولي مرة أخرى.');
  }
}

async function play(blob) {
  state.player?.pause();
  const a = new Audio(URL.createObjectURL(blob));
  state.player = a;
  await a.play().catch(() => setStatus('تعذّر التشغيل.'));
}

function setStatus(t) {
  $('#status').textContent = t;
}

async function render() {
  const n = state.lines.length;
  const line = state.lines[state.i];
  $('#line').textContent = line.text;
  $('#count').textContent = `الجملة ${toAr(state.i + 1)} من ${toAr(n)} · سُجّل ${toAr(state.done.size)} من ${toAr(n)}`;
  $('#bar').style.width = `${(state.done.size / n) * 100}%`;
  $('#play').disabled = !state.done.has(line.key);
  if (!state.rec) $('#rec').textContent = state.done.has(line.key) ? '● أعيدي التسجيل' : '● سجّلي';
  $('#prev').disabled = state.i === 0;
  $('#next').textContent = state.i === n - 1 ? 'انتهيتِ 🎉' : 'التالية ←';
}

function go(d) {
  if (state.rec) return;
  state.i = Math.max(0, Math.min(state.lines.length - 1, state.i + d));
  setStatus('');
  try {
    localStorage.setItem('da:rec:i', String(state.i));
  } catch {
    /* ignore */
  }
  render();
}

async function download() {
  const keys = await allKeys();
  if (!keys.length) return setStatus('لا توجد تسجيلات بعد.');
  setStatus('نجهّز الملف…');
  const files = [];
  const manifest = [];
  for (const key of keys) {
    const t = await getTake(key);
    const name = `${key}.${extFor(t.type)}`;
    files.push({ name, data: new Uint8Array(await t.blob.arrayBuffer()) });
    manifest.push({ key, file: name, text: t.text });
  }
  files.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 1)) });
  const zip = makeZip(files);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zip);
  a.download = `noura-voice-${toAr(keys.length)}.zip`.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus(`نُزّل ملف فيه ${toAr(keys.length)} تسجيلًا. أرسليه في المحادثة.`);
}

async function boot() {
  state.lines = await (await fetch('./voice/manifest.json')).json();
  state.done = new Set(await allKeys().catch(() => []));
  try {
    state.i = Math.min(Number(localStorage.getItem('da:rec:i') || 0), state.lines.length - 1);
  } catch {
    /* ignore */
  }
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    setStatus('هذا المتصفح لا يدعم التسجيل. جرّبي Safari أو Chrome حديثًا.');
    $('#rec').disabled = true;
  }
  $('#rec').addEventListener('click', toggleRecord);
  $('#play').addEventListener('click', async () => {
    const t = await getTake(state.lines[state.i].key);
    if (t) play(t.blob);
  });
  $('#orig').addEventListener('click', async () => {
    const r = await fetch(`./voice/${state.lines[state.i].key}.mp3`);
    if (r.ok) play(await r.blob());
  });
  $('#prev').addEventListener('click', () => go(-1));
  $('#next').addEventListener('click', () => go(1));
  $('#download').addEventListener('click', download);
  $('#first-missing').addEventListener('click', () => {
    const k = state.lines.findIndex((l) => !state.done.has(l.key));
    if (k >= 0) {
      state.i = k;
      render();
    } else setStatus('سجّلتِ كل الجمل 🎉 نزّلي الملف الآن.');
  });
  window.__rec = state;
  render();
}
boot();
