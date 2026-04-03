# Relyce Book — Project Report

**Version:** 2.0.0 (Premium UI Update) | **Updated:** March 2026  
**Stack:** Electron + Better-SQLite3 + Vanilla JS

---

## 1. Project Overview

Relyce Book is an **offline-first desktop application** for Indian small businesses. It provides GST-compliant invoicing, customer/supplier management, stock tracking, and basic accounting — all stored locally with SQLite. Runs as a standalone `.exe` on Windows.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron |
| Database | Better-SQLite3 (synchronous SQLite) |
| Frontend | Vanilla HTML + CSS + JavaScript |
| Icons | Bootstrap Icons v1.11.3 (via CDN) |
| App Icon | Custom `relyce-book.ico` (high quality Windows taskbar rendering) |
| PDF Generation | jsPDF + jsPDF-AutoTable |
| Excel Export | SheetJS (XLSX) |
| Installer | electron-builder (NSIS) |

---

## 3. Directory Structure

```
MS billing software/
├── main.js               ← Electron main process (IPC handlers, DB access)
├── preload.js            ← contextBridge API exposed to renderer
├── package.json          ← Dependencies, build config
├── assets/
│   └── logo.png          ← App icon (high quality, referenced in main.js & package.json)
└── src/
    ├── db/
    │   └── schema.js     ← SQLite table creation scripts
    └── renderer/
        ├── index.html    ← App shell (Bootstrap Icons CDN, jsPDF, XLSX scripts)
        ├── css/
        │   └── style.css ← Premium brown/white design system v2.0
        └── js/
            ├── app.js    ← Router, login, setup screen, toast, modal
            └── modules/
                ├── dashboard.js     ← Stats, recent sales, quick actions
                ├── sales.js         ← POS billing + Invoice View/Print/PDF
                ├── purchase.js      ← Purchase bills + Bill View/Print/PDF
                ├── quotation.js     ← Quotation + Quotation View/Print/PDF
                ├── products.js      ← Products list + CSV import
                ├── customers.js
                ├── suppliers.js
                ├── ledger.js
                ├── reports.js       ← Reports + PDF Export (5 report types)
                ├── settings.js
                ├── users.js
                ├── backup.js
                ├── logs.js
                └── stock.js
```

---

## 4. Database Schema

SQLite DB stored at: `C:\Users\<you>\AppData\Roaming\relyce-book\ms_billing.db`

| Table | Purpose |
|---|---|
| `company` | Business profile (name, address, GST, logo as Base64) |
| `users` | Login accounts (role: admin / staff) |
| `customers` | Customer master with GST details |
| `suppliers` | Supplier master |
| `categories` | Product categories |
| `products` | Inventory items (price, stock, HSN, GST%) |
| `ledger_groups` | Tally-style account groups |
| `ledgers` | General ledger accounts |
| `financial_years` | Financial year management |
| `sales_invoices` | Sales invoice headers |
| `sales_items` | Line items for each sales invoice |
| `purchase_bills` | Purchase bill headers |
| `purchase_items` | Line items for each purchase bill |
| `quotations` | Quotation headers |
| `quotation_items` | Quotation line items (with hsn_code, gst_percent) |
| `credit_notes` / `credit_note_items` | Sales return records |
| `debit_notes` / `debit_note_items` | Purchase return records |
| `delivery_notes` / `delivery_note_items` | Delivery/challan records |
| `activity_logs` | Audit trail |

---

## 5. How Modules Communicate

```
Renderer (HTML/JS)              Main Process (Node.js)
──────────────────              ──────────────────────
window.api.sales.save(...)  →   ipcMain.handle('sales:save', ...)
                            ←   returns result via IPC
```

- `preload.js` exposes `window.api` (contextBridge).
- `main.js` handles all DB queries via synchronous Better-SQLite3.
- **Rule:** Never put DB logic in the renderer. All DB calls go through IPC.

---

## 6. First-Run Company Setup Flow

1. On first launch, `init()` in `app.js` calls `api.company.get()`.
2. If no company record → **Company Setup screen** is shown (full registration form).
3. User fills: Company Name, Owner, Address, Phone, Email, GST No, PAN, State, Invoice Prefix, FY Start, and optionally a Logo.
4. Logo is encoded as **Base64** and stored in `company.logo` column — appears on all PDFs.
5. After saving → **Login screen** is shown.
6. **Default login:** `admin / admin123` (change in Settings → Users).

> ⚠️ This setup screen only appears **once per installation**. Data is stored in `AppData\Roaming`, not the install folder, so it survives reinstalls.

---

## 7. UI Design System (v3.0)

- **Color Palette:** Premium Indigo & Slate (`--primary-900` to `--primary-50` and `--gray-900` to `--gray-50`) replacing the old brown theme. Designed to be competitive with top-tier SaaS platforms (like Zoho Books).
- **Typography:** Inter (body) + Poppins (headings, figures)  
- **Icons:** Bootstrap Icons v1.11.3 — professional SVG icon font
- **Effects:** Glassmorphism sidebar, vibrant primary gradients, and fast hover micro-animations
- **Print/PDF:** Modern, clean black-and-white minimalist template with clear borders and logo support.

### Icon Usage (Bootstrap Icons)

