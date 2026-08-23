# Deploying the Swangz Avenue AI Adoption Tracker

The tracker is a single HTML file. To make it usable by your team you need:

1. **A public URL** that everyone opens (this doc covers Netlify, Vercel, GitHub Pages).
2. **A shared backend** so everyone's entries land in one place (this doc covers Google Sheets and Supabase).

You can ship in stages — Option 1 today, Option 2 once you've validated adoption, Option 3 when you outgrow Sheets.

---

## Option 1 — Static hosting + manual rollup (zero code, ship today)

Everyone uses the same URL but each person's data lives in their own browser. To roll up:

- Each teammate clicks **Export JSON** in the admin and emails the file to you.
- You click **Import JSON…** in your admin (Backend & Sync card) and merge each file in. Existing entries with the same ID are replaced if newer.

Hosting (pick one — all free):

### Netlify Drop (fastest — 30 seconds)
1. Go to <https://app.netlify.com/drop>.
2. Drag the entire `swangz-ai-tracker/` folder onto the page.
3. Netlify gives you a URL like `https://something-something.netlify.app`. Share it.
4. Optional: claim the site to get a custom subdomain.

### Netlify (Git-connected)
1. Push this folder to a GitHub repo.
2. New site → Import from Git → pick the repo.
3. `netlify.toml` already in this folder configures everything.

### Vercel
1. `npm i -g vercel` then `vercel` from inside `swangz-ai-tracker/`.
2. Follow the prompts. `vercel.json` already configures it.

### GitHub Pages
1. Push to a repo, then Settings → Pages → Branch: `main`, Folder: `/swangz-ai-tracker`.
2. Wait ~30 seconds, your URL is `https://<user>.github.io/<repo>/`.

That's it for Option 1. The Backend mode in the app stays on **Local browser only**.

---

## Option 2 — Google Sheets backend (recommended for team-wide)

Half a day of setup. Everyone shares one Google Sheet via a Google Apps Script web app.

### Step 1 — Create the Google Sheet
1. Go to <https://sheets.new> (or Drive → New → Google Sheet).
2. Name it `Swangz AI Tracker — Entries`.
3. From the URL, copy the long ID between `/d/` and `/edit`. Save it for step 3.

### Step 2 — Create the Apps Script
1. Go to <https://script.google.com> → **New project**.
2. Delete the default `function myFunction() {}` placeholder.
3. Open `apps-script/Code.gs` from this folder, copy the whole file, paste it into the Apps Script editor.
4. At the top, replace `PASTE_YOUR_GOOGLE_SHEET_ID_HERE` with the ID you copied.
5. **Save** (Ctrl/Cmd-S).

### Step 3 — Deploy as a Web App
1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear next to "Select type" → choose **Web app**.
3. Settings:
   - **Description:** `Swangz tracker backend v1`
   - **Execute as:** *Me (your email)*
   - **Who has access:** *Anyone*
