import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TCP_TIMEOUT_MS = 5000;

async function connectWithTimeout(ip: string, port: number): Promise<Deno.TcpConn> {
  return await Promise.race([
    Deno.connect({ hostname: ip, port, transport: "tcp" }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Connection timeout after ${TCP_TIMEOUT_MS}ms`)), TCP_TIMEOUT_MS)
    ),
  ]);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { ip, port, payload } = await req.json();

    if (!ip || !port || !payload) {
      return new Response(JSON.stringify({ error: "ip, port and payload are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conn = await connectWithTimeout(ip, Number(port));

    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(payload);
      const writer = conn.writable.getWriter();
      await Promise.race([
        writer.write(bytes).then(() => writer.close()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Write timeout")), TCP_TIMEOUT_MS)
        ),
      ]);
    } finally {
      try { conn.close(); } catch { /* already closed */ }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
