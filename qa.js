/* ============================================================================
   qa.js — QA harness for Quick Lane (see BUILD_PROMPT §10)
   Extracts the <script> from index.html, exposes internals via an appended
   epilogue, runs it in a vm with a stubbed DOM, then asserts:
     1. node --check on the extracted script
     2. data integrity
     3. profanity filter (incl. leetspeak)
     4. unit tests (travel/rent/clampHappy/interest/careerLv)
     5. ~250 greedy-AI simulations per mode x difficulty + race-quality targets
   Exit code 0 = all green, 1 = any failure.
   ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = __dirname;
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const RUNS = parseInt(process.env.RUNS || '1', 10);
const N = parseInt(process.env.SIMS || '250', 10);   // playthroughs per cell
const MAX_TURNS = 90;

/* ---------- tiny test framework ---------- */
let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) {
  if (cond) { pass++; }
  else { fail++; fails.push(label); console.log('  ✗ ' + label); }
}
function section(t) { console.log('\n— ' + t); }

/* ---------- extract the (longest) <script> block ---------- */
function extractScript(html) {
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m, best = '';
  while ((m = re.exec(html)) !== null) if (m[1].length > best.length) best = m[1];
  return best;
}
const SCRIPT = extractScript(HTML);
if (!SCRIPT || SCRIPT.length < 1000) { console.error('Could not extract game script from index.html'); process.exit(1); }

/* ============================ 1. node --check ============================= */
section('node --check on extracted script');
const tmp = path.join(os.tmpdir(), 'quicklane-extracted-' + process.pid + '.js');
fs.writeFileSync(tmp, SCRIPT, 'utf8');
try {
  cp.execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
  ok(true, 'extracted script passes node --check');
} catch (e) {
  ok(false, 'extracted script passes node --check\n' + (e.stderr ? e.stderr.toString() : e.message));
} finally {
  try { fs.unlinkSync(tmp); } catch (e) {}
}

/* ============================ build sandbox ============================== */
function makeEl() {
  const el = {
    innerHTML: '', textContent: '', value: '', className: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, removeChild() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {},
  };
  // accept assignment to event handler props without throwing
  ['onclick', 'oninput', 'onkeydown'].forEach(k => { el[k] = null; });
  return el;
}
const elCache = {};
const documentStub = {
  getElementById(id) { return elCache[id] || (elCache[id] = makeEl()); },
  querySelector() { return makeEl(); },
  querySelectorAll() { return []; },
  createElement() { return makeEl(); },
  body: { classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {} },
  documentElement: { setAttribute() {} },
};
const windowStub = {}; // intentionally no speechSynthesis / matchMedia -> guards skip

const EPILOGUE = `
;globalThis.__QA = {
  newGame, getS: () => S, setRNG: (f) => { RNG = f; },
  travelCost, rentDue, clampHappy, careerLv, wage, net, goalsMet, prog,
  jonesAdvance, jonesDone, jonesOverall, stepEndTurn, eligibleJob, houseCap, setHappy,
  actTravel, actWork, actStudy, actEat, actGroceries, actApply, actBuyCloth,
  actUpgradeHouse, actMood, actSellGood, actBank, canWork,
  DIFF_ADULT, DIFF_KID, NODES, NODE, NODE_POS, HUB, JOBS_ADULT, JOBS_KID,
  HOUSES, CLOTH, LOOKS, DEFAULT_NAMES, ECON, JONES_TURNS, NODE_DESC,
  isProfane, cleanName, normName, jobsFor, jobName, curJob, diffTable, price, rerollPrices,
};
`;

const sandbox = {
  document: documentStub, window: windowStub,
  console: { log() {}, warn() {}, error() {} },
  Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
};
sandbox.globalThis = sandbox;
try {
  vm.createContext(sandbox);
  vm.runInContext(SCRIPT + EPILOGUE, sandbox, { filename: 'index.html#script' });
} catch (e) {
  console.error('Script threw while loading in vm:\n', e);
  process.exit(1);
}
const api = sandbox.__QA;
if (!api) { console.error('Epilogue did not expose __QA'); process.exit(1); }

