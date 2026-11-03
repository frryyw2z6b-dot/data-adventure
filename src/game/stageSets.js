// أجواء كل مرحلة: مكان مختلف في القرية النجدية وإضاءة مختلفة من النهار إلى الليل
//   ١ واحة النخيل (عصر ذهبي) · ٢ سوق القرية (ضحى) · ٣ قلعة الحصن (عصر) · ٤ برج المراقبة (غروب) · ٥ خيمة الحكماء (ليل)
import * as THREE from 'three';
import { ease } from './tween.js';
import { plasterTexture, softDotTexture, seeded } from './textures.js';
import { createItem } from './models.js';

const MOODS = {
  0: { top: '#33407a', mid: '#d98f63', horizon: '#ffd09a', sun: '#ffd3a3', sunI: 3.1, dir: [-30, 17, 14], hemi: 1.05, fog: '#f0b98a', exposure: 1.05, night: 0 },
  1: { top: '#33407a', mid: '#d98f63', horizon: '#ffd09a', sun: '#ffd3a3', sunI: 3.1, dir: [-30, 17, 14], hemi: 1.05, fog: '#f0b98a', exposure: 1.05, night: 0 },
  2: { top: '#3f73c4', mid: '#9cc2e8', horizon: '#f6e2c0', sun: '#fff2dc', sunI: 3.4, dir: [-18, 30, 16], hemi: 1.2, fog: '#e9d8bd', exposure: 1.0, night: 0 },
  3: { top: '#3a4a8a', mid: '#e39b62', horizon: '#ffc98a', sun: '#ffc98f', sunI: 3.2, dir: [26, 16, 12], hemi: 1.05, fog: '#efb07e', exposure: 1.05, night: 0 },
  4: { top: '#2e2f6e', mid: '#d97a74', horizon: '#ffad78', sun: '#ff9a6a', sunI: 2.5, dir: [-34, 8, 6], hemi: 0.85, fog: '#d98a7a', exposure: 1.1, night: 0.15 },
  5: { top: '#0d1230', mid: '#2c2a58', horizon: '#7a5a78', sun: '#a9b8ff', sunI: 0.9, dir: [12, 30, 10], hemi: 0.5, fog: '#2a2846', exposure: 1.25, night: 1 },
};

