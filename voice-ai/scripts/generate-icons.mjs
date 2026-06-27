// Rasterize the master SVG icons into the PNGs needed for
// iPhone (apple-touch-icon), Android/PWA (maskable + any), and desktop (favicon).
//
// Source of truth: public/icon.svg (full-bleed) and public/icon-maskable.svg (padded).
// The generated PNGs are committed, so the build does not need this at runtime.
// Re-run only when you change the source SVGs: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')

const iconSvg = readFileSync(join(pub, 'icon.svg'))
const maskableSvg = readFileSync(join(pub, 'icon-maskable.svg'))

// [source svg, output file, size] — covers iPhone / Android / desktop.
const targets = [
  [iconSvg, 'icon-192.png', 192], // PWA / Android (any)
  [iconSvg, 'icon-512.png', 512], // PWA / Android (any), splash
  [maskableSvg, 'icon-maskable-512.png', 512], // Android adaptive (maskable)
  [iconSvg, 'apple-touch-icon.png', 180], // iPhone / iPad home screen
  [iconSvg, 'favicon-32.png', 32], // desktop browser tab
  [iconSvg, 'favicon-16.png', 16], // desktop browser tab (small)
]

for (const [svg, name, size] of targets) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer()
  writeFileSync(join(pub, name), png)
  console.log(`wrote public/${name} (${size}x${size}, ${png.length} bytes)`)
}

console.log('icons generated.')