/* ============================ 2. data integrity ========================== */
section('Data integrity');
(() => {
  const nodeIds = new Set(api.NODES.map(n => n.id));
  // jobs employers are real nodes
  let allEmp = true;
  for (const j of api.JOBS_ADULT) if (!nodeIds.has(j.emp)) allEmp = false;
  for (const j of api.JOBS_KID) if (!nodeIds.has(j.emp)) allEmp = false;
  ok(allEmp, 'every job employer is a real map node');

  // every node has a panel/description and vice-versa (both languages)
  const descEn = Object.keys(api.NODE_DESC.en).sort().join(',');
  const descHe = Object.keys(api.NODE_DESC.he).sort().join(',');
  const ids = [...nodeIds].sort().join(',');
  ok(descEn === ids, 'every node has an EN description and vice-versa');
  ok(descHe === ids, 'every node has a HE description and vice-versa');

  // 4 diverse looks per gender
  ok(['man', 'woman', 'boy', 'girl'].every(g => api.LOOKS[g] && api.LOOKS[g].length === 4),
    '4 looks per gender');

  // default names pass the filter
  ok(Object.values(api.DEFAULT_NAMES).every(n => !api.isProfane(n) && api.cleanName(n, 'X') !== null),
    'default names pass the profanity filter');

  // every difficulty's career goal is reachable
  function careerReachable(jobs, goal, maxCloth) {
    return jobs.some(j => (j.lv + 2) >= goal.career && j.cloth <= maxCloth);
  }
  let reach = true;
  for (const k of ['easy', 'normal', 'hard']) {
    if (!careerReachable(api.JOBS_ADULT, api.DIFF_ADULT[k].goal, 3)) reach = false;
    if (!careerReachable(api.JOBS_KID, api.DIFF_KID[k].goal, 0)) reach = false;
  }
  ok(reach, 'career goal reachable at every difficulty');

  // time + rent constraints
  ok(['easy', 'normal', 'hard'].every(k => api.DIFF_ADULT[k].time === 60), 'adult time = 60');
  ok(['easy', 'normal', 'hard'].every(k => api.DIFF_KID[k].time === 24), 'kid time = 24');
  ok(api.HOUSES[0].rent > 0, 'adult rent > 0');
  ok(api.rentDue(4, 'kid') === false && api.rentDue(8, 'kid') === false, 'kids never pay rent');
})();

/* ============================ 3. profanity =============================== */
section('Profanity filter');
(() => {
  const clean = ['Lior', 'Avigail', 'בארי', 'נטע', 'Sarah', 'Cassie', 'Assaf'];
  clean.forEach(nm => ok(!api.isProfane(nm) && api.cleanName(nm, 'X') !== null, `accepts clean name: ${nm}`));
  ok(api.cleanName('', 'Default') === 'Default', 'empty name -> default');

  const bad = ['b1tch', 'a$$hole', 'n1gger', 'p0rn', 'fuck', 'זונה', 'שרמוטה', 'בנזונה'];
  bad.forEach(nm => ok(api.isProfane(nm) && api.cleanName(nm, 'X') === null, `blocks offensive: ${nm}`));

  // must NOT over-block names that merely contain "ass"
  ok(!api.isProfane('Cassie') && !api.isProfane('Assaf'), 'does not over-block ass-containing real names');
  // accepted names are stripped of angle/amp
  ok(api.cleanName('Li<o>r', 'X') === 'Lior', 'strips < > & from accepted names');
})();

