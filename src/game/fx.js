// مؤثرات بصرية: شرارات ذهبية عند الإجابة الصحيحة، وقصاصات احتفال عند إنهاء المرحلة
import * as THREE from 'three';
import { softDotTexture } from './textures.js';

export function createFx(engine) {
  const { scene } = engine;
  const dot = softDotTexture();
  const bursts = [];

  function burst(position, { count = 40, color = '#ffd36b', speed = 2.6, life = 0.9, size = 0.16 } = {}) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const v = [];
    for (let i = 0; i < count; i++) {
      p.set([position.x, position.y, position.z], i * 3);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.3, Math.random() - 0.5).normalize();
      v.push(dir.multiplyScalar(speed * (0.5 + Math.random())));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({
      map: dot,
      color,
      size,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    bursts.push({ pts, v, t: 0, life });
  }

  // قصاصات احتفال
  const CONF = 220;
  const confGeo = new THREE.PlaneGeometry(0.12, 0.2);
  const confMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6 });
  const confetti = new THREE.InstancedMesh(confGeo, confMat, CONF);
  confetti.visible = false;
  confetti.frustumCulled = false;
  scene.add(confetti);
  const confState = [];
  const colors = ['#e2433b', '#f5c431', '#3f7fe6', '#3cae5c', '#ffffff', '#1f6b45', '#d4a43a'];
  for (let i = 0; i < CONF; i++) confetti.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  let confT = -1;

  function celebrate(center = new THREE.Vector3(0, 0, 0)) {
    confState.length = 0;
    for (let i = 0; i < CONF; i++) {
      confState.push({
        p: new THREE.Vector3(center.x + (Math.random() - 0.5) * 10, 6 + Math.random() * 5, center.z + (Math.random() - 0.5) * 7),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.2 - Math.random() * 1.2, (Math.random() - 0.5) * 0.6),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      });
    }
    confetti.visible = true;
    confT = 0;
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  engine.onUpdate((dt) => {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.t += dt;
      const a = b.pts.geometry.attributes.position;
      for (let k = 0; k < b.v.length; k++) {
        b.v[k].y -= 4.5 * dt;
        a.setXYZ(k, a.getX(k) + b.v[k].x * dt, a.getY(k) + b.v[k].y * dt, a.getZ(k) + b.v[k].z * dt);
      }
      a.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.t / b.life);
      if (b.t >= b.life) {
        scene.remove(b.pts);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        bursts.splice(i, 1);
      }
    }
    if (confT >= 0) {
      confT += dt;
      confState.forEach((s, i) => {
        s.p.addScaledVector(s.v, dt);
        s.p.x += Math.sin(confT * 2 + i) * dt * 0.4;
        s.r.x += s.w.x * dt;
        s.r.y += s.w.y * dt;
        q.setFromEuler(s.r);
        m.compose(s.p, q, one);
        confetti.setMatrixAt(i, m);
      });
      confetti.instanceMatrix.needsUpdate = true;
      if (confT > 4.5) {
        confT = -1;
        confetti.visible = false;
      }
    }
  });

  function stopCelebrate() {
    confT = -1;
    confetti.visible = false;
  }

  return { burst, celebrate, stopCelebrate };
}
