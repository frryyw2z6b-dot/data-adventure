// لوح البيانات: لوح خشبي نجدي قائم خلف السجادة بإطار محفور وشرفات مثلثة،
// يُرسم عليه (Canvas) جدول الإشارات ومحاور الأعمدة البيانية وعناوين التمثيلات.
import * as THREE from 'three';
import { ease } from './tween.js';

export const BOARD = { W: 7.4, H: 3.3, bottom: 0.32, z: -2.5, PX: 1600 };
BOARD.PY = Math.round((BOARD.PX * BOARD.H) / BOARD.W);
export const FONT = '"Baloo Bhaijaan 2", "Tahoma", sans-serif';

export function createBoard(engine) {
  const group = new THREE.Group();
  group.position.set(0, 0, BOARD.z);
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.8 });
  const woodDark = new THREE.MeshStandardMaterial({ color: '#4a2c17', roughness: 0.85 });

  const canvas = document.createElement('canvas');
  canvas.width = BOARD.PX;
  canvas.height = BOARD.PY;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD.W, BOARD.H),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
  );
  face.position.set(0, BOARD.bottom + BOARD.H / 2, 0.06);
  face.receiveShadow = true;
  face.userData.board = true;
  group.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(BOARD.W + 0.1, BOARD.H + 0.1, 0.1), woodDark);
  back.position.set(0, BOARD.bottom + BOARD.H / 2, 0);
  back.castShadow = true;
  group.add(back);

  // الإطار
  const t = 0.16;
  const frame = [
    [BOARD.W + 2 * t, t, 0, BOARD.bottom - t / 2],
    [BOARD.W + 2 * t, t, 0, BOARD.bottom + BOARD.H + t / 2],
    [t, BOARD.H, -BOARD.W / 2 - t / 2, BOARD.bottom + BOARD.H / 2],
    [t, BOARD.H, BOARD.W / 2 + t / 2, BOARD.bottom + BOARD.H / 2],
  ];
  for (const [w, h, x, y] of frame) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), wood);
    m.position.set(x, y, 0.04);
    m.castShadow = true;
    group.add(m);
  }
  // شرفات نجدية متدرجة أعلى اللوح
  const s = new THREE.Shape();
  s.moveTo(-0.16, 0);
  s.lineTo(0.16, 0);
  s.lineTo(0.16, 0.08);
  s.lineTo(0.08, 0.08);
  s.lineTo(0.08, 0.17);
  s.lineTo(0, 0.28);
  s.lineTo(-0.08, 0.17);
  s.lineTo(-0.08, 0.08);
  s.lineTo(-0.16, 0.08);
  s.closePath();
  const crenGeo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false });
  const n = 15;
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(crenGeo, wood);
    c.position.set(-BOARD.W / 2 + (i + 0.5) * (BOARD.W / n), BOARD.bottom + BOARD.H + t, -0.03);
    c.castShadow = true;
    group.add(c);
  }
  // قائمتان
  for (const x of [-BOARD.W / 2 + 0.3, BOARD.W / 2 - 0.3]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, BOARD.bottom + 0.2, 0.16), woodDark);
    leg.position.set(x, (BOARD.bottom + 0.2) / 2 - 0.1, -0.02);
    group.add(leg);
  }

  group.visible = false;
  engine.scene.add(group);

  // تحويل بين بكسلات اللوح والعالم
  const toWorld = (px, py, dz = 0.12) =>
    new THREE.Vector3(
      (px / BOARD.PX - 0.5) * BOARD.W,
      BOARD.bottom + (1 - py / BOARD.PY) * BOARD.H,
      BOARD.z + dz,
    );
  const fromUV = (uv) => ({ px: uv.x * BOARD.PX, py: (1 - uv.y) * BOARD.PY });

  function clearPaper() {
    // ورق كريمي بملمس خفيف وحافة مزخرفة
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#f6ecd6';
    g.fillRect(0, 0, BOARD.PX, BOARD.PY);
    g.fillStyle = 'rgba(120,80,40,0.05)';
    for (let i = 0; i < 2500; i++) g.fillRect((i * 97) % BOARD.PX, (i * 61) % BOARD.PY, 2, 2);
    g.strokeStyle = '#b98a4e';
    g.lineWidth = 6;
    g.strokeRect(14, 14, BOARD.PX - 28, BOARD.PY - 28);
  }

  return {
    group,
    face,
    g,
    canvas,
    toWorld,
    fromUV,
    draw(fn) {
      clearPaper();
      g.direction = 'rtl';
      fn(g);
      tex.needsUpdate = true;
    },
    async show() {
      if (group.visible) return;
      group.visible = true;
      group.position.y = -4;
      await engine.tweens.run(0.7, (k) => (group.position.y = -4 + 4 * k), ease.outBack);
    },
    async hide() {
      if (!group.visible) return;
      await engine.tweens.run(0.4, (k) => (group.position.y = -4 * k), ease.inCubic);
      group.visible = false;
      group.position.y = 0;
    },
  };
}

export function title(g, text, y = 70) {
  g.fillStyle = '#4a2a14';
  g.font = `800 64px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, BOARD.PX / 2, y);
}

/** رسم إشارات العد: حزم من خمس (أربع قائمة يقطعها خط مائل) */
export function drawTally(g, count, xRight, yMid, h = 110, color = '#3a2414') {
  const gap = h * 0.24;
  const bundleGap = h * 0.5;
  let x = xRight;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = h * 0.085;
  const bundles = Math.floor(count / 5);
  const rest = count % 5;
  const wobble = (i) => Math.sin(i * 12.9898) * h * 0.03;
  let k = 0;
  for (let b = 0; b < bundles; b++) {
    const x0 = x;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(x + wobble(k), yMid - h / 2);
      g.lineTo(x - wobble(k + 1), yMid + h / 2);
      g.stroke();
      x -= gap;
      k++;
    }
    g.beginPath();
    g.moveTo(x0 + gap * 0.6, yMid + h * 0.36);
    g.lineTo(x + gap * 0.4, yMid - h * 0.36);
    g.stroke();
    x -= bundleGap;
  }
  for (let i = 0; i < rest; i++) {
    g.beginPath();
    g.moveTo(x + wobble(k), yMid - h / 2);
    g.lineTo(x - wobble(k + 1), yMid + h / 2);
    g.stroke();
    x -= gap;
    k++;
  }
  return x;
}
