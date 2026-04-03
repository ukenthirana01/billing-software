// Relyce Book - Main App Router


let currentUser = null;
const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry'];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── TOAST ───────────────────────────────────────────
function toast(msg, type='success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? 'OK' : type === 'error' ? 'ERR' : 'i';
  const message = document.createElement('span');
  message.textContent = String(msg ?? '');
  t.append(icon, message);
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ─── MODAL ───────────────────────────────────────────
function openModal(title, bodyHTML, footer='') {
  document.getElementById('modal-box').innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${escapeHtml(title)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">${bodyHTML}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}`;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id==='modal-overlay') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ─── PREMIUM CONFIRM MODAL ───
function confirmModal(title, text, confirmText = 'Yes, proceed', type = 'danger') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-modal-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = text;
    
    const btnOk = document.getElementById('confirm-btn-ok');
    btnOk.textContent = confirmText;
    btnOk.className = `btn btn-${type}`;
    
    const iconDiv = document.querySelector('.confirm-icon');
    iconDiv.style.background = `var(--${type}-bg)`;
    iconDiv.style.color = `var(--${type})`;
    iconDiv.innerHTML = type === 'danger' ? '<i class="bi bi-exclamation-triangle"></i>' 
                      : (type === 'warning' ? '<i class="bi bi-exclamation-circle"></i>' : '<i class="bi bi-info-circle"></i>');

    const btnCancel = document.getElementById('confirm-btn-cancel');
    
    const cleanup = () => {
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      overlay.classList.add('hidden');
    };
    
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    
    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    
    overlay.classList.remove('hidden');
    btnCancel.focus();
  });
}
window.confirmModal = confirmModal;

// ─── CURRENCY ─────────────────────────────────────────
function fmtCur(n) { return '₹ ' + (Number(n)||0).toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2}); }
function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── ROUTER ───────────────────────────────────────────
const pageCache = {};
const pageTitles = {
  dashboard:'Dashboard', customers:'Customers', suppliers:'Suppliers',
  products:'Products', ledger:'Ledger', sales:'Sales / Billing',
  'daily-funds':'Daybook / Daily Expenses',
  purchase:'Purchase', quotation:'Quotation', 'credit-note':'Credit Note',
  'debit-note':'Debit Note', 'delivery-note':'Delivery Note',
  proforma:'Proforma Invoice', 'purchase-order':'Purchase Order',
  stock:'Stock Management', reports:'Reports', settings:'Settings',
  users:'User Management', backup:'Backup & Restore', logs:'Activity Log',
  'qr-labels':'QR / Barcode Labels'
};

async function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  document.getElementById('page-content').innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>Loading...</p></div>';
  
  try {
    const mod = await loadPageModule(page);
    if (!mod || typeof mod.render !== 'function') {
      document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Page Unavailable</h3><p>Module: ${escapeHtml(page)}</p></div>`;
      return;
    }
    await Promise.resolve(mod.render());
  } catch (error) {
    console.error(`Failed to navigate to ${page}:`, error);
    toast(error?.message || `Failed to open ${pageTitles[page] || page}`, 'error');
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Something Went Wrong</h3><p>Please retry loading this page.</p></div>`;
  }
}

async function loadPageModule(page) {
  if (!pageCache[page]) {
    try {
      const m = await import(`./modules/${page}.js`);
      pageCache[page] = m;
    } catch(e) {
      document.getElementById('page-content').innerHTML = `<div class="empty-state"><div class="icon">🚧</div><h3>Coming Soon</h3><p>Module: ${page}</p></div>`;
      return null;
    }
  }
  return pageCache[page];
}

