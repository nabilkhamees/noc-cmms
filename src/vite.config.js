import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this site from https://<user>.github.io/<repo-name>/,
// not from the domain root — so asset URLs need that repo-name prefix when
// built inside the GitHub Actions workflow. Locally (npm run dev / a normal
// build) this stays "/" and nothing changes.
//
// If you rename the repo, update REPO_NAME to match, or deploy to Vercel/
// Netlify instead (see README) where this isn't needed at all.
const REPO_NAME = "noc-cmms";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? `/${REPO_NAME}/` : "/",
  server: {
    port: 5173,
  },
});
