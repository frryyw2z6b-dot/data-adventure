// أيقونات ثنائية الأبعاد للأشياء نفسها (للوحة والجداول وأزرار الإجابة)
import { PALETTE } from './models.js';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function ball(g, s, col) {
  const grad = g.createRadialGradient(-s * 0.15, -s * 0.18, s * 0.05, 0, 0, s * 0.42);
  grad.addColorStop(0, shade(col, 1.35));
  grad.addColorStop(1, shade(col, 0.8));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, s * 0.4, 0, Math.PI * 2);
  g.fill();
}

const DRAW = {
  ball(g, s, c) {
    ball(g, s, c || PALETTE.blue);
  },
  cube(g, s, c = PALETTE.red) {
    const a = s * 0.3;
    g.fillStyle = shade(c, 1.2);
    g.beginPath();
    g.moveTo(-a, -a * 0.6);
    g.lineTo(0, -a * 1.1);
    g.lineTo(a, -a * 0.6);
    g.lineTo(0, -a * 0.1);
    g.closePath();
    g.fill();
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-a, -a * 0.6);
    g.lineTo(0, -a * 0.1);
    g.lineTo(0, a * 1.1);
    g.lineTo(-a, a * 0.6);
    g.closePath();
    g.fill();
    g.fillStyle = shade(c, 0.75);
    g.beginPath();
    g.moveTo(a, -a * 0.6);
    g.lineTo(0, -a * 0.1);
    g.lineTo(0, a * 1.1);
    g.lineTo(a, a * 0.6);
    g.closePath();
    g.fill();
  },
  cone(g, s, c = PALETTE.green) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(0, -s * 0.4);
    g.lineTo(s * 0.32, s * 0.32);
    g.lineTo(-s * 0.32, s * 0.32);
    g.closePath();
    g.fill();
    g.fillStyle = shade(c, 0.75);
    g.beginPath();
    g.ellipse(0, s * 0.32, s * 0.32, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
  },
  star(g, s, c = PALETTE.yellow) {
    g.fillStyle = c;
    g.strokeStyle = shade(c, 0.7);
    g.lineWidth = s * 0.03;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.18 : s * 0.42;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
  },
  date(g, s) {
    const grad = g.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
    grad.addColorStop(0, '#8a4a22');
    grad.addColorStop(1, '#4a200c');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, 0, s * 0.2, s * 0.38, 0.25, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d6b06a';
    g.beginPath();
    g.ellipse(s * 0.08, -s * 0.34, s * 0.07, s * 0.04, 0.25, 0, Math.PI * 2);
    g.fill();
  },
  orange(g, s) {
    ball(g, s, PALETTE.orange);
    g.fillStyle = '#2f8a3a';
    g.beginPath();
    g.ellipse(s * 0.08, -s * 0.4, s * 0.12, s * 0.05, -0.4, 0, Math.PI * 2);
    g.fill();
  },
  apple(g, s) {
    ball(g, s, '#d8352f');
    g.strokeStyle = '#5a3a1e';
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.moveTo(0, -s * 0.34);
    g.lineTo(s * 0.05, -s * 0.48);
    g.stroke();
    g.fillStyle = '#3f9a3a';
    g.beginPath();
    g.ellipse(s * 0.15, -s * 0.42, s * 0.12, s * 0.05, -0.3, 0, Math.PI * 2);
    g.fill();
  },
  cup(g, s) {
    g.fillStyle = '#f7f2ea';
    g.strokeStyle = '#c7b9a3';
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.moveTo(-s * 0.3, -s * 0.22);
    g.lineTo(s * 0.3, -s * 0.22);
    g.lineTo(s * 0.2, s * 0.3);
    g.lineTo(-s * 0.2, s * 0.3);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#d6a536';
    g.fillRect(-s * 0.31, -s * 0.26, s * 0.62, s * 0.06);
    g.fillStyle = '#1f6b45';
    g.fillRect(-s * 0.26, -s * 0.06, s * 0.52, s * 0.05);
  },
  dallah(g, s) {
    const c = '#d4a43a';
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(-s * 0.24, s * 0.38);
    g.quadraticCurveTo(-s * 0.3, s * 0.05, -s * 0.1, -s * 0.05);
    g.lineTo(-s * 0.08, -s * 0.22);
    g.lineTo(-s * 0.04, -s * 0.36);
    g.lineTo(s * 0.04, -s * 0.36);
    g.lineTo(s * 0.08, -s * 0.22);
    g.lineTo(s * 0.1, -s * 0.05);
    g.quadraticCurveTo(s * 0.3, s * 0.05, s * 0.24, s * 0.38);
    g.closePath();
    g.fill();
    g.strokeStyle = c;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.moveTo(s * 0.18, s * 0.12);
    g.quadraticCurveTo(s * 0.32, -s * 0.05, s * 0.42, -s * 0.22);
    g.stroke();
    g.beginPath();
    g.arc(-s * 0.24, s * 0.05, s * 0.12, Math.PI * 0.5, Math.PI * 1.5);
    g.stroke();
    g.fillStyle = shade(c, 0.7);
    g.beginPath();
    g.arc(0, -s * 0.4, s * 0.05, 0, Math.PI * 2);
    g.fill();
  },
};

/** يرسم أيقونة شيء في مركز (x,y) بحجم s */
export function drawIcon(g, icon, x, y, s) {
  if (!icon) return;
  const color = icon.color ? PALETTE[icon.color] || icon.color : undefined;
  g.save();
  g.translate(x, y);
  (DRAW[icon.model] || DRAW.ball)(g, s, color);
  g.restore();
}

const urlCache = new Map();
/** صورة صغيرة (data URL) لاستخدامها في HTML */
export function iconUrl(icon, size = 96) {
  const key = JSON.stringify(icon) + size;
  if (urlCache.has(key)) return urlCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawIcon(c.getContext('2d'), icon, size / 2, size / 2, size);
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}
