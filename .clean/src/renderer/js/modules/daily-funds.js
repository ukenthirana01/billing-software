// Daybook / Daily Funds Module
let allFunds = [], allSuppliers = [], allCustomers = [];

export async function render() {
  [allFunds, allSuppliers, allCustomers] = await Promise.all([
    api.dailyFunds.getAll(),
    api.suppliers.getAll(),
    api.customers.getAll()
  ]);
  renderDaybook();
}

function renderDaybook() {
  let totalIn = 0;
  let totalOut = 0;
  allFunds.forEach(f => {
    totalIn += Number(f.credit || 0);
    totalOut += Number(f.debit || 0);
  });
  const balance = totalIn - totalOut;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header flex justify-between items-center mb-4">
      <div class="flex gap-4" style="flex-wrap:wrap">
        <div class="card p-3" style="min-width:160px;background:var(--success-bg);color:var(--success)">
          <div style="font-size:11px;font-weight:700">TOTAL INCOME</div>
          <h3 style="margin:0">${fmtCur(totalIn)}</h3>
        </div>
        <div class="card p-3" style="min-width:160px;background:var(--danger-bg);color:var(--danger)">
          <div style="font-size:11px;font-weight:700">TOTAL EXPENSE</div>
          <h3 style="margin:0">${fmtCur(totalOut)}</h3>
        </div>
        <div class="card p-3" style="min-width:160px;background:var(--primary-100);color:var(--primary-700)">
          <div style="font-size:11px;font-weight:700">NET BALANCE</div>
          <h3 style="margin:0">${fmtCur(balance)}</h3>
        </div>
      </div>
      <div>
        <button class="btn btn-primary" onclick="showAddFund()"><i class="bi bi-plus-lg"></i> Add Record</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Daybook Records</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Description</th>
              <th>Party Side</th>
              <th>Party Name</th>
              <th class="text-right">Fund In (Cr)</th>
              <th class="text-right">Fund Out (Dr)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allFunds.map((f) => `
              <tr>
                <td>${f.id}</td>
                <td>${f.date}</td>
                <td><strong>${f.description || '-'}</strong></td>
                <td>${f.party_type ? `<span class="badge badge-info">${f.party_type}</span>` : '-'}</td>
                <td>${f.party_name ? `<span class="badge badge-gray">${f.party_name}</span>` : '-'}</td>
                <td class="text-right" style="color:var(--success);font-weight:600">${f.credit ? fmtCur(f.credit) : '-'}</td>
                <td class="text-right" style="color:var(--danger);font-weight:600">${f.debit ? fmtCur(f.debit) : '-'}</td>
                <td class="actions">
                  <button class="btn btn-sm btn-danger" onclick="deleteFund(${f.id})"><i class="bi bi-trash-fill"></i></button>
                </td>
              </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted" style="padding:40px">No records found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function fundForm() {
  return `<div class="form-grid form-grid-2">
    <div class="form-group">
      <label class="form-label">Date *</label>
      <input class="form-control" id="df-date" type="date" value="${today()}" />
    </div>

    <div class="form-group">
      <label class="form-label">Transaction Type *</label>
      <select class="form-control" id="df-type">
        <option value="in">Fund In / Income (Credit)</option>
        <option value="out">Fund Out / Expense (Debit)</option>
      </select>
    </div>

    <div class="form-group full">
      <label class="form-label">Description *</label>
      <input class="form-control" id="df-desc" placeholder="Example: Cash received from customer, Office rent, Supplier payment" />
    </div>

    <div class="form-group">
      <label class="form-label">Amount (Rs.) *</label>
      <input class="form-control" id="df-amount" type="number" step="0.01" min="0" value="" placeholder="0.00" />
    </div>

    <div class="form-group">
      <label class="form-label">Party Side (Optional)</label>
      <select class="form-control" id="df-party-side" onchange="updateDaybookPartyOptions()">
        <option value="">None</option>
        <option value="Customer">Customer</option>
        <option value="Supplier">Supplier</option>
      </select>
    </div>

    <div class="form-group full">
      <label class="form-label">Select Party (Optional)</label>
      <select class="form-control" id="df-party" disabled>
        <option value="">-- Select party side first --</option>
      </select>
    </div>

    <div class="form-group full" style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:10px 12px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" id="df-copy-ledger" style="width:16px;height:16px" disabled />
        <span style="font-size:13px;font-weight:600;color:var(--gray-700)">Also copy this transaction to selected party ledger (optional)</span>
      </label>
      <div style="font-size:11px;color:var(--gray-500);margin-top:6px;">Enable this only when you want a separate Customer/Supplier ledger transaction entry.</div>
    </div>
  </div>`;
}

window.updateDaybookPartyOptions = function() {
  const side = document.getElementById('df-party-side')?.value || '';
  const partySel = document.getElementById('df-party');
  const copyCheck = document.getElementById('df-copy-ledger');
  if (!partySel || !copyCheck) return;

  let list = [];
  if (side === 'Customer') list = allCustomers;
  if (side === 'Supplier') list = allSuppliers;

  if (!side) {
    partySel.innerHTML = '<option value="">-- Select party side first --</option>';
    partySel.disabled = true;
    copyCheck.checked = false;
    copyCheck.disabled = true;
    return;
  }

  partySel.disabled = false;
  partySel.innerHTML = `<option value="">-- Optional: Select ${side} --</option>${list.map(p => `<option value="${p.id}|${(p.name || '').replace(/\|/g,' ')}">${p.name}</option>`).join('')}`;
  copyCheck.checked = false;
  copyCheck.disabled = true;

  partySel.onchange = () => {
    const hasParty = Boolean(partySel.value);
    copyCheck.disabled = !hasParty;
    if (!hasParty) copyCheck.checked = false;
  };
};

window.showAddFund = function() {
  openModal(
    'Add Daybook Record',
    fundForm(),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveFund()">Save Record</button>`
  );
  setTimeout(() => {
    if (typeof window.updateDaybookPartyOptions === 'function') window.updateDaybookPartyOptions();
  }, 0);
};

