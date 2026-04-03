#!/usr/bin/env node
// ─── Relyce Book — License Key Generator ───────────────────────────
// Usage: node scripts/generate-license.js <HWID> <EXPIRY_DATE>
// Example: node scripts/generate-license.js "UUID-1234-ABCD-5678" "2027-12-31"
// Output:  MSB-20271231-a1b2c3d4e5f6
//
// This script is for the SOFTWARE DEVELOPER only. Never distribute this file.
// ────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');

// ═══ SECRET KEY — Change this to your own random secret and NEVER share it ═══
const LICENSE_SECRET = 'MS-BILLING-SECRET-2026-CHANGE-THIS-TO-YOUR-OWN-RANDOM-STRING';

function generateLicenseKey(hwid, expiryDateStr) {
  // Normalize the expiry date to YYYYMMDD
  const parts = expiryDateStr.split('-');
  if (parts.length !== 3) throw new Error('Date must be in YYYY-MM-DD format');
  const dateTag = parts.join(''); // "20271231"

  // Create HMAC signature: HMAC-SHA256(hwid + dateTag, SECRET)
  const payload = hwid.trim() + '|' + dateTag;
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex');

  // Use first 12 chars of the HMAC as the signature portion
  const signature = hmac.substring(0, 12);

  return `MSB-${dateTag}-${signature}`;
}

function validateLicenseKey(licenseKey, hwid) {
  if (!licenseKey || !licenseKey.startsWith('MSB-')) {
    return { valid: false, reason: 'Invalid format' };
  }

  const parts = licenseKey.split('-');
  // Expected: ['MSB', 'YYYYMMDD', 'signature12chars']
  if (parts.length < 3) return { valid: false, reason: 'Invalid format' };

  const dateTag = parts[1];
  const providedSig = parts.slice(2).join('-'); // In case signature has dashes

  if (dateTag.length !== 8) return { valid: false, reason: 'Invalid date in key' };

  // Re-compute expected signature
  const payload = hwid.trim() + '|' + dateTag;
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(payload).digest('hex');
  const expectedSig = hmac.substring(0, 12);

  // Timing-safe comparison
  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(expectedSig, 'utf8'),
      Buffer.from(providedSig.substring(0, 12), 'utf8')
    );
    if (!isMatch) return { valid: false, reason: 'Invalid key for this device' };
  } catch {
    return { valid: false, reason: 'Invalid key for this device' };
  }

  // Check expiry
  const year = parseInt(dateTag.substring(0, 4));
  const month = parseInt(dateTag.substring(4, 6)) - 1;
  const day = parseInt(dateTag.substring(6, 8));
  const expiryDate = new Date(year, month, day, 23, 59, 59);
  const now = new Date();

  if (now > expiryDate) {
    return { valid: false, expired: true, reason: 'License has expired' };
  }

  const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  return { valid: true, daysLeft, expiryDate: expiryDate.toISOString().split('T')[0] };
}

// ─── CLI Mode ────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           Relyce Book — License Generator           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Usage:  node scripts/generate-license.js <HWID> <EXPIRY_DATE>');
    console.log('');
    console.log('  HWID         The customer\'s Hardware ID (shown on their license screen)');
    console.log('  EXPIRY_DATE  Expiry date in YYYY-MM-DD format');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/generate-license.js "4C4C4544-0042-4810-8035-C7C04F575231" "2027-03-28"');
    console.log('');
    process.exit(1);
  }

  const hwid = args[0];
  const expiryDate = args[1];

  try {
    const key = generateLicenseKey(hwid, expiryDate);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    LICENSE KEY GENERATED                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  HWID:        ${hwid}`);
    console.log(`  Expires:     ${expiryDate}`);
    console.log(`  License Key: ${key}`);
    console.log('');

    // Self-verify
    const check = validateLicenseKey(key, hwid);
    console.log(`  ✅ Self-check: ${check.valid ? 'VALID' : 'FAILED'} (${check.daysLeft} days remaining)`);
    console.log('');

    // Test with wrong HWID
    const fakeCheck = validateLicenseKey(key, 'WRONG-HWID-123');
    console.log(`  🔒 Wrong-HWID test: ${fakeCheck.valid ? '❌ FAILED (should reject)' : '✅ REJECTED as expected'}`);
    console.log('');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// Export for use in main.js
module.exports = { generateLicenseKey, validateLicenseKey, LICENSE_SECRET };
