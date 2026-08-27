import { createVerify } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_YOUR_PUBLIC_KEY
-----END PUBLIC KEY-----`;

interface LicensePayload {
  machineId: string;
  client: string;
  expiry: string;
  issuedAt: string;
  licenseId: string;
}

interface LicenseStatus {
  valid: boolean;
  payload?: LicensePayload;
  error?: string;
  machineId: string;
  daysRemaining?: number;
}

function getMachineId(): string {
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic csproduct get uuid', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const uuid = lines[1]?.trim();
      if (uuid && uuid !== '') {
        return createHash('sha256').update(uuid).digest('hex').substring(0, 16).toUpperCase();
      }
    } else if (process.platform === 'linux') {
      const machineId = readFileSync('/etc/machine-id', 'utf8').trim();
      return createHash('sha256').update(machineId).digest('hex').substring(0, 16).toUpperCase();
    } else if (process.platform === 'darwin') {
      const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8' });
      const match = output.match(/"([A-F0-9-]+)"/);
      if (match) {
        return createHash('sha256').update(match[1]).digest('hex').substring(0, 16).toUpperCase();
      }
    }
  } catch {
    // Fallback
  }
  const hostname = require('os').hostname();
  const cpus = require('os').cpus();
  const fingerprint = `${hostname}-${cpus[0]?.model}-${cpus.length}`;
  return createHash('sha256').update(fingerprint).digest('hex').substring(0, 16).toUpperCase();
}

function getLicensePath(): string {
  return join(app.getPath('userData'), 'license.dat');
}

function loadStoredLicense(): string | null {
  const path = getLicensePath();
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').trim();
}

function storeLicense(licenseKey: string): void {
  writeFileSync(getLicensePath(), licenseKey);
}

function verifyLicenseKey(licenseKey: string, machineId: string): LicenseStatus {
  try {
    const parts = licenseKey.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Format de licence invalide', machineId };
    }

    const [payloadBase64, signature] = parts;
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');

    const verify = createVerify('SHA256');
    verify.update(payloadStr);
    verify.end();

    const isValid = verify.verify(PUBLIC_KEY, signature, 'base64');
    if (!isValid) {
      return { valid: false, error: 'Signature invalide', machineId };
    }

    const payload: LicensePayload = JSON.parse(payloadStr);

    if (payload.machineId !== machineId) {
      return { valid: false, error: 'Licence non valide pour ce poste', machineId };
    }

    if (payload.expiry !== 'perpetual') {
      const expiryDate = new Date(payload.expiry);
      const now = new Date();
      if (now > expiryDate) {
        return { valid: false, error: 'Licence expiree', machineId, payload };
      }
      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { valid: true, payload, machineId, daysRemaining };
    }

    return { valid: true, payload, machineId };
  } catch (err) {
    return { valid: false, error: 'Erreur de verification', machineId };
  }
}

export function checkLicense(): LicenseStatus {
  const machineId = getMachineId();
  const storedLicense = loadStoredLicense();

  if (!storedLicense) {
    return { valid: false, error: 'Aucune licence enregistree', machineId };
  }

  return verifyLicenseKey(storedLicense, machineId);
}

export function activateLicense(licenseKey: string): LicenseStatus {
  const machineId = getMachineId();
  const result = verifyLicenseKey(licenseKey, machineId);

  if (result.valid) {
    storeLicense(licenseKey);
  }

  return result;
}

export function getCurrentMachineId(): string {
  return getMachineId();
}