| Location | Icons Used |
|---|---|
| Sidebar nav | `bi-grid`, `bi-receipt`, `bi-cart3`, `bi-file-earmark-text`, `bi-people-fill`, `bi-box-seam`, `bi-gear-fill`, etc. |
| Dashboard stat cards | `bi-currency-rupee`, `bi-graph-up-arrow`, `bi-people-fill`, `bi-exclamation-triangle-fill` |
| Action buttons | `bi-save-fill`, `bi-trash-fill`, `bi-eye-fill`, `bi-file-earmark-pdf-fill`, `bi-printer-fill`, `bi-search` |
| Reports tabs | `bi-graph-up-arrow`, `bi-cart3`, `bi-bank`, `bi-people-fill`, `bi-building` |

---

## 8. Sales Invoice — View, Print & PDF

1. Go to **Sales / Billing** → click **All Invoices**
2. Each invoice row has:
   - **👁 View** — Opens full invoice preview in a modal (logo, items table, GST breakdown)
   - **📄 PDF** — Downloads `Invoice_INV-0001.pdf`
   - **🗑 Delete** — Deletes invoice and restores stock
3. Inside View modal → **🖨 Print** opens a print-friendly popup window
4. After saving a new invoice → PDF downloads automatically

**PDF includes:** Company logo, invoice number, date, customer info, HSN itemized table, CGST/SGST breakdown, grand total box, footer note.

---

## 9. Purchase Bills — View, Print & PDF

1. Go to **Purchase** → click **All Purchases**
2. Each bill row has:
   - **👁 View** — Opens purchase bill preview in a modal
   - **📄 PDF** — Downloads `PurchaseBill_PUR-0001.pdf`
3. Inside View modal → **🖨 Print** for printing

**PDF includes:** Supplier info, itemized table, CGST/SGST breakdown, total box.

---

## 10. Quotation — View, Print & PDF

1. Go to **Quotation** → create a quotation (same interface as sales bill)
2. Click **All Quotations** to see saved quotations
3. Each row has:
   - **👁 View** — Opens quotation preview (blue-themed, distinct from invoices)
   - **📄 PDF** — Downloads `Quotation_QUO-XXXXXX.pdf`
   - **🖨 Print** — Print popup window
   - **➡ Convert to Sale** — Marks quotation as "Converted"
4. After saving → PDF downloads automatically

**Differences from Invoice PDF:**
- Blue header (invoices are brown — easy to tell apart)
- Footer: *"This is a quotation, not a tax invoice"*
- Includes "Valid for 30 days" note

---

## 11. Reports — PDF Export

1. Go to **Reports** → select a tab:
   - **Sales Report** — Daily sales with CGST/SGST
   - **Purchase Report** — Daily purchase summary
   - **GST Summary** — Output vs Input GST, Net payable
   - **Customer Ledger** — All invoices for one customer
   - **Supplier Ledger** — All bills for one supplier
2. Set From/To date range → **Load Report**
3. Click **Excel** to export `.xlsx` or **PDF** to download report PDF

---

## 12. CSV Product Import

1. Go to **Products** → **⬇ CSV Template** to download sample
2. Fill in your data → **📂 Import CSV**

| Column | Required |
|---|---|
| `name` | ✅ Yes |
| `code`, `hsn_code`, `gst_percent` | No |
| `purchase_price`, `selling_price` | No |
| `unit`, `stock`, `min_stock` | No |

---

## 13. Updating the Software (Offline Version Control)

Since this software is designed to be completely **offline**, updates cannot be pushed via the internet automatically. You must manually package new versions and distribute them to the computers running the software.

### The Offline Update Process

When you fix a bug or add a new feature, follow these exact steps to release the update:

#### Step 1: Update the Version Number
1. Open `package.json` in your code editor.
2. Find the `"version": "1.0.0"` line and bumped it up (e.g., to `"1.1.0"` for features or `"1.0.1"` for bug fixes). Save the file.

#### Step 2: Write Database Migrations (If Schema Changes)
If your update adds new columns or tables to the SQLite database, you MUST add a migration in `src/db/schema.js`. 
1. Open `src/db/schema.js` and locate the `Migrations` section at the bottom.
2. Write an `ALTER TABLE` statement wrapped in an `if (db.pragma('user_version', { simple: true }) < X)` block.
3. Update the `PRAGMA user_version` to track the new database structure. 

#### Step 3: Build the Installer
1. Open your terminal in the project folder.
2. Run the build command: 
   ```bash
   npm run build
   ```
3. Wait for `electron-builder` to finish. It will create a new setup file in the `dist` folder, such as `Relyce Book Setup 1.1.0.exe`.

#### Step 4: Distribute to Users
1. Copy the new `.exe` file to a USB drive, shared local network folder, or email it to the user.
2. The user double-clicks the setup file to install.

### ✅ Why This is Safe (No Data Loss)
- The installer **overwrites the application code** located in `AppData\Local\Programs\relyce-book`.
- The user's actual business data (the database file) is stored securely in `AppData\Roaming\relyce-book`. 
- The installer **never** touches the Roaming folder. The old data is perfectly preserved and automatically reconnected when the new version opens.

### Auto-Update Setup (Optional, requires Internet)
If you eventually want to distribute updates over the internet to online machines:
```bash
npm install electron-updater
```
Add to `package.json` build config:
```json
"publish": [{ "provider": "github", "owner": "your-user", "repo": "ms-billing" }]
```
Add to `main.js`:
```javascript
const { autoUpdater } = require('electron-updater');
app.whenReady().then(() => { autoUpdater.checkForUpdatesAndNotify(); });
```

