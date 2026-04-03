#!/usr/bin/env node
// ─── Relyce Book — Online Activation Server ────────────────────
// A self-contained Node.js server for license activation and verification.
//
// Usage:
//   node scripts/activation-server.js
//   → Starts on port 3500 (or PORT env var)
//
// Endpoints:
//   POST /activate    { serialKey: string, hwid: string }
//   POST /verify      { token: string }
//   POST /revoke      { serialKey: string, adminSecret: string }
//   GET  /health      → { status: 'ok' }
//
// Deploy to: Vercel, Railway, VPS, or your own domain.
// ────────────────────────────────────────────────────────────────────────

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ═══ CONFIGURATION ═══════════════════════════════════════════════════════
const PORT = process.env.PORT || 3500;
const JWT_SECRET = process.env.JWT_SECRET || 'MS-BILLING-JWT-SECRET-CHANGE-IN-PRODUCTION';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';
const LICENSE_DB_PATH = path.join(__dirname, 'licenses.json');

// ═══ LICENSE DATABASE ════════════════════════════════════════════════════
// Format: { "SERIAL-KEY": { hwid: "bound-hwid" | null, expiryDate: "YYYY-MM-DD", revoked: false, activatedAt: "ISO" } }

function loadDB() {
  try {
    if (fs.existsSync(LICENSE_DB_PATH)) {
      return JSON.parse(fs.readFileSync(LICENSE_DB_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveDB(db) {
  fs.writeFileSync(LICENSE_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

// ═══ JWT HELPERS (Minimal — no dependency needed) ════════════════════════

function base64url(str) {
  return Buffer.from(str).toString('base64url');
}

function createJWT(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJWT(token) {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    
    // Constant-time comparison
    if (signature.length !== expectedSig.length) return null;
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (!crypto.timingSafeEqual(a, b)) return null;
    
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}

// ═══ REQUEST HANDLER ═════════════════════════════════════════════════════

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve(null); }
    });
  });
}

function respond(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = req.url.split('?')[0];

  // ─── GET /health ──────────────────────────────────────────────────
  if (url === '/health' && req.method === 'GET') {
    return respond(res, 200, { status: 'ok', time: new Date().toISOString() });
  }

  // ─── POST /activate ───────────────────────────────────────────────
  if (url === '/activate' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.serialKey || !body.hwid) {
      return respond(res, 400, { error: 'Missing serialKey or hwid' });
    }

    const db = loadDB();
    const entry = db[body.serialKey];

    if (!entry) {
      return respond(res, 404, { error: 'Serial key not found' });
    }

    if (entry.revoked) {
      return respond(res, 403, { error: 'This serial key has been revoked' });
    }

    // Check expiry
    const expiryDate = new Date(entry.expiryDate + 'T23:59:59');
    if (new Date() > expiryDate) {
      return respond(res, 403, { error: 'This serial key has expired' });
    }

    // Check if already bound to a different HWID
    if (entry.hwid && entry.hwid !== body.hwid) {
      return respond(res, 403, { error: 'This serial key is already bound to a different device' });
    }

    // Bind to HWID and generate token
    entry.hwid = body.hwid;
    entry.activatedAt = new Date().toISOString();
    db[body.serialKey] = entry;
    saveDB(db);

    const token = createJWT({
      serialKey: body.serialKey,
      hwid: body.hwid,
      expiryDate: entry.expiryDate,
    });

    const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

    return respond(res, 200, {
      success: true,
      token,
      expiryDate: entry.expiryDate,
      daysLeft,
    });
  }

  // ─── POST /verify ─────────────────────────────────────────────────
  if (url === '/verify' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.token) {
      return respond(res, 400, { error: 'Missing token' });
    }

    const payload = verifyJWT(body.token);
    if (!payload) {
      return respond(res, 403, { error: 'Invalid token' });
    }

    // Check expiry from token
    const expiryDate = new Date(payload.expiryDate + 'T23:59:59');
    if (new Date() > expiryDate) {
      return respond(res, 403, { error: 'Token expired', expired: true });
    }

    // Check if serial is revoked
    const db = loadDB();
    const entry = db[payload.serialKey];
    if (entry && entry.revoked) {
      return respond(res, 403, { error: 'License has been revoked', revoked: true });
    }

    const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
    return respond(res, 200, { valid: true, daysLeft, expiryDate: payload.expiryDate });
  }

  // ─── POST /revoke (Admin) ─────────────────────────────────────────
  if (url === '/revoke' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body || !body.serialKey || body.adminSecret !== ADMIN_SECRET) {
      return respond(res, 403, { error: 'Unauthorized' });
    }

    const db = loadDB();
    if (!db[body.serialKey]) {
      return respond(res, 404, { error: 'Serial key not found' });
    }

    db[body.serialKey].revoked = true;
    saveDB(db);
    return respond(res, 200, { success: true, message: `Serial ${body.serialKey} revoked` });
  }

  // ─── 404 ──────────────────────────────────────────────────────────
  respond(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Relyce Book — Activation Server              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🟢 Server running on http://localhost:${PORT}`);
  console.log(`  📂 License DB: ${LICENSE_DB_PATH}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    POST /activate  { serialKey, hwid }');
  console.log('    POST /verify    { token }');
  console.log('    POST /revoke    { serialKey, adminSecret }');
  console.log('    GET  /health');
  console.log('');

  // Create sample licenses.json if it doesn't exist
  if (!fs.existsSync(LICENSE_DB_PATH)) {
    const sampleDB = {
      'SAMPLE-KEY-001': {
        hwid: null,
        expiryDate: '2027-12-31',
        revoked: false,
        activatedAt: null,
      },
    };
    saveDB(sampleDB);
    console.log('  📝 Created sample licenses.json with one test key: SAMPLE-KEY-001');
    console.log('');
  }
});
