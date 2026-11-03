// خامات مرسومة برمجيًا (بلا ملفات صور خارجية):
// سجادة السدو، سلال الخوص، جدار الطين النجدي، الباب النجدي الملوّن، سعف النخيل.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { repeat = [1, 1], srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  return tex;
}

// مولد عشوائي ثابت حتى تبدو المشاهد نفسها في كل مرة
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** سجادة السدو: أشرطة حمراء وسوداء وبيضاء بزخارف مثلثات ومعينات */
export function saduTexture() {
  const W = 1024;
  const H = 640;
  const [c, g] = canvas(W, H);
  const RED = '#9a1d22';
  const DARK = '#1d1414';
  const WHITE = '#f1e6d2';
  const ORANGE = '#e08a2c';
  const GREEN = '#1f6b45';

  g.fillStyle = RED;
  g.fillRect(0, 0, W, H);

  // إطار
  g.fillStyle = DARK;
  g.fillRect(0, 0, W, 34);
  g.fillRect(0, H - 34, W, 34);
  g.fillRect(0, 0, 34, H);
  g.fillRect(W - 34, 0, 34, H);
  g.fillStyle = WHITE;
  g.fillRect(34, 34, W - 68, 6);
  g.fillRect(34, H - 40, W - 68, 6);

  // صف أسنان (مثلثات) أعلى وأسفل
  const teeth = (y, flip) => {
    for (let x = 40; x < W - 40; x += 24) {
      g.fillStyle = (x / 24) % 2 < 1 ? DARK : WHITE;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 24, y);
      g.lineTo(x + 12, y + (flip ? -18 : 18));
      g.closePath();
      g.fill();
    }
  };
  teeth(40, false);
  teeth(H - 40, true);

  // شريط مركزي: سلسلة معينات (العويرجان)
  const band = (y, h, base, motif) => {
    g.fillStyle = base;
    g.fillRect(40, y, W - 80, h);
    const step = h * 1.1;
    for (let x = 40 + step / 2; x < W - 40; x += step) {
      g.fillStyle = motif;
      g.beginPath();
      g.moveTo(x, y + 6);
      g.lineTo(x + step / 2 - 6, y + h / 2);
      g.lineTo(x, y + h - 6);
      g.lineTo(x - step / 2 + 6, y + h / 2);
      g.closePath();
      g.fill();
      g.fillStyle = base;
      g.beginPath();
      g.moveTo(x, y + h / 2 - h * 0.18);
      g.lineTo(x + h * 0.18, y + h / 2);
      g.lineTo(x, y + h / 2 + h * 0.18);
      g.lineTo(x - h * 0.18, y + h / 2);
      g.closePath();
      g.fill();
    }
  };
  const stripes = (y, colors) => {
    colors.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(40, y + i * 7, W - 80, 7);
    });
  };

  stripes(78, [WHITE, DARK, ORANGE, DARK]);
  band(112, 70, DARK, WHITE);
  stripes(186, [GREEN, WHITE, GREEN]);
  // مساحة حمراء هادئة في الوسط حيث تُوضع الأشياء
  stripes(H - 214, [GREEN, WHITE, GREEN]);
  band(H - 186, 70, DARK, WHITE);
  stripes(H - 110, [DARK, ORANGE, DARK, WHITE]);

  // زخرفة خفيفة في الوسط
  g.globalAlpha = 0.18;
  for (let x = 120; x < W - 120; x += 90) {
    g.fillStyle = WHITE;
    g.beginPath();
    g.moveTo(x, H / 2 - 16);
    g.lineTo(x + 16, H / 2);
    g.lineTo(x, H / 2 + 16);
    g.lineTo(x - 16, H / 2);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;

  // ملمس النسيج
  const rnd = seeded(7);
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    g.fillStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
    g.fillRect(x, y, 1, 3 + rnd() * 4);
  }
  return finish(c);
}

/** خوص منسوج مع شريط ملوّن */
export function wovenTexture(bandColor = '#a3262a') {
  const W = 512;
  const H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#b98a4e';
  g.fillRect(0, 0, W, H);
  const cw = 32;
  const ch = 16;
  for (let row = 0; row < H / ch; row++) {
    const inBand = row >= 6 && row <= 9;
    for (let col = 0; col < W / cw + 1; col++) {
      const x = col * cw + (row % 2 ? cw / 2 : 0) - cw / 2;
      const y = row * ch;
      const light = (row + col) % 2 === 0;
      g.fillStyle = inBand ? (light ? bandColor : shade(bandColor, -0.25)) : light ? '#d8b276' : '#c29a5e';
      roundRect(g, x + 1, y + 1, cw - 2, ch - 2, 6);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x + 4, y + 3, cw - 8, 2);
    }
  }
  return finish(c, { repeat: [3, 1] });
}

