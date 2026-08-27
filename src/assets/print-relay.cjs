#!/usr/bin/env node
/**
 * THE WEST AFRICAN — Relais d'impression local
 *
 * Ce script tourne sur l'ordinateur du restaurant (connecté au même Wi-Fi
 * que les imprimantes réseau). Il récupère les bons de commande en attente
 * depuis la base de données et les envoie directement aux imprimantes via TCP.
 *
 * UTILISATION
 *   node print-relay.cjs
 *
 * PRÉREQUIS
 *   Node.js 18 ou plus récent (https://nodejs.org)
 */

'use strict';

const https = require('https');
const net   = require('net');

// ─── Configuration ────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://ueadhfreuuxszncpskco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlYWRoZnJldXV4c3puY3Bza2NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3Mzc2MDcsImV4cCI6MjA4OTMxMzYwN30.ScOClkeZw_l7L0WCp6exoxNZ61HAqUEjmoPVDU9eiVc';
const POLL_INTERVAL_MS  = 3000;
const PRINT_TIMEOUT_MS  = 5000;
const HEARTBEAT_MS      = 10000;
const MAX_RETRIES       = 3;
const STUCK_PRINTING_MS = 5 * 60 * 1000; // 5 min — récupère les jobs bloqués en PRINTING
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_HEADERS = {
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
};

// ── Utilitaires HTTP ──────────────────────────────────────────────────────────

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url    = new URL(SUPABASE_URL + path);
    const data   = body ? JSON.stringify(body) : null;
    const opts   = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers: {
        ...AUTH_HEADERS,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Décode le payload Base64 → Buffer d'octets ESC/POS ────────────────────────

function decodePayload(encoded) {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    if (decoded.includes('\x1B') || !/<[a-z][\s\S]*>/i.test(decoded)) {
      return Buffer.from(decoded, 'utf8');
    }
    return Buffer.from(buildEscPos(decoded), 'binary');
  } catch {
    return Buffer.from(encoded, 'base64');
  }
}

function buildEscPos(html) {
  const ESC = '\x1B';
  const GS  = '\x1D';
  const LF  = '\x0A';
  const INIT      = ESC + '\x40';
  const BOLD_ON   = ESC + '\x45\x01';
  const BOLD_OFF  = ESC + '\x45\x00';
  const DOUBLE_ON = ESC + '\x21\x30';
  const DOUBLE_OFF= ESC + '\x21\x00';
  const CENTER    = ESC + '\x61\x01';
  const LEFT      = ESC + '\x61\x00';
  const CUT       = GS  + '\x56\x42\x00';
  const COLS      = 48;

  const isOrderTicket = html.includes('order-ticket') || html.includes('BON CUISINE') || html.includes('BON BAR') || html.includes('BON PREPARATION') || html.includes('AJOUTS');
  const hasPrices     = html.includes('total-block') || html.includes('TOTAL') || html.includes('FCFA');

  function stripTags(s) {
    return s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  }

  const badgeMatch  = html.match(/class="[^"]*badge[^"]*"[^>]*>([^<]+)</);
  const tableMatch  = html.match(/order-ticket-table[^>]*>([^<]+)</);
  const itemMatches = [...html.matchAll(/class="item-name"[^>]*>([\s\S]*?)<\/div>/g)];
  const priceMatches= [...html.matchAll(/class="item-price"[^>]*>([^<]+)<\/div>/g)];
  const totalMatch  = html.match(/class="total-amount"[^>]*>([^<]+)<\/span>/);
  const infoMatch   = html.match(/class="info-line"[^>]*>([^<]+)<\/div>/);
  const footerMatch = html.match(/class="footer-msg"[^>]*>([^<]+)<\/div>/);

  let out = INIT + ESC + '\x74\x13';

  if (isOrderTicket) {
    const badge = badgeMatch ? stripTags(badgeMatch[1]).trim() : 'BON CUISINE';
    const table = tableMatch ? stripTags(tableMatch[1]).trim() : '';
    out += CENTER + DOUBLE_ON + BOLD_ON + badge + LF + BOLD_OFF + DOUBLE_OFF;
    if (table) out += CENTER + DOUBLE_ON + table + LF + DOUBLE_OFF;
    out += LEFT + '='.repeat(COLS) + LF;
    for (let i = 0; i < itemMatches.length; i++) {
      const raw = stripTags(itemMatches[i][1]).trim();
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        const firstLine = lines[0];
        const maxLen = 24;
        const short  = firstLine.length > maxLen ? firstLine.slice(0, maxLen - 1) + '.' : firstLine;
        out += DOUBLE_ON + BOLD_ON + short + LF + BOLD_OFF + DOUBLE_OFF;
        for (let j = 1; j < lines.length; j++) {
          out += '  > ' + lines[j] + LF;
        }
      }
    }
  } else {
    const badge = badgeMatch ? stripTags(badgeMatch[1]).trim() : 'IMPRESSION';
    const info  = infoMatch  ? stripTags(infoMatch[1]).trim()  : '';
    out += CENTER + DOUBLE_ON + BOLD_ON + badge + LF + BOLD_OFF + DOUBLE_OFF;
    if (info) out += CENTER + info + LF;
    out += LEFT + '='.repeat(COLS) + LF;

    for (let i = 0; i < itemMatches.length; i++) {
      const name  = stripTags(itemMatches[i][1]).trim().split('\n')[0].trim();
      const price = priceMatches[i] ? stripTags(priceMatches[i][1]).trim() : '';
      if (name) {
        if (price) {
          const maxName = COLS - price.length - 1;
          const short   = name.length > maxName ? name.slice(0, maxName - 1) + '.' : name;
          const pad     = Math.max(1, COLS - short.length - price.length);
          out += BOLD_ON + short + ' '.repeat(pad) + price + LF + BOLD_OFF;
        } else {
          out += BOLD_ON + name + LF + BOLD_OFF;
        }
      }
    }

    if (hasPrices) {
      out += '='.repeat(COLS) + LF;
    }
    if (totalMatch) {
      const total = stripTags(totalMatch[1]).trim();
      out += CENTER + DOUBLE_ON + BOLD_ON + 'TOTAL ' + total + LF + BOLD_OFF + DOUBLE_OFF + LEFT;
    }
    if (footerMatch) {
      out += CENTER + stripTags(footerMatch[1]).trim() + LF + LEFT;
    }
  }

  out += LF + LF + LF + LF + CUT;
  return out;
}

