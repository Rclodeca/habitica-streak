// node pixel-icon.cjs <in.png> <out.png> <grid> <colors> <scale> <canvas> [outline] [cutoff]
// Crops the artwork, area-averages it onto a <grid> x <grid> pixel grid, snaps it to
// <colors> colors, and draws each pixel <scale> px wide, centred on a <canvas> square.
const fs = require('fs')
const { decode, encode } = require('./pnglib.cjs')
const [inFile, outFile, gridArg, colorsArg, scaleArg, canvasArg] = process.argv.slice(2)
const N = Number(gridArg), K = Number(colorsArg), SC = Number(scaleArg), CANVAS = Number(canvasArg)
// A grid cell keeps its pixel when at least this share of it is covered by art.
// Lower it for thin art (e.g. a staff shaft) that would otherwise drop out.
const CUTOFF = Number(process.argv[9] ?? 0.5)
const img = decode(inFile)
let minX = img.w, minY = img.h, maxX = 0, maxY = 0
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y*img.w+x)*4+3] > 0) {
  minX = Math.min(minX,x); maxX = Math.max(maxX,x); minY = Math.min(minY,y); maxY = Math.max(maxY,y)
}
const cw = maxX-minX+1, ch = maxY-minY+1, side = Math.max(cw, ch)

// area-average the cropped art onto an n x n grid (premultiplied), binary alpha
function grid(n) {
  const px = []
  const scale = n / side
  const offX = (side - cw) / 2, offY = (side - ch) / 2
  for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) {
    let r=0,g=0,b=0,a=0,w=0
    const x0 = gx/scale - offX + minX, x1 = (gx+1)/scale - offX + minX
    const y0 = gy/scale - offY + minY, y1 = (gy+1)/scale - offY + minY
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
      const wgt = (Math.min(sx+1,x1)-Math.max(sx,x0)) * (Math.min(sy+1,y1)-Math.max(sy,y0))
      w += wgt
      if (sx<0||sy<0||sx>=img.w||sy>=img.h) continue
      const i=(sy*img.w+sx)*4, al=img.data[i+3]/255
      r+=img.data[i]*al*wgt; g+=img.data[i+1]*al*wgt; b+=img.data[i+2]*al*wgt; a+=al*wgt
    }
    px.push(a/w >= CUTOFF ? [r/a, g/a, b/a] : null)
  }
  return px
}

// k-means palette on the opaque pixels
function quantize(px, k) {
  const pts = px.filter(Boolean)
  let cent = Array.from({length:k}, (_, i) => pts[Math.floor(i*pts.length/k)].slice())
  for (let it = 0; it < 12; it++) {
    const sum = cent.map(() => [0,0,0,0])
    for (const p of pts) {
      let best = 0, bd = Infinity
      cent.forEach((c, i) => { const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2; if (d<bd){bd=d;best=i} })
      sum[best][0]+=p[0]; sum[best][1]+=p[1]; sum[best][2]+=p[2]; sum[best][3]++
    }
    cent = cent.map((c,i) => sum[i][3] ? [sum[i][0]/sum[i][3], sum[i][1]/sum[i][3], sum[i][2]/sum[i][3]] : c)
  }
  return px.map(p => {
    if (!p) return null
    let best = 0, bd = Infinity
    cent.forEach((c, i) => { const d=(c[0]-p[0])**2+(c[1]-p[1])**2+(c[2]-p[2])**2; if (d<bd){bd=d;best=i} })
    return cent[best]
  })
}


const OUTLINE = process.argv[8] === 'outline' ? [14, 11, 11] : null
let q = quantize(grid(N), K)
let M = N
if (OUTLINE) {
  // Pad by one pixel, then darken every empty pixel that touches art (4-neighbour).
  M = N + 2
  const padded = Array(M * M).fill(null)
  q.forEach((c, i) => { padded[(Math.floor(i / N) + 1) * M + (i % N) + 1] = c })
  q = padded.map((c, i) => {
    if (c) return c
    const x = i % M, y = Math.floor(i / M)
    const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy
      return nx >= 0 && ny >= 0 && nx < M && ny < M && padded[ny * M + nx]
    })
    return touches ? OUTLINE : null
  })
}
const out = Buffer.alloc(CANVAS * CANVAS * 4)
const off = Math.floor((CANVAS - M * SC) / 2)
q.forEach((c, i) => {
  if (!c) return
  const gx = i % M, gy = Math.floor(i / M)
  for (let dy = 0; dy < SC; dy++) for (let dx = 0; dx < SC; dx++) {
    const o = ((off + gy * SC + dy) * CANVAS + off + gx * SC + dx) * 4
    out[o] = Math.round(c[0]); out[o+1] = Math.round(c[1]); out[o+2] = Math.round(c[2]); out[o+3] = 255
  }
})
fs.writeFileSync(outFile, encode(CANVAS, CANVAS, out))
console.log(outFile.split('/').pop(), 'grid', N, 'colors', K, OUTLINE ? '+outline' : '')
