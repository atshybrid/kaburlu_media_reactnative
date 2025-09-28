import fs from 'fs';
import { Buffer } from 'node:buffer';
import path from 'path';

const root = path.resolve(process.cwd());
const srcJson = path.join(root, 'assets', 'lotti', 'splash_kb.json');
const imagesDir = path.join(root, 'assets', 'lotti', 'images');
const outJson = path.join(root, 'assets', 'lotti', 'splash_kb.inlined.json');

function guessMime(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function inlineAssets(anim) {
  if (!Array.isArray(anim.assets)) return anim;
  for (const a of anim.assets) {
    if (!a || typeof a.p !== 'string') continue;
    const filename = a.p;
    if (String(filename).startsWith('data:')) continue; // already inlined
    const candidates = [
      path.join(imagesDir, filename),
      path.join(imagesDir, String(filename).replace(/^\//, '')),
    ];
    let filePath = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) { filePath = c; break; }
    }
    if (!filePath) continue;
    const buf = fs.readFileSync(filePath);
    const mime = guessMime(filename);
    const b64 = Buffer.from(buf).toString('base64');
    a.u = '';
    a.p = `data:${mime};base64,${b64}`;
  }
  return anim;
}

try {
  if (!fs.existsSync(srcJson)) {
    console.error(`❌ Source JSON not found: ${srcJson}`);
    process.exit(1);
  }
  if (!fs.existsSync(imagesDir)) {
    console.error(`❌ Images folder not found: ${imagesDir}`);
    process.exit(2);
  }
  const raw = fs.readFileSync(srcJson, 'utf8');
  const anim = JSON.parse(raw);
  const updated = inlineAssets(anim);
  fs.writeFileSync(outJson, JSON.stringify(updated));
  console.log(`✅ Wrote ${outJson}`);
} catch (e) {
  console.error('❌ Inline failed:', e?.message || e);
  process.exit(3);
}
