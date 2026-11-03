// نماذج الأشياء التي تفرزها الطالبة، مبنية برمجيًا:
// كرة، مكعب، مخروط، نجمة، تمرة، برتقالة، تفاحة، فنجان، دلة قهوة.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { wovenTexture, labelTexture } from './textures.js';

export const PALETTE = {
  red: '#e2433b',
  yellow: '#f5c431',
  blue: '#3f7fe6',
  green: '#3cae5c',
  orange: '#f28a22',
  purple: '#8f5cd8',
  brown: '#7a4a26',
  white: '#f6f1e7',
};

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0, ...opts });
}

function lathe(points, segments = 32) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

const BUILDERS = {
  ball(color) {
    const m = new THREE.Mesh(cached('ball', () => new THREE.SphereGeometry(0.3, 32, 20)), mat(color, { roughness: 0.32 }));
    m.position.y = 0.3;
    return [m];
  },
  cube(color) {
    const m = new THREE.Mesh(cached('cube', () => new RoundedBoxGeometry(0.52, 0.52, 0.52, 4, 0.07)), mat(color));
    m.position.y = 0.26;
    return [m];
  },
  cone(color) {
    const m = new THREE.Mesh(cached('cone', () => new THREE.ConeGeometry(0.3, 0.62, 32)), mat(color));
    m.position.y = 0.31;
    return [m];
  },
  star(color) {
    const geo = cached('star', () => {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.15 : 0.34;
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
      g.center();
      return g;
    });
    const m = new THREE.Mesh(geo, mat(color, { metalness: 0.3, roughness: 0.3 }));
    m.position.y = 0.36;
    return [m];
  },
  date() {
    const m = new THREE.Mesh(
      cached('date', () => new THREE.SphereGeometry(0.17, 24, 16)),
      mat('#5b2a12', { roughness: 0.35 }),
    );
    m.scale.set(1, 1, 1.75);
    m.rotation.y = 0.4;
    m.position.y = 0.17;
    const cap = new THREE.Mesh(cached('dateCap', () => new THREE.CylinderGeometry(0.05, 0.06, 0.04, 8)), mat('#c9a05a'));
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0.12, 0.2, 0.27);
    return [m, cap];
  },
  orange(color = PALETTE.orange) {
    const m = new THREE.Mesh(cached('ball', () => new THREE.SphereGeometry(0.3, 32, 20)), mat(color, { roughness: 0.6 }));
    m.scale.set(1, 0.92, 1);
    m.position.y = 0.28;
    const leaf = new THREE.Mesh(cached('leaf', () => new THREE.SphereGeometry(0.09, 10, 6)), mat('#2f8a3a'));
    leaf.scale.set(1.4, 0.25, 0.6);
    leaf.position.set(0.07, 0.56, 0);
    leaf.rotation.z = -0.4;
    return [m, leaf];
  },
  apple(color = '#d8352f') {
    const body = new THREE.Mesh(
      cached('apple', () =>
        lathe([
          [0, 0.02],
          [0.16, 0.0],
          [0.28, 0.1],
          [0.31, 0.28],
          [0.26, 0.46],
          [0.14, 0.52],
          [0.04, 0.47],
          [0, 0.45],
        ]),
      ),
      mat(color, { roughness: 0.35 }),
    );
    const stem = new THREE.Mesh(cached('stem', () => new THREE.CylinderGeometry(0.018, 0.025, 0.16, 6)), mat('#5a3a1e'));
    stem.position.y = 0.53;
    stem.rotation.z = 0.25;
    const leaf = new THREE.Mesh(cached('leaf', () => new THREE.SphereGeometry(0.09, 10, 6)), mat('#3f9a3a'));
    leaf.scale.set(1.3, 0.25, 0.6);
    leaf.position.set(0.1, 0.56, 0);
    return [body, stem, leaf];
  },
  cup() {
    // فنجان قهوة عربية بحافة ذهبية
    const body = new THREE.Mesh(
      cached('cup', () => {
        const g = lathe([
          [0, 0],
          [0.12, 0],
          [0.15, 0.03],
          [0.17, 0.2],
          [0.2, 0.3],
          [0.185, 0.3],
          [0.155, 0.2],
          [0.13, 0.05],
          [0, 0.05],
        ]);
        return g;
      }),
      mat('#f7f2ea', { roughness: 0.2, side: THREE.DoubleSide }),
    );
    body.scale.setScalar(1.25);
    const rim = new THREE.Mesh(cached('cupRim', () => new THREE.TorusGeometry(0.195, 0.012, 8, 32)), mat('#d6a536', { metalness: 0.8, roughness: 0.25 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.375;
    const band = new THREE.Mesh(cached('cupBand', () => new THREE.TorusGeometry(0.2, 0.01, 6, 32)), mat('#1f6b45'));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.3;
    return [body, rim, band];
  },
  dallah() {
    // دلة القهوة السعودية
    const brass = mat('#d4a43a', { metalness: 0.85, roughness: 0.28 });
    const body = new THREE.Mesh(
      cached('dallahBody', () =>
        lathe([
          [0, 0],
          [0.2, 0],
          [0.23, 0.04],
          [0.22, 0.12],
          [0.15, 0.24],
          [0.1, 0.34],
          [0.1, 0.42],
          [0.15, 0.46],
          [0.12, 0.5],
          [0.13, 0.56],
          [0.06, 0.66],
          [0.03, 0.7],
          [0, 0.72],
        ]),
      ),
      brass,
    );
    const finial = new THREE.Mesh(cached('dallahTop', () => new THREE.SphereGeometry(0.04, 10, 8)), brass);
    finial.position.y = 0.75;
    const spout = new THREE.Mesh(
      cached('dallahSpout', () => {
        const c = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.12, 0.2, 0),
          new THREE.Vector3(0.24, 0.32, 0),
          new THREE.Vector3(0.3, 0.5, 0),
          new THREE.Vector3(0.4, 0.6, 0),
        ]);
        return new THREE.TubeGeometry(c, 16, 0.03, 8, false);
      }),
      brass,
    );
    const handle = new THREE.Mesh(
      cached('dallahHandle', () => new THREE.TorusGeometry(0.15, 0.022, 8, 20, Math.PI * 1.1)),
      brass,
    );
    handle.position.set(-0.15, 0.33, 0);
    handle.rotation.z = Math.PI / 2 + 0.2;
    const g = new THREE.Group();
    g.add(body, finial, spout, handle);
    g.scale.setScalar(0.95);
    return [g];
  },
};

