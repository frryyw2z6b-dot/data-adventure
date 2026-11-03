// عالم المغامرة: كثبان رملية وقت الغروب، حصن نجدي من الطين بشرفاته المثلثة،
// نخيل، موقد قهوة، فوانيس، وسجادة سدو تُجرى عليها الأنشطة.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  saduTexture,
  plasterTexture,
  najdiDoorTexture,
  frondTexture,
  softDotTexture,
  seeded,
} from './textures.js';

export const SUN_DIR = new THREE.Vector3(-30, 17, 14).normalize();
export const RUG = { w: 9.4, d: 5.8 };

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function duneHeight(x, z) {
  const r = Math.hypot(x * 0.8, z + 6);
  const flat = smoothstep(20, 46, r);
  const a = Math.sin(x * 0.043 + z * 0.021) * 3.4;
  const b = Math.sin(z * 0.057 - x * 0.031 + 1.3) * 2.3;
  const ridge = 1 - Math.abs(Math.sin(x * 0.028 + z * 0.047 + 0.6));
  const c = Math.sin((x - z) * 0.11) * 0.6;
  return (a + b + ridge * 5.5 + c + 4) * flat;
}

export function buildWorld(engine) {
  const { scene } = engine;
  const root = new THREE.Group();
  scene.add(root);

  // ── السماء ──
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#33407a') },
      mid: { value: new THREE.Color('#d98f63') },
      horizon: { value: new THREE.Color('#ffd09a') },
      sunDir: { value: SUN_DIR },
      sunColor: { value: new THREE.Color('#fff1c9') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, top, smoothstep(0.12, 0.75, h));
        col = mix(col, horizon * 0.9, smoothstep(0.0, -0.15, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.22);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.Fog('#f0b98a', 70, 330);

  // ── الإضاءة ──
  const hemi = new THREE.HemisphereLight('#a9bde8', '#c9925f', 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd3a3', 3.1);
  sun.position.copy(SUN_DIR).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -20;
  sc.right = 20;
  sc.top = 20;
  sc.bottom = -20;
  sc.near = 1;
  sc.far = 110;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#9fb4ff', 0.55);
  rim.position.set(20, 12, -25);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffe6c8', 0.5);
  fill.position.set(6, 10, 20);
  scene.add(fill);

  // ── الكثبان ──
  const dunes = new THREE.PlaneGeometry(700, 700, 220, 220);
  dunes.rotateX(-Math.PI / 2);
  const pos = dunes.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sandLight = new THREE.Color('#ecc58f');
  const sandDark = new THREE.Color('#c48a57');
  const yard = new THREE.Color('#d6a774');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = duneHeight(x, z);
    pos.setY(i, h - 0.02);
    const r = Math.hypot(x * 0.8, z + 6);
    tmp.copy(sandDark).lerp(sandLight, Math.min(1, 0.35 + h / 12));
    tmp.lerp(yard, 1 - smoothstep(14, 30, r));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  dunes.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  dunes.computeVertexNormals();
  const ground = new THREE.Mesh(dunes, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 }));
  ground.receiveShadow = true;
  root.add(ground);

  // ── سجادة السدو (منطقة اللعب) ──
  const rugTex = saduTexture();
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(RUG.w, 0.04, RUG.d),
    new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.9 }),
  );
  rug.position.y = 0.02;
  rug.receiveShadow = true;
  root.add(rug);

  // ── الحصن النجدي ──
  const plaster = plasterTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, color: '#ffffff', roughness: 0.95 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#3b2216', roughness: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6e4826', roughness: 0.85 });

  const crenGeo = crenellationGeometry();
  const triGeo = triangleGeometry();
  const crenPositions = [];
  const triPositions = [];

  function block({ x, z, w, h, d, ry = 0, windows = true }) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const tex = plaster.clone();
    tex.repeat.set(w / 6, h / 6);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat.clone());
    m.material.map = tex;
    m.position.y = h / 2;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    // شريط بارز أعلى الجدار
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.18, d + 0.16), wallMat);
    lip.position.y = h - 0.15;
    lip.castShadow = true;
    g.add(lip);
    g.updateMatrixWorld(true);
    // الشرفات على الحافة الأمامية والجانبين
    const step = 0.62;
    const n = Math.floor(w / step);
    for (let i = 0; i < n; i++) {
      const lx = -w / 2 + step / 2 + i * step + (w - n * step) / 2;
      crenPositions.push(new THREE.Vector3(lx, h, d / 2 - 0.12).applyMatrix4(g.matrixWorld), g.rotation.y);
    }
    // نوافذ مثلثة صغيرة
    if (windows) {
      for (let row = 0; row < 2; row++) {
        const y = h - 0.75 - row * 0.5;
        if (y < 1.2) continue;
        for (let lx = -w / 2 + 0.6; lx < w / 2 - 0.4; lx += 0.45) {
          if (Math.abs(lx) < 1.6 && w > 12) continue;
          triPositions.push(new THREE.Vector3(lx, y, d / 2 + 0.011).applyMatrix4(g.matrixWorld), g.rotation.y);
        }
      }
      // مرازيم خشبية (مصارف المطر)
      for (const lx of [-w / 3, w / 3]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.7), woodMat);
        beam.position.set(lx, h - 0.45, d / 2 + 0.3);
        beam.castShadow = true;
        g.add(beam);
      }
    }
    root.add(g);
    return g;
  }

  // الجدار الرئيسي مع البوابة
  const fortZ = -11;
  block({ x: 0, z: fortZ, w: 24, h: 5.6, d: 1.4 });
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 3.5),
    new THREE.MeshStandardMaterial({ map: najdiDoorTexture(), roughness: 0.7 }),
  );
  door.position.set(0, 1.75, fortZ + 0.71);
  root.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3, 4.1, 0.25), wallMat);
  doorFrame.position.set(0, 2.05, fortZ + 0.62);
  doorFrame.castShadow = true;
  root.add(doorFrame);
  // مثلثات زخرفية فوق الباب
  for (let i = -2; i <= 2; i++) triPositions.push(new THREE.Vector3(i * 0.5, 4.45, fortZ + 0.76), 0);

  // أبراج دائرية مستدقة
  for (const tx of [-12.5, 12.5]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 2.0, 8.4, 28), wallMat);
    tower.position.set(tx, 4.2, fortZ);
    tower.castShadow = tower.receiveShadow = true;
    root.add(tower);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.6, 0.25, 28), wallMat);
    cap.position.set(tx, 8.35, fortZ);
    root.add(cap);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      crenPositions.push(new THREE.Vector3(tx + Math.cos(a) * 1.6, 8.45, fortZ + Math.sin(a) * 1.6), -a + Math.PI / 2);
    }
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 2 + (k - 2.5) * 0.32;
      for (const y of [5.6, 6.6]) {
        triPositions.push(new THREE.Vector3(tx + Math.cos(a) * 1.72, y, fortZ + Math.sin(a) * 1.72), -a + Math.PI / 2);
      }
    }
  }
  // بيوت القرية
  block({ x: -18, z: -6, w: 6, h: 4.2, d: 5, ry: 0.5 });
  block({ x: 18.5, z: -5, w: 7, h: 4.8, d: 5, ry: -0.45 });
  block({ x: -21, z: -15, w: 8, h: 6.4, d: 5, ry: 0.25 });
  block({ x: 22, z: -16, w: 6, h: 5.2, d: 5, ry: -0.2 });
  block({ x: -6, z: -19, w: 9, h: 7.4, d: 5 });
  block({ x: 7, z: -20, w: 8, h: 6.6, d: 5 });

  addInstanced(root, crenGeo, wallMat, crenPositions, true);
  addInstanced(root, triGeo, darkMat, triPositions, false);

  // ── النخيل ──
  const frondTex = frondTexture();
  const palmMats = {
    trunk: new THREE.MeshStandardMaterial({ color: '#7d5a3c', roughness: 1, flatShading: true }),
    frond: new THREE.MeshStandardMaterial({
      map: frondTex,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.8,
    }),
    frondDepth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: frondTex, alphaTest: 0.45 }),
    dates: new THREE.MeshStandardMaterial({ color: '#b5581d', roughness: 0.5 }),
  };
  const frondGeo = frondGeometry();
  const rnd = seeded(42);
  const palmSpots = [
    [-7.6, -3.8, 7.2],
    [-9.4, 0.5, 6.0],
    [-8.4, 4.6, 5.0],
    [7.8, -4.6, 7.6],
    [9.6, 1.0, 5.6],
    [-14, -9, 8.6],
    [14.5, -10, 8.2],
    [-26, 4, 9],
    [27, 2, 8.5],
    [-32, -20, 10],
    [33, -24, 9.5],
    [-3, -27, 9],
    [11, -28, 8],
  ];
  const sway = [];
  for (const [x, z, h] of palmSpots) {
    const p = palm(h, rnd, palmMats, frondGeo);
    p.position.set(x, duneHeight(x, z), z);
    p.rotation.y = rnd() * Math.PI * 2;
    root.add(p);
    sway.push({ obj: p.userData.crown, phase: rnd() * 10 });
  }

  // ── موقد القهوة ──
  const fire = campfire();
  fire.group.position.set(5.9, 0, -2.6);
  root.add(fire.group);

  // ── فوانيس ──
  const lanterns = [];
  for (const [x, z] of [
    [-5.2, -3.4],
    [5.2, -3.4],
  ]) {
    const l = lantern();
    l.group.position.set(x, 0, z);
    root.add(l.group);
    lanterns.push(l);
  }

  // ── غبار ذهبي يسبح في الضوء ──
  const motes = dustMotes();
  root.add(motes.points);

  engine.onUpdate((dt, t) => {
    for (const s of sway) {
      s.obj.rotation.z = Math.sin(t * 0.7 + s.phase) * 0.03;
      s.obj.rotation.x = Math.cos(t * 0.5 + s.phase) * 0.02;
    }
    fire.update(t);
    for (const l of lanterns) l.update(t);
    motes.update(dt, t);
  });

  return { root, sun, rug, skyMat, hemi, rim, fill, fire, lanterns };
}

