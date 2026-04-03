// Ledger Module
let allLedgers = [], allGroups = [];

export async function render() {
  [allLedgers, allGroups] = await Promise.all([api.ledgers.getAll(), api.ledgerGroups.getAll()]);
  renderLedger();
}

function renderLedger() {
  const gOpts = allGroups.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h2>Ledger</h2>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="showAddLedger()">+ New Ledger</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Ledger Name</th><th>Group</th><th>Opening Balance</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody>${allLedgers.map((l,i)=>`
            <tr>
              <td>${i+1}</td>
              <td><strong>${l.name}</strong></td>
              <td><span class="badge badge-brown">${l.group_name}</span></td>
              <td>${fmtCur(l.opening_balance)}</td>
              <td><span class="badge ${l.balance_type==='Dr'?'badge-danger':'badge-success'}">${l.balance_type}</span></td>
              <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="viewLedgerTx(${l.id},'${l.name.replace(/'/g,"\\'")}')">📋 Transactions</button>
                <button class="btn btn-sm btn-secondary" onclick="editLedger(${l.id})">✏</button>
                <button class="btn btn-sm btn-danger" onclick="deleteLedger(${l.id})">🗑</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted" style="padding:30px">No ledgers found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

function ledgerForm(l={}) {
  const gOpts = allGroups.map(g=>`<option value="${g.id}" ${l.group_id==g.id?'selected':''}>${g.name}</option>`).join('');
  return `<div class="form-grid">
    <div class="form-group"><label class="form-label">Ledger Name *</label><input class="form-control" id="lf-name" value="${l.name||''}" /></div>
    <div class="form-group"><label class="form-label">Group *</label><select class="form-control" id="lf-group"><option value="">Select Group</option>${gOpts}</select></div>
    <div class="form-group"><label class="form-label">Opening Balance (₹)</label><input class="form-control" id="lf-balance" type="number" value="${l.opening_balance||0}" /></div>
    <div class="form-group"><label class="form-label">Balance Type</label><select class="form-control" id="lf-type"><option value="Dr" ${l.balance_type==='Dr'?'selected':''}>Dr (Debit)</option><option value="Cr" ${l.balance_type==='Cr'?'selected':''}>Cr (Credit)</option></select></div>
  </div>`;
}

window.showAddLedger = function() {
  openModal('Add Ledger', ledgerForm(), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveLedger()">Save</button>`);
};
window.editLedger = function(id) {
  const l = allLedgers.find(x=>x.id===id);
  openModal('Edit Ledger', ledgerForm(l), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveLedger(${id})">Update</button>`);
};
window.saveLedger = async function(id) {
  const data = {
    name: document.getElementById('lf-name').value.trim(),
    group_id: document.getElementById('lf-group').value,
    opening_balance: parseFloat(document.getElementById('lf-balance').value)||0,
    balance_type: document.getElementById('lf-type').value
  };
  if (!data.name||!data.group_id) { toast('Fill all required fields','error'); return; }
  if (id) { data.id=id; await api.ledgers.update(data); toast('Ledger updated'); }
  else { await api.ledgers.add(data); toast('Ledger added'); }
  closeModal();
  allLedgers = await api.ledgers.getAll();
  renderLedger();
};
window.deleteLedger = async function(id) {
  if(!(await confirmModal('Delete Ledger', 'Are you sure you want to delete this ledger?'))) return;
  await api.ledgers.delete(id);
  toast('Ledger deleted');
  allLedgers = await api.ledgers.getAll();
  renderLedger();
};
window.viewLedgerTx = async function(id, name) {
  const txs = await api.ledgers.getTransactions(id);
  openModal(`Transactions - ${name}`, `
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Date</th><th>Type</th><th>Debit</th><th>Credit</th><th>Narration</th><th>Ref</th></tr></thead>
      <tbody>${txs.map(t=>`<tr><td>${t.date}</td><td>${t.type}</td><td>${fmtCur(t.debit)}</td><td>${fmtCur(t.credit)}</td><td>${t.narration||'-'}</td><td>${t.ref_no||'-'}</td></tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted" style="padding:20px">No transactions</td></tr>'}
      </tbody>
    </table></div>`);
};
