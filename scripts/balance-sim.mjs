// Small day-by-day balance model for the streak-rank + boss-HP rebalance
// (docs/superpowers/specs/2026-10-26-streak-ranks-and-boss-scaling-design.md).
// Not the real engine: no boss skills, lifesteal, item effects, events or
// weeklies. Items are a saturating multiplier on kills this run.
// `node scripts/balance-sim.mjs` compares variants (~1s); TABLE=1 prints the
// picked variant's expected-level and boss HP tables.
const DAYS = 300, SEEDS = +(process.env.SEEDS || 40), RUNAWAY_INDEX = 100;

function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const expToNext = (L) => (L < 5 ? 25 * L : L === 5 ? 150 : Math.round((L * L * 0.25 + 10 * L + 139.75) / 10) * 10);
const MILESTONE_EXP = { 5: 5, 10: 12, 20: 30, 30: 55, 50: 112, 100: 300 };
const RANK_AT = [10, 20, 30, 50, 100, 200, 300, 500];
const z1 = Math.log(0.65 / 0.05 - 1), z2 = Math.log(0.65 / 0.6 - 1), K = (z1 - z2) / 49, MID = 1 + z1 / K;
const missPct = (i) => 0.65 / (1 + Math.exp(-K * (i - MID)));
const resistBase = (i) => 0.1 + 0.25 * Math.min(1, (i - 1) / 29);
const resistTier = (i) => { const t = Math.min(1, (i - 1) / 29), b = resistBase(i); return b + (0.55 - b) * t; };

// SKILLS=n picks the first n of ORDER instead of the default 10; POOLS=0 drops
// the damage pools so each skill hits for NOPOOL_SCALE of its type's stat.
const ORDER = ['phys', 'mag', 'phys', 'mag', 'heal', 'phys', 'mag', 'tru', 'phys', 'mag', 'heal', 'phys', 'mag', 'phys', 'mag', 'heal', 'tru', 'phys', 'mag', 'phys'];
// HEAVY_HEAL=1 instead gives the most heal skills the 1-in-4 cap allows (the outhealing worst case).
const heavyHeal = (n) => Array.from({ length: n }, (_, i) => { const heals = Math.ceil(n / 4); return i < heals ? 'heal' : i === heals && n >= 6 ? 'tru' : i % 2 ? 'phys' : 'mag'; });
const TYPES = process.env.HEAVY_HEAL
  ? heavyHeal(+(process.env.SKILLS || 10))
  : process.env.SKILLS ? ORDER.slice(0, +process.env.SKILLS) : ['phys', 'phys', 'phys', 'phys', 'mag', 'mag', 'mag', 'heal', 'heal', 'tru'];
const N = TYPES.length, POOLS = process.env.POOLS !== '0', NOPOOL_SCALE = +(process.env.NOPOOL_SCALE || 0.6);
const STAT = { phys: 560, mag: 560, heal: 188, tru: 480 };
const share = {};
for (const t of new Set(TYPES)) {
  const k = TYPES.filter((x) => x === t).length;
  share[t] = POOLS ? (STAT[t] * (0.8 + 0.2 * k)) / k : STAT[t] * NOPOOL_SCALE;
}
// Without pools a heal skill heals HEAL_STAT (vs 1,250 base HP), and HEAL_RANK sets healing's own per-rank bonus.
if (!POOLS && process.env.HEAL_STAT) share.heal = +process.env.HEAL_STAT;
const HEAL_RANK = process.env.HEAL_RANK === undefined ? undefined : +process.env.HEAL_RANK;
// A skill's completion chance: the player's 10-skill profile spread over N skills.
const chanceFor = (probs, j) => probs[N <= 10 ? Math.floor((j * 10) / N) : j % 10];
const itemDmg = (kills) => 1 + 1.5 * (1 - Math.exp(-kills / 30));
const itemHp = (kills) => 1 + 0.5 * (1 - Math.exp(-kills / 30));

const DECENT = [0.97, 0.97, 0.95, 0.88, 0.88, 0.85, 0.85, 0.75, 0.7, 0.7];
const PLAYERS = {
  perfect: Array(10).fill(0.98),
  good: [0.98, 0.98, 0.97, 0.95, 0.95, 0.93, 0.92, 0.9, 0.88, 0.85],
  decent: DECENT,
  sloppy: [0.85, 0.8, 0.75, 0.7, 0.65, 0.65, 0.6, 0.55, 0.5, 0.45],
  lapse: DECENT, // decent, plus a bad week (10% completion) from day 150
};