---

## 14. Known Bugs Fixed (Changelog)

| Issue Fixed | Details |
|---|---|
| **Missing HSN Code in Quotations** | Added `hsn_code` to `quotation_items` table and added SQLite auto-migration logic. |
| **Sales Add Button Crash** | Fixed `addProductToItemSearch` to handle empty searches gracefully without crashing. |
| **Purchase Add Button Broken** | Replicated sales module product search logic so clicking "+ Search" properly finds and adds products. |
| **Icons Disappearing in Topbar** | Fixed `app.js` `updateDate` interval converting HTML to simple text, which erased Bootstrap Icons. Changed `textContent` to `innerHTML`. |
| **Purchase Clear Button** | Added a new Clear bill button to `purchase.js` summary card. |
| **Removed Tax Column from Sales** | Removed the unnecessary "Tax" column from the Sales billing table, invoice view modal, and PDF generation. |
| **Added Draft View/Print** | Added "View Bill" and "Print Bill" buttons in the Sales billing UI to preview and print invoices before saving. |
| **Offline Update Architecture** | Implemented `PRAGMA user_version` in `schema.js` to handle safe database migrations for offline installer updates. |
| **Development Data Segregation** | Separated dev and production database paths (`relyce-book-dev`) in `main.js` to prevent dummy data colliding with real installation data. |
| **Company Setup UI Redesign** | Upgraded the first-run setup UI into a premium two-column layout featuring standard Bootstrap Icons and categorized sections. |
| **Company Setup UX Fixes** | Fixed string interpolation bug in State dropdown, corrected icon CSS typos, and added autofocus for better UX. |
| **Setup UI Layout Polish** | Fixed layout collapsing on small screens by adding strict height boundaries to the card CSS, and added `for` attributes to all form labels for click-to-focus accessibility. |
| **Major UI Overhaul (v3.0)** | Completely replaced the brown theme with a premium Indigo/Slate system. Upgraded all components to look modern and professional, competitive with top SaaS platforms. |
| **Removed IGST Features** | IGST was removed entirely from the database schema and all IPC handlers. The software now focuses solely on CGST/SGST. |
| **Multi-Purpose Support** | Added `is_service` flag to products allowing the software to be used for IT Services and consulting. Service items intelligently bypass stock tracking and display custom badges. |
| **Clean Professional Invoices** | Completely redesigned the invoice, purchase, and quotation prints. Removed heavy dark headers in favor of a clean, minimalist white/black style with logo support. |
| **Quotation Add Button Fix** | Fixed the missing event handler on the Quotation module's "+ Add" button, matching product search functionality. |

---

## 15. Troubleshooting

| Problem | Fix |
|---|---|
| Blank white screen on launch | Press `Ctrl+Shift+I` → check Console for errors |
| "DATABASE ERROR" on first open | Run `npm run rebuild` to recompile better-sqlite3 |
| Logo not showing on PDF | Go to Settings → re-upload logo and save |
| Print window blank or not opening | Ensure `webSecurity: false` in main.js webPreferences |
| Build fails with winCodeSign error | Add `"signAndEditExecutable": false` to `"win"` in package.json |
| XLSX / jsPDF not working after build | Download libs locally to `src/renderer/js/vendor/` and update `index.html` script tags |
| Bootstrap Icons not loading (offline) | Download `bootstrap-icons.min.css` + fonts to `src/renderer/css/vendor/` and update `index.html` |
| Login shows "Invalid credentials" | Default: `admin / admin123`. Reset via DB Browser for SQLite if forgotten |
| Invoice numbers reset | Never delete `AppData\Roaming\relyce-book` folder |

---

## 15. Adding New Features

### New page module:
```javascript
// src/renderer/js/modules/my-page.js
export async function render() {
  document.getElementById('page-content').innerHTML = `<div>My Page</div>`;
}
```
Add nav item in `index.html`:
```html
<a class="nav-item" data-page="my-page">
  <i class="bi bi-star nav-icon"></i><span>My Page</span>
</a>
```
Add to `pageTitles` in `app.js`: `'my-page': 'My Page Title'`

### New IPC channel:
```javascript
// main.js
ipcMain.handle('myTable:getAll', () => getDb().prepare('SELECT * FROM myTable').all());
// preload.js
myTable: { getAll: () => ipcRenderer.invoke('myTable:getAll') }
// module
const data = await api.myTable.getAll();
```

---

## 16. Recommended Future Improvements

| Feature | Notes |
|---|---|
| IGST on invoices | Inter-state transactions |
| Thermal printer (58/80mm) | Use `electron-pos-printer` |
| UPI QR on invoice PDF | Generate from UPI ID |
| WhatsApp invoice share | `shell.openExternal('https://wa.me/...')` |
| Multi-company support | Company selector at login |
| Auto-backup on exit | Save DB copy on app close |
| Offline Bootstrap Icons | Download to `css/vendor/` for no-internet builds |
| Credit/Debit Note PDF | Apply same PDF pattern as invoices |

---

*Relyce Book v1.2.0 — Last updated March 2026*

## 17. Penetration Testing + UI/UX Testing Update (March 20, 2026)