/** جدار طين نجدي */
export function plasterTexture() {
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#c99567';
  g.fillRect(0, 0, S, S);
  const rnd = seeded(3);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 10 + rnd() * 50;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? '178,120,80' : '220,176,130';
    grad.addColorStop(0, `rgba(${tone},0.22)`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // قش وتشققات دقيقة
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = rnd() > 0.5 ? 'rgba(90,55,30,0.18)' : 'rgba(240,210,160,0.2)';
    g.lineWidth = 1;
    const x = rnd() * S;
    const y = rnd() * S;
    const a = rnd() * Math.PI;
    const l = 2 + rnd() * 6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return finish(c, { repeat: [3, 1] });
}

/** باب نجدي خشبي بزخارف مثلثات ملونة */
export function najdiDoorTexture() {
  const W = 256;
  const H = 512;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#6b3f20';
  g.fillRect(0, 0, W, H);
  const colors = ['#c8352b', '#2e5ea8', '#e9b739', '#f3ead8', '#1f6b45'];
  for (let y = 24; y < H - 24; y += 64) {
    g.fillStyle = '#4a2a14';
    g.fillRect(16, y, W - 32, 56);
    for (let x = 22; x < W - 22; x += 26) {
      const col = colors[(x / 26 + y / 64) % colors.length | 0];
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x, y + 50);
      g.lineTo(x + 12, y + 6);
      g.lineTo(x + 24, y + 50);
      g.closePath();
      g.fill();
    }
  }
  g.strokeStyle = '#2a170a';
  g.lineWidth = 8;
  g.strokeRect(4, 4, W - 8, H - 8);
  g.beginPath();
  g.moveTo(W / 2, 0);
  g.lineTo(W / 2, H);
  g.stroke();
  return finish(c);
}

/** سعفة نخيل (شفافة الخلفية) */
export function frondTexture() {
  const W = 256;
  const H = 1024;
  const [c, g] = canvas(W, H);
  const rnd = seeded(11);
  g.strokeStyle = '#5d7a2c';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(W / 2, H);
  g.lineTo(W / 2, 0);
  g.stroke();
  for (let y = H - 40; y > 10; y -= 14) {
    const t = 1 - y / H; // 0 عند القاعدة
    const len = (W / 2 - 6) * Math.sin(Math.PI * (0.15 + t * 0.85)) * (1 - t * 0.35);
    for (const side of [-1, 1]) {
      const hue = 95 + rnd() * 20;
      const light = 26 + rnd() * 12 + t * 8;
      g.strokeStyle = `hsl(${hue},45%,${light}%)`;
      g.lineWidth = 7 - t * 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(W / 2, y);
      g.quadraticCurveTo(W / 2 + side * len * 0.5, y - 22, W / 2 + side * len, y - 40 - rnd() * 10);
      g.stroke();
    }
  }
  const tex = finish(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** نقطة ناعمة للجسيمات */
export function softDotTexture() {
  const S = 64;
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** لافتة نص عربي (Sprite) */
export function labelTexture(text, { color = '#7a2b1c', bg = '#fff7e8', font = '"Baloo Bhaijaan 2", "Tahoma", sans-serif' } = {}) {
  const [c, g] = canvas(512, 160);
  g.font = `800 76px ${font}`;
  g.direction = 'rtl';
  const tw = Math.min(g.measureText(text).width + 90, 500);
  const x = (512 - tw) / 2;
  g.fillStyle = 'rgba(40,20,10,0.35)';
  roundRect(g, x + 4, 22, tw, 120, 60);
  g.fill();
  g.fillStyle = bg;
  roundRect(g, x, 14, tw, 120, 60);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = color;
  roundRect(g, x + 5, 19, tw - 10, 110, 55);
  g.stroke();
  g.fillStyle = '#3a2416';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 78);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function shade(hex, amt) {
  const col = new THREE.Color(hex);
  const hsl = {};
  col.getHSL(hsl);
  col.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + col.getHexString();
}
