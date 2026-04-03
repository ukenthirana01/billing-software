'use strict';

/**
 * Optional Google Drive cloud backup (WhatsApp-style linked account).
 * Uses OAuth2 loopback + Drive API scope drive.file (only app-created files).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { shell, dialog } = require('electron');
const { google } = require('googleapis');

const CREDENTIALS_BASENAME = 'google-drive-app-credentials.json';
const TOKENS_BASENAME = 'google-drive-user-tokens.json';
const OAUTH_TIMEOUT_MS = 120000;
const FIXED_OAUTH_PORT = 45278;
const REDIRECT_PATH = '/oauth2callback';
const DRIVE_FOLDER_NAME = 'Relyce Book Backups';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let connectInProgress = false;

function dataPaths(userDataPath) {
  return {
    credentials: path.join(userDataPath, CREDENTIALS_BASENAME),
    tokens: path.join(userDataPath, TOKENS_BASENAME),
  };
}

function loadJsonSafe(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function saveJson(p, obj) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function escapeHtmlText(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeClientPair(cred) {
  if (!cred) return null;
  const clientId = String(cred.clientId || '').trim();
  const clientSecret = String(cred.clientSecret || '').trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Saved by user from Backup → Advanced (overrides embedded). */
function loadUserDataCredentials(userDataPath) {
  return normalizeClientPair(loadJsonSafe(dataPaths(userDataPath).credentials));
}

/** Shipped with the app — publisher fills `google-drive-oauth.embedded.json` so end users only sign in (WhatsApp-style). */
function loadEmbeddedCredentials() {
  const embedPath = path.join(__dirname, 'google-drive-oauth.embedded.json');
  return normalizeClientPair(loadJsonSafe(embedPath));
}

function loadAppCredentials(userDataPath) {
  return loadUserDataCredentials(userDataPath) || loadEmbeddedCredentials();
}

function getCredentialSource(userDataPath) {
  if (loadUserDataCredentials(userDataPath)) return 'user';
  if (loadEmbeddedCredentials()) return 'embedded';
  return 'none';
}

function loadStoredTokens(userDataPath) {
  const data = loadJsonSafe(dataPaths(userDataPath).tokens);
  if (!data || !data.tokens) return null;
  return { tokens: data.tokens, folderId: data.folderId || null };
}

function saveStoredTokens(userDataPath, { tokens, folderId }) {
  const existing = loadStoredTokens(userDataPath);
  const next = {
    tokens: tokens || existing?.tokens,
    folderId: folderId !== undefined ? folderId : existing?.folderId,
  };
  if (!next.tokens) return;
  saveJson(dataPaths(userDataPath).tokens, next);
}

