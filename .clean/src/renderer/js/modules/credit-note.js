// Credit Note Module (Sales Returns)
let cnProds = [], cnCustomers = [], cnItems = [];
export async function render() {
  [cnProds, cnCustomers] = await Promise.all([api.products.getAll(), api.customers.getAll()]);
  renderCN();
}
function renderCN() {
  cnItems = [];
  const custOpts = cnCustomers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h2>Credit Note (Sales Return)</h2><button class="btn btn-sm btn-secondary" onclick="viewAllCN()">View All</button></div>
    <div class="card mb-4">
      <div class="card-body">
        <div class="form-grid form-grid-3">
          <div class="form-group"><label class="form-label">Date</label><input class="form-control" id="cn-date" type="date" value="${today()}" /></div>
          <div class="form-group"><label class="form-label">Customer</label><select class="form-control" id="cn-cust"><option value="">Select</option>${custOpts}</select></div>
          <div class="form-group"><label class="form-label">Reason</label><input class="form-control" id="cn-reason" placeholder="Return reason" /></div>
        </div>
        <div class="flex gap-2 mt-3"><input class="form-control" id="cn-search" placeholder="Search product..." style="flex:1" /><div id="cn-sugg"></div></div>
        <div class="table-wrap mt-3"><table class="billing-table">
          <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>Amount</th><th></th></tr></thead>
          <tbody id="cn-tbody"><tr><td colspan="6" class="text-center text-muted" style="padding:16px">No items</td></tr></tbody>
        </table></div>
        <div class="flex justify-between mt-3" style="font-size:18px;font-weight:700">
          <span>Total:</span><span id="cn-total">₹ 0.00</span>
        </div>
        <button class="btn btn-success mt-3" onclick="saveCN()">💾 Save Credit Note</button>
      </div>
    </div>
    <div id="cn-list-area"></div>`;

  document.getElementById('cn-search').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    if (!q) { document.getElementById('cn-sugg').innerHTML=''; return; }
    const matches = cnProds.filter(p=>p.name.toLowerCase().includes(q)).slice(0,5);
    document.getElementById('cn-sugg').innerHTML = matches.length ? `
      <div style="border:1px solid var(--gray-200);background:white;position:absolute;z-index:100;box-shadow:var(--shadow-md);min-width:300px">
        ${matches.map(p=>`<div onclick="addCNItem(${p.id})" style="padding:8px 12px;cursor:pointer" onmouseover="this.style.background='var(--brown-50)'" onmouseout="this.style.background=''"><strong>${p.name}</strong> ₹${p.selling_price}</div>`).join('')}
      </div>` : '';
  });
}

window.addCNItem = function(pid) {
  const p = cnProds.find(x=>x.id===pid);
  const ex = cnItems.find(i=>i.product_id===pid);
  if (ex) ex.qty++; else cnItems.push({ product_id:p.id, product_name:p.name, qty:1, price:p.selling_price, amount:0 });
  document.getElementById('cn-search').value='';
  document.getElementById('cn-sugg').innerHTML='';
  recalcCN();
};
function recalcCN() {
  let t=0;
  cnItems.forEach(i=>{ i.amount=i.qty*i.price; t+=i.amount; });
  document.getElementById('cn-total').textContent=fmtCur(t);
  document.getElementById('cn-tbody').innerHTML=cnItems.map((i,idx)=>`<tr><td>${idx+1}</td><td>${i.product_name}</td><td><input type="number" value="${i.qty}" onchange="updateCNItem(${idx},'qty',this.value)" style="width:60px" /></td><td>${fmtCur(i.price)}</td><td>${fmtCur(i.amount)}</td><td><button class="btn btn-sm btn-danger" onclick="removeCNItem(${idx})">✕</button></td></tr>`).join('');
}
window.updateCNItem=(i,f,v)=>{ cnItems[i][f]=parseFloat(v)||0; recalcCN(); };
window.removeCNItem=(i)=>{ cnItems.splice(i,1); recalcCN(); };
window.saveCN=async function(){
  if(!cnItems.length){toast('Add items','error');return;}
  const total=cnItems.reduce((s,i)=>s+i.amount,0);
  const note={date:document.getElementById('cn-date').value,customer_id:document.getElementById('cn-cust').value||null,total,reason:document.getElementById('cn-reason').value};
  await api.creditNotes.save({note,items:cnItems}); toast('Credit note saved! Stock updated.'); renderCN();
};
window.viewAllCN=async function(){
  const all=await api.creditNotes.getAll();
  document.getElementById('cn-list-area').innerHTML=`<div class="card"><div class="card-header"><span class="card-title">All Credit Notes</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Note No</th><th>Date</th><th>Customer</th><th>Total</th></tr></thead><tbody>${all.map(n=>`<tr><td>${n.note_no}</td><td>${n.date}</td><td>${n.customer_name||'-'}</td><td>${fmtCur(n.total)}</td></tr>`).join('')}</tbody></table></div></div>`;
};
