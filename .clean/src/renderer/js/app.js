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
  stock:'Stock Management', reports:'Reports', settings:'Settings',
  users:'User Management', backup:'Backup & Restore', logs:'Activity Log'
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
            <select class="form-control" id="s-biztype">
              <option value="retail">Retail (Products)</option>
              <option value="service">Service (Services)</option>
            </select>
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

    await api.company.save({
      name, owner: document.getElementById('s-owner').value,
      address: document.getElementById('s-address').value,
      phone: document.getElementById('s-phone').value,
      email: document.getElementById('s-email').value,
      gst_no: document.getElementById('s-gst').value,
      pan_no: document.getElementById('s-pan').value,
      state: document.getElementById('s-state').value,
      invoice_prefix: document.getElementById('s-prefix').value || 'INV',
      business_type: document.getElementById('s-biztype').value || 'retail',
      fy_start: document.getElementById('s-fy').value,
      logo: logoBase64
    });
    document.getElementById('setup-screen').classList.add('hidden');
    showLoginScreen();
  } catch (error) {
    console.error('Setup save failed:', error);
    toast(error?.message || 'Failed to save setup details', 'error');
  }
};

// ─── LOGIN SCREEN ─────────────────────────────────────
function showLoginScreen() {
  const screen = document.getElementById('login-screen');
  screen.innerHTML = `
    <div class="login-card">
      <div class="login-logo">
        <div class="brand-circle">₹</div>
        <h2>Relyce Book</h2>
        <p>Sign in to your account</p>
      </div>
      <div class="login-fields">
        <div class="form-group"><label class="form-label">Username</label><input class="form-control" id="l-user" value="admin" autofocus /></div>
        <div class="form-group"><label class="form-label">Password</label><input class="form-control" id="l-pass" type="password" value="admin123" /></div>
        <button class="btn btn-primary w-full" style="padding:11px" onclick="doLogin()">Login →</button>
        <div style="text-align:center;font-size:12px;color:var(--gray-400)">Default: admin / admin123</div>
      </div>
    </div>`;
  screen.classList.remove('hidden');
  document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key==='Enter') window.doLogin(); });
}

window.doLogin = async function() {
  try {
    const username = document.getElementById('l-user').value.trim();
    const password = document.getElementById('l-pass').value;
    const user = await api.auth.login({ username, password });
    if (!user) { toast('Invalid credentials', 'error'); return; }
    currentUser = user;
    
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name[0].toUpperCase();
    document.getElementById('user-role').textContent = user.role === 'admin' ? 'Administrator' : 'Staff';
    
    const co = await api.company.get();
    if (co) {
      document.getElementById('topbar-company').innerHTML = `<i class="bi bi-building" style="margin-right:5px"></i>${escapeHtml(co.name)}`;
    }

    // Use install-time business type directly (no extra mode selection step).
    window.currentAppMode = co?.business_type === 'service' ? 'service' : 'retail';

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    applyAppMode();
    navigateTo('dashboard');
  } catch (error) {
    console.error('Login failed:', error);
    toast(error?.message || 'Login failed due to connection or system error', 'error');
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
  document.querySelectorAll('.nav-item').forEach(el => {
    const page = el.dataset.page;
    let show = true;
    if (mode === 'service') {
      // Service workflow: hide stock-heavy and dispatch-oriented sections.
      if (['stock', 'delivery-note'].includes(page)) show = false;
    }
    el.style.display = show ? 'flex' : 'none';
  });
};

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    navigateTo(el.dataset.page);
    if (window.innerWidth <= 992) document.getElementById('app-shell').classList.remove('sidebar-open');
  });
});
document.getElementById('btn-logout').addEventListener('click', () => {
  currentUser = null;
  document.getElementById('app-shell').classList.add('hidden');
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

// ─── INIT ─────────────────────────────────────────────
async function init() {
  console.log("init() started");
  try {
    const company = await api.company.get();
    console.log("api.company.get() result:", company);
    if (!company) {
      console.log("showing setup screen");
      showSetupScreen();
    } else {
      console.log("showing login screen");
      showLoginScreen();
    }
  } catch (err) {
    console.error("ERROR in init():", err);
    toast('Failed to initialize app. Please restart the software.', 'error');
  }
}
init();

