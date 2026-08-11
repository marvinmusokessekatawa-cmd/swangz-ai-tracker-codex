const a = require('./' + process.argv[2]), b = require('./' + process.argv[3]);
let diffs = 0;
const show = (label, x, y) => {
  diffs++; console.log('DIFF ' + label);
  x = String(x); y = String(y);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) {
    console.log('   before …' + x.slice(Math.max(0, i - 90), i + 90));
    console.log('   after  …' + y.slice(Math.max(0, i - 90), i + 90)); return;
  }
};
for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
  if (k.startsWith('__')) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) show(k, JSON.stringify(a[k]), JSON.stringify(b[k])); continue; }
  for (const r of Object.keys(a[k] || {})) if ((a[k] || {})[r] !== ((b[k] || {})[r])) show(k + ' › ' + r, a[k][r], (b[k] || {})[r]);
}
console.log(diffs ? '\n' + diffs + ' regions differ' : '\n✅ every captured region is byte-identical before and after');
process.exit(diffs ? 1 : 0);
