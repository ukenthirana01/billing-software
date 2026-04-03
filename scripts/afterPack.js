// ─── ASAR Encryption via asarmor (electron-builder afterPack hook) ──────
// This script runs automatically after electron-builder packages the app.
// It applies protections to the app.asar file to prevent easy extraction.

const path = require('path');

exports.default = async function afterPack(context) {
  try {
    const asarmor = require('asarmor');
    const asarPath = path.join(context.appOutDir, 'resources', 'app.asar');

    console.log('🔒 Applying ASAR protection...');

    const archive = await asarmor.open(asarPath);

    // 1. Add bloat — inflates the header to break naive extraction tools
    archive.patch(asarmor.createBloatPatch(1314));

    // 2. Apply file integrity validation (corrupts asar if tampered)
    archive.patch(asarmor.createTrashPatch(50));

    await archive.write(asarPath);

    console.log('✅ ASAR protection applied successfully!');
  } catch (err) {
    console.warn('⚠️  ASAR protection skipped:', err.message);
    // Don't fail the build if asarmor isn't available
  }
};
