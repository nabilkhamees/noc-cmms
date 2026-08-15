# NOC/CMMS — Datacenter Maintenance

A CMMS (Computerized Maintenance Management System) for managing datacenter
facilities: sites, rooms/racks, equipment, preventive & corrective work
orders, a maintenance calendar, and role-based access (Admin / Manager /
Technician).

This is currently a **frontend demo** — all data lives in memory (React
state) and resets on page reload. It's built to show the full workflow to
stakeholders before wiring up a real backend.

## Database setup (Supabase)

This app now reads and writes real data instead of using in-memory demo
data. It uses [Supabase](https://supabase.com) (free tier) for the
database.

### 1. Run the schema

In your Supabase project → **SQL Editor** → New query → paste the entire
contents of `supabase/schema.sql` → **Run**. This creates every table
(sites, rooms, racks, equipment, parts, PM schedule, work orders, users)
and loads the starting data (B90 and Auto sites, the four users).

Then also run, in order:
- `supabase/migration_auth.sql` — adds real login support
- `supabase/migration_custom_types.sql` — adds support for custom
  equipment classifications (Users can add a new type like "Battery
  Bank" from the Assets page, and it becomes available for everyone
  from then on)
- `supabase/migration_user_sites.sql` — lets Admins assign each user to
  one or more sites (Users & Roles page); a user assigned to no sites
  sees all of them
- `supabase/migration_report_uploader.sql` — tracks which user actually
  uploaded a work order's or equipment's report file, shown next to the
  filename
- `supabase/migration_floors.sql` — adds optional "floors" as a level
  above rooms, for sites with more than one floor. Only shows up in the
  Assets → Rooms view once a site actually has a floor added; single-
  floor sites look exactly as before.
- `supabase/migration_file_storage.sql` — enables real file storage for
  report uploads (PDF/Word). Before this, uploads only remembered the
  filename; after, the actual file is stored and the filename becomes a
  clickable link that opens/downloads it. 50MB per file on the free plan.
- `supabase/migration_pending_status.sql` — adds the "Pending" status
  and a reason field, used by the assigned person's close/pending
  workflow on a work order (see below).
- `supabase/seed_examples.sql` — optional: adds sample equipment and
  work orders so the app isn't empty while demoing. Safe to re-run.

## What's new: Analytics drill-down, Work Order filters, and the close/pending workflow

- **Analytics → Work Orders drill-down**: every number and bar on the
  Analytics page (Overdue count, by-status, by-site, by-technician, etc.)
  is now clickable — it jumps to the Work Orders page pre-filtered to
  exactly those work orders, with a "Filtered by: X ✕" chip to clear it.
- **Work Orders page filters**: three toggle buttons (All / Open /
  Closed) next to the search box, same pattern as the Calendar's filters.
  "Open" here means anything not yet Closed (Open, In Progress, Pending,
  or Late all count).
- **Close / Pending workflow**: opening a work order's **Completion**
  tab, whoever it's assigned to (or an Admin/Manager) sees two clear
  actions — **"Upload report & close"** (uploads the completion report
  and marks it Closed in one step) or **"Save as pending"** (a short
  reason, e.g. "waiting on parts", keeps it open with that note visible
  to everyone who opens it).

### 2. Get your credentials

Supabase project → **Project Settings** (gear icon) → **API**. You need:
- **Project URL**
- **anon / public key**

### 3. Local development

Copy `.env.example` to `.env` and fill in the two values from step 2:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
`.env` is already git-ignored — it never gets committed or pushed.

### 4. Production build (GitHub Actions)

The GitHub Actions workflow needs the same two values, but since `.env`
isn't committed, you add them as **repo secrets** instead:

1. On GitHub, go to your repo → **Settings** → **Secrets and variables** →
   **Actions**
2. Click **New repository secret**, add:
   - Name: `VITE_SUPABASE_URL` → Value: your project URL
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: your anon key
3. Push any change to `main` (or manually re-run the workflow from the
   Actions tab) — the next deploy will build with these values baked in.

**Is it safe to put the anon key in a public repo's secrets / built JS
bundle?** Yes — the anon key is designed to be public-facing. Supabase's
security model relies on **Row Level Security** (RLS) policies on each
table to control what that key can actually do, not on keeping the key
secret. The schema in this repo enables RLS on every table with a
permissive "allow everyone" policy for now, suitable for an internal demo
— tightening these policies (e.g. requiring a logged-in user) is part of
adding real authentication, a natural next step after this.

## Email notifications

When a work order is created (or reassigned to someone new), the app tries
to email the assigned person. This requires deploying a small server-side
piece separately from the frontend — it can't run in the browser because
it needs a secret email-provider API key.

### 1. Create a Resend account (free)

[resend.com](https://resend.com) → sign up → **API Keys** → create one,
copy it. Resend's free tier includes a test sender address
(`onboarding@resend.dev`) that works immediately with no domain setup —
good enough to get notifications working today. For a professional-looking
"from" address (e.g. `noc@yourcompany.com`), verify your own domain in
Resend's dashboard later; no code changes needed, just update the
`RESEND_FROM` secret in step 4.

### 2. Install the Supabase CLI

```
npm install -g supabase
```

### 3. Log in and link this project

```
supabase login
```
This opens a browser window to authorize. Then, from inside the
`noc-cmms` folder:
```
supabase link --project-ref zhuuwsekqqhsdfsauhve
```
(`zhuuwsekqqhsdfsauhve` is this project's ref — the part of your Supabase
URL before `.supabase.co`. If it differs, use yours instead.)

### 4. Set the secrets and deploy the function

```
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set RESEND_FROM="NOC/CMMS <onboarding@resend.dev>"
supabase functions deploy send-work-order-email
```

### 5. Test it

Make sure at least one user (e.g. Ehab) has an email set in Users &
Roles, then create a work order assigned to them from the app. Check
their inbox (and spam folder) within a minute or two.

**If email doesn't arrive:** open Supabase dashboard → **Edge Functions**
→ `send-work-order-email` → **Logs**, to see the actual error (wrong API
key, unverified domain, etc.). A failed or unconfigured email never
blocks creating the work order itself — it just won't send.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
```

This outputs a static site to `dist/`. Preview it locally with:

```bash
npm run preview
```

## Deploy it so others can see it (GitHub Actions → GitHub Pages)

This project already includes a GitHub Actions workflow at
`.github/workflows/deploy.yml` that builds the app and publishes it to
GitHub Pages automatically every time you push to `main`. Setup is a
one-time, few-minute process:

1. **Push this project to a GitHub repo** named `noc-cmms` (see "Get the
   code into a repo" below). If you name the repo something else, edit
   `REPO_NAME` in `vite.config.js` to match — otherwise the built page's
   assets (JS/CSS) will 404.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment" → **Source**, choose **GitHub Actions**
   (not "Deploy from a branch" — the workflow handles that already).
4. Go to the **Actions** tab and confirm the "Deploy to GitHub Pages"
   workflow ran (it triggers automatically on the push in step 1). First
   run takes ~1–2 minutes.
5. Once it's green, your app is live at:
   ```
   https://<your-github-username>.github.io/noc-cmms/
   ```
   That URL is also shown on the Settings → Pages screen, and as the
   "environment URL" on the completed Actions run.

From here on, **every push to `main` redeploys automatically** — no manual
build/upload step. You can also trigger a redeploy manually from the
Actions tab (Actions → Deploy to GitHub Pages → Run workflow) without
pushing new code, thanks to the `workflow_dispatch` trigger in the
workflow file.

### Get the code into a repo

```bash
cd noc-cmms
git init
git add .
git commit -m "Initial CMMS demo"
git branch -M main
git remote add origin https://github.com/<your-username>/noc-cmms.git
git push -u origin main
```

You'll need a GitHub account and to be authenticated for `git push`
(either the [GitHub CLI](https://cli.github.com) — `gh auth login` — or a
personal access token). Alternatively, create the repo on github.com first
and use "uploading an existing file" to drag in the folder contents with
no terminal at all — the Actions workflow will still pick it up on that
first push.

### Other deploy options

The `dist/` folder produced by `npm run build` is a plain static site, so
any static host works if you'd rather skip GitHub Pages:

1. **Vercel** — `npx vercel` from this folder (auto-detects Vite), or
   connect the GitHub repo at vercel.com for auto-deploys on push. No
   `base` path quirk to worry about — remove the `GITHUB_PAGES` env logic
   in `vite.config.js` if you go this route exclusively.
2. **Netlify** — drag-and-drop the `dist/` folder at app.netlify.com/drop,
   or connect the repo (build command `npm run build`, publish dir `dist`).


## Project structure

```
index.html                        Entry HTML
vite.config.js                    Vite config (incl. GitHub Pages base path)
.github/workflows/deploy.yml      GitHub Actions: build + deploy to Pages
src/main.jsx                      React bootstrap
src/App.jsx                       The entire app (pages, components, seed data)
```

Everything currently lives in one file (`App.jsx`) since it grew from a
single-file prototype. Once you're ready to build the real backend, splitting
this into `components/`, `pages/`, and `lib/` folders is a natural next step
— see the notes below.

## What's mocked vs. real

| Area | Current state | To make it real |
|---|---|---|
| Sites, rooms, equipment, work orders, users | **Live in Supabase (Postgres)** — persists across reloads and devices | Done |
| Login | Picks a name from the live user list, no password | Real auth — see Stage 2 below |
| File uploads (PDF/Word reports) | Captures the filename only, not the file itself | Wire to Supabase Storage |
| QR codes | Decorative placeholder | Generate real QR codes per asset (e.g. `qrcode` npm package) pointing to a URL like `/assets/:id` |

## Suggested next steps (Stage 2)

1. **Database**: Postgres works well for this shape of data (sites → rooms →
   equipment → work orders, with users and roles). Supabase or a managed
   Postgres (Railway, Render, RDS) gets you a database + auth quickly.
2. **API**: a simple REST or tRPC layer over the DB. If you use Supabase,
   you can often skip a custom backend entirely and call it directly from
   the frontend with row-level security enforcing the role-based access
   already modeled in this app (Admin/Manager/Technician).
3. **Auth**: replace the name-picker login with real accounts — Supabase
   Auth, Auth0, or Clerk are the fastest to integrate with React.
4. **File storage**: S3-compatible storage (AWS S3, Cloudflare R2, or
   Supabase Storage) for the PDF/Word completion reports and any equipment
   photos.
5. **Deploy**: frontend on Vercel/Netlify as above; database/API on
   whichever platform your team already uses, or Supabase/Railway if
   starting fresh.

None of this changes the UI or workflows you've already reviewed — it's
purely about persisting the same data model somewhere durable instead of
in browser memory.
