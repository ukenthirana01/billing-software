'use strict';

/**
 * Secure licensing (client-side verification + optional online activation):
 * - Machine binding (multi-source fingerprint) -> SHA256
 * - Offline license.dat verification:
 *   - decrypt with AES-256-GCM (local secret)
 *   - verify server signature over payload fields (embedded public key)
 * - Online activation (optional): call activation server once to obtain encrypted license.dat.
 *
 * NOTE:
 * - Without setting LICENSE_SERVER_PUBLIC_KEY_PEM and LICENSE_ACTIVATION_URL, the new system
 *   will be treated as "unsupported" and the renderer can fall back to legacy checks.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const LICENSE_FILE_NAME = 'license.dat';

// Provide these in production via environment variables during deployment.
// For example:
//   LICENSE_SERVER_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY-----"
//   LICENSE_ACTIVATION_URL="https://your-server.example.com/activate"
const LICENSE_SERVER_PUBLIC_KEY_PEM = process.env.LICENSE_SERVER_PUBLIC_KEY_PEM || '';
const LICENSE_ENC_SECRET = process.env.LICENSE_ENC_SECRET || 'msbilling-default-dev-secret-change-me';
const LICENSE_ACTIVATION_URL = process.env.LICENSE_ACTIVATION_URL || '';

const ENC_KEY = crypto.createHash('sha256').update(String(LICENSE_ENC_SECRET)).digest(); // 32 bytes

function getLicensePath(userDataPath) {
  return path.join(userDataPath, LICENSE_FILE_NAME);
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function safeJsonParse(s) {
  try {
    return JSON.parse(String(s));
  } catch {
    return null;
  }
}

function parseWmicValue(stdout) {
  // wmic usually prints header + values.
  const lines = String(stdout || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return '';
  // Return first value after the header
  return lines.find((_, idx) => idx !== 0) || '';
}

function execCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err) return resolve('');
      resolve(stdout || '');
    });
  });
}

async function getMachineFingerprintV2() {
  // This is best-effort. If some commands fail, we still compute a stable hash from what we can read.
  if (process.platform === 'win32') {
    const cpu = parseWmicValue(await execCmd('wmic cpu get ProcessorId'));
    const mobo = parseWmicValue(await execCmd('wmic baseboard get SerialNumber'));
    const bios = parseWmicValue(await execCmd('wmic csproduct get UUID'));
    const disk = parseWmicValue(await execCmd('wmic diskdrive get SerialNumber'));

    const raw = [
      cpu || bios || 'UNKNOWN_CPU',
      mobo || bios || 'UNKNOWN_MOBO',
      disk || bios || 'UNKNOWN_DISK',
    ].join('|');

    return sha256Hex(raw);
  }

  // Non-Windows fallback (still stable, but may be easier to spoof).
  // Prefer users to run on Windows for strongest binding.
  const raw = `${process.pid}|${process.platform}|${process.cwd()}`;
  return sha256Hex(raw);
}

function getPayloadSigningMessage(payload) {
  // Signature must be computed by server over deterministic fields.
  // Keep field order stable.
  const machineId = String(payload.machine_id || '');
  const expiry = String(payload.expiry || '');
  const plan = String(payload.plan || '');
  const issuedAt = String(payload.issued_at || '');
  return `${machineId}|${expiry}|${plan}|${issuedAt}`;
}

function isSupportedOfflineVerifier() {
  return Boolean(String(LICENSE_SERVER_PUBLIC_KEY_PEM || '').trim());
}

function decryptLicenseDat(userDataPath) {
  const p = getLicensePath(userDataPath);
  if (!fs.existsSync(p)) return null;

  let blob;
  try {
    blob = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }

  const iv = Buffer.from(String(blob.iv || ''), 'base64');
  const ciphertext = Buffer.from(String(blob.ciphertext || ''), 'base64');
  const tag = Buffer.from(String(blob.tag || ''), 'base64');
  if (!iv.length || !ciphertext.length || !tag.length) return null;

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const payload = safeJsonParse(plaintext.toString('utf8'));
  return payload;
}

function verifyServerSignature(payload) {
  const pubKey = String(LICENSE_SERVER_PUBLIC_KEY_PEM || '').trim();
  if (!pubKey) return false;
  if (!payload || !payload.signature) return false;

  const signature = Buffer.from(String(payload.signature), 'base64');
  const message = Buffer.from(getPayloadSigningMessage(payload), 'utf8');
  try {
    return crypto.verify('RSA-SHA256', message, pubKey, signature);
  } catch {
    return false;
  }
}

function normalizeExpiry(payload) {
  // Expect ISO date string: YYYY-MM-DD
  const expiryStr = String(payload.expiry || '');
  if (!expiryStr) return null;
  const d = new Date(expiryStr);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function getLicenseStatus(userDataPath) {
  const machineId = await getMachineFingerprintV2();
  const supported = isSupportedOfflineVerifier();

  const decrypted = decryptLicenseDat(userDataPath);
  if (!decrypted) {
    return { supported, state: 'missing' };
  }

  if (!supported) {
    return { supported, state: 'unsupported' };
  }

  // Tamper-resistant check: signature first (authenticity), then machine binding.
  const sigOk = verifyServerSignature(decrypted);
  if (!sigOk) return { supported, state: 'invalid' };

  if (String(decrypted.machine_id || '') !== machineId) {
    return { supported, state: 'invalid_machine' };
  }

  const expiryDate = normalizeExpiry(decrypted);
  if (!expiryDate) return { supported, state: 'invalid' };

  const now = new Date();
  if (now > expiryDate) {
    return { supported, state: 'expired', expiry: expiryDate.toISOString().slice(0, 10), plan: decrypted.plan || null };
  }

  const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 7) {
    return {
      supported,
      state: 'warning',
      expiry: expiryDate.toISOString().slice(0, 10),
      daysLeft,
      plan: decrypted.plan || null,
    };
  }

  return {
    supported,
    state: 'valid',
    expiry: expiryDate.toISOString().slice(0, 10),
    plan: decrypted.plan || null,
  };
}

function requestJson(urlString, body, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const lib = url.protocol === 'http:' ? http : https;

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || undefined,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const parsed = safeJsonParse(data);
        if (!parsed) return reject(new Error('Invalid activation server response'));
        if (res.statusCode && res.statusCode >= 400) return reject(new Error(parsed?.error || 'Activation failed'));
        resolve(parsed);
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Activation request timed out'));
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

async function activateLicenseOnline(userDataPath, { activationKey, appVersion }) {
  if (!LICENSE_ACTIVATION_URL) {
    const err = new Error('server_not_configured');
    err.code = 'server_not_configured';
    throw err;
  }

  const machineId = await getMachineFingerprintV2();

  const resp = await requestJson(LICENSE_ACTIVATION_URL, {
    license_key: activationKey,
    machine_id: machineId,
    app_version: appVersion || null,
  });

  // Expected server response (example):
  // { licenseDatBase64: "...." } where decoded value is the license.dat JSON blob
  // Or { licenseDat: {iv,ciphertext,tag} }
  let licenseDat = null;
  if (typeof resp?.licenseDat === 'object' && resp.licenseDat) {
    licenseDat = resp.licenseDat;
  } else if (typeof resp?.licenseDatBase64 === 'string') {
    const decoded = Buffer.from(resp.licenseDatBase64, 'base64').toString('utf8');
    licenseDat = safeJsonParse(decoded);
  }

  if (!licenseDat || !licenseDat.iv || !licenseDat.ciphertext || !licenseDat.tag) {
    throw new Error(resp?.error || 'Activation response missing license payload');
  }

  const p = getLicensePath(userDataPath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(licenseDat, null, 2), 'utf8');
  return { success: true };
}

module.exports = {
  getMachineFingerprintV2,
  getLicenseStatus,
  activateLicenseOnline,
  LICENSE_FILE_NAME,
  // for testing / report
  isSupportedOfflineVerifier,
};