// ── Test de connexion TCP à une imprimante ────────────────────────────────────

function testPrinterConnection(ip, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port: Number(port) }, () => {
      socket.destroy();
      resolve({ ok: true, msg: 'OK' });
    });
    socket.setTimeout(3000);
    socket.on('timeout', () => { socket.destroy(); resolve({ ok: false, msg: 'Timeout (imprimante injoignable)' }); });
    socket.on('error', (err) => { resolve({ ok: false, msg: err.message }); });
  });
}

// ── Envoi TCP à l'imprimante ──────────────────────────────────────────────────

function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port: Number(port) }, () => {
      socket.write(data, err => {
        if (err) { socket.destroy(); reject(err); return; }
        setTimeout(() => { socket.destroy(); resolve(); }, 200);
      });
    });
    socket.setTimeout(PRINT_TIMEOUT_MS);
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Timeout connexion imprimante')); });
    socket.on('error', reject);
  });
}

// ── Appels Supabase ───────────────────────────────────────────────────────────

async function resetStuckJobs() {
  const cutoff = new Date(Date.now() - STUCK_PRINTING_MS).toISOString();
  await httpRequest(
    'PATCH',
    `/rest/v1/print_jobs?status=eq.PRINTING&created_at=lt.${encodeURIComponent(cutoff)}`,
    { status: 'PENDING', last_error: 'Réinitialisé automatiquement par le relais' }
  );
}

async function fetchPendingJobs() {
  const res = await httpRequest(
    'GET',
    '/rest/v1/print_jobs?status=eq.PENDING&select=id,type,printer_id,payload_text,content_summary,retries&order=created_at.asc&limit=10',
    null
  );
  return Array.isArray(res.body) ? res.body : [];
}

async function claimJob(jobId) {
  const res = await httpRequest('POST', '/rest/v1/rpc/claim_print_job', { p_job_id: jobId });
  const rows = Array.isArray(res.body) ? res.body : (res.body ? [res.body] : []);
  return rows.length > 0 ? rows[0] : null;
}

async function fetchPrinter(printerId) {
  const res = await httpRequest(
    'GET',
    `/rest/v1/printers?id=eq.${printerId}&select=id,nom,ip_address,port,connection_type,type&limit=1`,
    null
  );
  return Array.isArray(res.body) && res.body.length > 0 ? res.body[0] : null;
}

async function markSuccess(jobId) {
  await httpRequest('PATCH', `/rest/v1/print_jobs?id=eq.${jobId}`, {
    status: 'SUCCESS',
    printed_at: new Date().toISOString(),
    last_error: null,
  });
}

async function markFailed(jobId, errorMsg, retries) {
  const canRetry = Number(retries || 0) < MAX_RETRIES;
  await httpRequest('PATCH', `/rest/v1/print_jobs?id=eq.${jobId}`, {
    status: canRetry ? 'PENDING' : 'FAILED',
    retries: Number(retries || 0),
    last_error: `${canRetry ? `Nouvel essai automatique (${Number(retries || 0) + 1}/${MAX_RETRIES})` : 'Échec définitif'} : ${errorMsg}`.slice(0, 500),
  });
  if (canRetry) {
    console.log(`[Relais] Nouvelle tentative planifiée (${Number(retries || 0) + 1}/${MAX_RETRIES})`);
  }
}

async function updateHeartbeat(printerId) {
  await httpRequest('PATCH', `/rest/v1/printers?id=eq.${printerId}`, {
    relay_last_seen: new Date().toISOString(),
  });
}

// ── Diagnostic au démarrage ────────────────────────────────────────────────────

