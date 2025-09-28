// Generate a padded adaptive icon foreground PNG from the base app icon.
// - Input:  assets/images/app-icon.jpg (existing)
// - Output: assets/images/app-icon-foreground.png (transparent with padding)
// Padding strategy: place the source image within ~75% of a 1024x1024 canvas,
// centered, preserving aspect ratio, leaving transparent margins to avoid mask cropping.

import Jimp from 'jimp';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const root = path.resolve(projectRoot, '..');
  const srcRel = 'assets/images/app-icon.jpg';
  const outRel = 'assets/images/app-icon-foreground.png';
  const srcPath = path.resolve(root, srcRel);
  const outPath = path.resolve(root, outRel);

  if (!existsSync(srcPath)) {
    console.error(`Source icon not found at ${srcRel}. Update the script if your icon is elsewhere.`);
    process.exit(1);
  }

  const CANVAS = 1024; // required by Android adaptive icon assets
  const CONTENT_RATIO = 0.75; // 75% of canvas for safe visual area
  const TARGET = Math.round(CANVAS * CONTENT_RATIO);

  const [canvas, src] = await Promise.all([
    new Jimp(CANVAS, CANVAS, 0x00000000), // transparent background
    Jimp.read(srcPath),
  ]);

  // Scale source to fit within TARGET x TARGET bounding box, preserving aspect ratio
  const srcW = src.getWidth();
  const srcH = src.getHeight();
  const scale = Math.min(TARGET / srcW, TARGET / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);

  src.resize(newW, newH, Jimp.RESIZE_BILINEAR);

  // Center the resized image on canvas
  const x = Math.round((CANVAS - newW) / 2);
  const y = Math.round((CANVAS - newH) / 2);
  canvas.composite(src, x, y);

  await canvas.writeAsync(outPath);
  console.log(`Wrote padded adaptive icon foreground: ${path.relative(root, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
