import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function sendViaTwilio(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  channel: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const fromNumber = channel === "whatsapp" ? `whatsapp:${from}` : from;
  const toNumber   = channel === "whatsapp" ? `whatsapp:${to}`   : to;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ From: fromNumber, To: toNumber, Body: body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as { message?: string }).message ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tenantId, tenantName, tenantSlug, createdAt, test, testPhone, testChannel } = body as {
      tenantId?: string;
      tenantName?: string;
      tenantSlug?: string;
      createdAt?: string;
      test?: boolean;
      testPhone?: string;
      testChannel?: string;
    };

    // Twilio credentials from secrets
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM");

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("[notify-new-tenant] Twilio credentials not configured — skipping notification.");
      return new Response(
        JSON.stringify({ skipped: true, reason: "Twilio credentials not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For test sends, use the phone/channel passed directly in the body
    let admins: { notification_phone: string; notification_channel: string }[] = [];

    if (test && testPhone) {
      admins = [{ notification_phone: testPhone, notification_channel: testChannel ?? "sms" }];
    } else {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data } = await supabaseAdmin
        .from("super_admins")
        .select("notification_phone, notification_channel")
        .eq("notifications_enabled", true);
      admins = (data ?? []) as { notification_phone: string; notification_channel: string }[];
    }

    if (admins.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No admins have notifications enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dateStr = createdAt ? formatDate(createdAt) : formatDate(new Date().toISOString());
    const message = test
      ? `✅ Test de notification activé.\n\nVous recevrez un message comme celui-ci pour chaque nouvelle demande de compte restaurant.`
      : `🔔 Nouvelle demande de compte\n\n📛 Établissement: ${tenantName ?? "—"}\n🔗 Identifiant: ${tenantSlug ?? "—"}\n🕐 ${dateStr}\n\nConnectez-vous à votre panneau d'administration pour traiter cette demande.`;

    const results: { phone: string; channel: string; ok: boolean; error?: string }[] = [];

    for (const admin of admins) {
      const phone   = (admin as { notification_phone: string | null }).notification_phone;
      const channel = (admin as { notification_channel: string }).notification_channel ?? "sms";

      if (!phone) continue;

      const result = await sendViaTwilio(accountSid, authToken, fromNumber, phone, channel, message);
      results.push({ phone, channel, ...result });
    }

    console.log("[notify-new-tenant]", JSON.stringify({ tenantName, results }));

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[notify-new-tenant] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
