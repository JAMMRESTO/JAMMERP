import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PrintLineItem {
  nom: string;
  qty: number;
  notes?: string;
  options?: string[];
  unitPrice: number;
}

interface PrintRequest {
  ip: string;
  port: number;
  tableNom: string;
  ticketNumber: string;
  type: "INITIAL" | "ADDONS" | "BILL";
  printerNom: string;
  printerType?: "CUISINE" | "BAR" | "CAISSE" | "AUTRE";
  items: PrintLineItem[];
  total?: number;
}

interface RestaurantInfo {
  name: string;
  address: string | null;
  phone: string | null;
}

let cachedRestaurant: RestaurantInfo | null = null;

async function getRestaurantInfo(): Promise<RestaurantInfo> {
  if (cachedRestaurant) return cachedRestaurant;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("restaurants")
      .select("name, address, phone")
      .maybeSingle();
    cachedRestaurant = {
      name: data?.name || "SEN RESTO",
      address: data?.address || null,
      phone: data?.phone || null,
    };
  } catch {
    cachedRestaurant = { name: "SEN RESTO", address: null, phone: null };
  }
  return cachedRestaurant;
}

function encodeText(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "." : s;
}

function mergeItems(items: PrintLineItem[]): PrintLineItem[] {
  const map = new Map<string, PrintLineItem>();
  for (const item of items) {
    const key = `${item.nom}|${item.unitPrice}|${(item.options || []).join(",")}|${item.notes || ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

function buildEscPos(req: PrintRequest, restaurant: RestaurantInfo): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF = 0x0a;

  const typeLabel: Record<string, string> = {
    INITIAL: "BON DE COMMANDE",
    ADDONS: "AJOUTS",
    BILL: "ADDITION",
  };

  const destWord: Record<string, string> = {
    CUISINE: "CUISINE",
    BAR: "BAR",
    CAISSE: "CAISSE",
    AUTRE: "PREPARATION",
  };
  const dest = destWord[req.printerType || "AUTRE"] || "PREPARATION";
  const orderTitle = req.type === "INITIAL" ? `BON ${dest}` : req.type === "ADDONS" ? `AJOUTS ${dest}` : typeLabel[req.type];

  const now = new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dakar",
  });

  const chunks: Uint8Array[] = [];

  const push = (...bytes: number[]) => chunks.push(new Uint8Array(bytes));
  const text = (s: string) => chunks.push(encodeText(s));
  const nl = () => push(LF);
  const centerOn = () => push(ESC, 0x61, 0x01);
  const centerOff = () => push(ESC, 0x61, 0x00);
  const boldOn = () => push(ESC, 0x45, 0x01);
  const boldOff = () => push(ESC, 0x45, 0x00);
  const doubleOn = () => push(ESC, 0x21, 0x30);
  const doubleOff = () => push(ESC, 0x21, 0x00);
  const COLS = 48;
  const DOUBLE_COLS = 24;
  const separator = () => { text("-".repeat(COLS)); nl(); };
  const doubleSeparator = () => { text("=".repeat(COLS)); nl(); };

  push(ESC, 0x40);
  push(ESC, 0x74, 0x13);

  centerOn();
  boldOn();
  doubleOn();
  text(restaurant.name);
  nl();
  doubleOff();
  boldOff();

  if (req.type === "BILL") {
    if (restaurant.address) { text(restaurant.address); nl(); }
    if (restaurant.phone) { text("Tel: " + restaurant.phone); nl(); }
    doubleSeparator();
    boldOn();
    text(orderTitle);
    nl();
    boldOff();
  } else if (req.type === "INITIAL" || req.type === "ADDONS") {
    boldOn();
    doubleOn();
    text(orderTitle);
    nl();
    doubleOff();
    boldOff();
    doubleSeparator();
  }

  centerOff();

  if (req.type !== "INITIAL" && req.type !== "ADDONS") {
    separator();

    text(`Table  : ${req.tableNom}`);
    nl();
    text(`Ticket : ${req.ticketNumber}`);
    nl();
    text(`Heure  : ${now}`);
    nl();

    separator();
  }

  const merged = mergeItems(req.items);

  for (const item of merged) {
    const lineTotalStr = fmtNum(item.unitPrice * item.qty) + "F";
    const prefix = `${item.qty}x `;
    const isOrderTicket = req.type === "INITIAL" || req.type === "ADDONS";
    const maxNom = req.type === "BILL" ? COLS - prefix.length - lineTotalStr.length - 1 : COLS - prefix.length;
    const nomShort = truncate(item.nom, Math.max(8, maxNom));
    const qtyNom = prefix + nomShort;
    if (req.type === "BILL") {
      const spaces = Math.max(1, COLS - qtyNom.length - lineTotalStr.length);
      boldOn();
      text(qtyNom + " ".repeat(spaces) + lineTotalStr);
      boldOff();
    } else if (isOrderTicket) {
      const dPrefix = `${item.qty}x `;
      const dMaxNom = DOUBLE_COLS - dPrefix.length;
      const dNomShort = truncate(item.nom, Math.max(6, dMaxNom));
      boldOn();
      doubleOn();
      text(dPrefix + dNomShort);
      doubleOff();
      boldOff();
    } else {
      boldOn();
      text(qtyNom);
      boldOff();
    }
    nl();

    if (item.options && item.options.length > 0) {
      text(`  > ${item.options.join(", ")}`);
      nl();
    }
    if (item.notes) {
      text(`  ! ${item.notes}`);
      nl();
    }
  }

  separator();

  if (req.type === "BILL") {
    const itemsTotal = merged.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const computedTotal = (req.total && req.total > 0) ? req.total : itemsTotal;
    const totalStr = fmtNum(computedTotal) + " FCFA";
    const label = "TOTAL:";
    if (label.length + totalStr.length <= DOUBLE_COLS) {
      const dPad = Math.max(1, DOUBLE_COLS - label.length - totalStr.length);
      centerOn();
      doubleOn();
      boldOn();
      text(label + " ".repeat(dPad) + totalStr);
      boldOff();
      doubleOff();
      nl();
      centerOff();
    } else {
      const normalPad = Math.max(1, COLS - label.length - totalStr.length);
      boldOn();
      text(label + " ".repeat(normalPad) + totalStr);
      boldOff();
      nl();
    }
    separator();
  }

  if (req.type !== "INITIAL" && req.type !== "ADDONS") {
    centerOn();
    text("* Merci de votre confiance *");
    nl();
    centerOff();
  }

  push(LF, LF, LF, LF);
  push(GS, 0x56, 0x00);

  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: PrintRequest = await req.json();

    if (!body.ip || !body.port || !body.items || body.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Paramètres manquants : ip, port, items requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const restaurant = await getRestaurantInfo();
    const escposData = buildEscPos(body, restaurant);

    const conn = await Deno.connect({ hostname: body.ip, port: body.port, transport: "tcp" });

    const writePromise = conn.write(escposData);
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout d'écriture")), 2000)
    );

    await Promise.race([writePromise, timeout]);
    conn.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const message = err?.message || "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
