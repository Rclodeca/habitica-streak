// npm run item-icon -- <source.png> <item-id> [--clean-bg] [--thin] [--erase-corner=x,y]
// Turns a raw art download into public/sprites/items/<item-id>.png with the
// settings every item icon uses: the grid in src/assets/item-icon-grid.json
// (48 or 40: 2px pixels, 32: 3px pixels), 12
// colours, a 240px canvas and a 1px dark outline (see pixel-icon.cjs).
// --clean-bg first clears a flat backdrop colour (see clean-bg.cjs), for art
// that isn't transparent. --thin keeps grid cells only 30% covered instead of
// 50%, so thin parts like a staff shaft don't drop out. --erase-corner=x,y
// clears everything right of x and below y in the source first, for stray
// watermark pixels that would stretch the crop. To switch every icon to the
// other grid, use npm run item-icons (rebuild-all.cjs).
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')
const { decode, encode } = require('./pnglib.cjs')

// Art pixel size on the 240px canvas for each grid.
const SCALE = { 32: 3, 40: 2, 48: 2 }

const args = process.argv.slice(2)
const flag = (name) => args.find((a) => a === name || a.startsWith(`${name}=`))
const value = (name) => flag(name)?.split('=')[1]
const cleanBg = Boolean(flag('--clean-bg'))
const cutoff = flag('--thin') ? '0.3' : '0.5'
// --grid is for rebuild-all.cjs, which records the grid only once every icon is built.
const grid = Number(value('--grid') ?? require('../../src/assets/item-icon-grid.json').grid)
const [source, id] = args.filter((a) => !a.startsWith('--'))
if (!source || !id || !SCALE[grid]) {
  console.error('usage: npm run item-icon -- <source.png> <item-id> [--clean-bg] [--thin] [--erase-corner=x,y]')
  process.exit(1)
}

const out = path.join(__dirname, '../../public/sprites/items', `${id}.png`)
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'item-icon-')), 'in.png')
let input = source
if (flag('--erase-corner')) {
  const [x0, y0] = value('--erase-corner').split(',').map(Number)
  const img = decode(input)
  for (let y = y0; y < img.h; y++) for (let x = x0; x < img.w; x++) img.data.fill(0, (y * img.w + x) * 4, (y * img.w + x) * 4 + 4)
  input = tmp()
  fs.writeFileSync(input, encode(img.w, img.h, img.data))
}
if (cleanBg) {
  const cleaned = tmp()
  execFileSync('node', [path.join(__dirname, 'clean-bg.cjs'), input, cleaned], { stdio: 'inherit' })
  input = cleaned
}
execFileSync('node', [path.join(__dirname, 'pixel-icon.cjs'), input, out, String(grid), '12', String(SCALE[grid]), '240', 'outline', cutoff], { stdio: 'inherit' })
