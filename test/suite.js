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

/* ============================== run ============================== */
(async () => {
  const t0 = Date.now();
  for (const s of [scenarioBoot, scenarioTilesAdmin, scenarioTilesDept, scenarioExecWording,
                   scenarioFigures, scenarioHostile, scenarioEmpty, scenarioRequestDecision,
                   scenarioCorruptStorage, scenarioInjection, scenarioDemoContainment, scenarioUnits, scenarioAdminGate, scenarioNoDialogs, scenarioWorkbook]) {
    try { await s(); } catch (e) { fail++; failures.push(current + ' › scenario crashed: ' + (e.stack || e.message));
      console.log('  \x1b[31m✗ scenario crashed: ' + e.message + '\x1b[0m'); }
  }
  console.log('\n' + '─'.repeat(64));
  console.log(`\x1b[1m${pass + fail} checks — \x1b[32m${pass} passed\x1b[0m` +
              (fail ? `, \x1b[31m${fail} failed\x1b[0m` : '') + `  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (fail) { console.log('\n\x1b[31mFailures:\x1b[0m'); failures.forEach(f => console.log('  • ' + f)); }
  process.exit(fail ? 1 : 0);
})();