4. Click **Deploy**. The first time, Google will ask you to grant the script permission to edit your Sheet — accept.
5. Copy the **Web App URL** Google gives you (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 4 — Wire the tracker app to it
1. Open your deployed tracker.
2. Admin tab → unlock with your admin password → scroll to **Backend & Sync**.
3. Pick **Google Sheets (Apps Script)**, paste the Web App URL, click **Save Backend Settings**.
4. Click **Test Connection** — you should see `✓ sheets · Connection OK`.
5. Click **Push Local → Backend** to seed the Sheet with your existing entries.
6. Have your teammates open the same URL, set the same backend mode + URL, then click **Pull Backend → Local** to fetch the shared dataset.

### How it works
- Every save in the app debounces a `replaceAll` POST to the Apps Script, which rewrites all rows in the Sheet.
- `Pull Backend → Local` fetches all rows back via GET.
- The Sheet is your raw data — you can pivot, chart, or hand it to Finance.

### Multi-writer caveat
The current sync strategy (`replaceAll`) means if two people save at the same time, the last write wins. For ~10 active users editing different tools this is fine. If it becomes a problem, switch to per-row upsert (the Apps Script already supports `action:'upsert'`) or move to Option 3.

---

## Mail — the endpoint that actually sends

The tracker writes to people when something is filed and when it is decided. A
browser cannot send email, so this needs the same Apps Script web app.

**Sign in to script.google.com with the @swangzavenue.com account that should be
the sender before you start.** Whichever account creates the script is the
account the mail comes from — staff will see that address on every
notification, and it cannot be changed afterwards without redeploying. A
Workspace account also raises the daily cap from 100 messages to 1,500.

1. Deploy `apps-script/Code.gs` as a **Web app** — *Execute as: Me*, *Who has
   access: Anyone*. Copy the `…/exec` URL.
2. In the app: **Settings › Notifications & Documents → Mail endpoint**, paste
   it, then press **Send myself a test**. A message should arrive within a
   minute. The setting is published to `app_config`, so every other admin picks
   it up — it is not per-laptop.
3. The first send asks the script's owning Google account for permission to
   send mail on its behalf. **Mail is sent from that account**, so use one the
   company is happy to have as the sender.

### ⚠️ Paste and SAVE the code before you deploy

**A deployment is a frozen snapshot of a version, not a live view of the
editor.** Deploy an empty project and the URL keeps serving that empty project
for ever, however much code you paste afterwards. The symptom is an HTTP **200**
whose body is an HTML page reading *"Script function not found: doPost"* — and
because the status is 200, anything naive treats it as success. This happened on
the first real deployment.

To fix it without losing the URL:

> **Deploy → Manage deployments → the pencil (Edit) → Version: _New version_ → Deploy**

The `/exec` URL is unchanged; only the code behind it moves forward. Do this
after *every* edit to `Code.gs`, or the change is not live.

Press **Send myself a test** in the app to check. It reads the reply properly
now — an HTML error page is reported as a failure with the fix named, never as
a send.

### ⚠️ Then grant permission to send — deploying does not ask

Apps Script works out which permissions a project needs *from the code*, and
asks for them the first time a **human runs** something in the editor.
Deploying never asks. So a project deployed before `MailApp` appeared in it is
live, answers every request correctly, and still cannot send a single message:

```json
{"ok":false,"error":"You do not have permission to call MailApp.sendEmail"}
```

In the editor, choose **`authoriseAndTest`** in the toolbar dropdown and press
**Run**. Google shows *"Authorization required"* → **Review permissions** →
pick the account → **Advanced** → **Go to … (unsafe)** → **Allow**.

That "unsafe" screen is normal for a script you wrote yourself and have not
paid Google to verify. It is asking to send mail as you, which is the point.

The function then emails **you**, from the account every tracker notification
will come from — so a message arriving is proof of the whole path, not just of
the permission. Redeploy a new version afterwards.

**It can be the same deployment as the Sheets backend, or a separate one.**
Either is safe now — but it was not before. The app used to POST
`{kind:'notify', …}` while the script dispatched on `action` and defaulted to
`replaceAll`, so a notification (which carries no entries) read as *replace
every row with nothing*. Pointing the mail endpoint at the sheet URL would have
emptied the spreadsheet on the first message. The script now **refuses a POST
with no action**, and the app names `action:'notify'`. If you are running an
older copy of `Code.gs`, redeploy it before setting a mail endpoint.

**Sending limits.** Google caps `MailApp` at 100 messages a day on a consumer
account and 1,500 on Workspace. Every send reports what is left and the app
keeps the figure; when it runs out, messages fail rather than vanish and sit in
the outbox with the reason.

**Without an endpoint** nothing is lost: every message queues in the outbox
under the same panel and can be opened in your own mail client, attachment and
all.

---

## Option 3 — Supabase backend (proper database, real-time ready)

1–2 hours of setup. Best long-term option once usage is significant.

### Step 1 — Create a Supabase project
1. Go to <https://supabase.com> → New project.
2. Name: `swangz-ai-tracker`. Pick a region close to Uganda (e.g. `eu-west-2` London or `eu-central-1` Frankfurt).
3. Set a strong database password (save it in 1Password — you won't need it for the app).
4. Wait ~2 minutes for it to provision.

### Step 2 — Run the schema
1. In the Supabase dashboard → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy and paste the whole file, click **Run**.
3. You should see `Success. No rows returned`.

> **Re-run this on the live project too.** The file is safe to run again — every statement is
> `if not exists` or `drop … / create …`. It now also creates `public.app_config`, which holds
> the Swangz Drive folder so one admin setting reaches the whole team. Until it has been run,
> the admin can set the folder but it stays in their own browser, and department users still
> see *"no folder has been set yet — ask an admin"*. The folder itself is set in the dashboard
> under **Settings › Company Settings**.

### Step 3 — Get your project URL + anon key
1. Project Settings → **API**.
2. Copy:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **anon `public` key** (a long `eyJhbGci...` string)

### Step 4 — Wire the tracker app
1. Open the deployed tracker.
2. Admin → Backend & Sync → choose **Supabase (PostgREST)**.
3. Paste Project URL + anon key. Leave Table Name as `entries`.
4. **Save Backend Settings** → **Test Connection** → **Push Local → Backend**.
5. Teammates do the same and click **Pull**.

### Security notes
- The schema enables Row-Level Security but with **wide-open policies** for the anon role. This is appropriate for an internal tool where the URL + anon key are kept private (treat them like a password).
- For real org-wide auth, swap the policies to require `auth.role() = 'authenticated'`, add Supabase Auth to the client, and gate access to people with `@swangzavenue.com` emails. Ping me when you want this — it's a small follow-up change.

### Why Supabase over Sheets
- Real concurrent writes (no last-writer-wins issue)
- Real-time subscriptions if you want the admin dashboard to live-update
- Proper indexes, queries, and SQL exports
- Free tier covers 500 MB DB + 50k monthly active users — plenty for an internal tool

---

## Publishing the redesign to the live site

The company opens **<https://swangz-ai-tracker.netlify.app/>**. That site deploys from
Marvin's repo, `marvinmusokessekatawa-cmd/swangz-ai-tracker-codex`, branch `main` — the
served page is byte-identical to the `index.html` there. Nothing published from this repo
reaches that URL until it reaches his.

**The two histories are unrelated.** Marvin's repo is a single Codex-export commit from
1 Aug 2026; this repo has its own root and 87 commits on top of it. `git push` will be
refused, and `--force` would throw his commit away — so don't. Take both roots into one
merge that keeps his commit reachable and this repo's tree as the result:

```bash
cd ~/swangz-ai-tracker-redesign
git fetch --no-tags https://github.com/marvinmusokessekatawa-cmd/swangz-ai-tracker-codex.git \
  main:refs/remotes/marvin/main

git checkout -B live refs/remotes/marvin/main            # start from his commit
git merge -s ours --allow-unrelated-histories --no-edit main   # record both parents
git read-tree --reset -u main                            # tree becomes this repo's, exactly
git commit --amend -m "The redesign becomes the live tracker"

git rev-parse live^{tree} main^{tree}                    # the two must match before pushing
git push https://github.com/marvinmusokessekatawa-cmd/swangz-ai-tracker-codex.git live:main
git checkout main                                        # put the working tree back
```

`git checkout -B live` and `read-tree --reset -u` both rewrite the working tree, so commit or
stash anything in progress first. The `rev-parse` line is the check that matters: if the two
tree hashes differ, the merge did not take this repo's tree and the push must not happen.

The push needs **write access to Marvin's repo** — as of 14 Aug 2026 this account has `READ`.
Ask him to add you under Settings → Collaborators. Netlify redeploys on its own once `main`
moves; it is a static publish with no build step, so exhausted build minutes do not block it.

Two things in Supabase have to be done as well, or the live site is broken in ways the code
cannot fix:

1. **Re-run `supabase/schema.sql`** in the SQL editor. The whole file is safe to run again.
   Until it is, `public.app_config` does not exist — verified 404 against the live project on
   14 Aug 2026 — and the Drive folder never leaves the admin's own browser.
2. **Add `https://swangz-ai-tracker.netlify.app`** as the **Site URL** and under
   **Redirect URLs** in Authentication → URL Configuration. Google sign-in cannot complete
   without it, which means nobody gets in at all.

## Day-1 launch checklist

- [ ] Deploy `index.html` (Option 1)
- [ ] Send the URL to one trusted teammate per department for a 24-hour usability test
- [ ] Set the admin password and write it down somewhere only you have
- [ ] Pick Option 2 or 3 once you see active usage from at least 3 departments
- [ ] Configure backend → push your existing entries → tell the team to pull
- [ ] Schedule a 30-min review at end of week 2 to look at the data and decide whether to keep collecting

## Files in this folder

```
swangz-ai-tracker/
├── index.html              ← the tracker app (open this in a browser to use it)
├── netlify.toml            ← Netlify deploy config
├── vercel.json             ← Vercel deploy config
├── DEPLOY.md               ← this file
├── apps-script/
│   └── Code.gs             ← Google Apps Script backend (Option 2)
└── supabase/
    └── schema.sql          ← Supabase database schema (Option 3)
```
