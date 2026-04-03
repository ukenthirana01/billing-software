// Suppliers Module
let allSuppliers = [];

export async function render() {
  allSuppliers = await api.suppliers.getAll();
  renderPage();
}

function renderPage(filter='') {
  const list = filter ? allSuppliers.filter(s=>s.name.toLowerCase().includes(filter.toLowerCase())||s.phone.includes(filter)) : allSuppliers;
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h2>Suppliers <span class="badge badge-gray">${allSuppliers.length}</span></h2>
      <div class="page-actions">
        <div class="search-bar"><input id="sup-search" placeholder="Search suppliers..." value="${filter}" /></div>
        <button class="btn btn-primary" onclick="showAddSupplier()">+ Add Supplier</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>GST No</th><th>State</th><th>Opening Balance</th><th>Actions</th></tr></thead>
          <tbody>${list.map((s,i)=>`
            <tr>
              <td>${i+1}</td>
              <td><strong>${s.name}</strong></td>
              <td>${s.phone||'-'}</td>
              <td>${s.gst_no||'-'}</td>
              <td>${s.state||'-'}</td>
              <td>${fmtCur(s.opening_balance)}</td>
              <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="editSupplier(${s.id})">✏ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSupplier(${s.id})">🗑</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted" style="padding:30px">No suppliers found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('sup-search').addEventListener('input', e=>renderPage(e.target.value));
}

function supplierForm(s={}) {
  const states = INDIAN_STATES.map(st=>`<option ${s.state===st?'selected':''}>${st}</option>`).join('');
  return `<div class="form-grid">
    <div class="form-group"><label class="form-label">Name *</label><input class="form-control" id="sf-name" value="${s.name||''}" /></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="sf-phone" value="${s.phone||''}" /></div>
    <div class="form-group"><label class="form-label">GST Number</label><input class="form-control" id="sf-gst" value="${s.gst_no||''}" /></div>
    <div class="form-group"><label class="form-label">State</label><select class="form-control" id="sf-state"><option value="">Select</option>${states}</select></div>
    <div class="form-group"><label class="form-label">Opening Balance (₹)</label><input class="form-control" id="sf-balance" type="number" value="${s.opening_balance||0}" /></div>
    <div class="form-group full"><label class="form-label">Address</label><textarea class="form-control" id="sf-address">${s.address||''}</textarea></div>
  </div>`;
}

window.showAddSupplier = function() {
  openModal('Add Supplier', supplierForm(), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveSupplier()">Save</button>`);
};
window.editSupplier = function(id) {
  const s = allSuppliers.find(x=>x.id===id);
  openModal('Edit Supplier', supplierForm(s), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveSupplier(${id})">Update</button>`);
};
window.saveSupplier = async function(id) {
  const data = {
    name: document.getElementById('sf-name').value.trim(),
    phone: document.getElementById('sf-phone').value,
    gst_no: document.getElementById('sf-gst').value,
    state: document.getElementById('sf-state').value,
    address: document.getElementById('sf-address').value,
    opening_balance: parseFloat(document.getElementById('sf-balance').value)||0
  };
  if (!data.name) { toast('Name is required','error'); return; }
  if (id) { data.id=id; await api.suppliers.update(data); toast('Supplier updated'); }
  else { await api.suppliers.add(data); toast('Supplier added'); }
  closeModal();
  allSuppliers = await api.suppliers.getAll();
  renderPage();
};
window.deleteSupplier = async function(id) {
  if (!(await confirmModal('Delete Supplier', 'Are you sure you want to delete this supplier?'))) return;
  await api.suppliers.delete(id);
  toast('Supplier deleted');
  allSuppliers = await api.suppliers.getAll();
  renderPage();
};
