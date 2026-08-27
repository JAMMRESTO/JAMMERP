import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "En-tete d'autorisation manquant" }, 401);
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
      return jsonResponse({ error: "Non authentifie" }, 401);
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
      return jsonResponse({ error: "Acces refuse: superadmin uniquement" }, 403);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "list") {
      const companyId = url.searchParams.get("company_id");

      let query = adminClient
        .from("profiles")
        .select("id, company_id, full_name, role, role_id, is_active, created_at")
        .order("created_at", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data: profiles, error } = await query;
      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      const enriched = [];
      for (const profile of profiles || []) {
        try {
          const { data: authUser } = await adminClient.auth.admin.getUserById(
            profile.id
          );
          enriched.push({
            ...profile,
            email: authUser?.user?.email || null,
          });
        } catch {
          enriched.push({ ...profile, email: null });
        }
      }

      return jsonResponse({ users: enriched });
    }

    if (req.method === "POST" && action === "create") {
      let body;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Corps de la requete invalide" }, 400);
      }
      const { company_id, email, password, full_name, role, role_id } = body;

      if (!company_id || !email || !password || !full_name || !role) {
        return jsonResponse({ error: "Tous les champs sont obligatoires" }, 400);
      }

      if (password.length < 6) {
        return jsonResponse(
          { error: "Le mot de passe doit contenir au moins 6 caracteres" },
          400
        );
      }

      const validRoles = ["admin", "manager", "salesperson", "accountant"];
      if (!validRoles.includes(role)) {
        return jsonResponse({ error: "Role invalide" }, 400);
      }

      const { data: companyExists } = await adminClient
        .from("companies")
        .select("id")
        .eq("id", company_id)
        .maybeSingle();

      if (!companyExists) {
        return jsonResponse({ error: "Societe introuvable" }, 404);
      }

      if (role_id) {
        const { data: roleExists } = await adminClient
          .from("roles")
          .select("id")
          .eq("id", role_id)
          .eq("company_id", company_id)
          .maybeSingle();

        if (!roleExists) {
          return jsonResponse({ error: "Role de permissions introuvable" }, 404);
        }
      }

      const { data: authData, error: authError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError || !authData?.user) {
        const msg = authError?.message || "Echec de la creation du compte";
        const friendlyMsg = msg.includes("already been registered")
          ? "Cet email est deja utilise"
          : msg;
        return jsonResponse({ error: friendlyMsg }, 400);
      }

      const profileData: Record<string, unknown> = {
        id: authData.user.id,
        company_id,
        full_name,
        role,
        is_active: true,
      };

      if (role_id) {
        profileData.role_id = role_id;
      }

      const { error: profileError } = await adminClient
        .from("profiles")
        .insert(profileData);

      if (profileError) {
        await adminClient.auth.admin.deleteUser(authData.user.id);
        return jsonResponse({ error: "Erreur creation profil: " + profileError.message }, 500);
      }

      return jsonResponse({
        user_id: authData.user.id,
        email,
        full_name,
        role,
        role_id: role_id || null,
      });
    }

    if (req.method === "PUT" && action === "toggle-active") {
      const body = await req.json();
      const { user_id, is_active } = body;

      if (!user_id || typeof is_active !== "boolean") {
        return jsonResponse({ error: "Donnees manquantes" }, 400);
      }

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user_id)
        .maybeSingle();

      if (targetProfile?.role === "superadmin") {
        return jsonResponse(
          { error: "Impossible de modifier le statut du superadmin" },
          403
        );
      }

      const { error } = await adminClient
        .from("profiles")
        .update({ is_active })
        .eq("id", user_id);

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (req.method === "PUT" && action === "update-role") {
      const body = await req.json();
      const { user_id, role, role_id } = body;

      if (!user_id || !role) {
        return jsonResponse({ error: "Donnees manquantes" }, 400);
      }

      const validRoles = ["admin", "manager", "salesperson", "accountant"];
      if (!validRoles.includes(role)) {
        return jsonResponse({ error: "Role invalide" }, 400);
      }

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user_id)
        .maybeSingle();

      if (targetProfile?.role === "superadmin") {
        return jsonResponse({ error: "Impossible de modifier le role du superadmin" }, 403);
      }

      const updateData: Record<string, unknown> = { role };
      if (role_id !== undefined) {
        updateData.role_id = role_id || null;
      }

      const { error } = await adminClient
        .from("profiles")
        .update(updateData)
        .eq("id", user_id);

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (req.method === "PUT" && action === "reset-password") {
      const body = await req.json();
      const { user_id, new_password } = body;

      if (!user_id || !new_password) {
        return jsonResponse(
          { error: "Donnees manquantes" },
          400
        );
      }

      if (new_password.length < 6) {
        return jsonResponse(
          { error: "Le mot de passe doit contenir au moins 6 caracteres" },
          400
        );
      }

      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Action inconnue" }, 400);
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Erreur interne du serveur",
      },
      500
    );
  }
});
