"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLicense = checkLicense;
exports.activateLicense = activateLicense;
exports.getCurrentMachineId = getCurrentMachineId;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const crypto_2 = require("crypto");
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_YOUR_PUBLIC_KEY
-----END PUBLIC KEY-----`;
function getMachineId() {
    try {
        if (process.platform === 'win32') {
            const output = (0, child_process_1.execSync)('wmic csproduct get uuid', { encoding: 'utf8' });
            const lines = output.trim().split('\n');
            const uuid = lines[1]?.trim();
            if (uuid && uuid !== '') {
                return (0, crypto_2.createHash)('sha256').update(uuid).digest('hex').substring(0, 16).toUpperCase();
            }
        }
        else if (process.platform === 'linux') {
            const machineId = (0, fs_1.readFileSync)('/etc/machine-id', 'utf8').trim();
            return (0, crypto_2.createHash)('sha256').update(machineId).digest('hex').substring(0, 16).toUpperCase();
        }
        else if (process.platform === 'darwin') {
            const output = (0, child_process_1.execSync)('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID', { encoding: 'utf8' });
            const match = output.match(/"([A-F0-9-]+)"/);
            if (match) {
                return (0, crypto_2.createHash)('sha256').update(match[1]).digest('hex').substring(0, 16).toUpperCase();
            }
        }
    }
    catch {
        // Fallback
    }
    const hostname = require('os').hostname();
    const cpus = require('os').cpus();
    const fingerprint = `${hostname}-${cpus[0]?.model}-${cpus.length}`;
    return (0, crypto_2.createHash)('sha256').update(fingerprint).digest('hex').substring(0, 16).toUpperCase();
}
function getLicensePath() {
    return (0, path_1.join)(electron_1.app.getPath('userData'), 'license.dat');
}
function loadStoredLicense() {
    const path = getLicensePath();
    if (!(0, fs_1.existsSync)(path))
        return null;
    return (0, fs_1.readFileSync)(path, 'utf8').trim();
}
function storeLicense(licenseKey) {
    (0, fs_1.writeFileSync)(getLicensePath(), licenseKey);
}
function verifyLicenseKey(licenseKey, machineId) {
    try {
        const parts = licenseKey.split('.');
        if (parts.length !== 2) {
            return { valid: false, error: 'Format de licence invalide', machineId };
        }
        const [payloadBase64, signature] = parts;
        const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
        const verify = (0, crypto_1.createVerify)('SHA256');
        verify.update(payloadStr);
        verify.end();
        const isValid = verify.verify(PUBLIC_KEY, signature, 'base64');
        if (!isValid) {
            return { valid: false, error: 'Signature invalide', machineId };
        }
        const payload = JSON.parse(payloadStr);
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
    }
    catch (err) {
        return { valid: false, error: 'Erreur de verification', machineId };
    }
}
function checkLicense() {
    const machineId = getMachineId();
    const storedLicense = loadStoredLicense();
    if (!storedLicense) {
        return { valid: false, error: 'Aucune licence enregistree', machineId };
    }
    return verifyLicenseKey(storedLicense, machineId);
}
function activateLicense(licenseKey) {
    const machineId = getMachineId();
    const result = verifyLicenseKey(licenseKey, machineId);
    if (result.valid) {
        storeLicense(licenseKey);
    }
    return result;
}
function getCurrentMachineId() {
    return getMachineId();
}
//# sourceMappingURL=license.js.map