function addInstanced(root, geo, mat, list, castShadow) {
  // list: [Vector3, rotY, Vector3, rotY, ...]
  const count = list.length / 2;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), list[i * 2 + 1]);
    m.compose(list[i * 2], q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  root.add(mesh);
}

/** شرفة نجدية مثلثة متدرجة */
function crenellationGeometry() {
  const s = new THREE.Shape();
  const w = 0.25;
  s.moveTo(-w, 0);
  s.lineTo(w, 0);
  s.lineTo(w, 0.12);
  s.lineTo(w * 0.62, 0.12);
  s.lineTo(w * 0.62, 0.27);
  s.lineTo(w * 0.28, 0.27);
  s.lineTo(0, 0.52);
  s.lineTo(-w * 0.28, 0.27);
  s.lineTo(-w * 0.62, 0.27);
  s.lineTo(-w * 0.62, 0.12);
  s.lineTo(-w, 0.12);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false });
  g.translate(0, 0, -0.11);
  return g;
}

function triangleGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.13, 0);
  s.lineTo(0.13, 0);
  s.lineTo(0, 0.24);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

function frondGeometry() {
  const L = 3.3;
  const g = new THREE.PlaneGeometry(1.25, L, 2, 14);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const v = (p.getY(i) + L / 2) / L; // 0 القاعدة → 1 الطرف
    const along = v * L;
    const y = 0.9 * v - 1.9 * v * v + Math.abs(x) * 0.35;
    p.setXYZ(i, x * (1 - v * 0.2), y, along);
  }
  g.computeVertexNormals();
  return g;
}

