// generate-icons.js — Run with: node generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#1a1f3d');
  grad.addColorStop(1, '#0d1220');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Glow circle
  const glow = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size*0.4);
  glow.addColorStop(0, 'rgba(79,142,247,0.3)');
  glow.addColorStop(1, 'rgba(79,142,247,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Plate circle
  ctx.beginPath();
  ctx.arc(size/2, size*0.48, size*0.3, 0, Math.PI * 2);
  ctx.strokeStyle = '#4f8ef7';
  ctx.lineWidth = size * 0.04;
  ctx.stroke();

  // Fork
  const forkX = size * 0.35;
  ctx.strokeStyle = '#4f8ef7';
  ctx.lineWidth = size * 0.035;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(forkX, size * 0.22);
  ctx.lineTo(forkX, size * 0.72);
  ctx.stroke();
  // Fork tines
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(forkX + i * size * 0.04, size * 0.22);
    ctx.lineTo(forkX + i * size * 0.04, size * 0.36);
    ctx.stroke();
  }

  // Spoon
  const spX = size * 0.65;
  ctx.beginPath();
  ctx.arc(spX, size * 0.3, size * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(79,142,247,0.25)';
  ctx.fill();
  ctx.strokeStyle = '#4f8ef7';
  ctx.lineWidth = size * 0.035;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(spX, size * 0.375);
  ctx.lineTo(spX, size * 0.72);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

try {
  fs.writeFileSync(path.join(__dirname, 'icons', 'icon-192.png'), createIcon(192));
  fs.writeFileSync(path.join(__dirname, 'icons', 'icon-512.png'), createIcon(512));
  console.log('Icons generated successfully!');
} catch(e) {
  console.log('canvas module not available, generating SVG fallback...');
  // SVG fallback if canvas is not available
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1f3d"/>
        <stop offset="100%" style="stop-color:#0d1220"/>
      </linearGradient>
    </defs>
    <rect width="192" height="192" rx="40" fill="url(#g1)"/>
    <circle cx="96" cy="92" r="55" fill="none" stroke="#4f8ef7" stroke-width="8"/>
    <line x1="67" y1="42" x2="67" y2="138" stroke="#4f8ef7" stroke-width="7" stroke-linecap="round"/>
    <line x1="59" y1="42" x2="59" y2="70" stroke="#4f8ef7" stroke-width="6" stroke-linecap="round"/>
    <line x1="67" y1="42" x2="67" y2="70" stroke="#4f8ef7" stroke-width="6" stroke-linecap="round"/>
    <line x1="75" y1="42" x2="75" y2="70" stroke="#4f8ef7" stroke-width="6" stroke-linecap="round"/>
    <circle cx="124" cy="56" r="14" fill="rgba(79,142,247,0.3)" stroke="#4f8ef7" stroke-width="7"/>
    <line x1="124" y1="70" x2="124" y2="138" stroke="#4f8ef7" stroke-width="7" stroke-linecap="round"/>
  </svg>`;
  fs.writeFileSync(path.join(__dirname, 'icons', 'icon-192.svg'), svg);
  console.log('SVG icon created. PNG generation requires canvas package.');
}
