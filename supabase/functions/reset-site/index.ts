import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DATA_TABLES = [
  "sale_items",
  "payments",
  "sales",
  "cash_sessions",
  "order_items",
  "orders",
  "deliveries",
  "online_order_items",
  "online_orders",
  "stock_movements",
  "customers",
  "reservations",
];

const CONFIG_TABLES = [
  "recipes",
  "recipe_items",
  "ingredients",
  "warehouses",
  "restaurant_tables",
  "products",
  "categories",
  "roles",
  "users",
  "settings",
];

const ALL_TABLES = [...DATA_TABLES, ...CONFIG_TABLES];

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

    // Verify site exists
    const { data: siteCheck } = await adminClient
      .from("sites")
      .select("id, name")
      .eq("id", site_id)
      .maybeSingle();

    if (!siteCheck) {
      return new Response(
        JSON.stringify({ error: "Site introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tablesToReset = scope === "config" ? CONFIG_TABLES : (scope === "data" ? DATA_TABLES : ALL_TABLES);
    const results: Record<string, number> = {};

    for (const table of tablesToReset) {
      const { count, error } = await adminClient
        .from(table)
        .delete({ count: "exact" })
        .eq("site_id", site_id);

      if (error) {
        results[table] = -1;
      } else {
        results[table] = count ?? 0;
      }
    }

    // If full reset, recreate default settings for the site
    if (scope === "full" || scope === "config") {
      const { data: tenantData } = await adminClient
        .from("sites")
        .select("tenant_id")
        .eq("id", site_id)
        .maybeSingle();

      if (tenantData) {
        await adminClient.from("settings").insert({
          site_id,
          tenant_id: tenantData.tenant_id,
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
    }

    const totalDeleted = Object.values(results).reduce((s, c) => s + (c >= 0 ? c : 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        site: siteCheck.name,
        scope,
        results,
        total_deleted: totalDeleted,
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
