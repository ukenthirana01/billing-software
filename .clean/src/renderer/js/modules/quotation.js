// Quotation Module
let quotProds = [], quotCustomers = [], quotItems = [];
let editingQuotationId = null;
const esc = (v) => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));
let quotationOutsideClickHandler = null;

export async function render() {
  try {
    const [allProducts, customers] = await Promise.all([api.products.getAll(), api.customers.getAll()]);
    const isServiceMode = window.currentAppMode === 'service';
    quotProds = allProducts.filter((p) => isServiceMode ? Boolean(p.is_service) : !p.is_service);
    quotCustomers = customers;
    editingQuotationId = null;
    const quoteNo = await api.quotations.getNextNumber();
    renderQuotPage(null, quoteNo);
  } catch (error) {
    toast(error?.message || 'Unable to load Quotation module. Please check connection and retry.', 'error');
  }
}

function renderQuotPage(existingQuotation = null, nextQuoteNo = '') {
  quotItems = Array.isArray(existingQuotation?.items)
    ? existingQuotation.items.map((it) => {
      const sourceProduct = quotProds.find((p) => Number(p.id) === Number(it.product_id));
      const inferredService =
        Number(it.is_service) ||
        Number(sourceProduct?.is_service) ||
        (typeof it.product_id === 'string' && it.product_id.startsWith('SVC-')) ||
        (it.product_id == null && window.currentAppMode === 'service');
      return { ...it, is_service: inferredService ? 1 : 0 };
    })
    : [];
  const isService = window.currentAppMode === 'service';
  const isEditing = Boolean(existingQuotation?.id);
  const custOpts = quotCustomers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="flex gap-4">
      <div style="flex:1;min-width:0">
        <div class="card mb-4">
          <div class="card-header">
            <span class="card-title"><i class="bi bi-file-earmark-text" style="margin-right:6px;color:var(--primary-600)"></i>${isEditing ? 'Edit Quotation' : 'New Quotation'}</span>
            <button class="btn btn-sm btn-secondary" onclick="viewAllQuotations()"><i class="bi bi-list-ul"></i> All Quotations</button>
          </div>
          <div class="card-body">
            <div class="form-grid form-grid-3">
              <div class="form-group"><label class="form-label">Quote No</label><input class="form-control" id="q-no" value="${esc(existingQuotation?.quote_no || nextQuoteNo || '')}" ${isEditing ? 'readonly' : ''} /></div>
              <div class="form-group"><label class="form-label">Date</label><input class="form-control" id="q-date" type="date" value="${esc(existingQuotation?.date || today())}" /></div>
              <div class="form-group"><label class="form-label">Customer</label>
                <select class="form-control" id="q-cust"><option value="">Walk-in / Select Customer</option>${custOpts}</select>
              </div>
              <div class="form-group"><label class="form-label">Notes</label><input class="form-control" id="q-notes" placeholder="Optional notes" value="${esc(existingQuotation?.notes || '')}" /></div>
            </div>
          </div>
        </div>

        ${!isService ? `<div class="card mb-4 overflow-visible">
          <div class="card-header"><span class="card-title">Add Products</span></div>
          <div class="card-body">
            <div class="search-suggest-anchor">
              <div class="flex gap-2">
                <input class="form-control" id="q-search" placeholder="Search product by name..." style="flex:1" />
                <button class="btn btn-primary" onclick="addFirstQuotMatch()"><i class="bi bi-plus-lg"></i> Add</button>
              </div>
              <div id="q-suggestions" class="search-suggestions"></div>
            </div>
          </div>
        </div>` : ''}

        ${isService ? `<div class="card mb-4">
          <div class="card-header"><span class="card-title">Add Service Item</span></div>
          <div class="card-body">
            <div class="flex gap-2">
              <input class="form-control" id="q-manual-service-desc" placeholder="Service description..." style="flex:2" />
              <input class="form-control" id="q-manual-service-price" type="number" placeholder="Price" style="flex:1" />
              <button class="btn btn-primary" onclick="addQuotManualService()"><i class="bi bi-plus-lg"></i> Add</button>
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
                <th>Rate</th><th>GST%</th><th>Amount</th><th></th>
              </tr></thead>
              <tbody id="q-tbody"><tr><td colspan="${isService ? 6 : 9}" class="text-center text-muted" style="padding:24px">No items added</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="width:260px;flex-shrink:0">
        <div class="card" style="position:sticky;top:0">
          <div class="card-header"><span class="card-title">Summary</span></div>
          <div class="card-body">
            <div class="totals-box">
              <div class="totals-row"><span>Subtotal</span><span id="qt-sub">Rs. 0.00</span></div>
              <div class="totals-row"><span>CGST</span><span id="qt-cgst">Rs. 0.00</span></div>
              <div class="totals-row"><span>SGST</span><span id="qt-sgst">Rs. 0.00</span></div>
              <div class="totals-row grand-total"><span>TOTAL</span><span id="qt-total">Rs. 0.00</span></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">
              <button class="btn btn-success w-full" style="padding:11px" onclick="saveQuotation()"><i class="bi bi-save-fill"></i> ${isEditing ? 'Update Quotation' : 'Save Quotation'}</button>
              <button class="btn btn-secondary w-full" onclick="${isEditing ? 'cancelQuotationEdit()' : 'resetQuotationForm()'}"><i class="bi bi-trash"></i> ${isEditing ? 'Cancel Edit' : 'Clear'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="quot-list" class="hidden mt-4"></div>`;

  if (existingQuotation) {
    document.getElementById('q-cust').value = existingQuotation.customer_id || '';
  }

  const qSearchEl = document.getElementById('q-search');
  if (!qSearchEl) {
    if (quotationOutsideClickHandler) {
      document.removeEventListener('click', quotationOutsideClickHandler);
      quotationOutsideClickHandler = null;
    }
    recalcQuot();
    return;
  }
  const renderQuotDropdown = () => {
    const q = qSearchEl.value.toLowerCase();
    let matches = quotProds;
    if (q) matches = matches.filter(p=>p.name.toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q));
    matches = matches.slice(0, 30);
    document.getElementById('q-suggestions').innerHTML = matches.length ? `
      <div class="search-suggestions-list">
        ${matches.map(p=>`<div onclick="addQuotItem(${p.id})" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray-100);transition:background 0.15s" onmouseover="this.style.background='var(--primary-50)'" onmouseout="this.style.background=''">
          <strong>${p.name}</strong>
          <span style="color:var(--gray-500);font-size:12px"> Rs.${p.selling_price} | GST: ${p.gst_percent}%</span>
        </div>`).join('')}
      </div>` : `<div class="search-suggestions-list" style="padding:10px;color:var(--gray-500)">No products found</div>`;
  };

  qSearchEl.addEventListener('focus', renderQuotDropdown);
  qSearchEl.addEventListener('click', renderQuotDropdown);
  qSearchEl.addEventListener('input', renderQuotDropdown);

  if (quotationOutsideClickHandler) document.removeEventListener('click', quotationOutsideClickHandler);
  quotationOutsideClickHandler = (e) => {
    if (!e.target.closest('#q-search') && !e.target.closest('#q-suggestions')) {
      const sugg = document.getElementById('q-suggestions');
      if (sugg) sugg.innerHTML = '';
    }
  };
  document.addEventListener('click', quotationOutsideClickHandler);
  recalcQuot();
}