### Scope Tested
- Electron main-process hardening (window, navigation, external links, file APIs)
- Authentication flow and password storage
- Invoice/purchase/quotation calculation and save flows
- CSV/XLSX import hardening (file limits, row limits, header validation)
- Responsive behavior and sidebar usability on smaller viewports
- Dependency vulnerability scan using `npm audit --omit=dev`

### Critical Fixes Applied
- Enabled secure Electron web preferences: `webSecurity: true`, `sandbox: true`, `allowRunningInsecureContent: false`.
- Blocked popup/window abuse with `setWindowOpenHandler(() => ({ action: 'deny' }))`.
- Blocked unwanted top-level navigation via `will-navigate` prevention.
- Added protocol allowlist for `shell.openExternal` (`https`, `http`, `mailto` only).
- Restricted `file:readBase64` to images only and max 5MB.
- Migrated user password handling to PBKDF2 hashing with transparent auto-upgrade for old plaintext records on successful login.

### Functional Bug Fixes Applied
- Fixed sales tax/discount math:
  - Per-item discount and extra discount now both affect taxable amount correctly.
  - GST now scales correctly after extra discount.
  - Totals used for DB save now match UI totals.
- Added numeric guards in sales/purchase/quotation item editing (no invalid negative values).
- Added save-time validation and error handling in sales, purchase, and quotation modules.
- Fixed product search filter crash risk when `code` is empty/null.
- Added CSV/XLSX import safeguards:
  - Max file size 2MB
  - Max 5000 data rows
  - Required `name` header validation
  - Numeric and string normalization/clamping

### UI/UX Fixes Applied
- Added responsive sidebar behavior for <= 992px screens (`sidebar-open` state).
- Added desktop collapsed-sidebar mode (`sidebar-collapsed`) instead of fragile inline width toggling.
- Added missing legacy color variable aliases (`--brown-*`) to prevent style regressions in existing modules.
- Added mobile-friendly layout rules for forms, dashboard grid, setup/login screens.
- Added Escape-key modal close behavior.
- Hardened top-bar company name rendering against injected HTML.

### Security/Testing Results
- JS syntax validation: **PASS** across all project JS files.
- Dependency audit: **Known unresolved upstream issues remain** in `xlsx` and `dompurify` (via `jspdf`), with "No fix available" currently reported by npm audit.

### Residual Risk & Recommendation
- Because `xlsx` and `jspdf` dependency advisories currently report no patched version, keep import sources trusted and consider replacing `xlsx`/`jspdf` stack in a future release with actively patched alternatives.
- For deeper security assurance, add automated UI/E2E and IPC security tests in CI for every release build.

---

*Relyce Book v1.2.1-security-ui � Last updated March 20, 2026*


### Update (March 21, 2026)
- Fixed product dropdown visibility issue in Sales, Purchase, and Quotations (now shows up on focus/click properly).
- Added Daybook / Daily Expense Tracker module with daily_funds table to track fund in/out and net balances.
- Associated daybook entries with Customers and Suppliers.
- Updated UI to reflect Daybook navigation under Transactions.


## Premium UI & Multi-Business Type Support
- **Premium Confirmation Modal**: Replaced all native browser "confirm()" dialogs across the app with a sleek, custom HTML/CSS Promise-based modal.
- **Multi-Business Type Support**: Added Business Type selector in Setup/Settings. Added active mode toggle in topbar that dynamically filters sidebar.
- **Premium Bill/Invoice Layouts**: Completely redesigned View and Print layouts for Sales, Purchases, Quotations. Clean aesthetic, clear grids, prominent logo. Dynamic columns for Service Mode.
- **Company Settings**: Enhanced settings.js to allow uploading logo and modifying business type.

## Post-Login Setup & Service Mode Adjustments
- **Mode Selection Splash Screen**: Added a new post-login splash screen requiring the user to explicitly select their workspace mode (Retail, Service, or Ledger) before entering the dashboard, replacing the topbar dropdown.
- **Strict Service Mode Hiding**: When logged in as Service Mode, both the data entry grids and the final printed invoices strictly hide the HSN/SAC, Unit, and Qty columns across Sales, Purchases, and Quotations. This cleanly simplifies the UX based on business type.

## Workflow Code Fixes for Service Mode
- **Manual Service Entry**: Added the missing JavaScript workflow functions (addManualService, addPurManualService, addQuotManualService) to bind the 'Add Service Item' UI block to the data grids in Sales, Purchases, and Quotations. Users can now successfully type a custom service name and price and instantly add it to the bill without it needing to be a pre-saved product.

---

## Latest Update (March 21, 2026)

- Sales billing is now product-only: removed service entry flow from Sales screen and removed mixed Product / Service wording from Sales billing UI.
- Product search dropdown in Sales, Purchase, and Quotation now renders above bill summary/details cards (no hidden dropdown under bill panel).
- Standardized bill preview layout across Sales Invoice, Purchase Bill, and Quotation to a cleaner invoice-style template based on your reference.
- Company logo from account setup/settings now appears consistently in all bill previews and print views.
- Improved workflow stability by preventing duplicate click-outside dropdown event binding on repeated page renders.

## Latest Update (March 21, 2026 - Workflow & UI Stability)

- Fixed non-working button handlers by ensuring all inline onclick actions map to global window functions.
- Repaired broken clear actions:
  - Purchase Clear button now calls a valid reset flow.
  - Quotation Clear button now calls a valid reset flow.