// ─── SETUP SCREEN ─────────────────────────────────────
async function showSetupScreen() {
  const screen = document.getElementById('setup-screen');
  const states = INDIAN_STATES.map(s => `<option>${s}</option>`).join('');
  screen.innerHTML = `
    <div class="setup-card">
      <!-- Left Banner -->
      <div class="setup-banner" style="width:320px; flex-shrink: 0; background: linear-gradient(135deg, var(--brown-800), var(--brown-900)); color: white; padding: 40px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size:54px; margin-bottom:10px; line-height:1; color: var(--brown-200);">
            <i class="bi bi-shop"></i>
          </div>
          <h1 style="font-size: 28px; font-weight: 800; font-family: 'Poppins', sans-serif; letter-spacing: -0.5px; line-height: 1.2; margin-bottom: 15px;">Welcome to<br>Relyce Book</h1>
          <p style="color: rgba(255,255,255,0.75); font-size: 13px; line-height: 1.6;">Configure your business profile to start generating professional invoices, managing stock, and tracking your sales effortlessly.</p>
        </div>
        <div style="font-size: 11px; color: rgba(255,255,255,0.5); border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
          <i class="bi bi-shield-check" style="margin-right: 5px; font-size:13px; color: var(--success);"></i> 100% Offline & Secure. Your data stays on this computer.
        </div>
      </div>
      
      <!-- Right Form -->
      <div class="setup-body" style="flex:1; padding: 40px; background: white; max-height: 90vh; overflow-y: auto;">
        <div class="setup-header" style="text-align:left; margin-bottom:24px;">
          <h2 style="font-size: 20px; font-weight: 700; color: var(--gray-900); font-family: 'Poppins', sans-serif;">Company Details</h2>
          <p style="color: var(--gray-500); font-size: 12px; margin-top: 4px;">These details will automatically appear on your generated PDFs.</p>
        </div>
        
        <div class="form-grid">
          <!-- Basic Details -->
          <div class="form-group full"><label for="s-name" class="form-label"><i class="bi bi-building"></i> Shop / Company Name *</label><input class="form-control" id="s-name" placeholder="e.g. ABC Traders" autofocus /></div>
          <div class="form-group"><label for="s-owner" class="form-label"><i class="bi bi-person-badge"></i> Owner Name</label><input class="form-control" id="s-owner" placeholder="Owner full name" /></div>
          <div class="form-group"><label for="s-phone" class="form-label"><i class="bi bi-telephone"></i> Phone</label><input class="form-control" id="s-phone" type="tel" placeholder="Mobile / Phone number" /></div>
          <div class="form-group full"><label for="s-address" class="form-label"><i class="bi bi-geo-alt"></i> Address</label><textarea class="form-control" id="s-address" rows="2" placeholder="Full business address"></textarea></div>
          <div class="form-group"><label for="s-email" class="form-label"><i class="bi bi-envelope"></i> Email</label><input class="form-control" id="s-email" type="email" placeholder="email@example.com" /></div>
          <div class="form-group"><label for="s-state" class="form-label"><i class="bi bi-map"></i> State</label><select class="form-control" id="s-state"><option value="">Select State</option>${states}</select></div>
          <div class="form-group"><label for="s-biztype" class="form-label"><i class="bi bi-briefcase"></i> Business Type</label>
            <select class="form-control" id="s-biztype" onchange="document.getElementById('qr-billing-setup').style.display = this.value==='retail'?'block':'none'">
              <option value="retail">Retail (Products)</option>
              <option value="service">Service (Services)</option>
            </select>
          </div>

          <div class="form-group full" id="qr-billing-setup" style="margin-top:4px">
            <div style="background:linear-gradient(135deg,#eef2ff,#e0e7ff);border:1.5px solid #c7d2fe;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:14px">
              <i class="bi bi-upc-scan" style="font-size:28px;color:#6366f1"></i>
              <div style="flex:1">
                <div style="font-weight:700;font-size:14px;color:#312e81">Enable QR / Barcode Billing</div>
                <div style="font-size:11px;color:#6366f1;margin-top:2px">Adds barcode scanning at POS, QR label generator & printer for products</div>
              </div>
              <label style="display:flex;align-items:center;cursor:pointer;gap:8px">
                <input type="checkbox" id="s-qrbilling" style="width:20px;height:20px;accent-color:#6366f1" />
                <span style="font-weight:700;font-size:13px;color:#312e81">Enable</span>
              </label>
            </div>
          </div>
          
          <!-- Tax Section Divider -->
          <div class="form-group full" style="margin-top:8px;">
            <h3 style="font-size: 13px; font-weight: 700; color: var(--brown-700); margin-bottom: 5px; border-bottom: 1px solid var(--gray-200); padding-bottom: 6px; text-transform:uppercase; letter-spacing:0.5px;">Tax & Registration</h3>
          </div>
          
          <div class="form-group"><label for="s-gst" class="form-label"><i class="bi bi-file-earmark-text"></i> GST Number</label><input class="form-control" id="s-gst" placeholder="22AAAAA0000A1Z5" /></div>
          <div class="form-group"><label for="s-pan" class="form-label"><i class="bi bi-credit-card-2-front"></i> PAN Number</label><input class="form-control" id="s-pan" placeholder="AAAAA0000A" /></div>
          
          <!-- Billing Section Divider -->
          <div class="form-group full" style="margin-top:8px;">
            <h3 style="font-size: 13px; font-weight: 700; color: var(--brown-700); margin-bottom: 5px; border-bottom: 1px solid var(--gray-200); padding-bottom: 6px; text-transform:uppercase; letter-spacing:0.5px;">Billing Preferences</h3>
          </div>

          <div class="form-group"><label for="s-prefix" class="form-label"><i class="bi bi-hash"></i> Invoice Prefix</label><input class="form-control" id="s-prefix" placeholder="INV" value="INV" /></div>
          <div class="form-group"><label for="s-fy" class="form-label"><i class="bi bi-calendar3"></i> Financial Year Start</label><input class="form-control" id="s-fy" type="date" value="2024-04-01" /></div>
          
          <!-- Logo Upload Box -->
          <div class="form-group full mt-3">
            <div style="background: var(--gray-50); border: 1.5px dashed var(--gray-300); border-radius: var(--border-radius); padding: 16px; display: flex; align-items: center; gap: 16px;">
              <div style="flex:1;">
                <label for="s-logo" class="form-label" style="display:flex; align-items:center; gap:6px; margin-bottom:4px; cursor: pointer;"><i class="bi bi-image" style="font-size:15px; color: var(--brown-600);"></i> Company Logo</label>
                <div style="font-size:11px; color:var(--gray-500); margin-bottom: 10px;">Recommended size: 300x100px (JPG, PNG). Automatically added to PDFs.</div>
                <input type="file" id="s-logo" accept="image/*" style="font-size: 12px; color: var(--gray-600);" />
              </div>
              <img id="s-logo-preview" src="" style="height:60px; max-width:140px; object-fit:contain; border-radius:6px; border:1px solid var(--gray-200); display:none; background:white; padding: 4px; box-shadow: var(--shadow-sm);" />
            </div>
          </div>
        </div>
        
        <div style="margin-top:34px; text-align:right;">
          <button class="btn btn-primary" style="padding:12px 32px; font-size:14px; border-radius: 8px;" onclick="saveSetup()"><i class="bi bi-box-arrow-in-right" style="margin-right:6px"></i> Save & Start Software</button>
        </div>
      </div>
    </div>`;
  screen.classList.remove('hidden');
  // Live logo preview
  setTimeout(() => {
    const logoInput = document.getElementById('s-logo');
    if (logoInput) {
      logoInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const preview = document.getElementById('s-logo-preview');
          preview.src = e.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      });
    }
  }, 100);
}

