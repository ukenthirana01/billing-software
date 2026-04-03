// Purchase Module
let purchaseProducts = [], purchaseSuppliers = [], purchItems = [];
let editingPurchaseId = null;
const esc = (v) => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));
let purchaseOutsideClickHandler = null;

export async function render() {
  try {
    const [allProducts, suppliers] = await Promise.all([api.products.getAll(), api.suppliers.getAll()]);
    const isServiceMode = window.currentAppMode === 'service';
    purchaseProducts = allProducts.filter((p) => isServiceMode ? Boolean(p.is_service) : !p.is_service);
    purchaseSuppliers = suppliers;
    editingPurchaseId = null;
    const billNo = await api.purchase.getNextNumber();
    renderPurchasePage(billNo);
  } catch (error) {
    toast(error?.message || 'Unable to load Purchase module. Please check connection and retry.', 'error');
  }
}

function renderPurchasePage(billNo, existingBill = null) {
  purchItems = Array.isArray(existingBill?.items)
    ? existingBill.items.map((it) => {
      const sourceProduct = purchaseProducts.find((p) => Number(p.id) === Number(it.product_id));
      const inferredService =
        Number(it.is_service) ||
        Number(sourceProduct?.is_service) ||
        (typeof it.product_id === 'string' && it.product_id.startsWith('SVC-')) ||
        (it.product_id == null && window.currentAppMode === 'service');
      return { ...it, is_service: inferredService ? 1 : 0 };
    })
    : [];
  const isEditing = Boolean(existingBill?.id);
  const isService = window.currentAppMode === 'service';
  const supOpts = purchaseSuppliers.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="flex gap-4">
      <div style="flex:1;min-width:0">
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title"><i class="bi bi-cart3" style="margin-right:6px;color:var(--primary-600)"></i>${isEditing ? 'Edit Purchase Bill' : 'New Purchase Bill'}</span>
            <button class="btn btn-sm btn-secondary" onclick="viewAllPurchase()"><i class="bi bi-list-ul"></i> All Purchases</button>
          </div>
          <div class="card-body">
            <div class="form-grid form-grid-3">
              <div class="form-group"><label class="form-label">Bill No</label><input class="form-control" id="pur-no" value="${esc(existingBill?.bill_no || billNo)}" /></div>
              <div class="form-group"><label class="form-label">Date *</label><input class="form-control" id="pur-date" type="date" value="${esc(existingBill?.date || today())}" /></div>
              <div class="form-group"><label class="form-label">Supplier</label><select class="form-control" id="pur-sup"><option value="">Select Supplier</option>${supOpts}</select></div>
              <div class="form-group"><label class="form-label">Notes</label><input class="form-control" id="pur-notes" placeholder="Optional..." value="${esc(existingBill?.notes || '')}" /></div>
            </div>
          </div>
        </div>

        ${!isService ? `<div class="card mb-4 overflow-visible">
          <div class="card-header"><span class="card-title">Add Products</span></div>
          <div class="card-body">
            <div class="search-suggest-anchor">
              <div class="flex gap-2">
                <input class="form-control" id="pur-prod-search" placeholder="Search product by name or code..." style="flex:1" />
                <button class="btn btn-primary" onclick="focusPurSearch()"><i class="bi bi-search"></i> Search</button>
              </div>
              <div id="pur-suggestions" class="search-suggestions"></div>
            </div>
          </div>
        </div>` : ''}

        ${isService ? `<div class="card mb-4">
          <div class="card-header"><span class="card-title">Add Service Item</span></div>
          <div class="card-body">
            <div class="flex gap-2">
              <input class="form-control" id="pur-manual-service-desc" placeholder="Service description..." style="flex:2" />
              <input class="form-control" id="pur-manual-service-price" type="number" placeholder="Price" style="flex:1" />
              <button class="btn btn-primary" onclick="addPurManualService()"><i class="bi bi-plus-lg"></i> Add</button>
            </div>
          </div>
        </div>` : ''}

        <div class="card">
          <div class="card-body" style="padding:0">
            <table class="billing-table">
              <thead><tr>
                <th>#</th>
                <th>${isService ? 'Service Description' : 'Product'}</th>
                ${!isService ? '<th>HSN</th><th>Qty</th><th>Unit</th>' : ''}
                <th>Purchase Price</th><th>GST%</th><th>Amount</th><th></th>
              </tr></thead>
              <tbody id="pur-tbody"><tr><td colspan="${isService ? 6 : 9}" class="text-center text-muted" style="padding:24px">No items added</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="width:260px;flex-shrink:0">
        <div class="card" style="position:sticky;top:0">
          <div class="card-header"><span class="card-title">Purchase Summary</span></div>
          <div class="card-body">
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal</span><span id="pt-sub">Rs. 0.00</span></div>
              <div class="totals-row"><span>CGST</span><span id="pt-cgst">Rs. 0.00</span></div>
              <div class="totals-row"><span>SGST</span><span id="pt-sgst">Rs. 0.00</span></div>
              <div class="totals-row grand-total"><span>TOTAL</span><span id="pt-total">Rs. 0.00</span></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
              <button class="btn btn-success w-full" style="padding:12px" onclick="savePurchaseBill()"><i class="bi bi-save-fill"></i> ${isEditing ? 'Update Bill' : 'Save Purchase'}</button>
              <button class="btn btn-secondary w-full" onclick="${isEditing ? 'cancelPurchaseEdit()' : 'resetPurchaseForm()'}"><i class="bi bi-trash"></i> ${isEditing ? 'Cancel Edit' : 'Clear'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="purchase-list-area" class="hidden"></div>`;

  if (existingBill) {
    document.getElementById('pur-sup').value = existingBill.supplier_id || '';
  }

  const searchEl = document.getElementById('pur-prod-search');
  if (!searchEl) {
    if (purchaseOutsideClickHandler) {
      document.removeEventListener('click', purchaseOutsideClickHandler);
      purchaseOutsideClickHandler = null;
    }
    recalcPurchase();
    return;
  }
  const renderPurDropdown = () => {
    const q = searchEl.value.toLowerCase();
    let matches = purchaseProducts;
    if (q) matches = matches.filter(p=>p.name.toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q));
    matches = matches.slice(0, 30);
    document.getElementById('pur-suggestions').innerHTML = matches.length ? `
      <div class="search-suggestions-list">
        ${matches.map(p=>`<div onclick="addPurchaseItem(${p.id})" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray-100);transition:background 0.15s" onmouseover="this.style.background='var(--primary-50)'" onmouseout="this.style.background=''">
          <strong>${p.name}</strong>
          <span style="color:var(--gray-500);font-size:12px"> Purchase: Rs.${p.purchase_price} | GST: ${p.gst_percent}%</span>
        </div>`).join('')}
      </div>` : `<div class="search-suggestions-list" style="padding:10px;color:var(--gray-500)">No products found</div>`;
  };

  searchEl.addEventListener('focus', renderPurDropdown);
  searchEl.addEventListener('click', renderPurDropdown);
  searchEl.addEventListener('input', renderPurDropdown);

  if (purchaseOutsideClickHandler) document.removeEventListener('click', purchaseOutsideClickHandler);
  purchaseOutsideClickHandler = (e) => {
    if (!e.target.closest('#pur-prod-search') && !e.target.closest('#pur-suggestions')) {
      const sugg = document.getElementById('pur-suggestions');
      if (sugg) sugg.innerHTML = '';
    }
  };
  document.addEventListener('click', purchaseOutsideClickHandler);
  recalcPurchase();
}

window.addPurManualService = function() {
  const desc = document.getElementById('pur-manual-service-desc').value.trim();
  const price = document.getElementById('pur-manual-service-price').value;
  if (!desc || !price) { toast('Please enter service description and price', 'warning'); return; }

  purchItems.push({
    product_id: 'SVC-' + Date.now(),
    product_name: desc,
    hsn_code: '9983',
    qty: 1,
    unit: 'SVC',
    price: Number(price) || 0,
    gst_percent: 18,
    cgst: 0,
    sgst: 0,
    amount: 0,
    is_service: 1
  });

  document.getElementById('pur-manual-service-desc').value = '';
  document.getElementById('pur-manual-service-price').value = '';
  recalcPurchase();
};

window.focusPurSearch = function() { document.getElementById('pur-prod-search')?.focus(); };

window.addPurchaseItem = function(productId) {
  const p = purchaseProducts.find((x) => Number(x.id) === Number(productId));
  if (!p) return;
  const existing = purchItems.find((i) => Number(i.product_id) === Number(p.id));
  if (existing) { existing.qty++; }
  else {
    purchItems.push({
      product_id:p.id, product_name:p.name, hsn_code:p.hsn_code||'',
      qty:1, unit:p.unit, price:p.purchase_price,
      gst_percent:p.gst_percent, cgst:0, sgst:0, amount:0,
      is_service:p.is_service||0
    });
  }
  document.getElementById('pur-prod-search').value='';
  document.getElementById('pur-suggestions').innerHTML='';
  recalcPurchase();
};

function recalcPurchase() {
  let sub=0, cgst=0, sgst=0;
  purchItems.forEach(item=>{
    const taxable = item.qty * item.price;
    const gst = taxable * (item.gst_percent/100);
    item.cgst=gst/2; item.sgst=gst/2;
    item.amount = taxable + gst;
    sub+=taxable; cgst+=item.cgst; sgst+=item.sgst;
  });
  document.getElementById('pt-sub').textContent=fmtCur(sub);
  document.getElementById('pt-cgst').textContent=fmtCur(cgst);
  document.getElementById('pt-sgst').textContent=fmtCur(sgst);
  document.getElementById('pt-total').textContent=fmtCur(sub+cgst+sgst);

  const isService = window.currentAppMode === 'service';
  document.getElementById('pur-tbody').innerHTML = purchItems.length ? purchItems.map((item,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><strong>${item.product_name}</strong>${item.is_service?'<span style="background:var(--purple-bg);color:var(--purple);font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;margin-left:6px">SVC</span>':''}</td>
      ${!isService ? `<td><span class="badge badge-gray">${item.hsn_code||'-'}</span></td>
      <td><input type="number" value="${item.qty}" min="0.01" step="0.01" onchange="updatePurItem(${i},'qty',this.value)" style="width:60px" /></td>
      <td>${item.unit}</td>` : ''}
      <td><input type="number" value="${item.price}" step="0.01" onchange="updatePurItem(${i},'price',this.value)" style="width:90px" /></td>
      <td><span class="badge badge-primary">${item.gst_percent}%</span></td>
      <td><strong>${fmtCur(item.amount)}</strong></td>
      <td><button class="btn btn-sm btn-danger" onclick="removePurItem(${i})">x</button></td>
    </tr>`).join('') : `<tr><td colspan="${isService ? 6 : 9}" class="text-center text-muted" style="padding:24px">No items added</td></tr>`;
}

