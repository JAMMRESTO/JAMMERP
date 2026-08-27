#!/usr/bin/env node
/**
 * Outil admin pour generer des licences Ma Caisse (offline)
 *
 * Usage:
 *   node generate-license.mjs --machine-id "ABC123" --client "Entreprise X" --expiry "2027-12-31"
 *   node generate-license.mjs --machine-id "ABC123" --client "Entreprise X" --perpetual
 */

import { createSign, createVerify, generateKeyPairSync, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(__dirname, 'keys');
const PRIVATE_KEY_PATH = join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = join(KEYS_DIR, 'public.pem');

function ensureKeys() {
  if (!existsSync(KEYS_DIR)) {
    const { mkdirSync } = await import('fs');
    mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (!existsSync(PRIVATE_KEY_PATH) || !existsSync(PUBLIC_KEY_PATH)) {
    console.log('Generating new RSA key pair...');
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    writeFileSync(PRIVATE_KEY_PATH, privateKey);
    writeFileSync(PUBLIC_KEY_PATH, publicKey);
    console.log(`Keys saved to: ${KEYS_DIR}`);
    console.log(`IMPORTANT: Copy public.pem to desktop/electron/public.pem`);
  }
}

function generateLicense(machineId, clientName, expiryDate) {
  const privateKey = readFileSync(PRIVATE_KEY_PATH, 'utf8');

  const payload = {
    machineId,
    client: clientName,
    expiry: expiryDate, // "perpetual" or "YYYY-MM-DD"
    issuedAt: new Date().toISOString(),
    licenseId: randomBytes(8).toString('hex'),
  };

  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadStr).toString('base64');

  const sign = createSign('SHA256');
  sign.update(payloadStr);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');

  const licenseKey = `${payloadBase64}.${signature}`;

  return { payload, licenseKey };
}

function verifyLicense(licenseKey) {
  const publicKey = readFileSync(PUBLIC_KEY_PATH, 'utf8');
  const [payloadBase64, signature] = licenseKey.split('.');

  const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');

  const verify = createVerify('SHA256');
  verify.update(payloadStr);
  verify.end();

  const isValid = verify.verify(publicKey, signature, 'base64');
  return { isValid, payload: isValid ? JSON.parse(payloadStr) : null };
}

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
};

const command = args[0];

if (command === 'init') {
  await ensureKeys();
  console.log('\nKey pair generated successfully.');
  console.log(`Private key (keep secret!): ${PRIVATE_KEY_PATH}`);
  console.log(`Public key (embed in app): ${PUBLIC_KEY_PATH}`);
  process.exit(0);
}

if (command === 'verify') {
  const key = getArg('key') || args[1];
  if (!key) {
    console.error('Usage: node generate-license.mjs verify --key "LICENSE_KEY"');
    process.exit(1);
  }
  const result = verifyLicense(key);
  console.log(result.isValid ? 'VALID' : 'INVALID');
  if (result.payload) console.log(JSON.stringify(result.payload, null, 2));
  process.exit(result.isValid ? 0 : 1);
}

// Default: generate
const machineId = getArg('machine-id');
const client = getArg('client') || 'Client';
const expiry = args.includes('--perpetual') ? 'perpetual' : getArg('expiry');

if (!machineId) {
  console.log(`
Ma Caisse - License Generator
==============================

Commands:
  node generate-license.mjs init
    Generate RSA key pair (first time setup)

  node generate-license.mjs --machine-id "ID" --client "Name" --expiry "YYYY-MM-DD"
    Generate a license key bound to a machine

  node generate-license.mjs --machine-id "ID" --client "Name" --perpetual
    Generate a perpetual (no expiry) license

  node generate-license.mjs verify --key "LICENSE_KEY"
    Verify a license key

Options:
  --machine-id   Machine ID shown in the app (required)
  --client       Client/company name
  --expiry       Expiry date (YYYY-MM-DD)
  --perpetual    No expiry date
`);
  process.exit(0);
}

if (!expiry) {
  console.error('Error: Specify --expiry "YYYY-MM-DD" or --perpetual');
  process.exit(1);
}

await ensureKeys();
const { payload, licenseKey } = generateLicense(machineId, client, expiry);

console.log('\n=== LICENSE GENERATED ===');
console.log(`Client: ${payload.client}`);
console.log(`Machine ID: ${payload.machineId}`);
console.log(`Expiry: ${payload.expiry}`);
console.log(`License ID: ${payload.licenseId}`);
console.log(`Issued: ${payload.issuedAt}`);
console.log('\n--- LICENSE KEY (give this to the client) ---');
console.log(licenseKey);
console.log('\n--- END ---');

// Also save to a file
const filename = `license_${payload.client.replace(/\s+/g, '_')}_${payload.licenseId}.txt`;
writeFileSync(join(__dirname, filename), licenseKey);
console.log(`\nSaved to: ${join(__dirname, filename)}`);
