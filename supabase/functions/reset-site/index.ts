import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Operational / transactional data (cleared on "data" or "full" reset).
// Ordered children-first so foreign keys don't block deletion.
const DATA_TABLES: { table: string; column: string }[] = [
  { table: "sale_item_component_consumptions", column: "site_id" },
  { table: "sale_items", column: "site_id" },
  { table: "payments", column: "site_id" },
  { table: "sales", column: "site_id" },
  { table: "cash_sessions", column: "site_id" },
  { table: "cancellation_requests", column: "site_id" },
  { table: "order_items", column: "site_id" },
  { table: "orders", column: "site_id" },
  { table: "deliveries", column: "site_id" },
  { table: "driver_payments", column: "site_id" },
  { table: "drivers", column: "site_id" },
  { table: "online_orders", column: "site_id" },
  { table: "stock_movements", column: "site_id" },
  { table: "component_stock_movements", column: "site_id" },
  { table: "customers", column: "site_id" },
  { table: "reservations", column: "site_id" },
  { table: "sessions", column: "site_id" },
  { table: "expenses", column: "site_id" },
  { table: "productions", column: "site_id" },
  { table: "warehouse_transfer_items", column: "site_id" },
  { table: "warehouse_transfers", column: "site_id" },
  { table: "warehouse_stock", column: "site_id" },
  { table: "supplier_invoices", column: "site_id" },
  { table: "purchase_order_items", column: "site_id" },
  { table: "purchase_orders", column: "site_id" },
  { table: "losses", column: "site_id" },
];

// Configuration data (cleared on "config" or "full" reset).
// Children-first ordering.
const CONFIG_TABLES: { table: string; column: string }[] = [
  { table: "product_compositions", column: "site_id" },
  { table: "product_components", column: "site_id" },
  { table: "sauces", column: "site_id" },
  { table: "flavors", column: "site_id" },
  { table: "recipe_items", column: "site_id" },
  { table: "recipes", column: "site_id" },
  { table: "ingredients", column: "site_id" },
  { table: "warehouses", column: "site_id" },
  { table: "restaurant_tables", column: "site_id" },
  { table: "products", column: "site_id" },
  { table: "categories", column: "site_id" },
  { table: "suppliers", column: "site_id" },
  { table: "users", column: "site_id" },
  { table: "settings", column: "site_id" },
];

// Tables scoped by tenant_id instead of site_id.
// These are cleared on "config" or "full" reset only.
const TENANT_TABLES: { table: string }[] = [
  { table: "roles" },
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

    const { site_id, scope, confirm } = await req.json();

    if (!site_id) {
      return new Response(
        JSON.stringify({ error: "site_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (confirm !== "RESET_CONFIRMED") {
      return new Response(
        JSON.stringify({ error: "Confirmation requise" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify super admin
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

    // Verify site exists and get tenant_id
    const { data: siteCheck } = await adminClient
      .from("sites")
      .select("id, name, tenant_id")
      .eq("id", site_id)
      .maybeSingle();

    if (!siteCheck) {
      return new Response(
        JSON.stringify({ error: "Site introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = siteCheck.tenant_id as string;

    const isFull = scope === "full";
    const resetData = isFull || scope === "data";
    const resetConfig = isFull || scope === "config";

    const tablesToReset: { table: string; column: string; value: string }[] = [];
    if (resetData) {
      for (const t of DATA_TABLES) tablesToReset.push({ ...t, value: site_id });
    }
    if (resetConfig) {
      for (const t of CONFIG_TABLES) tablesToReset.push({ ...t, value: site_id });
      for (const t of TENANT_TABLES) tablesToReset.push({ table: t.table, column: "tenant_id", value: tenantId });
    }

    const results: Record<string, number> = {};
    let totalDeleted = 0;
    const errors: string[] = [];

    for (const { table, column, value } of tablesToReset) {
      const { count, error } = await adminClient
        .from(table)
        .delete({ count: "exact" })
        .eq(column, value);

      if (error) {
        results[table] = -1;
        errors.push(`${table}: ${error.message}`);
      } else {
        results[table] = count ?? 0;
        totalDeleted += count ?? 0;
      }
    }

    // Recreate default settings for the site after config/full reset
    if (resetConfig) {
      await adminClient.from("settings").insert({
        site_id,
        tenant_id: tenantId,
        restaurant_name: siteCheck.name,
        currency_code: "XOF",
        currency_symbol: "FCFA",
        tax_rate: 0,
        active_modules: {
          pos: true,
          kitchen: true,
          delivery: false,
          inventory: true,
          production: false,
          reservations: false,
          reports: true,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        site: siteCheck.name,
        scope,
        results,
        total_deleted: totalDeleted,
        warnings: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
