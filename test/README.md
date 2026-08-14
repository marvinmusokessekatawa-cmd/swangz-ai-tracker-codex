# Testing the tracker

Nothing in this folder ships. `index.html` stays a single static file with no
build step — this is just a way to drive it without clicking through it by hand.

```bash
cd test && npm install          # jsdom, puppeteer-core, acorn
npm test                        # the suite — boots the real index.html in jsdom
```

The app must be served for the browser scripts:

```bash
python3 -m http.server 8000 --bind 127.0.0.1   # from the repo root
```

| Command | What it does |
|---|---|
| `npm test` | Boots the real `index.html` in jsdom and asserts the rules the app is supposed to keep. ~110 checks, ~60s. |
| `npm run audit` | Reads the source: duplicate ids, handlers that interpolate into a quoted JS literal, native dialogs, unguarded `href`s, dead style rules, and the go-live checklist. |
| `npm run dupes` | Finds functions declared twice. `--write` deletes the dead copies, but only ones it can prove are unreachable, and only if the result still parses. |
| `npm run sweep` | Real Chrome: every admin section and every tile, both roles, desktop and phone — console errors and sideways scroll. |
| `npm run shots` | Real Chrome: walks the app and writes screenshots to `../shots/`. |
| `npm run report` | Prints the executive document as plain text, so its wording and figures can be read end to end. |

`snapshot.js` + `compare.js` are for refactoring. Capture what the app renders,
change the code, capture again, and diff:

```bash
APP_HTML=$PWD/index.before.html node snapshot.js before.json
node snapshot.js after.json
node compare.js before.json after.json
```

Timestamps and generated ids are normalised, so a diff means a real change.

## Two things worth knowing

**The dev bypass signs you in as a system owner**, so the app routes to the
admin gate, not the department view. To reach the department side the way a
reviewer would, call `togglePreviewAsDept(true)`.

**Keep every `page.evaluate` synchronous.** Chrome freezes a backgrounded tab's
timers, so an awaited `setTimeout` inside an evaluate hangs the whole call and
looks exactly like the app has frozen. It has not.