/* ============================ 4. unit tests ============================= */
section('Unit tests');
(() => {
  // travel
  ok(api.travelCost('bank', 'bank', 'adult') === 0, 'travelCost(same) = 0');
  ok(api.travelCost('bank', 'uni', 'adult') >= 1, 'travelCost(distinct) >= 1');
  const pairs = [['bank', 'uni'], ['home', 'factory'], ['socket', 'park'], ['burger', 'club']];
  ok(pairs.every(([a, b]) => api.travelCost(a, b, 'adult') === api.travelCost(b, a, 'adult')), 'travelCost symmetric');
  ok(pairs.every(([a, b]) => api.travelCost(a, b, 'kid') <= api.travelCost(a, b, 'adult')), 'travelCost kid <= adult');

  // rent timing
  ok(api.rentDue(4, 'adult') && api.rentDue(8, 'adult') && api.rentDue(12, 'adult'), 'adult rent charged on week%4===0');
  ok(!api.rentDue(1, 'adult') && !api.rentDue(2, 'adult') && !api.rentDue(3, 'adult') && !api.rentDue(5, 'adult'), 'adult rent not charged off-month');

  // clampHappy respects house cap
  api.newGame('adult', 'normal');
  let S = api.getS();
  api.setHappy(999); ok(S.happy === 75, 'clampHappy capped at Rent-A-Room cap (75)');
  S.house = 1; api.setHappy(999); ok(S.happy === 100, 'clampHappy lifts to 100 after Apartment');
  api.newGame('kid', 'normal'); S = api.getS();
  api.setHappy(999); ok(S.happy === 100, 'kid happiness cap = 100');

  // bank interest: adult earns, kid does not
  api.newGame('adult', 'easy'); S = api.getS();
  S.bank = 1000; S.loan = 0; S.week = 1; S.cash = 100;
  api.stepEndTurn();
  ok(S.bank > 1000, 'adult bank earns interest');
  api.newGame('kid', 'easy'); S = api.getS();
  S.bank = 1000; S.week = 1;
  api.stepEndTurn();
  ok(S.bank === 1000, 'kid bank earns no interest');

  // careerLv = job.lv + rank
  api.newGame('adult', 'normal'); S = api.getS();
  S.jobIdx = 8; S.rank = 2; // Professor lv6
  ok(api.careerLv() === 8, 'careerLv = job.lv + rank');
  S.jobIdx = -1; ok(api.careerLv() === 0, 'unemployed careerLv = 0');
})();

/* ============================ 5. simulations ============================ */
/* Greedy-AI driver — location-batched. Each turn: keep fed, get/upgrade the
   job, study + buy clothes toward the next job, upgrade housing for the
   happiness cap, work the bulk of the week, and (when only happiness remains)
   spend a turn topping it up. Happiness is filled LAST because working lowers
   it, so it must be at goal when the end-of-turn win check fires. */
