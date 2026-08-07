# Base44 prompt — Swangz Avenue AI Adoption Tracker

Paste the block below into Base44. It's written as one initial build prompt; refine iteratively after the first generation.

---

Build an internal web app called **"Swangz Avenue — AI Adoption Tracker"**.

## What it's for
Swangz Avenue is a company with 12 departments. This app lets staff across departments document the AI tools they use (**Reports**) and ask the company to invest in new AI tools (**Requests**). Leadership uses it to build the business case for AI spend with hard numbers — time saved, cost saved, and revenue enabled — and to triage incoming tool requests. All money is in **USD with a live Ugandan Shilling (UGX) conversion** shown alongside (configurable rate, default 3800 UGX = 1 USD).

## Users & access
- **Team members** sign in with **Google** (ideally restricted to `@swangzavenue.com` email addresses). On first sign-in they set a profile: Department, Name, Role/Title.
- **Public visitors** can submit a tool **Request** WITHOUT signing in (a "Submit a tool request without signing in" option on the login screen). Public submissions are always Requests, never Reports.
- **Admins** access an Admin Dashboard (admin role). It should be gated so only admins see org-wide data and the requests inbox.
- The 12 departments (use as a dropdown everywhere department is chosen): Production, Content, Digital, Finance, Strategy, HR, Record Label, Creative Tech and Innovations, Events, Academy, Sales, Marketing.

## Core data entity: "Tool Entry"
Each entry has:
- **type/tag**: "Report" or "Request"
- **requestStatus** (Requests only): New → Reviewed → Approved → Declined
- **adminNote** (internal, admins only)
- **isPublic** (true if submitted by an anonymous public visitor)
- **department**, **submittedBy** (name), **submittedByEmail**, **role**
- **toolName**, **officialWebsite** (URL), **category**, **status**
  - category options: Video Generation, Video Editing, Image Generation, Image Editing, Color Grading & VFX, Audio / Voice, Music Production, Copywriting / Text, Translation / Localization, Analytics / Insights, Automation / Workflow, Design, Research, Finance / Accounting, HR / Recruiting, Customer / Sales, Coding / Dev, Other
  - status options: "Requesting (need to invest)", "Piloting", "In Active Use", "Scaling Across Team"
- **reason** (Why is this tool important? business reason), **impact** (How does it improve work?)
- **projects[]** — a repeatable list, each with: project name, link (URL), short description, "Traditional way" (text), "AI-assisted way" (text), benefit/outcome (text)
- **Time & cost comparison** (per typical deliverable): traditionalTime + unit (seconds/minutes/hours/days/weeks/months/years), aiAssistedTime + unit, traditionalCost (USD), frequencyPerMonth
- **AI tool cost (monthly)**: monthlySubscription (USD), extraCredits (USD, optional)
- **revenueDescription**, **revenueAmount** (USD)
- timestamps (submitted, updated)

## Pages & navigation
Top nav toggles between **"Departments"** (the member area) and **"Admin Dashboard"**.

1. **Login screen** — Google sign-in + a secondary "Submit a tool request without signing in" button for public requests.
2. **Profile setup** — Department, Name, Role (shown on first sign-in or when editing profile).
3. **My Tools** (member landing) — a **table/list** of the signed-in user's entries with columns: Tool, Type (Report/Request badge), Category, Status, Monthly saved (USD), Time saved, Revenue, and a remove action. A "My History" summary card on top shows totals (tools submitted, time saved/mo, net cost saved/mo, revenue/mo). Clicking a row opens that entry in the wizard. A **"+ Add Tool"** button.
4. **Add / Edit wizard** (see next section).
5. **Admin Dashboard** (see below).

## The Add/Edit flow — a multi-step "wizard" (important UX)
When a user clicks "+ Add Tool", first show a **chooser** with two cards: **"Report a tool we use"** vs **"Request a new tool."** The choice sets the entry type (same form either way, just tagged differently).

