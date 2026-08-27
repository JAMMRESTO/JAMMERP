import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();

    if (action === "authenticate") {
      const { pin } = body;
      if (!pin) return json({ error: "PIN requis" }, 400);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nom, email, role, is_super_admin, organisation_id")
        .eq("pin_code", pin)
        .eq("actif", true)
        .maybeSingle();

      if (error) return json({ error: "Erreur serveur" }, 500);
      if (!data) return json({ user: null });

      return json({ user: data });
    }

    if (action === "create-session") {
      const { profile_id } = body;
      if (!profile_id) return json({ error: "profile_id requis" }, 400);

      // Clean expired sessions
      await supabase
        .from("app_sessions")
        .delete()
        .lt("expires_at", new Date().toISOString());

      // Get profile's organisation_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("organisation_id")
        .eq("id", profile_id)
        .maybeSingle();

      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("app_sessions")
        .insert({ profile_id, expires_at: expiresAt, organisation_id: profile?.organisation_id || null })
        .select("token")
        .maybeSingle();

      if (error || !data) return json({ error: "Impossible de créer la session" }, 500);

      return json({ token: data.token });
    }

    if (action === "check-session") {
      const { token } = body;
      if (!token) return json({ valid: false });

      const { data } = await supabase
        .from("app_sessions")
        .select("token")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      return json({ valid: !!data });
    }

    if (action === "get-profile") {
      const { token } = body;
      if (!token) return json({ error: "Token requis" }, 400);

      const { data: session } = await supabase
        .from("app_sessions")
        .select("profile_id")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!session) return json({ error: "Session invalide" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, nom, email, role, is_super_admin, organisation_id")
        .eq("id", session.profile_id)
        .maybeSingle();

      if (!profile) return json({ user: null });
      return json({ user: profile });
    }

    if (action === "destroy-session") {
      const { token } = body;
      if (token) {
        await supabase.from("app_sessions").delete().eq("token", token);
      }
      return json({ ok: true });
    }

    if (action === "switch-organisation") {
      const { token, organisation_id } = body;
      if (!token || !organisation_id) return json({ error: "token et organisation_id requis" }, 400);

      const { data: session } = await supabase
        .from("app_sessions")
        .select("profile_id")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!session) return json({ error: "Session invalide" }, 401);

      const { data: caller } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", session.profile_id)
        .maybeSingle();
      if (!caller?.is_super_admin) return json({ error: "Seul le super administrateur peut changer d'organisation" }, 403);

      const { error: updateErr } = await supabase
        .from("app_sessions")
        .update({ organisation_id })
        .eq("token", token);

      if (updateErr) return json({ error: updateErr.message }, 500);

      return json({ ok: true, organisation_id });
    }

    async function getProfileFromToken(token: string) {
      const { data: session } = await supabase
        .from("app_sessions")
        .select("profile_id, organisation_id")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!session) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, role, caisse_id, organisation_id")
        .eq("id", session.profile_id)
        .maybeSingle();
      if (!profile) return null;
      return { ...profile, organisation_id: session.organisation_id || profile.organisation_id };
    }

    if (action === "set-fond-caisse") {
      const { token, caisse_id, montant } = body;
      if (!token || !caisse_id || montant === undefined) return json({ error: "token, caisse_id et montant requis" }, 400);

      const profile = await getProfileFromToken(token);
      if (!profile) return json({ error: "Session invalide" }, 401);

      if (profile.role === "caissier" && profile.caisse_id !== caisse_id) {
        return json({ error: "Vous ne pouvez modifier que votre propre caisse" }, 403);
      }

      const montantNum = Number(montant);
      if (isNaN(montantNum) || montantNum < 0) return json({ error: "Montant invalide" }, 400);

      const { error: updateErr } = await supabase
        .from("caisses")
        .update({ fond_de_caisse: montantNum })
        .eq("id", caisse_id);

      if (updateErr) return json({ error: "Impossible de définir le fond de caisse: " + updateErr.message }, 500);

      return json({ ok: true, fond_de_caisse: montantNum });
    }

    if (action === "cloturer-caisse") {
      const { token, caisse_id } = body;
      if (!token || !caisse_id) return json({ error: "token et caisse_id requis" }, 400);

      const profile = await getProfileFromToken(token);
      if (!profile) return json({ error: "Session invalide" }, 401);

      // Caissiers can only close their own assigned caisse
      if (profile.role === "caissier" && profile.caisse_id !== caisse_id) {
        return json({ error: "Vous ne pouvez clôturer que votre propre caisse" }, 403);
      }

      // Get current fond_de_caisse
      const { data: caisseData } = await supabase
        .from("caisses")
        .select("fond_de_caisse")
        .eq("id", caisse_id)
        .maybeSingle();
      const fondDeCaisse = Number(caisseData?.fond_de_caisse ?? 0);

      // Get the date of the earliest transaction
      const { data: firstEnc } = await supabase
        .from("encaissements")
        .select("date_transaction")
        .eq("caisse_id", caisse_id)
        .order("date_transaction", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: firstDec } = await supabase
        .from("decaissements")
        .select("date_transaction")
        .eq("caisse_id", caisse_id)
        .order("date_transaction", { ascending: true })
        .limit(1)
        .maybeSingle();

      const dates = [firstEnc?.date_transaction, firstDec?.date_transaction].filter(Boolean).sort();
      const dateDebut = dates[0] ?? new Date().toISOString().slice(0, 10);

      // Calculate totals for the entire caisse
      const { data: encStats } = await supabase.from("encaissements").select("montant").eq("caisse_id", caisse_id);
      const { data: decStats } = await supabase.from("decaissements").select("montant").eq("caisse_id", caisse_id);

      const totalEnc = (encStats ?? []).reduce((s: number, r: { montant: number }) => s + Number(r.montant), 0);
      const totalDec = (decStats ?? []).reduce((s: number, r: { montant: number }) => s + Number(r.montant), 0);
      const nbEnc = (encStats ?? []).length;
      const nbDec = (decStats ?? []).length;
      // Solde réel = fond de caisse + encaissements - décaissements
      const solde = fondDeCaisse + totalEnc - totalDec;

      // Insert cloture record — has_individual_records=true means transactions are kept (archived)
      const { data: cloture, error: insertErr } = await supabase
        .from("clotures_caisses")
        .insert({
          caisse_id,
          created_by: profile.id,
          date_debut: dateDebut,
          date_fin: new Date().toISOString().slice(0, 10),
          fond_de_caisse: fondDeCaisse,
          total_encaissements: totalEnc,
          total_decaissements: totalDec,
          solde,
          nb_encaissements: nbEnc,
          nb_decaissements: nbDec,
          has_individual_records: true,
          organisation_id: profile.organisation_id,
        })
        .select("id")
        .maybeSingle();

      if (insertErr || !cloture) return json({ error: "Impossible d'enregistrer la clôture: " + (insertErr?.message ?? "no data") }, 500);

      // Archive transactions (mark as archived, link to cloture) instead of deleting
      const [archEnc, archDec, resetFond] = await Promise.all([
        supabase.from("encaissements")
          .update({ archived: true, cloture_id: cloture.id })
          .eq("caisse_id", caisse_id)
          .eq("archived", false),
        supabase.from("decaissements")
          .update({ archived: true, cloture_id: cloture.id })
          .eq("caisse_id", caisse_id)
          .eq("archived", false),
        supabase.from("caisses").update({ fond_de_caisse: 0 }).eq("id", caisse_id),
      ]);

      const errors = [archEnc, archDec, resetFond].filter(r => r.error).map(r => r.error!.message);
      if (errors.length) return json({ error: errors.join("; ") }, 500);

      return json({
        ok: true,
        cloture: { date_debut: dateDebut, fond_de_caisse: fondDeCaisse, total_encaissements: totalEnc, total_decaissements: totalDec, solde, nb_encaissements: nbEnc, nb_decaissements: nbDec },
      });
    }

    if (action === "reset-data") {
      const { token, confirmation } = body;
      if (!token) return json({ error: "Token requis" }, 400);
      if (confirmation !== "RESET") return json({ error: "Confirmation invalide" }, 400);

      // Verify session is valid and user is admin
      const { data: session } = await supabase
        .from("app_sessions")
        .select("profile_id")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!session) return json({ error: "Session invalide" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.profile_id)
        .maybeSingle();

      if (!profile || profile.role !== "admin") {
        return json({ error: "Seul un administrateur peut réinitialiser" }, 403);
      }

      // Delete all transactions
      const [enc, dec, sess] = await Promise.all([
        supabase.from("encaissements").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("decaissements").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        supabase.from("app_sessions").delete().neq("token", token),
      ]);

      const errors = [enc, dec, sess].filter(r => r.error).map(r => r.error!.message);
      if (errors.length) return json({ error: errors.join("; ") }, 500);

      return json({ ok: true, deleted: { encaissements: enc.count, decaissements: dec.count, sessions: sess.count } });
    }

    if (action === "reset-pin") {
      const { token, target_user_id, new_pin } = body;
      if (!token || !target_user_id || !new_pin) return json({ error: "token, target_user_id et new_pin requis" }, 400);
      if (!/^\d{4}$/.test(new_pin)) return json({ error: "Le PIN doit etre exactement 4 chiffres" }, 400);

      const { data: session } = await supabase
        .from("app_sessions")
        .select("profile_id")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!session) return json({ error: "Session invalide" }, 401);

      const { data: caller } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", session.profile_id)
        .maybeSingle();
      if (!caller?.is_super_admin) return json({ error: "Seul le super administrateur peut reinitialiser les PINs" }, 403);

      // Check PIN not already used by another user
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("pin_code", new_pin)
        .neq("id", target_user_id)
        .maybeSingle();
      if (existing) return json({ error: "Ce code PIN est deja utilise par un autre utilisateur" }, 400);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ pin_code: new_pin })
        .eq("id", target_user_id);
      if (updateErr) return json({ error: updateErr.message }, 500);

      return json({ ok: true });
    }

    if (action === "check-subscription") {
      const { organisation_id } = body;

      let query = supabase
        .from("subscription")
        .select("*")
        .eq("actif", true)
        .order("date_fin", { ascending: false })
        .limit(1);

      if (organisation_id) {
        query = query.eq("organisation_id", organisation_id);
      }

      const { data: sub } = await query.maybeSingle();

      if (!sub) return json({ valid: true, subscription: null });

      const now = new Date().toISOString().slice(0, 10);
      const expired = sub.date_fin < now;

      return json({ valid: !expired, subscription: { ...sub, expired } });
    }

    if (action === "manage-subscription") {
      const { token, plan, date_debut, organisation_id } = body;
      if (!token || !plan) return json({ error: "token et plan requis" }, 400);
      if (!["mensuel", "trimestriel", "annuel"].includes(plan)) return json({ error: "Plan invalide (mensuel, trimestriel, annuel)" }, 400);

      const { data: session } = await supabase
        .from("app_sessions")
        .select("profile_id")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!session) return json({ error: "Session invalide" }, 401);

      const { data: caller } = await supabase
        .from("profiles")
        .select("is_super_admin, organisation_id")
        .eq("id", session.profile_id)
        .maybeSingle();
      if (!caller?.is_super_admin) return json({ error: "Seul le super administrateur peut gerer l'abonnement" }, 403);

      const targetOrgId = organisation_id || caller.organisation_id;

      const startDate = date_debut || new Date().toISOString().slice(0, 10);
      const start = new Date(startDate);
      let endDate: Date;

      if (plan === "mensuel") {
        endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (plan === "trimestriel") {
        endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + 3);
      } else {
        endDate = new Date(start);
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Deactivate existing subscriptions for this organisation
      if (targetOrgId) {
        await supabase.from("subscription").update({ actif: false }).eq("actif", true).eq("organisation_id", targetOrgId);
      } else {
        await supabase.from("subscription").update({ actif: false }).eq("actif", true);
      }

      // Create new subscription
      const insertData: Record<string, unknown> = {
        plan,
        date_debut: startDate,
        date_fin: endDate.toISOString().slice(0, 10),
        actif: true,
      };
      if (targetOrgId) insertData.organisation_id = targetOrgId;

      const { data: newSub, error: insertErr } = await supabase
        .from("subscription")
        .insert(insertData)
        .select()
        .maybeSingle();

      if (insertErr) return json({ error: insertErr.message }, 500);

      return json({ ok: true, subscription: newSub });
    }

    return json({ error: "Action inconnue" }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