function travelTo(node, reserveH) {
  const S = api.getS();
  if (S.pos === node) return S.hours >= (reserveH || 0);
  const c = api.travelCost(S.pos, node, S.mode);
  if (S.hours < c + (reserveH || 0)) return false;
  return api.actTravel(node) !== null;
}
function bestEligibleJob() {
  const S = api.getS(), jobs = api.jobsFor(S.mode);
  let best = -1, score = -1;
  for (let i = 0; i < jobs.length; i++) {
    if (!api.eligibleJob(i)) continue;
    const s = jobs[i].lv * 1000 + jobs[i].wage;
    if (s > score) { score = s; best = i; }
  }
  return best;
}
function targetClothTier() {
  const S = api.getS();
  if (S.mode === 'kid') return 0;
  const jobs = api.jobsFor(S.mode), cur = api.curJob(), curLv = cur ? cur.lv : 0;
  let want = S.cloth;
  for (const j of jobs) if (S.edu >= j.edu && j.lv > curLv) want = Math.max(want, j.cloth);
  return want;
}
function applyBest() {
  const S = api.getS();
  const best = bestEligibleJob();
  if (best >= 0 && (S.jobIdx < 0 || api.jobsFor(S.mode)[best].lv > api.careerLv()))
    if (travelTo('emp', api.ECON[S.mode].buyH)) api.actApply(best);
}
function studyBatch() {
  const S = api.getS(), e = api.ECON[S.mode];
  if (S.edu >= S.goal.edu || S.cash < e.course) return;
  if (!travelTo('uni', e.studyH)) return;
  while (S.edu < S.goal.edu && S.cash >= e.course && S.hours >= e.studyH)
    if (api.actStudy() === null) break;
}
function clothBatch() {
  const S = api.getS(), e = api.ECON[S.mode];
  if (S.mode === 'kid' || targetClothTier() <= S.cloth) return;
  if (S.cash < api.price(api.CLOTH[S.cloth + 1].price)) return;
  if (!travelTo('zmart', e.buyH)) return;
  while (targetClothTier() > S.cloth && S.hours >= e.buyH &&
         S.cash >= api.price(api.CLOTH[S.cloth + 1].price))
    if (api.actBuyCloth(S.cloth + 1) === null) break;
}
function houseUpgrade() {
  const S = api.getS(), e = api.ECON[S.mode];
  if (S.mode === 'kid' || S.house >= 2 || api.houseCap() >= S.goal.happy) return;
  const need = api.HOUSES[S.house + 1].dep;
  if (S.cash > need + 250 && travelTo('home', e.buyH)) api.actUpgradeHouse(S.house + 1);
}
function workBatch(reserveH) {
  const S = api.getS(), e = api.ECON[S.mode], j = api.curJob();
  if (!j || !travelTo(j.emp, e.workH)) return;
  while (S.hours - e.workH >= (reserveH || 0))
    if (api.actWork() === null) break;
}
function happinessPush() {
  // Reach the happiness goal while keeping net wealth >= goal. Free rest first
  // (no cash), then paid mood items only if the wealth goal still holds.
  const S = api.getS(), e = api.ECON[S.mode], goal = S.goal;
  let guard = 0;
  while (S.happy < goal.happy && guard++ < 40) {
    if (S.hours >= e.restH && travelTo('home', e.restH) && api.actMood('rest') !== null) continue;
    const buyOK = cost => api.net() - cost >= goal.wealth && S.hours >= e.buyH;
    if (S.mode !== 'kid' && buyOK(api.price(e.electronics.cost)) &&
        travelTo('socket', e.buyH) && api.actMood('electronics') !== null) continue;
    if (buyOK(api.price(e.appliance.cost)) &&
        travelTo('zmart', e.buyH) && api.actMood('appliance') !== null) continue;
    break;
  }
}
function aiTurn() {
  const S = api.getS(), e = api.ECON[S.mode], goal = S.goal;
  // 1. keep fed (proactively, before hunger bites)
  if (S.food < e.lowFood + e.foodDecay && travelTo('burger', e.eatH)) api.actEat();
  // 2. job qualification chain — each location visited at most once
  applyBest(); studyBatch(); clothBatch(); applyBest(); houseUpgrade();
  if (api.goalsMet()) return;                 // don't work (work lowers happy)
  // 3. end-game: if only happiness remains, spend the rest of the turn on it
  const wealthMet = api.net() >= goal.wealth, eduMet = S.edu >= goal.edu, carMet = api.careerLv() >= goal.career;
  if (wealthMet && eduMet && carMet && S.happy < goal.happy && api.houseCap() >= goal.happy) {
    happinessPush(); return;
  }
  // 4. otherwise work the bulk of the week for wealth
  workBatch(0);
}
function simulate(mode, diffKey) {
  api.newGame(mode, diffKey);
  const S = api.getS();
  for (let t = 0; t < MAX_TURNS; t++) {
    aiTurn();
    if (api.goalsMet()) return { outcome: 'win', weeks: S.week, jones: api.jonesOverall() };
    api.stepEndTurn();
    if (S.over === 'win') return { outcome: 'win', weeks: S.week, jones: api.jonesOverall() };
    if (S.over === 'lose') return { outcome: 'loss', weeks: S.week, jones: api.jonesOverall() };
  }
  return { outcome: 'timeout', weeks: S.week, jones: api.jonesOverall() };
}
function runCell(mode, diffKey) {
  let win = 0, loss = 0, timeout = 0, weeksSum = 0, jonesSum = 0, exc = 0;
  for (let i = 0; i < N; i++) {
    let r;
    try { r = simulate(mode, diffKey); } catch (e) { exc++; continue; }
    if (r.outcome === 'win') { win++; weeksSum += r.weeks; jonesSum += r.jones; }
    else if (r.outcome === 'loss') loss++;
    else timeout++;
  }
  return {
    winPct: win / N * 100, lossPct: loss / N * 100, timeoutPct: timeout / N * 100,
    avgWeeks: win ? weeksSum / win : 0, avgJones: win ? jonesSum / win * 100 : 0, exc,
  };
}