window.saveSetup = async function() {
  try {
    const name = document.getElementById('s-name').value.trim();
    if (!name) { toast('Company name is required', 'error'); return; }

    // Read logo as Base64 if selected
    let logoBase64 = null;
    const logoFile = document.getElementById('s-logo').files[0];
    if (logoFile) {
      logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(logoFile);
      });
    }

    const bizType = document.getElementById('s-biztype').value || 'retail';
    const qrBilling = bizType === 'retail' && document.getElementById('s-qrbilling')?.checked ? 1 : 0;
    await api.company.save({
      name, owner: document.getElementById('s-owner').value,
      address: document.getElementById('s-address').value,
      phone: document.getElementById('s-phone').value,
      email: document.getElementById('s-email').value,
      gst_no: document.getElementById('s-gst').value,
      pan_no: document.getElementById('s-pan').value,
      state: document.getElementById('s-state').value,
      invoice_prefix: document.getElementById('s-prefix').value || 'INV',
      business_type: bizType,
      fy_start: document.getElementById('s-fy').value,
      logo: logoBase64,
      qr_billing: qrBilling
    });
    document.getElementById('setup-screen').classList.add('hidden');
    showLoginScreen();
  } catch (error) {
    console.error('Setup save failed:', error);
    toast(error?.message || 'Failed to save setup details', 'error');
  }
};

// ─── LOGIN SCREEN ─────────────────────────────────────
let loginUiWired = false;

function setLoginLoading(isLoading) {
  const btn = document.getElementById('login-submit-btn');
  const spinner = document.getElementById('login-submit-spinner');
  const toggleBtn = document.getElementById('toggle-login-password');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');

  if (!btn || !spinner || !usernameInput || !passwordInput) return;

  btn.disabled = Boolean(isLoading);
  toggleBtn && (toggleBtn.disabled = Boolean(isLoading));

  spinner.classList.toggle('hidden', !isLoading);
  btn.classList.toggle('login-loading', Boolean(isLoading));

  usernameInput.disabled = Boolean(isLoading);
  passwordInput.disabled = Boolean(isLoading);
}

function clearLoginErrors() {
  ['login-username-error', 'login-password-error', 'login-form-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const wraps = ['login-username-wrap', 'login-password-wrap'].map(id => document.getElementById(id)).filter(Boolean);
  wraps.forEach(w => w.classList.remove('error'));
}

function setLoginFieldError(fieldWrapId, message) {
  const wrap = document.getElementById(fieldWrapId);
  if (!wrap) return;
  wrap.classList.add('error');

  const errorId =
    fieldWrapId === 'login-username-wrap' ? 'login-username-error' :
    fieldWrapId === 'login-password-wrap' ? 'login-password-error' : null;

  if (!errorId) return;
  const el = document.getElementById(errorId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function wireLoginUiOnce() {
  if (loginUiWired) return;
  loginUiWired = true;

  const toggleBtn = document.getElementById('toggle-login-password');
  const passwordInput = document.getElementById('login-password');
  const capsHint = document.getElementById('login-capslock-hint');
  const usernameInput = document.getElementById('login-username');

  if (toggleBtn && passwordInput) {
    // Default: hide password.
    passwordInput.type = 'password';
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.setAttribute('aria-label', 'Show password');

    toggleBtn.addEventListener('click', () => {
      const show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      toggleBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');

      const icon = toggleBtn.querySelector('i');
      if (icon) icon.className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
  }

  if (passwordInput && capsHint) {
    const onCapsLock = (e) => {
      const capsOn = Boolean(e?.getModifierState && e.getModifierState('CapsLock'));
      capsHint.classList.toggle('hidden', !capsOn);
    };
    passwordInput.addEventListener('keydown', onCapsLock);
    passwordInput.addEventListener('keyup', onCapsLock);
  }

  // Improve first interaction.
  if (usernameInput) usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const password = document.getElementById('login-password');
      password && password.focus();
    }
  });
}

function showLoginScreen() {
  wireLoginUiOnce();
  setLoginLoading(false);
  clearLoginErrors();

  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  const loginScreen = document.getElementById('login-screen');
  loginScreen?.classList.remove('hidden');
  loginScreen?.setAttribute('aria-hidden', 'false');

  document.getElementById('login-capslock-hint')?.classList.add('hidden');
  const passwordInput = document.getElementById('login-password');
  const toggleBtn = document.getElementById('toggle-login-password');
  if (passwordInput) passwordInput.type = 'password';
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.setAttribute('aria-label', 'Show password');
    const icon = toggleBtn.querySelector('i');
    if (icon) icon.className = 'bi bi-eye';
  }

  document.getElementById('login-username')?.focus();
}

window.applyRBAC = function() {
  if (currentUser?.role !== 'admin') {
    document.body.classList.add('cashier-mode');
  } else {
    document.body.classList.remove('cashier-mode');
  }
};

window.authenticateUser = async function(event) {
  if(event) event.preventDefault();
  try {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    // Quick escape for bypassing setup/dev
    if(username === 'admin' && password === 'admin123') {
      // Allow fallback if DB hasn't properly set up but don't strictly require it
    }

    clearLoginErrors();
    document.getElementById('login-form-error')?.classList.add('hidden');

    if (!username) {
      setLoginFieldError('login-username-wrap', 'Username is required.');
      document.getElementById('login-username')?.focus();
      return;
    }
    if (!password) {
      setLoginFieldError('login-password-wrap', 'Password is required.');
      document.getElementById('login-password')?.focus();
      return;
    }

    setLoginLoading(true);

    const user = await api.auth.login({ username, password });
    if (!user) {
      const msg = 'Invalid credentials';
      document.getElementById('login-form-error').textContent = msg;
      document.getElementById('login-form-error').classList.remove('hidden');
      // Keep toast for consistency with the rest of the app.
      toast(msg, 'error');
      return;
    }
    currentUser = user;
    
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name[0].toUpperCase();
    document.getElementById('user-role').textContent = user.role === 'admin' ? 'Administrator' : 'Staff';
    
    const co = await api.company.get();
    if (co) {
      document.getElementById('topbar-company').innerHTML = `<i class="bi bi-building" style="margin-right:5px"></i>${escapeHtml(co.name)}`;
    }

    // Apply RBAC restrictions
    applyRBAC();

    // Use install-time business type directly (no extra mode selection step).
    window.currentAppMode = co?.business_type === 'service' ? 'service' : 'retail';
    window.qrBillingEnabled = Boolean(co?.qr_billing);

    closeModal();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    
    applyRBAC();
    navigateTo('dashboard');
    
    // FIX: Check financial year on login
    checkFinancialYear();
  } catch (error) {
    console.error('Login failed:', error);
    const msg = error?.message || 'Login failed due to connection or system error';
    toast(msg, 'error');
    const formError = document.getElementById('login-form-error');
    if (formError) {
      formError.textContent = msg;
      formError.classList.remove('hidden');
    }
  } finally {
    // If we didn't navigate away, reset loading state.
    setLoginLoading(false);
  }
};

window.getCurrentUser = function() { return currentUser; };
window.navigateTo = navigateTo;
window.fmtCur = fmtCur;
window.today = today;
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.INDIAN_STATES = INDIAN_STATES;
window.escapeHtml = escapeHtml;

// Global runtime guards for better UX during unexpected failures.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event?.reason);
  toast(event?.reason?.message || 'Unexpected error occurred. Please retry.', 'error');
});
window.addEventListener('error', (event) => {
  console.error('Unhandled runtime error:', event?.error || event?.message);
  toast('Unexpected runtime error occurred. Please retry.', 'error');
});
window.addEventListener('offline', () => {
  toast('You are offline. App features remain available locally.', 'warning');
});
window.addEventListener('online', () => {
  toast('Connection restored.', 'success');
});

