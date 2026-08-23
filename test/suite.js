/* Drives the real app headlessly and asserts the rules it is supposed to keep.
   Run: node suite.js  [--only <substring>] */
const { boot } = require('./boot');

let pass = 0, fail = 0, current = '';
const failures = [];
const only = (() => { const i = process.argv.indexOf('--only'); return i > -1 ? process.argv[i + 1] : null; })();

function suite(name) { current = name; console.log('\n\x1b[1m' + name + '\x1b[0m'); }
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + label); }
  else { fail++; failures.push(current + ' › ' + label + (detail ? '\n      ' + detail : ''));
         console.log('  \x1b[31m✗ ' + label + '\x1b[0m' + (detail ? '\n      ' + detail : '')); }
}
const eq = (label, a, b) => ok(label + '  (got: ' + JSON.stringify(a) + ')', a === b, a === b ? '' : 'expected ' + JSON.stringify(b));

/* ---------- shared page helpers, injected into the app ---------- */
const HELPERS = `
window.__t = {
  /* Open a tile and hand back what actually landed in the DOM. */
  open(kind, args) {
    const before = document.querySelectorAll('.deck-panel').length;
    let threw = null;
    try { DECK.open(kind, args); } catch (e) { threw = e && (e.stack || e.message) || String(e); }
    const panels = [...document.querySelectorAll('.deck-panel')];
    const p = panels[panels.length - 1];
    return {
      threw,
      opened: panels.length > before || !!(p && p.dataset && p.dataset.kind === kind),
      title: p ? (p.querySelector('.dp-title b') || {}).textContent || '' : '',
      sub:   p ? (p.querySelector('.dp-title i') || {}).textContent || '' : '',
      text:  p ? (p.querySelector('.dp-body') || {}).textContent || '' : '',
      html:  p ? (p.querySelector('.dp-body') || {}).innerHTML || '' : '',
    };
  },
  reset() { try { DECK.closeAll(true); } catch (_) {} },
  /* Realistic arguments, derived from live state rather than guessed. */
  args() {
    const groups = (typeof _toolGroups === 'function') ? _toolGroups(filteredEntries()) : [];
    const gk = groups.length ? groups[0].key : '';
    const rep = entries.find(e => e.tag !== 'request') || entries[0] || {};
    const req = entries.find(e => e.tag === 'request') || {};
    const priced = (typeof toolPricingRows === 'function' && toolPricingRows()[0]) || null;
    const dept = (entries.find(e => e.department) || {}).department || 'Production';
    return {
      overview: 0, tool: gk, toolStory: gk, toolNumbers: gk, toolDepts: gk, toolUses: gk, toolSubs: gk,
      money: rep.id, toolPricing: priced ? priced.key : gk,
      mail: rep.id, execdoc: undefined, docview: undefined, sheetview: undefined,
      project: rep.id, saved: { title: 'Saved', body: 'ok' }, ask: { q: 'Question?', onYes() {} },
      reassign: rep.id, regedit: 'https://example.com',
      entry: rep.id, entryCase: rep.id, entryEffort: rep.id, entryProjects: rep.id,
      decide: req.id || rep.id, entryDocs: rep.id,
      finding: { s: '', i: 0 }, deptAnalysis: dept, filters: undefined,
      businessPart: (typeof BUSINESS_PARTS !== 'undefined' && BUSINESS_PARTS[0]) ? BUSINESS_PARTS[0].key : '',
      sectionMap: undefined, submissionDoc: rep.id, profile: undefined, settings: undefined,
    };
  },
  signIn() { devBypassSignIn(); adminUnlocked = true; },
  asDept(on) { try { sessionStorage.setItem('swangz_preview_as_dept', on ? '1' : '0'); } catch (_) {}
               if (typeof applyRoleChrome === 'function') applyRoleChrome(); },
};
`;

/* Every kind the app registers, read from source order in index.html */
const KINDS = ['overview','tool','toolStory','toolNumbers','toolDepts','toolUses','toolSubs','money',
  'toolPricing','mail','execdoc','docview','sheetview','project','saved','ask','reassign','regedit',
  'entry','entryCase','entryEffort','entryProjects','decide','entryDocs','finding','deptAnalysis',
  'filters','businessPart','sectionMap','submissionDoc','profile','settings'];

const MONEY_TILES = ['money', 'toolPricing'];

async function withApp(fn, opts) {
  const app = await boot(opts);
  app.run(HELPERS);
  /* run() is a plain eval, so anything async inside the page has to be given a
     moment and read back. Handed to every scenario rather than redefined in
     each one that happens to need it. */
  app.settle = ms => new Promise(r => setTimeout(r, ms || 250));
  app.awaitInPage = async (expr, ms) => {
    app.run(`window.__r = undefined; (${expr}).then(v => { window.__r = JSON.stringify(v === undefined ? null : v); });`);
    await app.settle(ms);
    return app.run(`window.__r`);
  };
  try { await fn(app); } finally { app.dom.window.close(); }
}

/* ============================ scenarios ============================ */

async function scenarioBoot() {
  if (only && !'boot'.includes(only)) return;
  await withApp(async ({ doc, errors, run }) => {
    suite('1 · Boot — the app comes up clean');
    ok('no console error or uncaught exception', errors.length === 0, errors.slice(0, 3).join('\n      '));
    ok('window.DECK is defined (nothing aborted the script)', run('typeof window.DECK') === 'object');
    const views = [...doc.querySelectorAll('section.view')].map(s => s.id);
    ok('all six views present', ['authView','purposeView','doneView','landingView','toolsView','adminView']
        .every(v => views.includes(v)), views.join(','));
    ok('starts on the sign-in view', run('currentView') === 'auth');
    ok('every registered tile kind is reachable', run(`(${JSON.stringify(KINDS)}).length`) === KINDS.length);
    ok('no admin markup rendered before sign-in',
       !doc.getElementById('adminView').classList.contains('active'));

    /* The boot hold. #authView is the view marked active in the markup, so
       without something over the top a signed-in reload shows the sign-in
       screen and then jumps — it looked like being logged out, every time. */
    ok('there is a mark to hold the screen while the app boots', !!doc.getElementById('bootHold'));
    ok('and it hides the app rather than sitting behind it',
       /html\.booting \.app-shell\s*\{\s*visibility:\s*hidden/.test(run(
         `[...document.querySelectorAll('style')].map(s => s.textContent).join('\\n')`)));
    ok('the hold is lifted once boot has decided where to go',
       !doc.documentElement.classList.contains('booting'));
    ok('and it lifts even if boot throws, not only on the happy path',
       /finally\s*\{\s*\n?\s*endBootHold\(\);/.test(run(
         `[...document.querySelectorAll('script')].map(s=>s.textContent).join('')`)));

    /* Nothing may block the first paint from the head any more */
    const head = run(`document.head.innerHTML`);
    ok('no render-blocking script is left in the head',
       !/<script[^>]+src=/i.test(head), head.match(/<script[^>]+src=[^>]*>/i));
    ok('the stylesheet for the fonts does not block it either',
       !/rel="stylesheet"(?![^>]*media="print")/i.test(head.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')));
    ok('the sign-in screen no longer shows design/development credits',
       !/designed\s*&\s*developed by/i.test(doc.body.textContent) && !doc.querySelector('.credits'),
       (doc.body.textContent.match(/.{0,30}designed.{0,80}/i) || [''])[0]);
  });
}

async function scenarioTilesAdmin() {
  if (only && !'tiles-admin'.includes(only)) return;
  await withApp(async ({ run, errors }) => {
    suite('2 · Every tile builds — signed in as admin, with data');
    run('__t.signIn(); seedDemoData(true); switchView("admin");');
    const n = run('entries.length');
    ok('demo data seeded', n > 0, 'entries=' + n);
    const args = run('__t.args()');
    let built = 0, broke = [];
    for (const kind of KINDS) {
      const r = run(`__t.reset(); JSON.stringify(__t.open(${JSON.stringify(kind)}, ${JSON.stringify(args[kind])}))`);
      const res = JSON.parse(r);
      if (res.threw) broke.push(kind + ': ' + String(res.threw).split('\n')[0]);
      else if (res.opened && (res.text.trim().length || res.html.length)) built++;
      else broke.push(kind + ': opened nothing');
    }
    ok(`all ${KINDS.length} tiles build for an admin`, broke.length === 0, broke.join('\n      '));
    eq('tiles that produced content', built, KINDS.length);
    ok('no console error while opening every tile', errors.length === 0, errors.slice(0, 3).join('\n      '));
  });
}

async function scenarioTilesDept() {
  if (only && !'tiles-dept'.includes(only)) return;
  await withApp(async ({ run, errors }) => {
    suite('3 · Every tile builds — as a department user, and money stays shut');
    run('__t.signIn(); seedDemoData(true); __t.asDept(true); switchView("tools");');
    eq('effective role is lowered to user', run('currentRole()'), 'user');
    const args = run('__t.args()');
    let broke = [];
    for (const kind of KINDS) {
      const res = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open(${JSON.stringify(kind)}, ${JSON.stringify(args[kind])}))`));
      if (res.threw) broke.push(kind + ': ' + String(res.threw).split('\n')[0]);
    }
    ok(`all ${KINDS.length} tiles build for a department user`, broke.length === 0, broke.join('\n      '));

    for (const kind of MONEY_TILES) {
      const res = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open(${JSON.stringify(kind)}, ${JSON.stringify(args[kind])}))`));
      ok(`${kind} refuses and explains`, /admin team sets this/i.test(res.text), res.text.slice(0, 120));
      ok(`${kind} shows no dollar figure`, !/\$\s?-?[\d,]+/.test(res.text), res.text.slice(0, 120));
    }
    const entryTile = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('entry', ${JSON.stringify(args.entry)}))`));
    ok('a report tile shows volume, not net money', !/Net \/ mo/.test(entryTile.text), entryTile.text.slice(0, 160));
    ok('a report tile offers no door to pricing', !/Pricing/.test(entryTile.text), entryTile.text.slice(0, 160));
    const doc2 = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('submissionDoc', ${JSON.stringify(args.submissionDoc)}))`));
    ok('a moneyless submission document does not cite an FX rate',
       !/converted at/i.test(doc2.text), (doc2.text.match(/.{0,60}converted at.{0,40}/i) || [''])[0]);
    ok('no console error in the department pass', errors.length === 0, errors.slice(0, 3).join('\n      '));
  });
}