// Boss HP growth: x1.27 per boss up to `from`, then `g`.
const curve = (from, g) => (i) => (i <= from ? 1.27 : g);
// [first boss #, growth] bands, x1.27 before the first band.
const bands = (...rows) => (i) => { let g = 1.27; for (const [at, rate] of rows) if (i >= at) g = rate; return g; };
const current = (s) => 1 + 0.1 * s;
const ranked = (per) => (s, r) => 1 + per * r + 0.01 * s;
// Boss-kill EXP: today's exponential, or a share of the EXP to the next level.
const expToday = (idx) => 33 * 1.12 ** (idx - 1);
// KILL_FLOOR: a kill pays at least this much EXP (the spec uses 33, today's boss-1 reward).
const expShare = (f) => (idx, level) => Math.max(+(process.env.KILL_FLOOR || 0), f * expToNext(level));
// The picked boss HP bands; BANDS='[[13,1.16],[31,1.11]]' tries others against today (and TABLE=1 prints them).
// KILL_SHARE overrides the 0.75-level kill EXP in the BANDS run (e.g. 0.75 × an EXP-gain item bonus).
// EXP_BONUS multiplies every EXP grant (EXP-gain items); DAILY_EXP is the share of a level that doing all N skills in a day pays.
const EXP_BONUS = +(process.env.EXP_BONUS || 0), DAILY_EXP = +(process.env.DAILY_EXP || 0);
const KILL_SHARE = +(process.env.KILL_SHARE || 0.75);
const PICKED = JSON.parse(process.env.BANDS || '[[13,1.17],[31,1.11],[51,1.09]]');
const SYSTEMS = process.env.BANDS ? [
  ['today', current, curve(99, 1.27), expToday],
  [`rank, bands ${JSON.stringify(PICKED)}, kill = ${KILL_SHARE} level`, ranked(1), bands(...PICKED), expShare(KILL_SHARE)],
] : [
  ['today', current, curve(99, 1.27), expToday],
  ['rank, bosses x1.27', ranked(1), curve(99, 1.27), expToday],
  ['rank, x1.17 after 10 (runs away)', ranked(1), curve(10, 1.17), expToday],
  ['first pick: rank, bands 13:1.15 31:1.11 51:1.09, kill = 3/4 level', ranked(1), bands([13, 1.15], [31, 1.11], [51, 1.09]), expShare(0.75)],
  [`picked: rank, bands ${JSON.stringify(PICKED)}, kill = 3/4 level`, ranked(1), bands(...PICKED), expShare(0.75)],
  ['rank, picked bands, kill = 1 level', ranked(1), bands(...PICKED), expShare(1)],
  ['rank, picked bands, kill = 1/2 level', ranked(1), bands(...PICKED), expShare(0.5)],
];

function run(mult, growth, killExp, probs, lapse, seed) {
  const rng = makeRng(seed);
  const hpAt = [0, 650];
  for (let i = 2; i <= RUNAWAY_INDEX + 1; i++) hpAt[i] = hpAt[i - 1] * growth(i);
  const streak = Array(N).fill(0), rank = Array(N).fill(0);
  let level, exp, kills, idx, bossHp, resPhys, resMag, hp, runMod, spawnT, runaway;
  const fights = [], deaths = [], levelAt = {};
  let best = 0;
  const maxHp = () => 1250 * 1.06 ** (level - 1) * itemHp(kills);
  const spawn = (t) => {
    const tank = rng() < 0.11 ? 1.5 : 1;
    bossHp = hpAt[idx] * runMod * tank * (1 + (rng() * 2 - 1) * 0.1);
    resPhys = rng() < 0.12 ? resistTier(idx) : resistBase(idx);
    resMag = rng() < 0.12 ? resistTier(idx) : resistBase(idx);
    spawnT = t;
    if (!(idx in levelAt)) levelAt[idx] = level;
  };
  const addExp = (e) => {
    exp += e * (1 + EXP_BONUS);
    let n = 0;
    while (exp >= expToNext(level) && n++ < 2000) { exp -= expToNext(level); level++; }
    if (n) hp = Math.min(maxHp(), hp + 0.2 * n * maxHp());
  };
  const newRun = (t) => { level = 1; exp = 0; kills = 0; idx = 1; runMod = 1 + (rng() * 2 - 1) * 0.1; hp = maxHp(); spawn(t); };
  newRun(0);
  for (let d = 0; d < DAYS && runaway === undefined; d++) {
    if (d % 7 === 6) addExp(Math.max(10, 0.15 * expToNext(level)));
    const order = [...Array(N).keys()].sort(() => rng() - 0.5);
    const missed = [];
    for (let slot = 0; slot < N && runaway === undefined; slot++) {
      const j = order[slot];
      const t = d + slot / N;
      const p = lapse && d >= 150 && d < 157 ? 0.1 : chanceFor(probs, j);
      if (rng() >= p) { missed.push(j); continue; }
      const m = mult(streak[j], rank[j]);
      const mHeal = HEAL_RANK === undefined ? m : 1 + HEAL_RANK * rank[j] + 0.01 * streak[j];
      streak[j]++;
      if (MILESTONE_EXP[streak[j]]) addExp(MILESTONE_EXP[streak[j]]);
      if (DAILY_EXP) addExp((DAILY_EXP * expToNext(level)) / N);
      while (rank[j] < RANK_AT.length && streak[j] >= RANK_AT[rank[j]]) rank[j]++;
      const base = share[TYPES[j]] * 1.06 ** (level - 1);
      if (TYPES[j] === 'heal') { hp = Math.min(maxHp(), hp + base * (1 + 0.6 * (itemDmg(kills) - 1)) * mHeal); continue; }
      let dmg = base * itemDmg(kills) * m * 1.1;
      if (TYPES[j] === 'phys') dmg *= 1 - resPhys;
      if (TYPES[j] === 'mag') dmg *= 1 - resMag;
      bossHp -= dmg;
      while (bossHp <= 0 && runaway === undefined) {
        fights.push({ idx, len: t - spawnT, start: spawnT });
        addExp(killExp(idx, level));
        kills++; idx++; best = Math.max(best, idx);
        if (idx > RUNAWAY_INDEX) runaway = d;
        else spawn(t);
      }
    }
    for (const j of missed) {
      streak[j] = 0;
      hp -= missPct(idx) * 1250 * 1.06 ** (level - 1) * 1.02 * 0.85;
    }
    if (hp <= 0 && runaway === undefined) { deaths.push(d); newRun(d + 1); }
  }
  if (runaway === undefined) fights.push({ idx, len: DAYS - spawnT, start: spawnT }); // the unfinished fight
  return { fights, deaths, best, runaway, levelAt };
}