window.updatePurItem = function(i,f,v) {
  const parsed = Number.parseFloat(v);
  if (!Number.isFinite(parsed)) return;
  if (f === 'qty') purchItems[i][f] = Math.max(0.01, parsed);
  else if (f === 'price') purchItems[i][f] = Math.max(0, parsed);
  recalcPurchase();
};
window.removePurItem = function(i) { purchItems.splice(i,1); recalcPurchase(); };

window.savePurchaseBill = async function() {
  if (!purchItems.length) { toast('Add at least one item','error'); return; }
  let sub=0, cgst=0, sgst=0;
  purchItems.forEach(i=>{ sub+=i.qty*i.price; cgst+=i.cgst; sgst+=i.sgst; });
  const bill = {
    id: editingPurchaseId,
    bill_no: document.getElementById('pur-no').value,
    date: document.getElementById('pur-date').value,
    supplier_id: document.getElementById('pur-sup').value||null,
    sub_total: sub, taxable_amount: sub, cgst, sgst,
    total: sub+cgst+sgst,
    notes: document.getElementById('pur-notes').value
  };
  if (!bill.bill_no || !bill.date) { toast('Bill number and date are required', 'error'); return; }
  try {
    await api.purchase.save({ bill, items: purchItems });
    toast(editingPurchaseId ? 'Purchase bill updated successfully!' : 'Purchase bill saved successfully!');
    const allProducts = await api.products.getAll();
    const isServiceMode = window.currentAppMode === 'service';
    purchaseProducts = allProducts.filter((p) => isServiceMode ? Boolean(p.is_service) : !p.is_service);
    const nextBillNo = await api.purchase.getNextNumber();
    editingPurchaseId = null;
    renderPurchasePage(nextBillNo);
  } catch (error) {
    toast(error?.message || 'Failed to save purchase bill', 'error');
  }
};

