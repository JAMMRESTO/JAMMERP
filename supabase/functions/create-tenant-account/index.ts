import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, password, tenantName, plan } = body;

    // Define which modules each plan allows
    const PLAN_MODULES: Record<string, Record<string, boolean>> = {
      starter: { pos: true, delivery: false, kitchen: false, inventory: false, reports: true, reservations: false, production: false },
      pro: { pos: true, delivery: true, kitchen: true, inventory: true, reports: true, reservations: false, production: false },
      enterprise: { pos: true, delivery: true, kitchen: true, inventory: true, reports: true, reservations: true, production: true },
    };

    if (!email || !password || !tenantName) {
      return new Response(
        JSON.stringify({ error: "Email, mot de passe et nom du restaurant requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 6 caractères" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user via admin API (bypasses rate limits)
    const { data: newAuth, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: tenantName },
      });

    if (createErr || !newAuth.user) {
      const msg = createErr?.message ?? "Erreur création du compte";
      const isDuplicate = msg.includes("already been registered") || msg.includes("already exists");
      return new Response(
        JSON.stringify({ error: isDuplicate ? "Un compte avec cet email existe déjà" : msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create tenant
    const slug =
      tenantName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") + `-${Date.now()}`;

    const selectedPlan = plan ?? "starter";
    const allowedModules = PLAN_MODULES[selectedPlan] ?? PLAN_MODULES.starter;

    const { error: tenantErr } = await adminClient.from("tenants").insert({
      name: tenantName,
      slug,
      owner_id: newAuth.user.id,
      plan: selectedPlan,
      status: "pending",
      is_active: false,
      allowed_modules: allowedModules,
    });

    if (tenantErr) {
      // Rollback: delete the auth user
      await adminClient.auth.admin.deleteUser(newAuth.user.id);
      return new Response(
        JSON.stringify({ error: tenantErr.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newAuth.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
