// Customers Module
let allCustomers = [];

export async function render() {
  allCustomers = await api.customers.getAll();
  renderPage();
}

function renderPage(filter='') {
  const list = filter ? allCustomers.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.phone.includes(filter)) : allCustomers;
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h2>Customers <span class="badge badge-gray">${allCustomers.length}</span></h2>
      <div class="page-actions">
        <div class="search-bar"><input id="cust-search" placeholder="Search customers..." value="${filter}" /></div>
        <button class="btn btn-primary" onclick="showAddCustomer()">+ Add Customer</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>GST No</th><th>State</th><th>Credit Limit</th><th>Opening Balance</th><th>Actions</th></tr></thead>
          <tbody>${list.map((c,i)=>`
            <tr>
              <td>${i+1}</td>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone||'-'}</td>
              <td>${c.gst_no||'-'}</td>
              <td>${c.state||'-'}</td>
              <td>${fmtCur(c.credit_limit)}</td>
              <td>${fmtCur(c.opening_balance)}</td>
              <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="editCustomer(${c.id})">✏ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">🗑</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted" style="padding:30px">No customers found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('cust-search').addEventListener('input', e => renderPage(e.target.value));
}

function customerForm(c={}) {
  const states = INDIAN_STATES.map(s=>`<option ${c.state===s?'selected':''}>${s}</option>`).join('');
  return `<div class="form-grid">
    <div class="form-group"><label class="form-label">Name *</label><input class="form-control" id="cf-name" value="${c.name||''}" /></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="cf-phone" value="${c.phone||''}" /></div>
    <div class="form-group"><label class="form-label">GST Number</label><input class="form-control" id="cf-gst" value="${c.gst_no||''}" /></div>
    <div class="form-group"><label class="form-label">State</label><select class="form-control" id="cf-state"><option value="">Select</option>${states}</select></div>
    <div class="form-group"><label class="form-label">Credit Limit (₹)</label><input class="form-control" id="cf-credit" type="number" value="${c.credit_limit||0}" /></div>
    <div class="form-group"><label class="form-label">Opening Balance (₹)</label><input class="form-control" id="cf-balance" type="number" value="${c.opening_balance||0}" /></div>
    <div class="form-group full"><label class="form-label">Address</label><textarea class="form-control" id="cf-address">${c.address||''}</textarea></div>
  </div>`;
}

window.showAddCustomer = function() {
  openModal('Add Customer', customerForm(), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveCustomer()">Save Customer</button>`);
};
window.editCustomer = async function(id) {
  const c = allCustomers.find(x=>x.id===id);
  openModal('Edit Customer', customerForm(c), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveCustomer(${id})">Update Customer</button>`);
};
window.saveCustomer = async function(id) {
  const data = {
    name: document.getElementById('cf-name').value.trim(),
    phone: document.getElementById('cf-phone').value,
    gst_no: document.getElementById('cf-gst').value,
    state: document.getElementById('cf-state').value,
    address: document.getElementById('cf-address').value,
    credit_limit: parseFloat(document.getElementById('cf-credit').value)||0,
    opening_balance: parseFloat(document.getElementById('cf-balance').value)||0
  };
  if (!data.name) { toast('Name is required','error'); return; }
  if (id) { data.id=id; await api.customers.update(data); toast('Customer updated'); }
  else { await api.customers.add(data); toast('Customer added'); }
  closeModal();
  allCustomers = await api.customers.getAll();
  renderPage();
};
window.deleteCustomer = async function(id) {
  if (!(await confirmModal('Delete Customer', 'Are you sure you want to delete this customer?'))) return;
  await api.customers.delete(id);
  toast('Customer deleted');
  allCustomers = await api.customers.getAll();
  renderPage();
};
