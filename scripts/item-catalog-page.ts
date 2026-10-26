// Writes docs/mockups/item-catalog.html from the live ITEM_CATALOG.
// Run: npm run item-catalog-page
import { writeFileSync } from 'node:fs';
import { describeItemBonus, describeItemBonusParts, ITEM_CATALOG } from '../src/game-engine/items';
import type { ItemDef } from '../src/game-engine/items';

const SPRITES = '../../public/sprites/';
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'relic'];
const THEME_OF: Record<string, string> = {
  physicalDamage: 'Physical', magicDamage: 'Magic', trueDamage: 'True', critChance: 'Crit', allDamage: 'All damage',
  health: 'Tank', armor: 'Tank', magicResist: 'Tank', healing: 'Support', expGain: 'Support', lifesteal: 'Physical',
  armorPen: 'Physical', magicPen: 'Magic',
};
// Flat armor/MR compared on a rough percent scale so "+300 armor" doesn't outrank "+20% HP" by raw number.
const weight = (b: ItemDef['bonuses'][number]) => ((b.percent ?? 0) > 0 ? b.percent! : (b.flat ?? 0) > 0 ? b.flat! / 15 : 0);
function theme(item: ItemDef): string {
  if (item.type === 'consumable') return 'Consumable';
  const top = [...item.bonuses].sort((a, b) => weight(b) - weight(a))[0];
  return top ? THEME_OF[top.stat] ?? top.stat : '—';
}
const SECTIONS: { title: string; note: string; match: (i: ItemDef) => boolean }[] = [
  { title: 'Always droppable', note: 'from any boss', match: (i) => i.rarity !== 'relic' && !i.levelGated && !i.unlockLevel },
  { title: 'Unlocks at level 10 / 15 / 20', note: 'random per run', match: (i) => !!i.levelGated },
  { title: 'Unlocks at level 30', note: 'fixed', match: (i) => i.rarity !== 'relic' && i.unlockLevel === 30 },
  { title: 'Relics', note: 'side quests only', match: (i) => i.rarity === 'relic' },
];
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function card(item: ItemDef): string {
  const stats =
    item.type === 'consumable'
      ? `<li>${esc(describeItemBonus(item))}</li>`
      : describeItemBonusParts(item)
          .map((p) => `<li class="${p.text.startsWith('−') ? 'neg' : ''}"><b>${esc(p.text)}</b> ${esc(p.label)}</li>`)
          .join('');
  const unlock = item.rarity === 'relic' ? `<span class="tag">L${item.unlockLevel}</span>` : '';
  return `<article class="card r-${item.rarity}" data-theme="${theme(item)}">
    <div class="icon"><span class="art"><img src="${SPRITES}${item.icon}.png" alt=""></span></div>
    <div class="body">
      <h3>${esc(item.name)}</h3>
      <div class="meta"><span class="rarity">${item.rarity}</span><span class="tag">${theme(item)}</span>${unlock}</div>
      <ul>${stats}</ul>
      ${item.effectText ? `<p class="effect">${esc(item.effectText)}</p>` : ''}
    </div>
  </article>`;
}

const sections = SECTIONS.map((s) => {
  const items = ITEM_CATALOG.filter(s.match).sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || theme(a).localeCompare(theme(b)),
  );
  return `<section><h2>${s.title} <small>${items.length} · ${s.note}</small></h2><div class="grid">${items.map(card).join('')}</div></section>`;
}).join('');
const themes = ['All', 'Physical', 'Magic', 'True', 'Crit', 'Tank', 'Support', 'All damage', 'Consumable'];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Habitica Streak — item catalog</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap" />
<style>
/* Every item in ITEM_CATALOG with its current art, drawn like the character
   modal's gear list: the recessed slot, 2x2 pixels, dark rarity rim.
   Generated from the catalog, so regenerate it when the catalog changes. */
