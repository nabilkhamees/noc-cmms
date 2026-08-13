// Supabase Edge Function: sends a "you've been assigned a work order" email.
// Deployed separately from the frontend — see README.md "Email notifications"
// section for how to deploy this and set the RESEND_API_KEY secret.
//
// Requires no request body validation library; kept deliberately simple.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, name, woCode, description, dueDate, priority, siteName, equipmentName } = await req.json();

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to' email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM") || "NOC/CMMS <onboarding@resend.dev>";

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not set on the server" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priorityColor = priority === "Highest" ? "#DC4C4C" : priority === "High" ? "#D97706" : "#0E9C8F";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0F172A; max-width: 480px;">
        <div style="background:#0F172A; color:#fff; padding:16px 20px; border-radius:10px 10px 0 0; font-weight:bold; font-size:16px;">
          NOC/CMMS — Work Order Assigned
        </div>
        <div style="border:1px solid #E7EAEE; border-top:none; padding:20px; border-radius:0 0 10px 10px;">
          <p>Hi ${name || "there"},</p>
          <p>You've been assigned <strong>Work Order #${woCode}</strong>${siteName ? ` at <strong>${siteName}</strong>` : ""}.</p>
          ${equipmentName ? `<p><strong>Asset:</strong> ${equipmentName}</p>` : ""}
          <p><strong>Description:</strong> ${description || "—"}</p>
          <p>
            <span style="display:inline-block; background:${priorityColor}; color:#fff; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:bold;">
              ${priority || "—"} priority
            </span>
          </p>
          <p><strong>Due:</strong> ${dueDate || "—"}</p>
          <p style="color:#5B6472; font-size:13px; margin-top:24px;">Open the app to view the full work order, instructions, and to upload your completion report.</p>
        </div>
      </div>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: `Work Order #${woCode} assigned to you`,
        html,
      }),
    });

    const data = await emailRes.json();

    return new Response(JSON.stringify(data), {
      status: emailRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
