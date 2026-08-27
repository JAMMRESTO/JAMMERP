import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESTORE_ORDER = [
  "roles",
  "categories",
  "products",
  "settings",
  "users",
  "customers",
  "restaurant_tables",
  "warehouses",
  "ingredients",
  "recipes",
  "recipe_items",
  "sales",
  "sale_items",
  "payments",
  "cash_sessions",
  "orders",
  "order_items",
  "deliveries",
  "online_orders",
  "online_order_items",
  "stock_movements",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorise" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { backup_id, site_id, mode } = await req.json();

    if (!backup_id || !site_id) {
      return new Response(
        JSON.stringify({ error: "backup_id et site_id requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify the caller is a super admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Non authentifie" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: saCheck } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!saCheck) {
      return new Response(
        JSON.stringify({ error: "Acces reserve aux super administrateurs" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the backup
    const { data: backup, error: fetchErr } = await adminClient
      .from("backups")
      .select("*")
      .eq("id", backup_id)
      .eq("site_id", site_id)
      .single();

    if (fetchErr || !backup) {
      return new Response(
        JSON.stringify({ error: "Sauvegarde introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const backupData = backup.data as Record<string, unknown[]>;
    const restoreMode = mode === "merge" ? "merge" : "replace";
    const results: Record<string, { deleted: number; restored: number }> = {};

    for (const table of RESTORE_ORDER) {
      const rows = backupData[table];
      if (!rows || rows.length === 0) continue;

      if (restoreMode === "replace") {
        const { count } = await adminClient
          .from(table)
          .delete({ count: "exact" })
          .eq("site_id", site_id);

        results[table] = { deleted: count ?? 0, restored: 0 };
      } else {
        results[table] = { deleted: 0, restored: 0 };
      }

      const batchSize = 200;
      let restored = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error: insertErr } = await adminClient
          .from(table)
          .upsert(batch as Record<string, unknown>[], {
            onConflict: "id",
            ignoreDuplicates: false,
          });

        if (!insertErr) {
          restored += batch.length;
        }
      }
      results[table].restored = restored;
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: restoreMode,
        results,
        total_restored: Object.values(results).reduce(
          (s, r) => s + r.restored,
          0
        ),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
