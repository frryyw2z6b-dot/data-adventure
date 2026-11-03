// عروض البيانات: جدول الإشارات (على اللوح)، التمثيل بالصور (صور ثلاثية الأبعاد على السجادة)،
// والأعمدة البيانية (مكعبات وحدات مكدسة أمام اللوح فوق رف خشبي).
import * as THREE from 'three';
import { BOARD, FONT, title as drawTitle, drawTally } from './board.js';
import { drawIcon } from './icons2d.js';
import { createItem, PALETTE } from './models.js';
import { labelTexture } from './textures.js';
import { ease } from './tween.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const INK = '#3a2414';
const WRONG = '#c0392b';

function rowColor(row) {
  const ic = row.icon || {};
  if (ic.color) return PALETTE[ic.color] || ic.color;
  return { date: '#7a3d18', orange: PALETTE.orange, apple: '#d8352f', cup: '#e9e1d2', dallah: '#d4a43a' }[ic.model] || '#3f7fe6';
}

function label(text, color) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, { color }), transparent: true, depthTest: false }));
  sp.scale.set(1.5, 0.47, 1);
  sp.renderOrder = 10;
  return sp;
}

// ───────────────────────────── جدول الإشارات ─────────────────────────────
export function tallyView(ctx, { title, rows, highlight = [] }) {
  const { dataBoard } = ctx;
  const draw = (counts, wrongRows = []) =>
    dataBoard.draw((g) => {
      if (title) drawTitle(g, title);
      const top = title ? 140 : 60;
      const n = rows.length;
      const unlabeled = n === 1 && !rows[0].label;
      if (unlabeled) {
        const c = counts[0];
        const h = 240;
        const width = c * h * 0.24 + Math.floor(c / 5) * h * 0.5;
        drawTally(g, c, BOARD.PX / 2 + width / 2, BOARD.PY / 2 + 10, h, wrongRows.includes(0) ? WRONG : INK);
        return;
      }
      const rowH = Math.min(175, (BOARD.PY - top - 40) / n);
      g.strokeStyle = '#b98a4e';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(1160, top);
      g.lineTo(1160, top + rowH * n);
      g.stroke();
      rows.forEach((r, i) => {
        const y = top + rowH * (i + 0.5);
        if (i > 0) {
          g.beginPath();
          g.moveTo(60, top + rowH * i);
          g.lineTo(BOARD.PX - 60, top + rowH * i);
          g.stroke();
        }
        if (highlight.includes(r.id) || wrongRows.includes(i)) {
          g.fillStyle = wrongRows.includes(i) ? 'rgba(192,57,43,0.12)' : 'rgba(224,168,58,0.22)';
          g.fillRect(64, top + rowH * i + 4, BOARD.PX - 128, rowH - 8);
        }
        drawIcon(g, r.icon, 1480, y, rowH * 0.62);
        g.fillStyle = INK;
        g.font = `800 ${Math.round(rowH * 0.36)}px ${FONT}`;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        g.fillText(r.label, 1405, y + 4);
        drawTally(g, counts[i], 1090, y, rowH * 0.62, wrongRows.includes(i) ? WRONG : INK);
      });
    });
  const counts = rows.map((r) => r.count);
  draw(counts);
  return { draw, counts, dispose() {} };
}

// ───────────────────────────── التمثيل بالصور ─────────────────────────────
const PICTO = { slot0: 2.5, step: 0.76, max: 9, stripW: 7.3 };