- Added automated onclick/global-handler validation and aligned handlers so UI buttons work consistently.
- Moved Bootstrap Icons from CDN to local package files for reliable offline icon rendering.
- Business type is now chosen at setup and used directly at login:
  - Removed dependency on post-login mode selection for regular use.
  - App mode now auto-applies as Retail or Service from company setup.
- Removed legacy "Both" business-type option from setup and settings to keep workflow clear.
- Updated Sales flow to behave by selected business type:
  - Retail mode: product-focused billing.
  - Service mode: service-focused billing (including manual service line support).
- Maintained unified bill layout behavior across Sales, Purchase, and Quotation with logo support.

## Latest Update (March 21, 2026 - Full Connection Cleanup)

- Performed full UI connection audit and fixed disconnected flows.
- Removed legacy workspace selection screen and old mode-selection handlers (obsolete UI).
- Setup-time business type is now the single source of truth and is auto-applied after login.
- Settings now re-applies app mode immediately after saving business type.
- Fixed remaining non-working action buttons in Purchase and Quotation clear workflows.
- Verified all inline onclick actions resolve to valid global handlers (no orphan actions).
- Kept Sales/Purchase/Quotation bill behavior aligned with chosen business type.
- Continued using local Bootstrap Icons so icon rendering remains stable offline.

## Latest Update (March 21, 2026 - HSN/GST Label Standardization)

- Updated Sales, Purchase, and Quotation entry tables by business type:
  - Retail mode: column label is now HSN only (removed SAC wording).
  - Service mode: HSN column is fully hidden.
- Updated bill preview/print layout labels in all three flows:
  - Replaced Tax column label with GST.
  - Retail documents show HSN; service documents hide HSN.
- Updated summary wording to GST-focused labels (GST Base Amount) where applicable.
- Updated quotation footer wording from tax-invoice phrasing to GST-invoice phrasing.

## Latest Update (March 21, 2026 - Daybook Party Copy & Stability)

- Rebuilt Daybook add-record workflow for stability and clearer optional linking.
- Added optional Party Side selector in Daybook entry form:
  - None / Customer / Supplier.
- Added dependent optional party dropdown based on selected side.
- Added optional checkbox: "Also copy this transaction to selected party ledger".
- Backend now supports optional separate ledger copy on Daybook save:
  - Creates or reuses party ledger in appropriate group (Customers/Suppliers).
  - Inserts mirrored ledger transaction with proper debit/credit and reference id.
- Added Daybook input validation to reduce runtime errors:
  - date required, description required, amount > 0,
  - only one of credit/debit direction allowed.
- Improved Daybook table display with separate Party Side and Party Name columns.
- Updated delete/save flows with safer error handling and user feedback.

## Latest Update (March 22, 2026 - Purchase/Quotation GST Column Cleanup)

- Removed duplicate GST display in item-entry grids for Purchase and Quotation.
- For both Retail and Service modes in Purchase and Quotation:
  - Kept GST% column.
  - Removed separate plain GST amount column from entry tables.
- Updated empty-state colspan and row rendering to match new column count.
- Bill layout remains consistent with GST amount representation in printable preview section.

## Latest Update (March 22, 2026 - Retail/Service QA Sweep)

- Performed full Retail and Service mode stability audit across billing and daybook workflows.
- Verified UI action binding integrity (onclick handlers) and fixed-or-confirmed all action wiring.
- Verified renderer-to-preload-to-main API mapping coverage for all used endpoints.
- Executed full syntax checks for main/preload/app and all module files; no parser/runtime-load errors detected.
- Confirmed Purchase/Quotation GST column cleanup (only GST% in entry grids) remains stable in both modes.
- Confirmed HSN visibility behavior remains correct:
  - Retail: HSN visible.
  - Service: HSN hidden.
- Confirmed Daybook optional side-based copy-to-ledger workflow is connected and stable.

---

## Project Update - 2026-03-22

### Billing Features Added
- Added Edit Invoice in Sales list (load existing invoice into form and update).
- Added Edit Purchase Bill in Purchase list (load existing bill into form and update).
- Added Delete Purchase Bill with confirmation and stock rollback.

### Backend Improvements
- `sales:save` now supports both create and update operations.
- `purchase:save` now supports both create and update operations.
- Added `purchase:delete` IPC handler and preload API binding.
- Stock adjustment is now safely recalculated during update/delete flows.

### Print and Layout Fixes
- Fixed print window issue by allowing safe `about:blank` print popups in Electron.
- Added print popup failure handling (toast error instead of silent failure).
- Improved invoice layout with:
  - Rupee-prefixed totals (`Rs.`)
  - Amount in words section
  - Authorized signatory section
- Print fixes now apply consistently to Sales, Purchase, and Quotation flows.

## Update - Retail & Service Compatibility (March 22, 2026)

- Verified and updated billing actions for both `retail` and `service` business modes.
- Ensured Edit / Print / Delete bill actions are visible and accessible in both modes:
  - Sales list action column widened and wrapped for visibility.
  - Purchase list action column widened and wrapped for visibility.
- Added Edit and Delete actions directly in Sales and Purchase view modals, so actions are available even without going back to list.
- Confirmed all bill operations (create, edit, delete, print) remain mode-compatible:
  - Retail mode: HSN/Qty/Unit grid and print layout behavior retained.
  - Service mode: service-oriented grid and print layout behavior retained.

