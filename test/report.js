const { boot } = require('./boot');
(async () => {
  const { run } = await boot();
  run('devBypassSignIn(); adminUnlocked = true; seedDemoData(true); switchView("admin"); setExecPeriod("all");');
  const html = run('execDocBody()');
  // strip tags into readable text, keeping table structure
  const text = String(html)
    .replace(/<\/(tr|h1|h2|h3|p|div|table|section)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/[ \t]+/g, ' ')
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  console.log(text);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
