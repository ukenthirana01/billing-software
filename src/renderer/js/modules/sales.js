// Sales / Billing Module - Product Billing
let salesProducts = [], salesCustomers = [], billItems = [];
let editingSaleId = null;
let salesTotals = { subTotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, total: 0 };
const esc = (v) => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));
let salesOutsideClickHandler = null;
let barcodeMode = false;

export async function render() {
  try {
    const [allProducts, customers] = await Promise.all([api.products.getAll(), api.customers.getAll()]);
    const isServiceMode = window.currentAppMode === 'service';
    salesProducts = allProducts.filter((p) => isServiceMode ? Boolean(p.is_service) : !p.is_service);
    salesCustomers = customers;
    editingSaleId = null;
    const invNo = await api.sales.getNextNumber();
    renderBillingPage(invNo);
  } catch (error) {
    toast(error?.message || 'Unable to load Sales module. Please check connection and retry.', 'error');
  }
}

function renderBillingPage(invNo, existingInvoice = null) {
  billItems = Array.isArray(existingInvoice?.items)
    ? existingInvoice.items.map((it) => {
      const sourceProduct = salesProducts.find((p) => Number(p.id) === Number(it.product_id));
      const inferredService =
        Number(it.is_service) ||
        Number(sourceProduct?.is_service) ||
        (typeof it.product_id === 'string' && it.product_id.startsWith('SVC-')) ||
        (it.product_id == null && window.currentAppMode === 'service');
      return { ...it, stock: sourceProduct?.stock || 0, is_service: inferredService ? 1 : 0 };
    })
    : [];
  const isEditing = Boolean(existingInvoice?.id);
  const isService = window.currentAppMode === 'service';
  const custOpts = salesCustomers.map(c=>`<option value="${c.id}" data-state="${esc(c.state||'')}" data-gst="${esc(c.gst_no||'')}">${esc(c.name)}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="flex gap-4">
      <div style="flex:1;min-width:0">
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title"><i class="bi bi-receipt" style="margin-right:6px;color:var(--primary-600)"></i>${isEditing ? 'Edit Invoice' : 'New Invoice'}</span>
            <button class="btn btn-sm btn-secondary" onclick="viewAllSales()"><i class="bi bi-list-ul"></i> All Invoices</button>
          </div>
          <div class="card-body">
            <div class="form-grid form-grid-3">
              <div class="form-group"><label class="form-label">Invoice No</label><input class="form-control" id="inv-no" value="${esc(existingInvoice?.invoice_no || invNo)}" /></div>
              <div class="form-group"><label class="form-label">Date *</label><input class="form-control" id="inv-date" type="date" value="${esc(existingInvoice?.date || today())}" /></div>
              <div class="form-group"><label class="form-label">Payment Mode</label>
                <select class="form-control" id="inv-pay"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Credit</option></select>
              </div>
              <div class="form-group"><label class="form-label">Customer</label>
                <select class="form-control" id="inv-cust"><option value="">Walk-in Customer</option>${custOpts}</select>
                <div id="customer-outstanding-warning" style="display:none; margin-top: 6px; padding: 6px 10px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 11px; font-weight: 600; color: #b45309;"></div>
              </div>
              <div class="form-group"><label class="form-label">Notes</label><input class="form-control" id="inv-notes" placeholder="Optional notes..." value="${esc(existingInvoice?.notes || '')}" /></div>
            </div>
          </div>
        </div>

        ${!isService && window.qrBillingEnabled ? `
        <div class="barcode-card card mb-4" id="barcode-section">
          <div class="card-header" style="background:linear-gradient(135deg,#eef2ff,#e0e7ff)">
            <span class="card-title"><i class="bi bi-upc-scan" style="margin-right:8px;color:#6366f1"></i>Barcode / QR Scanner</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;color:var(--gray-500);font-weight:600">MODE:</span>
              <button class="btn btn-sm" id="toggle-barcode-btn" onclick="toggleBarcodeMode()" style="font-size:11px">
                <i class="bi bi-upc-scan"></i> <span id="mode-label">Manual Search</span>
              </button>
            </div>
          </div>
          <div class="card-body" id="barcode-body" style="display:none">
            <div style="display:flex;gap:10px;align-items:center">
              <div style="flex:1;position:relative">
                <i class="bi bi-upc-scan" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#6366f1;font-size:18px;z-index:1"></i>
                <input class="form-control" id="barcode-input" placeholder="Scan barcode or enter product code..." style="padding-left:40px;font-size:15px;font-weight:600;height:46px;border:2px solid #c7d2fe;border-radius:10px" autocomplete="off" />
              </div>
              <div id="barcode-status" style="font-size:12px;color:var(--gray-500);white-space:nowrap"><i class="bi bi-info-circle"></i> Ready to scan</div>
            </div>
          </div>
        </div>` : ''}

        ${!isService ? `<div class="card mb-4 overflow-visible" id="manual-search-section">
          <div class="card-header"><span class="card-title">Add Products</span></div>
          <div class="card-body">
            <div class="search-suggest-anchor">
              <div class="flex gap-2">
                <input class="form-control" id="prod-search-billing" placeholder="Search product by name or code..." style="flex:1" />
                <button class="btn btn-primary" onclick="document.getElementById('prod-search-billing').focus()"><i class="bi bi-search"></i> Search</button>
              </div>
              <div id="prod-suggestions" class="search-suggestions"></div>
              <div id="stock-info-box" style="display:none; margin-top:16px; padding:12px 16px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; align-items:center; justify-content:space-between; animation:fadeInDown 0.3s ease-out">
                <div style="color:#1e3a8a; font-weight:600"><i class="bi bi-box-seam" style="margin-right:6px"></i> <span id="stock-box-name"></span></div>
                <div style="background:#1d4ed8; color:white; padding:4px 12px; border-radius:12px; font-weight:bold; font-size:13px" id="stock-box-qty"></div>
              </div>
            </div>
          </div>
        </div>` : ''}

        ${isService ? `<div class="card mb-4">
          <div class="card-header"><span class="card-title">Add Service Item</span></div>
          <div class="card-body">
            <div class="flex gap-2">
              <input class="form-control" id="manual-service-desc" placeholder="Service description..." style="flex:2" />
              <input class="form-control" id="manual-service-price" type="number" placeholder="Price" style="flex:1" />
              <button class="btn btn-primary" onclick="addManualService()"><i class="bi bi-plus-lg"></i> Add</button>
            </div>
          </div>
        </div>` : ''}

        <div class="card">
          <div class="card-body" style="padding:0">
            <table class="billing-table" id="items-table">
              <thead><tr>
                <th>#</th>
                <th>${isService ? 'Service Description' : 'Product'}</th>
                ${!isService ? '<th>HSN</th><th>Qty</th><th>Unit</th>' : ''}
                <th>Rate</th><th>Disc%</th><th>GST%</th><th>Amount</th><th></th>
              </tr></thead>
              <tbody id="items-tbody"><tr><td colspan="${isService ? 7 : 11}" class="text-center text-muted" style="padding:24px">No items added yet</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="width:280px;flex-shrink:0">
        <div class="card" style="position:sticky;top:0">
          <div class="card-header"><span class="card-title">Bill Summary</span></div>
          <div class="card-body">
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal</span><span id="t-sub">Rs. 0.00</span></div>
              <div class="totals-row"><span>Discount</span><span id="t-disc">Rs. 0.00</span></div>
              <div class="totals-row"><span>GST Base Amt</span><span id="t-tax">Rs. 0.00</span></div>
              <div class="totals-row" id="row-cgst"><span>CGST</span><span id="t-cgst">Rs. 0.00</span></div>
              <div class="totals-row" id="row-sgst"><span>SGST</span><span id="t-sgst">Rs. 0.00</span></div>
              <div class="totals-row grand-total"><span>GRAND TOTAL</span><span id="t-total">Rs. 0.00</span></div>
            </div>
            <div class="form-group mt-3">
              <label class="form-label">Additional Discount</label>
              <input class="form-control" id="extra-disc" type="number" value="0" oninput="recalc()" />
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
              <button class="btn btn-success w-full" style="padding:12px" onclick="saveSaleInvoice()"><i class="bi bi-save-fill"></i> ${isEditing ? 'Update Invoice' : 'Save Invoice'}</button>
              <div style="display:flex;gap:8px">
                <button type="button" class="btn btn-info w-full" onclick="viewCurrentBill()"><i class="bi bi-eye-fill"></i> View</button>
                <button type="button" class="btn btn-primary w-full" onclick="printCurrentBillDirectly()"><i class="bi bi-printer-fill"></i> Print</button>
              </div>
              <button class="btn btn-secondary w-full" onclick="${isEditing ? 'cancelSaleEdit()' : 'clearBill()'}"><i class="bi bi-trash"></i> ${isEditing ? 'Cancel Edit' : 'Clear'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="sales-list-area" class="hidden"></div>`;

  if (existingInvoice) {
    document.getElementById('inv-cust').value = existingInvoice.customer_id || '';
    document.getElementById('inv-pay').value = existingInvoice.payment_mode || 'Cash';
  }

  const custSelect = document.getElementById('inv-cust');
  if (custSelect) {
    custSelect.addEventListener('change', async (e) => {
      const cid = e.target.value;
      const warningDiv = document.getElementById('customer-outstanding-warning');
      if (!cid || !warningDiv) return;
      try {
        const data = await api.customers.getOutstanding(Number(cid));
        if (data && data.outstanding_balance > 0) {
          warningDiv.style.display = 'block';
          warningDiv.innerHTML = `<i class="bi bi-exclamation-triangle-fill" style="margin-right:4px"></i> Outstanding: ₹${data.outstanding_balance.toLocaleString('en-IN', {minimumFractionDigits:2})}`;
          if (data.credit_limit > 0 && data.outstanding_balance > data.credit_limit) {
            warningDiv.style.background = '#fef2f2';
            warningDiv.style.borderLeftColor = '#ef4444';
            warningDiv.style.color = '#b91c1c';
            warningDiv.innerHTML += ` (Exceeds Limit: ₹${data.credit_limit})`;
          } else {
             warningDiv.style.background = '#fffbeb';
             warningDiv.style.borderLeftColor = '#f59e0b';
             warningDiv.style.color = '#b45309';
          }
        } else {
          warningDiv.style.display = 'none';
        }
      } catch (err) {
        warningDiv.style.display = 'none';
      }
    });
    // Trigger on load for editing
    if (custSelect.value) custSelect.dispatchEvent(new Event('change'));
  }

  const searchInput = document.getElementById('prod-search-billing');
  if (!searchInput) {
    if (salesOutsideClickHandler) {
      document.removeEventListener('click', salesOutsideClickHandler);
      salesOutsideClickHandler = null;
    }
    recalc();
    return;
  }
  const renderProdDropdown = () => {
    const q = searchInput.value.toLowerCase();
    let matches = salesProducts;
    if (q) matches = matches.filter(p=>p.name.toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q));
    matches = matches.slice(0, 30);
    document.getElementById('prod-suggestions').innerHTML = matches.length ? `
      <div class="search-suggestions-list">
        ${matches.map(p=>`<div class="prod-suggest-item" onclick="addItemToTable(${p.id})" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray-100);transition:background 0.15s" onmouseover="this.style.background='var(--primary-50)'" onmouseout="this.style.background=''">
          <strong>${p.name}</strong>
          <span style="color:var(--gray-500);font-size:12px;margin-left:4px">${p.code?'Code: '+p.code+' | ':''}${isService ? '' : ('Stock: ' + p.stock + ' ' + p.unit + ' | ')} Rs.${p.selling_price} | GST: ${p.gst_percent}%</span>
        </div>`).join('')}
      </div>` : `<div class="search-suggestions-list" style="padding:10px;color:var(--gray-500)">No products found</div>`;
  };

  searchInput.addEventListener('focus', renderProdDropdown);
  searchInput.addEventListener('click', renderProdDropdown);
  searchInput.addEventListener('input', renderProdDropdown);

  if (salesOutsideClickHandler) document.removeEventListener('click', salesOutsideClickHandler);
  salesOutsideClickHandler = (e) => {
    if (!e.target.closest('#prod-search-billing') && !e.target.closest('#prod-suggestions')) {
      const sugg = document.getElementById('prod-suggestions');
      if (sugg) sugg.innerHTML = '';
    }
  };
  document.addEventListener('click', salesOutsideClickHandler);

  // Wire barcode input
  const barcodeInput = document.getElementById('barcode-input');
  if (barcodeInput) {
    let scanTimer = null;
    barcodeInput.addEventListener('input', () => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        const code = barcodeInput.value.trim();
        if (code) processBarcodeInput(code);
      }, 150); // 150ms debounce for barcode scanners
    });
    barcodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(scanTimer);
        const code = barcodeInput.value.trim();
        if (code) processBarcodeInput(code);
      }
    });
    // Apply saved barcode mode state
    if (barcodeMode) {
      activateBarcodeMode();
    }
  }

  recalc();
}

