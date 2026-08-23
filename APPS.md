# Installing the tracker as an app

The tracker is one static page, which is what makes this easy: every "app"
below is the same page in a different frame. None of them holds a copy of the
code, so **deploying the site updates every app at once** and nobody has to
reinstall anything to get a fix.

---

## The one to tell staff about first

**Open https://swangz-ai-tracker.netlify.app in Chrome or Edge and press
"Install the app"** on the sign-in screen.

| Platform | What happens |
|---|---|
| Windows | Its own window and icon, in the Start menu and on the taskbar |
| macOS | Its own window and icon, in Applications and the Dock |
| Android | A home-screen app, full screen, no browser bar |
| iPhone / iPad | Safari → **Share** → **Add to Home Screen** (iOS has no install button; the app detects iOS and says so) |

No download, no security warning, no store, and **sign-in is guaranteed to work
because it is Chrome**. That last point is not a small thing: Google refuses
OAuth from anything it recognises as an embedded browser, which is the usual way
a wrapped web app dies.

It also works offline well enough to open — `sw.js` keeps the page, the icons
and the Supabase client locally. Entries still need a connection to sync; what
you get offline is "cannot sync yet" instead of a blank page.

---

## The downloadable files

Some people want a file they can be sent. **Actions → "Build the apps" → Run
workflow**, then download from the run — or push a tag (`git tag v1.0.0 && git
push --tags`) and it publishes a Release with everything attached.

| Platform | File | First run |
|---|---|---|
| Windows | `Swangz-AI-Tracker-1.0.0-x64-setup.exe` | SmartScreen warns once → *More info* → *Run anyway* |
| Windows | `…-x64-portable.exe` | Nothing to install — runs from a folder or a USB stick |
| macOS | `…-x64.dmg`, `…-arm64.dmg` | **Right-click → Open** (a double-click is refused) |
| Android | `swangz-ai-tracker.apk` | Allow "install from unknown sources" once |

### Why the warnings

The desktop builds are **unsigned**. Signing is not a setting — it is a
certificate you rent: Apple charges $99 a year, a Windows OV certificate more.
Until someone buys one, Windows and macOS will say they do not recognise the
publisher. The apps are not broken; the operating system simply cannot vouch
for who made them.

The **Android build is signed**, with our own key, which is all sideloading
needs.

### Before the Android job will run

It needs three GitHub secrets — *Settings → Secrets and variables → Actions*:

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_B64` | `base64 -w0 android/swangz-release.keystore` |
| `ANDROID_KEYSTORE_PASS` | the store password |
| `ANDROID_KEY_PASS` | the key password |

**The keystore is not in this repository and must never be.** Whoever holds it
can publish an update that Android trusts as ours. It sits in `android/` on the
build machine, ignored by git.

⚠️ **If that key is ever lost or regenerated, `/.well-known/assetlinks.json`
has to change with it.** That file publishes the key's SHA-256 fingerprint, and
it is what tells Android the app and the website are the same organisation —
which is what removes the address bar from the top of the app. A regenerated
key with a stale fingerprint gives you an app that works but looks like a
browser. Get the new fingerprint with:

```bash
keytool -list -v -keystore android/swangz-release.keystore -alias swangz | grep -A1 SHA256:
```

### Why the builds run on GitHub and not on a laptop

A Windows installer must be built on Windows and a `.dmg` on macOS — that is
Apple's and Microsoft's rule, not a preference. The Android build wants the
JDK, the Android SDK and Gradle, which is several gigabytes and more RAM than
the machine this was developed on has. GitHub's runners do all three for free.

---

## Nothing is loaded from anyone else

The page contacts **no third-party host at all**. That is a performance
decision and a reliability one, and it was measured rather than assumed:

| | before | after |
|---|---|---|
| Supabase client | 934 ms (jsDelivr) | 53 ms (`/vendor`) |
| Font stylesheet | 683 ms on a good run, **7.0 s on a bad one** | gone — the faces are ours |
| First visit, `load` | 1777 ms | **1059 ms** |
| Second visit (worker) | — | **457 ms** |

A cross-origin request is not just its bytes; it is a DNS lookup, a TLS
handshake and a new connection to a host the browser has never spoken to.
On a 150 KB/s link — which is what this was measured on — that is most of the
wait, and it is the part that varies wildly when the connection is poor.

### Updating the Supabase client

```bash
V=2.45.0                     # or whichever version
curl -o vendor/supabase-js-$V.min.js \
  https://cdn.jsdelivr.net/npm/@supabase/supabase-js@$V/dist/umd/supabase.min.js
```
Then change the `<script src>` in `index.html` **and** the `SHELL` entry in
`sw.js` together, and bump `CACHE`. The version is in the filename so the file
can be cached for ever.

### Updating the fonts

Both faces are **variable** and latin-subset only. Variable matters here: the
design uses weights 620, 650 and 750, which do not exist as static faces — the
browser was silently rounding them to the nearest hundred.

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0"
curl -A "$UA" "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap"
```
Take the `latin` blocks only — the other six subsets are most of the weight and
this is an English app — download their `.woff2` into `vendor/fonts/`, and keep
the `unicode-range` from the block you took it from.

## Icons

`assets/make-icons.py` builds every icon from the tutorial film's high-resolution
gold mark. The shipped `swangz-badge.webp` is 35×41 — fine beside a wordmark,
mush at 512. Re-run it if the mark ever changes:

```bash
python3 assets/make-icons.py
python3 - <<'PY'
from PIL import Image
im = Image.open('assets/icon-512.png')
im.convert('RGB').save('desktop/build/icon.png')
im.convert('RGBA').save('desktop/build/icon.ico',
    sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
PY
```

The maskable icon is deliberately pulled in to about half the canvas: Android
crops a maskable icon to whatever shape the launcher uses, and anything outside
the inner 80% circle can be cut off.
