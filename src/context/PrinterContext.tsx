import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  isWebUSBSupported,
  isPrinterConnected,
  isPrinterConnectedRole,
  requestPrinter,
  requestPrinterForRole,
  reconnectPrinter,
  reconnectPrinterForRole,
  disconnectPrinter,
  disconnectPrinterForRole,
  getDeviceId,
  type ConnectResult,
  type PrinterRole,
  type PrinterDeviceId,
} from '../lib/escpos';

interface PrinterContextType {
  supported: boolean;
  connected: boolean;
  lastError: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  // Dual printer support
  cashConnected: boolean;
  kitchenConnected: boolean;
  cashError: string | null;
  kitchenError: string | null;
  connectRole: (role: PrinterRole) => Promise<boolean>;
  disconnectRole: (role: PrinterRole) => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

function storageKey(role: PrinterRole, siteId: string): string {
  return `printer_${role}_${siteId}`;
}

function loadDeviceId(role: PrinterRole, siteId: string): PrinterDeviceId | null {
  try {
    const raw = localStorage.getItem(storageKey(role, siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.vendorId === 'number' && typeof parsed.productId === 'number') return parsed;
  } catch { /* ignore */ }
  return null;
}

function saveDeviceId(role: PrinterRole, siteId: string, id: PrinterDeviceId) {
  try {
    localStorage.setItem(storageKey(role, siteId), JSON.stringify(id));
  } catch { /* ignore */ }
}

function clearDeviceId(role: PrinterRole, siteId: string) {
  try {
    localStorage.removeItem(storageKey(role, siteId));
  } catch { /* ignore */ }
}

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [supported] = useState(isWebUSBSupported());
  const [connected, setConnected] = useState(isPrinterConnected());
  const [lastError, setLastError] = useState<string | null>(null);
  const [cashConnected, setCashConnected] = useState(isPrinterConnectedRole('cash'));
  const [kitchenConnected, setKitchenConnected] = useState(isPrinterConnectedRole('kitchen'));
  const [cashError, setCashError] = useState<string | null>(null);
  const [kitchenError, setKitchenError] = useState<string | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tryReconnect = useCallback(async () => {
    const ok = await reconnectPrinter();
    if (ok) {
      setConnected(true);
      setCashConnected(true);
      setLastError(null);
      setCashError(null);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!supported) return;
    tryReconnect();
  }, [supported, tryReconnect]);

  useEffect(() => {
    if (!supported) return;
    if (connected) {
      if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
      return;
    }
    retryRef.current = setInterval(() => { tryReconnect(); }, 30000);
    return () => { if (retryRef.current) clearInterval(retryRef.current); };
  }, [supported, connected, tryReconnect]);

  const connect = useCallback(async () => {
    const res: ConnectResult = await requestPrinter();
    setConnected(res.ok);
    setCashConnected(res.ok);
    setLastError(res.ok ? null : res.error ?? null);
    setCashError(res.ok ? null : res.error ?? null);
    return res.ok;
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectPrinter();
    setConnected(false);
    setCashConnected(false);
    setLastError(null);
    setCashError(null);
  }, []);

  const connectRole = useCallback(async (role: PrinterRole) => {
    const res: ConnectResult = await requestPrinterForRole(role);
    if (res.ok) {
      if (role === 'cash') {
        setCashConnected(true);
        setCashError(null);
        setConnected(true);
      } else {
        setKitchenConnected(true);
        setKitchenError(null);
      }
    } else {
      if (role === 'cash') {
        setCashConnected(false);
        setCashError(res.error ?? null);
        setConnected(false);
      } else {
        setKitchenConnected(false);
        setKitchenError(res.error ?? null);
      }
    }
    return res.ok;
  }, []);

  const disconnectRole = useCallback(async (role: PrinterRole) => {
    await disconnectPrinterForRole(role);
    if (role === 'cash') {
      setCashConnected(false);
      setCashError(null);
      setConnected(false);
    } else {
      setKitchenConnected(false);
      setKitchenError(null);
    }
  }, []);

  return (
    <PrinterContext.Provider value={{
      supported, connected, lastError, connect, disconnect,
      cashConnected, kitchenConnected, cashError, kitchenError,
      connectRole, disconnectRole,
    }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter must be used within PrinterProvider');
  return ctx;
}
