/* Static audit: things that are wrong in the source regardless of what any
   one run does — duplicate ids, handlers naming functions that do not exist,
   page-freezing dialogs, and leftovers of removed features. */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const APP = process.env.APP_HTML || path.join(process.env.HOME, 'swangz-ai-tracker-redesign', 'index.html');
const src = fs.readFileSync(APP, 'utf8');
const lineOf = off => src.slice(0, off).split('\n').length;
let problems = 0;
const report = (title, items, fmt) => {
  if (!items.length) { console.log(`  ✓ ${title}`); return; }
  problems += items.length;
  console.log(`  ✗ ${title} — ${items.length}`);
  items.slice(0, 12).forEach(i => console.log('      ' + (fmt ? fmt(i) : i)));
  if (items.length > 12) console.log(`      … and ${items.length - 12} more`);
};

/* ---- script blocks + declared names ---------------------------------- */
const blocks = [];
{
  const re = /<script(?![^>]*\bsrc=)[^>]*>/gi; let m;
  while ((m = re.exec(src))) {
    const s = m.index + m[0].length, e = src.indexOf('</script>', s);
    if (e > -1) blocks.push({ start: s, code: src.slice(s, e) });
  }
}
const declared = new Set();
blocks.forEach(b => {
  const ast = acorn.parse(b.code, { ecmaVersion: 2022, sourceType: 'script' });
  for (const n of ast.body) {
    if (n.type === 'FunctionDeclaration' && n.id) declared.add(n.id.name);
    if (n.type === 'VariableDeclaration') n.declarations.forEach(d => { if (d.id.type === 'Identifier') declared.add(d.id.name); });
    /* window.foo = function … */
    if (n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression') {
      const l = n.expression.left;
      if (l.type === 'MemberExpression' && l.object.name === 'window' && l.property.name) declared.add(l.property.name);
    }
  }
  /* anything assigned to window anywhere, including inside IIFEs */
  walk.simple(ast, {
    AssignmentExpression(a) {
      const l = a.left;
      if (l.type === 'MemberExpression' && l.object && l.object.name === 'window' && l.property && l.property.name) declared.add(l.property.name);
    },
    FunctionDeclaration(f) { if (f.id) declared.add(f.id.name); },
  });
});

console.log('\nSTATIC AUDIT');
console.log(`  (${declared.size} names declared across ${blocks.length} script blocks)\n`);

/* ---- 1. duplicate element ids in the static markup ------------------- */
{
  const head = src.slice(0, blocks[0] ? blocks[0].start : src.length);
  const seen = {}, dup = [];
  const re = /\sid="([^"]+)"/g; let m;
  while ((m = re.exec(head))) {
    if (seen[m[1]] !== undefined) dup.push(`${m[1]} — L${lineOf(seen[m[1]])} and L${lineOf(m.index)}`);
    else seen[m[1]] = m.index;
  }
  report('no duplicate element id in the page markup', dup);
}

/* ---- 2. handlers that interpolate into a quoted JS literal ----------- */
{
  /* A handler built by string interpolation cannot be parsed from source —
     suite.js checks the rendered ones in a live DOM. What CAN be judged
     here is the shape: a value dropped inside a single-quoted argument is
     the pattern that let a stored URL close the string and run. */
  const bad = [];
  const re = /\son[a-z]+="[^"]*?[A-Za-z_$.]+\((?:[^"]*?,)?'(?:\$\{|'\s*\+)/gi;
  let m;
  while ((m = re.exec(src))) bad.push(`${m[0].slice(0, 70)} @L${lineOf(m.index)}`);
  report('no handler interpolates a value into a quoted JS literal', bad);
}

/* ---- 3. page-freezing native dialogs --------------------------------- */
{
  const hits = [];
  blocks.forEach(b => {
    const ast = acorn.parse(b.code, { ecmaVersion: 2022 });
    walk.simple(ast, { CallExpression(c) {
      const n = c.callee.type === 'Identifier' ? c.callee.name
              : (c.callee.type === 'MemberExpression' && c.callee.object.name === 'window' ? c.callee.property.name : null);
      if (n === 'confirm' || n === 'prompt' || n === 'alert') hits.push(`${n}() @L${lineOf(b.start + c.start)}`);
    }});
  });
  report('no native confirm/prompt/alert freezes the page', hits);
}

/* ---- 4. every href built in JS goes through safeUrl ------------------ */
{
  const bad = [];
  const re = /href="(?:'\s*\+|\$\{)/g;
  let m;
  while ((m = re.exec(src))) {
    /* safeUrl may sit on the value, on the line above, or in the variable —
       look at the surrounding statement rather than the character after. */
    const around = src.slice(Math.max(0, m.index - 400), m.index + 400);
    if (!/safeUrl|urlCellHTML/.test(around)) bad.push(`${src.slice(m.index, m.index + 60)} @L${lineOf(m.index)}`);
  }
  report('every dynamically built href is routed through safeUrl', bad);
}

/* ---- 5. leftovers of things that were removed ------------------------ */
{
  const orphans = [];
  const removed = ['deptStatusRings', 'deptTrendChart'];
  removed.forEach(id => {
    const inMarkup = new RegExp(`id="${id}"`).test(src);
    const referenced = new RegExp(`getElementById\\(['"]${id}['"]\\)`).test(src);
    if (!inMarkup && referenced) orphans.push(`${id}: referenced in JS but no longer in the markup`);
  });
  /* CSS for elements that no longer exist anywhere */
  ['.rings-row', '.ring-num', '.ring-lbl'].forEach(sel => {
    const cls = sel.slice(1);
    const styled = new RegExp(`\\.${cls}\\b`).test(src);
    const used = new RegExp(`class="[^"]*\\b${cls}\\b`).test(src) || new RegExp(`'${cls}`).test(src) || new RegExp(`"${cls}`).test(src);
    if (styled && !used) orphans.push(`${sel}: styled but nothing carries the class`);
  });
  report('no orphaned ids or dead style rules from removed features', orphans);
}

/* ---- 6. the go-live checklist ---------------------------------------- */
{
  const notes = [];
  if (/const OTP_ENDPOINT = ''/.test(src)) notes.push("OTP_ENDPOINT is empty — the admin's second factor is not delivered by email");
  const m = src.match(/const PREVIEW_BYPASS_HOSTS = \[([\s\S]*?)\]/);
  if (m && m[1].trim()) notes.push('PREVIEW_BYPASS_HOSTS still lists: ' + (m[1].match(/'[^']+'/g) || []).join(', '));
  report('nothing preview-only is left switched on for the live site', notes);
}

console.log(problems ? `\n${problems} finding(s).` : '\nNothing found.');