window.addManualService = function() {
  const desc = document.getElementById('manual-service-desc')?.value?.trim();
  const price = document.getElementById('manual-service-price')?.value;
  if (!desc || !price) { toast('Please enter service description and price', 'warning'); return; }
  billItems.push({
    product_id: null,
    product_name: desc,
    hsn_code: '9983',
    qty: 1,
    unit: 'SVC',
    price: Number(price) || 0,
    discount: 0,
    gst_percent: 18,
    cgst: 0,
    sgst: 0,
    amount: 0,
    is_service: 1
  });
  document.getElementById('manual-service-desc').value = '';
  document.getElementById('manual-service-price').value = '';
  renderItemsTable();
  recalc();
};

// ─── BARCODE / QR SCANNING ─────────────────────────────────────────────────

window.processBarcodeInput = function(code) {
  const barcodeInput = document.getElementById('barcode-input');
  const statusEl = document.getElementById('barcode-status');

  // Match product by code (case-insensitive)
  const product = salesProducts.find(p =>
    (p.code || '').toLowerCase() === code.toLowerCase()
  );

  if (!product) {
    if (statusEl) statusEl.innerHTML = `<i class="bi bi-x-circle" style="color:var(--danger)"></i> <span style="color:var(--danger)">No product found for: <strong>${code}</strong></span>`;
    toast(`Product not found for code: ${code}`, 'error');
    if (barcodeInput) { barcodeInput.value = ''; barcodeInput.focus(); }
    return;
  }

  // Check if product already in bill -> increment qty
  const existing = billItems.find(i => Number(i.product_id) === Number(product.id));
  if (existing) {
    existing.qty++;
    if (statusEl) statusEl.innerHTML = `<i class="bi bi-plus-circle" style="color:var(--success)"></i> <strong>${product.name}</strong> — Qty: ${existing.qty}`;
  } else {
    billItems.push({
      product_id: product.id, product_name: product.name, hsn_code: product.hsn_code || '',
      stock: product.stock || 0, qty: 1, unit: product.unit, price: product.selling_price, discount: 0,
      gst_percent: product.gst_percent, cgst: 0, sgst: 0, amount: 0,
      is_service: product.is_service ? 1 : 0
    });
    if (statusEl) statusEl.innerHTML = `<i class="bi bi-check-circle" style="color:var(--success)"></i> Added: <strong>${product.name}</strong> — ₹${product.selling_price}`;
  }

  // Show stock info + MRP
  const stockBox = document.getElementById('stock-info-box');
  if (stockBox && product) {
    stockBox.style.display = 'flex';
    document.getElementById('stock-box-name').textContent = "Scanned: " + product.name + (product.mrp ? ` (MRP ₹${product.mrp})` : '');
    document.getElementById('stock-box-qty').textContent = "Stock: " + (product.stock || 0) + " " + product.unit;
  }

  // Clear & refocus for next scan
  if (barcodeInput) { barcodeInput.value = ''; barcodeInput.focus(); }
  renderItemsTable();
  recalc();
  toast(`✓ ${product.name} added`, 'success');
};

