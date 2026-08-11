/* Boots the real index.html inside jsdom so the app can be driven headlessly.
   Nothing is mocked except the browser APIs jsdom lacks and the Supabase CDN
   script (which must not be fetched — the app falls back to localStorage). */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const APP = process.env.APP_HTML ||
  path.join(process.env.HOME, 'swangz-ai-tracker-redesign', 'index.html');

function stubs(win) {
  const noop = () => {};
  if (!win.matchMedia) {
    win.matchMedia = q => ({
      matches: /min-width:\s*(9[2-9]\d|[1-9]\d{3})/.test(q || ''), // desktop
      media: q || '', onchange: null,
      addListener: noop, removeListener: noop,
      addEventListener: noop, removeEventListener: noop, dispatchEvent: () => false,
    });
  }
  class Obs { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  win.IntersectionObserver = win.IntersectionObserver || Obs;
  win.ResizeObserver = win.ResizeObserver || Obs;
  /* These exist in jsdom but throw "Not implemented" — assign over them. */
  win.scrollTo = noop;
  win.scrollBy = noop;
  win.Element.prototype.scrollIntoView = noop;
  win.HTMLCanvasElement.prototype.getContext = () => null;
  win.Element.prototype.setPointerCapture = win.Element.prototype.setPointerCapture || noop;
  win.Element.prototype.releasePointerCapture = win.Element.prototype.releasePointerCapture || noop;
  win.Element.prototype.hasPointerCapture = win.Element.prototype.hasPointerCapture || (() => false);
  win.Element.prototype.animate = win.Element.prototype.animate ||
    (() => ({ finished: Promise.resolve(), cancel: noop, finish: noop, addEventListener: noop }));
  win.HTMLCanvasElement.prototype.getContext = win.HTMLCanvasElement.prototype.getContext || (() => null);
  win.URL.createObjectURL = win.URL.createObjectURL || (() => 'blob:stub');
  win.URL.revokeObjectURL = win.URL.revokeObjectURL || noop;
  win.print = noop;
  /* Downloads and new windows must not abort a run */
  win.open = () => ({ document: { write: noop, close: noop }, focus: noop, close: noop, print: noop });
  win.HTMLAnchorElement.prototype.click = function () {
    if (this.download || /^(blob|data):/.test(this.href || '')) return; // swallow downloads
    win.HTMLElement.prototype.click.call(this);
  };
  if (!win.crypto) win.crypto = {};
  if (!win.crypto.getRandomValues) win.crypto.getRandomValues = a => { for (let i = 0; i < a.length; i++) a[i] = (i * 71 + 13) % 256; return a; };
  if (!win.crypto.subtle) {
    win.crypto.subtle = { digest: async (_alg, buf) => { // deterministic non-crypto stand-in
      const b = new Uint8Array(buf); const out = new Uint8Array(32);
      for (let i = 0; i < b.length; i++) out[i % 32] = (out[i % 32] + b[i] * 31 + i) % 256;
      return out.buffer; } };
  }
  /* fetch is only used for the optional mail endpoint and remote sync */
  win.fetch = win.fetch || (async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({}) }));
}

/* Boot the app. Returns { dom, win, doc, errors, warnings, run } */
async function boot(opts) {
  const o = Object.assign({ url: 'http://localhost:8000/', storage: null, quiet: true }, opts || {});
  let html = fs.readFileSync(APP, 'utf8');
  /* The Supabase UMD bundle must not be fetched. Removing the tag leaves
     window.supabase undefined, which is exactly the app's offline path. */
  html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net[^>]*><\/script>/g, '');

  const errors = [], warnings = [], logs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e && (e.stack || e.message))));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  vc.on('warn', (...a) => warnings.push(a.map(String).join(' ')));
  vc.on('log', (...a) => logs.push(a.map(String).join(' ')));

  const dom = new JSDOM(html, {
    url: o.url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      stubs(win);
      win.addEventListener('error', e => errors.push('uncaught: ' + (e.error && e.error.stack || e.message)));
      win.addEventListener('unhandledrejection', e => errors.push('unhandled rejection: ' + String(e.reason)));
      if (o.storage) { try { for (const k of Object.keys(o.storage)) win.localStorage.setItem(k, o.storage[k]); } catch (_) {} }
    },
  });

  const win = dom.window;
  await new Promise(res => {
    if (win.document.readyState === 'complete') return res();
    win.addEventListener('load', res, { once: true });
    setTimeout(res, 4000);
  });
  await new Promise(res => setTimeout(res, 60)); // let deferred DOMContentLoaded work settle

  /* Evaluate in page scope. Top-level `let`/`const` live in the script's
     lexical scope, not on window, so eval is the only way to reach them. */
  const run = code => win.eval(code);

  return { dom, win, doc: win.document, errors, warnings, logs, run };
}

module.exports = { boot, APP };
