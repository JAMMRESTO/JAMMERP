type QzPrintData = { type: string; format: string; flavor: string; data: string };

type QzTrayApi = {
  websocket: {
    isActive: () => boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    subscribe: (event: string, callback: () => void) => void;
  };
  security?: {
    setCertificatePromise: (callback: (resolve: (certificate: string | null) => void, reject: (error: Error) => void) => void) => void;
    setSignaturePromise: (callback: (toSign: string) => (resolve: (signature: string) => void, reject: (error: Error) => void) => void) => void;
  };
  configs: { create: (printer: string) => unknown };
  printers?: { find: () => Promise<string[]> };
  print: (config: unknown, data: QzPrintData[]) => Promise<void>;
};

type QzWindow = Window & { qz?: QzTrayApi };

const listeners = new Set<(connected: boolean, reason?: string) => void>();
let connecting: Promise<boolean> | null = null;
let configuredQz: QzTrayApi | null = null;
let subscribedEvents = false;
let retryCount = 0;
let lastError: string | null = null;

function getQz(): QzTrayApi | undefined {
  return (window as QzWindow).qz;
}

function publish(connected: boolean, reason?: string): void {
  listeners.forEach(listener => listener(connected, reason));
}

function waitForQz(timeoutMs = 15000): Promise<QzTrayApi | undefined> {
  const qz = getQz();
  if (qz) return Promise.resolve(qz);
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = window.setInterval(() => {
      const found = getQz();
      if (found) {
        window.clearInterval(interval);
        resolve(found);
      } else if (Date.now() - start > timeoutMs) {
        window.clearInterval(interval);
        resolve(undefined);
      }
    }, 200);
  });
}

function configureSecurity(qz: QzTrayApi): void {
  if (configuredQz === qz || !qz.security) return;
  // Resolve with null to skip certificate validation in development.
  // An empty string is invalid and causes the WebSocket handshake to fail silently.
  qz.security.setCertificatePromise((resolve) => resolve(null));
  qz.security.setSignaturePromise(() => (resolve) => resolve(''));
  configuredQz = qz;
}

function subscribeQzEvents(qz: QzTrayApi): void {
  if (subscribedEvents) return;
  subscribedEvents = true;
  qz.websocket.subscribe('QZ_TRAY_CONNECTED', () => {
    retryCount = 0;
    lastError = null;
    publish(true);
  });
  qz.websocket.subscribe('QZ_TRAY_DISCONNECTED', () => {
    lastError = 'QZ Tray déconnecté';
    publish(false, lastError);
    window.setTimeout(() => void connectQzTray(), 2000);
  });
}

export function isQzTrayConnected(): boolean {
  return Boolean(getQz()?.websocket.isActive());
}

export function getQzTrayError(): string | null {
  return lastError;
}

export async function connectQzTray(): Promise<boolean> {
  if (isQzTrayConnected()) return true;
  if (connecting) return connecting;

  connecting = (async () => {
    const qz = await waitForQz();
    if (!qz) {
      lastError = 'QZ Tray non détecté — lancez l\'application QZ Tray sur cet ordinateur';
      console.warn('[QZ Tray]', lastError);
      publish(false, lastError);
      return false;
    }
    configureSecurity(qz);
    subscribeQzEvents(qz);
    try {
      await qz.websocket.connect();
      retryCount = 0;
      lastError = null;
      publish(true);
      return true;
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Erreur inconnue';
      const isCertError = /certificate|cert|ssl|tls|handshake|secure/i.test(msg);
      lastError = isCertError
        ? 'Certificat QZ Tray refusé — ouvrez https://localhost:8181 dans un onglet et acceptez le certificat, puis réessayez'
        : `Connexion QZ Tray échouée: ${msg}`;
      console.warn('[QZ Tray]', lastError, err);
      publish(false, lastError);
      retryCount += 1;
      if (retryCount < 5) {
        window.setTimeout(() => void connectQzTray(), 3000 * retryCount);
      }
      return false;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export function subscribeQzTrayStatus(listener: (connected: boolean, reason?: string) => void): () => void {
  listeners.add(listener);
  listener(isQzTrayConnected(), lastError || undefined);
  void connectQzTray();
  return () => listeners.delete(listener);
}

export async function listQzPrinters(): Promise<string[]> {
  if (!(await connectQzTray())) return [];
  const printers = getQz()?.printers;
  return printers ? printers.find() : [];
}

export async function printWithQzTray(printerName: string, html: string): Promise<boolean> {
  if (!printerName || !(await connectQzTray())) return false;
  const qz = getQz();
  if (!qz) return false;
  try {
    const config = qz.configs.create(printerName);
    await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
    return true;
  } catch (err: any) {
    lastError = `Impression QZ échouée: ${err?.message || String(err)}`;
    console.warn('[QZ Tray]', lastError, err);
    publish(false, lastError);
    return false;
  }
}
