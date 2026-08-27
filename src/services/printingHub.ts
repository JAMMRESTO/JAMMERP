import { supabase } from '../lib/supabase';
import { Printer, PrintStation } from '../lib/types';
import { rawToHtml, triggerBrowserPrint } from '../lib/printService';
import { printWithQzTray } from '../lib/qzTray';

let _toastCallback: ((msg: string, type?: 'error' | 'info' | 'success') => void) | null = null;

export function setToastCallback(fn: (msg: string, type?: 'error' | 'info' | 'success') => void) {
  _toastCallback = fn;
}

export function toast(msg: string, type: 'error' | 'info' | 'success' = 'info') {
  _toastCallback?.(msg, type);
}

export function encodePayload(raw: string): string {
  return btoa(unescape(encodeURIComponent(raw)));
}

export function decodePayload(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return encoded;
  }
}

export async function createPendingPrintJob(params: {
  orderId?: string;
  printerId: string;
  tableId?: string;
  type: 'INITIAL' | 'ADDONS' | 'BILL' | 'TEST' | 'REPORT_X' | 'REPORT_Z';
  contentSummary: string;
  payloadText: string;
  createdBy?: string;
}): Promise<string | null> {
  const encoded = encodePayload(params.payloadText);
  const { data, error } = await supabase
    .from('print_jobs')
    .insert({
      order_id: params.orderId ?? null,
      printer_id: params.printerId,
      table_id: params.tableId ?? null,
      type: params.type,
      content_summary: params.contentSummary,
      payload_text: encoded,
      status: 'PENDING',
      last_error: null,
      created_by: params.createdBy ?? null,
    })
    .select('id')
    .single();

  if (error) return null;
  const jobId = data?.id ?? null;

  if (jobId) {
    const { data: printer } = await supabase
      .from('printers')
      .select('id, nom, connection_type, usb_name')
      .eq('id', params.printerId)
      .maybeSingle();
    if (printer?.connection_type === 'NETWORK') return jobId;

    const html = rawToHtml(decodePayload(encoded));
    const qzPrinterName = printer?.usb_name || printer?.nom || '';
    const printedWithQz = await printWithQzTray(qzPrinterName, html);

    const { error: claimError } = await supabase
      .from('print_jobs')
      .update({ status: 'PRINTING' })
      .eq('id', jobId)
      .eq('status', 'PENDING');
    if (!claimError && printedWithQz) {
      await supabase.from('print_jobs').update({
        status: 'SUCCESS',
        printed_at: new Date().toISOString(),
      }).eq('id', jobId).eq('status', 'PRINTING');
    } else if (!claimError) {
      triggerBrowserPrint(html, params.printerId)
        .then(() =>
          supabase.from('print_jobs').update({
            status: 'SUCCESS',
            printed_at: new Date().toISOString(),
          }).eq('id', jobId).eq('status', 'PRINTING')
        )
        .catch(() =>
          supabase.from('print_jobs').update({
            status: 'FAILED',
            last_error: 'Browser print failed',
          }).eq('id', jobId).eq('status', 'PRINTING')
        );
    }
  }

  return jobId;
}

// --- Shared routing cache ---

interface CatRow { id: string; printer_id: string | null; parent_id: string | null; }

const _catPrinterCache = new Map<string, { printer: Printer; station: PrintStation } | null>();
let _catPrinterCacheTime = 0;
const CAT_CACHE_TTL = 30_000;

function stationFromType(type: string): PrintStation {
  if (type === 'CUISINE') return 'kitchen';
  if (type === 'BAR') return 'bar';
  if (type === 'CAISSE') return 'cashier';
  return 'other';
}

function resolveEffectivePrinterId(
  catId: string,
  catMap: Map<string, CatRow>
): string | null {
  const cat = catMap.get(catId);
  if (!cat) return null;
  if (cat.printer_id) return cat.printer_id;
  if (cat.parent_id) return resolveEffectivePrinterId(cat.parent_id, catMap);
  return null;
}

export async function loadCatPrinterCache(): Promise<void> {
  const now = Date.now();
  if (now - _catPrinterCacheTime < CAT_CACHE_TTL && _catPrinterCache.size > 0) return;

  const [catsRes, printersRes] = await Promise.all([
    supabase.from('categories').select('id, printer_id, parent_id'),
    supabase.from('printers').select('*').eq('active', true),
  ]);

  const cats: CatRow[] = catsRes.data || [];
  const printers: Printer[] = (printersRes.data || []) as Printer[];
  const printerMap = new Map(printers.map(p => [p.id, p]));
  const catMap = new Map(cats.map(c => [c.id, c]));

  _catPrinterCache.clear();
  for (const cat of cats) {
    const pid = resolveEffectivePrinterId(cat.id, catMap);
    if (pid) {
      const printer = printerMap.get(pid);
      _catPrinterCache.set(cat.id, printer ? { printer, station: stationFromType(printer.type) } : null);
    } else {
      _catPrinterCache.set(cat.id, null);
    }
  }
  _catPrinterCacheTime = now;
}

export function invalidateCatPrinterCache(): void {
  _catPrinterCacheTime = 0;
}

export async function resolveCatPrinter(
  categoryId: string
): Promise<{ printer: Printer; station: PrintStation } | null> {
  await loadCatPrinterCache();
  return _catPrinterCache.get(categoryId) ?? null;
}

export function resolveCatPrinterSync(
  categoryId: string
): { printer: Printer; station: PrintStation } | null {
  return _catPrinterCache.get(categoryId) ?? null;
}

export async function retryPrintJob(jobId: string): Promise<void> {
  await supabase
    .from('print_jobs')
    .update({ status: 'PENDING', last_error: null })
    .eq('id', jobId);
}
