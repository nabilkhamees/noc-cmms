# NOC/CMMS — Datacenter Maintenance

A CMMS (Computerized Maintenance Management System) for managing datacenter
facilities: sites, rooms/racks, equipment, preventive & corrective work
orders, a maintenance calendar, and role-based access (Admin / Manager /
Technician).

This is currently a **frontend demo** — all data lives in memory (React
state) and resets on page reload. It's built to show the full workflow to
stakeholders before wiring up a real backend.

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
| Sites, rooms, equipment, work orders | In-memory `useState`, reset on reload | Move to a database + API |
| Login | Picks a name from a hardcoded list, no password | Real auth (see below) |
| File uploads (PDF/Word reports) | Captures the filename only | Wire to object storage (S3, etc.) |
| QR codes | Decorative placeholder | Generate real QR codes per asset (e.g. `qrcode` npm package) pointing to a URL like `/assets/:id` |

## Suggested path to a real backend

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