## Update - Bill Alignment & Feature Health (March 22, 2026)

### Bill Layout Alignment Fix (Retail + Service)
- Fixed bill value alignment issues in invoice/purchase/quotation layouts for both modes.
- Added fixed table layout and explicit column width strategy for bill item tables.
- Applied tabular numeric alignment for amount columns and totals (`font-variant-numeric: tabular-nums`).
- Enforced no-wrap right alignment for numeric cells to keep decimal values in straight vertical lines.
- Applied the same alignment rules to screen preview and print output fallback styles.

### Software Feature Health Sweep
- Ran renderer feature wiring audit for inline action buttons (`onclick`) against globally exposed handlers.
- Result: no missing action handlers detected.
- Revalidated key billing flows in code-paths:
  - Sales: create, edit, delete, print, preview.
  - Purchase: create, edit, delete, print, preview.
  - Quotation: create, print, preview, convert-to-sale.
- Performed syntax validation checks for updated renderer modules and app shell scripts.

## Update - Quotation Feature Parity + Sales Bill Cleanup (March 22, 2026)

### Quotation Module (Retail + Service)
- Added Sales-like quotation actions in both modes:
  - View quotation
  - Edit quotation
  - Print quotation bill
  - Delete quotation
- Added quotation edit mode with form prefill and update save path.
- Added quotation delete workflow with confirmation and backend deletion.
- Added action buttons in list view and inside quotation preview modal.

### Backend/API Changes for Quotations
- `quotations:save` now supports both create and update.
- Added `quotations:delete` IPC handler.
- Exposed `api.quotations.delete()` in preload bridge.
- Added activity log entries for quotation create/update/delete events.

### Sales Bill Layout Change
- Removed the **GST Base Amount** row from Sales bill totals section (applies to both retail and service bill rendering).

### Validation
- Re-ran syntax checks for updated files.
- Rechecked onclick-to-global-handler wiring; no missing handlers found.

## Important Note - If Latest Changes Are Not Visible (March 22, 2026)

If the new features (Quotation Edit/Delete/Print parity and Sales bill total row removal) are not showing on your screen, the app is likely running an old packaged build.

### How to see latest changes
1. Run the project in latest source mode:
   - `npm start`
2. Or create and install a fresh setup build:
   - `npm run build`
   - Install the newly generated setup from `dist/` (latest version file).

### Why this happens
- Source files are updated in project workspace.
- Installed `.exe` may still point to previous packaged `app.asar` until rebuilt/reinstalled.

### Build Status (March 22, 2026)
- Fresh installer build completed successfully after applying latest changes.
- Updated setup generated at:
  - `dist/Relyce Book Setup 1.0.0.exe`
- Updated unpacked app generated at:
  - `dist/win-unpacked/`

## Update - Quotation Records Parity + Full Bug Sweep (March 22, 2026)

### Quotation Records (Now matching Sales workflow in both Retail and Service)
- Implemented full quotation record lifecycle parity with Sales:
  - Create quotation
  - View quotation record
  - Edit quotation record
  - Print quotation bill
  - Delete quotation record
- Added quotation number flow similar to Sales numbering style:
  - New API: `quotations:getNextNumber`
  - Quotation form now shows `Quote No` field (auto-filled for new records, read-only on edit).
- Quotation list/actions are now complete in both modes.

### Critical Backend Bug Fixed
- Fixed quotation item tax persistence issue:
  - `cgst` and `sgst` are now saved to `quotation_items`.
  - This resolves incorrect GST split display when re-opening existing quotations.

### API/Connection Fixes
- Added new IPC handler: `quotations:delete`.
- Added preload bridge mappings:
  - `api.quotations.getNextNumber()`
  - `api.quotations.delete(id)`
- Strengthened quotation ordering and record retrieval metadata in backend.

### Sales Bill Layout Cleanup
- Removed `GST Base Amount` row from Sales bill totals rendering (for both Retail and Service).

### Full Health Check Performed
- Syntax validation completed for updated main/preload/renderer modules.
- Renderer action wiring audit completed (onclick handler mapping checked).
- No unresolved connection break found in updated Sales/Quotation/Purchase flows.

## Update - Service Mode Simplification (March 22, 2026)

As requested, in **Service mode** for Sales, Purchase, and Quotation:
- Removed service search/list selection blocks.
- Kept only the **Add Service Item** manual entry section.
- Ensured pages render safely without search handlers when service search UI is removed.

### Modules updated
- Sales (service mode UI)
- Purchase (service mode UI)
- Quotation (service mode UI)

## Update - Service Add/Remove Stability + Connection Guarding (March 22, 2026)

### Service Item Add/Remove Fixes (Sales, Purchase, Quotation)
- Fixed service item type detection while editing old records:
  - Items are now correctly recognized as services using fallback rules (`is_service`, source product flag, `SVC-` ids, service-mode null product ids).
- Fixed product id matching for add/increment behavior:
  - Normalized id matching to avoid number/string mismatch issues when adding items from list.
- Aligned product filtering in all three modules:
  - Purchase and Quotation now follow the same mode-aware filtering pattern as Sales.
  - Retail mode shows non-service products; Service mode keeps service products.

### Connection/Loading Reliability
- Added safe `try/catch` loading guards to:
  - Sales module render
  - Purchase module render
  - Quotation module render