async function runStartupDiagnostics() {
  console.log('');
  console.log('┌──────────────────────────────────────────────────┐');
  console.log('│   THE WEST AFRICAN — Relais d\'impression         │');
  console.log('└──────────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Node.js ${process.version}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log('');

  // 1. Test connexion Supabase
  console.log('  [1/2] Test connexion Supabase...');
  let supabaseOk = false;
  try {
    const res = await httpRequest('GET', '/rest/v1/printers?select=id&limit=1', null);
    if (res.status === 200) {
      console.log('       ✓ Supabase accessible');
      supabaseOk = true;
    } else {
      console.log(`       ✗ Supabase a répondu (code ${res.status}) — vérifiez les identifiants`);
    }
  } catch (e) {
    console.log(`       ✗ Impossible de joindre Supabase: ${e.message}`);
    console.log('         Vérifiez votre connexion Internet.');
  }
  console.log('');

  // 2. Test connexion imprimantes réseau
  console.log('  [2/2] Test imprimantes réseau...');
  let printers = [];
  if (supabaseOk) {
    try {
      const res = await httpRequest(
        'GET',
        `/rest/v1/printers?connection_type=eq.NETWORK&active=eq.true&select=id,nom,ip_address,port&limit=20`,
        null
      );
      printers = Array.isArray(res.body) ? res.body : [];
    } catch { /* géré ci-dessous */ }
  }

  if (printers.length === 0) {
    console.log('       Aucune imprimante réseau configurée.');
  } else {
    for (const p of printers) {
      const result = await testPrinterConnection(p.ip_address, p.port);
      const icon = result.ok ? '✓' : '✗';
      console.log(`       ${icon} ${p.nom} (${p.ip_address}:${p.port}) — ${result.msg}`);
    }
  }
  console.log('');

  if (!supabaseOk) {
    console.log('  ⚠ Le relais ne peut pas fonctionner sans connexion Supabase.');
    console.log('  Vérifiez votre connexion Internet et relancez ce script.');
    console.log('');
    process.exit(1);
  }

  // Heartbeat immédiat pour signaler "en ligne" tout de suite
  for (const p of printers) {
    await updateHeartbeat(p.id).catch(() => {});
  }

  console.log('  Relais EN LIGNE. En attente de bons de commande...');
  console.log('  (Ctrl+C pour arrêter)');
  console.log('');
}

// ── Boucle principale ─────────────────────────────────────────────────────────

let processedIds = new Set();

async function processPendingJobs() {
  let jobs;
  try {
    await resetStuckJobs();
    jobs = await fetchPendingJobs();
  } catch (e) {
    console.error('[Relais] Erreur réseau Supabase:', e.message);
    return;
  }

  for (const job of jobs) {
    if (processedIds.has(job.id)) continue;

    let claimed;
    try { claimed = await claimJob(job.id); } catch { continue; }
    if (!claimed) continue;

    processedIds.add(job.id);
    setTimeout(() => processedIds.delete(job.id), 60_000);
    const retries = claimed.retries ?? job.retries ?? 0;

    const printer = await fetchPrinter(claimed.printer_id).catch(() => null);
    if (!printer) {
      await markFailed(job.id, 'Imprimante introuvable en base', retries);
      continue;
    }

    if (printer.connection_type !== 'NETWORK') {
      await markFailed(job.id, 'Impression USB ignorée par le relais', retries);
      continue;
    }

    if (!printer.ip_address) {
      await markFailed(job.id, 'Adresse IP manquante', retries);
      continue;
    }

    console.log(`[Relais] Impression "${job.content_summary}" → ${printer.nom} (${printer.ip_address}:${printer.port})`);

    let data;
    try {
      data = decodePayload(claimed.payload_text);
    } catch (e) {
      await markFailed(job.id, 'Erreur décodage payload: ' + e.message, retries);
      continue;
    }

    try {
      await sendToPrinter(printer.ip_address, printer.port, data);
      await markSuccess(job.id);
      console.log('[Relais] ✓ Imprimé avec succès');
      await updateHeartbeat(printer.id).catch(() => {});
    } catch (e) {
      const msg = e.message || 'Erreur inconnue';
      console.error(`[Relais] ✗ Échec: ${msg}`);
      await markFailed(job.id, msg, retries);
    }
  }
}

// ── Heartbeat périodique ──────────────────────────────────────────────────────

async function periodicHeartbeat() {
  try {
    const res = await httpRequest(
      'GET',
      `/rest/v1/printers?connection_type=eq.NETWORK&active=eq.true&select=id&limit=20`,
      null
    );
    const printers = Array.isArray(res.body) ? res.body : [];
    const ts = new Date().toISOString();
    for (const p of printers) {
      await httpRequest('PATCH', `/rest/v1/printers?id=eq.${p.id}`, { relay_last_seen: ts });
    }
  } catch { /* silencieux */ }
}

// ── Démarrage ─────────────────────────────────────────────────────────────────

(async () => {
  try {
    await runStartupDiagnostics();
  } catch (e) {
    console.error('Erreur fatale au démarrage:', e.message);
    process.exit(1);
  }

  setInterval(processPendingJobs, POLL_INTERVAL_MS);
  setInterval(periodicHeartbeat,  HEARTBEAT_MS);

  processPendingJobs();
})();