window.toggleBarcodeMode = function() {
  barcodeMode = !barcodeMode;
  if (barcodeMode) {
    activateBarcodeMode();
  } else {
    // Switch to Manual Search
    const barcodeBody = document.getElementById('barcode-body');
    const manualSection = document.getElementById('manual-search-section');
    const modeLabel = document.getElementById('mode-label');
    const toggleBtn = document.getElementById('toggle-barcode-btn');
    if (barcodeBody) barcodeBody.style.display = 'none';
    if (manualSection) manualSection.style.display = '';
    if (modeLabel) modeLabel.textContent = 'Manual Search';
    if (toggleBtn) { toggleBtn.classList.remove('btn-primary'); toggleBtn.classList.add('btn-secondary'); }
    const searchInput = document.getElementById('prod-search-billing');
    if (searchInput) searchInput.focus();
  }
};

function activateBarcodeMode() {
  const barcodeBody = document.getElementById('barcode-body');
  const manualSection = document.getElementById('manual-search-section');
  const modeLabel = document.getElementById('mode-label');
  const toggleBtn = document.getElementById('toggle-barcode-btn');
  if (barcodeBody) barcodeBody.style.display = 'block';
  if (manualSection) manualSection.style.display = 'none';
  if (modeLabel) modeLabel.textContent = 'Barcode Mode';
  if (toggleBtn) { toggleBtn.classList.remove('btn-secondary'); toggleBtn.classList.add('btn-primary'); }
  const barcodeInput = document.getElementById('barcode-input');
  if (barcodeInput) setTimeout(() => barcodeInput.focus(), 100);
}

