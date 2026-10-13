import { supabase } from './supabase';
import { PaymentMethod } from './types';
import {
  claimPrintJob, markJobSuccess, markJobFailed,
  getAssociation, ensureUsbActivationTime, getUsbActivationTime,
} from './usbPrintService';
import { loadCatPrinterCache } from '../services/printingHub';
import { sendTicketFromPayload } from './printDispatcher';

let polling = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL = 5000;

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  OTHER: 'Autre',
};

interface RestaurantInfo {
  name: string;
  address: string | null;
  phone: string | null;
}

let _restoInfo: RestaurantInfo | null = null;
async function getRestoInfo(): Promise<RestaurantInfo> {
  if (_restoInfo) return _restoInfo;
  const { data } = await supabase
    .from('restaurants')
    .select('name, address, phone')
    .maybeSingle();
  _restoInfo = {
    name: data?.name || 'LA FIESTA',
    address: data?.address || null,
    phone: data?.phone || null,
  };
  return _restoInfo;
}

function getAssociatedPrinterIds(): string[] {
  const arr: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('usb_assoc_')) {
      arr.push(key.replace('usb_assoc_', ''));
    }
  }
  return arr;
}

export function startUsbPrintPolling(): void {
  if (pollTimer) return;
  ensureUsbActivationTime();
  pollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL);
  void pollOnce();
}

export function stopUsbPrintPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollOnce(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const activationTime = getUsbActivationTime();
    if (!activationTime) return;

    const associatedIds = getAssociatedPrinterIds();
    if (associatedIds.length === 0) return;

    const { data: jobs } = await supabase
      .from('print_jobs')
      .select('id, printer_id, type, created_at, order_id, table_id')
      .eq('status', 'PENDING')
      .in('printer_id', associatedIds)
      .gte('created_at', activationTime)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!jobs || jobs.length === 0) return;

    await loadCatPrinterCache();
    const resto = await getRestoInfo();

    for (const job of jobs) {
      const printerId = job.printer_id;
      if (!printerId || !getAssociation(printerId)) continue;

      const claimed = await claimPrintJob(job.id);
      if (!claimed) continue;

      try {
        await sendTicketFromPayload(printerId, claimed, resto, PAYMENT_METHOD_LABELS);
        const ok = await markJobSuccess(job.id);
        if (!ok) {
          console.warn(`[USB Print] Job ${job.id} envoyé mais enregistrement SUCCESS échoué. Travail laissé en PRINTING — intervention manuelle requise.`);
        }
      } catch (err: any) {
        const msg = err?.message || String(err) || 'Erreur USB';
        await markJobFailed(job.id, msg);
        console.warn(`[USB Print] Job ${job.id} FAILED: ${msg}`);
      }
    }
  } finally {
    polling = false;
  }
}

export async function retryPrintJobManually(jobId: string): Promise<void> {
  const { data: job } = await supabase
    .from('print_jobs')
    .select('id, printer_id, type, payload_text, order_id, table_id, status')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return;
  if (job.status === 'PRINTING') {
    const { error } = await supabase
      .from('print_jobs')
      .update({ status: 'PENDING', last_error: null })
      .eq('id', jobId)
      .eq('status', 'PRINTING');
    if (error) throw new Error('Travail encore en cours sur un autre poste. Attendez ou vérifiez.');
  } else if (job.status === 'FAILED') {
    await supabase
      .from('print_jobs')
      .update({ status: 'PENDING', last_error: null })
      .eq('id', jobId);
  } else {
    return;
  }
  await pollOnce();
}

export { PAYMENT_METHOD_LABELS };
