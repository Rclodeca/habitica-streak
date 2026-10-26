// node clean-bg.cjs <in.png> <out.png> : flood-fills the flat backdrop colour inward from the edges to transparent
const fs = require('fs')
const { decode, encode } = require('./pnglib.cjs')
const img = decode(process.argv[2])
const { w, h, data } = img
const bg = [data[0], data[1], data[2], data[3]]
const near = (i) => Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) + Math.abs(data[i + 3] - bg[3]) <= 24
const seen = new Uint8Array(w * h)
const stack = []
for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
let cleared = 0
while (stack.length) {
  const p = stack.pop()
  if (seen[p] || !near(p * 4)) continue
  seen[p] = 1
  data[p * 4 + 3] = 0
  cleared++
  const x = p % w, y = (p - x) / w
  if (x > 0) stack.push(p - 1)
  if (x < w - 1) stack.push(p + 1)
  if (y > 0) stack.push(p - w)
  if (y < h - 1) stack.push(p + w)
}
fs.writeFileSync(process.argv[3], encode(w, h, data))
console.log('cleared', cleared, 'of', w * h)
