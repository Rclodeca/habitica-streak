// node scripts/item-icons/outline-sprite.cjs <sprite.png> <art-pixel-size>
// Gives an already-pixelated sprite (e.g. public/sprites/player/*.png, 2 file px
// per art pixel) the item icons' 1-art-pixel dark outline, in place: every empty
// art pixel touching the figure (4-neighbour) turns dark. A sprite whose edge is
// already all outline is left as is, so running it twice is safe.
const fs = require('fs')
const { decode, encode } = require('./pnglib.cjs')

const OUTLINE = [14, 11, 11]
const [file, sizeArg] = process.argv.slice(2)
const S = Number(sizeArg)
if (!file || !S) {
  console.error('usage: node scripts/item-icons/outline-sprite.cjs <sprite.png> <art-pixel-size>')
  process.exit(1)
}

const img = decode(file)
const W = img.w / S, H = img.h / S
if (!Number.isInteger(W) || !Number.isInteger(H)) throw new Error(`${file} isn't a whole number of ${S}px art pixels`)
// One sample per art pixel (its top-left file pixel).
const at = (x, y) => (y * S * img.w + x * S) * 4
const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && img.data[at(x, y) + 3] > 0
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

const edge = []
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (filled(x, y) && NEIGHBOURS.some(([dx, dy]) => !filled(x + dx, y + dy))) edge.push(at(x, y))
}
if (edge.every((i) => OUTLINE.every((c, k) => img.data[i + k] === c))) {
  console.log(file.split('/').pop(), 'already outlined')
  process.exit(0)
}

const ring = []
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!filled(x, y) && NEIGHBOURS.some(([dx, dy]) => filled(x + dx, y + dy))) ring.push([x, y])
}
for (const [x, y] of ring) {
  for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
    const i = ((y * S + dy) * img.w + x * S + dx) * 4
    img.data[i] = OUTLINE[0]; img.data[i + 1] = OUTLINE[1]; img.data[i + 2] = OUTLINE[2]; img.data[i + 3] = 255
  }
}
fs.writeFileSync(file, encode(img.w, img.h, img.data))
console.log(file.split('/').pop(), `+${ring.length} outline pixels`)