window.saveFund = async function() {
  const date = document.getElementById('df-date')?.value;
  const desc = document.getElementById('df-desc')?.value?.trim();
  const type = document.getElementById('df-type')?.value;
  const amt = parseFloat(document.getElementById('df-amount')?.value || '0');
  const side = document.getElementById('df-party-side')?.value || '';
  const partyVal = document.getElementById('df-party')?.value || '';
  const copyToParty = Boolean(document.getElementById('df-copy-ledger')?.checked);

  if (!date || !desc || !Number.isFinite(amt) || amt <= 0) {
    toast('Please enter date, description, and a valid amount', 'error');
    return;
  }

  let party_id = null;
  let party_name = '';
  let party_type = '';

  if (side && partyVal) {
    const [idRaw, nameRaw] = partyVal.split('|');
    const id = Number.parseInt(idRaw, 10);
    if (Number.isFinite(id) && id > 0) {
      party_id = id;
      party_name = nameRaw || '';
      party_type = side;
    }
  }

  if (copyToParty && (!party_id || !party_type)) {
    toast('Select a valid party before enabling copy to ledger', 'error');
    return;
  }

  const payload = {
    date,
    description: desc,
    credit: type === 'in' ? amt : 0,
    debit: type === 'out' ? amt : 0,
    party_type,
    party_id,
    party_name,
    copy_to_party: copyToParty
  };

  try {
    await api.dailyFunds.add(payload);
    toast(copyToParty ? 'Record saved and copied to party ledger' : 'Record saved successfully');
    closeModal();
    await render();
  } catch (e) {
    toast(e?.message || 'Failed to save daybook record', 'error');
  }
};

window.deleteFund = async function(id) {
  if (!(await confirmModal('Delete Record', 'Are you sure you want to delete this daybook record?'))) return;
  try {
    await api.dailyFunds.delete(id);
    toast('Record deleted');
    await render();
  } catch (e) {
    toast(e?.message || 'Failed to delete record', 'error');
  }
};