async function scenarioReportWizardScope() {
  if (only && !'wizard-report'.includes(only)) return;
  await withApp(async ({ run, doc }) => {
    suite('3b · Reporting a tool never asks for money');
    run('__t.signIn(); profile.department = "Production"; saveProfile(); switchView("tools"); chooseAddType("report");');
    eq('report mode has only the four non-money steps', run('JSON.stringify(wizardStepPlan())'), '[1,2,3,4]');
    eq('the footer counts four steps', doc.getElementById('wizCount').textContent, 'Step 1 of 4');
    ok('AI Cost is not part of the report wizard',
       run('document.querySelector(".wizard-step[data-step=\\"5\\"]").hidden') === true);
    ok('Revenue is not part of the report wizard',
       run('document.querySelector(".wizard-step[data-step=\\"6\\"]").hidden') === true);
    run(`document.getElementById("f_toolName").value = "Descript";
         document.getElementById("f_category").value = document.getElementById("f_category").options[1].value;
         document.getElementById("f_reason").value = "Cuts review time";
         onDetailDirty();`);
    run('gotoStep(5)');
    eq('trying to jump into the old money step lands on the last report step',
       run('Number(document.querySelector(".wizard-step.active").dataset.step)'), 4);
    ok('the old traditional-cost field is hidden even for an admin reporting a tool',
       run('document.getElementById("f_tradCost").closest(".grid > div").style.display') === 'none');
    ok('the visible report wording stays about time, not dollars',
       /How long the work takes/i.test(run('document.querySelector(".wizard-step.active .step-title").textContent')) &&
       !/US Dollars|subscription|revenue/i.test(run('document.querySelector(".wizard-step.active").textContent')),
       run('document.querySelector(".wizard-step.active").textContent').slice(0, 180));
    const reportId = run(`closeWizard(); seedDemoData(true);
      const e = entries.find(x => x.tag !== 'request' && x.kind !== 'registry');
      e.tradCost = 1200; e.toolMonthlyCost = 99; e.extraCredits = 15; e.revenueAmount = 5000;
      e.id;`);
    const reportDoc = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('submissionDoc', ${JSON.stringify(reportId)}))`));
    ok('the report document excludes money even when the entry has prices',
       !/\\$|\\bMoney\\b|subscription|revenue|UGX|converted at/i.test(reportDoc.text),
       reportDoc.text.match(/.{0,50}(\\$|Money|subscription|revenue|UGX|converted at).{0,50}/i)?.[0] || '');
  });
}

async function scenarioExecWording() {
  if (only && !'exec'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('4 · Executive briefing — the basis never contradicts itself');
    run('__t.signIn(); seedDemoData(true); switchView("admin");');

    /* Cumulative window: there is no earlier period, so "this period only" is a lie.
       Go through the real setter — it is what refreshes the launch note. */
    run('execCarryTotals = false; setExecPeriod("all");');
    const all = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('execdoc'))`));
    ok('cumulative: tile subtitle does not claim "this period only"', !/this period only/i.test(all.sub), all.sub);
    ok('cumulative: body does not claim "this period only"', !/this period only/i.test(all.text),
       (all.text.match(/.{0,70}this period only.{0,40}/i) || [''])[0]);
    ok('cumulative: says every report to date', /every report recorded to date/i.test(all.text));
    ok('cumulative: heading reads "Where we stand"', /Where we stand/.test(all.text));
    const launch = run('execLaunchNote && (document.getElementById("execLaunchNote")||{}).textContent || ""');
    ok('cumulative: launch note not mislabelled', !/this period only/i.test(String(launch)), String(launch).slice(0, 120));

    /* A real window: the period IS the subject and must say so */
    run('execCarryTotals = false; setExecPeriod("this-month");');
    const month = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('execdoc'))`));
    ok('monthly: states the figures are this period only', /this period only/i.test(month.text));
    ok('monthly: heading reads "What this period produced"', /What this period produced/.test(month.text));

    /* Carried totals inside a real window keeps the running-total wording */
    run('execCarryTotals = true; setExecPeriod("this-month");');
    const carried = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('execdoc'))`));
    ok('carried: subtitle says the running total is carried in', /running total carried in/i.test(carried.sub), carried.sub);
    ok('carried: body says everything to date', /everything recorded to date/i.test(carried.text));

    /* The three renderings of the workbook must agree on the basis */
    run('setExecPeriod("all");');
    const basis = run('JSON.stringify((execWorkbookModel().sheets ? execWorkbookModel().sheets[0].rows : execWorkbookModel()[0] ? execWorkbookModel()[0].rows : []).slice(0,6))');
    ok('workbook basis row agrees with the document', !/This period only/.test(basis), basis.slice(0, 200));
  });
}

async function scenarioFigures() {
  if (only && !'figures'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('5 · Figures read the way a business reader expects');
    run('__t.signIn();');
    eq('a negative sum reads -$2,500 not $-2,500', run('fmtUSD(-2500)'), '-$2,500');
    eq('zero is plain', run('fmtUSD(0)'), '$0');
    eq('infinity is an em dash, not $∞', run('fmtUSD(Infinity)'), '—');
    eq('NaN is an em dash', run('fmtUSD(NaN)'), '—');
    eq('negative UGX also leads with the sign', run('fmtUGX(-1000).startsWith("-")'), true);
    ok('a non-finite return-per-dollar does not print', !/∞/.test(String(run('fmtUSD(1/0)'))));
  });
}

async function scenarioHostile() {
  if (only && !'hostile'.includes(only)) return;
  await withApp(async ({ run, doc }) => {
    suite('6 · Hostile and degenerate data cannot break out');
    run('__t.signIn(); switchView("admin");');
    run(`entries = [{
      id: 'x1', kind: 'tool', tag: 'report', department: '<img src=x onerror=alert(1)>',
      toolName: '<script>window.__pwned=1<\\/script>', toolNameRaw: 'x',
      submittedBy: '"><svg onload=alert(2)>', category: 'Writing', status: 'Using',
      reason: 'javascript:alert(3)', impact: 'x', projects: [],
      tradTime: 1, aiTime: 0, tradCost: -2500, frequency: 0, currency: 'USD',
      toolMonthlyCost: 0, extraCredits: 0, revenueAmount: 0,
      officialUrl: 'javascript:alert(4)',
      submittedAt: 'not-a-date', updatedAt: 'not-a-date',
    }]; saveEntries && saveEntries(); renderAdmin();`);
    ok('the injected script never executed', run('typeof window.__pwned') === 'undefined');
    const inj = doc.querySelectorAll('img[onerror], svg[onload]').length;
    eq('no injected element reached the DOM', inj, 0);
    const args = run('__t.args()');
    let broke = [];
    for (const kind of KINDS) {
      const res = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open(${JSON.stringify(kind)}, ${JSON.stringify(args[kind])}))`));
      if (res.threw) broke.push(kind + ': ' + String(res.threw).split('\n')[0]);
    }
    ok('every tile survives hostile + degenerate data', broke.length === 0, broke.join('\n      '));
    const shown = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('entry','x1'))`));
    ok('the payload is neutralised but still legible to a human',
       (shown.title + shown.text).includes('<script>'), JSON.stringify(shown.title).slice(0, 80));
    const href = run(`[...document.querySelectorAll('a[href]')].filter(a=>/^javascript:/i.test(a.getAttribute('href'))).length`);
    eq('no javascript: URL survived safeUrl', href, 0);
    ok('a zero frequency does not produce NaN anywhere',
       !run(`__t.reset(); __t.open('entry','x1').text`).includes('NaN'));
  });
}

async function scenarioEmpty() {
  if (only && !'empty'.includes(only)) return;
  await withApp(async ({ run, errors }) => {
    suite('7 · An empty tracker is a valid state');
    run('__t.signIn(); entries = []; saveEntries && saveEntries(); switchView("admin"); renderAdmin();');
    const args = run('__t.args()');
    let broke = [];
    for (const kind of KINDS) {
      const res = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open(${JSON.stringify(kind)}, ${JSON.stringify(args[kind])}))`));
      if (res.threw) broke.push(kind + ': ' + String(res.threw).split('\n')[0]);
    }
    ok('every tile builds with nothing recorded', broke.length === 0, broke.join('\n      '));
    const ex = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('execdoc'))`));
    ok('the briefing says there is nothing rather than showing zeros as fact',
       ex.text.length > 0 && !/\$NaN|Infinity/.test(ex.text), ex.text.slice(0, 120));
    ok('no console error on an empty tracker', errors.length === 0, errors.slice(0, 3).join('\n      '));
  });
}

async function scenarioRequestDecision() {
  if (only && !'decision'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('8 · Deciding a request notifies once, from either route');
    run('__t.signIn(); seedDemoData(true); switchView("admin");');
    run('window.__mails = []; if (typeof queueMail === "function") { const o = queueMail; window.queueMail = function(){ window.__mails.push(arguments[0]); return o.apply(this, arguments); }; }');
    const rid = run('(entries.find(e => e.tag === "request") || {}).id');
    ok('a demo request exists to decide', !!rid, String(rid));
    if (!rid) return;
    run(`setRequestStatus(${JSON.stringify(rid)}, 'approved')`);
    const after1 = run('window.__mails.length');
    ok('deciding from any route queues a notification', after1 >= 1, 'mails=' + after1);
    run(`setRequestStatus(${JSON.stringify(rid)}, 'approved')`);
    eq('setting the same status twice does not write twice', run('window.__mails.length'), after1);
    run(`setRequestStatus(${JSON.stringify(rid)}, 'new')`);
    eq('putting it back to new un-decides rather than announcing', run('window.__mails.length'), after1);
    eq('the status actually changed', run(`(entries.find(e => e.id === ${JSON.stringify(rid)})||{}).requestStatus`), 'new');
  });
}

async function scenarioCorruptStorage() {
  if (only && !'corrupt'.includes(only)) return;
  await withApp(async ({ run, errors, doc }) => {
    suite('9 · Corrupt localStorage does not stop the app');
    ok('boots with unparseable stored state', errors.length === 0, errors.slice(0, 3).join('\n      '));
    ok('DECK still came up', run('typeof window.DECK') === 'object');
    ok('entries fell back to a usable value', run('Array.isArray(entries)'));
    ok('the sign-in screen still rendered', !!doc.querySelector('#authView .auth-card'));
  }, { storage: {
    swangz_ai_tracker_v2: '{not json at all',
    swangz_profile_v1: 'null',
    swangz_settings_v1: '[]',
    swangz_theme_v1: '"nonexistent-theme"',
  } });
}


