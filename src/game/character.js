// نورة: رفيقة المغامرة — طفلة سعودية بثوب أخضر مطرّز بالذهب على الطريقة النجدية
// وبُخْنُق تقليدي (غطاء رأس البنات المطرّز). مبنية برمجيًا لتنسجم مع المشهد.
//
// الحالات: idle (تنفّس ورمش)، talk (حركة الفم مع مستوى الصوت الفعلي)، wave، point، cheer، nod، think.
import * as THREE from 'three';

const SKIN = '#e3ab84';
const DRESS = '#1d7a4c';
const GOLD = '#e0b04a';
const BUKHNUQ = '#2a1838';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts });
}

/** خامة الثوب: أخضر مع شريط مطرّز عند الذيل ولوحة تطريز أمامية (النشل) */
function dressTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = DRESS;
  g.fillRect(0, 0, 512, 512);
  // نقوش خفيفة على القماش
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 10; y < 512; y += 22) for (let x = (y / 22) % 2 ? 0 : 11; x < 512; x += 22) g.fillRect(x, y, 3, 3);
  // شريط الذيل: مثلثات نجدية ذهبية (أسفل الخامة = الذيل)
  g.fillStyle = GOLD;
  g.fillRect(0, 0, 512, 10);
  g.fillRect(0, 44, 512, 5);
  for (let x = 0; x < 512; x += 24) {
    g.beginPath();
    g.moveTo(x, 12);
    g.lineTo(x + 12, 40);
    g.lineTo(x + 24, 12);
    g.closePath();
    g.fill();
  }
  // لوحة التطريز الأمامية عند حافتي الخامة (u≈0 و u≈1 = الأمام)
  for (const x0 of [0, 512 - 34]) {
    g.fillStyle = GOLD;
    g.fillRect(x0, 0, 34, 512);
    g.fillStyle = '#b8323a';
    for (let y = 60; y < 512; y += 30) {
      g.beginPath();
      g.moveTo(x0 + 17, y);
      g.lineTo(x0 + 29, y + 12);
      g.lineTo(x0 + 17, y + 24);
      g.lineTo(x0 + 5, y + 12);
      g.closePath();
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** خامة البخنق: داكن بنقاط وزخارف ذهبية */
function bukhnuqTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = BUKHNUQ;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = GOLD;
  for (let y = 8; y < 256; y += 26) {
    for (let x = (y / 26) % 2 ? 0 : 13; x < 256; x += 26) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(224,176,74,0.55)';
  g.lineWidth = 2;
  for (let y = 21; y < 256; y += 52) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 13) g.lineTo(x, y + (x / 13) % 2 * 8);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

function lathe(points, seg = 40) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

/** نقطة على سطح كرة الوجه */
function onFace(r, x, y, lift = 0.004) {
  const z = Math.sqrt(Math.max(r * r - x * x - y * y, 0));
  return new THREE.Vector3(x, y, z + lift);
}

export function createNoura(engine, audio) {
  const root = new THREE.Group();
  root.name = 'noura';
  const body = new THREE.Group();
  root.add(body);

  const skin = mat(SKIN, { roughness: 0.55 });
  const gold = mat(GOLD, { metalness: 0.7, roughness: 0.3 });
  const dressMat = mat('#ffffff', { map: dressTexture(), roughness: 0.75 });
  const bukMat = mat('#ffffff', { map: bukhnuqTexture(), roughness: 0.65, side: THREE.DoubleSide });

  // الحذاء
  for (const x of [-0.1, 0.1]) {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), mat('#7a1f2b'));
    shoe.scale.set(0.9, 0.55, 1.4);
    shoe.position.set(x, 0.045, 0.06);
    body.add(shoe);
  }
  // الثوب
  const dress = new THREE.Mesh(
    lathe([
      [0.0, 0.08],
      [0.4, 0.08],
      [0.42, 0.13],
      [0.37, 0.38],
      [0.31, 0.66],
      [0.25, 0.9],
      [0.2, 1.0],
      [0.13, 1.07],
      [0.0, 1.09],
    ]),
    dressMat,
  );
  body.add(dress);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.022, 8, 48), gold);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.11;
  body.add(hem);

  // الذراعان (مِحوَر عند الكتف)
  function arm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.235, 0.97, 0.02);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.12, 0.4, 16, 1, true), dressMat);
    sleeve.position.y = -0.2;
    pivot.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 8, 24), gold);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.39;
    pivot.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), skin);
    hand.position.y = -0.44;
    pivot.add(hand);
    pivot.rotation.z = side * 0.55;
    body.add(pivot);
    return pivot;
  }
  const armL = arm(1); // يسارها (+x)
  const armR = arm(-1); // يمينها (−x)

  // الرأس
  const head = new THREE.Group();
  head.position.y = 1.42;
  body.add(head);
  const R = 0.34;
  const face = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 28), skin);
  face.scale.set(1, 0.96, 0.95);
  head.add(face);

  // غرة شعر سوداء تظهر من تحت البخنق
  const fringe = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.012, 32, 12, Math.PI * 0.15, Math.PI * 0.7, 0.35, 0.55),
    mat('#24150f', { roughness: 0.45 }),
  );
  fringe.rotation.y = 0;
  head.add(fringe);

  // البخنق: غطاء مفتوح من الأمام حول الوجه + ينسدل على الكتفين
  const open = 0.92;
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.05, 40, 24, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.86),
    bukMat,
  );
  head.add(hood);
  const hoodTop = new THREE.Mesh(new THREE.SphereGeometry(R + 0.05, 40, 10, 0, Math.PI * 2, 0, 0.62), bukMat);
  head.add(hoodTop);
  // ينسدل البخنق من تحت الذقن إلى الكتفين (لا يغطي الوجه)
  const drape = new THREE.Mesh(
    lathe(
      [
        [0.2, -0.3],
        [0.27, -0.38],
        [0.34, -0.47],
        [0.41, -0.56],
      ],
      40,
    ),
    bukMat,
  );
  head.add(drape);
  // حافة ذهبية تتبع فتحة البخنق حول الوجه، تتدلى منها قطع ذهبية صغيرة
  const HR = R + 0.055;
  const sph = (phi, theta) =>
    new THREE.Vector3(-HR * Math.cos(phi) * Math.sin(theta), HR * Math.cos(theta), HR * Math.sin(phi) * Math.sin(theta));
  const edge = [];
  const thTop = 0.62;
  const thBot = Math.PI * 0.8;
  const pl = Math.PI / 2 + open;
  const pr = Math.PI / 2 - open;
  for (let k = 0; k <= 8; k++) edge.push(sph(pl, thBot - (thBot - thTop) * (k / 8)));
  for (let k = 1; k < 10; k++) edge.push(sph(pl - (pl - pr) * (k / 10), thTop));
  for (let k = 0; k <= 8; k++) edge.push(sph(pr, thTop + (thBot - thTop) * (k / 8)));
  const trimCurve = new THREE.CatmullRomCurve3(edge);
  head.add(new THREE.Mesh(new THREE.TubeGeometry(trimCurve, 80, 0.022, 8, false), gold));
  for (let i = 1; i < 12; i++) {
    const p = trimCurve.getPoint(i / 12);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 12), gold);
    coin.position.copy(p).multiplyScalar(1.03);
    coin.position.y -= 0.03;
    coin.lookAt(coin.position.clone().multiplyScalar(2));
    coin.rotateX(Math.PI / 2);
    head.add(coin);
  }
  const chestTrim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 8, 40), gold);
  chestTrim.rotation.x = Math.PI / 2;
  chestTrim.position.y = -0.56;
  head.add(chestTrim);

  // العينان
  const eyes = [];
  for (const x of [-0.115, 0.115]) {
    const eye = new THREE.Group();
    eye.position.copy(onFace(R * 0.95, x, 0.03, 0.0));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), mat('#1b120e', { roughness: 0.2 }));
    ball.scale.set(0.85, 1.15, 0.5);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    shine.position.set(0.014, 0.022, 0.024);
    eye.add(ball, shine);
    head.add(eye);
    eyes.push(eye);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.06, 4, 8), mat('#2a1a12'));
    brow.position.copy(onFace(R * 0.97, x, 0.115, 0.002));
    brow.rotation.z = Math.PI / 2 + (x > 0 ? -0.15 : 0.15);
    head.add(brow);
    const cheek = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 20),
      new THREE.MeshBasicMaterial({ color: '#ff8b8b', transparent: true, opacity: 0.38, depthWrite: false }),
    );
    const cp = onFace(R * 0.96, x * 1.45, -0.075, 0.006);
    cheek.position.copy(cp);
    cheek.lookAt(cp.clone().multiplyScalar(2));
    head.add(cheek);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mat('#d6956c'));
  nose.position.copy(onFace(R * 0.95, 0, -0.04, 0.008));
  head.add(nose);

  // الفم: ابتسامة مغلقة + فم مفتوح يتحرك مع الكلام
  const mouth = new THREE.Group();
  mouth.position.copy(onFace(R * 0.95, 0, -0.12, 0.006));
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 20, Math.PI), mat('#9b3a3a'));
  smile.rotation.z = Math.PI;
  const openMouth = new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), new THREE.MeshBasicMaterial({ color: '#7a2230' }));
  openMouth.scale.set(1, 0.05, 1);
  openMouth.position.y = -0.012;
  mouth.add(smile, openMouth);
  head.add(mouth);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
    }
  });
  // الملامح الصغيرة لا تلقي ظلًا
  [...eyes, mouth, nose].forEach((o) => o.traverse((m) => (m.castShadow = false)));

  root.scale.setScalar(1.25);
  engine.scene.add(root);

  // ── الحركة ──
  let action = 'idle';
  let actionT = 0;
  let talking = false;
  let blinkAt = 1.5;
  let yawTarget = 0;
  let faceCamera = true;
  let pointTarget = null;
  const REST = 0.55; // الذراعان خارج الثوب قليلًا
  const pose = { lz: REST, lx: 0, rz: -REST, rx: 0, jump: 0, spin: 0, nod: 0, tilt: 0 };
  const lerp = THREE.MathUtils.lerp;
  const tmp = new THREE.Vector3();

  engine.onUpdate((dt, t) => {
    if (!root.visible) return;
    actionT += dt;
    // وضعيات مستهدفة حسب الحالة
    const tgt = { lz: REST, lx: 0, rz: -REST, rx: 0, jump: 0, spin: 0, nod: 0, tilt: Math.sin(t * 0.7) * 0.04 };
    if (action === 'wave') {
      tgt.rz = -2.5 + Math.sin(actionT * 10) * 0.35;
      tgt.tilt = 0.12;
      if (actionT > 1.8) setAction('idle');
    } else if (action === 'point') {
      tgt.rz = -1.25;
      tgt.rx = -0.9;
      if (actionT > 2.4) setAction('idle');
    } else if (action === 'cheer') {
      tgt.lz = 2.6 + Math.sin(actionT * 14) * 0.15;
      tgt.rz = -2.6 - Math.sin(actionT * 14) * 0.15;
      tgt.jump = Math.abs(Math.sin(actionT * 6)) * 0.28;
      if (actionT > 2.2) setAction('idle');
    } else if (action === 'nod') {
      tgt.nod = Math.sin(actionT * 9) * 0.16;
      tgt.lz = 0.5;
      tgt.lx = -0.5;
      tgt.rz = -0.5;
      tgt.rx = -0.5;
      if (actionT > 1.2) setAction('idle');
    } else if (action === 'think') {
      tgt.rz = -0.6;
      tgt.rx = -1.9;
      tgt.tilt = 0.18;
      if (actionT > 2) setAction('idle');
    } else if (action === 'spin') {
      tgt.spin = Math.min(actionT / 0.9, 1) * Math.PI * 2;
      tgt.jump = Math.sin(Math.min(actionT / 0.9, 1) * Math.PI) * 0.35;
      tgt.lz = 1.4;
      tgt.rz = -1.4;
      if (actionT > 1.1) setAction('idle');
    }
    const k = Math.min(1, dt * 9);
    for (const key of Object.keys(pose)) pose[key] = key === 'spin' ? tgt.spin : lerp(pose[key], tgt[key], k);
    armL.rotation.set(pose.lx, 0, pose.lz);
    armR.rotation.set(pose.rx, 0, pose.rz);
    body.position.y = pose.jump;
    body.rotation.y = pose.spin;

    // التنفّس والتمايل
    body.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
    body.rotation.z = Math.sin(t * 0.9) * 0.02;
    head.rotation.z = pose.tilt;

    // الكلام: مستوى صوت نورة الفعلي يحرك الفم والرأس
    const level = talking ? Math.min(1, (audio?.voiceLevel?.() ?? 0) * 7) : 0;
    const open = talking ? Math.max(level, 0.12 + Math.abs(Math.sin(t * 13)) * (audio?.voiceLevel ? 0 : 0.5)) : 0;
    openMouth.scale.y = lerp(openMouth.scale.y, 0.05 + open * 0.95, Math.min(1, dt * 20));
    smile.visible = openMouth.scale.y < 0.25;
    head.rotation.x = pose.nod + (talking ? Math.sin(t * 5) * 0.03 : 0) - 0.04;

    // الرمش
    blinkAt -= dt;
    const blink = blinkAt < 0 ? Math.max(0.08, Math.abs(Math.cos(Math.min(-blinkAt / 0.16, 1) * Math.PI))) : 1;
    for (const e of eyes) e.scale.y = blink;
    if (blinkAt < -0.16) blinkAt = 2 + Math.random() * 3;

    // الالتفات: نحو الكاميرا أو نحو ما تشير إليه
    if (pointTarget && action === 'point') {
      tmp.copy(pointTarget).sub(root.position);
      yawTarget = Math.atan2(tmp.x, tmp.z);
    } else if (faceCamera) {
      tmp.copy(engine.camera.position).sub(root.position);
      yawTarget = Math.atan2(tmp.x, tmp.z);
    }
    let d = yawTarget - root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    root.rotation.y += d * Math.min(1, dt * 4);
  });

  function setAction(name) {
    action = name;
    actionT = 0;
  }

  return {
    root,
    get action() {
      return action;
    },
    get talking() {
      return talking;
    },
    place(x, z, { visible = true } = {}) {
      root.position.set(x, 0, z);
      root.visible = visible;
    },
    hide() {
      root.visible = false;
    },
    show() {
      root.visible = true;
    },
    setTalking(on) {
      talking = on;
    },
    wave: () => setAction('wave'),
    cheer: () => setAction('cheer'),
    nod: () => setAction('nod'),
    think: () => setAction('think'),
    spin: () => setAction('spin'),
    point(target) {
      pointTarget = target ? target.clone() : null;
      setAction('point');
    },
    faceCamera(on) {
      faceCamera = on;
    },
  };
}
