// Debit Note Module (Purchase Returns)
let dnProds = [], dnSuppliers = [], dnItems = [];
export async function render() {
  [dnProds, dnSuppliers] = await Promise.all([api.products.getAll(), api.suppliers.getAll()]);
  renderDN();
}
function renderDN() {
  dnItems = [];
  const supOpts = dnSuppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h2>Debit Note (Purchase Return)</h2><button class="btn btn-sm btn-secondary" onclick="viewAllDN()">View All</button></div>
    <div class="card mb-4">
      <div class="card-body">
        <div class="form-grid form-grid-3">
          <div class="form-group"><label class="form-label">Date</label><input class="form-control" id="dn-date" type="date" value="${today()}" /></div>
          <div class="form-group"><label class="form-label">Supplier</label><select class="form-control" id="dn-sup"><option value="">Select</option>${supOpts}</select></div>
          <div class="form-group"><label class="form-label">Reason</label><input class="form-control" id="dn-reason" placeholder="Return reason" /></div>
        </div>
        <div class="flex gap-2 mt-3"><input class="form-control" id="dn-search" placeholder="Search product..." style="flex:1" /><div id="dn-sugg"></div></div>
        <div class="table-wrap mt-3"><table class="billing-table">
          <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>Amount</th><th></th></tr></thead>
          <tbody id="dn-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding:16px">No items</td></tr></tbody>
        </table></div>
        <div class="flex justify-between mt-3" style="font-size:18px;font-weight:700">
          <span>Total:</span><span id="dn-total">₹ 0.00</span>
        </div>
        <button class="btn btn-success mt-3" onclick="saveDN()">💾 Save Debit Note</button>
      </div>
    </div>
    <div id="dn-list-area"></div>`;

  document.getElementById('dn-search').addEventListener('input', function() {
    const q=this.value.toLowerCase();
    if(!q){document.getElementById('dn-sugg').innerHTML='';return;}
    const matches=dnProds.filter(p=>p.name.toLowerCase().includes(q)).slice(0,5);
    document.getElementById('dn-sugg').innerHTML=matches.length?`<div style="border:1px solid var(--gray-200);background:white;position:absolute;z-index:100;box-shadow:var(--shadow-md);min-width:300px">${matches.map(p=>`<div onclick="addDNItem(${p.id})" style="padding:8px 12px;cursor:pointer" onmouseover="this.style.background='var(--brown-50)'" onmouseout="this.style.background=''"><strong>${p.name}</strong> ₹${p.purchase_price}</div>`).join('')}</div>`:'';
  });
}
window.addDNItem=function(pid){const p=dnProds.find(x=>x.id===pid);const ex=dnItems.find(i=>i.product_id===pid);if(ex)ex.qty++;else dnItems.push({product_id:p.id,product_name:p.name,qty:1,price:p.purchase_price,amount:0});document.getElementById('dn-search').value='';document.getElementById('dn-sugg').innerHTML='';recalcDN();};
function recalcDN(){let t=0;dnItems.forEach(i=>{i.amount=i.qty*i.price;t+=i.amount;});document.getElementById('dn-total').textContent=fmtCur(t);document.getElementById('dn-tbody').innerHTML=dnItems.map((i,idx)=>`<tr><td>${idx+1}</td><td>${i.product_name}</td><td><input type="number" value="${i.qty}" onchange="updateDNItem(${idx},'qty',this.value)" style="width:60px" /></td><td>${fmtCur(i.price)}</td><td>${fmtCur(i.amount)}</td><td><button class="btn btn-sm btn-danger" onclick="removeDNItem(${idx})">✕</button></td></tr>`).join('');}
window.updateDNItem=(i,f,v)=>{dnItems[i][f]=parseFloat(v)||0;recalcDN();};
window.removeDNItem=(i)=>{dnItems.splice(i,1);recalcDN();};
window.saveDN=async function(){if(!dnItems.length){toast('Add items','error');return;}const total=dnItems.reduce((s,i)=>s+i.amount,0);const note={date:document.getElementById('dn-date').value,supplier_id:document.getElementById('dn-sup').value||null,total,reason:document.getElementById('dn-reason').value};await api.debitNotes.save({note,items:dnItems});toast('Debit note saved! Stock updated.');renderDN();};
window.viewAllDN=async function(){const all=await api.debitNotes.getAll();document.getElementById('dn-list-area').innerHTML=`<div class="card"><div class="card-header"><span class="card-title">All Debit Notes</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Note No</th><th>Date</th><th>Supplier</th><th>Total</th></tr></thead><tbody>${all.map(n=>`<tr><td>${n.note_no}</td><td>${n.date}</td><td>${n.supplier_name||'-'}</td><td>${fmtCur(n.total)}</td></tr>`).join('')}</tbody></table></div></div>`;};