window.editPurchase = async function(id) {
  const bill = await api.purchase.getById(id);
  if (!bill) { toast('Bill not found', 'error'); return; }
  editingPurchaseId = bill.id;
  renderPurchasePage(bill.bill_no, bill);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`Editing bill ${bill.bill_no}`, 'info');
};

window.cancelPurchaseEdit = async function() {
  editingPurchaseId = null;
  const nextBillNo = await api.purchase.getNextNumber();
  renderPurchasePage(nextBillNo);
};

window.viewAllPurchase = async function() {
  const all = await api.purchase.getAll();
  const area = document.getElementById('purchase-list-area');
  area.classList.remove('hidden');
  area.innerHTML = `
    <div class="card mt-4">
      <div class="card-header">
        <span class="card-title"><i class="bi bi-cart3" style="margin-right:6px;color:var(--primary-600)"></i>All Purchase Bills</span>
        <span class="badge badge-primary">${all.length} records</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Bill No</th><th>Date</th><th>Supplier</th><th class="text-right">Sub Total</th><th class="text-right">GST</th><th class="text-right">Total</th><th style="min-width:280px">Actions</th></tr></thead>
          <tbody>${all.map(b=>`
            <tr>
              <td><strong style="color:var(--primary-700)">${b.bill_no}</strong></td>
              <td>${b.date}</td>
              <td>${b.supplier_name||'<span class="badge badge-gray">-</span>'}</td>
              <td class="text-right">${fmtCur(b.sub_total)}</td>
              <td class="text-right">${fmtCur((b.cgst||0)+(b.sgst||0))}</td>
              <td class="text-right"><strong>${fmtCur(b.total)}</strong></td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-warning" onclick="editPurchase(${b.id})"><i class="bi bi-pencil-fill"></i> Edit</button>
                  <button class="btn btn-sm btn-secondary" onclick="viewPurchaseById(${b.id})"><i class="bi bi-eye-fill"></i> View</button>
                  <button class="btn btn-sm btn-primary" onclick="printPurchaseById(${b.id})"><i class="bi bi-printer-fill"></i> Print</button>
                  <button class="btn btn-sm btn-danger" onclick="deletePurchase(${b.id})"><i class="bi bi-trash-fill"></i></button>
                </div>
              </td>
            </tr>`).join('')||'<tr><td colspan="7" class="text-center text-muted" style="padding:32px">No purchase bills found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
};

function buildPurchasePreviewHTML(bill, co) {
  const billForLayout = {
    ...bill,
    invoice_no: bill.bill_no,
    customer_name: bill.supplier_name,
    customer_address: bill.supplier_address,
    customer_gst: bill.supplier_gst,
    taxable_amount: bill.taxable_amount || bill.sub_total,
    discount: 0
  };
  if (window.buildInvoicePreviewHTML) return window.buildInvoicePreviewHTML(billForLayout, co, 'PURCHASE BILL');
  return buildLocalBillPreviewHTML(billForLayout, co, 'PURCHASE BILL');
}

function buildLocalBillPreviewHTML(inv, co, titleText) {
  const isService = window.currentAppMode === 'service';
  const colGroupHtml = isService
    ? `<colgroup>
         <col style="width:42px" />
         <col />
         <col style="width:110px" />
         <col style="width:95px" />
         <col style="width:95px" />
         <col style="width:120px" />
       </colgroup>`
    : `<colgroup>
         <col style="width:42px" />
         <col />
         <col style="width:80px" />
         <col style="width:80px" />
         <col style="width:110px" />
         <col style="width:95px" />
         <col style="width:95px" />
         <col style="width:120px" />
       </colgroup>`;
  const logoHtml = co?.logo
    ? `<img src="${co.logo}" class="bill-logo" />`
    : `<div class="bill-logo-placeholder">MS</div>`;
  const items = (inv.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.product_name || '')}</td>
      ${!isService ? `<td>${esc(it.hsn_code || '-')}</td><td class="num">${Number(it.qty || 0).toFixed(2)}</td>` : ''}
      <td class="num">${Number(it.price || 0).toFixed(2)}</td>
      <td class="num">${Number(it.discount || 0).toFixed(2)}%</td>
      <td class="num">${(Number(it.cgst || 0) + Number(it.sgst || 0)).toFixed(2)}</td>
      <td class="num">${Number(it.amount || 0).toFixed(2)}</td>
    </tr>`).join('');
  return `
    <div class="invoice-preview bill-layout">
      <div class="bill-top">
        <div class="bill-brand">
          ${logoHtml}
          <div>
            <div class="bill-company">${esc(co?.name || 'Company Name')}</div>
            ${co?.address ? `<div class="bill-small">${esc(co.address)}</div>` : ''}
            ${co?.phone ? `<div class="bill-small">Phone: ${esc(co.phone)}</div>` : ''}
            ${co?.email ? `<div class="bill-small">Email: ${esc(co.email)}</div>` : ''}
            ${co?.gst_no ? `<div class="bill-small">GSTIN: ${esc(co.gst_no)}</div>` : ''}
          </div>
        </div>
        <div class="bill-doc-meta">
          <div class="bill-doc-title">${titleText}</div>
          <div class="bill-small"><strong>Bill #</strong> ${esc(inv.invoice_no || '')}</div>
          <div class="bill-small"><strong>Date:</strong> ${esc(inv.date || '')}</div>
        </div>
      </div>
      <div class="bill-parties">
        <div>
          <div class="bill-label">Bill To</div>
          <div class="bill-party-name">${esc(inv.customer_name || 'Supplier')}</div>
          ${inv.customer_address ? `<div class="bill-small">${esc(inv.customer_address)}</div>` : ''}
          ${inv.customer_gst ? `<div class="bill-small">GSTIN: ${esc(inv.customer_gst)}</div>` : ''}
        </div>
        <div>
          <div class="bill-label">Details</div>
          <div class="bill-small"><strong>Reference:</strong> ${esc(inv.invoice_no || '')}</div>
          ${inv.notes ? `<div class="bill-small"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ''}
        </div>
      </div>
      <table class="bill-items-table">
        ${colGroupHtml}
        <thead>
          <tr><th style="width:40px">#</th><th>Description</th>${!isService ? '<th>HSN</th><th class="num">Qty</th>' : ''}<th class="num">Unit Price</th><th class="num">Discount</th><th class="num">GST</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>${items || `<tr><td colspan="${isService ? 6 : 8}" class="text-center" style="padding:14px">No items</td></tr>`}</tbody>
      </table>
      <div class="bill-totals">
        <div class="bill-total-row"><span>Subtotal</span><span>Rs. ${Number(inv.sub_total || 0).toFixed(2)}</span></div>
        <div class="bill-total-row"><span>CGST</span><span>Rs. ${Number(inv.cgst || 0).toFixed(2)}</span></div>
        <div class="bill-total-row"><span>SGST</span><span>Rs. ${Number(inv.sgst || 0).toFixed(2)}</span></div>
        <div class="bill-total-row bill-total-final"><span>TOTAL</span><span>Rs. ${Number(inv.total || 0).toFixed(2)}</span></div>
      </div>
      <div class="bill-footer">Purchase record generated by ${esc(co?.name || 'Company')}.</div>
    </div>`;
}

function localPrint(content, title = 'Purchase Bill') {
  if (typeof window.printHTMLContent === 'function') {
    window.printHTMLContent(content, title);
    return;
  }
  const win = window.open('', '_blank', 'width=900,height=980');
  if (!win) {
    toast('Unable to open print window. Please try again.', 'error');
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Inter, sans-serif; background: #fff; color: #111827; font-size: 12px; padding: 16px; }
      .invoice-preview.bill-layout { max-width: 820px; margin: 0 auto; border: 1px solid #d1d5db; }
      .bill-top { display:flex; justify-content:space-between; gap:20px; padding:20px; border-bottom:1px solid #d1d5db; }
      .bill-brand { display:flex; align-items:flex-start; gap:12px; }
      .bill-logo { width:84px; max-height:72px; object-fit:contain; }
      .bill-logo-placeholder { width:72px; height:72px; border-radius:8px; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; }
      .bill-company { font-size:24px; font-weight:800; line-height:1.1; margin-bottom:4px; }
      .bill-doc-meta { text-align:right; }
      .bill-doc-title { font-size:34px; font-weight:900; letter-spacing:1px; margin-bottom:8px; }
      .bill-small { font-size:12px; color:#374151; margin-top:2px; }
      .bill-parties { display:grid; grid-template-columns:1fr 1fr; border-bottom:1px solid #d1d5db; }
      .bill-parties > div { padding:14px 20px; }
      .bill-parties > div:first-child { border-right:1px solid #d1d5db; }
      .bill-label { font-size:11px; font-weight:800; text-transform:uppercase; color:#6b7280; margin-bottom:5px; }
      .bill-party-name { font-size:16px; font-weight:700; }
      .bill-items-table { width:100%; border-collapse:collapse; table-layout: fixed; }
      .bill-items-table th { background:#111827; color:#fff; padding:8px 10px; text-align:left; font-size:11px; }
      .bill-items-table td { border-bottom:1px solid #e5e7eb; padding:8px 10px; font-size:12px; vertical-align: top; }
      .bill-items-table tbody tr:nth-child(even) td { background:#f9fafb; }
      .num { text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums; }
      .bill-totals { width:320px; margin-left:auto; padding:14px 20px 18px; }
      .bill-total-row { display:flex; justify-content:space-between; padding:3px 0; }
      .bill-total-row span:last-child, .bill-total-final span:last-child { text-align:right; white-space:nowrap; font-variant-numeric: tabular-nums; }
      .bill-total-final { font-size:18px; font-weight:800; border-top:2px solid #111827; margin-top:6px; padding-top:8px; }
      .bill-footer { text-align:center; padding:12px 20px 16px; color:#374151; border-top:1px dashed #d1d5db; }
      @media print { body { padding: 0; } @page { margin: 0.35in; } }
    </style>
  </head><body>${content}</body></html>`);
  win.document.close();
  setTimeout(()=>{ win.focus(); win.print(); }, 500);
}

