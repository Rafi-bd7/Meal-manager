// generate_sounds.js
const fs = require('fs');
const path = require('path');

function createWavHeader(dataLength, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

// Generate Tone: Message chime (Messenger / Apple style two-tone ding: 880Hz + 1320Hz)
function generateMessageChime() {
  const sampleRate = 44100;
  const duration = 0.55; // seconds
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    // First tone (A5 = 880Hz) starts at 0, lasts 0.25s
    if (t >= 0 && t < 0.25) {
      const decay = Math.exp(-t * 12);
      s += Math.sin(2 * Math.PI * 880 * t) * decay * 0.45;
      s += Math.sin(2 * Math.PI * 1760 * t) * decay * 0.15; // harmonic
    }

    // Second tone (E6 = 1320Hz) starts at 0.09s, lasts 0.45s
    if (t >= 0.09) {
      const t2 = t - 0.09;
      const decay2 = Math.exp(-t2 * 9);
      s += Math.sin(2 * Math.PI * 1320 * t2) * decay2 * 0.55;
      s += Math.sin(2 * Math.PI * 2640 * t2) * decay2 * 0.2; // harmonic
    }

    // Clamp
    s = Math.max(-1, Math.min(1, s));
    samples[i] = Math.floor(s * 32767);
  }

  const dataBuffer = Buffer.from(samples.buffer);
  const header = createWavHeader(dataBuffer.length, sampleRate, 1, 16);
  return Buffer.concat([header, dataBuffer]);
}

// Generate Tone: Announcement / Notice chime (Rich 3-tone chime: 587Hz, 880Hz, 1175Hz)
function generateNoticeChime() {
  const sampleRate = 44100;
  const duration = 0.8;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    // Tone 1: 587.33Hz (D5) at 0.00s
    if (t >= 0 && t < 0.3) {
      const decay = Math.exp(-t * 10);
      s += Math.sin(2 * Math.PI * 587.33 * t) * decay * 0.35;
    }

    // Tone 2: 880.00Hz (A5) at 0.12s
    if (t >= 0.12 && t < 0.45) {
      const t2 = t - 0.12;
      const decay2 = Math.exp(-t2 * 9);
      s += Math.sin(2 * Math.PI * 880 * t2) * decay2 * 0.45;
    }

    // Tone 3: 1174.66Hz (D6) at 0.24s
    if (t >= 0.24) {
      const t3 = t - 0.24;
      const decay3 = Math.exp(-t3 * 7);
      s += Math.sin(2 * Math.PI * 1174.66 * t3) * decay3 * 0.55;
      s += Math.sin(2 * Math.PI * 2349.32 * t3) * decay3 * 0.18;
    }

    s = Math.max(-1, Math.min(1, s));
    samples[i] = Math.floor(s * 32767);
  }

  const dataBuffer = Buffer.from(samples.buffer);
  const header = createWavHeader(dataBuffer.length, sampleRate, 1, 16);
  return Buffer.concat([header, dataBuffer]);
}

const soundsDir = path.join(__dirname, 'sounds');
if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });

fs.writeFileSync(path.join(soundsDir, 'message.wav'), generateMessageChime());
fs.writeFileSync(path.join(soundsDir, 'notification.wav'), generateNoticeChime());

console.log('Sounds generated successfully in ' + soundsDir);
