import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CONFIG_TABLES = [
  "categories",
  "products",
  "settings",
  "users",
  "roles",
  "restaurant_tables",
  "customers",
  "recipes",
  "recipe_items",
  "ingredients",
  "warehouses",
];

const TRANSACTIONAL_TABLES = [
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

    const { site_id, tenant_id, scope, type, label } = await req.json();

    if (!site_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "site_id et tenant_id requis" }),
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

    const backupScope = scope === "full" ? "full" : "config";
    const tablesToBackup =
      backupScope === "full"
        ? [...CONFIG_TABLES, ...TRANSACTIONAL_TABLES]
        : CONFIG_TABLES;

    const data: Record<string, unknown[]> = {};
    let totalRecords = 0;

    for (const table of tablesToBackup) {
      const { data: rows, error } = await adminClient
        .from(table)
        .select("*")
        .eq("site_id", site_id);

      if (error) {
        continue;
      }

      if (rows && rows.length > 0) {
        data[table] = rows;
        totalRecords += rows.length;
      }
    }

    const jsonData = JSON.stringify(data);
    const sizeBytes = new TextEncoder().encode(jsonData).length;

    const { data: backup, error: insertError } = await adminClient
      .from("backups")
      .insert({
        site_id,
        tenant_id,
        type: type || "manual",
        label: label || `Sauvegarde ${new Date().toLocaleDateString("fr-FR")}`,
        scope: backupScope,
        tables_included: Object.keys(data),
        record_count: totalRecords,
        size_bytes: sizeBytes,
        data,
        status: "completed",
      })
      .select("id, created_at, label, scope, record_count, size_bytes, tables_included")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, backup }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
