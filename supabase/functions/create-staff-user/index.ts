import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function slugify(str: string): string {
  return (str ?? "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is authenticated
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { name, pin, role, role_id, site_id, tenant_id, user_id,
            email, password, cashier_password, update_cashier_password } = body;

    // ── UPDATE SHARED PASSWORD ────────────────────────────────────────────────
    if (update_cashier_password) {
      if (!cashier_password || cashier_password.length < 6) {
        return new Response(JSON.stringify({ error: "Mot de passe trop court (min. 6 caractères)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: siteRow } = await adminClient
        .from("sites")
        .select("cashier_auth_user_id")
        .eq("id", site_id)
        .maybeSingle();

      if (!siteRow?.cashier_auth_user_id) {
        return new Response(JSON.stringify({ error: "Aucun compte partagé trouvé pour ce site" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: pwErr } = await adminClient.auth.admin.updateUserById(
        siteRow.cashier_auth_user_id,
        { password: cashier_password }
      );
      if (pwErr) {
        return new Response(JSON.stringify({ error: pwErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!name || !pin || !site_id || !tenant_id) {
      return new Response(JSON.stringify({ error: "Champs manquants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE: update existing user's basic info ─────────────────────────────
    if (user_id) {
      const updatePayload: Record<string, unknown> = { name, pin };
      if (email) updatePayload.email = email;

      await adminClient.from("users").update(updatePayload).eq("id", user_id);

      if (email && password && password.length >= 6) {
        await adminClient.auth.admin.updateUserById(user_id, {
          email, password, email_confirm: true,
        });
      }
      return new Response(JSON.stringify({ success: true, user_id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE: all roles use the shared site auth account ────────────────────
    // Every user (admin or cashier) logs in with the same shared email+password
    // for their site. They are distinguished by their individual PIN.
    const { data: siteRow } = await adminClient
      .from("sites")
      .select("id, slug, cashier_auth_user_id")
      .eq("id", site_id)
      .maybeSingle();

    if (!siteRow) {
      return new Response(JSON.stringify({ error: "Site introuvable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sharedEmail = `caisse@${slugify(siteRow.slug) || "site"}.app`;
    const defaultPassword = `Caisse-${slugify(siteRow.slug)}-2024!`;
    const finalPassword = cashier_password && cashier_password.length >= 6 ? cashier_password : defaultPassword;

    let sharedAuthId: string = siteRow.cashier_auth_user_id ?? "";

    if (!sharedAuthId) {
      // Create the shared auth account for this site
      const { data: newAuth, error: createErr } = await adminClient.auth.admin.createUser({
        email: sharedEmail,
        password: finalPassword,
        user_metadata: { display_name: `Équipe - ${siteRow.slug}` },
        email_confirm: true,
      });

      if (createErr || !newAuth.user) {
        return new Response(JSON.stringify({ error: createErr?.message ?? "Erreur création compte partagé" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      sharedAuthId = newAuth.user.id;
      await adminClient.from("sites").update({ cashier_auth_user_id: sharedAuthId }).eq("id", site_id);
    } else if (cashier_password && cashier_password.length >= 6) {
      // Update existing shared account password if explicitly provided
      await adminClient.auth.admin.updateUserById(sharedAuthId, { password: cashier_password });
    }

    // Insert the individual user row in public.users
    const { data: inserted, error: userErr } = await adminClient.from("users").insert({
      id: crypto.randomUUID(),
      name,
      pin,
      email: sharedEmail,
      role_id: role_id ?? null,
      site_id,
      tenant_id,
      is_active: true,
    }).select("id").maybeSingle();

    if (userErr) {
      return new Response(JSON.stringify({ error: userErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: inserted?.id, shared_email: sharedEmail }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