// ─── SIDEBAR NAV & APP MODES ─────────────────────────
window.applyAppMode = function() {
  const mode = window.currentAppMode || 'retail';
  const qrEnabled = window.qrBillingEnabled || false;
  document.querySelectorAll('.nav-item').forEach(el => {
    const page = el.dataset.page;
    let show = true;
    if (mode === 'service') {
      // Service workflow: hide stock-heavy, dispatch, and QR sections.
      if (['stock', 'delivery-note', 'qr-labels', 'purchase-order'].includes(page)) show = false;
    }
    // Hide QR Labels page if QR billing is not enabled (even in retail)
    if (page === 'qr-labels' && !qrEnabled) show = false;
    el.style.display = show ? 'flex' : 'none';
  });
};

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    navigateTo(el.dataset.page);
    if (window.innerWidth <= 992) document.getElementById('app-shell').classList.remove('sidebar-open');
  });
});
document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await api.auth.logout(); } catch(e) { /* ignore */ }
  currentUser = null;
  document.getElementById('app-shell').classList.add('hidden');
  applyRBAC();
  showLoginScreen();
});
document.getElementById('toggle-sidebar').addEventListener('click', () => {
  const shellEl = document.getElementById('app-shell');
  if (window.innerWidth <= 992) {
    shellEl.classList.toggle('sidebar-open');
    return;
  }
  shellEl.classList.toggle('sidebar-collapsed');
});

// Date display
function updateDate() {
  const d = new Date();
  document.getElementById('date-display').innerHTML =
    `<i class="bi bi-calendar3" style="margin-right:4px"></i>${d.toLocaleDateString('en-IN', {weekday:'short',day:'2-digit',month:'short',year:'numeric'})}`;
}
updateDate(); setInterval(updateDate, 60000);

