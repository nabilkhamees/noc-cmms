import { createClient } from "@supabase/supabase-js";

// These come from a .env file (local dev) or from GitHub Actions secrets
// (production build) — see .env.example and README.md for setup.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials are missing. Copy .env.example to .env and fill in " +
    "your project's URL and anon key (Supabase dashboard → Project Settings → API)."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
