const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

// Separate dev database from production database
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'ms-billing-software-dev'));
}

// Database
let db;
let activeDbName = 'ms_billing.db';

function getDb() {
  if (!db) {
    const Database = require('better-sqlite3');
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, activeDbName);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(database) {
  const schema = require('./src/db/schema');
  schema.createTables(database);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      sandbox: true,
      allowRunningInsecureContent: false
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, 'assets', 'relyce_logo.ico'),
    show: false
  });

  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow only blank popup windows for safe print previews from renderer.
    if (url === 'about:blank') {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  return win;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `pbkdf2$120000$${salt}$${hash}`;
}

function verifyPassword(storedPassword, inputPassword) {
  if (!storedPassword || typeof storedPassword !== 'string') return false;
  if (!storedPassword.startsWith('pbkdf2$')) {
    return storedPassword === inputPassword;
  }
  const parts = storedPassword.split('$');
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expected = parts[3];
  if (!iterations || !salt || !expected) return false;
  const actual = crypto.pbkdf2Sync(inputPassword, salt, iterations, 32, 'sha256').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nonNegative(value) {
  return Math.max(0, toFiniteNumber(value, 0));
}

function isPhysicalProduct(d, productId) {
  if (!productId) return false;
  const row = d.prepare('SELECT is_service FROM products WHERE id=?').get(productId);
  return !row || !Number(row.is_service);
}

function getProductUsage(d, productId) {
  const refs = [
    { label: 'Sales', count: d.prepare('SELECT COUNT(*) as c FROM sales_items WHERE product_id=?').get(productId)?.c || 0 },
    { label: 'Purchase', count: d.prepare('SELECT COUNT(*) as c FROM purchase_items WHERE product_id=?').get(productId)?.c || 0 },
    { label: 'Quotation', count: d.prepare('SELECT COUNT(*) as c FROM quotation_items WHERE product_id=?').get(productId)?.c || 0 },
    { label: 'Credit Notes', count: d.prepare('SELECT COUNT(*) as c FROM credit_note_items WHERE product_id=?').get(productId)?.c || 0 },
    { label: 'Debit Notes', count: d.prepare('SELECT COUNT(*) as c FROM debit_note_items WHERE product_id=?').get(productId)?.c || 0 },
    { label: 'Delivery Notes', count: d.prepare('SELECT COUNT(*) as c FROM delivery_note_items WHERE product_id=?').get(productId)?.c || 0 },
  ];
  const total = refs.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  return { total, refs };
}

function compareVersions(a, b) {
  const pa = String(a || '').split('.').map((v) => parseInt(v, 10) || 0);
  const pb = String(b || '').split('.').map((v) => parseInt(v, 10) || 0);
  const max = Math.max(pa.length, pb.length);
  for (let i = 0; i < max; i += 1) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function fetchJson(url, timeoutMs = 12000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string') {
      reject(new Error('Update manifest URL is missing'));
      return;
    }
    if (redirects > 3) {
      reject(new Error('Too many redirects while checking updates'));
      return;
    }
    let timedOut = false;
    const req = https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        res.resume();
        fetchJson(nextUrl, timeoutMs, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Update server responded with status ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (timedOut) return;
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Invalid update manifest format'));
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      timedOut = true;
      req.destroy(new Error('Update check timed out'));
    });
    req.on('error', (err) => reject(err));
  });
}

app.whenReady().then(() => {
  getDb(); // Initialize DB on startup
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  autoUpdater.checkForUpdatesAndNotify();
});

// When update is found
autoUpdater.on("update-available", () => {
  console.log("Update available...");
});

autoUpdater.on("download-progress", (progress) => {
  console.log(`Download progress: ${progress.percent}%`);
});