function palm(height, rnd, mats, frondGeo) {
  // كل نخلة = 3 أجسام مدمجة فقط (جذع، سعف، تمر) لتخفيف العبء على الأجهزة اللوحية
  const g = new THREE.Group();
  const lean = (rnd() - 0.5) * 1.6;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.2, height * 0.55, 0),
    new THREE.Vector3(lean, height, 0),
  );
  const segs = 13;
  const trunkParts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < segs; i++) {
    const a = curve.getPoint(i / segs);
    const b = curve.getPoint((i + 1) / segs);
    const len = a.distanceTo(b);
    const r = 0.26 - (i / segs) * 0.07;
    const geo = new THREE.CylinderGeometry(r * 0.88, r, len * 1.04, 7);
    q.setFromUnitVectors(up, b.clone().sub(a).normalize());
    m.compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    trunkParts.push(geo);
  }
  const trunk = new THREE.Mesh(mergeGeometries(trunkParts), mats.trunk);
  trunk.castShadow = true;
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.copy(curve.getPoint(1));
  g.add(crown);
  g.userData.crown = crown;

  const n = 13;
  const frondParts = [];
  const e = new THREE.Euler(0, 0, 0, 'YXZ');
  for (let i = 0; i < n; i++) {
    e.set(-0.35 + rnd() * 0.5 + (i % 3 === 0 ? -0.5 : 0), (i / n) * Math.PI * 2 + rnd() * 0.3, 0);
    frondParts.push(frondGeo.clone().applyMatrix4(m.makeRotationFromEuler(e)));
  }
  const fronds = new THREE.Mesh(mergeGeometries(frondParts), mats.frond);
  fronds.customDepthMaterial = mats.frondDepth;
  fronds.castShadow = true;
  crown.add(fronds);

  // عذوق التمر
  const dateParts = [];
  for (let k = 0; k < 3; k++) {
    const a = rnd() * Math.PI * 2;
    const cx = Math.cos(a) * 0.35;
    const cz = Math.sin(a) * 0.35;
    for (let j = 0; j < 10; j++) {
      const d = new THREE.SphereGeometry(0.075, 6, 5);
      d.scale(0.8, 1.2, 0.8);
      d.translate(cx + (rnd() - 0.5) * 0.3, -0.2 - j * 0.05 - rnd() * 0.12, cz + (rnd() - 0.5) * 0.3);
      dateParts.push(d);
    }
  }
  crown.add(new THREE.Mesh(mergeGeometries(dateParts), mats.dates));
  return g;
}