export function createStageSets(engine, world) {
  const { scene } = engine;
  const sets = {};

  // ── ٢: سوق القرية — مظلات مخططة وصناديق فاكهة ──
  {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#7a4f2a', roughness: 0.9 });
    const clothTex = (() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 64;
      const x = c.getContext('2d');
      const cols = ['#a3262a', '#f1e6d2', '#1d1414', '#f1e6d2'];
      for (let i = 0; i < 16; i++) {
        x.fillStyle = cols[i % 4];
        x.fillRect(i * 16, 0, 16, 64);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const cloth = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.9, side: THREE.DoubleSide });
    for (const [x, z, ry] of [
      [-8.2, -3.5, 0.5],
      [8.4, -3.2, -0.5],
      [-6.2, -7.5, 0.2],
    ]) {
      const stall = new THREE.Group();
      for (const [px, pz] of [
        [-1.3, -0.8],
        [1.3, -0.8],
        [-1.3, 0.8],
        [1.3, 0.8],
      ]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 8), wood);
        post.position.set(px, 1.2, pz);
        post.castShadow = true;
        stall.add(post);
      }
      const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0), cloth);
      awning.rotation.x = -Math.PI / 2 + 0.25;
      awning.position.set(0, 2.45, 0);
      awning.castShadow = true;
      stall.add(awning);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 1.2), wood);
      counter.position.set(0, 0.4, 0.2);
      counter.castShadow = true;
      stall.add(counter);
      const rnd = seeded(x * 10 + 7);
      ['orange', 'date', 'apple'].forEach((model, k) => {
        for (let j = 0; j < 4; j++) {
          const it = createItem({ id: `m${k}${j}`, model });
          it.scale.setScalar(0.6);
          it.position.set(-0.9 + k * 0.9 + (rnd() - 0.5) * 0.4, 0.8, 0.2 + (rnd() - 0.5) * 0.6);
          stall.add(it);
        }
      });
      stall.position.set(x, 0, z);
      stall.rotation.y = ry;
      g.add(stall);
    }
    sets[2] = g;
  }

  // ── ٣: قلعة الحصن — رايات خضراء ومشاعل ──
  const torches = [];
  {
    const g = new THREE.Group();
    const pole = new THREE.MeshStandardMaterial({ color: '#4a2c17', roughness: 0.8 });
    const bannerTex = (() => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#1d7a4c';
      x.fillRect(0, 0, 128, 256);
      x.fillStyle = '#e0b04a';
      for (let y = 20; y < 240; y += 44) {
        x.beginPath();
        x.moveTo(64, y);
        x.lineTo(96, y + 20);
        x.lineTo(64, y + 40);
        x.lineTo(32, y + 20);
        x.closePath();
        x.fill();
      }
      x.fillRect(0, 0, 128, 10);
      x.beginPath();
      x.moveTo(0, 256);
      x.lineTo(64, 220);
      x.lineTo(128, 256);
      x.closePath();
      x.fillStyle = '#e9b88a';
      x.fill();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    for (const x of [-6.8, 6.8]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 5, 8), pole);
      p.position.set(x, 2.5, -5);
      g.add(p);
      const b = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 2.2, 1, 8),
        new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }),
      );
      b.position.set(x, 3.6, -4.9);
      b.castShadow = true;
      b.userData.wave = Math.random() * 5;
      g.add(b);
      torches.push(b);
    }
    for (const x of [-4.6, 4.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 8), pole);
      p.position.set(x, 0.9, -2.9);
      g.add(p);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.4, 8),
        new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9 }),
      );
      flame.position.set(x, 1.98, -2.9);
      g.add(flame);
      const light = new THREE.PointLight('#ff9a40', 2.4, 6, 1.8);
      light.position.set(x, 2.1, -2.9);
      g.add(light);
      torches.push(flame);
    }
    sets[3] = g;
  }

  // ── ٤: برج المراقبة ──
  {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.95 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.1, 13, 24), mat);
    tower.position.set(-9.5, 6.5, -7);
    tower.castShadow = true;
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.45, 0.4, 24), mat);
    cap.position.set(-9.5, 13.1, -7);
    g.add(cap);
    const slit = new THREE.MeshStandardMaterial({ color: '#2a1810' });
    for (let k = 0; k < 4; k++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.1), slit);
      w.position.set(-9.5 + 0.2, 4 + k * 2.4, -7 + 1.85 - k * 0.15);
      g.add(w);
    }
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 4), mat);
      c.position.set(-9.5 + Math.cos(a) * 1.55, 13.55, -7 + Math.sin(a) * 1.55);
      g.add(c);
    }
    sets[4] = g;
  }

  // ── ٥: خيمة الحكماء (بيت الشعر) ونجوم الليل ──
  {
    const g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#231a16';
    x.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 512; i += 4) {
      x.fillStyle = i % 8 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.15)';
      x.fillRect(i, 0, 2, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    const tent = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 12, 3, 1, true, Math.PI * 0.68, Math.PI * 0.64), tent);
    roof.rotation.z = Math.PI / 2;
    roof.scale.set(1, 1, 0.55);
    roof.position.set(0, 2.2, -6.2);
    roof.castShadow = true;
    g.add(roof);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.4), tent);
    back.position.set(0, 1.7, -7.4);
    g.add(back);
    // ستارة سدو أمامية
    const sadu = (() => {
      const k = document.createElement('canvas');
      k.width = 512;
      k.height = 64;
      const y = k.getContext('2d');
      y.fillStyle = '#9a1d22';
      y.fillRect(0, 0, 512, 64);
      y.fillStyle = '#f1e6d2';
      for (let i = 0; i < 512; i += 32) {
        y.beginPath();
        y.moveTo(i, 32);
        y.lineTo(i + 16, 12);
        y.lineTo(i + 32, 32);
        y.lineTo(i + 16, 52);
        y.closePath();
        y.fill();
      }
      const t = new THREE.CanvasTexture(k);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(3, 1);
      return t;
    })();
    const band = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.5), new THREE.MeshStandardMaterial({ map: sadu, side: THREE.DoubleSide }));
    band.position.set(0, 3.1, -5.0);
    g.add(band);
    for (const px of [-5.5, -2, 2, 5.5]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.3, 8), new THREE.MeshStandardMaterial({ color: '#5a3a1e' }));
      p.position.set(px, 1.65, -5.0);
      g.add(p);
    }
    sets[5] = g;
  }

  // نجوم
  const starGeo = new THREE.BufferGeometry();
  const N = 700;
  const sp = new Float32Array(N * 3);
  const rnd = seeded(99);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2;
    const e = 0.08 + rnd() * 1.3;
    sp.set([Math.cos(a) * Math.cos(e) * 600, Math.sin(e) * 600, Math.sin(a) * Math.cos(e) * 600], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ map: softDotTexture(), size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }),
  );
  scene.add(stars);

  for (const g of Object.values(sets)) {
    g.visible = false;
    scene.add(g);
  }

  engine.onUpdate((dt, t) => {
    for (const b of torches) {
      if (b.isMesh && b.geometry.type === 'PlaneGeometry') {
        const pos = b.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(t * 3 + pos.getY(i) * 2 + b.userData.wave) * 0.08 * (0.5 - pos.getY(i) / 2.2));
        pos.needsUpdate = true;
      } else {
        b.scale.y = 1 + Math.sin(t * 15 + b.position.x) * 0.15;
      }
    }
  });

  const cur = { ...MOODS[0] };
  const c = (v) => new THREE.Color(v);
  function apply(from, to, k) {
    const u = world.skyMat.uniforms;
    u.top.value.copy(c(from.top).lerp(c(to.top), k));
    u.mid.value.copy(c(from.mid).lerp(c(to.mid), k));
    u.horizon.value.copy(c(from.horizon).lerp(c(to.horizon), k));
    world.sun.color.copy(c(from.sun).lerp(c(to.sun), k));
    world.sun.intensity = THREE.MathUtils.lerp(from.sunI, to.sunI, k);
    const d = new THREE.Vector3(...from.dir).lerp(new THREE.Vector3(...to.dir), k).normalize();
    u.sunDir.value.copy(d);
    world.sun.position.copy(d).multiplyScalar(40);
    world.hemi.intensity = THREE.MathUtils.lerp(from.hemi, to.hemi, k);
    scene.fog.color.copy(c(from.fog).lerp(c(to.fog), k));
    engine.renderer.toneMappingExposure = THREE.MathUtils.lerp(from.exposure, to.exposure, k);
    const night = THREE.MathUtils.lerp(from.night, to.night, k);
    stars.material.opacity = night;
    world.fire.boost = 1 + night * 0.8;
    for (const l of world.lanterns) l.base.v = 2.1 + night * 2.5;
  }

  return {
    /** ينقل الأجواء والمكان إلى المرحلة (0 = البداية) */
    async setStage(id, duration = 1.6) {
      for (const [k, g] of Object.entries(sets)) g.visible = Number(k) === id;
      const from = { ...cur };
      const to = MOODS[id] || MOODS[0];
      await engine.tweens.run(duration, (k) => apply(from, to, k), ease.inOutSine);
      Object.assign(cur, to);
    },
  };
}
