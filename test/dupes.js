/* Finds top-level functions declared more than once. The last declaration
   wins at runtime, so every earlier one is dead — but only if nothing calls
   it at the top level before the later block is reached. That is what this
   proves before anything is deleted.
   Run:  node dupes.js          report only
         node dupes.js --write  delete the dead copies */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const APP = process.env.APP_HTML || path.join(process.env.HOME, 'swangz-ai-tracker-redesign', 'index.html');
const src = fs.readFileSync(APP, 'utf8');

/* Locate every inline script block and its offset in the file */
const blocks = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>/gi;
let m;
while ((m = re.exec(src))) {
  const start = m.index + m[0].length;
  const end = src.indexOf('</script>', start);
  if (end === -1) continue;
  blocks.push({ start, end, code: src.slice(start, end) });
}
console.log('inline script blocks:', blocks.map(b => `${b.start}-${b.end}`).join(', '));

/* Parse each and collect top-level declarations plus top-level call sites */
const decls = [];            // {name, blockIdx, absStart, absEnd}
const topLevelCalls = [];    // {name, blockIdx, absStart}

const comments = [];   // {absStart, absEnd} for every comment in every block

blocks.forEach((b, bi) => {
  const cs = [];
  const ast = acorn.parse(b.code, { ecmaVersion: 2022, sourceType: 'script', locations: false,
    onComment: (isBlock, text, start, end) => cs.push({ absStart: b.start + start, absEnd: b.start + end }) });
  comments.push(...cs);
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      decls.push({ name: node.id.name, blockIdx: bi, absStart: b.start + node.start, absEnd: b.start + node.end });
    }
  }
  /* Any call that runs while this block is executing — i.e. not inside a
     function body. Walk statements that are not function declarations. */
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration') continue;
    walk.simple(node, {
      CallExpression(c) {
        const callee = c.callee;
        if (callee.type === 'Identifier') topLevelCalls.push({ name: callee.name, blockIdx: bi, absStart: b.start + c.start });
      },
    }, Object.assign({}, walk.base, {
      /* do not descend into function bodies — those run later, by which
         time every declaration has settled */
      FunctionDeclaration() {}, FunctionExpression() {}, ArrowFunctionExpression() {},
    }));
  }
});

/* A top-level call runs while its own block is still executing, so every
   name it reaches transitively resolves to that block's definitions — a
   later block has not been parsed yet. `boot()` is exactly this case: it is
   called at the top level of block 1 and calls renderProjects(), so block
   1's copy is live, not dead. Expand the closure before judging anything. */
const callsWithin = {};   // name -> Set of identifiers it calls
decls.forEach(d => {
  const body = src.slice(d.absStart, d.absEnd);
  const names = new Set();
  try {
    const fnAst = acorn.parse(body, { ecmaVersion: 2022, sourceType: 'script' });
    walk.simple(fnAst, { CallExpression(c) { if (c.callee.type === 'Identifier') names.add(c.callee.name); } });
  } catch (_) {}
  callsWithin[d.name + '@' + d.blockIdx] = names;
});

function reachableFrom(seedNames, blockIdx) {
  const seen = new Set(), queue = [...seedNames];
  while (queue.length) {
    const n = queue.shift();
    if (seen.has(n)) continue;
    seen.add(n);
    /* resolve against declarations visible while this block runs */
    const target = decls.filter(d => d.name === n && d.blockIdx <= blockIdx).pop();
    if (!target) continue;
    (callsWithin[target.name + '@' + target.blockIdx] || new Set()).forEach(x => queue.push(x));
  }
  return seen;
}

/* Everything reachable while block 0 is still running */
const liveDuringBlock0 = reachableFrom(
  topLevelCalls.filter(c => c.blockIdx === 0).map(c => c.name), 0);
console.log(`names reachable from block 1's top level: ${liveDuringBlock0.size}`);

const byName = {};
decls.forEach(d => (byName[d.name] = byName[d.name] || []).push(d));
const dupes = Object.entries(byName).filter(([, v]) => v.length > 1);

console.log(`\ntop-level declarations: ${decls.length}   duplicated names: ${dupes.length}\n`);

const lineOf = off => src.slice(0, off).split('\n').length;
let unsafe = 0;
const dead = [];

for (const [name, list] of dupes) {
  list.sort((a, b) => a.absStart - b.absStart);
  const winner = list[list.length - 1];
  const losers = list.slice(0, -1);
  /* Is the shadowed copy reachable? Only if something calls this name at the
     top level of a block at or before the loser's block, but before the
     winner is declared. */
  const direct = topLevelCalls.filter(c => c.name === name && c.absStart < winner.absStart);
  const transitive = liveDuringBlock0.has(name) && losers.some(l => l.blockIdx === 0) && winner.blockIdx > 0;
  const risky = direct.length || transitive;
  const flag = risky ? ('  ⚠ KEEP — reachable ' + (direct.length ? 'from a top-level call' : 'from boot() before the later copy exists')) : '';
  if (risky) unsafe++;
  console.log(`  ${name.padEnd(26)} dead: ${losers.map(l => 'L' + lineOf(l.absStart)).join(', ').padEnd(12)}` +
              ` live: L${lineOf(winner.absStart)}${flag}`);
  if (!risky) losers.forEach(l => dead.push({ name, ...l }));
}

const deadLines = dead.reduce((s, d) => s + (src.slice(d.absStart, d.absEnd).split('\n').length), 0);
console.log(`\nsafe to delete: ${dead.length} declarations, ~${deadLines} lines`);
if (unsafe) console.log(`NOT deleting ${unsafe} name(s) that are called before the winner exists.`);

if (process.argv.includes('--write')) {
  /* Delete from the end so earlier offsets stay valid. Take the trailing
     newline with each so no blank gap is left behind. */
  let out = src;
  dead.sort((a, b) => b.absStart - a.absStart);
  for (const d of dead) {
    let end = d.absEnd;
    while (end < out.length && (out[end] === '\n' || out[end] === ' ' || out[end] === '\t')) end++;
    /* Take the comment block that documents this copy with it — identified
       from the parser's own comment tokens, so a `/*` inside a string can
       never be mistaken for one. Walk back over a run of them. */
    let start = d.absStart;
    for (;;) {
      const c = comments.find(c => c.absEnd <= start && /^\s*$/.test(src.slice(c.absEnd, start)));
      if (!c) break;
      start = c.absStart;
    }
    /* keep the indentation of the line the comment starts on */
    while (start > 0 && (out[start - 1] === ' ' || out[start - 1] === '\t')) start--;
    out = out.slice(0, start) + out.slice(end);
  }

  /* Never write something that will not parse. */
  const check = [];
  const re2 = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  let mm;
  while ((mm = re2.exec(out))) {
    const s2 = mm.index + mm[0].length, e2 = out.indexOf('</script>', s2);
    if (e2 > -1) check.push(out.slice(s2, e2));
  }
  try {
    check.forEach(code => acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' }));
  } catch (e) {
    console.error('\nREFUSED TO WRITE — the result does not parse: ' + e.message);
    process.exit(1);
  }
  fs.writeFileSync(APP, out);
  console.log(`\nwritten — ${src.split('\n').length} → ${out.split('\n').length} lines, both blocks parse`);
}