- If API/data loading fails, user now sees a clear toast error instead of silent or partial rendering.

### Validation
- Syntax validation completed:
  - `node --check src/renderer/js/modules/sales.js`
  - `node --check src/renderer/js/modules/purchase.js`
  - `node --check src/renderer/js/modules/quotation.js`

## Final Update - UI/UX + Connectivity Hardening Sweep (March 22, 2026)

### Final Stability Fixes Applied
- Added navigation-level error boundary in app router:
  - `navigateTo(page)` now safely handles module-load and module-render failures.
  - UI now shows a safe fallback state instead of getting stuck on loading.
- Added setup and login fail-safe handling:
  - Wrapped setup save and login workflows in `try/catch`.
  - User now gets clear toast feedback on API/connection/system failures.
- Added global runtime protection:
  - Global `unhandledrejection` handler.
  - Global `error` handler.
  - Online/offline status toasts for connection awareness.

### Offline/Connectivity UX Fixes
- Removed external Google Font dependency from app shell and print rendering.
- App now avoids font-loading failures in low/no internet conditions.
- Continued using local Bootstrap icons (offline-safe).

### Final Validation Performed
- `node --check src/renderer/js/app.js`
- `node --check src/renderer/js/modules/sales.js`
- `node --check src/renderer/js/modules/purchase.js`
- `node --check src/renderer/js/modules/quotation.js`
- Confirmed no remaining `fonts.googleapis` / `fonts.gstatic` references in updated core UI/print files.

### Scope Completed in This Final Sweep
- Sales, Purchase, Quotation, App Router, and shell-level UX/connectivity hardening completed.
- Project report updated with all final fixes.

## Hotfix - Product Delete Foreign Key Error (March 22, 2026)

### Issue
- Deleting a product could fail with raw SQLite error:
  - `FOREIGN KEY constraint failed`

### Fix Applied
- Reworked `products:delete` in backend to be dependency-aware before delete.
- Added usage checks across linked transaction tables:
  - Sales items
  - Purchase items
  - Quotation items
  - Credit note items
  - Debit note items
  - Delivery note items
- If linked usage exists, deletion is blocked with a clear business message listing where the product is used.
- Added fallback FK error handling so raw SQL errors are not shown directly to users.

### Validation
- Syntax check passed:
  - `node --check main.js`

## Update - Future Internet-Based Software Update System (March 22, 2026)

### Goal Achieved
- Software remains fully offline for billing operations.
- Internet is only required when user manually checks/downloads updates.

### What Was Implemented
- Added backend update APIs:
  - `app:getVersion`
  - `updates:check` (reads update manifest JSON URL and compares versions)
  - `updates:openDownload` (opens download link in browser)
- Added preload bridge methods:
  - `api.app.getVersion()`
  - `api.updates.check()`
  - `api.updates.openDownload()`
- Added new **Updates** tab in Settings with:
  - Current app version display
  - Update manifest URL save field
  - Manual **Check for Updates** action
  - Result panel (latest version, notes, published date, download button)
- Added sample manifest template file:
  - `update-manifest.example.json`

### Update Manifest Format
- Required fields used by app:
  - `version`
  - `download_url`
- Optional fields:
  - `notes`
  - `published_at`
  - `mandatory`

### Future Release Process (How to update software)
1. Build new installer:
   - `npm run build`
2. Upload installer to your hosting (website/cloud storage).
3. Host/update manifest JSON (based on `update-manifest.example.json`) at a stable URL.
4. In app -> Settings -> Updates:
   - set/update manifest URL once
   - click **Check for Updates**
   - click **Download Update** when available
5. Install downloaded setup to update app.

### Notes
- This is a safe manual update model for offline-first desktop billing software.
- No background auto-download is forced; update remains admin/user-controlled.

### Validation
- Syntax checks passed:
  - `node --check main.js`
  - `node --check preload.js`
  - `node --check src/renderer/js/modules/settings.js`

## Update - GitHub Actions Auto-Release + Auto-Manifest Setup (March 22, 2026)

### What was configured
- Added GitHub Actions workflow to build and publish installer on version tags:
  - `.github/workflows/release-build.yml`
  - Trigger: push tag `v*.*.*`
  - Action: build installer + create GitHub Release + upload `.exe`
- Added GitHub Actions workflow to auto-update update manifest after release publish:
  - `.github/workflows/update-manifest.yml`
  - Trigger: release published
  - Action: generate/update `latest.json` from release version + `.exe` download URL and commit to `main`
- Added repository manifest file:
  - `latest.json`
- Added release/update process guide in `README.md`.

### Regular release usage (for future)
1. Increase app version in `package.json`
2. Commit and push
3. Tag release and push tag (example `v1.0.1`)
4. GitHub workflows will publish installer and refresh `latest.json`
5. Clients use app Settings -> Updates -> Check for Updates

### App manifest URL to use in software
- `https://raw.githubusercontent.com/ukenthirana01/Billing-software-/main/latest.json`

### Benefit
- Offline billing stays unchanged.
- Update process becomes repeatable and low-risk with minimal manual steps.

## Final Guide - GitHub Setup + Update Process + Feature Working (March 22, 2026)

### Current Setup Status (Now)
- Update system code has been implemented in app and backend.
- GitHub workflow files have been added:
  - `.github/workflows/release-build.yml`
  - `.github/workflows/update-manifest.yml`