async function scenarioInjection() {
  if (only && !'injection'.includes(only)) return;
  await withApp(async ({ run, doc }) => {
    suite('10 · A stored address cannot become code');
    run('__t.signIn(); adminUnlocked = true;');
    /* Both payloads travel the same road real data does: a teammate (or an
       anonymous requester) types an Official URL, it is stored, and an admin
       later opens the Tool Registry Manager. */
    const breakout = "https://evil.test/x'); window.__break=1; ('";
    run(`entries = [
      { id:'reg_a', kind:'registry', toolName:'Breakout', toolNameRaw:'Breakout',
        officialUrl: ${JSON.stringify(breakout)}, addedByName:'anon',
        submittedAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
      { id:'reg_b', kind:'registry', toolName:'Scheme', toolNameRaw:'Scheme',
        officialUrl:'javascript:window.__jsurl=1', addedByName:'anon',
        submittedAt:new Date().toISOString(), updatedAt:new Date().toISOString() },
      { id:'reg_c', kind:'registry', toolName:'Honest', toolNameRaw:'Honest',
        officialUrl:'https://good.example/tool', addedByName:'anon',
        submittedAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
    ]; saveEntries && saveEntries(); renderRegistryManager();`);

    const rows = [...doc.querySelectorAll('.reg-row')];
    ok('the registry rendered', rows.length > 0, 'rows=' + rows.length);

    const evil = rows.find(r => /Breakout/.test(r.textContent));
    ok('the hostile row is listed rather than swallowed', !!evil);
    if (evil) {
      [...evil.querySelectorAll('button')].forEach(b => { try { b.click(); } catch (_) {} });
      eq('clicking its buttons runs no injected code', run('typeof window.__break'), 'undefined');
    }
    eq('no javascript: href anywhere in the document',
       run(`[...document.querySelectorAll('a[href]')].filter(a=>/^\\s*javascript:/i.test(a.getAttribute('href')||'')).length`), 0);
    ok('the rejected address is still shown so it can be fixed',
       /javascript:window.__jsurl=1/.test(doc.body.textContent));
    ok('the rejected address is marked, not linked',
       !!doc.querySelector('.reg-row .rr-bad'));
    const good = rows.find(r => /Honest/.test(r.textContent));
    ok('an honest address is still a working link',
       !!(good && good.querySelector('a.rr-url') &&
          /^https:\/\/good\.example/.test(good.querySelector('a.rr-url').getAttribute('href'))));

    /* The helper itself, stated directly */
    eq('jsArg quotes and escapes a hostile value', run(`jsArg("a'); alert(1); ('")`),
       run(`escapeAttr(JSON.stringify("a'); alert(1); ('"))`));
    eq('safeUrl still refuses a scheme URL', run(`safeUrl('javascript:alert(1)')`), '');
    eq('safeUrl still refuses data:', run(`safeUrl('data:text/html,<script>alert(1)</script>')`), '');
    ok('safeUrl still promotes a bare domain', /^https:\/\//.test(run(`safeUrl('chatgpt.com')`)));

    /* The invariant, stated against the source rather than one rendering:
       no on* handler may interpolate a value into a single-quoted JS string
       literal. escapeAttr alone does not survive the parser's entity decode. */
    const src = require('fs').readFileSync(require('./boot').APP, 'utf8');
    const unsafe = src.match(/on[a-z]+="[^"]*?[a-zA-Z_$.]+\((?:[^"]*?,)?'\$\{/g) || [];
    eq('no handler in the source interpolates into a quoted JS literal', unsafe.length, 0);
    if (unsafe.length) console.log('      ' + unsafe.slice(0, 5).join('\n      '));
  });
}


async function scenarioDemoContainment() {
  if (only && !'demo'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('11 · Demo rows never reach the shared backend');
    run('__t.signIn(); seedDemoData(true);');
    ok('demo rows are present locally', run('entries.filter(e => e.isDemo).length') > 0);
    /* One genuine entry alongside them — the case that actually matters */
    run(`entries.push({ id:'real-1', kind:'tool', tag:'report', department:'Production',
      toolName:'Runway', toolNameRaw:'Runway', category:'Video', status:'Using',
      reason:'r', impact:'i', projects:[], tradTime:4, aiTime:1, tradCost:100,
      frequency:4, currency:'USD', toolMonthlyCost:35, extraCredits:0, revenueAmount:0,
      submittedAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
      saveEntries && saveEntries();`);

    /* Intercept the wire rather than the function, so what is asserted is
       what would actually be sent. */
    run(`window.__sent = [];
         window.fetch = function (url, opt) {
           try { window.__sent.push({ url: String(url), body: JSON.parse((opt && opt.body) || '{}') }); } catch (e) { window.__sent.push({ url: String(url), body: null }); }
           return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{"ok":true}'), json: () => Promise.resolve({ ok: true }) });
         };
         settings.backend = Object.assign(settings.backend || {}, {
           mode: 'supabase', supabaseUrl: 'https://example.supabase.co',
           supabaseAnonKey: 'k', supabaseTable: 'entries' });`);

    await run('supabasePushAll()');
    const sent = JSON.parse(run('JSON.stringify(window.__sent)'));
    const rowsOf = list => (list.length && Array.isArray(list[0].body)) ? list[0].body : [];
    const rows = rowsOf(sent);
    ok('a push was attempted', sent.length > 0, 'requests=' + sent.length);
    eq('exactly the one real row went', rows.length, 1);
    eq('and it is the real one', (rows[0] || {}).id, 'real-1');
    eq('nothing demo-tagged was put on the wire',
       rows.filter(r => r && r.payload && r.payload.isDemo).length, 0);
    ok('real rows would still be sent when there are any',
       rows.length === run('entries.filter(e => !e.isDemo).length'),
       'wire=' + rows.length + ' real=' + run('entries.filter(e => !e.isDemo).length'));
    ok('the status line reports what actually went',
       /demo rows not sent/.test(String(run('settings.backend.lastSyncMsg'))),
       String(run('settings.backend.lastSyncMsg')));

    /* Sheets replaces the whole sheet — the same rule, higher stakes */
    run(`window.__sent = []; settings.backend.mode = 'sheets';
         settings.backend.sheetsUrl = 'https://script.google.com/x';`);
    await run('sheetsPushAll()');
    const s2 = JSON.parse(run('JSON.stringify(window.__sent)'));
    const body = s2.length ? s2[0].body : null;
    eq('the sheet replacement carries no demo row',
       (body && body.entries ? body.entries.filter(e => e && e.isDemo).length : -1), 0);
  });
}


async function scenarioUnits() {
  if (only && !'units'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('12 · Time is working time, and the labels say so');
    run('__t.signIn(); seedDemoData(true); switchView("admin");');

    eq('a working day is 8 hours', run('UNIT_HOURS.d'), 8);
    eq('a working week is 40 hours', run('UNIT_HOURS.wk'), 40);
    eq('a working month is 160 hours', run('UNIT_HOURS.mo'), 160);
    eq('"2 days" of work means 16 hours', run(`toHours(2, 'd')`), 16);
    eq('"1 week" of work means 40 hours', run(`toHours(1, 'wk')`), 40);

    /* smartUnit must agree with the table, not with numbers typed beside it */
    eq('7 hours still reads in hours', run('smartUnit(7)'), 'h');
    eq('a full working day rolls to days', run('smartUnit(8)'), 'd');
    eq('a full working week rolls to weeks', run('smartUnit(40)'), 'wk');
    eq('40 hours reads as one week', run('fmtDuration(40)'), '1 wk');
    eq('16 hours reads as two days', run('fmtDuration(16)'), '2 d');
    /* A rate per month must never be quoted in months */
    eq('a working month of effort reads in weeks', run('smartUnit(160)'), 'wk');
    eq('a year of effort still reads in weeks', run('smartUnit(1920)'), 'wk');
    eq('160 hours reads as four weeks', run('fmtDuration(160)'), '4 wk');
    ok('months and years remain available for what a person types',
       run(`toHours(1, 'mo')`) === 160 && run(`toHours(1, 'yr')`) === 1920);

    /* No label may promise hours and then show weeks */
    run('setExecPeriod("all");');
    const doc = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('execdoc'))`));
    const lies = (doc.text.match(/Hours (saved|added)[^0-9]{0,40}[\d.,]+\s*(wk|d|mo|yr)\b/g) || []);
    eq('no "Hours …" label sits above a value in weeks or days', lies.length, 0, lies.join(' | '));
    const selfref = (doc.text.match(/[\d.,]+\s*mo\b/g) || []);
    eq('no figure in the briefing is quoted in months', selfref.length, 0, selfref.join(' | '));
    /* The appendix belongs to the document that gets sent out, not the summary tile */
    const body = run('execDocBody()');
    ok('the appendix states what a day and a week are',
       /working time, not calendar time/i.test(body) && /a day is 8\s*hours/i.test(body),
       (String(body).match(/.{0,60}a day is.{0,80}/i) || ['not found'])[0]);
    ok('the document defines time saved as person-hours', /person-hours of work/i.test(body));
    ok('the opening paragraph is a sentence, not a pasted label',
       !/tracker over Everything recorded to date/i.test(body) && /filed in the tracker to date\./i.test(body),
       (String(body).match(/.{0,50}filed in the tracker.{0,50}/i) || [''])[0]);
    ok('no column headed "Hours" is filled with weeks or days',
       !/>Hours \/ mo</.test(body), 'a Hours / mo header survived');
    /* The verdict sentence must keep pace with the ratio it describes */
    const roiClaim = (String(body).match(/returning \$([\d.,]+)\.\s*([^<.]{0,80})/) || []);
    ok('a very large return is not described as "twice over"',
       !(parseFloat(String(roiClaim[1] || '0').replace(/,/g, '')) > 10 && /twice over/i.test(roiClaim[2] || '')),
       roiClaim.slice(1).join(' → '));

    /* Cumulative wording, everywhere it appears */
    ok('cumulative: the prose does not open with "This period covers"',
       !/This period covers/.test(doc.text), (doc.text.match(/.{0,50}This period covers.{0,30}/) || [''])[0]);
    ok('cumulative: the filed section reads "Filed to date"', /Filed to date/.test(doc.text));
    run('setExecPeriod("this-month");');
    const m = JSON.parse(run(`__t.reset(); JSON.stringify(__t.open('execdoc'))`));
    ok('a real window still says "Filed in this period"', /Filed in this period/.test(m.text));

    /* The workbook keeps raw hours, so its "Hours" headers stay honest */
    const wb = run(`JSON.stringify(execWorkbookModel())`);
    ok('the workbook still labels its numeric column in hours', /Hours saved/.test(wb));
  });
}


async function scenarioAdminGate() {
  if (only && !'gate'.includes(only)) return;
  /* A preview host: showing the code is how the flow gets demonstrated */
  await withApp(async ({ run, doc }) => {
    suite('13 · The admin gate never performs security it cannot deliver');
    run('__t.signIn();');
    eq('on a preview host the email step is offered', run('otpAvailable()'), true);
    run('switchView("admin"); renderAdminGate();');
    ok('the preview gate asks for a code', /code/i.test(doc.getElementById('adminGate').textContent),
       doc.getElementById('adminGate').textContent.slice(0, 90));
    await run('sendAdminOtp()');
    ok('the code is shown so the flow can be demonstrated',
       /Preview delivery/i.test(doc.getElementById('adminGate').textContent));
  });

  /* A real host with no endpoint: the step must not be performed */
  await withApp(async ({ run, doc }) => {
    run(`authUser = { id:'u', email:'marvinmusokessekatawa@gmail.com', user_metadata:{ full_name:'Marvin' } };
         syncProfileFromAuth(authUser);`);
    await run('(async () => { settings.adminPasswordHash = await hashPassword("1234"); saveSettings(); })()');
    eq('on a real host with no endpoint the email step is off', run('otpAvailable()'), false);
    run('switchView("admin"); renderAdminGate();');
    const gate = doc.getElementById('adminGate').textContent;
    ok('no code is printed on a real host', !/Preview delivery|\b\d{6}\b/.test(gate), gate.slice(0, 140));
    ok('the gate goes straight to the password', /admin password/i.test(gate), gate.slice(0, 140));
    ok('and says why there is no email code', /email codes stay off/i.test(gate), gate.slice(0, 200));
    await run('sendAdminOtp()');
    ok('asking for a code on a real host stores nothing',
       run('otpState() === null || !otpState().preview'), String(run('JSON.stringify(otpState())')).slice(0, 80));
  }, { url: 'https://swangz-ai-tracker.netlify.app/' });
}

async function scenarioNoDialogs() {
  if (only && !'dialogs'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('14 · Nothing freezes the page or names a function that is gone');
    run('__t.signIn(); seedDemoData(true); adminUnlocked = true; switchView("admin"); renderAdmin();');
    /* Every handler the app actually rendered must parse and resolve */
    const bad = run(`(function(){
      const out = [];
      document.querySelectorAll('*').forEach(el => {
        for (const a of el.attributes) {
          if (!/^on/i.test(a.name)) continue;
          try { new Function(a.value); } catch (e) { out.push('unparseable: ' + a.value.slice(0,60)); continue; }
          /* bare calls only — a method call carries its object's existence */
          const m = a.value.match(/(?:^|[^.\\w$'\"])([A-Za-z_$][\\w$]*)\\s*\\(/g) || [];
          m.forEach(function (call) {
            const n = call.replace(/\\s*\\($/, '').replace(/^[^A-Za-z_$]+/, '');
            if (['if','for','while','switch','catch','function','return','typeof','new'].indexOf(n) > -1) return;
            if (typeof window[n] === 'function') return;
            try { if (typeof eval('typeof ' + n) === 'function') return; } catch (e) {}
            out.push(n + '() — from ' + (el.tagName || '?').toLowerCase());
          });
        }
      });
      return [...new Set(out)];
    })()`);
    eq('every rendered handler parses and resolves', bad.length, 0, bad.slice(0, 8).join('\n      '));
    eq('changeAdminPassword no longer asks with a native dialog',
       /prompt\(/.test(String(run('String(changeAdminPassword)'))), false);
  });
}


async function scenarioWorkbook() {
  if (only && !'workbook'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('15 · The workbook\'s formulas point at the right rows');
    run('__t.signIn(); seedDemoData(true); switchView("admin"); setExecPeriod("all");');
    const model = JSON.parse(run('JSON.stringify(execWorkbookModel())'));
    const sheets = model.sheets || model;
    const summary = sheets[0];
    ok('the summary sheet is first', !!summary && /summary/i.test(summary.name || ''), (summary || {}).name);

    /* Which row is a label on, 1-indexed as Excel counts */
    const rowOf = label => summary.rows.findIndex(r =>
      r && r[0] && String(r[0].v || '').toLowerCase().startsWith(label.toLowerCase())) + 1;

    const rateRow   = rowOf('US Dollar to Ugandan');
    const hourlyRow = rowOf('Blended hourly rate');
    const oldWayRow = rowOf('Cost of the old way');
    const aiRow     = rowOf('Spent on AI');
    const netRow    = rowOf('Net saved, per month');
    const hoursRow  = rowOf('Hours saved, per month');
    const labourRow = rowOf('Those hours in money');
    const totalRow  = rowOf('Total benefit');
    ok('every named row was found', [rateRow, hourlyRow, oldWayRow, aiRow, netRow, hoursRow, labourRow, totalRow].every(n => n > 0),
       JSON.stringify({ rateRow, hourlyRow, oldWayRow, aiRow, netRow, hoursRow, labourRow, totalRow }));

    /* Every shilling column multiplies by the FX rate cell — it must be the
       cell the rate is actually in, whatever else moved above it. */
    const formulas = [];
    sheets.forEach(sh => (sh.rows || []).forEach((r, ri) => (r || []).forEach(c => {
      if (c && c.f) formulas.push({ sheet: sh.name, row: ri + 1, f: c.f });
    })));
    ok('the workbook carries live formulas', formulas.length > 0, 'found ' + formulas.length);

    const fxWrong = formulas.filter(x => /R(\d+)C2/.test(x.f) && /\*\s*(Summary!)?R(\d+)C2/.test(x.f))
      .filter(x => { const m = x.f.match(/\*\s*(?:Summary!)?R(\d+)C2/); return m && +m[1] !== rateRow; });
    eq('every FX multiplication points at the rate row', fxWrong.length, 0,
       fxWrong.slice(0, 3).map(x => x.sheet + ' r' + x.row + ': ' + x.f).join(' | '));

    /* Net saved = old way - AI, by row, not by hope */
    const netCell = summary.rows[netRow - 1][1];
    eq('net saved subtracts the right two rows', netCell.f, '=R' + oldWayRow + 'C2-R' + aiRow + 'C2');
    const labourCell = summary.rows[labourRow - 1][1];
    if (labourCell && labourCell.f) {
      eq('the value of the hours multiplies hours by the rate', labourCell.f,
         '=R' + hoursRow + 'C2*R' + hourlyRow + 'C2');
    } else {
      ok('with no hourly rate the value of the hours is left blank, not zero',
         String(labourCell.v) === '—' || String(labourCell.v) === '', JSON.stringify(labourCell));
    }
    const totalCell = summary.rows[totalRow - 1][1];
    eq('total benefit adds net and the value of the time', totalCell.f,
       '=R' + netRow + 'C2+R' + labourRow + 'C2');

    /* An unset rate must not be written as a confident zero */
    const hourlyCell = summary.rows[hourlyRow - 1][1];
    ok('an unset hourly rate is blank rather than 0', !(hourlyCell.t === 'Number' && hourlyCell.v === 0),
       JSON.stringify(hourlyCell));

    /* Money columns must carry a money format */
    const styles = new Set();
    (summary.rows || []).forEach(r => (r || []).forEach(c => { if (c && c.s) styles.add(c.s); }));
    ok('money, shillings and hours each have their own format',
       ['usd', 'ugx', 'hrs'].every(x => styles.has(x)), [...styles].join(','));

    /* The note naming the input cells must name the cells they are in */
    const note = String(summary.note || (model.sheets ? model.sheets[0].note : '') || '');
    ok('the sheet note points at the real rate cell', note.includes('B' + rateRow), note);
    ok('the sheet note points at the real hourly-rate cell', note.includes('B' + hourlyRow), note);

    /* And the XML it writes must still declare every style it uses */
    const xml = run('execWorkbookXML ? execWorkbookXML() : ""');
    if (xml) {
      const missing = [...styles].filter(id => !new RegExp('ss:ID="' + id + '"').test(xml));
      eq('every style used is declared in the workbook', missing.length, 0, missing.join(','));
    }
  });
}


async function scenarioDeptPrompt() {
  if (only && !'prompt'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('16 · The department question is asked on every sign-in');
    const shown = () => run(`(function(){const e=document.getElementById('deptPrompt');return !!e && !e.hidden;})()`);
    /* closing is animated, so give the card the beat it takes to leave */
    const settle = () => new Promise(r => setTimeout(r, 340));
    const signIn = () => run(`devBypassSignIn();
      profile.department='Production'; profile.name='Arnold'; profile.role='Lead'; saveProfile && saveProfile();
      sessionStorage.setItem('swangz_preview_as_dept','1'); switchView('tools'); maybeShowDeptPrompt();`);

    signIn();
    ok('it is asked on the first sign-in', shown());
    run('dismissDeptPrompt();'); await settle();
    ok('dismissing it puts it away', !shown());

    /* moving around inside one sign-in must not nag */
    run(`switchView('admin');`); await settle();
    run(`switchView('tools'); maybeShowDeptPrompt();`);
    ok('moving away and back does not ask again', !shown());

    /* but a new session must */
    run('resetDeptPrompt(); authUser = null; switchView("auth");');
    signIn();
    ok('signing in again asks again', shown(), 'this is the one that only fired once');
    run('dismissDeptPrompt();'); await settle();

    /* and a different person is asked on their own terms */
    run(`authUser = { id:'x', email:'someone@swangzavenue.com', user_metadata:{ full_name:'Someone' } };
         syncProfileFromAuth(authUser); profile.department='Content'; profile.name='Someone'; saveProfile && saveProfile();
         switchView('admin'); switchView('tools'); maybeShowDeptPrompt();`);
    ok('a different account is asked too', shown());
    run('dismissDeptPrompt();'); await settle();

    /* an admin is never asked */
    run(`sessionStorage.setItem('swangz_preview_as_dept','0'); resetDeptPrompt();
         authUser = { id:'a', email:'arnoldkigozi0@gmail.com', user_metadata:{} }; syncProfileFromAuth(authUser);
         switchView('tools');`); await settle();
    run('maybeShowDeptPrompt();');
    ok('an admin is never asked', !shown(), 'role=' + run('currentRole()'));

    /* it must not lock the page */
    run(`sessionStorage.setItem('swangz_preview_as_dept','1'); resetDeptPrompt(); switchView('tools'); maybeShowDeptPrompt();`);
    ok('the question is on screen for this check', shown());
    const wrapper = run(`getComputedStyle(document.getElementById('deptPrompt')).pointerEvents`);
    eq('the wrapper takes no pointer events, so the page behind stays live', wrapper, 'none');
    const card = run(`getComputedStyle(document.querySelector('#deptPrompt .dp-card')).pointerEvents`);
    eq('only the card itself catches a click', card, 'auto');
  });
}

async function scenarioCustomRange() {
  if (only && !'custom'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('17 · A custom range reports exactly the days that were picked');
    run('__t.signIn(); switchView("admin");');

    /* Three reports on known days. One is filed at 1am — the hour that falls
       outside its own window if a date input is parsed as UTC instead of local. */
    run(`entries = [
      { id:'c1', toolName:'Alpha', department:'Production', status:'In use', tag:'report',
        submittedBy:'A', submittedAt: new Date(2026,6,20,12,0).toISOString() },
      { id:'c2', toolName:'Beta',  department:'Content',    status:'In use', tag:'report',
        submittedBy:'B', submittedAt: new Date(2026,7,1,1,0).toISOString() },
      { id:'c3', toolName:'Gamma', department:'Digital',    status:'In use', tag:'report',
        submittedBy:'C', submittedAt: new Date(2026,7,10,18,0).toISOString() }
    ]; saveEntries();`);

    ok('the period is chosen from one menu, not a row of buttons',
       run(`(function(){ const s = document.getElementById('execPeriodSel');
             return !!s && s.tagName === 'SELECT' && s.options.length === 6; })()`),
       run(`(document.getElementById('execPeriodSel')||{}).outerHTML||'missing'`).slice(0, 160));
    ok('every period the app knows is in the menu',
       run(`(function(){ const want = ['this-week','last-week','this-month','last-month','all','custom'];
             const got = [...document.getElementById('execPeriodSel').options].map(o => o.value);
             return want.every(v => got.includes(v)); })()`));
    eq('it opens on this month', run(`document.getElementById('execPeriodSel').value`), 'this-month');

    /* Choosing from the menu is a change event, which is what a real person fires */
    const pick = k => run(`(function(){ const s = document.getElementById('execPeriodSel');
      s.value = ${JSON.stringify(k)}; s.dispatchEvent(new Event('change', {bubbles:true}));
      return execPeriodKey; })()`);
    eq('picking a period from the menu applies it', pick('last-week'), 'last-week');
    eq('and picking the custom entry switches to it', pick('custom'), 'custom');

    const range = (from, to) => JSON.parse(run(
      `setExecPeriod('custom');
       document.getElementById('execFrom').value = ${JSON.stringify(from)};
       document.getElementById('execTo').value   = ${JSON.stringify(to)};
       applyExecCustom();
       (function(){ const w = execWindow('custom'), M = execBriefingModel();
         return JSON.stringify({ n: M.period.length, label: w.label, cadence: w.cadence,
                                 prev: (M.previous||{}).label || '' }); })()`));

    const aug = range('2026-08-01', '2026-08-10');
    eq('only the reports filed inside the range are counted', aug.n, 2);
    /* The wording follows the reader's locale, so assert the facts it must carry
       rather than one country's punctuation */
    ok('the range names both ends and the year',
       /August/.test(aug.label) && /2026/.test(aug.label) &&
       /\b1\b/.test(aug.label) && /\b10\b/.test(aug.label), aug.label);
    ok('a single day reads as one date, not a range',
       !/–|-/.test(range('2026-08-01', '2026-08-01').label),
       range('2026-08-01', '2026-08-01').label);
    eq('the briefing knows it is a custom span', aug.cadence, 'Custom');
    ok('the comparison names the span rather than a week or a month',
       /days before/.test(aug.prev), aug.prev);

    /* A single day proves both ends at once: the "to" day is included, and a
       1am filing belongs to its own day rather than the one before. */
    eq('a one-day range still catches what was filed at 1am', range('2026-08-01', '2026-08-01').n, 1);
    eq('the last day of the range is inside it', range('2026-07-20', '2026-08-01').n, 2);

    /* Dates the wrong way round are read the sensible way, not reported as empty */
    eq('a reversed pair is read the other way round', range('2026-08-10', '2026-08-01').n, 2);

    /* Half a range is not a range */
    const half = JSON.parse(run(
      `document.getElementById('execTo').value = ''; applyExecCustom();
       (function(){ const w = execWindow('custom');
         return JSON.stringify({ from: w.from, n: execBriefingModel().period.length }); })()`));
    ok('one date on its own falls back to everything to date', half.from === null, String(half.from));
    eq('and that fallback counts every report', half.n, 3);

    const note = run(`(document.getElementById('execCustomNote')||{}).textContent||''`);
    ok('and says so rather than reporting an empty window', /Pick both dates/i.test(note), note);

    /* The row itself only exists while custom is the chosen period */
    run(`setExecPeriod('this-month');`);
    ok('the date fields go away when another period is chosen',
       !run(`document.getElementById('execCustomRow').classList.contains('on')`));
  });
}

async function scenarioAdminAccess() {
  if (only && !'access'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('18 · Admin access is Swangz-only, and the owners are nowhere on show');

    /* The owner accounts are untouched — same role, same sign-in, same mail.
       Only what is drawn on screen changes. */
    run(`authUser = { id:'o', email:'marvinmusokessekatawa@gmail.com', user_metadata:{} };
         syncProfileFromAuth(authUser);`);
    eq('an owner still holds the owner role', run('currentRole()'), 'super');
    ok('and is still let through the sign-in gate',
       run(`isEmailAllowed('marvinmusokessekatawa@gmail.com')`));
    ok('and still receives the notification mail',
       run(`adminRecipients().includes('marvinmusokessekatawa@gmail.com')`),
       run(`JSON.stringify(adminRecipients())`));

    /* ...but the outbox does not print those addresses back at the reader */
    ok('the outbox shows the granted admins, not the owners',
       !/gmail\.com/.test(run(`saveExtraAdmins(['ops@swangzavenue.com']);
                               visibleRecipients(adminRecipients())`)),
       run(`saveExtraAdmins(['ops@swangzavenue.com']); visibleRecipients(adminRecipients())`));
    eq('a message addressed only to an owner shows a dash rather than naming them',
       run(`visibleRecipients(['marvinmusokessekatawa@gmail.com'])`), '—');

    /* Nor does the panel that used to list them */
    run(`__t.signIn();
         localStorage.setItem('swangz_ai_tracker_admins_v1', JSON.stringify(['ops@swangzavenue.com']));
         switchView('admin'); renderAdminsPanel();`);
    const panel = run(`(document.getElementById('adminsList')||{}).textContent||''`);
    ok('the granted admin is listed', /ops@swangzavenue\.com/.test(panel), panel);
    ok('no owner row is rendered', !/gmail\.com/.test(panel) && !/System owner/i.test(panel), panel);
    const meta = run(`(document.getElementById('acc_adminsMeta')||{}).textContent||''`);
    ok('and the count does not give away that owners exist', !/owner/i.test(meta), meta);

    const add = email => JSON.parse(run(
      `document.getElementById('newAdminEmail').value = ${JSON.stringify(email)};
       addAdminEmail();
       JSON.stringify({ list: extraAdmins(), said: (document.getElementById('toast')||{}).textContent||'' })`));

    const outside = add('someone@gmail.com');
    ok('an address outside the company is refused',
       !outside.list.includes('someone@gmail.com'), outside.list.join(','));
    ok('and is told why', /swangzavenue\.com/.test(outside.said), outside.said);

    const granted = add('newlead@swangzavenue.com');
    ok('a Swangz Avenue address is granted', granted.list.includes('newlead@swangzavenue.com'),
       granted.list.join(','));

    /* The form must not double as a way of asking who the owners are: an owner
       address has to be refused in exactly the words any outsider gets. */
    const probe = add('marvinmusokessekatawa@gmail.com');
    ok('an owner address is refused too', !probe.list.includes('marvinmusokessekatawa@gmail.com'));
    eq('and in words that single nobody out', probe.said, outside.said);

    const removed = JSON.parse(run(
      `removeAdminEmail('newlead@swangzavenue.com'); JSON.stringify(extraAdmins())`));
    ok('an admin can be taken off again', !removed.includes('newlead@swangzavenue.com'), removed.join(','));

    /* The empty state has to name the rule, and it reads ALLOWED_DOMAINS across
       the two script blocks — so prove that resolves rather than throwing */
    const empty = run(`saveExtraAdmins([]); renderAdminsPanel();
                       (document.getElementById('adminsList')||{}).textContent||''`);
    ok('with nobody granted, the panel says what kind of address is needed',
       /swangzavenue\.com/.test(empty), empty);

    /* Only an owner may hand the dashboard out */
    run(`authUser = { id:'s', email:'staff@swangzavenue.com', user_metadata:{} };
         syncProfileFromAuth(authUser);`);
    eq('an ordinary staff account is just a user', run('currentRole()'), 'user');
    const bounced = add('another@swangzavenue.com');
    ok('and cannot grant admin to anyone',
       !bounced.list.includes('another@swangzavenue.com'), bounced.list.join(','));

    /* A granted admin reaches the dashboard, and is not an owner */
    run(`saveExtraAdmins(['ops@swangzavenue.com']);   /* the empty-state check above cleared it */
         authUser = { id:'g', email:'ops@swangzavenue.com', user_metadata:{} };
         syncProfileFromAuth(authUser);`);
    eq('a granted admin is an admin', run('currentRole()'), 'admin');
    ok('but cannot change the list', !run(`isSuperAdmin('ops@swangzavenue.com')`));
  });

  /* The bug this replaced: the list lived in localStorage, so the grant was
     written on the granting owner's laptop and the person being promoted read
     their own empty copy for ever. "Added as admin, dashboard never changed." */
  await withApp(async ({ run, awaitInPage, settle }) => {
    suite('18b · A grant leaves the browser that made it');

    run(`__t.signIn(); __t.asDept(false);
         window.__sent = null;
         window.fetch = (url, opt) => { window.__sent = { url: String(url), body: opt && opt.body };
           return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); };`);
    eq('an owner can publish the admin list', await awaitInPage('configPushAdmins()'), 'true');
    const sent = JSON.parse(run(`JSON.stringify(window.__sent || {})`));
    ok('it goes to the shared config table, not to this browser',
       /\/rest\/v1\/app_config/.test(sent.url || ''), sent.url);
    ok('under its own key, beside the Drive folder',
       /"key"\s*:\s*"admin_emails"/.test(sent.body || ''), (sent.body || '').slice(0, 90));

    /* Granting is what actually has to publish it — not a separate button
       somebody has to remember to press afterwards. */
    run(`saveExtraAdmins([]); window.__sent = null;
         document.getElementById('newAdminEmail').value = 'ops@swangzavenue.com';
         addAdminEmail();`);
    await settle();
    ok('granting someone admin publishes the list by itself',
       /admin_emails/.test(run(`String((window.__sent || {}).body || '')`)));

    /* And the other end: a pull makes somebody an admin on their own machine */
    run(`saveExtraAdmins([]);
         authUser = { id:'u', email:'ops@swangzavenue.com', user_metadata:{} };
         syncProfileFromAuth(authUser);`);
    eq('before the pull they are an ordinary user', run(`currentRole()`), 'user');
    run(`window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(
           [{ key: 'admin_emails', value: { emails: ['ops@swangzavenue.com'] } }]) });`);
    await awaitInPage('configPull()');
    eq('after it they hold the admin role', run(`currentRole()`), 'admin');
    eq('and the door in their account menu has opened',
       run(`renderAccountMenu(); !!document.querySelector('#accountMenu button:not(.is-locked) .sm-txt')
            && /Admin dashboard(?! \\(no)/.test(document.getElementById('accountMenu').textContent)`), true);

    /* An unreachable table must never be read as "there are no admins" */
    run(`window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) });`);
    await awaitInPage('configPull()');
    eq('an empty config does not quietly take admin away', run(`currentRole()`), 'admin');

    /* Postgres has to enforce it too — the owner-only check in the app runs on
       the grantee's own machine and proves nothing. */
    const fs = require('fs'), path = require('path');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
    const live = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    ok('the database knows who the owners are', /function public\.is_swangz_owner/.test(live));
    ok('and only they may write the admin list',
       (live.match(/admin_emails/g) || []).length >= 2, String((live.match(/admin_emails/g) || []).length));
  });

  /* The password used to be one shared secret: whoever opened the dashboard
     first chose it and every other admin typed that same string, so it said
     nothing about who was reading the company's figures. */
  await withApp(async ({ run, awaitInPage }) => {
    suite('18c · The admin password belongs to the admin');

    run(`__t.signIn(); __t.asDept(false); adminUnlocked = false;`);
    await awaitInPage(`setAdminPassFor('one@swangzavenue.com', 'correct horse')`);
    ok('a password set for one admin verifies for them',
       JSON.parse(await awaitInPage(`verifyAdminPass('one@swangzavenue.com', 'correct horse')`)));
    ok('and does not let a different admin in',
       !JSON.parse(await awaitInPage(`verifyAdminPass('two@swangzavenue.com', 'correct horse')`)));
    ok('nor the same admin with the wrong password',
       !JSON.parse(await awaitInPage(`verifyAdminPass('one@swangzavenue.com', 'correct horsey')`)));

    /* Stretched, not a bare digest — a short password would not survive one */
    const rec = JSON.parse(run(`JSON.stringify(adminPassRecord('one@swangzavenue.com'))`));
    ok('it is salted', !!rec.salt && rec.salt.length >= 32, String(rec.salt || '').length);
    ok('and stretched rather than hashed once', rec.iters >= 100000, String(rec.iters));

    /* Upgrading must not lock out the owner who set the old shared one */
    run(`localStorage.removeItem('swangz_admin_pass_v2');`);
    await awaitInPage(`(async () => { settings.adminPasswordHash = await hashPassword('oldshared'); saveSettings(); })()`);
    ok('the old shared password still opens it once',
       JSON.parse(await awaitInPage(`adoptLegacyAdminPassword('one@swangzavenue.com', 'oldshared')`)));
    ok('and becomes that admin\'s own from then on',
       JSON.parse(await awaitInPage(`verifyAdminPass('one@swangzavenue.com', 'oldshared')`)));
  });
}

async function scenarioDriveFolder() {
  if (only && !'drive'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('19 · The Drive folder is set once by an admin and reaches everyone');
    const settle = ms => new Promise(r => setTimeout(r, ms || 250));
    /* Resolve a promise created inside the page, since run() is a plain eval */
    const awaitInPage = async (expr, ms) => {
      run(`window.__r = undefined; (${expr}).then(v => { window.__r = JSON.stringify(v === undefined ? null : v); });`);
      await settle(ms);
      return run(`window.__r`);
    };

    run('__t.signIn(); switchView("admin");');

    /* Only a real Drive location counts as one */
    ok('a Drive folder is accepted', run(`isDriveLink('https://drive.google.com/drive/folders/abc')`));
    ok('a docs.google.com link is accepted', run(`isDriveLink('https://docs.google.com/document/d/1')`));
    ok('anything else is refused', !run(`isDriveLink('https://dropbox.com/x')`));
    ok('and so is a javascript: URL', !run(`isDriveLink('javascript:alert(1)')`));

    /* It is configuration, not money. An admin looks for a folder under
       Settings, and the Money tab is for figures only. */
    ok('the folder field lives in Company Settings',
       run(`!!document.querySelector('#acc_company #cfg_drive')`));
    ok('and no longer sits in Money & Pricing',
       !run(`!!document.querySelector('#acc_finance input[type="url"]')`));
    eq('Company Settings opens from the Settings door',
       run(`(groupOf('acc_company') || {}).label`), 'Settings');
    ok('and the palette can still reach it',
       run(`paletteCommands().some(c => /Company Settings/i.test(c.label))`));

    /* The shared row lives in the project the whole team already reads */
    const creds = JSON.parse(run(`JSON.stringify(configCreds())`));
    ok('the folder is read from the shared project, not this browser',
       /\/rest\/v1\/app_config$/.test(creds.ep), creds.ep);

    /* Pulling applies the company's choice to whoever opened the page. One
       request carries every setting, so the rows are keyed. */
    run(`window.__realFetch = window.fetch;
         window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(
           [{ key: 'drive_folder', value: { url: 'https://drive.google.com/drive/folders/COMPANY' } }]) });
         settings.driveFolderUrl = ''; saveSettings();`);
    await awaitInPage('configPull()');
    eq('a pull brings the company folder down',
       run(`settings.driveFolderUrl`), 'https://drive.google.com/drive/folders/COMPANY');
    eq('and the upload button now has somewhere to go',
       run(`driveFolderUrl()`), 'https://drive.google.com/drive/folders/COMPANY');

    /* A folder that is not a Drive link never reaches the button, however it got there */
    run(`settings.driveFolderUrl = 'https://dropbox.com/team'; saveSettings();`);
    eq('a non-Drive folder is ignored rather than opened', run(`driveFolderUrl()`), '');

    /* A department user has no say: the write is refused before it is attempted */
    run(`__t.asDept(true);`);
    eq('a department user cannot publish a folder', await awaitInPage('configPushDrive()'), 'null');

    /* An admin can */
    run(`__t.asDept(false);
         settings.driveFolderUrl = 'https://drive.google.com/drive/folders/NEW'; saveSettings();
         window.__sent = null;
         window.fetch = (url, opt) => { window.__sent = { url: String(url), body: opt && opt.body };
           return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); };`);
    eq('an admin can publish it for the team', await awaitInPage('configPushDrive()'), 'true');
    const sent = JSON.parse(run(`JSON.stringify(window.__sent)`) || 'null');
    ok('it upserts the one config row rather than adding another',
       !!sent && /on_conflict=key/.test(sent.url), sent && sent.url);
    ok('and sends the folder the admin chose',
       !!sent && /drive\.google\.com\/drive\/folders\/NEW/.test(sent.body), sent && sent.body);

    /* A failure is reported, not swallowed into a false "saved" */
    run(`window.fetch = () => Promise.resolve({ ok: false, status: 401,
           text: () => Promise.resolve('denied') });`);
    eq('a refused write reports itself', await awaitInPage('configPushDrive()'), 'false');

    run(`window.fetch = window.__realFetch;`);
  });
}

/* Everybody lands in their own department, an admin included — an admin is a
   member of staff with a second job, and the dashboard is that second job. The
   view tabs are hidden by CSS with !important, so this is only safe while
   there is a visible door: take the rail button away and this is once again
   the bug where an owner is stranded in the department view with no way out. */
async function scenarioSignInRouting() {
  if (only && !'routing'.includes(only)) return;
  await withApp(async ({ run }) => {
    suite('20 · Signing in puts you where your role belongs');

    /* The tabs really are gone — this is why the door has to be right */
    ok('the view tabs are hidden, so the rail door is the only way across',
       run(`getComputedStyle(document.querySelector('.view-toggle')).display`) === 'none');

    run(`__t.signIn(); __t.asDept(false);
         profile.department='Production'; profile.name='Arnold'; profile.role='Redesign Lead'; saveProfile();
         switchView('auth');
         routeSignedIn();`);
    eq('an owner lands in their own department, like everyone else', run('currentView'), 'tools');
    eq('and is still recognised as an owner', run('currentRole()'), 'super');

    /* The door that makes the line above safe. It is NOT a rail button — the
       rail lists sections — it lives in the account menu, which is the one
       piece of chrome both the portal and the department side share. */
    ok('the rail carries no admin button of its own',
       !run(`!!document.getElementById('railAdminBtn')`));
    ok('the account block opens a menu instead', !!run(`!!document.getElementById('railWho')`));
    run(`openAccountMenu();`);
    ok('and that menu carries the way into the dashboard',
       /Admin dashboard/.test(run(`document.getElementById('accountMenu').textContent`)),
       run(`document.getElementById('accountMenu').textContent`).slice(0, 90));
    ok('not locked, for somebody who has access',
       !run(`!!document.querySelector('#accountMenu .is-locked')`));
    run(`closeAccountMenu();`);
    ok('the profile menu names it too, for anyone who missed it',
       !run(`document.getElementById('pmAdminBtn').hidden`));
    /* The harness signs in pre-unlocked for convenience; lock it so this is a
       real arrival at the door rather than a walk through an open one. */
    run(`adminUnlocked = false; openAdminDashboard();`);
    eq('pressing it opens the dashboard', run('currentView'), 'admin');
    eq('which asks before it shows anything',
       run(`document.getElementById('adminContent').style.display`), 'none');
    run(`openAccountMenu();`);
    ok('and the same entry is now the way back',
       /Your department/.test(run(`document.getElementById('accountMenu').textContent`)),
       run(`document.getElementById('accountMenu').textContent`).slice(0, 90));
    run(`closeAccountMenu();`);
    run(`openAdminDashboard();`);
    eq('which it does', run('currentView'), 'tools');
    ok('and leaving locks the dashboard again', !run('adminUnlocked'));

    /* A department user gets the same door, visibly shut */
    run(`__t.asDept(true);
         profile.department='Production'; profile.name='Ivan'; profile.role='Editor'; saveProfile();
         routeSignedIn();`);
    eq('a department user lands in their own view', run('currentView'), 'tools');
    run(`openAccountMenu();`);
    ok('the door is named for them too, so it is not a secret',
       /Admin dashboard/.test(run(`document.getElementById('accountMenu').textContent`)));
    ok('but it is visibly shut', !!run(`!!document.querySelector('#accountMenu .is-locked')`));
    run(`closeAccountMenu();`);
    run(`openAdminDashboard();`);
    eq('and pressing it leaves them where they are', run('currentView'), 'tools');
    ok('they are offered no dashboard command either',
       !run(`paletteCommands().some(c => /Open the Admin Dashboard/i.test(c.label))`));

    /* The safety net: the rail is empty outside the admin view, so every
       section command is missing there — the door must not depend on it. */
    run(`__t.asDept(false); switchView('tools');`);
    ok('an admin can reach the dashboard from the palette with an empty rail',
       run(`paletteCommands().some(c => /Open the Admin Dashboard/i.test(c.label))`));
    run(`paletteCommands().find(c => /Open the Admin Dashboard/i.test(c.label)).run();`);
    eq('and that command actually opens it', run('currentView'), 'admin');

    /* Who may sign in at all */
    ok('an owner is allowed', run(`isEmailAllowed('arnoldkigozi0@gmail.com')`));
    ok('the org domain is allowed', run(`isEmailAllowed('someone@swangzavenue.com')`));
    ok('a stranger is refused', !run(`isEmailAllowed('random.person@gmail.com')`));
    ok('and so is a look-alike domain', !run(`isEmailAllowed('someone@notswangzavenue.com')`));
    ok('and an address that merely ends with the domain',
       !run(`isEmailAllowed('someone@evil-swangzavenue.com')`));

    /* The database enforces the same list. If these two ever drift, a real
       member of staff gets a silent denial from Postgres that no amount of
       reading index.html would explain. */
    const fs = require('fs');
    const sql = fs.readFileSync(require('path').join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
    /* Only what Postgres will actually run: the file documents the rollback in
       comments, and those legitimately contain the old permissive policies. */
    const live = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    ok('the schema screens on the exact domain, not a suffix match',
       /split_part\(lower\(coalesce\(auth\.jwt\(\) ->> 'email', ''\)\), '@', 2\) = 'swangzavenue\.com'/.test(live));
    ok('no policy it runs lets just any signed-in account at the entries',
       !/using \(true\)/.test(live) && /is_swangz_staff\(\)/.test(live));
    ok('and the way back is written down next to them',
       /drop policy if exists "staff read entries"/.test(sql.split('\n').filter(l => l.trim().startsWith('--')).join('\n')));
    const owners = JSON.parse(run(`JSON.stringify(SUPER_ADMINS)`));
    const inSql = owners.filter(o => sql.includes(o));
    eq('every owner in the app is an owner in the database too', inSql.length, owners.length);

    /* And you can get back out. The profile badge that carries "Sign out" is
       inside #toolsView, so an admin routed into the portal had it sitting in
       a hidden section — no sign-out anywhere, not even a button. */
    run(`__t.signIn(); __t.asDept(false); switchView('admin'); applyRoleChrome();`);
    const acct = JSON.parse(run(`(function () {
      var el = document.getElementById('railAccount');
      return JSON.stringify({
        present: !!el,
        hidden: el ? el.hidden : null,
        outsideEveryView: el ? !el.closest('section.view') : null,
        hasSignOut: el ? !!el.querySelector('.ra-out[onclick*="signOut"]') : null,
        role: (document.getElementById('railRole') || {}).textContent,
        name: (document.getElementById('railName') || {}).textContent
      });
    })()`));
    ok('the rail carries an account block', acct.present);
    ok('it sits outside every view, so the portal cannot hide it', acct.outsideEveryView);
    ok('an owner in the portal can see it', acct.hidden === false);
    eq('it says which role they hold', acct.role, 'System owner');
    ok('and it carries a way to sign out', acct.hasSignOut);
    ok('signing out asks first rather than just going',
       /guardWith\('signOut'/.test(run(
         `[...document.querySelectorAll('script')].map(s=>s.textContent).join('')`)));

    /* It must not linger once nobody is signed in */
    run(`authUser = null;
         profile = { department:'', name:'', role:'', email:'', avatarUrl:'' };
         saveProfile(); applyRoleChrome();`);
    ok('and it is gone when nobody is signed in',
       run(`document.getElementById('railAccount').hidden`) === true);
  });
}

/* The rail's search was a bare <button>, so it rendered as the browser's own
   grey 3D button next to fields that are all hairline glass. */
async function scenarioSearchLook() {
  if (only && !'search'.includes(only)) return;
  await withApp(async ({ doc, run }) => {
    suite('21 · Every search box reads as the same thing');

    /* Every style block, not just the first — the head carries a small
       @font-face block ahead of the main stylesheet. */
    const css = run(`[...document.querySelectorAll('style')].map(s => s.textContent).join('\\n')`);

    /* Every box that says "Search" is dressed as one */
    run(`__t.signIn(); switchView('admin'); renderAdmin();`);
    /* The rule is "a magnifier, one way or the other": the shared class draws
       it into the field, and the palette — which is a wrapper with a real
       SVG beside the input — is allowed to keep its own rather than end up
       with two. What is not allowed is a search box with neither. */
    const boxes = JSON.parse(run(`JSON.stringify(
      [...document.querySelectorAll('input[placeholder]')]
        .filter(i => /^search/i.test(i.placeholder))
        .map(i => ({
          id: i.id,
          tagged: i.classList.contains('search-input'),
          ownIcon: !!(i.parentElement && i.parentElement.querySelector('svg'))
        })))`));
    ok('there are search boxes to check', boxes.length >= 3, boxes.length + ' found');
    const bare = boxes.filter(b => !b.tagged && !b.ownIcon).map(b => b.id || '(no id)');
    eq('none of them is left without a magnifier', bare.join(',') || 'none', 'none');
    const plain = boxes.filter(b => !b.ownIcon);
    ok('and the ordinary ones all share one treatment rather than each its own',
       plain.length >= 3 && plain.every(b => b.tagged),
       plain.map(b => b.id + ':' + b.tagged).join(' '));

    ok('which sets a magnifier inside the field',
       /\.search-input\s*\{[^}]*background-image:\s*url\("data:image\/svg\+xml/.test(css));

    /* The bug that would silently undo it */
    ok('the focus rule sets background-color, not the background shorthand',
       /input:focus[^{]*\{[^}]*background-color:/.test(css) &&
       !/input:focus[^{]*\{[^}]*[^-]background:\s*rgba/.test(css));

    /* The rail hint must not fall back to native button chrome */
    const hint = css.match(/\.rail-hint\s*\{[^}]*\}/);
    ok('the rail search declares its own surface', !!hint && /background-color:/.test(hint[0]));
    ok('and its own corners, rather than a square native button',
       !!hint && /border-radius:/.test(hint[0]));
    ok('and its own border', !!hint && /border:\s*1px solid/.test(hint[0]));
    ok('and the app\'s own typeface', !!hint && /font-family:\s*inherit/.test(hint[0]));
    ok('the rail search is still the way into the palette',
       !!doc.querySelector('.rail-hint[onclick*="openPalette"]'));
  });
}

/* A report had no inbox — the only routes to one were Tools Entered, which
   consolidates by tool and loses who filed what, and Manage Submissions, which
   is for fixing attribution. The thing the tracker exists to collect was the
   thing an admin could not sit down and work through. */
async function scenarioReportsInbox() {
  if (only && !'reports'.includes(only)) return;
  await withApp(async ({ run, doc }) => {
    suite('22 · Reports have an inbox of their own');

    run(`__t.signIn(); seedDemoData(true); adminUnlocked = true; switchView('admin'); renderAdmin();`);

    ok('there is a Reports Inbox section', !!doc.getElementById('acc_reports'));
    eq('it opens from the Tools door, beside the Requests Inbox',
       run(`(groupOf('acc_reports') || {}).label`), 'Tools');
    eq('and so does the Requests Inbox', run(`(groupOf('acc_requests') || {}).label`), 'Tools');
    ok('the Requests door is gone from the rail — it was almost always empty',
       !run(`RAIL_GROUPS.some(g => g.id === '__requests')`));

    /* Deliberately the same shape as the requests inbox: same job, two kinds */
    ok('it filters like the requests inbox does', !!doc.getElementById('repStatusFilter'));
    ok('and searches like it', !!doc.getElementById('repSearch'));

    run(`showAdminSection('acc_reports'); renderReportsInbox();`);
    const rows = run(`document.querySelectorAll('#reportsInboxList .deck-row').length`);
    ok('every reported tool is listed', rows > 0, String(rows));
    eq('and requests are not among them, they have their own list',
       run(`reportEntries().filter(e => e.tag === 'request').length`), 0);
    ok('a row opens the same working tile a request opens',
       run(`/DECK.open\\('entry'/.test(document.getElementById('reportsInboxList').innerHTML)`));

    /* The filters that answer "what is waiting on me" */
    run(`document.getElementById('repStatusFilter').value = '__unpriced'; renderReportsInbox();`);
    ok('it can show only what has not been priced',
       run(`document.querySelectorAll('#reportsInboxList .deck-row').length`) <= rows);
    run(`document.getElementById('repStatusFilter').value = ''; renderReportsInbox();`);

    /* A status of its own — a report is not approved or declined, it is
       checked. And it must never be filtered out of the company's figures. */
    const before = run(`filteredEntries().length`);
    run(`const first = reportEntries()[0]; setReportStatus(first.id, 'returned');`);
    eq('marking a report does not change the figures it feeds', run(`filteredEntries().length`), before);
    eq('the status is recorded on the entry', run(`reportEntries().some(e => e.reportStatus === 'returned')`), true);

    /* The badge has to count the work, not one corner of it */
    run(`document.querySelectorAll('#reportsInboxList .deck-row');`);
    ok('the Tools badge counts unread reports as well as unread requests',
       run(`inboxPending()`) >= run(`requestEntries().filter(e => (e.requestStatus||'new') === 'new').length`));

    /* The two documents the whole thing exists to produce are named on the
       rail rather than folded behind a word that describes neither */
    ok('the Executive Report is on the rail itself', !run(`groupOf('acc_exec')`));
    ok('and so is the Core Business Case', !run(`groupOf('acc_business')`));
    const rail = run(`JSON.stringify([...document.querySelectorAll('#adminNav > button:not(.is-grouped), .rail-group')]
        .map(b => (b.querySelector('.nav-label') || b).textContent.trim()))`);
    eq('and the rail reads in the order the work happens', JSON.parse(rail).join(' › '),
       'Overview › Tools › Money › Executive Report › Core Business Case › Settings');

    /* Settings is one door, not five loose entries */
    ['acc_company', 'acc_notify', 'acc_admins', 'acc_actions', 'acc_backend'].forEach(id =>
      eq(id.replace('acc_', '') + ' is under Settings', run(`(groupOf('${id}') || {}).label`), 'Settings'));
  });

  /* The same split on the person's own side */
  await withApp(async ({ run, doc }) => {
    suite('23 · Your own list is two lists');

    run(`__t.signIn(); __t.asDept(true); seedDemoData(true);
         profile.department='Production'; profile.name='Marvin Musoke'; profile.email='marvin@swangzavenue.com'; saveProfile();
         entries.filter(e => e.isDemo).slice(0, 4).forEach((e, i) => {
           e.submittedByEmail = 'marvin@swangzavenue.com';
           if (i >= 2) { e.tag = 'request'; e.requestStatus = 'new'; }
         });
         saveEntries(); switchView('tools'); renderToolsList();`);

    const tabs = run(`[...document.querySelectorAll('.mytools-tabs button')].map(b => b.dataset.tab).join(',')`);
    eq('there are two tabs, reported and requested', tabs, 'report,request');
    ok('and each carries its own count',
       run(`document.querySelectorAll('.mytools-tabs .mt-count').length`) === 2);
    eq('it opens on what you have reported', run(`myToolsTab`), 'report');
    ok('showing only reports',
       run(`myEntries().filter(e => e.tag !== 'request').length`) ===
       run(`document.querySelectorAll('.tools-table tbody tr').length`));
    ok('and the Type column is gone, because the tab already says it',
       !/>Type</.test(run(`document.getElementById('toolsList').innerHTML`)));
    ok('a report now shows what the admin has done about it',
       /Where it stands/i.test(run(`document.getElementById('toolsList').innerHTML`)));

    run(`setMyToolsTab('request');`);
    eq('the other tab shows only requests',
       run(`document.querySelectorAll('.tools-table tbody tr').length`),
       run(`myEntries().filter(e => e.tag === 'request').length`));

    /* An empty tab has to explain itself rather than look broken */
    run(`entries.forEach(e => { if (e.tag === 'request') e.tag = 'report'; }); saveEntries(); renderToolsList();`);
    /* jsdom has no innerText — textContent is the honest read here */
    ok('an empty tab says what would put something in it',
       /Request a new tool/i.test(run(`document.getElementById('toolsList').textContent`)),
       String(run(`document.getElementById('toolsList').textContent`) || '').slice(0, 90));
    ok('and the tabs are still there to get back',
       run(`document.querySelectorAll('.mytools-tabs button').length`) === 2);
  });
}

/* The tool name was an <input list="toolRegistry">. A native datalist filters
   itself against what is already in the field, so once a tool had been picked
   the list held exactly one entry — its own — and the dropdown read as dead.
   You could not change your mind without clearing the field first. */
async function scenarioToolPicker() {
  if (only && !'picker'.includes(only)) return;
  await withApp(async ({ run, doc }) => {
    suite('24 · You can change your mind about the tool');

    run(`__t.signIn(); __t.asDept(true);
         profile.department='Production'; profile.name='Marvin'; saveProfile();
         switchView('tools'); chooseAddType('report');`);

    const input = doc.getElementById('f_toolName');
    ok('the field is no longer bound to a native datalist', !input.getAttribute('list'));
    eq('it is a combobox', input.getAttribute('role'), 'combobox');
    ok('with a control that opens it', !!doc.getElementById('toolComboBtn'));

    const total = run(`toolPickerRows().length`);
    ok('the registry has tools to offer', total > 10, String(total));

    run(`toolPickerOpen();`);
    eq('an empty field offers everything', run(`toolPickerMatches('').length`), total);
    ok('typing narrows it', run(`toolPickerMatches('run').length`) < total);
    ok('and still finds the tool', run(`toolPickerMatches('run').some(t => /runway/i.test(t.name))`));

    /* The bug itself */
    run(`toolPickerChoose('Runway');`);
    eq('choosing one fills the field', run(`document.getElementById('f_toolName').value`), 'Runway');
    eq('and the field\'s own handlers ran, so the official site came with it',
       run(`document.getElementById('f_officialUrl').value`), 'https://runwayml.com/');
    eq('re-opening on a settled field offers every tool, not just the chosen one',
       run(`toolPickerMatches('Runway').length`), total);
    run(`toolPickerOpen();`);
    eq('so the list is there to change your mind with',
       run(`document.querySelectorAll('#toolComboList .combo-item').length`), total);
    ok('and the one already chosen is marked',
       run(`!!document.querySelector('#toolComboList .combo-item.picked')`));

    /* Not clipped: the wizard step is its own scroller */
    eq('the list hangs off the body so nothing can crop it',
       run(`document.getElementById('toolComboList').parentNode === document.body`), true);
    ok('and it is fixed rather than flowing inside the wizard',
       /\.combo-list\s*\{[^}]*position:\s*fixed/.test(
         [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n')));

    /* A tool nobody has recorded is a legitimate answer */
    /* A name genuinely nobody has recorded — Sora et al are built in */
    run(`document.getElementById('f_toolName').value = 'Nyege Nyege Cutter'; toolPickerOpen();`);
    ok('an unknown name is offered rather than refused',
       /Use “Nyege Nyege Cutter”/.test(run(`document.getElementById('toolComboList').innerHTML`)),
       String(run(`document.getElementById('toolComboList').textContent`) || '').slice(0, 80));

    run(`toolPickerClose();`);
    eq('closing hides it', run(`document.getElementById('toolComboList').hidden`), true);
    run(`closeWizard();`);
    eq('and closing the wizard cannot leave it floating over the page',
       run(`document.getElementById('toolComboList').hidden`), true);
  });
}

/* Mail has never actually sent, and the one route that would have tried was
   destructive: the app POSTed {kind:'notify'} and the Apps Script dispatched
   on `action`, defaulting to 'replaceAll' — so pointing the mail endpoint at
   the sheet would have replaced every row with an empty list. */
async function scenarioMail() {
  if (only && !'mail'.includes(only)) return;
  const fs = require('fs'), path = require('path');
  const gs = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

  await withApp(async ({ run, doc, settle }) => {
    suite('25 · Mail actually goes, and cannot wipe the sheet');

    ok('the script no longer defaults an actionless POST to replaceAll',
       !/const action = body\.action \|\| 'replaceAll'/.test(gs));
    ok('it refuses to guess instead', /refusing to guess/.test(gs));
    ok('and it knows how to send one', /action === 'notify'/.test(gs));
    ok('with the quiet copies kept quiet', /opts\.bcc\s*=/.test(gs));

    run(`__t.signIn(); __t.asDept(false); seedDemoData(true); adminUnlocked = true;`);
    run(`const s = notifySettings();
         s.endpoint = 'https://example.invalid/exec'; s.method = 'endpoint';
         s.bcc = ['gm@swangzavenue.com']; saveNotifySettings(s);
         window.__posts = [];
         window.fetch = (url, opt) => { window.__posts.push(JSON.parse(opt.body));
           return Promise.resolve({ ok: true, text: () => Promise.resolve('{"ok":true,"quotaLeft":97}') }); };`);

    run(`const e = entries.find(x => x.tag !== 'request');
         e.submittedByEmail = 'ivan@swangzavenue.com'; saveEntries();
         window.__eid = e.id;`);
    run(`setReportStatus(window.__eid, 'confirmed');`);
    await settle(300);
    const posts = JSON.parse(run(`JSON.stringify(window.__posts)`));
    eq('confirming a report sends exactly one message', posts.length, 1);
    eq('it names the action, so the script cannot mistake it for a wipe', posts[0].action, 'notify');
    ok('it is addressed to the person who filed it',
       (posts[0].to || []).includes('ivan@swangzavenue.com'), JSON.stringify(posts[0].to));
    ok('the standing copy list rides on BCC, never CC',
       (posts[0].bcc || []).includes('gm@swangzavenue.com') && !(posts[0].cc || []).length);
    ok('and it reads as a report being confirmed, not a request being approved',
       /confirmed/i.test(posts[0].subject) && /business case/i.test(posts[0].body), posts[0].body.slice(0, 80));
    eq('the outbox records it as sent', run(`outbox().filter(m => m.entryId === window.__eid)[0].state`), 'sent');
    eq('and the sending quota it reported is kept', run(`mailQuotaLeft`), 97);

    /* Apps Script answers 200 for its own error pages too, so the status code
       proves nothing. This is not hypothetical: the first real deployment
       returned "Script function not found: doPost" — HTTP 200, HTML body — and
       the old code swallowed the JSON.parse error and marked the message SENT.
       Somebody would have been waiting on mail that never left. */
    run(`window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(
           '<html><title>Error</title><body>Script function not found: doPost</body></html>') });
         const e3 = entries.filter(x => x.tag !== 'request')[2]; window.__eid3 = e3.id;
         setReportStatus(window.__eid3, 'confirmed');`);
    await settle(300);
    eq('an HTML error page is a failure, not a send',
       run(`outbox().filter(m => m.entryId === window.__eid3)[0].state`), 'failed');
    ok('and it says how to fix that exact deployment mistake',
       /new version/i.test(run(`outbox().filter(m => m.entryId === window.__eid3)[0].error`)),
       run(`outbox().filter(m => m.entryId === window.__eid3)[0].error`).slice(0, 90));

    /* The reply reader, on every shape the endpoint can answer with */
    eq('valid JSON saying ok is a send',
       run(`readMailReply('{"ok":true,"quotaLeft":97}').ok`), true);
    eq('and the quota it reports is kept',
       run(`readMailReply('{"ok":true,"quotaLeft":97}').data.quotaLeft`), 97);
    eq('a sign-in page is caught by name',
       run(`/sign in/i.test(readMailReply('<html>accounts.google.com/ServiceLogin Sign in</html>').why)`), true);
    eq('so is a missing authorisation',
       run(`/authoris/i.test(readMailReply('<html>Authorization is required</html>').why)`), true);
    eq('an empty reply is never a send', run(`readMailReply('').ok`), false);
    eq('and neither is any other web page', run(`readMailReply('<html>hello</html>').ok`), false);

    /* A 200 carrying { ok:false } is a refusal, not a success */
    run(`window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve('{"ok":false,"error":"forbidden"}') });
         const e2 = entries.filter(x => x.tag !== 'request')[1]; window.__eid2 = e2.id;
         setReportStatus(window.__eid2, 'returned');`);
    await settle(300);
    eq('a 200 that says it refused is recorded as a failure',
       run(`outbox().filter(m => m.entryId === window.__eid2)[0].state`), 'failed');

    /* The admin decides who is copied on THIS message */
    run(`DECK.open('decide', window.__eid);`);
    ok('the action tile offers the quiet-copy choice', !!doc.getElementById('dc_bcc'));
    ok('and a place to copy someone once', !!doc.getElementById('dc_bccExtra'));
    ok('and the price, so deciding and pricing are one errand', !!doc.getElementById('dc_sub'));
    run(`document.getElementById('dc_bcc').checked = false;
         document.getElementById('dc_bccExtra').value = 'once@swangzavenue.com';`);
    eq('unticking drops the standing list but keeps the one-off',
       run(`JSON.stringify(decideBccList())`), '["once@swangzavenue.com"]');

    /* A department user must not find the buttons that decide their own entry.
       The tile is closed first: the Deck keeps an open tile as it was built,
       so reopening the same key would otherwise measure the admin's copy. */
    run(`DECK.closeAll(true); __t.asDept(true); DECK.open('decide', window.__eid);`);
    ok('a department user is not shown the decision buttons',
       run(`document.querySelectorAll('.decide-btn').length`) === 0);
  });

  /* A public request is an anonymous insert from a browser with no session and
     therefore no mail settings to read — so the one route built for people
     outside the company told nobody. The first admin to load sends it. */
  await withApp(async ({ run, settle }) => {
    suite('25b · A public request does not arrive in silence');

    run(`__t.signIn(); __t.asDept(false);
         localStorage.removeItem('swangz_public_announced_v1');
         const s = notifySettings(); s.endpoint = ''; saveNotifySettings(s);
         entries = entries.filter(e => !e.isPublic);
         entries.push({ id: 'pub1', kind:'tool', tag:'request', requestStatus:'new', isPublic:true,
           toolName:'HeyGen', department:'Marketing', submittedBy:'A stranger',
           submittedByEmail:'brian@swangzavenue.com', submittedAt:new Date().toISOString() });
         saveEntries();`);

    eq('the first run takes a baseline rather than mailing the whole backlog',
       run(`announcePublicRequests()`), 0);
    eq('so nothing was queued for it', run(`outbox().filter(m => m.entryId === 'pub1').length`), 0);

    run(`entries.push({ id: 'pub2', kind:'tool', tag:'request', requestStatus:'new', isPublic:true,
           toolName:'Descript', department:'Content', submittedBy:'Someone else',
           submittedByEmail:'joel@swangzavenue.com', submittedAt:new Date().toISOString() });
         saveEntries();`);
    eq('one that turns up afterwards is announced', run(`announcePublicRequests()`), 1);
    eq('exactly once, however many times the page syncs', run(`announcePublicRequests()`), 0);
    eq('and it went to the admins', run(`outbox().filter(m => m.entryId === 'pub2')[0].to.length`) > 0, true);

    /* Never from a department user's browser — they cannot see the inbox and
       must not be the ones sending the company's mail. */
    run(`__t.asDept(true);
         entries.push({ id: 'pub3', kind:'tool', tag:'request', requestStatus:'new', isPublic:true,
           toolName:'Kling', department:'Events', submittedBy:'Third', submittedAt:new Date().toISOString() });
         saveEntries();`);
    eq('a department user announces nothing', run(`announcePublicRequests()`), 0);
    await settle(50);
  });

  /* Evidence has to be visible, and it lives wherever the work lives */
  await withApp(async ({ run }) => {
    suite('26 · Media is shown, from wherever it lives');

    run(`__t.signIn(); __t.asDept(false);`);
    const kind = u => JSON.parse(run(`JSON.stringify(mediaKind(${JSON.stringify(u)}))`) || 'null');

    eq('a YouTube watch link becomes a player',
       kind('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embed,
       'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    eq('so does a youtu.be one', kind('https://youtu.be/abc123XYZ').embed,
       'https://www.youtube-nocookie.com/embed/abc123XYZ');
    eq('and a Vimeo link', kind('https://vimeo.com/123456789').embed, 'https://player.vimeo.com/video/123456789');
    eq('a Drive file gets its preview', kind('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view').embed,
       'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/preview');
    eq('a Drive folder has no preview to give', kind('https://drive.google.com/drive/folders/XYZ').embed, '');
    eq('an image is an image', kind('https://cdn.example.com/a/cover.jpg').kind, 'image');
    /* A Dropbox share URL ends .mov but serves a web page — host before extension */
    eq('a Dropbox share link is a link, not a broken video player',
       kind('https://dropbox.com/s/xyz/cut.mov').kind, 'link');
    eq('and it is named', kind('https://dropbox.com/s/xyz/cut.mov').label, 'Dropbox');
    eq('an unknown host is named by its host', kind('https://films.example.co.ug/reel').label, 'films.example.co.ug');
    eq('and it is never framed', kind('https://films.example.co.ug/reel').embed, '');
    eq('a javascript: URL is not media at all', kind('javascript:alert(1)'), null);

    /* And the rule that used to refuse everything but Drive */
    run(`profile.department='Production'; profile.name='M'; saveProfile();
         switchView('tools'); chooseAddType('report');
         document.getElementById('f_toolName').value = 'Runway';
         document.getElementById('f_toolName').dispatchEvent(new Event('input', { bubbles: true }));
         const o = [...document.getElementById('f_category').options].find(x => x.value);
         document.getElementById('f_category').value = o.value;
         document.getElementById('f_persistInRegistry').checked = true;
         addProject({ id:'p1', name:'Reel', link:'https://vimeo.com/123456789', description:'', traditional:'', aiWay:'', benefit:'' });`);
    const before = run(`entries.length`);
    run(`saveDetail();`);
    ok('a Vimeo link no longer blocks saving', run(`entries.length`) > before,
       'entries ' + before + ' → ' + run(`entries.length`));
    run(`addProject({ id:'p2', name:'Bad', link:'javascript:alert(1)', description:'', traditional:'', aiWay:'', benefit:'' });`);
    const n2 = run(`entries.length`);
    run(`saveDetail();`);
    eq('but something the app cannot open still does', run(`entries.length`), n2);
  });

  /* Being told inside the app, not only by email */
  await withApp(async ({ run, doc }) => {
    suite('27 · You are told in the app as well');

    run(`__t.signIn(); __t.asDept(true); seedDemoData(true);
         profile.department='Production'; profile.name='Ivan'; profile.email='ivan@swangzavenue.com'; saveProfile();
         authUser = { id:'u', email:'ivan@swangzavenue.com', user_metadata:{} };
         localStorage.removeItem('swangz_notif_seen_v1:ivan@swangzavenue.com');
         const e = entries.find(x => x.tag !== 'request');
         e.submittedByEmail = 'ivan@swangzavenue.com';
         e.reportStatus = 'confirmed'; e.decidedAt = new Date().toISOString(); saveEntries();`);
    ok('an answer on your own entry is something you are told about',
       run(`notifItems().length`) >= 1, String(run(`notifItems().length`)));
    ok('and it is unread until you look', run(`notifUnread()`) >= 1);
    run(`paintBell();`);
    eq('so the bell is marked', run(`document.getElementById('railBellDot').hidden`), false);
    run(`markNotifSeen();`);
    eq('looking clears it', run(`notifUnread()`), 0);
    eq('and the mark goes with it', run(`document.getElementById('railBellDot').hidden`), true);

    /* A department user is not shown the admin's workload */
    ok('a department user is not told about other people\'s filings',
       run(`notifItems().every(n => !/filed a/.test(n.title))`));
  });
}

/* Somebody tried the app out on the live site and filed tools called "test",
   "policy", "delete me". Those are not confined to a list: they are counted in
   Tools Entered, in the money, in the graph, in the Executive Report and in the
   business case — so a handful of them read as the tracker being broken. And
   deleting one did not work, because deleting told the database nothing and the
   next sync brought it straight back. */
async function scenarioJunk() {
  if (only && !'junk'.includes(only)) return;
  await withApp(async ({ run, doc, settle }) => {
    suite('28 · Rubbish can be cleared out, and stays cleared');

    run(`__t.signIn(); __t.asDept(false); seedDemoData(true); adminUnlocked = true;
         ['policy','test','delete me','Test 2','asdf'].forEach((n, i) => entries.push({
           id: 'junk' + i, kind: 'tool', tag: 'report', toolName: n, department: 'Production',
           submittedBy: 'Someone', category: '', reason: '', impact: '', projects: [],
           submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
         saveEntries(); switchView('admin'); renderAdmin(); showAdminSection('acc_manage');`);

    /* Flagged, not deleted: "test" is a guess and a guess must not remove a
       department's work on its own. */
    ok('the junk is recognised', run(`entries.filter(e => e.id.indexOf('junk') === 0).every(looksLikeTest)`));
    ok('and real tools are not', run(`entries.filter(e => /ChatGPT|Runway|Midjourney/.test(e.toolName || '')).every(e => !looksLikeTest(e))`));
    ok('the panel says how many look like tests',
       /look like tests/.test(run(`document.getElementById('acc_manageMeta').textContent`)),
       run(`document.getElementById('acc_manageMeta').textContent`));

    run(`document.getElementById('manageFilter').value = 'junk'; renderManageSubmissions();`);
    eq('the filter shows exactly those', run(`document.querySelectorAll('#manageList .mg-row').length`), 5);

    /* "All" means all of what is listed — never all of what exists */
    run(`pickAllManage(true);`);
    eq('selecting all takes only what is shown', run(`manageChecked.size`), 5);
    run(`document.getElementById('manageFilter').value = ''; renderManageSubmissions();`);
    eq('and a tick cannot survive a filter that hides its row', run(`manageChecked.size`), 5);
    run(`document.getElementById('manageSearchInput').value = 'policy'; renderManageSubmissions();`);
    eq('narrowing the list narrows the selection with it', run(`manageChecked.size`), 1);
    run(`document.getElementById('manageSearchInput').value = ''; document.getElementById('manageFilter').value = 'junk';
         renderManageSubmissions(); pickAllManage(true);`);

    /* The bug underneath: deleting never told the database */
    run(`settings.backend = Object.assign({}, settings.backend || {}, { mode: 'supabase' });
         window.__del = [];
         window.fetch = (url, opt) => { if (opt && opt.method === 'DELETE') window.__del.push(String(url));
           return Promise.resolve({ ok: true, text: () => Promise.resolve('') }); };
         removeCheckedSubmissions();`);
    await settle(200);
    ok('it asks before removing anything', !!doc.querySelector('.deck-panel .ask-body'));
    ok('and names what will go', /policy/.test(run(`document.querySelector('.deck-panel .ask-body').textContent`)));
    run(`answerAsk(true);`);
    await settle(300);
    eq('the rubbish is gone', run(`entries.filter(e => e.id.indexOf('junk') === 0).length`), 0);
    eq('the real entries are untouched', run(`entries.filter(e => /ChatGPT/.test(e.toolName || '')).length > 0`), true);
    ok('and the database was told, in one request',
       run(`window.__del.length`) === 1 && /junk0/.test(run(`window.__del[0]`)), run(`String(window.__del)`).slice(0, 120));

    /* The row that started this: "__POLICY TEST - delete me__", filed by
       "policy-test" as a public request. An exact-name match would have walked
       straight past it, and it was sitting in the Requests Inbox looking like
       something waiting on a decision. */
    run(`entries.push({ id:'pt1', kind:'tool', tag:'request', requestStatus:'new', isPublic:true,
           toolName:'__POLICY TEST - delete me__', submittedBy:'policy-test', department:'Production',
           submittedAt:new Date().toISOString() });
         saveEntries();`);
    ok('a marker anywhere in the name is caught, not just an exact match',
       run(`looksLikeTest(entries.find(e => e.id === 'pt1'))`));
    ok('and so is a submitter called policy-test',
       run(`looksLikeTest({ toolName: 'Something Plausible', submittedBy: 'policy-test' })`));
    /* …without taking real tools with it */
    ok('a real tool with "test" in its name survives',
       !run(`looksLikeTest({ toolName:'TestGorilla', submittedBy:'Sarah N.', reason:'screening', tradTime:2, aiTime:1, frequency:4 })`));
    ok('and so does one with "Test" as a word',
       !run(`looksLikeTest({ toolName:'A/B Test Suite', submittedBy:'Ivan M.', reason:'landing pages', tradTime:3, aiTime:1, frequency:6 })`));
    run(`showAdminSection('acc_requests'); renderRequestsInbox();`);
    ok('the requests inbox marks it where it is actually seen',
       /looks like a test/.test(run(`document.getElementById('requestsInboxList').innerHTML`)));

    /* The single-row path had the same hole. It is wrapped by guardWith, so it
       asks first — answer it, or nothing is deleted and the check passes for
       the wrong reason. */
    run(`window.__del = [];
         entries.push({ id:'solo', kind:'tool', tag:'report', toolName:'test', department:'Production', submittedAt:new Date().toISOString() });
         saveEntries(); deleteSubmission('solo');`);
    await settle(200);
    ok('removing one submission asks before it acts', !!doc.querySelector('.deck-panel .ask-body'));
    eq('and until it is answered, nothing has gone', run(`entries.some(e => e.id === 'solo')`), true);
    run(`answerAsk(true);`);
    await settle(300);
    eq('answering removes it', run(`entries.some(e => e.id === 'solo')`), false);
    ok('and the database is told about that one too',
       run(`window.__del.length`) === 1 && /solo/.test(run(`window.__del[0]`)), run(`String(window.__del)`).slice(0, 120));
  });
}

/* ============================== run ============================== */
(async () => {
  const t0 = Date.now();
  for (const s of [scenarioBoot, scenarioTilesAdmin, scenarioTilesDept, scenarioReportWizardScope, scenarioExecWording,
                   scenarioFigures, scenarioHostile, scenarioEmpty, scenarioRequestDecision,
                   scenarioCorruptStorage, scenarioInjection, scenarioDemoContainment, scenarioUnits, scenarioAdminGate, scenarioNoDialogs, scenarioWorkbook, scenarioDeptPrompt,
                   scenarioCustomRange, scenarioAdminAccess, scenarioDriveFolder,
                   scenarioSignInRouting, scenarioSearchLook, scenarioReportsInbox, scenarioToolPicker, scenarioMail, scenarioJunk]) {
    try { await s(); } catch (e) { fail++; failures.push(current + ' › scenario crashed: ' + (e.stack || e.message));
      console.log('  \x1b[31m✗ scenario crashed: ' + e.message + '\x1b[0m'); }
  }
  console.log('\n' + '─'.repeat(64));
  console.log(`\x1b[1m${pass + fail} checks — \x1b[32m${pass} passed\x1b[0m` +
              (fail ? `, \x1b[31m${fail} failed\x1b[0m` : '') + `  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (fail) { console.log('\n\x1b[31mFailures:\x1b[0m'); failures.forEach(f => console.log('  • ' + f)); }
  process.exit(fail ? 1 : 0);
})();
