import { useState, useEffect } from 'react';

const api = () => window.electronAPI;

export interface LicenseStatus {
  valid: boolean;
  payload?: {
    machineId: string;
    client: string;
    expiry: string;
    issuedAt: string;
    licenseId: string;
  };
  error?: string;
  machineId: string;
  daysRemaining?: number;
}

export function useLicense() {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api().license.check().then((s: LicenseStatus) => {
      setStatus(s);
      setLoading(false);
    });
  }, []);

  const activate = async (key: string): Promise<LicenseStatus> => {
    const result = await api().license.activate(key);
    setStatus(result);
    return result;
  };

  const getMachineId = async (): Promise<string> => {
    return api().license.getMachineId();
  };

  return { status, loading, activate, getMachineId };
}
