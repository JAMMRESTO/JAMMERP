import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: superAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — super admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenantId } = await req.json();
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenantId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, name, owner_id")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect auth user IDs to delete (owner + site managers)
    const authUserIds = new Set<string>();
    if (tenant.owner_id) authUserIds.add(tenant.owner_id);

    // Get site managers for all sites of this tenant
    const { data: sites } = await supabaseAdmin
      .from("sites")
      .select("id, cashier_auth_user_id")
      .eq("tenant_id", tenantId);

    const siteIds = (sites ?? []).map((s: { id: string }) => s.id);

    // Collect cashier auth user ids
    for (const site of (sites ?? [])) {
      if ((site as { cashier_auth_user_id: string | null }).cashier_auth_user_id) {
        authUserIds.add((site as { cashier_auth_user_id: string }).cashier_auth_user_id);
      }
    }

    // Get site_managers auth user IDs
    if (siteIds.length > 0) {
      const { data: managers } = await supabaseAdmin
        .from("site_managers")
        .select("user_id")
        .in("site_id", siteIds);
      for (const m of (managers ?? [])) {
        if ((m as { user_id: string }).user_id) authUserIds.add((m as { user_id: string }).user_id);
      }
    }

    // Get staff users (public.users) who have their own auth accounts
    // Admin users have id matching auth.users; cashiers share one account (already collected above)
    if (siteIds.length > 0) {
      const { data: staffUsers } = await supabaseAdmin
        .from("users")
        .select("id, email")
        .in("site_id", siteIds);
      for (const u of (staffUsers ?? [])) {
        const staff = u as { id: string; email: string | null };
        // Staff users with individual auth accounts have their own id in auth.users
        // We add all of them — deleteUser will simply fail silently for IDs not in auth.users
        if (staff.id) authUserIds.add(staff.id);
      }
    }

    const deleteLog: string[] = [];

    // Delete all sites (CASCADE deletes all operational data: products, sales, orders, etc.)
    if (siteIds.length > 0) {
      const { error: sitesErr } = await supabaseAdmin
        .from("sites")
        .delete()
        .in("id", siteIds);
      if (sitesErr) throw new Error(`Failed to delete sites: ${sitesErr.message}`);
      deleteLog.push(`Deleted ${siteIds.length} site(s) and all associated data`);
    }

    // Delete the tenant row
    const { error: tenantErr } = await supabaseAdmin
      .from("tenants")
      .delete()
      .eq("id", tenantId);
    if (tenantErr) throw new Error(`Failed to delete tenant: ${tenantErr.message}`);
    deleteLog.push(`Deleted tenant "${tenant.name}"`);

    // Delete auth users (owner + managers)
    const deletedAuthUsers: string[] = [];
    for (const uid of authUserIds) {
      const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
      if (!authDelErr) deletedAuthUsers.push(uid);
    }
    if (deletedAuthUsers.length > 0) {
      deleteLog.push(`Deleted ${deletedAuthUsers.length} auth user(s)`);
    }

    return new Response(
      JSON.stringify({ success: true, log: deleteLog }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