window.viewPurchaseById = async function(id) {
  const bill = await api.purchase.getById(id);
  if (!bill) { toast('Bill not found','error'); return; }
  const co = await api.company.get();
  const modal = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.style.maxWidth = '860px';
  box.innerHTML = `
    <div class="modal-header">
      <span class="modal-title"><i class="bi bi-cart3" style="margin-right:6px"></i>Purchase Bill #${bill.bill_no}</span>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-warning" onclick="document.getElementById('modal-overlay').classList.add('hidden');editPurchase(${bill.id})"><i class="bi bi-pencil-fill"></i> Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="printPurchaseModal()"><i class="bi bi-printer-fill"></i> Print</button>
        <button class="btn btn-sm btn-danger" onclick="deletePurchase(${bill.id});document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-trash-fill"></i></button>
        <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="modal-body" style="padding:0" id="purchase-modal-body">
      ${buildPurchasePreviewHTML(bill, co)}
    </div>`;
  modal.classList.remove('hidden');
};

window.printPurchaseModal = function() {
  localPrint(document.getElementById('purchase-modal-body')?.innerHTML, 'Purchase Bill');
};

window.printPurchaseById = async function(id) {
  const bill = await api.purchase.getById(id);
  if (!bill) { toast('Bill not found','error'); return; }
  const co = await api.company.get();
  localPrint(buildPurchasePreviewHTML(bill, co), 'Purchase Bill');
};

window.deletePurchase = async function(id) {
  if (!(await confirmModal('Delete Purchase Bill', 'Are you sure you want to delete this bill? Stock will be adjusted automatically.'))) return;
  try {
    await api.purchase.delete(id);
    toast('Purchase bill deleted');
    if (editingPurchaseId === id) editingPurchaseId = null;
    await window.viewAllPurchase();
  } catch (error) {
    toast(error?.message || 'Failed to delete purchase bill', 'error');
  }
};

window.resetPurchaseForm = async function() {
  editingPurchaseId = null;
  const nextBillNo = await api.purchase.getNextNumber();
  renderPurchasePage(nextBillNo);
};
