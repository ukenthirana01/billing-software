// Purchase Order Module
let poProducts = [], poSuppliers = [], poItems = [];

export async function render() {
  poProducts = await api.products.getAll();
  poSuppliers = await api.suppliers.getAll();
  const list = await api.purchaseOrders.getAll();
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h2>Purchase Orders <span class="badge badge-gray">${list.length}</span></h2>
      <button class="btn btn-primary" onclick="newPO()"><i class="bi bi-plus-circle"></i> New Purchase Order</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>PO No</th><th>Date</th><th>Supplier</th><th class="text-right">Total</th><th>Status</th></tr></thead>
        <tbody>${list.map(p=>`<tr>
          <td><strong>${p.po_no}</strong></td>
          <td>${p.date}</td>
          <td>${window.escapeHtml(p.supplier_name||'-')}</td>
          <td class="text-right font-bold">${fmtCur(p.total)}</td>
          <td><span class="badge badge-info">${p.status}</span></td>
        </tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted" style="padding:32px">No purchase orders yet</td></tr>'}
        </tbody>
      </table></div>
    </div>`;
}

window.newPO = async function() {
  const num = await api.purchaseOrders.getNextNumber();
  poItems = [];
  const supOpts = poSuppliers.map(s=>`<option value="${s.id}">${window.escapeHtml(s.name)}</option>`).join('');
  const prodOpts = poProducts.map(p=>`<option value="${p.id}" data-price="${p.purchase_price}" data-gst="${p.gst_percent}" data-hsn="${p.hsn_code||''}" data-unit="${p.unit}">${window.escapeHtml(p.name)}</option>`).join('');
  openModal('New Purchase Order', `
    <div class="form-grid form-grid-3">
      <div class="form-group"><label class="form-label">PO Number</label><input class="form-control" id="po-no" value="${num}" readonly /></div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-control" id="po-date" type="date" value="${today()}" /></div>
      <div class="form-group"><label class="form-label">Supplier</label><select class="form-control" id="po-supplier"><option value="">Select Supplier</option>${supOpts}</select></div>
    </div>
    <div class="form-grid" style="grid-template-columns:3fr 1fr 1fr;gap:8px;margin-top:12px">
      <select class="form-control" id="po-product"><option value="">Select Product</option>${prodOpts}</select>
      <input class="form-control" id="po-qty" type="number" value="1" min="1" placeholder="Qty" />
      <button class="btn btn-primary" onclick="addPOItem()"><i class="bi bi-plus"></i> Add</button>
    </div>
    <div id="po-items-list" style="margin-top:12px"></div>
    <div id="po-total" style="margin-top:12px;font-size:18px;font-weight:800;text-align:right"></div>
    <div class="form-group mt-3"><label class="form-label">Notes</label><textarea class="form-control" id="po-notes" rows="2"></textarea></div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-success" onclick="savePO()"><i class="bi bi-check-circle"></i> Save PO</button>`);
};

window.addPOItem = function() {
  const sel = document.getElementById('po-product');
  const opt = sel.options[sel.selectedIndex];
  if (!opt || !opt.value) return toast('Select a product','error');
  const qty = Math.max(1, parseFloat(document.getElementById('po-qty').value) || 1);
  const price = Math.max(0, parseFloat(opt.dataset.price) || 0);
  const gst = Math.max(0, parseFloat(opt.dataset.gst) || 0);
  const taxable = qty * price;
  const cgst = taxable * gst / 200;
  const sgst = cgst;
  poItems.push({ product_id: parseInt(opt.value), product_name: opt.text, hsn_code: opt.dataset.hsn, qty, unit: opt.dataset.unit, price, gst_percent: gst, cgst, sgst, amount: taxable + cgst + sgst });
  renderPOItems();
  sel.selectedIndex = 0;
};

function renderPOItems() {
  const list = document.getElementById('po-items-list');
  const total = poItems.reduce((s,i)=>s+i.amount,0);
  list.innerHTML = `<table class="data-table"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Amount</th><th></th></tr></thead>
    <tbody>${poItems.map((it,i)=>`<tr><td>${window.escapeHtml(it.product_name)}</td><td>${it.qty}</td><td>${fmtCur(it.price)}</td><td>${it.gst_percent}%</td><td class="font-bold">${fmtCur(it.amount)}</td><td><button class="btn btn-sm btn-danger" onclick="poItems.splice(${i},1);renderPOItems()">✕</button></td></tr>`).join('')}
    </tbody></table>`;
  document.getElementById('po-total').textContent = `Total: ${fmtCur(total)}`;
  window.renderPOItems = renderPOItems;
}

window.savePO = async function() {
  if (!poItems.length) return toast('Add at least one item','error');
  const total = poItems.reduce((s,i)=>s+i.amount,0);
  await api.purchaseOrders.save({
    po_no: document.getElementById('po-no').value,
    date: document.getElementById('po-date').value,
    supplier_id: document.getElementById('po-supplier').value || null,
    total, notes: document.getElementById('po-notes').value,
    status: 'Draft', items: poItems
  });
  toast('Purchase Order saved!');
  closeModal();
  render();
};