window.addItemToTable = function(productId) {
  const p = salesProducts.find((x) => Number(x.id) === Number(productId));
  if (!p) return;
  const existing = billItems.find((i) => Number(i.product_id) === Number(p.id));
  if (existing) { existing.qty++; }
  else {
    billItems.push({
      product_id:p.id, product_name:p.name, hsn_code:p.hsn_code||'',
      stock:p.stock||0, qty:1, unit:p.unit, price:p.selling_price, discount:0,
      gst_percent:p.gst_percent, cgst:0, sgst:0, amount:0,
      is_service:p.is_service ? 1 : 0
    });
  }
  document.getElementById('prod-search-billing').value='';
  document.getElementById('prod-suggestions').innerHTML='';
  const stockBox = document.getElementById('stock-info-box');
  if (stockBox && p) {
    stockBox.style.display = 'flex';
    document.getElementById('stock-box-name').textContent = "Selected: " + p.name;
    document.getElementById('stock-box-qty').textContent = "Available Stock: " + (p.stock || 0) + " " + p.unit;
  }
  renderItemsTable();
  recalc();
};

function renderItemsTable() {
  const isService = window.currentAppMode === 'service';
  document.getElementById('items-tbody').innerHTML = billItems.length ? billItems.map((item,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><strong>${item.product_name}</strong></td>
      ${!isService ? `<td><span class="badge badge-gray">${item.hsn_code||'-'}</span></td>
      <td><input type="number" value="${item.qty}" min="0.01" step="0.01" onchange="updateItem(${i},'qty',this.value)" style="width:60px" /></td>
      <td>${item.unit}</td>` : ''}
      <td><input type="number" value="${item.price}" step="0.01" onchange="updateItem(${i},'price',this.value)" style="width:80px" /></td>
      <td><input type="number" value="${item.discount}" min="0" max="100" onchange="updateItem(${i},'discount',this.value)" style="width:55px" /></td>
      <td><span class="badge badge-primary">${item.gst_percent}%</span></td>
      <td><strong>${fmtCur(item.amount)}</strong></td>
      <td><button class="btn btn-sm btn-danger" onclick="removeItem(${i})">x</button></td>
    </tr>`).join('') : `<tr><td colspan="${isService ? 7 : 11}" class="text-center text-muted" style="padding:24px">No items added yet</td></tr>`;
}

window.updateItem = function(i, field, val) {
  const parsed = Number.parseFloat(val);
  if (!Number.isFinite(parsed)) return;
  if (field === 'qty') billItems[i][field] = Math.max(0.01, parsed);
  else if (field === 'price') billItems[i][field] = Math.max(0, parsed);
  else if (field === 'discount') billItems[i][field] = Math.min(100, Math.max(0, parsed));
  recalc();
};
window.removeItem = function(i) { billItems.splice(i,1); recalc(); };

window.recalc = function() {
  const inputExtraDiscount = parseFloat(document.getElementById('extra-disc')?.value)||0;
  let subTotal=0, lineDiscount=0, lineTaxable=0, totalCgst=0, totalSgst=0;
  billItems.forEach(item=>{
    const base = item.qty * item.price;
    const discAmt = base * (item.discount/100);
    const taxable = base - discAmt;
    const gstAmt = taxable * (item.gst_percent/100);
    item.cgst = gstAmt/2; item.sgst = gstAmt/2;
    item.amount = taxable + gstAmt;
    subTotal += base;
    lineDiscount += discAmt;
    lineTaxable += taxable;
    totalCgst += item.cgst;
    totalSgst += item.sgst;
  });

  const extraDisc = Math.min(Math.max(inputExtraDiscount, 0), lineTaxable);
  const taxable = lineTaxable - extraDisc;
  const discountRatio = lineTaxable > 0 ? (taxable / lineTaxable) : 0;
  const cgst = totalCgst * discountRatio;
  const sgst = totalSgst * discountRatio;
  const grandTotal = taxable + cgst + sgst;
  salesTotals = { subTotal, discount: lineDiscount + extraDisc, taxable, cgst, sgst, total: grandTotal };

  const extraDiscInput = document.getElementById('extra-disc');
  if (extraDiscInput && Number(extraDiscInput.value || 0) !== extraDisc) extraDiscInput.value = String(extraDisc);
  document.getElementById('t-sub').textContent = fmtCur(subTotal);
  document.getElementById('t-disc').textContent = fmtCur(lineDiscount + extraDisc);
  document.getElementById('t-tax').textContent = fmtCur(taxable);
  document.getElementById('t-cgst').textContent = fmtCur(cgst);
  document.getElementById('t-sgst').textContent = fmtCur(sgst);
  document.getElementById('t-total').textContent = fmtCur(grandTotal);
  renderItemsTable();
};

window.clearBill = function() {
  billItems = [];
  document.getElementById('inv-cust').value = '';
  document.getElementById('extra-disc').value = '0';
  recalc();
};

window.getCurrentInvoiceObject = function() {
  const { subTotal, discount, taxable, cgst, sgst, total } = salesTotals;
  const custSel = document.getElementById('inv-cust');
  const custId = custSel.value;
  const custName = custId ? custSel.options[custSel.selectedIndex].text : '';
  const custGst = custId ? custSel.options[custSel.selectedIndex].getAttribute('data-gst') : '';
  return {
    id: editingSaleId,
    invoice_no: document.getElementById('inv-no').value,
    date: document.getElementById('inv-date').value,
    customer_id: custId || null,
    customer_name: custName,
    customer_gst: custGst,
    sub_total: subTotal, discount, taxable_amount: taxable,
    cgst, sgst, total,
    payment_mode: document.getElementById('inv-pay').value,
    notes: document.getElementById('inv-notes').value,
    items: billItems
  };
};

window.cancelSaleEdit = async function() {
  editingSaleId = null;
  const invNo = await api.sales.getNextNumber();
  renderBillingPage(invNo);
};

window.editSale = async function(id) {
  const inv = await api.sales.getById(id);
  if (!inv) { toast('Invoice not found', 'error'); return; }
  editingSaleId = inv.id;
  renderBillingPage(inv.invoice_no, inv);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`Editing invoice ${inv.invoice_no}`, 'info');
};

window.viewCurrentBill = async function() {
  if (billItems.length === 0) { toast('Add at least one item to view', 'error'); return; }
  const inv = window.getCurrentInvoiceObject();
  const co = await api.company.get();
  const modal = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.style.maxWidth = '860px';
  box.innerHTML = `
    <div class="modal-header no-print">
      <span class="modal-title"><i class="bi bi-receipt" style="margin-right:6px"></i>Preview Invoice #${inv.invoice_no}</span>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" onclick="printCurrentBillDirectly()"><i class="bi bi-printer-fill"></i> Print</button>
        <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="modal-body" style="padding:0" id="invoice-modal-body">
      ${buildInvoicePreviewHTML(inv, co, 'INVOICE')}
    </div>`;
  modal.classList.remove('hidden');
};

window.printCurrentBillDirectly = async function() {
  if (billItems.length === 0) { toast('Add at least one item to print', 'error'); return; }
  const inv = window.getCurrentInvoiceObject();
  const co = await api.company.get();
  window.printHTMLContent(buildInvoicePreviewHTML(inv, co, 'INVOICE'), 'Invoice');
};

window.saveSaleInvoice = async function() {
  if (billItems.length===0) { toast('Add at least one item','error'); return; }
  const obj = window.getCurrentInvoiceObject();
  if (!obj.invoice_no || !obj.date) { toast('Invoice number and date are required', 'error'); return; }
  try {
    const invoice = {
      id: obj.id,
      invoice_no: obj.invoice_no, date: obj.date, customer_id: obj.customer_id,
      sub_total: obj.sub_total, discount: obj.discount, taxable_amount: obj.taxable_amount,
      cgst: obj.cgst, sgst: obj.sgst, total: obj.total,
      payment_mode: obj.payment_mode, notes: obj.notes
    };
    const invId = await api.sales.save({ invoice, items: obj.items });
    toast(obj.id ? 'Invoice updated successfully!' : 'Invoice saved successfully!');
    const inv = await api.sales.getById(invId);
    const co = await api.company.get();
    window.printHTMLContent(buildInvoicePreviewHTML(inv, co, 'INVOICE'), 'Invoice');
    const allProducts = await api.products.getAll();
    const isServiceMode = window.currentAppMode === 'service';
    salesProducts = allProducts.filter(p => isServiceMode ? Boolean(p.is_service) : !p.is_service);
    const newInvNo = await api.sales.getNextNumber();
    editingSaleId = null;
    renderBillingPage(newInvNo);
  } catch (error) {
    toast(error?.message || 'Failed to save invoice', 'error');
  }
};

window.viewAllSales = async function() {
  const all = await api.sales.getAll();
  const area = document.getElementById('sales-list-area');
  area.classList.remove('hidden');
  area.innerHTML = `
    <div class="card mt-4">
      <div class="card-header">
        <span class="card-title"><i class="bi bi-receipt" style="margin-right:6px;color:var(--primary-600)"></i>All Sales Invoices</span>
        <span class="badge badge-primary">${all.length} records</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Invoice No</th><th>Date</th><th>Customer</th><th class="text-right">Total</th><th class="text-right">GST</th><th>Mode</th><th style="min-width:280px">Actions</th></tr></thead>
          <tbody>${all.map(s=>`
            <tr>
              <td><strong style="color:var(--primary-700)">${s.invoice_no}</strong></td>
              <td>${s.date}</td>
              <td>${s.customer_name||'<span class="badge badge-gray">Walk-in</span>'}</td>
              <td class="text-right"><strong>${fmtCur(s.total)}</strong></td>
              <td class="text-right">${fmtCur((s.cgst||0)+(s.sgst||0))}</td>
              <td><span class="badge badge-info">${s.payment_mode}</span></td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-warning" onclick="editSale(${s.id})"><i class="bi bi-pencil-fill"></i> Edit</button>
                  <button class="btn btn-sm btn-secondary" onclick="viewSaleById(${s.id})"><i class="bi bi-eye-fill"></i> View</button>
                  <button class="btn btn-sm btn-primary" onclick="printSaleById(${s.id})"><i class="bi bi-printer-fill"></i> Print</button>
                  <button class="btn btn-sm btn-danger admin-only" onclick="deleteSale(${s.id})"><i class="bi bi-trash-fill"></i></button>
                </div>
              </td>
            </tr>`).join('')||'<tr><td colspan="7" class="text-center text-muted" style="padding:32px">No invoices found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
};

window.viewSaleById = async function(id) {
  const inv = await api.sales.getById(id);
  const co = await api.company.get();
  const modal = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.style.maxWidth = '860px';
  box.innerHTML = `
    <div class="modal-header no-print">
      <span class="modal-title"><i class="bi bi-receipt" style="margin-right:6px"></i>Invoice #${inv.invoice_no}</span>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-warning" onclick="document.getElementById('modal-overlay').classList.add('hidden');editSale(${inv.id})"><i class="bi bi-pencil-fill"></i> Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="printInvoiceModal()"><i class="bi bi-printer-fill"></i> Print</button>
        <button class="btn btn-sm btn-danger admin-only" onclick="deleteSale(${inv.id});document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-trash-fill"></i></button>
        <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="modal-body" style="padding:0" id="invoice-modal-body">
      ${buildInvoicePreviewHTML(inv, co, 'INVOICE')}
    </div>`;
  modal.classList.remove('hidden');
};

function amountInWords(value) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const toWords = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + toWords(n % 100) : ''}`;
    if (n < 100000) return `${toWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + toWords(n % 1000) : ''}`;
    if (n < 10000000) return `${toWords(Math.floor(n / 100000))} Lakh${n % 100000 ? ' ' + toWords(n % 100000) : ''}`;
    return `${toWords(Math.floor(n / 10000000))} Crore${n % 10000000 ? ' ' + toWords(n % 10000000) : ''}`;
  };

  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Zero Rupees Only';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const rupeesText = `${toWords(rupees)} Rupees`;
  const paiseText = paise > 0 ? ` and ${toWords(paise)} Paise` : '';
  return `${rupeesText}${paiseText} Only`;
}

function buildInvoicePreviewHTML(inv, co, titleText) {
  const isService = window.currentAppMode === 'service';
  const tpl = co?.invoice_template || 'standard';

  const colGroupHtml = isService
    ? `<colgroup><col style="width:40px"/><col/><col style="width:100px"/><col style="width:80px"/><col style="width:80px"/><col style="width:100px"/></colgroup>`
    : `<colgroup><col style="width:40px"/><col/><col style="width:70px"/><col style="width:70px"/><col style="width:90px"/><col style="width:80px"/><col style="width:80px"/><col style="width:100px"/></colgroup>`;

  const logoHtml = co?.logo
    ? `<img src="${co.logo}" class="bill-logo" style="max-width:80px;max-height:70px;object-fit:contain" />`
    : `<div style="width:60px;height:60px;border-radius:8px;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">MS</div>`;

  const items = (inv.items || []).map((it, i) => {
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    const discount = Number(it.discount || 0);
    const taxAmt = Number(it.cgst || 0) + Number(it.sgst || 0);
    const amount = Number(it.amount || 0);
    return `<tr>
      <td>${i + 1}</td>
      <td>${esc(it.product_name || '')}</td>
      ${!isService ? `<td>${esc(it.hsn_code || '-')}</td><td class="num">${qty.toFixed(2)}</td>` : ''}
      <td class="num">${price.toFixed(2)}</td>
      <td class="num">${discount.toFixed(2)}%</td>
      <td class="num">${taxAmt.toFixed(2)}</td>
      <td class="num font-bold">${amount.toFixed(2)}</td>
    </tr>`;
  }).join('');

  if (tpl === 'custom' && co?.custom_template_html && co.custom_template_html.trim() !== '') {
    let html = co.custom_template_html;
    html = html.replace(/\{\{company\.name\}\}/g, esc(co?.name || 'Company Name'));
    html = html.replace(/\{\{company\.address\}\}/g, esc(co?.address || ''));
    html = html.replace(/\{\{company\.phone\}\}/g, esc(co?.phone || ''));
    html = html.replace(/\{\{company\.email\}\}/g, esc(co?.email || ''));
    html = html.replace(/\{\{company\.gst_no\}\}/g, esc(co?.gst_no || ''));
    html = html.replace(/\{\{invoice\.invoice_no\}\}/g, esc(inv.invoice_no || inv.bill_no || inv.quote_no || ''));
    html = html.replace(/\{\{invoice\.date\}\}/g, esc(inv.date || ''));
    html = html.replace(/\{\{invoice\.payment_mode\}\}/g, esc(inv.payment_mode || ''));
    html = html.replace(/\{\{customer\.name\}\}/g, esc(inv.customer_name || inv.supplier_name || 'Walk-in'));
    html = html.replace(/\{\{customer\.address\}\}/g, esc(inv.customer_address || inv.supplier_address || ''));
    html = html.replace(/\{\{customer\.gst_no\}\}/g, esc(inv.customer_gst || inv.supplier_gst || ''));
    html = html.replace(/\{\{invoice\.sub_total\}\}/g, Number(inv.sub_total || 0).toFixed(2));
    html = html.replace(/\{\{invoice\.discount\}\}/g, Number(inv.discount || 0).toFixed(2));
    html = html.replace(/\{\{invoice\.cgst\}\}/g, Number(inv.cgst || 0).toFixed(2));
    html = html.replace(/\{\{invoice\.sgst\}\}/g, Number(inv.sgst || 0).toFixed(2));
    html = html.replace(/\{\{invoice\.total\}\}/g, Number(inv.total || 0).toFixed(2));
    html = html.replace(/\{\{invoice\.total_words\}\}/g, amountInWords(inv.total || 0));
    html = html.replace(/\{\{company\.terms\}\}/g, esc(co?.terms_conditions || ''));
    html = html.replace(/\{\{table_body\}\}/g, items);
    return html;
  }

  const headerDetails = `
    <div style="flex:1">
      <div class="bill-company" style="font-size:24px;font-weight:800">${esc(co?.name || 'Company Name')}</div>
      ${co?.address ? `<div class="bill-small">${esc(co.address)}</div>` : ''}
      ${co?.phone ? `<div class="bill-small">Phone: ${esc(co.phone)}</div>` : ''}
      ${co?.email ? `<div class="bill-small">Email: ${esc(co.email)}</div>` : ''}
      ${co?.gst_no ? `<div class="bill-small">GSTIN: ${esc(co.gst_no)}</div>` : ''}
    </div>`;

  const metaHtml = `
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:900;letter-spacing:1px;margin-bottom:8px">${titleText}</div>
      <div class="bill-small"><strong>${titleText === 'INVOICE' ? 'Invoice #' : 'Doc #'}</strong> ${esc(inv.invoice_no || inv.bill_no || inv.quote_no || '')}</div>
      <div class="bill-small"><strong>Date:</strong> ${esc(inv.date || '')}</div>
      ${inv.payment_mode ? `<div class="bill-small"><strong>Payment:</strong> ${esc(inv.payment_mode)}</div>` : ''}
    </div>`;

  const partyHtml = `
    <div style="flex:1">
      <div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;margin-bottom:4px">Bill To</div>
      <div style="font-size:16px;font-weight:700">${esc(inv.customer_name || inv.supplier_name || 'Walk-in Customer')}</div>
      ${inv.customer_address ? `<div class="bill-small">${esc(inv.customer_address)}</div>` : ''}
      ${(inv.customer_gst || inv.supplier_gst) ? `<div class="bill-small">GSTIN: ${esc(inv.customer_gst || inv.supplier_gst)}</div>` : ''}
    </div>
    <div style="flex:1;text-align:right">
      <div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;margin-bottom:4px">Details</div>
      <div class="bill-small"><strong>Reference:</strong> ${esc(inv.invoice_no || inv.bill_no || inv.quote_no || '')}</div>
      ${inv.notes ? `<div class="bill-small"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ''}
    </div>`;

  const tableHeader = `
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Description</th>
        ${!isService ? '<th>HSN</th><th class="num">Qty</th>' : ''}
        <th class="num">Unit Price</th>
        <th class="num">Discount</th>
        <th class="num">GST</th>
        <th class="num">Amount</th>
      </tr>
    </thead>`;

  const totalsHtml = `
    <div class="bill-total-row"><span>Subtotal</span><span>Rs. ${Number(inv.sub_total || 0).toFixed(2)}</span></div>
    ${Number(inv.discount || 0) > 0 ? `<div class="bill-total-row"><span>Discount</span><span>- Rs. ${Number(inv.discount).toFixed(2)}</span></div>` : ''}
    <div class="bill-total-row"><span>CGST</span><span>Rs. ${Number(inv.cgst || 0).toFixed(2)}</span></div>
    <div class="bill-total-row"><span>SGST</span><span>Rs. ${Number(inv.sgst || 0).toFixed(2)}</span></div>
    <div class="bill-total-final"><span>TOTAL</span><span>Rs. ${Number(inv.total || 0).toFixed(2)}</span></div>`;

  const emptyTableBody = items || `<tr><td colspan="${isService ? 6 : 8}" class="text-center" style="padding:14px">No items added</td></tr>`;

  if (tpl === 'compact') {
    return `
      <style>
        .compact-inv { font-family: 'Inter', -apple-system, sans-serif; font-size: 11px; line-height: 1.4; width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; box-shadow: 0 5px 15px rgba(0,0,0,0.08); padding: 40px; color: #000; box-sizing: border-box; }
        .compact-inv .num { text-align: right; }
        .compact-inv .font-bold { font-weight: bold; }
        .compact-inv .bill-small { font-size: 10px; margin-top: 3px; color: #333; }
        .compact-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .compact-table th { border-bottom: 2px solid #000; padding: 8px 4px; text-align: left; font-size: 10px; text-transform: uppercase; }
        .compact-table td { border-bottom: 1px dashed #ccc; padding: 8px 4px; vertical-align: top; }
        .compact-totals { border-top: 2px solid #000; padding-top: 8px; width: 280px; margin-left: auto; margin-top: 10px; }
        .compact-total-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .compact-total-row span:last-child { font-weight: bold; }
        @media print { .compact-inv { box-shadow: none; padding: 0; } }
      </style>
      <div class="compact-inv">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:10px">
          ${logoHtml}
          ${headerDetails}
          ${metaHtml}
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          ${partyHtml}
        </div>
        <table class="compact-table">${colGroupHtml}${tableHeader}<tbody>${emptyTableBody}</tbody></table>
        <div class="compact-totals">
          ${totalsHtml.replace(/bill-total-row/g, 'compact-total-row').replace(/bill-total-final/g, 'compact-total-row')}
        </div>
        <div style="margin-top:10px;font-size:10px"><strong>In Words:</strong> ${amountInWords(inv.total||0)}</div>
        <div style="margin-top:20px;text-align:right">Authorized Signatory</div>
        ${co?.terms_conditions ? `<div style="margin-top:20px;font-size:9px;border-top:1px solid #000;padding-top:4px"><strong>Terms:</strong><br/>${esc(co.terms_conditions).replace(/\\n/g,'<br/>')}</div>` : ''}
      </div>
    `;
  }

  if (tpl === 'modern') {
    return `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @page { size: A4 portrait; margin: 0; }
        .modern-inv { font-family: 'Inter', -apple-system, sans-serif; font-size: 13px; width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; color: #1e293b; position: relative; display: flex; flex-direction: column; }
        .modern-inv .num { text-align: right; }
        .modern-inv .font-bold { font-weight: 700; color: #0f172a; }
        .modern-inv .bill-small { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.5; }
        .modern-top { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%); color: #fff; padding: 40px; display: flex; justify-content: space-between; gap: 20px; border-bottom: 4px solid #4f46e5; }
        .modern-top .bill-company { color: #fff; font-size: 26px; }
        .modern-top .bill-small { color: #cbd5e1; }
        .modern-parties { padding: 30px 40px; display: flex; justify-content: space-between; gap: 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .modern-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .modern-table th { background: #f1f5f9; padding: 14px 20px; color: #334155; text-transform: uppercase; font-size: 11px; font-weight: 800; border-bottom: 2px solid #cbd5e1; text-align: left; letter-spacing: 0.5px; }
        .modern-table td { padding: 14px 20px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 13px; }
        .modern-totals-wrap { display: flex; justify-content: flex-end; padding: 30px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .modern-totals { width: 340px; }
        .bill-total-row { display: flex; justify-content: space-between; padding: 8px 0; color: #475569; font-size: 14px; }
        .bill-total-row span:last-child { color: #0f172a; font-weight: 700; }
        .bill-total-final { display: flex; justify-content: space-between; padding: 16px 0; margin-top: 12px; border-top: 2px dashed #cbd5e1; font-size: 20px; font-weight: 900; color: #4f46e5; }
        .modern-footer { padding: 40px; display: flex; justify-content: space-between; align-items: flex-end; flex: 1; }
        @media print { .modern-inv { box-shadow: none; } }
      </style>
      <div class="modern-inv">
        <div class="modern-top">
          <div style="display:flex;gap:16px;align-items:center">${logoHtml.replace('111827', 'fff').replace('color:#fff', 'color:#111827')}${headerDetails}</div>
          ${metaHtml}
        </div>
        <div class="modern-parties">${partyHtml}</div>
        <table class="modern-table">${colGroupHtml}${tableHeader}<tbody>${emptyTableBody}</tbody></table>
        <div class="modern-totals-wrap"><div class="modern-totals">${totalsHtml}</div></div>
        <div class="modern-footer">
          <div>
            <div style="font-size:12px;margin-bottom:4px"><strong>Amount in Words:</strong><br/>${amountInWords(inv.total||0)}</div>
            ${co?.terms_conditions ? `<div style="font-size:11px;color:#64748b;max-width:400px;margin-top:12px"><strong>Terms:</strong><br/>${esc(co.terms_conditions).replace(/\\n/g,'<br/>')}</div>` : ''}
          </div>
          <div style="text-align:center;min-width:180px">
            <div style="height:40px"></div>
            <div style="border-top:1px solid #94a3b8;padding-top:6px;font-weight:600">Authorized Signatory</div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="invoice-preview bill-layout">
      <div class="bill-top">
        <div class="bill-brand">
          ${logoHtml}
          ${headerDetails}
        </div>
        ${metaHtml}
      </div>
      <div class="bill-parties" style="display:flex;padding:20px;border-bottom:1px solid #d1d5db;gap:40px">
        ${partyHtml}
      </div>
      <table class="bill-items-table">${colGroupHtml}${tableHeader}<tbody>${emptyTableBody}</tbody></table>
      <div class="bill-totals">${totalsHtml}</div>
      <div class="bill-amount-words"><strong>Amount in Words:</strong> ${esc(amountInWords(inv.total || 0))}</div>
      ${co?.terms_conditions ? `<div style="padding:0 20px 10px;font-size:11px;color:#4b5563"><strong>Terms & Conditions:</strong><br/>${esc(co.terms_conditions).replace(/\\n/g,'<br/>')}</div>` : ''}
      <div class="bill-sign-row mt-4">
        <div class="bill-small" style="margin-top:auto">Checked By: __________________</div>
        <div class="bill-signature">Authorized Signatory</div>
      </div>
      <div class="bill-footer">Thank you for your business.</div>
    </div>`;
}
window.buildInvoicePreviewHTML = buildInvoicePreviewHTML;
window.printHTMLContent = function(content, title = 'Document') {
  if (!content) return;
  const win = window.open('', '_blank', 'width=900,height=980');
  if (!win) {
    toast('Unable to open print window. Please try again.', 'error');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A4 portrait; margin: 0; }
      body { font-family: 'Inter', -apple-system, sans-serif; background: #f1f5f9; color: #0f172a; font-size: 13px; padding: 20px; display: flex; justify-content: center; }
      .invoice-preview.bill-layout { width: 210mm; min-height: 297mm; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.1); display: flex; flex-direction: column; position: relative; }
      .bill-top { display:flex; justify-content:space-between; gap:20px; padding:40px; border-bottom:1px solid #e2e8f0; }
      .bill-brand { display:flex; align-items:flex-start; gap:16px; }
      .bill-logo { width:90px; max-height:80px; object-fit:contain; }
      .bill-logo-placeholder { width:80px; height:80px; border-radius:12px; background:linear-gradient(135deg, #0f172a, #334155); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:24px; }
      .bill-company { font-size:26px; font-weight:800; line-height:1.2; margin-bottom:6px; color: #0f172a; }
      .bill-doc-meta { text-align:right; }
      .bill-doc-title { font-size:38px; font-weight:900; letter-spacing:1px; margin-bottom:12px; color: #1e293b; text-transform: uppercase; }
      .bill-small { font-size:12px; color:#475569; margin-top:3px; line-height: 1.5; }
      .bill-parties { display:grid; grid-template-columns:1fr 1fr; gap:0; border-bottom:1px solid #e2e8f0; background: #f8fafc; }
      .bill-parties > div { padding:24px 40px; }
      .bill-parties > div:first-child { border-right:1px solid #e2e8f0; }
      .bill-label { font-size:11px; font-weight:800; text-transform:uppercase; color:#64748b; margin-bottom:8px; letter-spacing: 0.5px; }
      .bill-party-name { font-size:16px; font-weight:800; color: #0f172a; margin-bottom: 4px; }
      .bill-items-table { width:100%; border-collapse:collapse; table-layout: fixed; margin-top: 10px; }
      .bill-items-table th { background:#0f172a; color:#fff; padding:12px 20px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
      .bill-items-table td { border-bottom:1px solid #e2e8f0; padding:14px 20px; font-size:13px; vertical-align: top; color: #334155; }
      .bill-items-table tbody tr:nth-child(even) td { background:#f8fafc; }
      .num { text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums; }
      .font-bold { font-weight: 700; color: #0f172a; }
      .bill-totals { width:360px; margin-left:auto; padding:20px 40px; background: #fff; }
      .bill-total-row { display:flex; justify-content:space-between; padding:6px 0; color: #475569; font-size: 14px; }
      .bill-total-row span:last-child { text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums; color: #0f172a; font-weight: 600; }
      .bill-total-final { display: flex; justify-content: space-between; font-size:20px; font-weight:900; border-top:2px dashed #cbd5e1; margin-top:10px; padding-top:14px; color: #0f172a; }
      .bill-amount-words { margin: 10px 40px 20px; padding: 14px 20px; background: #f8fafc; border-left: 4px solid #3b82f6; font-size: 13px; color: #334155; }
      .bill-sign-row { display: flex; justify-content: space-between; align-items: flex-end; padding: 20px 40px; margin-top: auto; }
      .bill-signature { min-width: 200px; text-align: center; border-top: 1px solid #0f172a; padding-top: 8px; font-weight: 700; color: #0f172a; }
      .bill-footer { text-align:center; padding:16px 40px 24px; color:#64748b; font-size: 12px; }
      @media print { 
        body { padding: 0; background: #fff; } 
        .invoice-preview.bill-layout { box-shadow: none; border: none; }
      }
    </style>
  </head><body>${content}</body></html>`);
  win.document.close();
  setTimeout(()=>{ win.focus(); win.print(); }, 500);
};

window.printInvoiceModal = function() {
  window.printHTMLContent(document.getElementById('invoice-modal-body')?.innerHTML, 'Invoice');
};

window.printSaleById = async function(id) {
  const inv = await api.sales.getById(id);
  const co = await api.company.get();
  window.printHTMLContent(buildInvoicePreviewHTML(inv, co, 'INVOICE'), 'Invoice');
};

window.deleteSale = async function(id) {
  if (!(await confirmModal('Delete Invoice', 'Are you sure you want to delete this invoice? Stock will be restored.'))) return;
  await api.sales.delete(id);
  toast('Invoice deleted');
  window.viewAllSales();
};
