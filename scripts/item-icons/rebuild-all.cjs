// npm run item-icons -- --grid <32|40|48>
// Rebuilds every item icon at one grid, each from its source in assets/ (as
// CREDITS.md lists it) with the options it needs, then records the grid in
// src/assets/item-icon-grid.json. New icons (npm run item-icon), the app's
// icon sizes and the catalog page all follow that file.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

// Icons that need more than the defaults (see make-item-icon.cjs).
const OPTIONS = {
  'crystal-longbow': ['--thin'],
  'novices-charm': ['--thin'],
  'void-arbalest': ['--erase-corner=175,190'],
}

const root = path.join(__dirname, '../..')
const args = process.argv.slice(2)
const grid = Number(args.find((a) => a.startsWith('--grid='))?.slice('--grid='.length) ?? args[args.indexOf('--grid') + 1])
if (![32, 40, 48].includes(grid)) {
  console.error('usage: npm run item-icons -- --grid <32|40|48>')
  process.exit(1)
}

const credits = fs.readFileSync(path.join(root, 'CREDITS.md'), 'utf8')
const icons = [...credits.matchAll(/^\| `items\/([a-z0-9-]+)\.png` \| `([^`]+)` \|$/gm)].map(([, id, file]) => ({ id, source: path.join(root, 'assets', file) }))
const missing = icons.filter((icon) => !fs.existsSync(icon.source))
if (missing.length) {
  console.error(`missing source art in assets/: ${missing.map((icon) => icon.id).join(', ')}`)
  process.exit(1)
}

for (const { id, source } of icons) {
  execFileSync('node', [path.join(__dirname, 'make-item-icon.cjs'), source, id, `--grid=${grid}`, ...(OPTIONS[id] ?? [])], { stdio: 'ignore' })
}
fs.writeFileSync(path.join(root, 'src/assets/item-icon-grid.json'), `${JSON.stringify({ grid })}\n`)
console.log(`rebuilt ${icons.length} icons at ${grid}x${grid}; regenerate the catalog page with npm run item-catalog-page`)
