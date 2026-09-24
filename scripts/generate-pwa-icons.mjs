import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "docs/design/visual-identity/assets/logo-mark-large.png");
const publicDirectory = resolve(root, "public");
const background = { r: 249, g: 247, b: 242, alpha: 1 };

async function renderIcon(name, size, contentRatio) {
  const target = Math.floor(size * contentRatio);
  const artwork = await sharp(source)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: target, height: target, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const output = resolve(publicDirectory, name);
  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: artwork, gravity: "centre" }])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(output);
}

// Keep the artwork intact; only transparent padding and scale vary by use.
await renderIcon("favicon-16x16.png", 16, 0.9);
await renderIcon("favicon-32x32.png", 32, 0.9);
await renderIcon("apple-touch-icon.png", 180, 0.82);
await renderIcon("icons/pwa-192x192.png", 192, 0.82);
await renderIcon("icons/pwa-512x512.png", 512, 0.82);
// Keep the whole mark inside the maskable safe zone with generous padding.
await renderIcon("icons/pwa-maskable-512x512.png", 512, 0.68);