:root {
  --bg: #0b0a09; --panel: rgba(0,0,0,.25); --text: #a1988a; --text-h: #ece3cd; --bone: #d8cdb5; --gold: #c8a96e; --gold-hi: #e6cf9a;
  --line: rgba(200,169,110,.2); --line-mid: rgba(200,169,110,.4); --bad: #d0604f;
  --common: #8d8475; --uncommon: #86b08b; --rare: #7f9fd1; --epic: #ae8bd6; --relic: #ec8338;
}
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 60px; color: var(--bone); background: radial-gradient(ellipse 70% 40% at 50% -5%, rgba(200,169,110,.1), transparent 70%), #070606; font: 500 17px/1.35 'Cormorant Garamond', Garamond, Georgia, serif; }
.page { max-width: 1400px; margin: 0 auto; }
h1 { margin: 0 0 4px; text-align: center; font: 600 14px/1 'Cinzel', Georgia, serif; letter-spacing: .32em; text-transform: uppercase; color: var(--gold-hi); }
.sub { text-align: center; font-style: italic; color: var(--text); }
h2 { display: flex; align-items: baseline; gap: 10px; margin: 30px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); font: 600 12px/1 'Cinzel', Georgia, serif; letter-spacing: .2em; text-transform: uppercase; color: var(--text-h); }
h2 small { font: italic 500 15px/1 'Cormorant Garamond', Georgia, serif; letter-spacing: 0; text-transform: none; color: var(--text); }
.filters { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding: 14px 0; background: #070606; }
.filters button { min-height: 44px; padding: 0 14px; font: 600 10px/1 'Cinzel', serif; letter-spacing: .18em; text-transform: uppercase; color: var(--text); background: transparent; border: 1px solid var(--line); cursor: pointer; }
.filters button.on { color: var(--gold-hi); border-color: var(--gold); background: rgba(200,169,110,.08); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 8px; }

.card { --r: var(--rc); display: flex; align-items: center; gap: 12px; padding: 6px 12px 6px 8px; background: var(--panel); border: 1px solid var(--line); border-left: 2px solid var(--rc); }
.r-common { --rc: var(--common); } .r-uncommon { --rc: var(--uncommon); } .r-rare { --rc: var(--rare); } .r-epic { --rc: var(--epic); } .r-relic { --rc: var(--relic); }
.card.hide { display: none; }

/* The gear list's slot: rarity hairline, inner bevel, glow, gold corner ticks. */
.icon { position: relative; flex-shrink: 0; width: 80px; height: 80px; border: 1px solid color-mix(in srgb, var(--rc) 55%, transparent);
  background: radial-gradient(circle, color-mix(in srgb, var(--rc) 22%, transparent), rgba(0,0,0,.55) 72%);
  box-shadow: inset 0 0 0 3px rgba(0,0,0,.55), inset 0 0 0 4px color-mix(in srgb, var(--rc) 22%, transparent), 0 0 14px -6px var(--rc); }
.icon::before { content: ''; position: absolute; inset: -1px; pointer-events: none; opacity: .9;
  background:
    linear-gradient(var(--gold), var(--gold)) top left / 7px 1px no-repeat, linear-gradient(var(--gold), var(--gold)) top left / 1px 7px no-repeat,
    linear-gradient(var(--gold), var(--gold)) top right / 7px 1px no-repeat, linear-gradient(var(--gold), var(--gold)) top right / 1px 7px no-repeat,
    linear-gradient(var(--gold), var(--gold)) bottom left / 7px 1px no-repeat, linear-gradient(var(--gold), var(--gold)) bottom left / 1px 7px no-repeat,
    linear-gradient(var(--gold), var(--gold)) bottom right / 7px 1px no-repeat, linear-gradient(var(--gold), var(--gold)) bottom right / 1px 7px no-repeat; }
.art { position: absolute; inset: 0; overflow: hidden; }
.art img { --rim: color-mix(in srgb, var(--rc) 55%, #000); position: absolute; left: 50%; top: 50%; width: 160px; height: 160px; transform: translate(-50%, -50%); image-rendering: pixelated;
  filter: drop-shadow(2px 0 0 var(--rim)) drop-shadow(-2px 0 0 var(--rim)) drop-shadow(0 2px 0 var(--rim)) drop-shadow(0 -2px 0 var(--rim)) drop-shadow(0 0 6px color-mix(in srgb, var(--rc) 45%, transparent)); }

.body { min-width: 0; }
h3 { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-h); line-height: 1.15; }
.meta { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 5px; font: 600 9px/1 'Cinzel', serif; letter-spacing: .16em; text-transform: uppercase; }
.rarity { color: var(--rc); }
.tag { padding: 2px 5px; color: var(--text); border: 1px solid var(--line); }
ul { margin: 0; padding: 0; list-style: none; font-size: 15px; }
li b { font-weight: 600; color: var(--text-h); }
li { color: var(--text); }
li.neg, li.neg b { color: var(--bad); }
.effect { margin: 4px 0 0; font-size: 15px; font-style: italic; color: var(--rc); line-height: 1.2; }
</style>
</head>
<body>
<div class="page">
<h1>Item catalog</h1>
<p class="sub">${ITEM_CATALOG.length} items · grouped by unlock, sorted by rarity</p>
<div class="filters">${themes.map((t, i) => `<button type="button" data-t="${t}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div>
${sections}
</div>
<script>
document.querySelectorAll('.filters button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.filters button').forEach((x) => x.classList.toggle('on', x === b));
  const t = b.dataset.t;
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('hide', t !== 'All' && c.dataset.theme !== t));
}));
</script>
</body>
</html>
`;

writeFileSync(process.argv[2], html);
console.log('wrote', ITEM_CATALOG.length, 'items to', process.argv[2]);
