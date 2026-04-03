/**
 * Relyce Book - SQLite Schema v3.0
 * Multi-purpose: Retail, Services, IT Companies
 * IGST removed — only CGST/SGST (intra-state billing)
 */

function createTables(db) {
  db.exec(`
    -- Company / Shop Setup
    CREATE TABLE IF NOT EXISTS company (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      gst_no TEXT,
      pan_no TEXT,
      state TEXT,
      invoice_prefix TEXT DEFAULT 'INV',
      fy_start TEXT,
      logo TEXT,
      business_type TEXT DEFAULT 'retail'
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      active INTEGER DEFAULT 1
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gst_no TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      state TEXT DEFAULT '',
      credit_limit REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (date('now'))
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      gst_no TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      state TEXT DEFAULT '',
      opening_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (date('now'))
    );

    -- Ledger Groups
    CREATE TABLE IF NOT EXISTS ledger_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'Other'
    );

    -- Ledgers
    CREATE TABLE IF NOT EXISTS ledgers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      group_id INTEGER REFERENCES ledger_groups(id),
      opening_balance REAL DEFAULT 0,
      balance_type TEXT DEFAULT 'Dr',
      created_at TEXT DEFAULT (date('now'))
    );

    -- Ledger Transactions
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ledger_id INTEGER REFERENCES ledgers(id),
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      narration TEXT,
      ref_no TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Categories (for products AND services)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    -- Products & Services
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT DEFAULT '',
      category_id INTEGER REFERENCES categories(id),
      hsn_code TEXT DEFAULT '',
      gst_percent REAL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      unit TEXT DEFAULT 'Nos',
      stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      is_service INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (date('now'))
    );

    -- Financial Years
    CREATE TABLE IF NOT EXISTS financial_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_current INTEGER DEFAULT 0
    );

    -- Sales Invoices (CGST/SGST only — no IGST)
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      sub_total REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      total REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'Cash',
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'Paid',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Sales Items
    CREATE TABLE IF NOT EXISTS sales_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER REFERENCES sales_invoices(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      hsn_code TEXT DEFAULT '',
      qty REAL DEFAULT 1,
      unit TEXT DEFAULT 'Nos',
      price REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    -- Purchase Bills (CGST/SGST only)
    CREATE TABLE IF NOT EXISTS purchase_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no TEXT NOT NULL,
      date TEXT NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      sub_total REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      total REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Purchase Items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER REFERENCES purchase_bills(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      hsn_code TEXT DEFAULT '',
      qty REAL DEFAULT 1,
      unit TEXT DEFAULT 'Nos',
      price REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    -- Quotations
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_no TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      total REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'Draft',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Quotation Items
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER REFERENCES quotations(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      hsn_code TEXT DEFAULT '',
      qty REAL DEFAULT 1,
      unit TEXT DEFAULT 'Nos',
      price REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    -- Credit Notes (Sales Returns)
    CREATE TABLE IF NOT EXISTS credit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_no TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      total REAL DEFAULT 0,
      reason TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS credit_note_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER REFERENCES credit_notes(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      qty REAL DEFAULT 1,
      price REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    -- Debit Notes (Purchase Returns)
    CREATE TABLE IF NOT EXISTS debit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_no TEXT NOT NULL,
      date TEXT NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      total REAL DEFAULT 0,
      reason TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS debit_note_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER REFERENCES debit_notes(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      qty REAL DEFAULT 1,
      price REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    -- Delivery Notes
    CREATE TABLE IF NOT EXISTS delivery_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_no TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'Pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS delivery_note_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER REFERENCES delivery_notes(id),
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      qty REAL DEFAULT 1,
      unit TEXT DEFAULT 'Nos'
    );

    -- Activity Logs
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      description TEXT,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Daily Funds / Expenses
    CREATE TABLE IF NOT EXISTS daily_funds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT,
      credit REAL DEFAULT 0,
      debit REAL DEFAULT 0,
      party_id INTEGER,
      party_type TEXT,
      party_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Migrations for existing databases ───────────────
  const currentVersion = db.pragma('user_version', { simple: true });

  if (currentVersion === 0) {
    db.pragma('user_version = 1');
  }

  // v2: Added hsn_code to quotation_items
  if (db.pragma('user_version', { simple: true }) < 2) {
    try { db.exec(`ALTER TABLE quotation_items ADD COLUMN hsn_code TEXT DEFAULT ''`); } catch(e) {}
    db.pragma('user_version = 2');
  }

  // v3: Remove IGST — just ignore if igst exists (SQLite can't drop columns easily),
  //     so we ensure no code ever uses it. Also add new columns for multi-purpose use.
  if (db.pragma('user_version', { simple: true }) < 3) {
    // Add business_type to company if missing
    try { db.exec(`ALTER TABLE company ADD COLUMN business_type TEXT DEFAULT 'retail'`); } catch(e) {}
    // Add is_service to products if missing
    try { db.exec(`ALTER TABLE products ADD COLUMN is_service INTEGER DEFAULT 0`); } catch(e) {}
    // Add cgst/sgst to quotation_items if missing
    try { db.exec(`ALTER TABLE quotation_items ADD COLUMN cgst REAL DEFAULT 0`); } catch(e) {}
    try { db.exec(`ALTER TABLE quotation_items ADD COLUMN sgst REAL DEFAULT 0`); } catch(e) {}
    try { db.exec(`ALTER TABLE quotation_items ADD COLUMN unit TEXT DEFAULT 'Nos'`); } catch(e) {}
    db.pragma('user_version = 3');
  }
  
  // v4: Add Daily Funds
  if (db.pragma('user_version', { simple: true }) < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        description TEXT,
        credit REAL DEFAULT 0,
        debit REAL DEFAULT 0,
        party_id INTEGER,
        party_type TEXT,
        party_name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    db.pragma('user_version = 4');
  }

  seedDefaultData(db);
}

function seedDefaultData(db) {
  // Default admin user
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c === 0) {
    db.prepare("INSERT INTO users (name, username, password, role) VALUES ('Admin', 'admin', 'admin123', 'admin')").run();
  }

  // Default ledger groups
  const groupCount = db.prepare('SELECT COUNT(*) as c FROM ledger_groups').get();
  if (groupCount.c === 0) {
    const groups = [
      ['Customers','Asset'], ['Suppliers','Liability'], ['Cash','Asset'],
      ['Bank','Asset'], ['Expenses','Expense'], ['Sales','Income'],
      ['Purchase','Expense'], ['GST Output','Liability'], ['GST Input','Asset']
    ];
    const stmt = db.prepare('INSERT INTO ledger_groups (name, type) VALUES (?,?)');
    for (const [name, type] of groups) stmt.run(name, type);
  }

  // Default categories (suitable for retail AND services)
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (catCount.c === 0) {
    ['General','Electronics','Grocery','Clothing','Furniture','Medicines','Stationery',
     'IT Services','Consulting','Software','Maintenance','Labour Charges'].forEach(name => {
      db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name);
    });
  }

  // Default financial year
  const fyCount = db.prepare('SELECT COUNT(*) as c FROM financial_years').get();
  if (fyCount.c === 0) {
    db.prepare("INSERT INTO financial_years (label,start_date,end_date,is_current) VALUES ('2024-25','2024-04-01','2025-03-31',1)").run();
  }
}

module.exports = { createTables };
