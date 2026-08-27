import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "superadmin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: superadmin only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      address,
      currency,
      currency_symbol,
      subscription_plan,
      subscription_end_date,
      admin_email,
      admin_password,
      admin_full_name,
    } = body;

    if (!name || !admin_email || !admin_password || !admin_full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: companyData, error: companyError } = await adminClient
      .from("companies")
      .insert({
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        currency: currency || "XOF",
        currency_symbol: currency_symbol || "F CFA",
        subscription_plan: subscription_plan || "trial",
        subscription_status: "active",
        subscription_end_date,
        is_active: true,
      })
      .select()
      .single();

    if (companyError || !companyData) {
      return new Response(
        JSON.stringify({ error: companyError?.message || "Failed to create company" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: admin_email,
        password: admin_password,
        email_confirm: true,
      });

    if (authError || !authData?.user) {
      await adminClient.from("companies").delete().eq("id", companyData.id);
      return new Response(
        JSON.stringify({ error: authError?.message || "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: authData.user.id,
      company_id: companyData.id,
      full_name: admin_full_name,
      role: "admin",
      is_active: true,
    });

    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        company_id: companyData.id,
        company_name: companyData.name,
        user_id: authData.user.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
