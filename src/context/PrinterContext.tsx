import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  isWebUSBSupported,
  isPrinterConnected,
  requestPrinter,
  reconnectPrinter,
  disconnectPrinter,
  type ConnectResult,
} from '../lib/escpos';

interface PrinterContextType {
  supported: boolean;
  connected: boolean;
  lastError: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [supported] = useState(isWebUSBSupported());
  const [connected, setConnected] = useState(isPrinterConnected());
  const [lastError, setLastError] = useState<string | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tryReconnect = useCallback(async () => {
    const ok = await reconnectPrinter();
    if (ok) {
      setConnected(true);
      setLastError(null);
      return true;
    }
    return false;
  }, []);

  // Try to reconnect to a previously-paired printer on mount
  useEffect(() => {
    if (!supported) return;
    tryReconnect();
  }, [supported, tryReconnect]);

  // If not connected, retry every 30s so the printer is picked up after
  // a Windows reboot or a USB replug without manual intervention.
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
    setLastError(res.ok ? null : res.error ?? null);
    return res.ok;
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectPrinter();
    setConnected(false);
    setLastError(null);
  }, []);

  return (
    <PrinterContext.Provider value={{ supported, connected, lastError, connect, disconnect }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter must be used within PrinterProvider');
  return ctx;
}
