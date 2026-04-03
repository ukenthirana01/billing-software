// Settings Module
export async function render() {
  const co = await api.company.get() || {};
  const fys = await api.financialYears.getAll();
  const appVersion = await api.app.getVersion();
  const states = INDIAN_STATES.map((s) => `<option ${co.state === s ? 'selected' : ''}>${s}</option>`).join('');

  document.getElementById('page-content').innerHTML = `
    <div class="tabs">
      <div class="tab-item active" onclick="switchSettingsTab('company',this)">Company Profile</div>
      <div class="tab-item" onclick="switchSettingsTab('fy',this)">Financial Year</div>
      <div class="tab-item" onclick="switchSettingsTab('updates',this)">Updates</div>
    </div>
    <div id="settings-tab-content"></div>`;

  if (!window._updaterInitialized) {
    window._updaterInitialized = true;
    api.updater.onAvailable((info) => {
      const res = document.getElementById('update-check-result');
      if (res) res.innerHTML = `<div class="card" style="margin-top:10px;border:1px solid var(--success)"><div class="card-body"><span class="badge badge-success">Update v${info.version} available!</span><p style="margin-top:10px">${info.releaseNotes || 'Bug fixes and improvements.'}</p><button class="btn btn-success mt-2" onclick="api.updater.download()">Download Update</button></div></div>`;
    });
    api.updater.onNotAvailable(() => {
      const res = document.getElementById('update-check-result');
      if (res) res.innerHTML = `<span class="badge badge-info">You are on the latest version.</span>`;
    });
    api.updater.onProgress((p) => {
      const res = document.getElementById('update-check-result');
      if (res) {
        const percent = Math.round(p.percent || 0);
        res.innerHTML = `
          <div style="margin-top:10px">
             <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px;"><span>Downloading Update...</span><span>${percent}%</span></div>
             <div style="width:100%;height:8px;background:#eee;border-radius:4px;overflow:hidden"><div style="width:${percent}%;height:100%;background:var(--primary);transition:width 0.2s"></div></div>
             <div style="font-size:11px;color:#666;margin-top:4px">${(p.transferred/1024/1024).toFixed(2)} MB / ${(p.total/1024/1024).toFixed(2)} MB</div>
          </div>`;
      }
    });
    api.updater.onDownloaded(() => {
      const res = document.getElementById('update-check-result');
      if (res) res.innerHTML = `<div style="margin-top:10px;padding:12px;background:#e6f8ef;border:1px solid #c2ebd5;border-radius:6px;color:#186c3b"><strong>Download Complete!</strong><br><button class="btn btn-success mt-2" onclick="api.updater.quitAndInstall()">Quit and Install Now</button></div>`;
      toast('Update downloaded. Ready to install.', 'success');
    });
    api.updater.onError((err) => {
      const res = document.getElementById('update-check-result');
      if (res) res.innerHTML = `<span class="badge badge-danger">Update Error: ${err}</span>`;
    });
  }

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
              <select class="form-control" id="co-biztype" onchange="document.getElementById('qr-billing-settings').style.display = this.value==='retail'?'block':'none'">
                <option value="retail" ${co.business_type === 'retail' ? 'selected' : ''}>Retail (Products)</option>
                <option value="service" ${co.business_type === 'service' ? 'selected' : ''}>Service (Services)</option>
              </select>
            </div>
            <div class="form-group full" id="qr-billing-settings" style="${co.business_type === 'service' ? 'display:none;' : ''}margin-top:4px">
              <div style="background:linear-gradient(135deg,#eef2ff,#e0e7ff);border:1.5px solid #c7d2fe;border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:14px">
                <i class="bi bi-upc-scan" style="font-size:24px;color:#6366f1"></i>
                <div style="flex:1">
                  <div style="font-weight:700;font-size:13px;color:#312e81">QR / Barcode Billing</div>
                  <div style="font-size:10px;color:#6366f1;margin-top:2px">Barcode scanning at POS + QR label generator & printer</div>
                </div>
                <label style="display:flex;align-items:center;cursor:pointer;gap:6px">
                  <input type="checkbox" id="co-qrbilling" ${co.qr_billing ? 'checked' : ''} style="width:18px;height:18px;accent-color:#6366f1" />
                  <span style="font-weight:700;font-size:12px;color:#312e81">Enable</span>
                </label>
              </div>
            </div>
            <div class="form-group full"><label class="form-label">Invoice Template Design</label>
              <select class="form-control" id="co-template" onchange="document.getElementById('custom-template-wrap').style.display=this.value==='custom'?'block':'none'">
                <option value="standard" ${co.invoice_template === 'standard' ? 'selected' : ''}>Standard (Clean & Professional)</option>
                <option value="compact" ${co.invoice_template === 'compact' ? 'selected' : ''}>Compact (Space Saving / A5 / POS)</option>
                <option value="modern" ${co.invoice_template === 'modern' ? 'selected' : ''}>Modern (Rounded, High Contrast)</option>
                <option value="custom" ${co.invoice_template === 'custom' ? 'selected' : ''}>Custom HTML Upload</option>
              </select>
            </div>
            <div class="form-group full" id="custom-template-wrap" style="${co.invoice_template === 'custom' ? 'block' : 'display:none'}; background:#f8fafc; padding:12px; border-radius:8px; border:1px dashed #cbd5e1;">
              <label class="form-label">Upload Custom HTML Template</label>
              <input type="file" id="co-custom-html" accept=".html,.htm" class="form-control" style="padding:6px;" />
              <div style="font-size:11px;color:var(--gray-500);margin-top:6px">
                Your file should contain placeholders like <code>{{invoice.invoice_no}}</code>, <code>{{company.name}}</code>, and <code>{{invoice.total}}</code>. 
                Use <code>{{table_body}}</code> for the line items. <br/>
                <em>Current custom template is ${co.custom_template_html ? '<strong class="text-success">active</strong>' : '<strong class="text-danger">empty</strong>'}. Uploading a new file overwrites it.</em>
              </div>
            </div>
            <div class="form-group full"><label class="form-label">Company Logo</label>
              <input type="file" id="co-logo" accept="image/*" class="form-control" style="padding:6px;" />
              ${co.logo ? `<div style="margin-top:8px"><img src="${co.logo}" style="height:40px;object-fit:contain;border:1px solid #ccc;border-radius:4px;padding:2px" /></div>` : ''}
            </div>
            <div class="form-group full"><label class="form-label">Invoice Terms & Conditions</label>
              <textarea class="form-control" id="co-terms" rows="3" placeholder="E.g. Goods once sold will not be returned. Subject to local jurisdiction.">${co.terms_conditions || ''}</textarea>
              <div style="font-size:10px;color:var(--gray-400);margin-top:2px">This text will appear at the bottom of every invoice PDF</div>
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
          </div>
          <div class="flex gap-2 mt-3">
            <button class="btn btn-primary" onclick="checkVLCUpdate()">Check for Updates</button>
            <button class="btn btn-outline" onclick="api.shell.openExternal('https://your-domain.com/downloads')">Manual Download</button>
          </div>
          <div id="update-check-result" style="margin-top:12px"></div>
          <div class="mt-4" style="font-size:13px;color:#666;line-height:1.5;padding:12px;background:#f9fafb;border-radius:6px;border:1px solid #eee">
            <strong>Offline Installation:</strong> If this machine has no internet access, you can manually download the <code>.exe</code> installer from another machine and run it here. The local database and settings will be preserved perfectly.
          </div>
        </div>
      </div>`;
  };

  window.checkVLCUpdate = () => {
    const res = document.getElementById('update-check-result');
    if (res) res.innerHTML = `<span class="badge badge-info">Checking for latest version...</span>`;
    api.updater.check();
  };

  window.switchSettingsTab = function(tab, el) {
    document.querySelectorAll('.tab-item').forEach((t) => t.classList.remove('active'));
    el.classList.add('active');
    if (tab === 'company') renderCompany();
    else if (tab === 'fy') renderFY();
    else renderUpdates();
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

  let customHtmlString = oldCo.custom_template_html || '';
  const htmlFile = document.getElementById('co-custom-html')?.files[0];
  if (htmlFile) {
    customHtmlString = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(htmlFile);
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
    logo: logoBase64,
    terms_conditions: document.getElementById('co-terms')?.value || '',
    invoice_template: document.getElementById('co-template')?.value || 'standard',
    custom_template_html: customHtmlString,
    qr_billing: (document.getElementById('co-biztype').value === 'retail' && document.getElementById('co-qrbilling')?.checked) ? 1 : 0
  };
  if (!data.name) { toast('Company name required', 'error'); return; }
  await api.company.save(data);
  const esc = window.escapeHtml ? window.escapeHtml : (v) => String(v ?? '');
  document.getElementById('topbar-company').innerHTML = `<i class="bi bi-building" style="margin-right:5px"></i>${esc(data.name)}`;
  window.currentAppMode = data.business_type === 'service' ? 'service' : 'retail';
  window.qrBillingEnabled = Boolean(data.qr_billing);
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