const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const BANDS = [[10, 19], [20, 29], [30, 39], [40, 59], [60, 99]];

if (process.env.TABLE) {
  // Median level at each boss spawn for the picked variant (recalibrates EXPECTED_LEVEL_BY_BOSS_INDEX),
  // pooled over the decent and good players, plus the boss HP curve itself.
  const growth = bands(...PICKED);
  const res = ['decent', 'good'].flatMap((p) => Array.from({ length: SEEDS }, (_, s) => run(ranked(1), growth, expShare(KILL_SHARE), PLAYERS[p], false, 2000 + s)));
  let hp = 650;
  const hpAt = { 1: 650 };
  for (let i = 2; i <= 100; i++) { hp *= growth(i); hpAt[i] = hp; }
  for (const i of [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100]) {
    const xs = res.map((r) => r.levelAt[i]).filter((x) => x !== undefined);
    console.log(`boss ${String(i).padStart(3)}: level ${xs.length >= 10 ? med(xs) : '-'} (n=${xs.length})  HP ${Math.round(hpAt[i])}  today ${Math.round(650 * 1.27 ** (i - 1))}`);
  }
  process.exit(0);
}

for (const [name, mult, growth, killExp] of SYSTEMS) {
  console.log(`\n== ${name}`);
  console.log('player  deaths best | days/boss at #10-19 20-29 30-39 40-59 60-99 | after day 100 avg/p90 | longest med/max | lvl@20/30/40 | runaway');
  for (const [pname, probs] of Object.entries(PLAYERS)) {
    const res = Array.from({ length: SEEDS }, (_, s) => run(mult, growth, killExp, probs, pname === 'lapse', 1000 + s));
    const all = res.flatMap((r) => r.fights);
    const bands = BANDS.map(([a, b]) => f1(avg(all.filter((f) => f.idx >= a && f.idx <= b).map((f) => f.len))).padStart(5));
    const longest = res.map((r) => Math.max(...r.fights.filter((f) => f.idx >= 10 && (pname !== 'lapse' || f.start + f.len >= 150)).map((f) => f.len), 0));
    const lv = [20, 30, 40].map((i) => { const xs = res.map((r) => r.levelAt[i]).filter((x) => x !== undefined); return xs.length ? String(med(xs)) : '-'; });
    const runaways = res.filter((r) => r.runaway !== undefined);
    const late = all.filter((f) => f.start >= 100 && f.idx >= 10).map((f) => f.len).sort((x, y) => x - y);
    const p90 = late.length ? late[Math.floor(late.length * 0.9)] : NaN;
    console.log(
      `${pname.padEnd(7)} ${f1(avg(res.map((r) => r.deaths.length))).padStart(5)} ${String(med(res.map((r) => r.best))).padStart(4)} |              ${bands.join(' ')} | ${f1(avg(late)).padStart(5)} / ${f1(p90).padStart(5)}         | ${f1(med(longest)).padStart(4)} / ${f1(Math.max(...longest)).padStart(4)} | ${lv.join('/').padEnd(12)} | ${runaways.length ? `${runaways.length}/${SEEDS}, day ${med(runaways.map((r) => r.runaway))}` : ''}`,
    );
  }
}
