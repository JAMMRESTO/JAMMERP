import { supabase } from './supabase';
import { buildEscPosTicket, buildEscPosTestTicket, PaperWidth, EscPosItem } from './escpos';

export type { PaperWidth } from './escpos';

const STORAGE_KEY = 'usb_printer_associations';
const USB_ACTIVATION_KEY = 'usb_print_activation_time';

export interface UsbAssociation {
  printerId: string;
  vendorId: number;
  productId: number;
  serialNumber: string | null;
  deviceName: string;
  width: PaperWidth;
}

interface UsbDeviceExt {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  productName?: string;
  configuration: any;
  opened: boolean;
  open(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  releaseInterface(n: number): Promise<void>;
  close(): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ status: string; bytesWritten: number }>;
}

interface NavigatorUsb {
  getDevices(): Promise<UsbDeviceExt[]>;
  requestDevice(options: { filters: any[] }): Promise<UsbDeviceExt>;
}

function getNavigatorUsb(): NavigatorUsb | null {
  if (typeof navigator !== 'undefined' && (navigator as any).usb) {
    return (navigator as any).usb;
  }
  return null;
}

function isWebUsbAvailable(): boolean {
  return getNavigatorUsb() !== null;
}

function loadAssociations(): Map<string, UsbAssociation> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as UsbAssociation[];
    return new Map(arr.map(a => [a.printerId, a]));
  } catch {
    return new Map();
  }
}

function saveAssociations(map: Map<string, UsbAssociation>): void {
  const arr = Array.from(map.values());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function getAssociations(): UsbAssociation[] {
  return Array.from(loadAssociations().values());
}

export function getAssociation(printerId: string): UsbAssociation | null {
  return loadAssociations().get(printerId) || null;
}

export function setAssociation(assoc: UsbAssociation): void {
  const map = loadAssociations();
  map.set(assoc.printerId, assoc);
  saveAssociations(map);
}

export function removeAssociation(printerId: string): void {
  const map = loadAssociations();
  map.delete(printerId);
  saveAssociations(map);
}

export function getUsbActivationTime(): string | null {
  return localStorage.getItem(USB_ACTIVATION_KEY);
}

export function ensureUsbActivationTime(): string {
  let ts = getUsbActivationTime();
  if (!ts) {
    ts = new Date().toISOString();
    localStorage.setItem(USB_ACTIVATION_KEY, ts);
  }
  return ts;
}

export function isWebUsbSupported(): boolean {
  return isWebUsbAvailable();
}

function deviceKey(d: UsbDeviceExt): string {
  return `${d.vendorId}:${d.productId}:${d.serialNumber || ''}`;
}

async function findAuthorizedDevice(assoc: UsbAssociation): Promise<UsbDeviceExt | null> {
  const usb = getNavigatorUsb();
  if (!usb) return null;
  const devices = await usb.getDevices();
  const matching = devices.filter((d: UsbDeviceExt) =>
    d.vendorId === assoc.vendorId && d.productId === assoc.productId
  );
  if (matching.length === 0) return null;
  if (matching.length > 1 && !assoc.serialNumber) {
    throw new Error(
      `Plusieurs imprimantes identiques (VID:${assoc.vendorId} PID:${assoc.productId}) sans numéro de série. ` +
      `Impossible d'identifier laquelle utiliser. Reconnectez l'imprimante pour forcer l'association.`
    );
  }
  if (assoc.serialNumber) {
    const withSerial = matching.find((d: UsbDeviceExt) => d.serialNumber === assoc.serialNumber);
    if (withSerial) return withSerial as UsbDeviceExt;
  }
  if (matching.length === 1) return matching[0] as UsbDeviceExt;
  throw new Error('Ambiguïté: plusieurs imprimantes identiques détectées sans numéro de série.');
}

export async function connectPrinter(printerId: string, width: PaperWidth): Promise<UsbAssociation> {
  const usb = getNavigatorUsb();
  if (!usb) {
    throw new Error('WebUSB n\'est pas disponible dans ce navigateur. Utilisez Chrome ou Edge sur HTTPS ou localhost.');
  }
  ensureUsbActivationTime();
  const device = await usb.requestDevice({ filters: [] });
  const assoc: UsbAssociation = {
    printerId,
    vendorId: device.vendorId,
    productId: device.productId,
    serialNumber: device.serialNumber || null,
    deviceName: device.productName || `USB VID:${device.vendorId} PID:${device.productId}`,
    width,
  };
  setAssociation(assoc);
  return assoc;
}

export async function changePrinterAssociation(printerId: string, width: PaperWidth): Promise<UsbAssociation> {
  return connectPrinter(printerId, width);
}

export async function isDeviceAvailable(printerId: string): Promise<boolean> {
  const assoc = getAssociation(printerId);
  if (!assoc) return false;
  try {
    const dev = await findAuthorizedDevice(assoc);
    return dev !== null;
  } catch {
    return false;
  }
}

export async function getDeviceName(printerId: string): Promise<string | null> {
  const assoc = getAssociation(printerId);
  if (!assoc) return null;
  try {
    const dev = await findAuthorizedDevice(assoc);
    return dev?.productName || assoc.deviceName;
  } catch {
    return assoc.deviceName;
  }
}

const deviceLocks = new Map<string, Promise<void>>();

function getDeviceLock(key: string): Promise<void> {
  if (!deviceLocks.has(key)) {
    deviceLocks.set(key, Promise.resolve());
  }
  return deviceLocks.get(key)!;
}

function setDeviceLock(key: string, p: Promise<void>): void {
  deviceLocks.set(key, p);
}

async function openAndSend(device: UsbDeviceExt, data: Uint8Array): Promise<void> {
  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }
  await device.claimInterface(0);

  const endpoint = device.configuration.interfaces[0]?.alternates[0]?.endpoints
    .find((ep: any) => ep.direction === 'out');
  if (!endpoint) {
    throw new Error('Aucun endpoint OUT trouvé sur ce périphérique USB.');
  }

  let offset = 0;
  const chunkSize = 1024;
  while (offset < data.length) {
    const slice = data.subarray(offset, Math.min(offset + chunkSize, data.length));
    const chunk = slice.length === slice.buffer.byteLength
      ? slice
      : new Uint8Array(slice);
    const transferred = await device.transferOut(endpoint.endpointNumber, chunk);
    if (transferred.status !== 'ok') {
      throw new Error(`Transfert USB échoué: ${transferred.status}`);
    }
    const written = transferred.bytesWritten;
    offset += written;
  }

  try { await device.releaseInterface(0); } catch { /* ignore */ }
  try { await device.close(); } catch { /* ignore */ }
}

