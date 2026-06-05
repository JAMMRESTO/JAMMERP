import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    // Verify caller is a super admin
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: saRow } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("id", caller.id)
      .maybeSingle();
    if (!saRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ── LIST ALL OWNER EMAILS (initial load) ──────────────────────────────────
    if (action === "list_all_owner_emails") {
      const { data: tenants } = await adminClient
        .from("tenants")
        .select("id, owner_id")
        .not("owner_id", "is", null);

      const rows = (tenants ?? []) as Array<{ id: string; owner_id: string }>;
      if (rows.length === 0) {
        return new Response(JSON.stringify({ success: true, emailByOwnerId: {}, ownerIdByTenantId: {} }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch each owner email individually (getUserById is reliable vs listUsers pagination)
      const emailByOwnerId: Record<string, string> = {};
      const ownerIdByTenantId: Record<string, string> = {};

      await Promise.all(rows.map(async (row) => {
        ownerIdByTenantId[row.id] = row.owner_id;
        try {
          const { data: { user } } = await adminClient.auth.admin.getUserById(row.owner_id);
          if (user?.email) emailByOwnerId[row.owner_id] = user.email;
        } catch {
          // owner not found in auth, skip
        }
      }));

      return new Response(JSON.stringify({ success: true, emailByOwnerId, ownerIdByTenantId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST AUTH USERS (per-tenant, for staff) ───────────────────────────────
    if (action === "list_auth_users") {
      const { tenant_id } = body;
      const { data: usersData } = await adminClient
        .from("users")
        .select("id, email")
        .eq("tenant_id", tenant_id);

      const authUserIds = new Set<string>();
      for (const u of (usersData ?? [])) {
        if (u.id) authUserIds.add(u.id);
      }

      const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({
        page: 1, perPage: 1000,
      });

      const relevant = (authUsers ?? []).filter(u => authUserIds.has(u.id));
      const emailById: Record<string, string> = {};
      for (const u of relevant) {
        emailById[u.id] = u.email ?? "";
      }

      return new Response(JSON.stringify({ success: true, emailById }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESET USER PASSWORD ────────────────────────────────────────────────────
    if (action === "reset_password") {
      const { user_id, new_password } = body;
      if (!user_id || !new_password || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "user_id et mot de passe (min 6 car.) requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE PIN ─────────────────────────────────────────────────────────────
    if (action === "update_pin") {
      const { user_id, new_pin } = body;
      if (!user_id || !new_pin || !/^\d{4}$/.test(new_pin)) {
        return new Response(JSON.stringify({ error: "user_id et PIN 4 chiffres requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.from("users").update({ pin: new_pin }).eq("id", user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