- Manifest file is added:
  - `latest.json`
- App Settings now contains an **Updates** tab for manual check/download.
- Repo URL used in app update defaults:
  - `https://raw.githubusercontent.com/ukenthirana01/Billing-software-/main/latest.json`

### One-Time Setup Steps (Do Now)
1. Open terminal in project folder.
2. Authenticate GitHub (required to push):
   - `gh auth login`
   - Or: `git config --global credential.helper manager`
3. Push latest `main` code:
   - `git push origin main`
4. Open GitHub repository settings:
   - Settings -> Actions -> General
   - Set workflow permissions to allow write access to repository contents.

### First Release Steps (Do Once To Start Update Cycle)
1. Ensure `package.json` version is the release version (example: `1.0.1`).
2. Create and push tag:
   - `git tag v1.0.1`
   - `git push origin v1.0.1`
3. Wait for GitHub Actions to finish:
   - **Build And Release Installer**
   - **Update Latest Manifest**
4. Verify outputs:
   - GitHub Release contains installer `.exe` file.
   - `latest.json` on `main` is auto-updated with new version + download URL.

### Regular Update Steps (Every Future Version)
1. Increase app version in `package.json`.
2. Commit and push code to `main`.
3. Create new tag (`vX.Y.Z`) and push tag.
4. GitHub Actions auto-builds installer and updates `latest.json`.
5. User checks update from app Settings -> Updates.

### How Feature Works In Software
- Billing/data operations are offline-first.
- Internet is used only for update check/download.
- In app:
  1. Go to Settings -> Updates.
  2. Confirm manifest URL.
  3. Click **Check for Updates**.
  4. If update available, click **Download Update**.
  5. Install downloaded setup to update software.

### Safety/Best Practices
- Keep versions strictly increasing (`1.0.1` -> `1.0.2`).
- Never reuse old tag names.
- Keep one stable manifest URL always.
- Test first update on one machine before sharing to all systems.
- Take DB backup before installing updates.

### Quick Troubleshooting
- Push fails with credentials error:
  - Run `gh auth login` and retry push.
- Release created but no installer:
  - Check workflow logs for build errors.
- Update check works but no download:
  - Confirm `latest.json` has valid `download_url`.
- App says already latest unexpectedly:
  - Confirm manifest `version` is higher than installed app version.

## Push Error Resolution - GitHub 100MB Limit (March 22, 2026)

### Problem
- Push to GitHub failed because large file was present in git history:
  - `node_modules/electron/dist/electron.exe` (>100MB)

### Resolution Completed Locally
- Created clean worktree branch from `origin/main`:
  - branch: `clean-release-main`
- Re-applied update automation commit and full project snapshot **without `node_modules`**.
- Added proper root `.gitignore` (includes `node_modules/`, `dist/`, `build/`, `.vscode/`, `*.exe`, `.env`).
- Clean branch history now excludes large binary issue.

### Next Steps For User
1. Authenticate GitHub credentials in terminal:
   - `gh auth login`
   - or `git config --global credential.helper manager`
2. Push clean branch to main:
   - `git -C .clean push origin clean-release-main:main`
3. (Optional) Set local main to same clean history after successful push.

### Why This Works
- GitHub rejects any push containing >100MB blobs in history.
- Clean branch is based on remote main and contains only required source + workflow files, not blocked binaries.

## CI Fix - Release Build Failure On v1.0.1 (March 22, 2026)

### Root Cause
- GitHub Action `Build And Release Installer` failed at step:
  - `Build Windows Installer`
- As a result, no GitHub Release `.exe` asset was created, and `latest.json` remained at `1.0.0`.

### Fix Applied
- Updated workflow `.github/workflows/release-build.yml`:
  - Added step: `npm run rebuild`
  - This rebuilds native Electron modules (like `better-sqlite3`) before installer build.

### Next Required User Action
1. Push workflow fix commit to `main`.
2. Create new tag (recommended `v1.0.2`) and push tag.
3. Verify both workflows complete successfully.
4. Confirm `latest.json` updates with new version and `download_url`.

## CI Fix - Native Rebuild Dependency (Python) (March 22, 2026)

### Diagnosed Cause
- `electron-rebuild` failed for `better-sqlite3` because `node-gyp` could not find Python.
- Error observed:
  - `Could not find any Python installation to use`

### Fix Applied
- Updated `.github/workflows/release-build.yml` to include:
  - `actions/setup-python@v5` (`python-version: 3.11`)
  - npm Python path configuration before rebuild:
    - `npm config set python "$env:pythonLocation\\python.exe"`
- Native rebuild step retained:
  - `npm run rebuild`

### Expected Result
- Tag-triggered build should now complete native module rebuild and produce installer `.exe` release asset.

## CI Fix - Python Path Step Failure On v1.0.3 (March 22, 2026)

### Diagnosed Cause
- Workflow step `Configure npm Python Path` failed on GitHub runner.
- This stopped rebuild/build/release stages.

### Fix Applied
- Removed separate `npm config set python ...` step.
- Set Python path directly as environment variable on rebuild step:
  - `npm_config_python: ${{ env.pythonLocation }}\\python.exe`
- Rebuild + installer build flow remains intact.

### Next Release Trigger
- Push this CI fix to `main` and publish next tag (`v1.0.4`).
