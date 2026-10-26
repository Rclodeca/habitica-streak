// npm run item-icon -- <source.png> <item-id> [--clean-bg] [--thin]
// Turns a raw art download into public/sprites/items/<item-id>.png with the
// settings every item icon uses: 32px grid, 12 colours, 3px pixels on a 240px
// canvas, 1px dark outline (see pixel-icon.cjs). --clean-bg first clears a
// flat backdrop colour (see clean-bg.cjs), for art that isn't transparent.
// --thin keeps grid cells only 30% covered instead of 50%, so thin parts
// like a staff shaft don't drop out.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const FLAGS = ['--clean-bg', '--thin']
const args = process.argv.slice(2)
const cleanBg = args.includes('--clean-bg')
const cutoff = args.includes('--thin') ? '0.3' : '0.5'
const [source, id] = args.filter((a) => !FLAGS.includes(a))
if (!source || !id) {
  console.error('usage: npm run item-icon -- <source.png> <item-id> [--clean-bg] [--thin]')
  process.exit(1)
}

const out = path.join(__dirname, '../../public/sprites/items', `${id}.png`)
let input = source
if (cleanBg) {
  input = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'item-icon-')), 'clean.png')
  execFileSync('node', [path.join(__dirname, 'clean-bg.cjs'), source, input], { stdio: 'inherit' })
}
execFileSync('node', [path.join(__dirname, 'pixel-icon.cjs'), input, out, '32', '12', '3', '240', 'outline', cutoff], { stdio: 'inherit' })