function campfire() {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#6d5a4a', roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMat);
    s.position.set(Math.cos(a) * 0.62, 0.12, Math.sin(a) * 0.62);
    s.rotation.set(i, i * 2, 0);
    s.castShadow = true;
    group.add(s);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: '#4a2e1a', roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.1;
    group.add(log);
  }
  const flames = [];
  const cols = ['#ffcf5a', '#ff8a2a', '#ff5b1f'];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.22 - i * 0.04, 0.8 - i * 0.12, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.85, depthWrite: false }),
    );
    f.position.y = 0.45;
    group.add(f);
    flames.push(f);
  }
  const light = new THREE.PointLight('#ff9a40', 6, 9, 1.6);
  light.position.y = 0.9;
  group.add(light);
  return {
    group,
    light,
    update(t) {
      flames.forEach((f, i) => {
        const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 17 + i) * 0.06;
        f.scale.set(1 / k, k, 1 / k);
        f.rotation.y = t * (1 + i);
      });
      light.intensity = (this.boost || 1) * (5.5 + Math.sin(t * 13) * 0.8 + Math.sin(t * 7.3) * 0.6);
    },
  };
}

function lantern() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#3a2b1e', metalness: 0.6, roughness: 0.4 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 8), metal);
  post.position.y = 0.85;
  post.castShadow = true;
  group.add(post);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.2, 0.42, 6),
    new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffae3d', emissiveIntensity: 2.2, roughness: 0.3 }),
  );
  glass.position.y = 1.92;
  group.add(glass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.28, 6), metal);
  cap.position.y = 2.27;
  group.add(cap);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 6), metal);
  base.position.y = 1.7;
  group.add(base);
  const light = new THREE.PointLight('#ffb050', 2.2, 6, 1.8);
  light.position.y = 1.92;
  group.add(light);
  const seed = Math.random() * 10;
  const level = { v: 2.1 };
  return {
    group,
    base: level,
    update(t) {
      light.intensity = level.v + Math.sin(t * 6 + seed) * 0.15;
    },
  };
}

function dustMotes() {
  const N = 220;
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(N * 3);
  const rnd = seeded(5);
  for (let i = 0; i < N; i++) {
    p[i * 3] = (rnd() - 0.5) * 26;
    p[i * 3 + 1] = rnd() * 6;
    p[i * 3 + 2] = (rnd() - 0.5) * 20 - 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({
    map: softDotTexture(),
    color: '#ffe2a8',
    size: 0.09,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  return {
    points,
    update(dt, t) {
      const a = geo.attributes.position;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) + dt * (0.08 + (i % 5) * 0.02);
        if (y > 6) y = 0;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.1);
      }
      a.needsUpdate = true;
    },
  };
}
