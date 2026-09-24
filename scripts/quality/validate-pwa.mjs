import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(root, "public/manifest.webmanifest");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const requiredFields = [
  "name",
  "short_name",
  "start_url",
  "scope",
  "display",
  "background_color",
  "theme_color",
  "icons",
];
for (const field of requiredFields) {
  if (!(field in manifest)) throw new Error(`Manifest is missing required field: ${field}`);
}
if (manifest.display !== "standalone") throw new Error("Manifest display must be standalone");

function readPngSize(path) {
  const buffer = readFileSync(path);
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error(`Not a PNG: ${path}`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

for (const icon of manifest.icons) {
  const iconPath = resolve(root, "public", icon.src.replace(/^\//, ""));
  if (!existsSync(iconPath)) throw new Error(`Manifest icon does not exist: ${icon.src}`);
  const declared = icon.sizes.split("x").map(Number);
  const actual = readPngSize(iconPath);
  if (actual.width !== declared[0] || actual.height !== declared[1]) {
    throw new Error(`Manifest size mismatch for ${icon.src}: ${actual.width}x${actual.height}`);
  }
}

for (const [relativePath, expectedSize] of [
  ["public/apple-touch-icon.png", 180],
  ["public/favicon-16x16.png", 16],
  ["public/favicon-32x32.png", 32],
]) {
  const iconPath = resolve(root, relativePath);
  if (!existsSync(iconPath)) throw new Error(`Required PWA asset does not exist: ${relativePath}`);
  const actual = readPngSize(iconPath);
  if (actual.width !== expectedSize || actual.height !== expectedSize) {
    throw new Error(
      `PWA asset size mismatch for ${relativePath}: ${actual.width}x${actual.height}`,
    );
  }
}

const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");
for (const requiredLink of [
  'rel="manifest" href="/manifest.webmanifest"',
  'rel="apple-touch-icon" href="/apple-touch-icon.png"',
  'href="/favicon-32x32.png"',
  'href="/favicon-16x16.png"',
]) {
  if (!indexHtml.includes(requiredLink)) throw new Error(`index.html is missing: ${requiredLink}`);
}

console.log(`PWA validation passed (${manifest.icons.length} manifest icons).`);
