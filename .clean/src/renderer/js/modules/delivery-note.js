// Delivery Note Module
let delProds = [], delCusts = [], delItems = [];
export async function render() {
  [delProds, delCusts] = await Promise.all([api.products.getAll(), api.customers.getAll()]);
  renderDel();
}
function renderDel() {
  delItems = [];
  const custOpts = delCusts.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h2>Delivery Note</h2><button class="btn btn-sm btn-secondary" onclick="viewAllDel()">View All</button></div>
    <div class="card mb-4">
      <div class="card-body">
        <div class="form-grid form-grid-3">
          <div class="form-group"><label class="form-label">Date</label><input class="form-control" id="del-date" type="date" value="${today()}" /></div>
          <div class="form-group"><label class="form-label">Customer</label><select class="form-control" id="del-cust"><option value="">Select</option>${custOpts}</select></div>
          <div class="form-group"><label class="form-label">Notes</label><input class="form-control" id="del-notes" placeholder="Delivery notes..." /></div>
        </div>
        <div class="flex gap-2 mt-3">
          <input class="form-control" id="del-search" placeholder="Search product..." style="flex:1" />
          <div id="del-sugg" style="position:relative"></div>
        </div>
        <div class="table-wrap mt-3"><table class="billing-table">
          <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit</th><th></th></tr></thead>
          <tbody id="del-tbody"><tr><td colspan="5" class="text-center text-muted" style="padding:16px">No items</td></tr></tbody>
        </table></div>
        <button class="btn btn-success mt-3" onclick="saveDelivery()">💾 Save Delivery Note</button>
      </div>
    </div>
    <div id="del-list-area"></div>`;

  document.getElementById('del-search').addEventListener('input', function() {
    const q=this.value.toLowerCase();
    if(!q){document.getElementById('del-sugg').innerHTML='';return;}
    const m=delProds.filter(p=>p.name.toLowerCase().includes(q)).slice(0,5);
    document.getElementById('del-sugg').innerHTML=m.length?`<div style="border:1px solid var(--gray-200);background:white;position:absolute;z-index:100;box-shadow:var(--shadow-md);min-width:280px">${m.map(p=>`<div onclick="addDelItem(${p.id})" style="padding:8px 12px;cursor:pointer" onmouseover="this.style.background='var(--brown-50)'" onmouseout="this.style.background=''"><strong>${p.name}</strong> ${p.unit}</div>`).join('')}</div>`:'';
  });
}
window.addDelItem=function(pid){const p=delProds.find(x=>x.id===pid);const ex=delItems.find(i=>i.product_id===pid);if(ex)ex.qty++;else delItems.push({product_id:p.id,product_name:p.name,qty:1,unit:p.unit});document.getElementById('del-search').value='';document.getElementById('del-sugg').innerHTML='';renderDelTable();};
function renderDelTable(){document.getElementById('del-tbody').innerHTML=delItems.map((i,idx)=>`<tr><td>${idx+1}</td><td>${i.product_name}</td><td><input type="number" value="${i.qty}" onchange="updateDelItem(${idx},'qty',this.value)" style="width:60px" /></td><td>${i.unit}</td><td><button class="btn btn-sm btn-danger" onclick="removeDelItem(${idx})">✕</button></td></tr>`).join('');}
window.updateDelItem=(i,f,v)=>{delItems[i][f]=parseFloat(v)||0;renderDelTable();};
window.removeDelItem=(i)=>{delItems.splice(i,1);renderDelTable();};
window.saveDelivery=async function(){if(!delItems.length){toast('Add items','error');return;}const note={date:document.getElementById('del-date').value,customer_id:document.getElementById('del-cust').value||null,notes:document.getElementById('del-notes').value};await api.deliveryNotes.save({note,items:delItems});toast('Delivery note saved!');renderDel();};
window.viewAllDel=async function(){const all=await api.deliveryNotes.getAll();document.getElementById('del-list-area').innerHTML=`<div class="card"><div class="card-header"><span class="card-title">All Delivery Notes</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Note No</th><th>Date</th><th>Customer</th><th>Status</th></tr></thead><tbody>${all.map(n=>`<tr><td>${n.note_no}</td><td>${n.date}</td><td>${n.customer_name||'-'}</td><td><span class="badge badge-warning">${n.status}</span></td></tr>`).join('')}</tbody></table></div></div>`;};