export async function sendRawBytes(printerId: string, data: Uint8Array): Promise<void> {
  const assoc = getAssociation(printerId);
  if (!assoc) {
    throw new Error(`Aucune association USB trouvée pour l'imprimante ${printerId}. Cliquez sur Connecter d'abord.`);
  }
  const device = await findAuthorizedDevice(assoc);
  if (!device) {
    throw new Error('Imprimante USB non trouvée. Vérifiez qu\'elle est branchée et autorisée dans ce navigateur.');
  }

  const lockKey = deviceKey(device);
  const prev = getDeviceLock(lockKey);
  let resolveLock: () => void;
  const next = new Promise<void>((resolve) => { resolveLock = resolve; });
  setDeviceLock(lockKey, prev.then(() => next));

  await prev;
  try {
    await openAndSend(device, data);
  } finally {
    resolveLock!();
  }
}

export async function sendTestTicket(printerId: string, printerName: string, width: PaperWidth): Promise<void> {
  const data = buildEscPosTestTicket(printerName, width);
  await sendRawBytes(printerId, data);
}

export async function sendTicket(
  printerId: string,
  params: {
    restaurantName: string;
    address?: string | null;
    phone?: string | null;
    type: string;
    tableNom: string;
    ticketNumber: string;
    items: EscPosItem[];
    total?: number;
    montantRecu?: number;
    monnaie?: number;
    paymentMethodLabel?: string;
    isOrderTicket?: boolean;
  }
): Promise<void> {
  const assoc = getAssociation(printerId);
  const width = assoc?.width || 80;
  const data = buildEscPosTicket({ ...params, width });
  await sendRawBytes(printerId, data);
}

export async function claimPrintJob(jobId: string): Promise<{ id: string; printer_id: string; type: string; payload_text: string; order_id: string | null; table_id: string | null } | null> {
  const { data, error } = await supabase
    .from('print_jobs')
    .update({ status: 'PRINTING' })
    .eq('id', jobId)
    .eq('status', 'PENDING')
    .select('id, printer_id, type, payload_text, order_id, table_id')
    .maybeSingle();

  if (error || !data) return null;
  return data as any;
}

export async function markJobSuccess(jobId: string): Promise<boolean> {
  const { error } = await supabase
    .from('print_jobs')
    .update({ status: 'SUCCESS', printed_at: new Date().toISOString(), last_error: null })
    .eq('id', jobId)
    .eq('status', 'PRINTING');
  return !error;
}

export async function markJobFailed(jobId: string, errorMsg: string): Promise<void> {
  await supabase
    .from('print_jobs')
    .update({ status: 'FAILED', last_error: errorMsg })
    .eq('id', jobId)
    .eq('status', 'PRINTING');
}

export async function retryJobToPending(jobId: string): Promise<void> {
  await supabase
    .from('print_jobs')
    .update({ status: 'PENDING', last_error: null })
    .eq('id', jobId);
}
