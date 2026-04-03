// Settings Module
const UPDATE_URL_KEY = 'ms_billing_update_manifest_url';
const DEFAULT_UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/ukenthirana01/Billing-software-/main/latest.json';

export async function render() {
  const co = await api.company.get() || {};
  const fys = await api.financialYears.getAll();
  const appVersion = await api.app.getVersion();
  const states = INDIAN_STATES.map((s) => `<option ${co.state === s ? 'selected' : ''}>${s}</option>`).join('');
  const savedUpdateUrl = localStorage.getItem(UPDATE_URL_KEY) || DEFAULT_UPDATE_MANIFEST_URL;

  document.getElementById('page-content').innerHTML = `
    <div class="tabs">
      <div class="tab-item active" onclick="switchSettingsTab('company',this)">Company Profile</div>
      <div class="tab-item" onclick="switchSettingsTab('fy',this)">Financial Year</div>
      <div class="tab-item" onclick="switchSettingsTab('updates',this)">Updates</div>
    </div>
    <div id="settings-tab-content"></div>`;

  const renderCompany = () => {
    document.getElementById('settings-tab-content').innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Company / Shop Profile</span></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group"><label class="form-label">Shop / Company Name *</label><input class="form-control" id="co-name" value="${co.name || ''}" /></div>
            <div class="form-group"><label class="form-label">Owner Name</label><input class="form-control" id="co-owner" value="${co.owner || ''}" /></div>
            <div class="form-group full"><label class="form-label">Address</label><textarea class="form-control" id="co-addr">${co.address || ''}</textarea></div>
            <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="co-phone" value="${co.phone || ''}" /></div>
            <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="co-email" value="${co.email || ''}" /></div>
            <div class="form-group"><label class="form-label">GST Number</label><input class="form-control" id="co-gst" value="${co.gst_no || ''}" /></div>
            <div class="form-group"><label class="form-label">PAN Number</label><input class="form-control" id="co-pan" value="${co.pan_no || ''}" /></div>
            <div class="form-group"><label class="form-label">State</label><select class="form-control" id="co-state"><option value="">Select</option>${states}</select></div>
            <div class="form-group"><label class="form-label">Invoice Prefix</label><input class="form-control" id="co-prefix" value="${co.invoice_prefix || 'INV'}" /></div>
            <div class="form-group"><label class="form-label">Business Type</label>
              <select class="form-control" id="co-biztype">
                <option value="retail" ${co.business_type === 'retail' ? 'selected' : ''}>Retail (Products)</option>
                <option value="service" ${co.business_type === 'service' ? 'selected' : ''}>Service (Services)</option>
              </select>
            </div>
            <div class="form-group full"><label class="form-label">Company Logo</label>
              <input type="file" id="co-logo" accept="image/*" class="form-control" style="padding:6px;" />
              ${co.logo ? `<div style="margin-top:8px"><img src="${co.logo}" style="height:40px;object-fit:contain;border:1px solid #ccc;border-radius:4px;padding:2px" /></div>` : ''}
            </div>
          </div>
          <button class="btn btn-primary mt-4" onclick="saveCompanySettings()">Save Settings</button>
        </div>
      </div>`;
  };

  const renderFY = () => {
    document.getElementById('settings-tab-content').innerHTML = `
      <div class="card mb-4">
        <div class="card-header"><span class="card-title">Add Financial Year</span></div>
        <div class="card-body">
          <div class="form-grid form-grid-3">
            <div class="form-group"><label class="form-label">Label (e.g. 2025-26)</label><input class="form-control" id="fy-label" placeholder="2025-26" /></div>
            <div class="form-group"><label class="form-label">Start Date</label><input class="form-control" id="fy-start" type="date" /></div>
            <div class="form-group"><label class="form-label">End Date</label><input class="form-control" id="fy-end" type="date" /></div>
          </div>
          <button class="btn btn-primary mt-3" onclick="addFY()">Add Financial Year</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Financial Years</span></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Label</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
          <tbody>${fys.map((f) => `<tr><td>${f.label}</td><td>${f.start_date}</td><td>${f.end_date}</td><td>${f.is_current ? '<span class="badge badge-success">Current</span>' : '<span class="badge badge-gray">Past</span>'}</td></tr>`).join('')}
          </tbody>
        </table></div>
      </div>`;
  };

  const renderUpdates = () => {
    document.getElementById('settings-tab-content').innerHTML = `
      <div class="card mb-4">
        <div class="card-header"><span class="card-title">Software Updates</span></div>
        <div class="card-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Current Version</label>
              <input class="form-control" value="${appVersion}" disabled />
            </div>
            <div class="form-group full">
              <label class="form-label">Update Manifest URL</label>
              <input class="form-control" id="update-manifest-url" value="${savedUpdateUrl}" placeholder="https://your-domain.com/ms-billing/latest.json" />
              <div style="font-size:12px;color:var(--gray-500);margin-top:6px">Internet is required only when checking/downloading updates. Daily app usage remains offline.</div>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn btn-primary" onclick="saveUpdateSettings()">Save Update URL</button>
            <button class="btn btn-success" onclick="checkSoftwareUpdate()">Check for Updates</button>
          </div>
          <div id="update-check-result" style="margin-top:12px"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Manifest Format</span></div>
        <div class="card-body">
          <pre style="margin:0;background:var(--gray-50);border:1px solid var(--gray-200);padding:12px;border-radius:8px;overflow:auto">{
  "version": "1.0.1",
  "notes": "Bug fixes and improvements",
  "published_at": "2026-03-22",
  "download_url": "https://your-domain.com/downloads/MS_Billing_Setup_1.0.1.exe",
  "mandatory": false
}</pre>
        </div>
      </div>`;
  };

  window.switchSettingsTab = function(tab, el) {
    document.querySelectorAll('.tab-item').forEach((t) => t.classList.remove('active'));
    el.classList.add('active');
    if (tab === 'company') renderCompany();
    else if (tab === 'fy') renderFY();
    else renderUpdates();
  };

  window.saveUpdateSettings = function() {
    const url = document.getElementById('update-manifest-url')?.value?.trim();
    if (!url) { toast('Update URL is required', 'error'); return; }
    localStorage.setItem(UPDATE_URL_KEY, url);
    toast('Update settings saved');
  };

  window.checkSoftwareUpdate = async function() {
    const url = document.getElementById('update-manifest-url')?.value?.trim();
    if (!url) { toast('Update URL is required', 'error'); return; }
    localStorage.setItem(UPDATE_URL_KEY, url);

    const resultEl = document.getElementById('update-check-result');
    if (resultEl) resultEl.innerHTML = `<span class="badge badge-info">Checking updates...</span>`;

    const res = await api.updates.check({ manifestUrl: url });
    if (!res?.ok) {
      if (resultEl) resultEl.innerHTML = `<span class="badge badge-danger">Check failed: ${window.escapeHtml ? window.escapeHtml(res?.message || 'Unknown error') : (res?.message || 'Unknown error')}</span>`;
      toast(res?.message || 'Update check failed', 'error');
      return;
    }

    if (!res.updateAvailable) {
      if (resultEl) resultEl.innerHTML = `<span class="badge badge-success">You are on latest version (${res.currentVersion})</span>`;
      toast('You are already on latest version');
      return;
    }

    const safeNotes = window.escapeHtml ? window.escapeHtml(res.notes || '-') : (res.notes || '-');
    const safeDate = window.escapeHtml ? window.escapeHtml(res.publishedAt || '-') : (res.publishedAt || '-');
    const hasDownload = Boolean(res.downloadUrl);
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="card" style="margin-top:8px;border:1px solid var(--success);">
          <div class="card-body">
            <div><strong>Update Available:</strong> ${res.latestVersion} (Current: ${res.currentVersion})</div>
            <div style="margin-top:6px"><strong>Published:</strong> ${safeDate}</div>
            <div style="margin-top:6px"><strong>Notes:</strong> ${safeNotes}</div>
            <div style="margin-top:10px">
              <button class="btn btn-success" ${hasDownload ? '' : 'disabled'} onclick="openUpdateDownload()">Download Update</button>
            </div>
          </div>
        </div>`;
    }
    window._latestUpdateDownloadUrl = res.downloadUrl || '';
    toast(`Update ${res.latestVersion} is available`, 'info');
  };

  window.openUpdateDownload = async function() {
    const url = String(window._latestUpdateDownloadUrl || '').trim();
    if (!url) { toast('Download URL missing in update manifest', 'error'); return; }
    await api.updates.openDownload(url);
  };

  renderCompany();
}

