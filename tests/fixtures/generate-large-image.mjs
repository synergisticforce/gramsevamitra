#!/usr/bin/env node
/**
 * Generates a ~15 MB high-resolution JPEG with high entropy (noise) so compression
 * cannot shrink the source below the stress-test threshold.
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_BYTES = 15 * 1024 * 1024;
const MIN_BYTES = 14 * 1024 * 1024;
const OUT_DIR = path.join(__dirname, 'output');
const OUT_FILE = path.join(OUT_DIR, 'dummy-15mb-photo.jpg');

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp is required. Run: npm install --save-dev sharp');
    process.exit(1);
  }

  let width = 4000;
  let height = 4000;
  let quality = 98;
  let buffer;

  for (let attempt = 0; attempt < 10; attempt++) {
    const pixels = width * height * 3;
    const raw = Buffer.alloc(pixels);
    for (let i = 0; i < pixels; i++) {
      raw[i] = (i * 17 + attempt * 31 + (i % 256)) & 0xff;
    }

    buffer = await sharp(raw, { raw: { width, height, channels: 3 } })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer();

    const size = buffer.length;
    console.log(`Attempt ${attempt + 1}: ${width}×${height}px q=${quality} → ${(size / (1024 * 1024)).toFixed(2)} MB`);

    if (size >= MIN_BYTES) break;

    width = Math.round(width * 1.25);
    height = Math.round(height * 1.25);
    quality = Math.min(100, quality + 1);
  }

  writeFileSync(OUT_FILE, buffer);
  const finalSize = statSync(OUT_FILE).size;
  console.log(`Generated ${OUT_FILE} (${(finalSize / (1024 * 1024)).toFixed(2)} MB)`);

  if (finalSize < MIN_BYTES) {
    console.error(`Failed to reach ${MIN_BYTES / (1024 * 1024)} MB minimum. Got ${(finalSize / (1024 * 1024)).toFixed(2)} MB.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
