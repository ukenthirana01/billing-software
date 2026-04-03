// Proforma Invoice Module
let proformaProducts = [], proformaCustomers = [], proformaItems = [];

export async function render() {
  proformaProducts = await api.products.getAll();
  proformaCustomers = await api.customers.getAll();
  const list = await api.proforma.getAll();
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h2>Proforma Invoices <span class="badge badge-gray">${list.length}</span></h2>
      <button class="btn btn-primary" onclick="newProforma()"><i class="bi bi-plus-circle"></i> New Proforma</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Proforma No</th><th>Date</th><th>Customer</th><th class="text-right">Total</th><th>Status</th></tr></thead>
        <tbody>${list.map(p=>`<tr>
          <td><strong>${p.proforma_no}</strong></td>
          <td>${p.date}</td>
          <td>${window.escapeHtml(p.customer_name||'Walk-in')}</td>
          <td class="text-right font-bold">${fmtCur(p.total)}</td>
          <td><span class="badge badge-info">${p.status}</span></td>
        </tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted" style="padding:32px">No proforma invoices yet</td></tr>'}
        </tbody>
      </table></div>
    </div>`;
}

window.newProforma = async function() {
  const num = await api.proforma.getNextNumber();
  proformaItems = [];
  const custOpts = proformaCustomers.map(c=>`<option value="${c.id}">${window.escapeHtml(c.name)}</option>`).join('');
  const prodOpts = proformaProducts.map(p=>`<option value="${p.id}" data-price="${p.selling_price}" data-gst="${p.gst_percent}" data-hsn="${p.hsn_code||''}" data-unit="${p.unit}">${window.escapeHtml(p.name)}</option>`).join('');
  openModal('New Proforma Invoice', `
    <div class="form-grid form-grid-3">
      <div class="form-group"><label class="form-label">Proforma No</label><input class="form-control" id="pf-no" value="${num}" readonly /></div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-control" id="pf-date" type="date" value="${today()}" /></div>
      <div class="form-group"><label class="form-label">Customer</label><select class="form-control" id="pf-customer"><option value="">Walk-in</option>${custOpts}</select></div>
    </div>
    <div class="form-grid" style="grid-template-columns:3fr 1fr 1fr;gap:8px;margin-top:12px">
      <select class="form-control" id="pf-product"><option value="">Select Product</option>${prodOpts}</select>
      <input class="form-control" id="pf-qty" type="number" value="1" min="1" placeholder="Qty" />
      <button class="btn btn-primary" onclick="addProformaItem()"><i class="bi bi-plus"></i> Add</button>
    </div>
    <div id="pf-items-list" style="margin-top:12px"></div>
    <div id="pf-total" style="margin-top:12px;font-size:18px;font-weight:800;text-align:right"></div>
    <div class="form-group mt-3"><label class="form-label">Notes</label><textarea class="form-control" id="pf-notes" rows="2"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-success" onclick="saveProforma()"><i class="bi bi-check-circle"></i> Save Proforma</button>`);
};

window.addProformaItem = function() {
  const sel = document.getElementById('pf-product');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return toast('Select a product','error');
  const qty = Math.max(1, parseFloat(document.getElementById('pf-qty').value) || 1);
  const price = Math.max(0, parseFloat(opt.dataset.price) || 0);
  const gst = Math.max(0, parseFloat(opt.dataset.gst) || 0);
  const taxable = qty * price;
  const cgst = taxable * gst / 200;
  const sgst = cgst;
  proformaItems.push({ product_id: parseInt(opt.value), product_name: opt.text, hsn_code: opt.dataset.hsn, qty, unit: opt.dataset.unit, price, discount: 0, gst_percent: gst, cgst, sgst, amount: taxable + cgst + sgst });
  renderProformaItems();
  sel.selectedIndex = 0;
};

function renderProformaItems() {
  const list = document.getElementById('pf-items-list');
  const total = proformaItems.reduce((s,i)=>s+i.amount,0);
  list.innerHTML = `<table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Amount</th><th></th></tr></thead>
    <tbody>${proformaItems.map((it,i)=>`<tr><td>${window.escapeHtml(it.product_name)}</td><td>${it.qty}</td><td>${fmtCur(it.price)}</td><td>${it.gst_percent}%</td><td class="font-bold">${fmtCur(it.amount)}</td><td><button class="btn btn-sm btn-danger" onclick="proformaItems.splice(${i},1);renderProformaItems()">✕</button></td></tr>`).join('')}
    </tbody></table>`;
  document.getElementById('pf-total').textContent = `Total: ${fmtCur(total)}`;
  window.renderProformaItems = renderProformaItems;
}

window.saveProforma = async function() {
  if (!proformaItems.length) return toast('Add at least one item','error');
  const total = proformaItems.reduce((s,i)=>s+i.amount,0);
  const cgst = proformaItems.reduce((s,i)=>s+i.cgst,0);
  const sgst = proformaItems.reduce((s,i)=>s+i.sgst,0);
  await api.proforma.save({
    proforma_no: document.getElementById('pf-no').value,
    date: document.getElementById('pf-date').value,
    customer_id: document.getElementById('pf-customer').value || null,
    sub_total: total - cgst - sgst, discount: 0, taxable_amount: total - cgst - sgst,
    cgst, sgst, total,
    notes: document.getElementById('pf-notes').value,
    status: 'Draft', items: proformaItems
  });
  toast('Proforma saved!');
  closeModal();
  render();
};
