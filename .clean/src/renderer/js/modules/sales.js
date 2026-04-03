// Sales / Billing Module - Product Billing
let salesProducts = [], salesCustomers = [], billItems = [];
let editingSaleId = null;
let salesTotals = { subTotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, total: 0 };
const esc = (v) => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));
let salesOutsideClickHandler = null;

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
      return { ...it, is_service: inferredService ? 1 : 0 };
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
              </div>
              <div class="form-group"><label class="form-label">Notes</label><input class="form-control" id="inv-notes" placeholder="Optional notes..." value="${esc(existingInvoice?.notes || '')}" /></div>
            </div>
          </div>
        </div>

        ${!isService ? `<div class="card mb-4 overflow-visible">
          <div class="card-header"><span class="card-title">Add Products</span></div>
          <div class="card-body">
            <div class="search-suggest-anchor">
              <div class="flex gap-2">
                <input class="form-control" id="prod-search-billing" placeholder="Search product by name or code..." style="flex:1" />
                <button class="btn btn-primary" onclick="document.getElementById('prod-search-billing').focus()"><i class="bi bi-search"></i> Search</button>
              </div>
              <div id="prod-suggestions" class="search-suggestions"></div>
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
              <tbody id="items-tbody"><tr><td colspan="${isService ? 7 : 10}" class="text-center text-muted" style="padding:24px">No items added yet</td></tr></tbody>
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

window.addItemToTable = function(productId) {
  const p = salesProducts.find((x) => Number(x.id) === Number(productId));
  if (!p) return;
  const existing = billItems.find((i) => Number(i.product_id) === Number(p.id));
  if (existing) { existing.qty++; }
  else {
    billItems.push({
      product_id:p.id, product_name:p.name, hsn_code:p.hsn_code||'',
      qty:1, unit:p.unit, price:p.selling_price, discount:0,
      gst_percent:p.gst_percent, cgst:0, sgst:0, amount:0,
      is_service:p.is_service ? 1 : 0
    });
  }
  document.getElementById('prod-search-billing').value='';
  document.getElementById('prod-suggestions').innerHTML='';
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
    </tr>`).join('') : `<tr><td colspan="${isService ? 7 : 10}" class="text-center text-muted" style="padding:24px">No items added yet</td></tr>`;
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
                  <button class="btn btn-sm btn-danger" onclick="deleteSale(${s.id})"><i class="bi bi-trash-fill"></i></button>
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
        <button class="btn btn-sm btn-danger" onclick="deleteSale(${inv.id});document.getElementById('modal-overlay').classList.add('hidden')"><i class="bi bi-trash-fill"></i></button>
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

  const items = (inv.items || []).map((it, i) => {
    const qty = Number(it.qty || 0);
    const price = Number(it.price || 0);
    const discount = Number(it.discount || 0);
    const taxAmt = Number(it.cgst || 0) + Number(it.sgst || 0);
    const amount = Number(it.amount || 0);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.product_name || '')}</td>
        ${!isService ? `<td>${esc(it.hsn_code || '-')}</td><td class="num">${qty.toFixed(2)}</td>` : ''}
        <td class="num">${price.toFixed(2)}</td>
        <td class="num">${discount.toFixed(2)}%</td>
        <td class="num">${taxAmt.toFixed(2)}</td>
        <td class="num">${amount.toFixed(2)}</td>
      </tr>`;
  }).join('');

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
          <div class="bill-small"><strong>${titleText === 'INVOICE' ? 'Invoice #' : 'Doc #'}</strong> ${esc(inv.invoice_no || inv.bill_no || inv.quote_no || '')}</div>
          <div class="bill-small"><strong>Date:</strong> ${esc(inv.date || '')}</div>
          ${inv.payment_mode ? `<div class="bill-small"><strong>Payment:</strong> ${esc(inv.payment_mode)}</div>` : ''}
        </div>
      </div>

      <div class="bill-parties">
        <div>
          <div class="bill-label">Bill To</div>
          <div class="bill-party-name">${esc(inv.customer_name || inv.supplier_name || 'Walk-in Customer')}</div>
          ${inv.customer_address ? `<div class="bill-small">${esc(inv.customer_address)}</div>` : ''}
          ${inv.supplier_address ? `<div class="bill-small">${esc(inv.supplier_address)}</div>` : ''}
          ${(inv.customer_gst || inv.supplier_gst) ? `<div class="bill-small">GSTIN: ${esc(inv.customer_gst || inv.supplier_gst)}</div>` : ''}
        </div>
        <div>
          <div class="bill-label">Details</div>
          <div class="bill-small"><strong>Reference:</strong> ${esc(inv.invoice_no || inv.bill_no || inv.quote_no || '')}</div>
          ${inv.notes ? `<div class="bill-small"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ''}
        </div>
      </div>

      <table class="bill-items-table">
        ${colGroupHtml}
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
        </thead>
        <tbody>
          ${items || `<tr><td colspan="${isService ? 6 : 8}" class="text-center" style="padding:14px">No items</td></tr>`}
        </tbody>
      </table>

      <div class="bill-totals">
        <div class="bill-total-row"><span>Subtotal</span><span>Rs. ${Number(inv.sub_total || 0).toFixed(2)}</span></div>
        ${Number(inv.discount || 0) > 0 ? `<div class="bill-total-row"><span>Discount</span><span>- Rs. ${Number(inv.discount).toFixed(2)}</span></div>` : ''}
        <div class="bill-total-row"><span>CGST</span><span>Rs. ${Number(inv.cgst || 0).toFixed(2)}</span></div>
        <div class="bill-total-row"><span>SGST</span><span>Rs. ${Number(inv.sgst || 0).toFixed(2)}</span></div>
        <div class="bill-total-row bill-total-final"><span>TOTAL</span><span>Rs. ${Number(inv.total || 0).toFixed(2)}</span></div>
      </div>
      <div class="bill-amount-words"><strong>Amount in Words:</strong> ${esc(amountInWords(inv.total || 0))}</div>
      <div class="bill-sign-row">
        <div class="bill-small">Checked By: __________________</div>
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
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: white; color: #111827; font-size: 12px; padding: 16px; }
      .invoice-preview.bill-layout { max-width: 820px; margin: 0 auto; border: 1px solid #d1d5db; }
      .bill-top { display:flex; justify-content:space-between; gap:20px; padding:20px; border-bottom:1px solid #d1d5db; }
      .bill-brand { display:flex; align-items:flex-start; gap:12px; }
      .bill-logo { width:84px; max-height:72px; object-fit:contain; }
      .bill-logo-placeholder { width:72px; height:72px; border-radius:8px; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; }
      .bill-company { font-size:24px; font-weight:800; line-height:1.1; margin-bottom:4px; }
      .bill-doc-meta { text-align:right; }
      .bill-doc-title { font-size:36px; font-weight:900; letter-spacing:1px; margin-bottom:8px; }
      .bill-small { font-size:12px; color:#374151; margin-top:2px; }
      .bill-parties { display:grid; grid-template-columns:1fr 1fr; gap:0; border-bottom:1px solid #d1d5db; }
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
      .bill-amount-words { margin: 0 20px 10px; padding: 10px 12px; border: 1px dashed #9ca3af; border-radius: 8px; font-size: 12px; color: #111827; }
      .bill-sign-row { display: flex; justify-content: space-between; align-items: flex-end; padding: 6px 20px 10px; }
      .bill-signature { min-width: 180px; text-align: center; border-top: 1px solid #111827; padding-top: 6px; font-weight: 600; }
      .bill-footer { text-align:center; padding:12px 20px 16px; color:#374151; border-top:1px dashed #d1d5db; }
      @media print { body { padding: 0; } @page { margin: 0.35in; } }
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
