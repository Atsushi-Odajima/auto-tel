// Generates simple solid-gradient PNG app icons (no external deps).
// Run: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function makePng(size) {
  const w = size
  const h = size
  // RGBA raw with 1-byte filter per row
  const raw = Buffer.alloc((w * 4 + 1) * h)
  let p = 0
  for (let y = 0; y < h; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      // diagonal gradient between purple (#7c5cff) and cyan (#22d3ee)
      const t = (x / w + y / h) / 2
      const r = Math.round(0x7c + (0x22 - 0x7c) * t)
      const g = Math.round(0x5c + (0xd3 - 0x5c) * t)
      const b = Math.round(0xff + (0xee - 0xff) * t)
      // dark rounded background mask
      const cx = w / 2
      const cy = h / 2
      const margin = size * 0.12
      const inRect =
        x >= margin && x <= w - margin && y >= margin && y <= h - margin
      // mic glyph (rough): vertical capsule in center
      const micW = size * 0.18
      const isMic =
        Math.abs(x - cx) < micW / 2 &&
        y > cy - size * 0.22 &&
        y < cy + size * 0.1
      if (!inRect) {
        raw[p++] = 0x0b
        raw[p++] = 0x10
        raw[p++] = 0x20
        raw[p++] = 0xff
      } else if (isMic) {
        raw[p++] = 0xff
        raw[p++] = 0xff
        raw[p++] = 0xff
        raw[p++] = 0xff
      } else {
        raw[p++] = r
        raw[p++] = g
        raw[p++] = b
        raw[p++] = 0xff
      }
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const png = makePng(size)
  writeFileSync(join(outDir, `icon-${size}.png`), png)
  console.log(`wrote public/icon-${size}.png (${png.length} bytes)`)
}
