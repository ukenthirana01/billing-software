// Backup Module
export async function render() {
  document.getElementById('page-content').innerHTML = `
    <div class="form-grid form-grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">💾 Export Backup</span></div>
        <div class="card-body" style="text-align:center;padding:32px">
          <div style="font-size:64px;margin-bottom:16px">📤</div>
          <h3 style="margin-bottom:8px">Save Database Backup</h3>
          <p class="text-muted mb-4">Save a copy of all your data to a safe location on your computer.</p>
          <button class="btn btn-primary" style="padding:12px 32px" onclick="doExportBackup()">Export Backup</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">📥 Restore Backup</span></div>
        <div class="card-body" style="text-align:center;padding:32px">
          <div style="font-size:64px;margin-bottom:16px">📥</div>
          <h3 style="margin-bottom:8px">Restore Database</h3>
          <p class="text-muted mb-4">Restore all data from a previously saved backup file.</p>
          <div class="alert alert-warning mb-4" style="text-align:left">⚠ This will replace all current data with the backup!</div>
          <button class="btn btn-danger" style="padding:12px 32px" onclick="doImportBackup()">Restore Backup</button>
        </div>
      </div>
    </div>`;
}

window.doExportBackup = async function() {
  const result = await api.backup.export();
  if (result.success) toast(`Backup saved to: ${result.path}`);
  else toast('Backup cancelled','info');
};
window.doImportBackup = async function() {
  if (!(await confirmModal('Restore Backup', 'This will replace all current data and restart the app. Are you sure?', 'Yes, restore', 'warning'))) return;
  const result = await api.backup.import();
  if (result.success) { toast('Backup restored! Reloading...'); setTimeout(()=>location.reload(), 1500); }
  else toast('Restore cancelled','info');
};