// ─── COMPANY SELECTION ────────────────────────────────
function showCompanySelectionScreen(companies) {
  const screen = document.getElementById('company-selection-screen');
  const cards = companies.map(c => `
    <div class="company-card" onclick="selectCompany('${c.dbName}')" style="background:#fff;border:1px solid var(--gray-200);border-radius:16px;padding:32px 24px;cursor:pointer;text-align:center;transition:all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);position:relative;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05)" onmouseover="this.style.transform='translateY(-6px)';this.style.boxShadow='0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)';this.style.borderColor='var(--primary-300)';this.querySelector('.card-top-bar').style.opacity='1'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 6px -1px rgba(0, 0, 0, 0.05)';this.style.borderColor='var(--gray-200)';this.querySelector('.card-top-bar').style.opacity='0'">
      <div class="card-top-bar" style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg, var(--primary-500), var(--primary-600));opacity:0;transition:opacity 0.3s"></div>
      
      <button class="delete-company-btn" onclick="event.stopPropagation(); deleteWorkspace('${c.dbName}', '${escapeHtml(c.name)}')" style="position:absolute;top:12px;right:12px;background:white;border:1px solid var(--gray-200);color:var(--gray-400);width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;z-index:10" title="Delete Workspace" onmouseover="this.style.color='#ef4444';this.style.borderColor='#fca5a5';this.style.background='#fef2f2'" onmouseout="this.style.color='var(--gray-400)';this.style.borderColor='var(--gray-200)';this.style.background='white'">
        <i class="bi bi-trash-fill"></i>
      </button>
      
      ${c.logo ? `<div style="height:76px;display:flex;align-items:center;justify-content:center;margin-bottom:20px"><img src="${escapeHtml(c.logo)}" style="max-height:100%;max-width:100%;object-fit:contain;" /></div>` : `<div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg, var(--primary-50), white);color:var(--primary-700);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;margin:0 auto 20px;border:1px solid var(--primary-100);box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">${escapeHtml(c.name)[0].toUpperCase()}</div>`}
      
      <h3 style="margin:0 0 8px;font-size:20px;font-weight:700;color:var(--gray-900);font-family:'Poppins',sans-serif;letter-spacing:-0.3px">${escapeHtml(c.name)}</h3>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px">
         <span style="display:inline-flex;align-items:center;background:var(--gray-50);color:var(--gray-600);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;border:1px solid var(--gray-200)"><i class="bi ${c.business_type === 'service' ? 'bi-briefcase' : 'bi-shop'}" style="margin-right:4px;font-size:11px"></i>${escapeHtml(c.business_type)}</span>
      </div>
      <div style="margin-top:24px;color:var(--primary-600);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:4px;opacity:0.9">
         Open Workspace <i class="bi bi-arrow-right-short" style="font-size:18px;margin-top:2px"></i>
      </div>
    </div>
  `).join('');

  screen.innerHTML = `
    <div style="min-height:100vh;background:linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;position:relative;overflow:hidden">
      <!-- Decorative background elements -->
      <div style="position:absolute;top:-10%;left:-5%;width:400px;height:400px;background:radial-gradient(circle, var(--primary-100) 0%, transparent 70%);opacity:0.6;border-radius:50%;z-index:0"></div>
      <div style="position:absolute;bottom:-10%;right:-5%;width:500px;height:500px;background:radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);opacity:0.8;border-radius:50%;z-index:0"></div>
      
      <div style="position:relative;z-index:1;text-align:center;margin-bottom:48px;animation:fadeInDown 0.6s ease-out">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background:white;border-radius:18px;margin-bottom:20px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02);border:1px solid rgba(255,255,255,0.5)">
           <i class="bi bi-grid-1x2" style="font-size:28px;color:var(--primary-600)"></i>
        </div>
        <h1 style="font-size:38px;font-weight:800;color:var(--gray-900);margin:0 0 12px;font-family:'Poppins',sans-serif;letter-spacing:-1px">Select Workspace</h1>
        <p style="color:var(--gray-500);font-size:16px;max-width:400px;margin:0 auto;line-height:1.5">Choose a business profile below to securely access your data, ledgers, and inventory.</p>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:28px;width:100%;max-width:1000px;margin-bottom:50px;position:relative;z-index:1;animation:fadeInUp 0.6s ease-out 0.1s both">
        ${cards}
        
        <!-- Add New Company Card (Dashed) -->
        <div class="company-card-dashed" onclick="addNewCompany()" style="background:transparent;border:2px dashed var(--gray-300);border-radius:16px;padding:32px 24px;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:all 0.3s ease;min-height:220px" onmouseover="this.style.borderColor='var(--primary-400)';this.style.background='white';this.style.boxShadow='0 10px 15px -3px rgba(0,0,0,0.05)';this.querySelector('.plus-icon').style.background='var(--primary-600)';this.querySelector('.plus-icon').style.color='white';this.querySelector('.plus-icon').style.transform='scale(1.1)'" onmouseout="this.style.borderColor='var(--gray-300)';this.style.background='transparent';this.style.boxShadow='none';this.querySelector('.plus-icon').style.background='var(--gray-100)';this.querySelector('.plus-icon').style.color='var(--gray-500)';this.querySelector('.plus-icon').style.transform='scale(1)'">
           <div class="plus-icon" style="width:64px;height:64px;border-radius:50%;background:var(--gray-100);color:var(--gray-500);display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:20px;transition:all 0.3s ease;border:1px solid rgba(0,0,0,0.05)">
             <i class="bi bi-plus" style="margin-left:2px;margin-top:2px"></i>
           </div>
           <h3 style="margin:0 0 8px;font-size:18px;font-weight:600;color:var(--gray-800);font-family:'Poppins',sans-serif">Add New Business</h3>
           <p style="margin:0;font-size:13px;color:var(--gray-500)">Create a fresh, isolated workspace</p>
        </div>
      </div>
      
      <style>
        @keyframes fadeInDown { from { opacity:0; transform:translateY(-20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
      </style>
    </div>
  `;
  screen.classList.remove('hidden');
}

window.selectCompany = async function(dbName) {
  try {
    document.getElementById('company-selection-screen').innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--gray-500)">Loading workspace...</div>';
    await api.app.switchCompany(dbName);
    document.getElementById('company-selection-screen').classList.add('hidden');
    showLoginScreen();
  } catch(e) {
    toast('Failed to load company workspace', 'error');
    init();
  }
};

window.addNewCompany = async function() {
  try {
    const newDbName = 'ms_billing_' + Date.now() + '.db';
    await api.app.switchCompany(newDbName);
    document.getElementById('company-selection-screen').classList.add('hidden');
    showSetupScreen();
  } catch(e) {
    toast('Failed to initialize new company workspace', 'error');
  }
};

window.deleteWorkspace = async function(dbName, companyName) {
  // Step 1: Normal confirmation
  if (!confirm(`WARNING: Are you sure you want to completely erase the workspace "${companyName}"?\n\nThis will permanently delete ALL invoices, inventory, and ledger history associated with it. This cannot be undone.`)) {
    return;
  }

  // Step 2: Typed constraint confirmation
  const typed = prompt(`To irrevocably authorize data destruction, please type the word DELETE below:`);
  if (typed !== 'DELETE') {
    toast('Workspace deletion cancelled (incorrect confirmation word).', 'info');
    return;
  }

  try {
    document.getElementById('company-selection-screen').innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--red-500)"><i class="bi bi-trash mr-2"></i> Trashing workspace...</div>';
    await api.app.deleteCompany(dbName);
    toast(`Workspace "${companyName}" has been permanently purged.`, 'success');
    
    // Refresh selection screen or gracefully fallback to new setup if empty
    const companies = await api.app.getCompanies();
    if (!companies || companies.length === 0) {
      document.getElementById('company-selection-screen').classList.add('hidden');
      await api.app.switchCompany('ms_billing.db');
      showSetupScreen();
    } else {
      showCompanySelectionScreen(companies);
    }
  } catch(err) {
    console.error(err);
    toast('Failed to delete workspace: ' + err.message, 'error');
    // Reload state if failed
    const companies = await api.app.getCompanies();
    showCompanySelectionScreen(companies);
  }
};

function checkLicenseStatus() {
  const storedLicense = localStorage.getItem('app_license_key');
  if (!storedLicense || !storedLicense.startsWith('MSB-')) return 'missing';
  
  const parts = storedLicense.split('-');
  if (parts.length < 3) return 'invalid';
  
  const dateStr = parts[1];
  if (dateStr.length !== 8) return 'invalid';
  
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  
  const expiryDate = new Date(year, month, day);
  const today = new Date();
  
  if (today > expiryDate) return 'expired';
  
  const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 7) return 'warning:' + daysLeft;
  
  return 'valid';
}

// ─── INIT ─────────────────────────────────────────────
async function init(skipLicense = false) {
  console.log("init() started");
  try {
    if (!skipLicense) {
      // Secure license.dat verification (offline) first.
      // If unsupported/unavailable, we fall back to legacy localStorage license checks.
      let license = null;
      try {
        license = await api.license.getStatus();
      } catch (e) {
        console.warn('license:getStatus failed, fallback to legacy check', e);
      }

      if (license?.supported && license?.state && license.state !== 'missing') {
        // Valid / warning
        if (license.state === 'valid') {
          // OK
        } else if (license.state === 'warning') {
          setTimeout(() => toast(`Warning: Your subscription expires in ${license.daysLeft} days!`, 'warning'), 1500);
        } else {
          const mid = await api.license.getMachineId();
          if (license.state === 'expired') {
            showLicenseScreen(mid, 'Subscription Expired - Payment Due', 'Your subscription payment is overdue. The software has been locked. Please activate again to regain access.');
          } else if (license.state === 'invalid_machine') {
            showLicenseScreen(mid, 'Machine Binding Mismatch', 'This license is not bound to this machine. Please contact support for a re-issue.');
          } else {
            showLicenseScreen(mid, 'Activation Required', 'Your premium license is invalid or expired. Please bind this device by entering your active activation key below.');
          }
          return;
        }
      } else if (license?.supported && license?.state === 'missing') {
        // keys exist but license.dat not found -> require activation
        const mid = await api.license.getMachineId();
        showLicenseScreen(mid, 'Activation Required', 'No valid offline license was found. Please activate your software using your activation key.');
        return;
      } else {
        // Fallback to legacy localStorage check.
        const hwid = await api.system.getHardwareId();
        const status = checkLicenseStatus();
        if (status === 'missing' || status === 'invalid') {
          showLicenseScreen(hwid, 'Activation Required', 'Your premium subscription check has failed or no license was found. Please bind this device by entering your active activation key below.');
          return;
        } else if (status === 'expired') {
          showLicenseScreen(hwid, 'Subscription Expired - Payment Due', 'Your subscription payment is overdue. The software has been locked. Please complete your payment and enter your renewed activation key to regain access.');
          return;
        } else if (status.startsWith('warning:')) {
          const d = status.split(':')[1];
          setTimeout(() => toast(`Warning: Your subscription expires in ${d} days!`, 'warning'), 1500);
        }
      }
    }

    const companies = await api.app.getCompanies();
    console.log("Found companies:", companies);
    if (!companies || companies.length === 0) {
      console.log("showing setup screen");
      await api.app.switchCompany('ms_billing.db');
      showSetupScreen();
    } else {
      console.log("showing company selection screen");
      showCompanySelectionScreen(companies);
    }
  } catch (err) {
    console.error("ERROR in init():", err);
    toast('Failed to initialize app. Please restart the software.', 'error');
  }
}

// ─── UX FEATURES (Dark Mode, Auto-Lock, Global Search, Shortcuts) ───
// 1. Dark Mode
const themeToggle = document.getElementById('dark-mode-toggle');
if (themeToggle) {
  const isDark = localStorage.getItem('theme') === 'dark';
  if (isDark) document.body.classList.add('dark-mode');
  themeToggle.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const darkNow = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', darkNow ? 'dark' : 'light');
    themeToggle.innerHTML = darkNow ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
  });
}

// 2. Auto-Lock (10 minutes)
let idleTime = 0;
const LOCK_TIMEOUT_MINS = 10;
const lockOverlay = document.getElementById('lock-screen-overlay');
const lockPwd = document.getElementById('lock-password');
const unlockBtn = document.getElementById('unlock-btn');
const lockError = document.getElementById('lock-error');

function resetIdleCounter() { idleTime = 0; }
window.addEventListener('mousemove', resetIdleCounter);
window.addEventListener('keydown', resetIdleCounter);
window.addEventListener('click', resetIdleCounter);
window.addEventListener('scroll', resetIdleCounter);

setInterval(() => {
  if (!currentUser) return; // Don't lock if not logged in
  idleTime++;
  if (idleTime >= LOCK_TIMEOUT_MINS && lockOverlay && lockOverlay.classList.contains('hidden')) {
    lockOverlay.classList.remove('hidden');
    document.getElementById('lock-screen-user').textContent = currentUser.name || currentUser.username;
    if (lockPwd) lockPwd.value = '';
    if (lockError) lockError.classList.add('hidden');
    if (lockPwd) lockPwd.focus();
  }
}, 60000); // Check every minute

unlockBtn?.addEventListener('click', async () => {
  const pwd = lockPwd.value;
  if (!pwd) return;
  const ok = await api.auth.verifyPassword(pwd);
  if (ok) {
    lockOverlay.classList.add('hidden');
    idleTime = 0;
  } else {
    lockError.classList.remove('hidden');
  }
});
lockPwd?.addEventListener('keydown', e => { if (e.key === 'Enter') unlockBtn.click(); });

// 3. Global Search & Shortcuts
const searchInput = document.getElementById('global-search');
const searchResults = document.getElementById('global-search-results');
let searchTimeout = null;

window.addEventListener('keydown', e => {
  if (e.key === 'F2') { e.preventDefault(); searchInput?.focus(); }
  if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); navigateTo('sales'); }
  if (e.key === 'F9') {
     const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('save') && b.closest('#page-content') !== null);
     if (saveBtn) { e.preventDefault(); saveBtn.click(); }
  }
});

searchInput?.addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) { searchResults.classList.add('hidden'); return; }
  searchTimeout = setTimeout(async () => {
    const res = await api.app.globalSearch(q);
    let html = '';
    if (res.customers.length) {
      html += '<div class="search-group-title">Customers</div>';
      res.customers.forEach(c => html += `<div class="search-item" onclick="navigateTo('customers')"><div class="search-item-title"><i class="bi bi-person"></i> ${escapeHtml(c.name)}</div><div class="search-item-sub">${escapeHtml(c.sub||'')}</div></div>`);
    }
    if (res.products.length) {
      html += '<div class="search-group-title">Products</div>';
      res.products.forEach(p => html += `<div class="search-item" onclick="navigateTo('products')"><div class="search-item-title"><i class="bi bi-box"></i> ${escapeHtml(p.name)}</div><div class="search-item-sub">${escapeHtml(p.sub||'')}</div></div>`);
    }
    if (res.invoices.length) {
      html += '<div class="search-group-title">Invoices</div>';
      res.invoices.forEach(i => html += `<div class="search-item" onclick="navigateTo('sales')"><div class="search-item-title"><i class="bi bi-receipt"></i> ${escapeHtml(i.name)}</div><div class="search-item-sub">${escapeHtml(i.sub||'')}</div></div>`);
    }
    if (!html) html = '<div class="search-item"><div class="search-item-sub text-center" style="padding:10px;">No results found</div></div>';
    searchResults.innerHTML = html;
    searchResults.classList.remove('hidden');
  }, 250);
});
document.addEventListener('click', e => { if (!e.target.closest('.search-bar')) searchResults?.classList.add('hidden'); });

// 4. Financial Year Check
async function checkFinancialYear() {
  const d = new Date();
  if (d.getMonth() >= 3) { // April or later (0-indexed, 3=April)
    const company = await api.company.get();
    if (company && company.fy_start) {
      const currentFyYear = new Date(company.fy_start).getFullYear();
      if (currentFyYear < d.getFullYear()) {
         const newFyStart = `${d.getFullYear()}-04-01`;
         const confirmed = await confirmModal('New Financial Year', `A new financial year has started. Do you want to roll over to Financial Year ${d.getFullYear()}-${d.getFullYear()+1}?`, 'Start New FY', 'info');
         if (confirmed) {
           await api.company.updateFY(newFyStart);
           toast('Rolled over to new Financial Year', 'success');
           if (typeof loadSetupForm === 'function' && document.getElementById('app-settings-tab')) {
               // if in settings page
           }
         }
      }
    }
  }
}

init();

window.showLicenseScreen = function(hwid, titleLabel = 'Activation Required', message = 'Please bind this device by entering your active activation key below.') {
  const existing = document.getElementById('license-overlay');
  if(existing) existing.remove();
  
  document.getElementById('company-selection-screen')?.classList.add('hidden');
  document.getElementById('setup-screen')?.classList.add('hidden');
  document.getElementById('app-screen')?.classList.add('hidden');
  
  const div = document.createElement('div');
  div.id = 'license-overlay';
  div.style.cssText = 'position:fixed;inset:0;background:#ffffff;z-index:99999;display:flex;font-family:"Poppins",sans-serif';
  div.innerHTML = `
    <!-- LEFT PANEL: Brand / Aesthetics -->
    <div style="flex:1;background:linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:80px;color:white">
      <!-- Decorative Orbs & Patterns -->
      <div style="position:absolute;top:-10%;left:-10%;width:60vw;height:60vw;background:radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);border-radius:50%"></div>
      <div style="position:absolute;bottom:-20%;right:-10%;width:50vw;height:50vw;background:radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%);border-radius:50%"></div>
      
      <!-- Abstract Graphic -->
      <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);background-size:30px 30px;opacity:0.3"></div>
      
      <div style="position:relative;z-index:2;max-width:480px">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:32px;border:1px solid rgba(255,255,255,0.1);margin-bottom:32px;box-shadow:0 10px 30px rgba(0,0,0,0.3)">
          <i class="bi bi-shield-lock-fill text-white"></i>
        </div>
        <h1 style="font-size:42px;font-weight:700;line-height:1.2;margin-bottom:20px;letter-spacing:-1px">Relyce Book<br/><span style="color:#a5b4fc">Premium Edition</span></h1>
        <p style="font-size:16px;color:#94a3b8;line-height:1.7;font-weight:400;margin-bottom:40px">
          The ultimate GST billing, inventory, and accounting solution. Please authenticate your device to access your business workspaces.
        </p>
        
        <div style="display:flex;align-items:center;gap:12px;color:#cbd5e1;font-size:14px;font-weight:500;margin-bottom:12px">
           <i class="bi bi-check-circle-fill" style="color:#818cf8"></i> Encrypted Local Storage
        </div>
        <div style="display:flex;align-items:center;gap:12px;color:#cbd5e1;font-size:14px;font-weight:500;margin-bottom:12px">
           <i class="bi bi-check-circle-fill" style="color:#f472b6"></i> Multi-Company Support
        </div>
        <div style="display:flex;align-items:center;gap:12px;color:#cbd5e1;font-size:14px;font-weight:500">
           <i class="bi bi-check-circle-fill" style="color:#34d399"></i> Seamless Offline Architecture
        </div>
      </div>
    </div>
    
    <!-- RIGHT PANEL: Form -->
    <div style="width:100%;max-width:600px;background:#ffffff;display:flex;flex-direction:column;justify-content:center;padding:60px 80px;position:relative;box-shadow:-20px 0 50px rgba(0,0,0,0.05)">
      
      <div style="margin-bottom:40px">
        <h2 style="font-size:28px;font-weight:700;color:#0f172a;margin:0 0 8px 0;letter-spacing:-0.5px">Software Licensing</h2>
        <p style="color:#ef4444;font-size:13px;font-weight:600;margin:0;letter-spacing:0.5px;text-transform:uppercase">${escapeHtml(titleLabel)}</p>
      </div>
      
      <p style="color:#64748b;font-size:14px;margin-bottom:40px;line-height:1.6">${escapeHtml(message)}</p>
      
        <div style="margin-bottom:24px">
        <label style="font-size:12px;font-weight:700;color:#475569;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;display:block">Machine Fingerprint</label>
        <div style="display:flex;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;transition:all 0.2s" id="hwid-container">
          <div style="padding:14px 16px;color:#94a3b8;border-right:1px solid #e2e8f0"><i class="bi bi-pc-display"></i></div>
          <input type="text" id="license-hwid" readonly value="${escapeHtml(hwid)}" style="background:transparent;border:none;font-family:monospace;font-size:14px;flex:1;padding:14px;color:#334155;outline:none" />
          <button style="background:transparent;border:none;border-left:1px solid #e2e8f0;padding:0 20px;color:#6366f1;font-weight:600;font-size:13px;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='transparent'" onclick="navigator.clipboard.writeText(document.getElementById('license-hwid').value);toast('HWID Copied!', 'success')" title="Copy HWID">Copy</button>
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-top:8px"><i class="bi bi-info-circle mr-1"></i> Send this code to support to generate your key.</div>
      </div>
      
      <div style="margin-bottom:40px">
        <label style="font-size:12px;font-weight:700;color:#475569;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;display:block">Activation Key</label>
        <input type="text" id="license-key-input" placeholder="MSB-YYYYMMDD-XXXX" style="width:100%;background:#ffffff;border:2px solid #e2e8f0;border-radius:12px;font-family:monospace;font-size:16px;letter-spacing:1px;padding:16px;color:#0f172a;outline:none;transition:all 0.2s" onfocus="this.style.borderColor='#6366f1';this.style.boxShadow='0 0 0 4px rgba(99,102,241,0.1)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'" />
      </div>
      
      <button style="width:100%;padding:16px;background:#6366f1;color:white;border:none;border-radius:12px;font-weight:600;font-size:16px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 6px -1px rgba(99,102,241,0.2), 0 2px 4px -1px rgba(99,102,241,0.1)" onmouseover="this.style.background='#4f46e5';this.style.transform='translateY(-1px)';this.style.boxShadow='0 10px 15px -3px rgba(99,102,241,0.3)'" onmouseout="this.style.background='#6366f1';this.style.transform='none';this.style.boxShadow='0 4px 6px -1px rgba(99,102,241,0.2)'" onmousedown="this.style.transform='scale(0.99)'" onclick="verifyLicense()">
        <i class="bi bi-unlock-fill mr-2"></i> Activate Software
      </button>
      
      <div style="margin-top:auto;padding-top:40px;text-align:center">
        <button style="background:transparent;border:none;color:#94a3b8;font-size:13px;font-weight:500;cursor:pointer;transition:color 0.2s" onmouseover="this.style.color='#64748b'" onmouseout="this.style.color='#94a3b8'" onclick="skipLicenseTestMode()">Continue in Developer Bypass Mode &rarr;</button>
      </div>
      
    </div>
  `;
  document.body.appendChild(div);
};

window.skipLicenseTestMode = function() {
  const existing = document.getElementById('license-overlay');
  if(existing) existing.remove();
  toast('Entered Developer Test Mode', 'info');
  init(true);
};

window.verifyLicense = function() {
  const key = document.getElementById('license-key-input').value.trim();
  const parts = key.split('-');
  
  if (key.startsWith('MSB-') && parts.length >= 3 && parts[1].length === 8) {
    const dateStr = parts[1];
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      toast('Invalid Activation Format!', 'error');
      return;
    }
    
    const expiry = new Date(year, month, day);
    if (new Date() > expiry) {
      toast('Error: This key has already expired!', 'error');
      return;
    }
    
    // Try secure online activation first (server validates + returns signed license.dat).
    // If server is not configured, fall back to legacy localStorage activation.
    api.license.activateOnline(key)
      .then(() => {
        document.getElementById('license-overlay').remove();
        toast('License activated successfully!', 'success');
        init();
      })
      .catch((e) => {
        const code = e?.code || e?.message;
        if (code === 'server_not_configured') {
          localStorage.setItem('app_license_key', key);
          document.getElementById('license-overlay').remove();
          toast('License activated in legacy mode (server not configured).', 'warning');
          init();
        } else {
          toast(e?.message || 'Activation failed. Please try again.', 'error');
        }
      });
  } else {
    toast('Invalid License Key format. Example: MSB-20271231-A1B2', 'error');
  }
};