/** يبني نموذج عنصر من وصفه في ملف المحتوى */
export function createItem(spec) {
  const color = spec.color ? PALETTE[spec.color] || spec.color : undefined;
  const builder = BUILDERS[spec.model] || BUILDERS.ball;
  const parts = builder(color);
  const group = new THREE.Group();
  const holder = new THREE.Group(); // للاهتزاز والقفز دون تغيير موضع العنصر
  group.add(holder);
  for (const p of parts) {
    p.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    holder.add(p);
  }
  const scale = spec.size === 'small' ? 0.7 : spec.size === 'big' ? 1.25 : 1;
  holder.scale.setScalar(scale);
  group.userData = { itemId: spec.id, spec, holder };
  group.traverse((o) => {
    o.userData.itemId = spec.id;
  });
  return group;
}

export function setGlow(group, amount, color = '#ffd36b') {
  group.traverse((o) => {
    if (o.isMesh && o.material?.emissive) {
      if (!o.userData.ownMat) {
        o.material = o.material.clone();
        o.userData.ownMat = true;
      }
      o.material.emissive.set(color);
      o.material.emissiveIntensity = amount;
    }
  });
}

export function setDim(group, dim) {
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      if (!o.userData.ownMat) {
        o.material = o.material.clone();
        o.userData.ownMat = true;
      }
      o.material.transparent = dim;
      o.material.opacity = dim ? 0.35 : 1;
    }
  });
}

/** سلة خوص بشريط ملوّن ولافتة عربية */
export function createBasket(bin) {
  const bandColor = bin.color ? PALETTE[bin.color] || bin.color : '#a3262a';
  const group = new THREE.Group();
  const tex = wovenTexture(bandColor);
  const wall = new THREE.Mesh(
    lathe(
      [
        [0.55, 0.02],
        [0.68, 0.18],
        [0.8, 0.5],
        [0.86, 0.72],
      ],
      40,
    ),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }),
  );
  wall.castShadow = wall.receiveShadow = true;
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 32),
    new THREE.MeshStandardMaterial({ color: '#9a6f3b', roughness: 1 }),
  );
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.03;
  bottom.receiveShadow = true;
  const rimMat = new THREE.MeshStandardMaterial({ color: '#8a5d2c', roughness: 0.8, emissive: '#000000' });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.05, 10, 48), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.72;
  rim.castShadow = true;
  group.add(wall, bottom, rim);

  // لافتة
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: labelTexture(bin.label, { color: bandColor }), depthTest: false, transparent: true }),
  );
  label.scale.set(1.9, 0.6, 1);
  label.position.set(0, 1.5, 0);
  label.renderOrder = 10;
  group.add(label);

  // أيقونة صغيرة (اختيارية) على عمود أمام السلة
  if (bin.icon) {
    const icon = createItem({ ...bin.icon, id: `icon-${bin.id}` });
    icon.scale.setScalar(0.6);
    icon.position.set(0, 0.9, 0.62);
    icon.userData.isIcon = true;
    icon.traverse((o) => (o.userData.itemId = undefined));
    group.add(icon);
    group.userData.icon = icon;
  }

  group.traverse((o) => (o.userData.binId = bin.id));
  group.userData = { ...group.userData, binId: bin.id, rimMat, filled: 0 };
  return group;
}

/** حلقة أرضية تحدد «مجموعة» في أسئلة الاختيار */
export function createGroupRing(radius = 1.4, color = '#f6e7c8') {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.07, radius, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  return ring;
}