/* race-quality targets (BUILD_PROMPT §10) */
const TARGETS = {
  adult: {
    easy:   { win: [90, 100], loss: [0, 15],  weeks: 4, jones: 20 },
    normal: { win: [70, 100], loss: [0, 40],  weeks: 5, jones: 55 },
    hard:   { win: [25, 82],  loss: [18, 80], weeks: 6, jones: 70 },
  },
};
function pct(x) { return x.toFixed(0).padStart(3) + '%'; }
function assertAdult(diffKey, r) {
  const t = TARGETS.adult[diffKey];
  ok(r.exc === 0, `adult/${diffKey}: no exceptions`);
  ok(r.winPct >= t.win[0] && r.winPct <= t.win[1], `adult/${diffKey}: win ${pct(r.winPct)} in [${t.win[0]},${t.win[1]}]`);
  ok(r.lossPct >= t.loss[0] && r.lossPct <= t.loss[1], `adult/${diffKey}: loss ${pct(r.lossPct)} in [${t.loss[0]},${t.loss[1]}]`);
  ok(r.avgWeeks >= t.weeks, `adult/${diffKey}: avg weeks-to-win ${r.avgWeeks.toFixed(1)} >= ${t.weeks}`);
  ok(r.avgJones >= t.jones, `adult/${diffKey}: Jones@win ${r.avgJones.toFixed(0)}% >= ${t.jones}%`);
}
function assertKid(diffKey, r) {
  ok(r.exc === 0, `kid/${diffKey}: no exceptions`);
  ok(r.lossPct === 0, `kid/${diffKey}: never loses (loss ${pct(r.lossPct)})`);
  ok(r.winPct >= 85, `kid/${diffKey}: winnable ${pct(r.winPct)} >= 85%`);
}

for (let run = 1; run <= RUNS; run++) {
  section(`Simulations — run ${run}/${RUNS} (${N} playthroughs/cell)`);
  console.log('  mode/diff      win   loss  t/o   wks  Jones@win');
  for (const mode of ['adult', 'kid']) {
    for (const diffKey of ['easy', 'normal', 'hard']) {
      const r = runCell(mode, diffKey);
      console.log(`  ${(mode + '/' + diffKey).padEnd(13)} ${pct(r.winPct)} ${pct(r.lossPct)} ${pct(r.timeoutPct)} ${r.avgWeeks.toFixed(1).padStart(4)}  ${r.avgJones.toFixed(0).padStart(3)}%  ${r.exc ? '(' + r.exc + ' exc)' : ''}`);
      if (mode === 'adult') assertAdult(diffKey, r); else assertKid(diffKey, r);
    }
  }
}

/* ============================ summary ============================ */
console.log('\n' + '='.repeat(48));
if (fail === 0) {
  console.log(`✅ ALL GREEN — ${pass} checks passed`);
  process.exit(0);
} else {
  console.log(`❌ ${fail} FAILED, ${pass} passed`);
  console.log('Failed:\n  - ' + fails.join('\n  - '));
  process.exit(1);
}