function clearStoredTokens(userDataPath) {
  const p = dataPaths(userDataPath).tokens;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function parseGoogleDownloadedJson(text) {
  try {
    const j = JSON.parse(text);
    const block = j.installed || j.web;
    if (!block || !block.client_id || !block.client_secret) return null;
    return { clientId: block.client_id, clientSecret: block.client_secret };
  } catch {
    return null;
  }
}

function buildOAuthClient(appCred, redirectUri) {
  return new google.auth.OAuth2(appCred.clientId, appCred.clientSecret, redirectUri);
}

async function ensureBackupFolder(drive, stored, userDataPath) {
  if (stored.folderId) {
    try {
      await drive.files.get({ fileId: stored.folderId, fields: 'id' });
      return stored.folderId;
    } catch {
      // folder missing or revoked — recreate
    }
  }
  const folder = await drive.files.create({
    requestBody: {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  const id = folder.data.id;
  saveStoredTokens(userDataPath, { tokens: stored.tokens, folderId: id });
  return id;
}

/**
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ app: import('electron').App, getUserDataPath: () => string, getDb: () => import('better-sqlite3').Database, getActiveDbName: () => string }} ctx
 */
function registerGoogleDriveBackup(ipcMain, ctx) {
  ipcMain.handle('drive:saveCredentials', (_, payload) => {
    const userDataPath = ctx.getUserDataPath();
    const clientId = String(payload?.clientId || '').trim();
    const clientSecret = String(payload?.clientSecret || '').trim();
    if (!clientId || !clientSecret) {
      throw new Error('Client ID and Client Secret are required.');
    }
    saveJson(dataPaths(userDataPath).credentials, { clientId, clientSecret });
    return { success: true };
  });

  ipcMain.handle('drive:importCredentialsFile', async () => {
    const userDataPath = ctx.getUserDataPath();
    const result = await dialog.showOpenDialog({
      title: 'Select Google OAuth client JSON',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { success: false };
    const text = fs.readFileSync(result.filePaths[0], 'utf8');
    const parsed = parseGoogleDownloadedJson(text);
    if (!parsed) {
      throw new Error('Invalid or unsupported Google client JSON (need installed/web client_id and client_secret).');
    }
    saveJson(dataPaths(userDataPath).credentials, parsed);
    return { success: true };
  });

  ipcMain.handle('drive:clearUserCredentialsOverride', () => {
    const userDataPath = ctx.getUserDataPath();
    const p = dataPaths(userDataPath).credentials;
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { success: true };
  });

  ipcMain.handle('drive:getStatus', () => {
    const userDataPath = ctx.getUserDataPath();
    const hasCredentials = Boolean(loadAppCredentials(userDataPath));
    const stored = loadStoredTokens(userDataPath);
    return {
      hasCredentials,
      credentialSource: getCredentialSource(userDataPath),
      connected: Boolean(stored?.tokens?.refresh_token || stored?.tokens?.access_token),
    };
  });

  ipcMain.handle('drive:getAccountEmail', async () => {
    const userDataPath = ctx.getUserDataPath();
    const appCred = loadAppCredentials(userDataPath);
    const stored = loadStoredTokens(userDataPath);
    if (!appCred || !stored?.tokens) return { email: null };
    const redirectUri = `http://127.0.0.1:${FIXED_OAUTH_PORT}${REDIRECT_PATH}`;
    const oauth2 = buildOAuthClient(appCred, redirectUri);
    oauth2.setCredentials(stored.tokens);
    oauth2.on('tokens', (t) => {
      const merged = { ...stored.tokens, ...t };
      saveStoredTokens(userDataPath, { tokens: merged, folderId: stored.folderId });
    });
    try {
      const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
      const { data } = await oauth2Api.userinfo.get();
      return { email: data.email || null };
    } catch {
      return { email: null };
    }
  });

  ipcMain.handle('drive:connect', async () => {
    if (connectInProgress) {
      throw new Error('Google sign-in already in progress.');
    }
    const userDataPath = ctx.getUserDataPath();
    const appCred = loadAppCredentials(userDataPath);
    if (!appCred) {
      throw new Error('Google backup is not set up. Ask your software provider, or open Backup → Advanced and add OAuth details.');
    }

    const redirectUri = `http://127.0.0.1:${FIXED_OAUTH_PORT}${REDIRECT_PATH}`;
    const oauth2 = buildOAuthClient(appCred, redirectUri);

    connectInProgress = true;
    try {
      const tokens = await new Promise((resolve, reject) => {
        const server = http.createServer();
        let settled = false;
        const timer = setTimeout(() => {
          try { server.close(); } catch { /* ignore */ }
          if (!settled) {
            settled = true;
            reject(new Error('Google sign-in timed out. Try again.'));
          }
        }, OAUTH_TIMEOUT_MS);

        server.once('error', (e) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(new Error(
              e.code === 'EADDRINUSE'
                ? `Port ${FIXED_OAUTH_PORT} is in use. Close other apps or restart Relyce Book.`
                : e.message || 'Could not start local sign-in server.'
            ));
          }
        });

        server.on('request', async (req, res) => {
          if (!req.url || !req.url.startsWith(REDIRECT_PATH)) {
            res.writeHead(404);
            res.end();
            return;
          }
          const url = new URL(req.url, `http://127.0.0.1:${FIXED_OAUTH_PORT}`);
          const code = url.searchParams.get('code');
          const err = url.searchParams.get('error');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          if (err) {
            res.end(`<body style="font-family:sans-serif;padding:24px"><p>Sign-in cancelled or failed: ${escapeHtmlText(err)}</p><p>You can close this window.</p></body>`);
            clearTimeout(timer);
            try { server.close(); } catch { /* ignore */ }
            if (!settled) { settled = true; reject(new Error(err)); }
            return;
          }
          if (!code) {
            res.end('<body style="font-family:sans-serif;padding:24px"><p>Missing code. Close this window.</p></body>');
            clearTimeout(timer);
            try { server.close(); } catch { /* ignore */ }
            if (!settled) { settled = true; reject(new Error('No authorization code received.')); }
            return;
          }
          res.end('<body style="font-family:sans-serif;padding:24px"><p>Connected. You can close this window and return to Relyce Book.</p></body>');
          try {
            const { tokens } = await oauth2.getToken(code);
            clearTimeout(timer);
            try { server.close(); } catch { /* ignore */ }
            if (!settled) { settled = true; resolve(tokens); }
          } catch (e) {
            clearTimeout(timer);
            try { server.close(); } catch { /* ignore */ }
            if (!settled) { settled = true; reject(e); }
          }
        });

        server.listen(FIXED_OAUTH_PORT, '127.0.0.1', () => {
          const authUrl = oauth2.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: SCOPES,
          });
          shell.openExternal(authUrl);
        });
      });

      const prev = loadStoredTokens(userDataPath);
      saveStoredTokens(userDataPath, { tokens, folderId: prev?.folderId || null });
      return { success: true };
    } finally {
      connectInProgress = false;
    }
  });

  ipcMain.handle('drive:disconnect', () => {
    clearStoredTokens(ctx.getUserDataPath());
    return { success: true };
  });

  ipcMain.handle('drive:uploadBackup', async () => {
    const userDataPath = ctx.getUserDataPath();
    const appCred = loadAppCredentials(userDataPath);
    const stored = loadStoredTokens(userDataPath);
    if (!appCred) {
      throw new Error('Google backup is not set up. Use Backup → Advanced or ask your software provider.');
    }
    if (!stored?.tokens) {
      throw new Error('Connect your Google account first.');
    }

    const redirectUri = `http://127.0.0.1:${FIXED_OAUTH_PORT}${REDIRECT_PATH}`;
    const oauth2 = buildOAuthClient(appCred, redirectUri);
    oauth2.setCredentials(stored.tokens);
    oauth2.on('tokens', (t) => {
      const merged = { ...stored.tokens, ...t };
      saveStoredTokens(userDataPath, { tokens: merged, folderId: stored.folderId });
    });

    const drive = google.drive({ version: 'v3', auth: oauth2 });
    const folderId = await ensureBackupFolder(drive, stored, userDataPath);

    const db = ctx.getDb();
    const dbName = ctx.getActiveDbName().replace(/[^\w.\-]/g, '_');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tempName = `MS_Billing_Backup_${dbName}_${stamp}.db`;
    const tempPath = path.join(ctx.app.getPath('temp'), tempName);

    try {
      await db.backup(tempPath);
      const res = await drive.files.create({
        requestBody: {
          name: tempName,
          parents: [folderId],
          description: 'Relyce Book database backup',
        },
        media: {
          mimeType: 'application/octet-stream',
          body: fs.createReadStream(tempPath),
        },
        fields: 'id, name, webViewLink',
      });
      return {
        success: true,
        fileName: res.data.name,
        webViewLink: res.data.webViewLink || null,
        folderName: DRIVE_FOLDER_NAME,
      };
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
  });
}

module.exports = { registerGoogleDriveBackup, FIXED_OAUTH_PORT, REDIRECT_PATH };
