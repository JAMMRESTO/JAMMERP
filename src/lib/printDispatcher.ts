import { sendTicket } from './usbPrintService';
import { decodePayload } from '../services/printingHub';
import { EscPosItem } from './escpos';

interface RestaurantInfo {
  name: string;
  address: string | null;
  phone: string | null;
}

interface ClaimedJob {
  id: string;
  printer_id: string;
  type: string;
  payload_text: string;
  order_id: string | null;
  table_id: string | null;
}

type PaymentMethodLabels = Record<string, string>;

function parsePayloadItems(payloadText: string): EscPosItem[] {
  const decoded = decodePayload(payloadText);
  const items: EscPosItem[] = [];
  for (const line of decoded.split('\n')) {
    const m = line.match(/^(\d+)x\s+(.+)/);
    if (m) {
      items.push({ nom: m[2].trim(), qty: parseInt(m[1], 10), unitPrice: 0 });
    }
  }
  return items;
}

export async function sendTicketFromPayload(
  printerId: string,
  job: ClaimedJob,
  resto: RestaurantInfo,
  _paymentMethodLabels: PaymentMethodLabels,
): Promise<void> {
  const items = parsePayloadItems(job.payload_text);
  const decoded = decodePayload(job.payload_text);

  let total: number | undefined;
  const totalMatch = decoded.match(/TOTAL:?\s*([\d\s]+)\s*FCFA/i);
  if (totalMatch) {
    total = parseInt(totalMatch[1].replace(/\s/g, ''), 10) || undefined;
  }

  let montantRecu: number | undefined;
  const recuMatch = decoded.match(/RE[UÇ]U:?\s*([\d\s]+)\s*FCFA/i);
  if (recuMatch) {
    montantRecu = parseInt(recuMatch[1].replace(/\s/g, ''), 10) || undefined;
  }

  let monnaie: number | undefined;
  const monnaieMatch = decoded.match(/MONNAIE:?\s*([\d\s]+)\s*FCFA/i);
  if (monnaieMatch) {
    monnaie = parseInt(monnaieMatch[1].replace(/\s/g, ''), 10) || undefined;
  }

  let tableNom = 'Table';
  const tableMatch = decoded.match(/Table:?\s*(\S+)/i);
  if (tableMatch) tableNom = tableMatch[1];

  let ticketNumber = '';
  const ticketMatch = decoded.match(/Ticket:?\s*(\S+)/i);
  if (ticketMatch) ticketNumber = ticketMatch[1];

  await sendTicket(printerId, {
    restaurantName: resto.name,
    address: resto.address,
    phone: resto.phone,
    type: job.type,
    tableNom,
    ticketNumber,
    items,
    total,
    montantRecu,
    monnaie,
    isOrderTicket: job.type === 'INITIAL' || job.type === 'ADDONS',
  });
}
