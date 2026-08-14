/* Real-browser pass: signs in, walks the screens, captures each one and
   reports any console error the app produces along the way.
   Keep every page.evaluate synchronous — a backgrounded tab freezes timers
   and an awaited setTimeout inside evaluate hangs the whole call. */
const puppeteer = require('puppeteer-core');
const path = require('path');

const OUT = process.env.SHOT_DIR || path.join(__dirname, '..', 'shots');
const URL = 'http://127.0.0.1:8000/index.html';

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1440,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 200)); });
  page.on('pageerror', e => problems.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('requestfailed', r => {
    const u = r.url();
    if (/supabase|jsdelivr/.test(u)) return;           // offline by design in preview
    problems.push('request failed: ' + u.slice(0, 120));
  });

  const shot = async (name, note) => {
    await wait(500);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
    console.log('  📸 ' + name + (note ? '  — ' + note : ''));
  };

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(900);
  console.log('\nWalking the app in real Chrome:');
  await shot('01-signin', 'sign-in screen');

  /* Sign in through the preview bypass, exactly as a reviewer would */
  await page.evaluate(() => { devBypassSignIn(); });
  await wait(700);
  await page.evaluate(() => { seedDemoData(true); });
  await wait(700);

  /* The bypass signs in as an owner, so the app routes to the admin gate.
     Drop to the department role the way the preview toolbar does. */
  await page.evaluate(() => {
    /* the first-run tour would cover the card being reviewed */
    try { localStorage.setItem('swangz_tour_done_v1', JSON.stringify(['Production'])); } catch (e) {}
    if (typeof endTour === 'function') endTour();
    togglePreviewAsDept(true); switchView('tools');
  });
  await wait(1200);
  await page.evaluate(() => { if (typeof endTour === 'function') endTour(); });
  await wait(400);
  await shot('02-department', 'department view (status breakdown removed)');
  await page.evaluate(() => { togglePreviewAsDept(false); });
  await wait(600);

  await page.evaluate(() => {
    /* clear the multi-factor gate the way a verified admin would */
    sessionStorage.setItem('swangz_admin_otp_v1', JSON.stringify({
      hash: '', email: currentEmail(), exp: Date.now() + 36e5, tries: 0, verified: true }));
    adminUnlocked = true; switchView('admin'); showAdminContent(); renderAdmin();
  });
  await wait(900);
  await shot('03-admin-overview', 'admin overview');

  /* The registry manager — the screen whose links changed */
  const sections = await page.evaluate(() => {
    /* plant one good and one refused address so both renderings are visible */
    entries.push({ id: 'reg_demo_ok', kind: 'registry', toolName: 'Runway', toolNameRaw: 'Runway',
      officialUrl: 'https://runwayml.com', addedByName: 'Sarah N.',
      submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    entries.push({ id: 'reg_demo_bad', kind: 'registry', toolName: 'Suspicious Entry', toolNameRaw: 'Suspicious Entry',
      officialUrl: "javascript:alert('x')", addedByName: 'anonymous request',
      submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    saveEntries && saveEntries();
    showAdminSection('acc_registry');
    renderRegistryManager();
    return [...document.querySelectorAll('#adminNav button[data-sec]')].map(b => b.dataset.sec);
  });
  await wait(800);
  await shot('04-registry', 'registry — good link vs refused address');

  /* The executive briefing, cumulative — the wording that was fixed */
  await page.evaluate(() => { showAdminSection('acc_exec'); setExecPeriod('all'); openExecBriefing(); });
  await wait(1400);
  await shot('05-briefing-all', 'briefing, everything to date');

  await page.evaluate(() => { setExecPeriod('this-month'); });
  await wait(1200);
  await shot('06-briefing-month', 'briefing, this month');

  /* A couple of tiles side by side — the Deck is the app's signature */
  await page.evaluate(() => {
    DECK.closeAll(true);
    const g = _toolGroups(filteredEntries())[0];
    if (g) { DECK.open('tool', g.key); DECK.open('toolNumbers', g.key); }
    const e = entries.find(x => x.tag !== 'request' && x.kind !== 'registry');
    if (e) DECK.open('entry', e.id);
  });
  await wait(1000);
  await shot('07-deck-tiles', 'three tiles open at once');

  /* Money & pricing, admin-only */
  await page.evaluate(() => { DECK.closeAll(true); showAdminSection('acc_money'); });
  await wait(900);
  await shot('08-money', 'money & pricing');

  /* Phone */
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => { DECK.closeAll(true); switchView('tools'); });
  await wait(900);
  await shot('09-phone-department', 'phone, department view');
  await page.evaluate(() => { switchView('admin'); });
  await wait(900);
  await shot('10-phone-admin', 'phone, admin');

  console.log('\nadmin sections found: ' + sections.length);
  console.log(problems.length ? '\n⚠  problems in the real browser:' : '\n✅ no console error, no page error, no failed request');
  problems.slice(0, 12).forEach(p => console.log('   • ' + p));
  await browser.close();
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
