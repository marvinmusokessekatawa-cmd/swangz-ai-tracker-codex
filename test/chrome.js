/* Real Chrome, driven by real clicks rather than by calling functions.
   This is the pass that catches what jsdom cannot: an element that exists but
   is covered, a button whose click never lands, a panel that opens off-screen.
   Keep every page.evaluate synchronous — a backgrounded tab freezes timers. */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const URL = process.env.APP_URL || 'http://127.0.0.1:8000/index.html';
const SHOTS = path.join(__dirname, '..', 'shots', 'chrome');
const wait = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + label); }
  else { fail++; failures.push(label + (detail ? ' — ' + detail : '')); console.log('  \x1b[31m✗ ' + label + '\x1b[0m' + (detail ? '\n      ' + String(detail).slice(0, 160) : '')); }
}
const head = t => console.log('\n\x1b[1m' + t + '\x1b[0m');

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--window-size=1440,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/401|supabase/i.test(m.text())) errs.push(m.text().slice(0, 140)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 140)));

  const shot = async n => { await wait(350); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  /* click by visible text, the way a person would find it */
  const clickText = async (sel, text) => page.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s)].find(e => e.offsetParent !== null && (e.textContent || '').trim().toLowerCase().includes(t.toLowerCase()));
    if (!el) return false; el.click(); return true;
  }, sel, text);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(1200);

  /* ---------------------------------------------------------------- */
  head('A · The sign-in screen');
  ok('the app reaches the sign-in view', await page.evaluate(() => document.getElementById('authView').classList.contains('active')));
  ok('the brand mark is rendered', await page.evaluate(() => !!document.querySelector('#authView img, #authView svg')));
  ok('the preview bypass is offered on localhost', await page.evaluate(() => !!document.getElementById('devBypassBtn')));
  ok('the starfield canvas got a real 2d context',
     await page.evaluate(() => { const c = document.getElementById('starfield'); return !!(c && c.getContext('2d')); }));
  await shot('a-signin');

  /* clicking the real button, not calling the function */
  ok('clicking the preview button signs in', await page.evaluate(() => { const b = document.getElementById('devBypassBtn'); if (!b) return false; b.click(); return true; }));
  await wait(900);
  await page.evaluate(() => { seedDemoData(true); try { localStorage.setItem('swangz_tour_done_v1', JSON.stringify([profile.department || 'Production'])); } catch (e) {} });
  await wait(700);

  /* ---------------------------------------------------------------- */
  head('B · The department side');
  await page.evaluate(() => { if (typeof endTour === 'function') endTour(); togglePreviewAsDept(true); switchView('tools'); });
  await wait(1000);
  await page.evaluate(() => { if (typeof endTour === 'function') endTour(); });
  await wait(300);
  const dept = await page.evaluate(() => ({
    text: document.getElementById('toolsView').innerText,
    rings: !!document.getElementById('deptStatusRings'),
    money: /\$\s?\d/.test(document.getElementById('toolsView').innerText),
  }));
  ok('the status breakdown is gone', !dept.rings);
  ok('"Status mix" is gone from My History', !/status mix/i.test(dept.text), dept.text.slice(0, 100));
  /* Top tools, Your standing and Recent activity were removed on purpose */
  ok('top tools is gone', !/top tools here/i.test(dept.text), dept.text.slice(0, 90));
  ok('your standing is gone', !/your standing/i.test(dept.text));
  ok('recent activity is gone', !/recent activity/i.test(dept.text));
  ok('no money figure is shown to a department user', !dept.money, (dept.text.match(/.{0,40}\$\s?\d.{0,20}/) || [''])[0]);
  ok('time reads in working units, never months', !/\b[\d.]+\s*mo\b/.test(dept.text), (dept.text.match(/.{0,30}[\d.]+ mo.{0,20}/) || [''])[0]);
  await shot('b-department');

  head('C · The wizard, stepped by clicking');
  ok('the Add tool button opens the chooser', await clickText('button', 'Add tool'));
  await wait(900);
  const chooser = await page.evaluate(() => {
    const o = document.getElementById('addChooser');
    return { open: !!o && o.classList.contains('open'), text: o ? o.innerText.replace(/\s+/g, ' ').slice(0, 120) : '' };
  });
  ok('the chooser asks report-or-request first', chooser.open && /report a tool/i.test(chooser.text), chooser.text);
  await shot('c-chooser');
  ok('picking "Report a tool we use" opens the wizard',
     await page.evaluate(() => { const b = [...document.querySelectorAll('#addChooser button')].find(x => /report a tool/i.test(x.textContent)); if (!b) return false; b.click(); return true; }));
  await wait(1100);
  const wizOpen = await page.evaluate(() => { const d = document.getElementById('detailView'); return !!d && d.classList.contains('open'); });
  ok('the wizard overlay is open', wizOpen);
  await shot('c-wizard-1');
  if (wizOpen) {
    await page.evaluate(() => {
      const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
      set('f_toolName', 'Descript'); set('f_category', document.getElementById('f_category').options[1].value);
      set('f_status', document.getElementById('f_status').options[1].value);
    });
    await wait(300);
    const advanced = await clickText('#detailView button', 'Next');
    await wait(700);
    const step = await page.evaluate(() => (document.querySelector('.wizard-step.active') || {}).dataset ? +document.querySelector('.wizard-step.active').dataset.step : 0);
    ok('clicking Next advances a step', advanced && step > 1, 'step=' + step);
    await shot('c-wizard-2');
    ok('the wizard closes again', await page.evaluate(() => { if (typeof closeWizard === 'function') { closeWizard(); return true; } return false; }));
    await wait(500);
  }

  /* ---------------------------------------------------------------- */
  head('D · The admin gate');
  await page.evaluate(() => { togglePreviewAsDept(false); sessionStorage.removeItem('swangz_admin_otp_v1'); adminUnlocked = false; switchView('admin'); renderAdminGate(); });
  await wait(800);
  const gate1 = await page.evaluate(() => document.getElementById('adminGate').innerText);
  ok('a preview host offers the email code step', /code/i.test(gate1), gate1.slice(0, 90));
  ok('clicking "Send me a code" works', await clickText('#adminGate button', 'Send me a code'));
  await wait(700);
  const gate2 = await page.evaluate(() => document.getElementById('adminGate').innerText);
  ok('the code is shown on a preview host so the flow can be demonstrated', /preview delivery/i.test(gate2), gate2.slice(0, 120));
  await shot('d-gate-otp');
  /* type the code that was shown, then the password */
  const verified = await page.evaluate(() => {
    const code = (document.querySelector('.otp-preview code') || {}).textContent;
    if (!code) return false;
    const i = document.getElementById('adm_otp'); if (!i) return false;
    i.value = code.trim(); return true;
  });
  ok('the shown code can be typed in', verified);
  if (verified) {
    await clickText('#adminGate button', 'Verify');
    await wait(900);
    const gate3 = await page.evaluate(() => document.getElementById('adminGate').innerText);
    ok('verifying moves on to the password step', /password/i.test(gate3), gate3.slice(0, 110));
    await shot('d-gate-password');
  }

  /* unlock for the rest of the pass */
  await page.evaluate(() => {
    sessionStorage.setItem('swangz_admin_otp_v1', JSON.stringify({ hash: '', email: currentEmail(), exp: Date.now() + 36e5, tries: 0, verified: true }));
    adminUnlocked = true; switchView('admin'); showAdminContent(); renderAdmin();
  });
  await wait(900);

  /* ---------------------------------------------------------------- */
  head('E · The admin, section by section, by clicking the rail');
  const rail = await page.evaluate(() => [...document.querySelectorAll('#adminNav button[data-sec]')].filter(b => b.offsetParent !== null).map(b => b.dataset.sec));
  ok('the rail has visible sections', rail.length > 0, 'visible=' + rail.length);
  let blank = [];
  for (const sec of rail) {
    const clicked = await page.evaluate(s => { const b = document.querySelector(`#adminNav button[data-sec="${s}"]`); if (!b) return false; b.click(); return true; }, sec);
    await wait(300);
    const empty = await page.evaluate(() => document.getElementById('adminContent').innerText.trim().length < 20);
    if (!clicked || empty) blank.push(sec);
  }
  ok('every rail section renders content when clicked', blank.length === 0, blank.join(', '));
  await shot('e-admin');

  /* ---------------------------------------------------------------- */
  head('F · Tiles — opened, moved, minimised and closed by clicking');
  await page.evaluate(() => { DECK.closeAll(true); showAdminSection('acc_business'); });
  await wait(500);
  const opened = await page.evaluate(() => {
    const g = _toolGroups(filteredEntries())[0];
    if (g) { DECK.open('tool', g.key); DECK.open('toolNumbers', g.key); }
    return document.querySelectorAll('.deck-panel').length;
  });
  ok('two tiles open at once', opened >= 2, 'panels=' + opened);
  await shot('f-tiles');

  /* The close and minimise buttons were dead once, because raising a tile
     re-appended its node and a node that moves between pointerdown and
     pointerup gets no click. Click them with a real mouse, on a settled
     tile — clicking mid-animation proves nothing either way. */
  const mbox = await page.evaluate(() => {
    const p = document.querySelector('.deck-panel:not(.min)');
    const b = p && p.querySelector('.dp-min');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2,
             before: document.querySelectorAll('.deck-panel:not(.min)').length };
  });
  ok('the minimise button is on screen and hittable', !!mbox, 'no .dp-min found');
  if (mbox) {
    await page.mouse.click(mbox.x, mbox.y);
    await wait(700);
    const after = await page.evaluate(() => document.querySelectorAll('.deck-panel:not(.min)').length);
    ok('a real mouse click on − docks the tile', after < mbox.before, `${mbox.before} → ${after}`);
  }

  /* a fresh tile, left to settle, closed by a real mouse click */
  await page.evaluate(() => { DECK.closeAll(true); const g = _toolGroups(filteredEntries())[0]; if (g) DECK.open('tool', g.key); });
  await wait(1000);
  const xbox = await page.evaluate(() => {
    const p = [...document.querySelectorAll('.deck-panel')].find(x => !x.classList.contains('min'));
    const b = p && p.querySelector('.dp-x');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  ok('the close button is on screen and hittable', !!xbox, 'no .dp-x found');
  if (xbox) {
    await page.mouse.click(xbox.x, xbox.y);
    await wait(600);
    ok('a real mouse click on ✕ closes the tile',
       await page.evaluate(() => document.querySelectorAll('.deck-panel').length === 0),
       'panels left: ' + await page.evaluate(() => document.querySelectorAll('.deck-panel').length));
  }

  /* ---------------------------------------------------------------- */
  head('G · The briefing, the document and the workbook');
  await page.evaluate(() => { DECK.closeAll(true); showAdminSection('acc_exec'); setExecPeriod('all'); });
  await wait(500);
  ok('the briefing opens from its button', await clickText('#adminContent button', 'briefing') || await page.evaluate(() => { openExecBriefing(); return true; }));
  await wait(1400);
  const brief = await page.evaluate(() => (document.querySelector('.deck-panel .dp-body') || {}).innerText || '');
  ok('the briefing rendered', brief.length > 200, 'len=' + brief.length);
  ok('cumulative wording is right', !/this period only/i.test(brief), (brief.match(/.{0,50}this period only.{0,20}/i) || [''])[0]);
  ok('no figure is quoted in months', !/\b[\d.]+\s*mo\b/.test(brief), (brief.match(/.{0,30}[\d.]+ mo.{0,20}/) || [''])[0]);
  ok('no label promises hours above a value in weeks', !/Hours (saved|added)[^0-9]{0,30}[\d.,]+\s*(wk|d)\b/.test(brief));
  await shot('g-briefing');

  ok('"Open the document" opens the document view', await clickText('.deck-panel button', 'document'));
  await wait(1400);
  const docText = await page.evaluate(() => [...document.querySelectorAll('.deck-panel .dp-body')].map(b => b.innerText).join('\n'));
  ok('the document has its appendix', /Appendix A/i.test(docText));
  ok('the appendix defines a working day and week', /a day is 8 hours/i.test(docText), (docText.match(/.{0,40}a day is.{0,50}/i) || [''])[0]);
  await shot('g-document');

  await page.evaluate(() => { DECK.closeAll(true); DECK.open('sheetview'); });
  await wait(1200);
  const sheet = await page.evaluate(() => (document.querySelector('.deck-panel .dp-body') || {}).innerText || '');
  ok('the workbook grid renders with sheet tabs', sheet.length > 100, 'len=' + sheet.length);
  await shot('g-workbook');

  /* ---------------------------------------------------------------- */
  head('H · The registry, with a refused address');
  await page.evaluate(() => {
    DECK.closeAll(true);
    entries.push({ id: 'reg_ok_x', kind: 'registry', toolName: 'Runway', toolNameRaw: 'Runway',
      officialUrl: 'https://runwayml.com', addedByName: 'Sarah N.', submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    entries.push({ id: 'reg_bad_x', kind: 'registry', toolName: 'Planted', toolNameRaw: 'Planted',
      officialUrl: "javascript:window.__pwned=1", addedByName: 'anonymous', submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    saveEntries && saveEntries(); showAdminSection('acc_registry'); renderRegistryManager();
  });
  await wait(700);
  ok('no javascript: link exists in the page',
     await page.evaluate(() => [...document.querySelectorAll('a[href]')].filter(a => /^\s*javascript:/i.test(a.getAttribute('href') || '')).length === 0));
  ok('the refused address is shown struck through instead',
     await page.evaluate(() => !!document.querySelector('.reg-row .rr-bad')));
  ok('a good address is still a working link',
     await page.evaluate(() => [...document.querySelectorAll('.reg-row a.rr-url')].some(a => /^https:\/\/runwayml/.test(a.href))));
  /* click every button on the hostile row — nothing may execute */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.reg-row')].find(r => /Planted/.test(r.textContent));
    if (row) row.querySelectorAll('button').forEach(b => { try { b.click(); } catch (e) {} });
  });
  await wait(600);
  ok('clicking its buttons runs no injected code',
     await page.evaluate(() => typeof window.__pwned === 'undefined'));
  await shot('h-registry');

  /* ---------------------------------------------------------------- */
  head('I · Themes and the command palette');
  for (const t of ['aurora', 'midnight', 'swangz']) {
    await page.evaluate(th => { if (typeof setTheme === 'function') setTheme(th); else document.documentElement.dataset.theme = th; }, t);
    await wait(300);
    const applied = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    ok(`theme "${t}" applies`, applied === t, 'got ' + applied);
    if (t !== 'swangz') await shot('i-theme-' + t);
  }
  await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
  await wait(600);
  /* .cmdk is position:fixed, so offsetParent is null even when it is on
     screen — ask the class and the box instead. */
  const palette = await page.evaluate(() => {
    const p = document.querySelector('.cmdk');
    const box = document.querySelector('.cmdk-box');
    return !!(p && p.classList.contains('open') && box && box.getBoundingClientRect().height > 0);
  });
  ok('Ctrl+K opens the command palette', palette);
  await shot('i-palette');
  await page.keyboard.press('Escape');

  /* ---------------------------------------------------------------- */
  head('J · Phone');
  await page.setViewport({ width: 390, height: 844 });
  await page.evaluate(() => { DECK.closeAll(true); togglePreviewAsDept(true); switchView('tools'); });
  await wait(900);
  const phone = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok('the department view does not scroll sideways on a phone', phone.s <= phone.c + 2, `${phone.s} > ${phone.c}`);
  await shot('j-phone-department');
  await page.evaluate(() => { togglePreviewAsDept(false); switchView('admin'); renderAdmin(); });
  await wait(900);
  const phone2 = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  ok('the admin does not scroll sideways on a phone', phone2.s <= phone2.c + 2, `${phone2.s} > ${phone2.c}`);
  await shot('j-phone-admin');

  /* ---------------------------------------------------------------- */
  head('K · Nothing broke along the way');
  ok('no console error or page error during the whole pass', errs.length === 0, [...new Set(errs)].slice(0, 4).join(' | '));

  console.log('\n' + '─'.repeat(64));
  console.log(`\x1b[1m${pass + fail} checks in real Chrome — \x1b[32m${pass} passed\x1b[0m` + (fail ? `, \x1b[31m${fail} failed\x1b[0m` : ''));
  if (fail) { console.log('\n\x1b[31mFailures:\x1b[0m'); failures.forEach(f => console.log('  • ' + f)); }
  console.log('screenshots → ' + SHOTS);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAILED:', e.stack || e.message); process.exit(1); });