window.addQuotManualService = function() {
  const desc = document.getElementById('q-manual-service-desc').value.trim();
  const price = document.getElementById('q-manual-service-price').value;
  if (!desc || !price) { toast('Please enter service description and price', 'warning'); return; }

  quotItems.push({
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

  document.getElementById('q-manual-service-desc').value = '';
  document.getElementById('q-manual-service-price').value = '';
  recalcQuot();
};

window.addFirstQuotMatch = function() {
  const val = document.getElementById('q-search')?.value?.toLowerCase();
  if (!val) { document.getElementById('q-search').focus(); return; }
  const match = quotProds.find(p=>p.name.toLowerCase().includes(val)||(p.code||'').toLowerCase().includes(val));
  if (match) addQuotItem(match.id);
  else toast('No product found for: ' + val, 'error');
};

window.addQuotItem = function(pid) {
  const p = quotProds.find((x) => Number(x.id) === Number(pid));
  if (!p) return;
  const ex = quotItems.find((i) => Number(i.product_id) === Number(p.id));
  if (ex) ex.qty++;
  else quotItems.push({
    product_id:p.id, product_name:p.name, hsn_code:p.hsn_code||'',
    qty:1, unit:p.unit, price:p.selling_price,
    gst_percent:p.gst_percent, cgst:0, sgst:0, amount:0,
    is_service:p.is_service||0
  });
  document.getElementById('q-search').value='';
  document.getElementById('q-suggestions').innerHTML='';
  recalcQuot();
};

function recalcQuot() {
  let sub=0, totalCgst=0, totalSgst=0;
  quotItems.forEach(i=>{
    const taxable = i.qty * i.price;
    const gst = taxable * (i.gst_percent/100);
    i.cgst = gst/2; i.sgst = gst/2;
    i.amount = taxable + gst;
    sub += taxable; totalCgst += i.cgst; totalSgst += i.sgst;
  });
  document.getElementById('qt-sub').textContent = fmtCur(sub);
  document.getElementById('qt-cgst').textContent = fmtCur(totalCgst);
  document.getElementById('qt-sgst').textContent = fmtCur(totalSgst);
  document.getElementById('qt-total').textContent = fmtCur(sub+totalCgst+totalSgst);

  const isService = window.currentAppMode === 'service';
  document.getElementById('q-tbody').innerHTML = quotItems.length ? quotItems.map((i,idx)=>`
    <tr>
      <td>${idx+1}</td>
      <td><strong>${i.product_name}</strong>${i.is_service?'<span style="background:var(--purple-bg);color:var(--purple);font-size:10px;font-weight:700;padding:2px 6px;border-radius:8px;margin-left:6px">SVC</span>':''}</td>
      ${!isService ? `<td><span class="badge badge-gray">${i.hsn_code||'-'}</span></td>
      <td><input type="number" value="${i.qty}" min="0.01" step="0.01" onchange="updateQuotItem(${idx},'qty',this.value)" style="width:60px" /></td>
      <td>${i.unit}</td>` : ''}
      <td><input type="number" value="${i.price}" step="0.01" onchange="updateQuotItem(${idx},'price',this.value)" style="width:80px" /></td>
      <td><span class="badge badge-primary">${i.gst_percent}%</span></td>
      <td><strong>${fmtCur(i.amount)}</strong></td>
      <td><button class="btn btn-sm btn-danger" onclick="removeQuotItem(${idx})"><i class="bi bi-trash-fill"></i></button></td>
    </tr>`).join('') : `<tr><td colspan="${isService ? 6 : 9}" class="text-center text-muted" style="padding:24px">No items added</td></tr>`;
}

window.updateQuotItem = function(i,f,v) {
  const parsed = Number.parseFloat(v);
  if (!Number.isFinite(parsed)) return;
  if (f === 'qty') quotItems[i][f] = Math.max(0.01, parsed);
  else if (f === 'price') quotItems[i][f] = Math.max(0, parsed);
  recalcQuot();
};
window.removeQuotItem = function(i) { quotItems.splice(i,1); recalcQuot(); };

window.saveQuotation = async function() {
  if (!quotItems.length) { toast('Add items first','error'); return; }
  const total = quotItems.reduce((s,i)=>s+i.amount, 0);
  const quotation = {
    id: editingQuotationId,
    quote_no: document.getElementById('q-no')?.value?.trim(),
    date: document.getElementById('q-date').value,
    customer_id: document.getElementById('q-cust').value||null,
    total,
    notes: document.getElementById('q-notes').value
  };
  if (!quotation.date) { toast('Date is required', 'error'); return; }
  try {
    const qId = await api.quotations.save({ quotation, items: quotItems });
    toast(editingQuotationId ? 'Quotation updated!' : 'Quotation saved!');
    const q = await api.quotations.getById(qId);
    const co = await api.company.get();
    localPrint(buildQuotPreviewHTML(q, co), 'Quotation');
    editingQuotationId = null;
    const quoteNo = await api.quotations.getNextNumber();
    renderQuotPage(null, quoteNo);
  } catch (error) {
    toast(error?.message || 'Failed to save quotation', 'error');
  }
};

window.editQuotation = async function(id) {
  const q = await api.quotations.getById(id);
  if (!q) { toast('Quotation not found', 'error'); return; }
  editingQuotationId = q.id;
  renderQuotPage(q, q.quote_no);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`Editing quotation ${q.quote_no}`, 'info');
};

window.deleteQuotation = async function(id) {
  if (!(await confirmModal('Delete Quotation', 'Are you sure you want to delete this quotation?'))) return;
  try {
    await api.quotations.delete(id);
    toast('Quotation deleted');
    if (editingQuotationId === id) editingQuotationId = null;
    await window.viewAllQuotations();
  } catch (error) {
    toast(error?.message || 'Failed to delete quotation', 'error');
  }
};

window.cancelQuotationEdit = function() {
  editingQuotationId = null;
  api.quotations.getNextNumber().then((qNo) => renderQuotPage(null, qNo));
};

window.viewAllQuotations = async function() {
  const all = await api.quotations.getAll();
  const area = document.getElementById('quot-list');
  area.classList.remove('hidden');
  area.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="bi bi-file-earmark-text" style="margin-right:6px;color:var(--primary-600)"></i>All Quotations</span>
        <span class="badge badge-primary">${all.length} records</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Quote No</th><th>Date</th><th>Customer</th><th class="text-right">Total</th><th>Status</th><th style="min-width:300px">Actions</th></tr></thead>
          <tbody>${all.map(q=>`
            <tr>
              <td><strong style="color:var(--primary-700)">${q.quote_no}</strong></td>
              <td>${q.date}</td>
              <td>${q.customer_name||'<span class="badge badge-gray">Walk-in</span>'}</td>
              <td class="text-right"><strong>${fmtCur(q.total)}</strong></td>
              <td><span class="badge badge-${q.status==='Draft'?'gray':'success'}">${q.status}</span></td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-warning" onclick="editQuotation(${q.id})"><i class="bi bi-pencil-fill"></i> Edit</button>
                  <button class="btn btn-sm btn-secondary" onclick="viewQuotById(${q.id})"><i class="bi bi-eye-fill"></i> View</button>
                  <button class="btn btn-sm btn-primary" onclick="printQuotById(${q.id})"><i class="bi bi-printer-fill"></i> Print</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteQuotation(${q.id})"><i class="bi bi-trash-fill"></i></button>
                  <button class="btn btn-sm btn-success" onclick="convertQuotToSale(${q.id})" title="Convert to Invoice"><i class="bi bi-arrow-right-circle-fill"></i> Sale</button>
                </div>
              </td>
            </tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted" style="padding:32px">No quotations found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
};

function buildQuotPreviewHTML(q, co) {
  const sub  = (q.items||[]).reduce((s,i)=>s+(i.qty*i.price),0);
  const cgst = (q.items||[]).reduce((s,i)=>s+(i.cgst||0),0);
  const sgst = (q.items||[]).reduce((s,i)=>s+(i.sgst||0),0);
  const layoutObj = {
    ...q,
    invoice_no: q.quote_no,
    customer_name: q.customer_name,
    sub_total: sub,
    taxable_amount: sub,
    cgst,
    sgst,
    discount: 0,
    total: Number(q.total || (sub + cgst + sgst))
  };
  if (window.buildInvoicePreviewHTML) {
    return window.buildInvoicePreviewHTML(layoutObj, co, 'QUOTATION');
  }
  return buildLocalBillPreviewHTML(layoutObj, co, 'QUOTATION');
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
          <div class="bill-small"><strong>Quote #</strong> ${esc(inv.invoice_no || '')}</div>
          <div class="bill-small"><strong>Date:</strong> ${esc(inv.date || '')}</div>
        </div>
      </div>
      <div class="bill-parties">
        <div>
          <div class="bill-label">Bill To</div>
          <div class="bill-party-name">${esc(inv.customer_name || 'Walk-in Customer')}</div>
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
      <div class="bill-footer">This is a quotation only, not a GST invoice.</div>
    </div>`;
}

function localPrint(content, title = 'Quotation') {
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

window.viewQuotById = async function(id) {
  const q = await api.quotations.getById(id);
  if (!q) { toast('Quotation not found','error'); return; }
  const co = await api.company.get();
  const modal = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.style.maxWidth = '860px';
  box.innerHTML = `
    <div class="modal-header">
      <span class="modal-title"><i class="bi bi-file-earmark-text" style="margin-right:6px"></i>Quotation #${q.quote_no}</span>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-warning" onclick="document.getElementById('modal-overlay').classList.add('hidden');editQuotation(${q.id})"><i class="bi bi-pencil-fill"></i> Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="printQuotModal()"><i class="bi bi-printer-fill"></i> Print</button>
        <button class="btn btn-sm btn-danger" onclick="deleteQuotation(${q.id});document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-trash-fill"></i></button>
        <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="modal-body" style="padding:0" id="quot-modal-body">
      ${buildQuotPreviewHTML(q, co)}
    </div>`;
  modal.classList.remove('hidden');
};

window.printQuotModal = function() {
  localPrint(document.getElementById('quot-modal-body')?.innerHTML, 'Quotation');
};

window.printQuotById = async function(id) {
  const q = await api.quotations.getById(id);
  const co = await api.company.get();
  localPrint(buildQuotPreviewHTML(q, co), 'Quotation');
};

window.convertQuotToSale = async function(id) {
  if (!(await confirmModal('Convert to Sales', 'Are you sure you want to convert this quotation to a Sales Invoice?', 'Yes, convert', 'info'))) return;
  await api.quotations.convertToSale(id);
  toast('Marked as converted. Go to Sales to create the invoice.', 'info');
  window.viewAllQuotations();
};

window.resetQuotationForm = function() {
  editingQuotationId = null;
  api.quotations.getNextNumber().then((qNo) => renderQuotPage(null, qNo));
};
