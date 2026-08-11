/* Real-browser sweep: every admin section and every tile, at desktop and
   phone width, in both roles — collecting console errors and layout faults
   that jsdom cannot see. */
const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const problems = [];
  page.on('console', m => { if (m.type() === 'error' && !/401|supabase/i.test(m.text())) problems.push('console: ' + m.text().slice(0, 160)); });
  page.on('pageerror', e => problems.push('pageerror: ' + String(e.message).slice(0, 160)));

  await page.goto('http://127.0.0.1:8000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1200);
  await page.evaluate(() => {
    devBypassSignIn(); seedDemoData(true);
    try { localStorage.setItem('swangz_tour_done_v1', JSON.stringify(['Production'])); } catch (e) {}
    sessionStorage.setItem('swangz_admin_otp_v1', JSON.stringify({ hash: '', email: currentEmail(), exp: Date.now() + 36e5, tries: 0, verified: true }));
    adminUnlocked = true;
  });
  await wait(600);

  /* ---- every admin section ---- */
  const sections = await page.evaluate(() => {
    switchView('admin'); showAdminContent(); renderAdmin();
    return [...document.querySelectorAll('#adminNav button[data-sec], #adminNav [data-sec]')].map(b => b.dataset.sec);
  });
  console.log(`\nsweeping ${sections.length} admin sections…`);
  const overflow = [];
  for (const sec of sections) {
    await page.evaluate(s => { DECK.closeAll(true); showAdminSection(s); }, sec);
    await wait(260);
    const o = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      empty: !document.getElementById('adminContent') || document.getElementById('adminContent').textContent.trim().length < 5,
    }));
    if (o.scrollW > o.clientW + 2) overflow.push(`${sec}: page scrolls sideways (${o.scrollW} > ${o.clientW})`);
    if (o.empty) problems.push(`admin section "${sec}" rendered nothing`);
  }

  /* ---- every tile, opened in the browser ---- */
  const tileErrs = await page.evaluate(() => {
    const KINDS = ['overview','tool','toolStory','toolNumbers','toolDepts','toolUses','toolSubs','money',
      'toolPricing','mail','execdoc','docview','sheetview','project','saved','reassign','regedit',
      'entry','entryCase','entryEffort','entryProjects','decide','entryDocs','finding','deptAnalysis',
      'filters','businessPart','sectionMap','submissionDoc','profile','settings'];
    const groups = _toolGroups(filteredEntries());
    const gk = groups.length ? groups[0].key : '';
    const rep = entries.find(e => e.tag !== 'request' && e.kind !== 'registry') || {};
    const req = entries.find(e => e.tag === 'request') || {};
    const A = { overview:0, tool:gk, toolStory:gk, toolNumbers:gk, toolDepts:gk, toolUses:gk, toolSubs:gk,
      money:rep.id, toolPricing:gk, mail:rep.id, project:rep.id, saved:{title:'S',body:'b'},
      reassign:rep.id, regedit:'https://example.com', entry:rep.id, entryCase:rep.id, entryEffort:rep.id,
      entryProjects:rep.id, decide:req.id||rep.id, entryDocs:rep.id, finding:{s:'',i:0},
      deptAnalysis:(rep.department||'Production'), businessPart:(typeof BUSINESS_PARTS!=='undefined'&&BUSINESS_PARTS[0]?BUSINESS_PARTS[0].key:''),
      submissionDoc:rep.id };
    const out = [];
    KINDS.forEach(k => { try { DECK.closeAll(true); DECK.open(k, A[k]); } catch (e) { out.push(k + ': ' + e.message); } });
    DECK.closeAll(true);
    return out;
  });
  tileErrs.forEach(t => problems.push('tile ' + t));

  /* ---- phone width, both roles ---- */
  await page.setViewport({ width: 390, height: 844 });
  for (const [label, setup] of [
    ['phone department', () => { sessionStorage.setItem('swangz_preview_as_dept','1'); switchView('tools'); }],
    ['phone admin', () => { sessionStorage.setItem('swangz_preview_as_dept','0'); switchView('admin'); renderAdmin(); }],
  ]) {
    await page.evaluate(setup);
    await wait(700);
    const o = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    if (o.s > o.c + 2) overflow.push(`${label}: page scrolls sideways (${o.s} > ${o.c})`);
  }

  console.log(overflow.length ? '\n⚠ layout:' : '\n✓ no sideways scroll at desktop or phone width');
  overflow.forEach(o => console.log('   • ' + o));
  console.log(problems.length ? '\n⚠ runtime:' : '✓ no console error or page error anywhere in the sweep');
  [...new Set(problems)].slice(0, 15).forEach(p => console.log('   • ' + p));

  await browser.close();
  process.exit(problems.length + overflow.length ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