export function pictoView(ctx, { title, keyText, rows, interactive = false, table = null }) {
  const { dataBoard, board, engine, audio } = ctx;
  // اللوح: العنوان والمفتاح، أو جدول البيانات المطلوب تمثيلها
  dataBoard.draw((g) => {
    drawTitle(g, title || '');
    if (table) {
      const top = 150;
      const rowH = Math.min(150, (BOARD.PY - top - 40) / table.length);
      table.forEach((r, i) => {
        const y = top + rowH * (i + 0.5);
        drawIcon(g, r.icon, 1000, y, rowH * 0.6);
        g.fillStyle = INK;
        g.font = `800 ${Math.round(rowH * 0.42)}px ${FONT}`;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        g.fillText(r.label, 920, y + 4);
        g.font = `800 ${Math.round(rowH * 0.6)}px ${FONT}`;
        g.textAlign = 'center';
        g.fillStyle = '#1f6b45';
        g.fillText(AR(r.count), 560, y + 4);
      });
    } else if (keyText) {
      g.fillStyle = '#6b4f3a';
      g.font = `700 52px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(keyText, BOARD.PX / 2, 170);
      // صفوف إرشادية تحت المفتاح
      g.fillStyle = '#7a5a3a';
      g.font = `600 40px ${FONT}`;
      g.fillText('اُنْظُرِي إِلَى الصُّفُوفِ عَلَى السَّجَّادَةِ', BOARD.PX / 2, 290);
    }
  });

  const n = rows.length;
  const zs = n === 1 ? [0.0] : n === 2 ? [-0.75, 0.55] : [-1.3, -0.15, 1.0];
  const rowObjs = rows.map((r, i) => {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(PICTO.stripW, 1.0),
      new THREE.MeshStandardMaterial({ color: '#f6e7c8', transparent: true, opacity: 0.55, roughness: 1 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(-0.75, 0.05, zs[i]);
    strip.userData.rowIndex = i;
    board.add(strip);
    const lb = label(r.label, rowColor(r));
    lb.position.set(3.75, 0.55, zs[i]);
    board.add(lb);
    return { strip, label: lb, items: [], z: zs[i], row: r };
  });

  function slotPos(i, k) {
    return new THREE.Vector3(PICTO.slot0 - k * PICTO.step, 0.05, rowObjs[i].z);
  }

  function add(i, animate = true) {
    const ro = rowObjs[i];
    if (ro.items.length >= PICTO.max) return false;
    const it = createItem({ ...ro.row.icon, id: `${ro.row.id}-${ro.items.length}` });
    it.userData.rowIndex = i;
    it.scale.setScalar(0.78);
    const p = slotPos(i, ro.items.length);
    it.position.copy(p);
    board.add(it);
    ro.items.push(it);
    if (animate) {
      it.position.y = 1.6;
      engine.tweens.run(0.4, (k) => (it.position.y = p.y + (1 - k) * 1.6), ease.outCubic);
      audio.pop();
    }
    return true;
  }
  function removeLast(i) {
    const ro = rowObjs[i];
    const it = ro.items.pop();
    if (!it) return false;
    engine.tweens.run(0.2, (k) => it.scale.setScalar(0.78 * (1 - k) + 0.001), ease.inCubic).then(() => board.remove(it));
    audio.drop();
    return true;
  }
  function setCount(i, c) {
    while (rowObjs[i].items.length < c) add(i, true);
    while (rowObjs[i].items.length > c) removeLast(i);
  }
  async function flash(indexes, color = '#e06666') {
    const mats = indexes.map((i) => rowObjs[i].strip.material);
    mats.forEach((m) => m.color.set(color));
    await engine.tweens.wait(0.9);
    mats.forEach((m) => m.color.set('#f6e7c8'));
  }

  if (!interactive) {
    // العرض: الصور تظهر تباعًا صفًا صفًا
    rows.forEach((r, i) => {
      for (let k = 0; k < r.count; k++) {
        setTimeout(() => add(i, true), (i * 4 + k) * 70);
      }
    });
  }

  return {
    rowObjs,
    /** نقطة في منتصف صف (للاختبار الآلي) */
    rowPoint: (i) => new THREE.Vector3(-1.5, 0.08, rowObjs[i].z),
    counts: () => rowObjs.map((r) => r.items.length),
    add,
    removeLast,
    setCount,
    flash,
    /** الصف الذي لمسته الطالبة (أو صورة داخله) */
    hitRow(pointer) {
      const targets = rowObjs.flatMap((r) => [r.strip, ...r.items]);
      const hit = pointer.hit(targets);
      if (!hit) return null;
      return { row: hit.userData.rowIndex, onItem: hit !== rowObjs[hit.userData.rowIndex].strip };
    },
    dispose() {},
  };
}

// ───────────────────────────── الأعمدة البيانية ─────────────────────────────
const BAR = { maxScale: 8, base: 590, top: 150, right: 1300, left: 170 };
BAR.unit = (BAR.base - BAR.top) / BAR.maxScale;

export function barView(ctx, { title, rows, interactive = false }) {
  const { dataBoard, board, engine, audio } = ctx;
  const n = rows.length;
  const colW = (BAR.right - BAR.left) / n;
  const centers = rows.map((_, i) => BAR.right - (i + 0.5) * colW);

  dataBoard.draw((g) => {
    drawTitle(g, title || '', 64);
    g.textBaseline = 'middle';
    for (let v = 0; v <= BAR.maxScale; v++) {
      const y = BAR.base - v * BAR.unit;
      g.strokeStyle = v === 0 ? INK : 'rgba(90,60,30,0.28)';
      g.lineWidth = v === 0 ? 6 : 3;
      g.beginPath();
      g.moveTo(BAR.left - 20, y);
      g.lineTo(BAR.right, y);
      g.stroke();
      g.fillStyle = INK;
      g.font = `800 40px ${FONT}`;
      g.textAlign = 'left';
      g.fillText(AR(v), BAR.right + 26, y + 2);
    }
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(BAR.right, BAR.base);
    g.lineTo(BAR.right, BAR.top - 20);
    g.stroke();
    rows.forEach((r, i) => {
      drawIcon(g, r.icon, centers[i] + 80, BAR.base + 58, 66);
      g.fillStyle = INK;
      g.font = `800 46px ${FONT}`;
      g.textAlign = 'right';
      g.fillText(r.label, centers[i] + 35, BAR.base + 60);
    });
  });

  const baseW = dataBoard.toWorld(BAR.left - 20, BAR.base, 0.25);
  const unitW = (BAR.unit / BOARD.PY) * BOARD.H; // ارتفاع المكعب بوحدات العالم
  const cubeW = Math.min(0.62, ((colW / BOARD.PX) * BOARD.W) * 0.4);
  const cubeGeo = new RoundedBoxGeometry(cubeW, unitW * 0.86, 0.16, 2, 0.03);
  const cols = rows.map((r, i) => ({ row: r, cubes: [], x: dataBoard.toWorld(centers[i], 0).x, color: rowColor(r) }));

  function addCube(i, animate = true) {
    const c = cols[i];
    if (c.cubes.length >= BAR.maxScale) return;
    const m = new THREE.Mesh(cubeGeo, new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.45 }));
    const y = baseW.y + unitW * (c.cubes.length + 0.5);
    m.position.set(c.x, y, BOARD.z + 0.16);
    m.castShadow = true;
    m.userData.col = i;
    m.userData.level = c.cubes.length + 1;
    board.add(m);
    c.cubes.push(m);
    if (animate) {
      m.scale.set(1, 0.01, 1);
      engine.tweens.run(0.18, (k) => m.scale.set(1, Math.max(0.01, k), 1), ease.outBack);
    }
  }
  function removeCube(i) {
    const m = cols[i].cubes.pop();
    if (m) board.remove(m);
  }
  function setLevel(i, level) {
    level = Math.max(0, Math.min(BAR.maxScale, level));
    if (level === cols[i].cubes.length) return false;
    const up = level > cols[i].cubes.length;
    while (cols[i].cubes.length < level) addCube(i);
    while (cols[i].cubes.length > level) removeCube(i);
    up ? audio.pop() : audio.drop();
    return true;
  }
  async function flash(indexes, color = '#e06666') {
    const ms = indexes.flatMap((i) => cols[i].cubes.map((m) => m.material));
    const old = ms.map((m) => m.color.getHex());
    ms.forEach((m) => m.color.set(color));
    await engine.tweens.wait(0.9);
    ms.forEach((m, k) => m.color.setHex(old[k]));
  }

  if (!interactive) {
    rows.forEach((r, i) => {
      for (let k = 0; k < r.count; k++) setTimeout(() => addCube(i, true), 250 + k * 90 + i * 120);
    });
  }

  return {
    cols,
    /** نقطة على اللوح عند عمود ومستوى معيّنين (للاختبار الآلي) */
    levelPoint: (i, level) => new THREE.Vector3(cols[i].x, baseW.y + unitW * (level - 0.5), BOARD.z + 0.07),
    counts: () => cols.map((c) => c.cubes.length),
    setLevel,
    flash,
    /** يحدد العمود والمستوى من لمسة على اللوح أو على المكعبات */
    hitLevel(pointer) {
      const cubes = cols.flatMap((c) => c.cubes);
      const hitCube = pointer.hit(cubes);
      if (hitCube) {
        const { col, level } = hitCube.userData;
        // لمس أعلى مكعب يزيله؛ لمس مكعب أدنى يقصّ العمود عنده
        return { col, level: level === cols[col].cubes.length ? level - 1 : level };
      }
      const hits = pointer.raycaster.intersectObject(dataBoard.face);
      if (!hits.length) return null;
      const { px, py } = dataBoard.fromUV(hits[0].uv);
      const col = centers.findIndex((c) => Math.abs(px - c) < colW / 2);
      if (col < 0 || py > BAR.base + 20) return null;
      return { col, level: Math.ceil((BAR.base - py) / BAR.unit - 0.1) };
    },
    dispose() {},
  };
}
