import { strFromU8, unzipSync } from 'fflate';
import fs from 'fs';
import { Buffer } from 'node:buffer';
import path from 'path';

const root = path.resolve(process.cwd());
const inputPath = path.join(root, 'assets', 'lotti', 'splash_screen.lottie');
const outJsonPath = path.join(root, 'assets', 'lotti', 'splash_screen.json');

try {
  if (!fs.existsSync(inputPath)) {
    // Treat as optional so platform builds don't fail when this asset isn't present.
    console.warn(`⚠️ Input not found (skipping): ${inputPath}`);
    process.exit(0);
  }
  const raw = fs.readFileSync(inputPath);
  const files = unzipSync(new Uint8Array(raw));

  // Find manifest (manifest.json or manifest.lottie)
  const manifestEntry = Object.keys(files).find((k) => /manifest\.(json|lottie)$/i.test(k));
  let animationPath = null;
  if (manifestEntry) {
    const manifestJson = JSON.parse(strFromU8(files[manifestEntry]));
    const firstAnim = manifestJson?.animations?.[0]?.id || manifestJson?.animations?.[0]?.path || null;
    if (firstAnim) {
      // Common structure: animations/<id>.json
      const candidate = `animations/${firstAnim}.json`;
      if (files[candidate]) animationPath = candidate;
    }
  }
  if (!animationPath) {
    // Fallback: first .json under animations/
    const firstJson = Object.keys(files).find((k) => /^animations\/.+\.json$/i.test(k));
    if (firstJson) animationPath = firstJson;
  }
  if (!animationPath) {
    console.error('❌ Could not locate animation JSON inside .lottie');
    process.exit(2);
  }

  const anim = JSON.parse(strFromU8(files[animationPath]));

  // Inline images if present
  if (Array.isArray(anim.assets)) {
    for (const a of anim.assets) {
      if (a && a.p && typeof a.p === 'string') {
        // Build path like images/<filename>
        const imgKeyCandidates = [
          `images/${a.p}`,
          `${a.u || ''}${a.p}`.replace(/^\//, ''),
        ];
        let foundKey = null;
        for (const k of imgKeyCandidates) {
          if (files[k]) { foundKey = k; break; }
        }
        if (foundKey) {
          const ext = path.extname(a.p).toLowerCase();
          const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png';
          const buf = files[foundKey];
          const b64 = Buffer.from(buf).toString('base64');
          a.u = '';
          a.p = `data:${mime};base64,${b64}`;
        }
      }
    }
  }

  fs.writeFileSync(outJsonPath, JSON.stringify(anim));
  console.log(`✅ Wrote ${outJsonPath}`);
  process.exit(0);
} catch (e) {
  console.error('❌ Conversion failed:', e?.message || e);
  process.exit(3);
}
