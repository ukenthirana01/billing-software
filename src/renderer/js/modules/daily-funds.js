// Daybook / Daily Funds Module
let allFunds = [], allSuppliers = [], allCustomers = [];
let dfFilterRange = 'this_month'; // 'all', 'today', 'this_month', 'custom'
let dfFilterFrom = '';
let dfFilterTo = '';
let dfFilterParty = 'all'; // 'all', 'Customer', 'Supplier'

export async function render() {
  [allFunds, allSuppliers, allCustomers] = await Promise.all([
    api.dailyFunds.getAll(),
    api.suppliers.getAll(),
    api.customers.getAll()
  ]);
  
  // Set default current month boundaries if empty
  if (!dfFilterFrom) dfFilterFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 2).toISOString().split('T')[0];
  if (!dfFilterTo) dfFilterTo = today();
  
  renderDaybook();
}

function renderDaybook() {
  let filtered = allFunds.filter(f => {
    if (dfFilterParty !== 'all' && f.party_type !== dfFilterParty) return false;
    if (dfFilterRange === 'today' && f.date !== today()) return false;
    if (dfFilterRange === 'this_month') {
      const d = new Date();
      const fd = new Date(f.date);
      if (fd.getMonth() !== d.getMonth() || fd.getFullYear() !== d.getFullYear()) return false;
    }
    if (dfFilterRange === 'custom') {
      if (dfFilterFrom && f.date < dfFilterFrom) return false;
      if (dfFilterTo && f.date > dfFilterTo) return false;
    }
    return true;
  });

  let totalIn = 0;
  let totalOut = 0;
  filtered.forEach(f => {
    totalIn += Number(f.credit || 0);
    totalOut += Number(f.debit || 0);
  });
  const balance = totalIn - totalOut;

  document.getElementById('page-content').innerHTML = `
    <div class="page-header flex justify-between items-end mb-4">
      <div>
        <h2 style="font-family:'Poppins',sans-serif;font-weight:700;color:var(--gray-900);margin:0 0 4px;font-size:24px"><i class="bi bi-wallet2" style="margin-right:8px;color:var(--primary-600)"></i>Day Book & Statements</h2>
        <p style="margin:0;color:var(--gray-500);font-size:14px">Generate custom statements and manage daily income/expenses.</p>
      </div>
      <button class="btn btn-primary shadow-sm" style="padding:10px 20px;border-radius:8px;font-weight:600;font-family:'Poppins',sans-serif" onclick="showAddFund()"><i class="bi bi-plus-lg" style="margin-right:6px"></i> Add Record</button>
    </div>

    <!-- Filter Bar -->
    <div class="card mb-4" style="border-radius:12px;box-shadow:0 2px 4px -1px rgba(0,0,0,0.05)">
      <div class="card-body" style="padding:16px 20px;display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:180px">
          <label style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px;display:block">Date Range</label>
          <select class="form-control" id="df-filter-range" onchange="applyDfFilters()">
            <option value="today" ${dfFilterRange==='today'?'selected':''}>Today</option>
            <option value="this_month" ${dfFilterRange==='this_month'?'selected':''}>This Month</option>
            <option value="all" ${dfFilterRange==='all'?'selected':''}>All Time</option>
            <option value="custom" ${dfFilterRange==='custom'?'selected':''}>Custom Range</option>
          </select>
        </div>
        
        <div id="df-custom-dates" style="display:${dfFilterRange==='custom'?'flex':'none'};gap:16px;flex:2;min-width:240px">
          <div style="flex:1">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px;display:block">From Date</label>
            <input type="date" class="form-control" id="df-filter-from" value="${dfFilterFrom}" onchange="applyDfFilters()" />
          </div>
          <div style="flex:1">
            <label style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px;display:block">To Date</label>
            <input type="date" class="form-control" id="df-filter-to" value="${dfFilterTo}" onchange="applyDfFilters()" />
          </div>
        </div>

        <div style="flex:1;min-width:180px">
          <label style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:6px;display:block">Party Type</label>
          <select class="form-control" id="df-filter-party" onchange="applyDfFilters()">
            <option value="all" ${dfFilterParty==='all'?'selected':''}>All Transactions</option>
            <option value="Customer" ${dfFilterParty==='Customer'?'selected':''}>Customers Only</option>
            <option value="Supplier" ${dfFilterParty==='Supplier'?'selected':''}>Suppliers Only</option>
          </select>
        </div>
        
        <div>
           <button class="btn btn-secondary" onclick="exportDfCustomStatement()" title="Print Statement"><i class="bi bi-printer"></i> Print Statement</button>
        </div>
      </div>
    </div>

    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-bottom:28px">
      <!-- Total Income -->
      <div class="stat-card" style="background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);border:1px solid #10b98130;border-radius:16px;padding:24px;box-shadow:0 4px 6px -1px rgba(16, 185, 129, 0.1);transition:transform 0.2s" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:12px;font-weight:700;color:#047857;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Total Income</div>
            <h3 style="margin:0;font-size:28px;font-family:'Poppins',sans-serif;color:#065f46;font-weight:700">${fmtCur(totalIn)}</h3>
          </div>
          <div style="width:48px;height:48px;border-radius:12px;background:white;color:#10b981;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 2px 4px rgba(0,0,0,0.05)"><i class="bi bi-arrow-down-left"></i></div>
        </div>
      </div>
      
      <!-- Total Expense -->
      <div class="stat-card" style="background:linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);border:1px solid #ef444430;border-radius:16px;padding:24px;box-shadow:0 4px 6px -1px rgba(239, 68, 68, 0.1);transition:transform 0.2s" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:12px;font-weight:700;color:#b91c1c;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Total Expense</div>
            <h3 style="margin:0;font-size:28px;font-family:'Poppins',sans-serif;color:#991b1b;font-weight:700">${fmtCur(totalOut)}</h3>
          </div>
          <div style="width:48px;height:48px;border-radius:12px;background:white;color:#ef4444;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 2px 4px rgba(0,0,0,0.05)"><i class="bi bi-arrow-up-right"></i></div>
        </div>
      </div>

      <!-- Net Balance -->
      <div class="stat-card" style="background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);border:1px solid #3b82f630;border-radius:16px;padding:24px;box-shadow:0 4px 6px -1px rgba(59, 130, 246, 0.1);transition:transform 0.2s" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:12px;font-weight:700;color:#1d4ed8;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Net Balance</div>
            <h3 style="margin:0;font-size:28px;font-family:'Poppins',sans-serif;color:#1e3a8a;font-weight:700">${fmtCur(balance)}</h3>
          </div>
          <div style="width:48px;height:48px;border-radius:12px;background:white;color:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 2px 4px rgba(0,0,0,0.05)"><i class="bi bi-wallet2"></i></div>
        </div>
      </div>
    </div>

    <div class="card" style="border-radius:12px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);overflow:hidden">
      <div class="card-header" style="background:var(--gray-50);border-bottom:1px solid var(--gray-200);padding:16px 20px"><span class="card-title" style="font-family:'Poppins',sans-serif;font-weight:600;font-size:16px;color:var(--gray-800)">Transaction History</span></div>
      <div class="table-wrap" style="padding:0">
        <table class="data-table" style="margin:0;width:100%">
          <thead style="background:white">
            <tr>
              <th style="padding:16px 20px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)">#</th>
              <th style="padding:16px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)">Date</th>
              <th style="padding:16px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)">Description</th>
              <th style="padding:16px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)">Party Side</th>
              <th style="padding:16px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)">Party Name</th>
              <th class="text-right" style="padding:16px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)">Fund In (Cr)</th>
              <th class="text-right" style="padding:16px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)">Fund Out (Dr)</th>
              <th style="padding:16px 20px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500)"></th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((f) => `
              <tr style="border-bottom:1px solid var(--gray-100);transition:background 0.2s" onmouseover="this.style.background='var(--primary-50)'" onmouseout="this.style.background=''">
                <td style="padding:16px 20px;color:var(--gray-500)">${f.id}</td>
                <td style="padding:16px 0;font-weight:500">${f.date}</td>
                <td style="padding:16px 0"><strong style="color:var(--gray-800)">${escapeHtml(f.description) || '-'}</strong></td>
                <td style="padding:16px 0">${f.party_type ? `<span style="background:var(--primary-100);color:var(--primary-700);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600">${escapeHtml(f.party_type)}</span>` : '<span style="color:var(--gray-400)">-</span>'}</td>
                <td style="padding:16px 0">${f.party_name ? `<span style="background:var(--gray-100);color:var(--gray-700);padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600">${escapeHtml(f.party_name)}</span>` : '<span style="color:var(--gray-400)">-</span>'}</td>
                <td class="text-right" style="padding:16px 0;color:#059669;font-weight:600">${f.credit ? fmtCur(f.credit) : '<span style="color:var(--gray-300)">-</span>'}</td>
                <td class="text-right" style="padding:16px 0;color:#dc2626;font-weight:600">${f.debit ? fmtCur(f.debit) : '<span style="color:var(--gray-300)">-</span>'}</td>
                <td class="actions" style="padding:16px 20px;text-align:right">
                  <button class="btn btn-sm" style="background:var(--danger-bg);color:var(--danger);border:none;border-radius:6px;width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s" onmouseover="this.style.background='#fca5a5';this.style.color='#991b1b'" onmouseout="this.style.background='var(--danger-bg)';this.style.color='var(--danger)'" onclick="deleteFund(${f.id})"><i class="bi bi-trash3"></i></button>
                </td>
              </tr>`).join('') || '<tr><td colspan="8" class="text-center text-muted" style="padding:60px;font-size:15px">No day book records found. Add your first transaction above.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

window.applyDfFilters = function() {
  dfFilterRange = document.getElementById('df-filter-range')?.value || 'this_month';
  if (dfFilterRange === 'custom') {
    dfFilterFrom = document.getElementById('df-filter-from')?.value || dfFilterFrom;
    dfFilterTo = document.getElementById('df-filter-to')?.value || dfFilterTo;
  }
  dfFilterParty = document.getElementById('df-filter-party')?.value || 'all';
  renderDaybook();
};

window.exportDfCustomStatement = function() {
  let filtered = allFunds.filter(f => {
    if (dfFilterParty !== 'all' && f.party_type !== dfFilterParty) return false;
    if (dfFilterRange === 'today' && f.date !== today()) return false;
    if (dfFilterRange === 'this_month') {
      const d = new Date();
      const fd = new Date(f.date);
      if (fd.getMonth() !== d.getMonth() || fd.getFullYear() !== d.getFullYear()) return false;
    }
    if (dfFilterRange === 'custom') {
      if (dfFilterFrom && f.date < dfFilterFrom) return false;
      if (dfFilterTo && f.date > dfFilterTo) return false;
    }
    return true;
  });
  
  if (!filtered.length) {
    toast('No records found for the selected filters to print.', 'warning');
    return;
  }

  const statementTitle = dfFilterParty === 'all' ? 'Day Book Statement' : (dfFilterParty + 's Statement');
  let dateSub = '';
  if (dfFilterRange === 'today') dateSub = 'Date: ' + today();
  else if (dfFilterRange === 'this_month') dateSub = 'For Current Month';
  else if (dfFilterRange === 'custom') dateSub = 'From: ' + dfFilterFrom + ' To: ' + dfFilterTo;
  else dateSub = 'All Time Records';

  let totalIn = 0, totalOut = 0;
  
  const rows = filtered.map(f => {
    totalIn += Number(f.credit || 0); totalOut += Number(f.debit || 0);
    return `<tr>
      <td style="padding:8px;border:1px solid #ddd">${f.date}</td>
      <td style="padding:8px;border:1px solid #ddd">${f.description}</td>
      <td style="padding:8px;border:1px solid #ddd">${f.party_name || '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;color:green">${f.credit ? f.credit.toFixed(2) : '-'}</td>
      <td style="padding:8px;border:1px solid #ddd;color:red">${f.debit ? f.debit.toFixed(2) : '-'}</td>
    </tr>`;
  }).join('');

  const html = `<html>
    <head>
      <title>${statementTitle}</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        h2 { text-align: center; margin-bottom: 5px; }
        .sub { text-align: center; color: #555; margin-bottom: 20px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f4f4f4; padding: 10px; border: 1px solid #ddd; text-align: left; }
        .summary { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; margin-top:20px; padding:15px; background:#f9f9f9; border:1px solid #eee; }
      </style>
    </head>
    <body>
      <h2>${statementTitle}</h2>
      <div class="sub">${dateSub}</div>
      <table>
        <thead>
          <tr><th>Date</th><th>Description</th><th>Party Name</th><th>Credit (In)</th><th>Debit (Out)</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <span>Total Income (Cr): Rs. ${totalIn.toFixed(2)}</span>
        <span>Total Expense (Dr): Rs. ${totalOut.toFixed(2)}</span>
        <span>Net Balance: Rs. ${(totalIn - totalOut).toFixed(2)}</span>
      </div>
      <div style="text-align:center;margin-top:30px;font-size:12px;color:#888">Generated by Relyce Book</div>
    </body>
  </html>`;
  
  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
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