Then open a **multi-step wizard presented as a floating modal window with a frosted-glass / blur effect over the page behind it** (glassmorphism). The form is split into **6 separate steps, each on its own page/screen — NOT one long scroll**. A progress stepper at the top shows the steps; completed steps get a check, the current one is highlighted. The user **cannot advance to the next step until the current step's required fields are filled** (gated). Back/Next buttons at the bottom; the final step shows "Save". Steps:
1. **Tool Identity** — tool name (with autocomplete from a shared tool registry), official website, category, status. (Required: tool name, category.)
2. **Why & Impact** — business reason, how it improves work. (Required: business reason.)
3. **Projects this tool has worked on** — the repeatable projects list.
4. **Time & Cost Comparison** — traditional vs AI-assisted time (with unit), traditional cost, frequency/month. Show live UGX conversions under cost fields.
5. **AI Tool Costs (monthly)** — monthly subscription + optional extra credits.
6. **Revenue Impact** — description + estimated revenue amount.

For **public (not signed in)** submissions, the wizard runs in "request" mode: it also collects the visitor's name, email (optional), and department on step 1, locks the type to Request, and the final button says "Submit request." After submit, thank them and confirm it went to the admin team.

When **editing an existing entry**, all steps should be freely navigable (no gating) so the user can jump straight to any section to review/edit.

## Admin Dashboard
Admin-only. Sections (collapsible accordions are fine):
- **KPI tiles**: Tools Tracked, Monthly Time Saved, Monthly Net Cost Saved (USD + UGX), Revenue Enabled/Protected (USD + UGX). **These KPIs and all the charts/tables below count Reports only — exclude Requests** (requests are aspirational tools the company doesn't have yet, so they must not inflate realized-value numbers).
- **Requests Inbox** (prominent, near the top): a list of all Request entries (from team members and public submissions) showing tool, requester, department, category, date, the "why", expected impact, and estimated monthly cost. Each request has a **status workflow** with buttons **New → Reviewed → Approved → Declined** and an **internal admin note** field. Filter by status and search by tool/requester/department. Show a count of new requests.
- **Charts**: net monthly savings by department (bar), by category (bar), status distribution, revenue enabled by department. Filters for department / category / status / search.
- **Detailed table** of all reports with traditional vs AI time & cost, monthly savings, revenue.
- **Business case cards** per tool, and an auto-generated **executive narrative summary** of the current data.
- **Tool Registry**: a shared list of canonical tool names + official URLs that powers the autocomplete in step 1, so different people entering the same tool ("Suno" vs "Suno AI") get merged. Admins can add/edit/remove registry tools.
- **Export**: download all data as CSV and JSON. (Sanitize CSV cells so values starting with = + - @ can't run as spreadsheet formulas.)
- Adjustable USD→UGX rate.

## Calculations
- **Convert all times to hours** using the chosen unit, for math.
- **Monthly time saved** = (traditionalTimeHours − aiAssistedTimeHours) × frequencyPerMonth.
- **Traditional monthly cost** = traditionalCost × frequencyPerMonth.
- **AI monthly cost** = monthlySubscription + extraCredits.
- **Net monthly cost saved** = traditionalMonthlyCost − aiMonthlyCost.
- Show every USD figure with its UGX equivalent using the configurable rate.

## Design & branding
- **Dark theme**, modern and sleek. Accent colors: **gold `#f5c542`** and **purple `#7c5cff`** (use a gold→purple gradient for the logo mark and primary highlights). Good colors: green `#3ddc97` for positive savings, red `#ff5c7a` for negative.
- Logo mark: a rounded square with "SA".
- The wizard windows must use a **floating glass (frosted/blurred) panel over a dimmed backdrop**, with smooth step transitions so each step feels like a new window sliding in.
- Status and type shown as colored pills. Fully responsive; on mobile the wizard becomes a full-screen sheet.
- Accessibility: Escape closes modals, focus moves into the dialog on open, clicking the backdrop closes it.

## Security notes
- Public visitors may only **create** Request entries — they must not be able to read, edit, or delete any existing data, or create Reports. Don't let a public submitter set their request to "Approved" or impersonate the status workflow; new public requests always start as "New".
- Treat tool/website/project URLs as untrusted: only allow http/https links (block `javascript:`/`data:` URLs) wherever a link is rendered.