// When update is downloaded
autoUpdater.on("update-downloaded", () => {
  const result = dialog.showMessageBoxSync({
    type: "info",
    title: "Update Ready",
    message: "New version downloaded. Restart now to install?",
    buttons: ["Yes", "Later"]
  });

  if (result === 0) {
    autoUpdater.quitAndInstall();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC HANDLERS & SECURITY PROTOCOLS
// ─────────────────────────────────────────────────────────────────────────────

let currentSession = null;

function requireAdmin(channel) {
  if (!currentSession || currentSession.role !== 'admin') {
    throw new Error(`Unauthorized access to ${channel}. Admin privileges required.`);
  }
}

const loginAttempts = new Map();
const MAX_PASSWORD_LENGTH = 128;

function checkLoginAttempt(username) {
  const attempts = loginAttempts.get(username);
  if (attempts && attempts.lockedUntil) {
    if (Date.now() < attempts.lockedUntil) {
      const remainingMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      throw new Error(`Account locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`);
    } else {
      loginAttempts.delete(username);
    }
  }
}

function recordLoginFailure(username) {
  let attempts = loginAttempts.get(username) || { count: 0, lockedUntil: null };
  attempts.count += 1;
  if (attempts.count >= 5) {
    attempts.lockedUntil = Date.now() + 5 * 60000;
  }
  loginAttempts.set(username, attempts);
}

function clearLoginAttempts(username) {
  loginAttempts.delete(username);
}

// Company
ipcMain.handle('company:get', () => {
  const d = getDb();
  return d.prepare('SELECT * FROM company LIMIT 1').get() || null;
});
ipcMain.handle('company:save', (_, data) => {
  const d = getDb();
  const exists = d.prepare('SELECT id FROM company LIMIT 1').get();
  if (exists) {
    return d.prepare(`UPDATE company SET name=?,owner=?,address=?,phone=?,email=?,gst_no=?,pan_no=?,state=?,invoice_prefix=?,fy_start=?,logo=?,business_type=?,qr_billing=?,terms_conditions=?,invoice_template=?,custom_template_html=? WHERE id=?`)
      .run(data.name,data.owner,data.address,data.phone,data.email,data.gst_no,data.pan_no,data.state,data.invoice_prefix,data.fy_start,data.logo,data.business_type||'retail',data.qr_billing||0,data.terms_conditions||'',data.invoice_template||'standard',data.custom_template_html||'',exists.id);
  } else {
    return d.prepare(`INSERT INTO company (name,owner,address,phone,email,gst_no,pan_no,state,invoice_prefix,fy_start,logo,business_type,qr_billing,terms_conditions,invoice_template,custom_template_html) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(data.name,data.owner,data.address,data.phone,data.email,data.gst_no,data.pan_no,data.state,data.invoice_prefix,data.fy_start,data.logo,data.business_type||'retail',data.qr_billing||0,data.terms_conditions||'',data.invoice_template||'standard',data.custom_template_html||'');
  }
});

// Users / Auth
ipcMain.handle('users:getAll', () => getDb().prepare('SELECT id,name,username,role,active FROM users ORDER BY name').all());
ipcMain.handle('users:add', (_, u) => {
  requireAdmin('users:add');
  const d = getDb();
  if (!u || !u.name || !u.username || !u.password) throw new Error('Missing required user fields');
  if (String(u.password).length > MAX_PASSWORD_LENGTH) throw new Error('Password exceeds maximum length');
  const hashed = hashPassword(String(u.password));
  return d.prepare('INSERT INTO users (name,username,password,role,active) VALUES (?,?,?,?,1)')
    .run(String(u.name).trim(), String(u.username).trim(), hashed, u.role === 'admin' ? 'admin' : 'staff');
});
ipcMain.handle('users:update', (_, u) => {
  requireAdmin('users:update');
  const d = getDb();
  if (!u || !u.id || !u.name || !u.username) throw new Error('Missing required user fields');
  const active = Number(u.active) ? 1 : 0;
  if (u.password) {
    if (String(u.password).length > MAX_PASSWORD_LENGTH) throw new Error('Password exceeds maximum length');
    const hashed = hashPassword(String(u.password));
    return d.prepare('UPDATE users SET name=?,username=?,password=?,role=?,active=? WHERE id=?')
      .run(String(u.name).trim(), String(u.username).trim(), hashed, u.role === 'admin' ? 'admin' : 'staff', active, u.id);
  }
  return d.prepare('UPDATE users SET name=?,username=?,role=?,active=? WHERE id=?')
    .run(String(u.name).trim(), String(u.username).trim(), u.role === 'admin' ? 'admin' : 'staff', active, u.id);
});
ipcMain.handle('users:delete', (_, id) => {
  requireAdmin('users:delete');
  return getDb().prepare('DELETE FROM users WHERE id=?').run(id);
});
ipcMain.handle('auth:login', (_, {username, password}) => {
  const uname = String(username || '').trim();
  const pwd = String(password || '');
  if (pwd.length > MAX_PASSWORD_LENGTH) throw new Error('Password exceeds maximum length');
  
  checkLoginAttempt(uname);

  const d = getDb();
  const user = d.prepare('SELECT * FROM users WHERE username=? AND active=1').get(uname);
  if (!user) {
    recordLoginFailure(uname);
    return null;
  }

  const ok = verifyPassword(user.password, pwd);
  if (!ok) {
    recordLoginFailure(uname);
    return null;
  }

  // Transparent migration from legacy plain-text passwords to hashed passwords.
  if (typeof user.password === 'string' && !user.password.startsWith('pbkdf2$')) {
    const hashed = hashPassword(pwd);
    d.prepare('UPDATE users SET password=? WHERE id=?').run(hashed, user.id);
  }

  clearLoginAttempts(uname); // FIX 3: reset counter on success
  currentSession = { id: user.id, name: user.name, role: user.role }; // FIX 1: set session
  return { id: user.id, name: user.name, role: user.role };
});

ipcMain.handle('auth:verifyPassword', (_, pwd) => {
  if (!currentSession) return false;
  const d = getDb();
  const user = d.prepare('SELECT password FROM users WHERE id=? AND active=1').get(currentSession.id);
  if (!user) return false;
  return verifyPassword(user.password, String(pwd || ''));
});

// Global Search
ipcMain.handle('app:globalSearch', (_, q) => {
  if (!q || q.length < 2) return { customers: [], products: [], invoices: [] };
  const d = getDb();
  const search = `%${q}%`;
  
  const customers = d.prepare('SELECT id, name, phone as sub FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 5').all(search, search);
  const products = d.prepare('SELECT id, name, code as sub FROM products WHERE name LIKE ? OR code LIKE ? LIMIT 5').all(search, search);
  const invoices = d.prepare('SELECT id, invoice_no as name, customer_name as sub FROM sales_invoices WHERE invoice_no LIKE ? OR customer_name LIKE ? LIMIT 5').all(search, search);
  
  return { customers, products, invoices };
});

// FIX 1: Logout — clear server-side session
ipcMain.handle('auth:logout', () => {
  currentSession = null;
  return true;
});

// Customers
ipcMain.handle('customers:getAll', () => getDb().prepare('SELECT * FROM customers ORDER BY name').all());
ipcMain.handle('customers:add', (_, c) => {
  return getDb().prepare('INSERT INTO customers (name,gst_no,phone,email,address,state,credit_limit,opening_balance) VALUES (?,?,?,?,?,?,?,?)')
    .run(c.name,c.gst_no||'',c.phone||'',c.email||'',c.address||'',c.state||'',c.credit_limit||0,c.opening_balance||0);
});
ipcMain.handle('customers:update', (_, c) => {
  return getDb().prepare('UPDATE customers SET name=?,gst_no=?,phone=?,email=?,address=?,state=?,credit_limit=?,opening_balance=? WHERE id=?')
    .run(c.name,c.gst_no||'',c.phone||'',c.email||'',c.address||'',c.state||'',c.credit_limit||0,c.opening_balance||0,c.id);
});
ipcMain.handle('customers:delete', (_, id) => getDb().prepare('DELETE FROM customers WHERE id=?').run(id));
ipcMain.handle('customers:getOutstanding', (_, id) => {
  const d = getDb();
  const c = d.prepare('SELECT opening_balance, credit_limit FROM customers WHERE id=?').get(id);
  if (!c) return { outstanding_balance: 0, credit_limit: 0 };
  const sales = d.prepare(`SELECT SUM(total) as amount FROM sales_invoices WHERE customer_id=? AND status IN ('Unpaid', 'Partial')`).get(id);
  return {
    outstanding_balance: (c.opening_balance || 0) + (sales.amount || 0),
    credit_limit: c.credit_limit || 0
  };
});

// Suppliers
ipcMain.handle('suppliers:getAll', () => getDb().prepare('SELECT * FROM suppliers ORDER BY name').all());
ipcMain.handle('suppliers:add', (_, s) => {
  return getDb().prepare('INSERT INTO suppliers (name,gst_no,phone,address,state,opening_balance) VALUES (?,?,?,?,?,?)')
    .run(s.name,s.gst_no||'',s.phone||'',s.address||'',s.state||'',s.opening_balance||0);
});
ipcMain.handle('suppliers:update', (_, s) => {
  return getDb().prepare('UPDATE suppliers SET name=?,gst_no=?,phone=?,address=?,state=?,opening_balance=? WHERE id=?')
    .run(s.name,s.gst_no||'',s.phone||'',s.address||'',s.state||'',s.opening_balance||0,s.id);
});
ipcMain.handle('suppliers:delete', (_, id) => getDb().prepare('DELETE FROM suppliers WHERE id=?').run(id));

// Categories
ipcMain.handle('categories:getAll', () => getDb().prepare('SELECT * FROM categories ORDER BY name').all());
ipcMain.handle('categories:add', (_, name) => getDb().prepare('INSERT INTO categories (name) VALUES (?)').run(name));
ipcMain.handle('categories:delete', (_, id) => getDb().prepare('DELETE FROM categories WHERE id=?').run(id));

// Products
ipcMain.handle('products:getAll', () => {
  return getDb().prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.name`).all();
});
ipcMain.handle('products:add', (_, p) => {
  return getDb().prepare('INSERT INTO products (name,code,category_id,hsn_code,gst_percent,purchase_price,selling_price,unit,stock,min_stock,is_service,mrp,batch_no,mfg_date,expiry_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(p.name,p.code||'',p.category_id||null,p.hsn_code||'',p.gst_percent||0,p.purchase_price||0,p.selling_price||0,p.unit||'Nos',p.stock||0,p.min_stock||0,p.is_service?1:0,p.mrp||0,p.batch_no||'',p.mfg_date||'',p.expiry_date||'');
});
ipcMain.handle('products:update', (_, p) => {
  return getDb().prepare('UPDATE products SET name=?,code=?,category_id=?,hsn_code=?,gst_percent=?,purchase_price=?,selling_price=?,unit=?,min_stock=?,is_service=?,mrp=?,batch_no=?,mfg_date=?,expiry_date=? WHERE id=?')
    .run(p.name,p.code||'',p.category_id||null,p.hsn_code||'',p.gst_percent||0,p.purchase_price||0,p.selling_price||0,p.unit||'Nos',p.min_stock||0,p.is_service?1:0,p.mrp||0,p.batch_no||'',p.mfg_date||'',p.expiry_date||'',p.id);
});
ipcMain.handle('products:delete', (_, id) => {
  const d = getDb();
  const product = d.prepare('SELECT id,name FROM products WHERE id=?').get(id);
  if (!product) throw new Error('Product not found');

  const usage = getProductUsage(d, id);
  if (usage.total > 0) {
    const whereUsed = usage.refs
      .filter((entry) => entry.count > 0)
      .map((entry) => `${entry.label} (${entry.count})`)
      .join(', ');
    throw new Error(`Cannot delete "${product.name}". It is used in: ${whereUsed}.`);
  }

  try {
    return d.prepare('DELETE FROM products WHERE id=?').run(id);
  } catch (error) {
    if (String(error?.message || '').includes('FOREIGN KEY constraint failed')) {
      throw new Error(`Cannot delete "${product.name}" because it is linked to existing records.`);
    }
    throw error;
  }
});
ipcMain.handle('products:updateStock', (_, {id, qty}) => {
  return getDb().prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(qty, id);
});
ipcMain.handle('products:getLowStock', () => {
  return getDb().prepare('SELECT * FROM products WHERE stock <= min_stock ORDER BY stock').all();
});

// Ledger Groups
ipcMain.handle('ledgerGroups:getAll', () => getDb().prepare('SELECT * FROM ledger_groups ORDER BY name').all());

// Ledgers
ipcMain.handle('ledgers:getAll', () => {
  return getDb().prepare('SELECT l.*, lg.name as group_name FROM ledgers l LEFT JOIN ledger_groups lg ON l.group_id=lg.id ORDER BY l.name').all();
});
ipcMain.handle('ledgers:add', (_, l) => {
  return getDb().prepare('INSERT INTO ledgers (name,group_id,opening_balance,balance_type) VALUES (?,?,?,?)')
    .run(l.name,l.group_id,l.opening_balance||0,l.balance_type||'Dr');
});
ipcMain.handle('ledgers:update', (_, l) => {
  return getDb().prepare('UPDATE ledgers SET name=?,group_id=?,opening_balance=?,balance_type=? WHERE id=?')
    .run(l.name,l.group_id,l.opening_balance||0,l.balance_type||'Dr',l.id);
});
ipcMain.handle('ledgers:delete', (_, id) => getDb().prepare('DELETE FROM ledgers WHERE id=?').run(id));
ipcMain.handle('ledgers:getTransactions', (_, id) => {
  return getDb().prepare('SELECT * FROM ledger_transactions WHERE ledger_id=? ORDER BY date DESC').all(id);
});

// Daily Funds / Daybook
ipcMain.handle('dailyFunds:getAll', () => {
  return getDb().prepare('SELECT * FROM daily_funds ORDER BY date DESC, id DESC').all();
});
ipcMain.handle('dailyFunds:add', (_, data) => {
  const d = getDb();
  const saveDaybook = d.transaction(() => {
    const credit = nonNegative(data.credit);
    const debit = nonNegative(data.debit);
    if (!data.date) throw new Error('Date is required');
    if (!String(data.description || '').trim()) throw new Error('Description is required');
    if (credit <= 0 && debit <= 0) throw new Error('Credit or debit amount is required');
    if (credit > 0 && debit > 0) throw new Error('Only one of credit/debit can be entered');

    const result = d.prepare('INSERT INTO daily_funds (date,description,credit,debit,party_id,party_type,party_name) VALUES (?,?,?,?,?,?,?)')
      .run(
        String(data.date),
        String(data.description || '').trim(),
        credit,
        debit,
        data.party_id || null,
        String(data.party_type || ''),
        String(data.party_name || '')
      );

    if (data.copy_to_party && data.party_id && (data.party_type === 'Customer' || data.party_type === 'Supplier')) {
      const groupName = data.party_type === 'Customer' ? 'Customers' : 'Suppliers';
      const group = d.prepare('SELECT id FROM ledger_groups WHERE name=? LIMIT 1').get(groupName);
      if (group) {
        const ledgerName = String(data.party_name || '').trim();
        let ledger = d.prepare('SELECT id FROM ledgers WHERE name=? AND group_id=? LIMIT 1').get(ledgerName, group.id);
        if (!ledger) {
          const created = d.prepare('INSERT INTO ledgers (name,group_id,opening_balance,balance_type) VALUES (?,?,?,?)')
            .run(
              ledgerName || `${data.party_type} ${data.party_id}`,
              group.id,
              0,
              data.party_type === 'Customer' ? 'Dr' : 'Cr'
            );
          ledger = { id: created.lastInsertRowid };
        }

        d.prepare('INSERT INTO ledger_transactions (ledger_id,date,type,debit,credit,narration,ref_no) VALUES (?,?,?,?,?,?,?)')
          .run(
            ledger.id,
            String(data.date),
            credit > 0 ? 'Fund In' : 'Fund Out',
            debit > 0 ? debit : 0,
            credit > 0 ? credit : 0,
            `Daybook: ${String(data.description || '').trim()}`,
            `DF-${result.lastInsertRowid}`
          );
      }
    }
    return result;
  });
  return saveDaybook();
});
ipcMain.handle('dailyFunds:delete', (_, id) => {
  return getDb().prepare('DELETE FROM daily_funds WHERE id=?').run(id);
});

// Financial Years
ipcMain.handle('financialYears:getAll', () => getDb().prepare('SELECT * FROM financial_years ORDER BY start_date DESC').all());
ipcMain.handle('financialYears:getCurrent', () => getDb().prepare('SELECT * FROM financial_years WHERE is_current=1 LIMIT 1').get());
ipcMain.handle('financialYears:add', (_, fy) => {
  const d = getDb();
  d.prepare('UPDATE financial_years SET is_current=0').run();
  return d.prepare('INSERT INTO financial_years (label,start_date,end_date,is_current) VALUES (?,?,?,1)')
    .run(fy.label, fy.start_date, fy.end_date);
});
ipcMain.handle('company:updateFY', (_, fy_start) => {
  requireAdmin('company:updateFY');
  const d = getDb();
  return d.prepare('UPDATE company SET fy_start=?').run(fy_start);
});

// Sales Invoice
ipcMain.handle('sales:getNextNumber', () => {
  const d = getDb();
  const company = d.prepare('SELECT invoice_prefix FROM company LIMIT 1').get();
  const prefix = (company && company.invoice_prefix) ? company.invoice_prefix : 'INV';
  const last = d.prepare("SELECT invoice_no FROM sales_invoices ORDER BY id DESC LIMIT 1").get();
  let num = 1;
  if (last) {
    const match = last.invoice_no.match(/(\d+)$/);
    if (match) num = parseInt(match[1]) + 1;
  }
  return `${prefix}-${String(num).padStart(4,'0')}`;
});
ipcMain.handle('sales:getAll', () => {
  return getDb().prepare('SELECT s.*, c.name as customer_name FROM sales_invoices s LEFT JOIN customers c ON s.customer_id=c.id ORDER BY s.date DESC').all();
});
ipcMain.handle('sales:getById', (_, id) => {
  const d = getDb();
  const inv = d.prepare('SELECT s.*, c.name as customer_name, c.gst_no as customer_gst, c.address as customer_address, c.state as customer_state FROM sales_invoices s LEFT JOIN customers c ON s.customer_id=c.id WHERE s.id=?').get(id);
  if (inv) inv.items = d.prepare('SELECT * FROM sales_items WHERE invoice_id=?').all(id);
  return inv;
});
ipcMain.handle('sales:save', (_, {invoice, items}) => {
  const d = getDb();
  if (!invoice || !invoice.invoice_no || !invoice.date) throw new Error('Invoice number and date are required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one invoice item is required');
  const saveInvoice = d.transaction(() => {
    const isUpdate = Boolean(invoice.id);
    const invId = invoice.id;

    if (isUpdate) {
      const oldItems = d.prepare('SELECT * FROM sales_items WHERE invoice_id=?').all(invId);
      for (const item of oldItems) {
        if (isPhysicalProduct(d, item.product_id)) d.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(item.qty, item.product_id);
      }
      d.prepare(`UPDATE sales_invoices
                 SET invoice_no=?, date=?, customer_id=?, sub_total=?, discount=?, taxable_amount=?, cgst=?, sgst=?, total=?, payment_mode=?, notes=?, status=?
                 WHERE id=?`)
        .run(
          String(invoice.invoice_no).trim(),
          String(invoice.date),
          invoice.customer_id || null,
          nonNegative(invoice.sub_total),
          nonNegative(invoice.discount),
          nonNegative(invoice.taxable_amount),
          nonNegative(invoice.cgst),
          nonNegative(invoice.sgst),
          nonNegative(invoice.total),
          String(invoice.payment_mode || 'Cash'),
          String(invoice.notes || ''),
          'Paid',
          invId
        );
      d.prepare('DELETE FROM sales_items WHERE invoice_id=?').run(invId);
    } else {
      const result = d.prepare(`INSERT INTO sales_invoices (invoice_no,date,customer_id,sub_total,discount,taxable_amount,cgst,sgst,total,payment_mode,notes,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(
          String(invoice.invoice_no).trim(),
          String(invoice.date),
          invoice.customer_id || null,
          nonNegative(invoice.sub_total),
          nonNegative(invoice.discount),
          nonNegative(invoice.taxable_amount),
          nonNegative(invoice.cgst),
          nonNegative(invoice.sgst),
          nonNegative(invoice.total),
          String(invoice.payment_mode || 'Cash'),
          String(invoice.notes || ''),
          'Paid'
        );
      invoice.id = result.lastInsertRowid;
    }

    const finalInvoiceId = invoice.id;
    for (const item of items) {
      const qty = nonNegative(item.qty);
      const price = nonNegative(item.price);
      const amount = nonNegative(item.amount);
      if (!item.product_name || qty <= 0) throw new Error('Invalid invoice item');
      d.prepare('INSERT INTO sales_items (invoice_id,product_id,product_name,hsn_code,qty,unit,price,discount,gst_percent,cgst,sgst,amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(
          finalInvoiceId,
          item.product_id || null,
          String(item.product_name),
          String(item.hsn_code || ''),
          qty,
          String(item.unit || 'Nos'),
          price,
          nonNegative(item.discount),
          nonNegative(item.gst_percent),
          nonNegative(item.cgst),
          nonNegative(item.sgst),
          amount
        );
      // Only reduce stock for physical products (not services)
      if (!item.is_service && isPhysicalProduct(d, item.product_id)) d.prepare('UPDATE products SET stock = stock - ? WHERE id=?').run(qty, item.product_id);
    }
    d.prepare('INSERT INTO activity_logs (action,description,created_at) VALUES (?,?,?)')
      .run(isUpdate ? 'SALE_UPDATED' : 'SALE_CREATED', `Invoice ${invoice.invoice_no} ${isUpdate ? 'updated' : 'created'}`, new Date().toISOString());
    return finalInvoiceId;
  });
  return saveInvoice();
});
ipcMain.handle('sales:delete', (_, id) => {
  const d = getDb();
  d.transaction(() => {
    const items = d.prepare('SELECT * FROM sales_items WHERE invoice_id=?').all(id);
    for (const item of items) {
      if (isPhysicalProduct(d, item.product_id)) d.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(item.qty, item.product_id);
    }
    d.prepare('DELETE FROM sales_items WHERE invoice_id=?').run(id);
    d.prepare('DELETE FROM sales_invoices WHERE id=?').run(id);
  })();
});

// Purchase Bills
ipcMain.handle('purchase:getNextNumber', () => {
  const last = getDb().prepare("SELECT bill_no FROM purchase_bills ORDER BY id DESC LIMIT 1").get();
  let num = 1;
  if (last) { const m = last.bill_no.match(/(\d+)$/); if (m) num = parseInt(m[1])+1; }
  return `PUR-${String(num).padStart(4,'0')}`;
});
ipcMain.handle('purchase:getAll', () => {
  return getDb().prepare('SELECT p.*, s.name as supplier_name FROM purchase_bills p LEFT JOIN suppliers s ON p.supplier_id=s.id ORDER BY p.date DESC').all();
});
ipcMain.handle('purchase:getById', (_, id) => {
  const d = getDb();
  const bill = d.prepare('SELECT p.*, s.name as supplier_name, s.gst_no as supplier_gst, s.address as supplier_address FROM purchase_bills p LEFT JOIN suppliers s ON p.supplier_id=s.id WHERE p.id=?').get(id);
  if (bill) bill.items = d.prepare('SELECT * FROM purchase_items WHERE bill_id=?').all(id);
  return bill;
});
ipcMain.handle('purchase:save', (_, {bill, items}) => {
  const d = getDb();
  if (!bill || !bill.bill_no || !bill.date) throw new Error('Bill number and date are required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one purchase item is required');
  return d.transaction(() => {
    const isUpdate = Boolean(bill.id);

    if (isUpdate) {
      const oldItems = d.prepare('SELECT * FROM purchase_items WHERE bill_id=?').all(bill.id);
      for (const item of oldItems) {
        if (isPhysicalProduct(d, item.product_id)) d.prepare('UPDATE products SET stock = stock - ? WHERE id=?').run(item.qty, item.product_id);
      }
      d.prepare(`UPDATE purchase_bills
                 SET bill_no=?, date=?, supplier_id=?, sub_total=?, taxable_amount=?, cgst=?, sgst=?, total=?, notes=?
                 WHERE id=?`)
        .run(
          String(bill.bill_no).trim(),
          String(bill.date),
          bill.supplier_id || null,
          nonNegative(bill.sub_total),
          nonNegative(bill.taxable_amount),
          nonNegative(bill.cgst),
          nonNegative(bill.sgst),
          nonNegative(bill.total),
          String(bill.notes || ''),
          bill.id
        );
      d.prepare('DELETE FROM purchase_items WHERE bill_id=?').run(bill.id);
    } else {
      const result = d.prepare('INSERT INTO purchase_bills (bill_no,date,supplier_id,sub_total,taxable_amount,cgst,sgst,total,notes) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(
          String(bill.bill_no).trim(),
          String(bill.date),
          bill.supplier_id || null,
          nonNegative(bill.sub_total),
          nonNegative(bill.taxable_amount),
          nonNegative(bill.cgst),
          nonNegative(bill.sgst),
          nonNegative(bill.total),
          String(bill.notes || '')
        );
      bill.id = result.lastInsertRowid;
    }

    const billId = bill.id;
    for (const item of items) {
      const qty = nonNegative(item.qty);
      if (!item.product_name || qty <= 0) throw new Error('Invalid purchase item');
      d.prepare('INSERT INTO purchase_items (bill_id,product_id,product_name,hsn_code,qty,unit,price,gst_percent,cgst,sgst,amount) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(
          billId,
          item.product_id || null,
          String(item.product_name),
          String(item.hsn_code || ''),
          qty,
          String(item.unit || 'Nos'),
          nonNegative(item.price),
          nonNegative(item.gst_percent),
          nonNegative(item.cgst),
          nonNegative(item.sgst),
          nonNegative(item.amount)
        );
      if (!item.is_service && isPhysicalProduct(d, item.product_id)) d.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(qty, item.product_id);
    }
    d.prepare('INSERT INTO activity_logs (action,description,created_at) VALUES (?,?,?)').run(isUpdate ? 'PURCHASE_UPDATED' : 'PURCHASE_CREATED',`Bill ${bill.bill_no} ${isUpdate ? 'updated' : 'created'}`,new Date().toISOString());
    return billId;
  })();
});
ipcMain.handle('purchase:delete', (_, id) => {
  const d = getDb();
  return d.transaction(() => {
    const bill = d.prepare('SELECT bill_no FROM purchase_bills WHERE id=?').get(id);
    const items = d.prepare('SELECT * FROM purchase_items WHERE bill_id=?').all(id);
    for (const item of items) {
      if (isPhysicalProduct(d, item.product_id)) d.prepare('UPDATE products SET stock = stock - ? WHERE id=?').run(item.qty, item.product_id);
    }
    d.prepare('DELETE FROM purchase_items WHERE bill_id=?').run(id);
    d.prepare('DELETE FROM purchase_bills WHERE id=?').run(id);
    d.prepare('INSERT INTO activity_logs (action,description,created_at) VALUES (?,?,?)')
      .run('PURCHASE_DELETED', `Bill ${bill?.bill_no || id} deleted`, new Date().toISOString());
  })();
});

// Quotations
ipcMain.handle('quotations:getNextNumber', () => {
  const last = getDb().prepare("SELECT quote_no FROM quotations ORDER BY id DESC LIMIT 1").get();
  let num = 1;
  if (last && last.quote_no) {
    const m = String(last.quote_no).match(/(\d+)$/);
    if (m) num = parseInt(m[1], 10) + 1;
  }
  return `QUO-${String(num).padStart(4, '0')}`;
});
ipcMain.handle('quotations:getAll', () => {
  return getDb().prepare('SELECT q.*, c.name as customer_name FROM quotations q LEFT JOIN customers c ON q.customer_id=c.id ORDER BY q.date DESC, q.id DESC').all();
});
ipcMain.handle('quotations:getById', (_, id) => {
  const d = getDb();
  const q = d.prepare('SELECT q.*, c.name as customer_name, c.gst_no as customer_gst, c.address as customer_address, c.state as customer_state FROM quotations q LEFT JOIN customers c ON q.customer_id=c.id WHERE q.id=?').get(id);
  if (q) q.items = d.prepare('SELECT * FROM quotation_items WHERE quotation_id=?').all(id);
  return q;
});
ipcMain.handle('quotations:save', (_, {quotation, items}) => {
  const d = getDb();
  if (!quotation || !quotation.date) throw new Error('Quotation date is required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one quotation item is required');
  return d.transaction(() => {
    const isUpdate = Boolean(quotation.id);
    let qId = quotation.id;

    if (isUpdate) {
      d.prepare('UPDATE quotations SET date=?,customer_id=?,total=?,notes=? WHERE id=?')
        .run(
          String(quotation.date),
          quotation.customer_id || null,
          nonNegative(quotation.total),
          String(quotation.notes || ''),
          qId
        );
      d.prepare('DELETE FROM quotation_items WHERE quotation_id=?').run(qId);
    } else {
      const qNum = String(quotation.quote_no || '').trim() || `QUO-${String(Date.now()).slice(-6)}`;
      const result = d.prepare('INSERT INTO quotations (quote_no,date,customer_id,total,notes,status) VALUES (?,?,?,?,?,?)')
        .run(
          qNum,
          String(quotation.date),
          quotation.customer_id || null,
          nonNegative(quotation.total),
          String(quotation.notes || ''),
          'Draft'
        );
      qId = result.lastInsertRowid;
    }

    for (const item of items) {
      const qty = nonNegative(item.qty);
      if (!item.product_name || qty <= 0) throw new Error('Invalid quotation item');
      try {
        d.prepare('INSERT INTO quotation_items (quotation_id,product_id,product_name,hsn_code,qty,unit,price,gst_percent,cgst,sgst,amount) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
          .run(
            qId,
            item.product_id || null,
            String(item.product_name),
            String(item.hsn_code || ''),
            qty,
            String(item.unit || 'Nos'),
            nonNegative(item.price),
            nonNegative(item.gst_percent),
            nonNegative(item.cgst),
            nonNegative(item.sgst),
            nonNegative(item.amount)
          );
      } catch(e) {
        d.prepare('INSERT INTO quotation_items (quotation_id,product_id,product_name,qty,unit,price,gst_percent,amount) VALUES (?,?,?,?,?,?,?,?)')
          .run(
            qId,
            item.product_id || null,
            String(item.product_name),
            qty,
            String(item.unit || 'Nos'),
            nonNegative(item.price),
            nonNegative(item.gst_percent),
            nonNegative(item.amount)
          );
      }
    }
    d.prepare('INSERT INTO activity_logs (action,description,created_at) VALUES (?,?,?)')
      .run(isUpdate ? 'QUOTATION_UPDATED' : 'QUOTATION_CREATED', `Quotation ${isUpdate ? 'updated' : 'created'}`, new Date().toISOString());
    return qId;
  })();
});
ipcMain.handle('quotations:delete', (_, id) => {
  const d = getDb();
  return d.transaction(() => {
    const q = d.prepare('SELECT quote_no FROM quotations WHERE id=?').get(id);
    d.prepare('DELETE FROM quotation_items WHERE quotation_id=?').run(id);
    d.prepare('DELETE FROM quotations WHERE id=?').run(id);
    d.prepare('INSERT INTO activity_logs (action,description,created_at) VALUES (?,?,?)')
      .run('QUOTATION_DELETED', `Quotation ${q?.quote_no || id} deleted`, new Date().toISOString());
  })();
});

ipcMain.handle('quotations:convertToSale', (_, id) => {
  // Mark as converted
  return getDb().prepare("UPDATE quotations SET status='Converted' WHERE id=?").run(id);
});

// Credit Notes
ipcMain.handle('creditNotes:getAll', () => {
  return getDb().prepare('SELECT cn.*, c.name as customer_name FROM credit_notes cn LEFT JOIN customers c ON cn.customer_id=c.id ORDER BY cn.date DESC').all();
});
ipcMain.handle('creditNotes:save', (_, {note, items}) => {
  const d = getDb();
  return d.transaction(() => {
    const num = `CN-${String(Date.now()).slice(-6)}`;
    const result = d.prepare('INSERT INTO credit_notes (note_no,date,customer_id,total,reason) VALUES (?,?,?,?,?)')
      .run(num,note.date,note.customer_id,note.total,note.reason||'');
    const nId = result.lastInsertRowid;
    for (const item of items) {
      d.prepare('INSERT INTO credit_note_items (note_id,product_id,product_name,qty,price,amount) VALUES (?,?,?,?,?,?)')
        .run(nId,item.product_id,item.product_name,item.qty,item.price,item.amount);
      d.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(item.qty, item.product_id);
    }
    return nId;
  })();
});

// Debit Notes
ipcMain.handle('debitNotes:getAll', () => {
  return getDb().prepare('SELECT dn.*, s.name as supplier_name FROM debit_notes dn LEFT JOIN suppliers s ON dn.supplier_id=s.id ORDER BY dn.date DESC').all();
});
ipcMain.handle('debitNotes:save', (_, {note, items}) => {
  const d = getDb();
  return d.transaction(() => {
    const num = `DN-${String(Date.now()).slice(-6)}`;
    const result = d.prepare('INSERT INTO debit_notes (note_no,date,supplier_id,total,reason) VALUES (?,?,?,?,?)')
      .run(num,note.date,note.supplier_id,note.total,note.reason||'');
    const nId = result.lastInsertRowid;
    for (const item of items) {
      d.prepare('INSERT INTO debit_note_items (note_id,product_id,product_name,qty,price,amount) VALUES (?,?,?,?,?,?)')
        .run(nId,item.product_id,item.product_name,item.qty,item.price,item.amount);
      d.prepare('UPDATE products SET stock = stock - ? WHERE id=?').run(item.qty, item.product_id);
    }
    return nId;
  })();
});

// Delivery Notes
ipcMain.handle('deliveryNotes:getAll', () => {
  return getDb().prepare('SELECT dn.*, c.name as customer_name FROM delivery_notes dn LEFT JOIN customers c ON dn.customer_id=c.id ORDER BY dn.date DESC').all();
});
ipcMain.handle('deliveryNotes:save', (_, {note, items}) => {
  const d = getDb();
  return d.transaction(() => {
    const num = `DN-DEL-${String(Date.now()).slice(-6)}`;
    const result = d.prepare('INSERT INTO delivery_notes (note_no,date,customer_id,notes,status) VALUES (?,?,?,?,?)')
      .run(num,note.date,note.customer_id,note.notes||'','Pending');
    const nId = result.lastInsertRowid;
    for (const item of items) {
      d.prepare('INSERT INTO delivery_note_items (note_id,product_id,product_name,qty,unit) VALUES (?,?,?,?,?)')
        .run(nId,item.product_id,item.product_name,item.qty,item.unit);
    }
    return nId;
  })();
});

// Reports
ipcMain.handle('reports:salesSummary', (_, {from, to}) => {
  return getDb().prepare(`SELECT date, COUNT(*) as count, SUM(total) as total, SUM(cgst+sgst) as tax FROM sales_invoices WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from, to);
});
ipcMain.handle('reports:purchaseSummary', (_, {from, to}) => {
  return getDb().prepare(`SELECT date, COUNT(*) as count, SUM(total) as total FROM purchase_bills WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from, to);
});
ipcMain.handle('reports:gstSummary', (_, {from, to}) => {
  const d = getDb();
  const sales    = d.prepare(`SELECT SUM(cgst) as cgst, SUM(sgst) as sgst, SUM(total) as total FROM sales_invoices WHERE date BETWEEN ? AND ?`).get(from, to);
  const purchase = d.prepare(`SELECT SUM(cgst) as cgst, SUM(sgst) as sgst, SUM(total) as total FROM purchase_bills WHERE date BETWEEN ? AND ?`).get(from, to);
  return { sales, purchase };
});
ipcMain.handle('reports:stockReport', () => {
  return getDb().prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.name').all();
});
ipcMain.handle('reports:customerLedger', (_, customerId) => {
  return getDb().prepare('SELECT * FROM sales_invoices WHERE customer_id=? ORDER BY date DESC').all(customerId);
});
ipcMain.handle('reports:supplierLedger', (_, supplierId) => {
  return getDb().prepare('SELECT * FROM purchase_bills WHERE supplier_id=? ORDER BY date DESC').all(supplierId);
});
ipcMain.handle('reports:dashboardStats', () => {
  const d = getDb();
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0,7);
  return {
    todaySales: d.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sales_invoices WHERE date=?`).get(today),
    monthSales: d.prepare(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sales_invoices WHERE strftime('%Y-%m',date)=?`).get(thisMonth),
    totalCustomers: d.prepare('SELECT COUNT(*) as count FROM customers').get(),
    totalProducts: d.prepare('SELECT COUNT(*) as count FROM products').get(),
    lowStock: d.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND min_stock > 0').get(),
    totalPurchase: d.prepare(`SELECT COALESCE(SUM(total),0) as total FROM purchase_bills WHERE strftime('%Y-%m',date)=?`).get(thisMonth),
    recentSales: d.prepare('SELECT s.*, c.name as customer_name FROM sales_invoices s LEFT JOIN customers c ON s.customer_id=c.id ORDER BY s.id DESC LIMIT 5').all(),
  };
});

// Profit & Loss Report
ipcMain.handle('reports:profitLoss', (_, {from, to}) => {
  const d = getDb();
  const sales = d.prepare(`SELECT COALESCE(SUM(total),0) as total FROM sales_invoices WHERE date BETWEEN ? AND ?`).get(from, to);
  const purchase = d.prepare(`SELECT COALESCE(SUM(total),0) as total FROM purchase_bills WHERE date BETWEEN ? AND ?`).get(from, to);
  const expenses = d.prepare(`SELECT COALESCE(SUM(debit),0) as total FROM daily_funds WHERE date BETWEEN ? AND ?`).get(from, to);
  const income = d.prepare(`SELECT COALESCE(SUM(credit),0) as total FROM daily_funds WHERE date BETWEEN ? AND ?`).get(from, to);
  return { salesRevenue: sales.total, purchaseCost: purchase.total, expenses: expenses.total, otherIncome: income.total, netProfit: sales.total - purchase.total - expenses.total + income.total };
});

// GSTR-1 Summary (rate-wise breakup)
ipcMain.handle('reports:gstr1Summary', (_, {from, to}) => {
  return getDb().prepare(`SELECT si.gst_percent, COUNT(DISTINCT si2.id) as invoice_count, SUM(si.qty * si.price * (1 - si.discount/100)) as taxable_value, SUM(si.cgst) as cgst, SUM(si.sgst) as sgst, SUM(si.amount) as total FROM sales_items si JOIN sales_invoices si2 ON si.invoice_id=si2.id WHERE si2.date BETWEEN ? AND ? GROUP BY si.gst_percent ORDER BY si.gst_percent`).all(from, to);
});

// Item-wise Sales Report
ipcMain.handle('reports:itemWiseSales', (_, {from, to}) => {
  return getDb().prepare(`SELECT si.product_name, si.hsn_code, SUM(si.qty) as total_qty, si.unit, SUM(si.amount) as total_amount, COUNT(*) as times_sold FROM sales_items si JOIN sales_invoices inv ON si.invoice_id=inv.id WHERE inv.date BETWEEN ? AND ? GROUP BY si.product_name ORDER BY total_amount DESC`).all(from, to);
});

// Expense Summary
ipcMain.handle('reports:expenseSummary', (_, {from, to}) => {
  return getDb().prepare(`SELECT date, description, debit as amount, party_name FROM daily_funds WHERE debit > 0 AND date BETWEEN ? AND ? ORDER BY date DESC`).all(from, to);
});

// Daily Cash Summary
ipcMain.handle('reports:cashSummary', (_, {from, to}) => {
  const d = getDb();
  const salesCash = d.prepare(`SELECT date, SUM(total) as amount FROM sales_invoices WHERE payment_mode='Cash' AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from, to);
  const expenses = d.prepare(`SELECT date, SUM(debit) as amount FROM daily_funds WHERE debit > 0 AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from, to);
  const fundsIn = d.prepare(`SELECT date, SUM(credit) as amount FROM daily_funds WHERE credit > 0 AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from, to);
  return { salesCash, expenses, fundsIn };
});

// Outstanding Receivables
ipcMain.handle('reports:outstanding', () => {
  return getDb().prepare(`SELECT s.id, s.invoice_no, s.date, s.total, s.status, s.payment_mode, c.name as customer_name, c.phone as customer_phone FROM sales_invoices s LEFT JOIN customers c ON s.customer_id=c.id WHERE s.status IN ('Unpaid','Partial') ORDER BY s.date DESC`).all();
});

// Stock Adjustments
ipcMain.handle('stockAdjustments:getAll', () => getDb().prepare('SELECT * FROM stock_adjustments ORDER BY id DESC LIMIT 200').all());
ipcMain.handle('stockAdjustments:add', (_, adj) => {
  const d = getDb();
  d.prepare('INSERT INTO stock_adjustments (product_id,product_name,previous_stock,new_stock,adjustment,reason) VALUES (?,?,?,?,?,?)')
    .run(adj.product_id, adj.product_name, adj.previous_stock, adj.new_stock, adj.adjustment, adj.reason||'');
  d.prepare('UPDATE products SET stock=? WHERE id=?').run(adj.new_stock, adj.product_id);
  return true;
});

// Proforma Invoices
ipcMain.handle('proforma:getAll', () => getDb().prepare('SELECT p.*, c.name as customer_name FROM proforma_invoices p LEFT JOIN customers c ON p.customer_id=c.id ORDER BY p.id DESC').all());
ipcMain.handle('proforma:getNextNumber', () => {
  const d = getDb(); const co = d.prepare('SELECT invoice_prefix FROM company LIMIT 1').get();
  const last = d.prepare('SELECT proforma_no FROM proforma_invoices ORDER BY id DESC LIMIT 1').get();
  const num = last ? parseInt(last.proforma_no.replace(/\D/g,'')) + 1 : 1;
  return `PI-${String(num).padStart(4,'0')}`;
});
ipcMain.handle('proforma:save', (_, inv) => {
  const d = getDb();
  const r = d.prepare('INSERT INTO proforma_invoices (proforma_no,date,customer_id,sub_total,discount,taxable_amount,cgst,sgst,total,notes,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(inv.proforma_no, inv.date, inv.customer_id||null, inv.sub_total, inv.discount, inv.taxable_amount, inv.cgst, inv.sgst, inv.total, inv.notes||'', inv.status||'Draft');
  const stmtItem = d.prepare('INSERT INTO proforma_items (proforma_id,product_id,product_name,hsn_code,qty,unit,price,discount,gst_percent,cgst,sgst,amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  (inv.items||[]).forEach(it => stmtItem.run(r.lastInsertRowid, it.product_id, it.product_name, it.hsn_code||'', it.qty, it.unit||'Nos', it.price, it.discount||0, it.gst_percent, it.cgst, it.sgst, it.amount));
  return r;
});

// Purchase Orders
ipcMain.handle('purchaseOrders:getAll', () => getDb().prepare('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id ORDER BY po.id DESC').all());
ipcMain.handle('purchaseOrders:getNextNumber', () => {
  const d = getDb();
  const last = d.prepare('SELECT po_no FROM purchase_orders ORDER BY id DESC LIMIT 1').get();
  const num = last ? parseInt(last.po_no.replace(/\D/g,'')) + 1 : 1;
  return `PO-${String(num).padStart(4,'0')}`;
});
ipcMain.handle('purchaseOrders:save', (_, po) => {
  const d = getDb();
  const r = d.prepare('INSERT INTO purchase_orders (po_no,date,supplier_id,total,notes,status) VALUES (?,?,?,?,?,?)')
    .run(po.po_no, po.date, po.supplier_id||null, po.total, po.notes||'', po.status||'Draft');
  const stmtItem = d.prepare('INSERT INTO purchase_order_items (po_id,product_id,product_name,hsn_code,qty,unit,price,gst_percent,cgst,sgst,amount) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  (po.items||[]).forEach(it => stmtItem.run(r.lastInsertRowid, it.product_id, it.product_name, it.hsn_code||'', it.qty, it.unit||'Nos', it.price, it.gst_percent, it.cgst, it.sgst, it.amount));
  return r;
});

// Activity Logs
ipcMain.handle('logs:getAll', () => getDb().prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 200').all());

// App / Updates
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getCompanies', () => {
  const Database = require('better-sqlite3');
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) return [];
  const files = fs.readdirSync(userDataPath).filter(f => f.endsWith('.db') && !f.includes('master') && !f.includes('Backup'));
  const companies = [];
  for (const f of files) {
    let tempDb = null;
    try {
      tempDb = new Database(path.join(userDataPath, f), { readonly: true, fileMustExist: true });
      const co = tempDb.prepare('SELECT name, business_type, logo FROM company LIMIT 1').get();
      if (co) companies.push({ name: co.name, business_type: co.business_type, logo: co.logo, dbName: f });
    } catch(e) {
      // Ignore
    } finally {
      if (tempDb) tempDb.close();
    }
  }
  return companies;
});
ipcMain.handle('app:switchCompany', (_, dbName) => {
  if (db) { try { db.close(); } catch(e) {} }
  db = null;
  activeDbName = dbName || 'ms_billing.db';
  getDb();
  return true;
});
ipcMain.handle('app:deleteCompany', (_, dbName) => {
  requireAdmin('app:deleteCompany');
  if (!dbName || dbName.includes('..') || !dbName.endsWith('.db')) throw new Error('Invalid database filename payload');

  const userDataPath = app.getPath('userData');
  const targetPath = path.join(userDataPath, dbName);

  if (!fs.existsSync(targetPath)) throw new Error('Workspace not found');

  if (activeDbName === dbName) {
    if (db) { try { db.close(); } catch(e) {} }
    db = null;
    activeDbName = null;
  }

  try {
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    if (fs.existsSync(targetPath + '-shm')) fs.unlinkSync(targetPath + '-shm');
    if (fs.existsSync(targetPath + '-wal')) fs.unlinkSync(targetPath + '-wal');
    return true;
  } catch(err) {
    throw new Error('Failed to permanently delete workspace: ' + err.message);
  }
});
// Updater implementation (VLC-style)
autoUpdater.autoDownload = false;

autoUpdater.on('update-available', (info) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('updater:available', info);
});
autoUpdater.on('update-not-available', (info) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('updater:not-available', info);
});
autoUpdater.on('download-progress', (progressObj) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('updater:progress', progressObj);
});
autoUpdater.on('update-downloaded', (info) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('updater:downloaded', info);
});
autoUpdater.on('error', (err) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('updater:error', err?.message || 'Error occurred during update');
});

ipcMain.handle('updater:check', () => {
  autoUpdater.checkForUpdates().catch(e => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('updater:error', e?.message || 'Failed to check updates');
  });
});
ipcMain.handle('updater:download', () => {
  autoUpdater.downloadUpdate().catch(e => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('updater:error', e?.message || 'Failed to download updates');
  });
});
ipcMain.handle('updater:quitAndInstall', () => {
  autoUpdater.quitAndInstall();
});

// Backup — export uses SQLite backup API so WAL-mode DB copies are consistent (raw file copy can be corrupt/incomplete).
ipcMain.handle('backup:export', async () => {
  const d = getDb();
  const result = await dialog.showSaveDialog({
    title: 'Save Backup',
    defaultPath: `MS_Billing_Backup_${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'Database Backup', extensions: ['db'] }]
  });
  if (result.canceled) return { success: false };
  const dest = result.filePath;
  try {
    await d.backup(dest);
  } catch (e) {
    throw new Error(e?.message || 'Could not create backup file. Try another folder or close other programs using the file.');
  }
  return { success: true, path: dest };
});
ipcMain.handle('backup:import', async () => {
  requireAdmin('backup:import');
  const result = await dialog.showOpenDialog({
    title: 'Restore Backup',
    filters: [{ name: 'Database Backup', extensions: ['db'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, activeDbName);
  const src = result.filePaths[0];
  const Database = require('better-sqlite3');
  let probe = null;
  try {
    probe = new Database(src, { readonly: true, fileMustExist: true });
    probe.prepare('SELECT 1').get();
  } catch {
    throw new Error('The selected file is not a valid SQLite database.');
  } finally {
    if (probe) try { probe.close(); } catch { /* ignore */ }
  }
  if (db) { try { db.close(); } catch (e) { /* ignore */ } }
  db = null;
  fs.copyFileSync(src, dbPath);
  getDb();
  return { success: true };
});

const { registerGoogleDriveBackup } = require('./src/main/googleDriveBackup');
registerGoogleDriveBackup(ipcMain, {
  app,
  getUserDataPath: () => app.getPath('userData'),
  getDb,
  getActiveDbName: () => activeDbName,
});

// File dialog
ipcMain.handle('dialog:openFile', async (_, filters) => {
  const result = await dialog.showOpenDialog({ filters, properties: ['openFile'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});
ipcMain.handle('dialog:saveFile', async (_, opts) => {
  const o = opts && typeof opts === 'object' ? opts : {};
  const result = await dialog.showSaveDialog({ defaultPath: o.defaultPath, filters: o.filters });
  if (result.canceled) return null;
  return result.filePath;
});
ipcMain.handle('file:readBase64', (_, filePath) => {
  const allowedImageExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (!allowedImageExt.has(ext)) throw new Error('Only image files are allowed');
  const stat = fs.statSync(filePath);
  if (stat.size > 5 * 1024 * 1024) throw new Error('Image exceeds 5MB limit');
  const data = fs.readFileSync(filePath);
  return `data:image/${ext.slice(1)};base64,${data.toString('base64')}`;
});
ipcMain.handle('shell:openExternal', (_, url) => {
  const target = String(url || '').trim();
  if (!target) throw new Error('URL is required');
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
    throw new Error('Blocked non-http URL');
  }
  return shell.openExternal(target);
});

// Hardware ID Generation (Device Locking)
ipcMain.handle('system:getHardwareId', () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      require('child_process').exec('wmic csproduct get uuid', (error, stdout) => {
        if (error) { resolve('UNKNOWN-HWID-' + Math.random().toString(36).substr(2, 9)); return; }
        const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
        resolve(lines[1] || 'UNKNOWN-HWID-' + Math.random().toString(36).substr(2, 9));
      });
    } else {
      resolve('NON-WINDOWS-HWID-' + Math.random().toString(36).substr(2, 9));
    }
  });
});

// Licensing V2
const licenseSystem = require('./src/main/licenseSystem.js');
ipcMain.handle('license:getStatus', async () => {
  return await licenseSystem.getLicenseStatus(app.getPath('userData'));
});
ipcMain.handle('license:activateOnline', async (_, { activationKey }) => {
  return await licenseSystem.activateLicenseOnline(app.getPath('userData'), {
    activationKey,
    appVersion: app.getVersion()
  });
});
ipcMain.handle('license:getMachineId', async () => {
  return await licenseSystem.getMachineFingerprintV2();
});