window.saveCompanySettings = async function() {
  const oldCo = await api.company.get() || {};
  let logoBase64 = oldCo.logo;
  const logoFile = document.getElementById('co-logo')?.files[0];
  if (logoFile) {
    logoBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(logoFile);
    });
  }

  const data = {
    name: document.getElementById('co-name').value.trim(),
    owner: document.getElementById('co-owner').value,
    address: document.getElementById('co-addr').value,
    phone: document.getElementById('co-phone').value,
    email: document.getElementById('co-email').value,
    gst_no: document.getElementById('co-gst').value,
    pan_no: document.getElementById('co-pan').value,
    state: document.getElementById('co-state').value,
    invoice_prefix: document.getElementById('co-prefix').value || 'INV',
    business_type: document.getElementById('co-biztype').value || 'retail',
    fy_start: null,
    logo: logoBase64
  };
  if (!data.name) { toast('Company name required', 'error'); return; }
  await api.company.save(data);
  const esc = window.escapeHtml ? window.escapeHtml : (v) => String(v ?? '');
  document.getElementById('topbar-company').innerHTML = `<i class="bi bi-building" style="margin-right:5px"></i>${esc(data.name)}`;
  window.currentAppMode = data.business_type === 'service' ? 'service' : 'retail';
  if (typeof window.applyAppMode === 'function') window.applyAppMode();
  toast('Settings saved!');
};

window.addFY = async function() {
  const label = document.getElementById('fy-label').value.trim();
  const start = document.getElementById('fy-start').value;
  const end = document.getElementById('fy-end').value;
  if (!label || !start || !end) { toast('Fill all fields', 'error'); return; }
  await api.financialYears.add({ label, start_date: start, end_date: end });
  toast('Financial year added!');
  navigateTo('settings');
};
