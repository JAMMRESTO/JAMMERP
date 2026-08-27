// Run once: node generate.mjs
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function draw(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const r = size * 0.12;

  // Background
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Letter M
  ctx.fillStyle = '#10b981';
  ctx.font = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MC', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

writeFileSync('icon-192.png', draw(192));
writeFileSync('icon-512.png', draw(512));
console.log('Icons generated');
