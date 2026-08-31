import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  isWebUSBSupported,
  isPrinterConnected,
  requestPrinter,
  reconnectPrinter,
  disconnectPrinter,
} from '../lib/escpos';

interface PrinterContextType {
  supported: boolean;
  connected: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [supported] = useState(isWebUSBSupported());
  const [connected, setConnected] = useState(isPrinterConnected());

  // Try to reconnect to a previously-paired printer on mount
  useEffect(() => {
    if (!supported) return;
    reconnectPrinter().then(ok => {
      if (ok) setConnected(true);
    });
  }, [supported]);

  const connect = useCallback(async () => {
    const ok = await requestPrinter();
    setConnected(ok);
    return ok;
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectPrinter();
    setConnected(false);
  }, []);

  return (
    <PrinterContext.Provider value={{ supported, connected, connect, disconnect }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter must be used within PrinterProvider');
  return ctx;
}
