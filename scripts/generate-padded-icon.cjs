/* eslint-disable no-undef */
// Generate a padded adaptive icon foreground PNG from the base app icon.
// - Input:  assets/images/app-icon.jpg (existing)
// - Output: assets/images/app-icon-foreground.png (transparent with padding)
// Padding strategy: place the source image within ~75% of a 1024x1024 canvas,
// centered, preserving aspect ratio, leaving transparent margins to avoid mask cropping.

const { Jimp } = require('jimp');
const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const srcRel = 'assets/images/app-icon.jpg';
  const outRel = 'assets/images/app-icon-foreground.png';
  const srcPath = path.resolve(projectRoot, srcRel);
  const outPath = path.resolve(projectRoot, outRel);

  if (!fs.existsSync(srcPath)) {
    console.error(`Source icon not found at ${srcRel}. Update the script if your icon is elsewhere.`);
    process.exit(1);
  }

  const CANVAS = 1024; // required by Android adaptive icon assets
  const CONTENT_RATIO = 0.75; // 75% of canvas for safe visual area
  const TARGET = Math.round(CANVAS * CONTENT_RATIO);

  const [canvas, src] = await Promise.all([
    new Jimp({ width: CANVAS, height: CANVAS, color: 0x00000000 }), // transparent
    Jimp.read(srcPath),
  ]);

  // Scale source to fit within TARGET x TARGET bounding box, preserving aspect ratio
  const srcW = src.bitmap.width;
  const srcH = src.bitmap.height;
  const scale = Math.min(TARGET / srcW, TARGET / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);

  // Jimp v1 API: resize expects an options object
  src.resize({ w: newW, h: newH, mode: 'bilinear' });

  // Center the resized image on canvas
  const x = Math.round((CANVAS - newW) / 2);
  const y = Math.round((CANVAS - newH) / 2);
  canvas.composite(src, x, y);

  await canvas.writeAsync(outPath);
  console.log(`Wrote padded adaptive icon foreground: ${path.relative(projectRoot, outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
