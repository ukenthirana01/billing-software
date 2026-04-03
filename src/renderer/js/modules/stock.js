// Stock Management Module with Adjustment Log
export async function render() {
  const products = await api.reports.stockReport();
  const lowStock = products.filter(p=>p.stock<=p.min_stock&&p.min_stock>0);
  document.getElementById('page-content').innerHTML = `
    ${lowStock.length ? `<div class="alert alert-warning mb-4"><i class="bi bi-exclamation-triangle-fill"></i> <strong>${lowStock.length} product(s)</strong> below minimum stock!</div>` : ''}
    <div class="tabs">
      <div class="tab-item active" onclick="switchStockTab('stock',this)"><i class="bi bi-box-seam"></i> Stock Overview</div>
      <div class="tab-item" onclick="switchStockTab('adjustments',this)"><i class="bi bi-arrow-left-right"></i> Adjustment Log</div>
    </div>
    <div id="stock-tab-content"></div>`;
  window._stockProducts = products;
  window.switchStockTab('stock', document.querySelector('.tab-item.active'));
}

window.switchStockTab = function(tab, el) {
  document.querySelectorAll('.tab-item').forEach(t=>t.classList.remove('active'));
  if (el) el.classList.add('active');
  if (tab === 'stock') renderStockTable();
  else renderAdjustmentLog();
};

function renderStockTable() {
  const products = window._stockProducts || [];
  const totalValue = products.reduce((s,p)=>s+(p.stock*p.purchase_price),0);
  document.getElementById('stock-tab-content').innerHTML = `
    <div class="page-header" style="margin-top:12px">
      <div class="page-actions">
        <div class="search-bar"><input id="stock-search" placeholder="Search products..." /></div>
        <button class="btn btn-secondary" onclick="exportStockExcel()"><i class="bi bi-file-earmark-excel"></i> Export</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table" id="stock-table">
          <thead><tr><th>#</th><th>Product</th><th>Code</th><th>Category</th><th>Unit</th><th>Stock</th><th>Min</th><th>Purchase ₹</th><th>Selling ₹</th><th>Value</th><th>Status</th><th>Adjust</th></tr></thead>
          <tbody>${products.map((p,i)=>`
            <tr>
              <td>${i+1}</td>
              <td><strong>${p.name}</strong></td>
              <td>${p.code||'-'}</td>
              <td>${p.category_name||'-'}</td>
              <td>${p.unit}</td>
              <td><strong>${p.stock}</strong></td>
              <td>${p.min_stock}</td>
              <td>${fmtCur(p.purchase_price)}</td>
              <td>${fmtCur(p.selling_price)}</td>
              <td>${fmtCur(p.stock * p.purchase_price)}</td>
              <td><span class="badge ${p.stock<=p.min_stock&&p.min_stock>0?'badge-danger':'badge-success'}">${p.stock<=p.min_stock&&p.min_stock>0?'Low':'OK'}</span></td>
              <td><button class="btn btn-sm btn-secondary" onclick="adjustStock(${p.id},\`${p.name.replace(/`/g,'')}\`,${p.stock})"><i class="bi bi-arrow-left-right"></i></button></td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr style="background:var(--brown-50);font-weight:700"><td colspan="9">Total Stock Value</td><td>${fmtCur(totalValue)}</td><td colspan="2"></td></tr></tfoot>
        </table>
      </div>
    </div>`;
  document.getElementById('stock-search')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#stock-table tbody tr').forEach(tr=>{
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

async function renderAdjustmentLog() {
  const data = await api.stockAdjustments.getAll();
  document.getElementById('stock-tab-content').innerHTML = `
    <div class="card" style="margin-top:12px">
      <div class="card-header"><span class="card-title"><i class="bi bi-clock-history" style="margin-right:6px"></i>Stock Adjustment History</span></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date/Time</th><th>Product</th><th>Previous</th><th>New</th><th>Change</th><th>Reason</th></tr></thead>
        <tbody>${data.map(a=>`<tr>
          <td>${a.created_at}</td>
          <td><strong>${window.escapeHtml(a.product_name)}</strong></td>
          <td>${a.previous_stock}</td>
          <td>${a.new_stock}</td>
          <td><span class="badge ${a.adjustment>=0?'badge-success':'badge-danger'}">${a.adjustment>=0?'+':''}${a.adjustment}</span></td>
          <td>${window.escapeHtml(a.reason||'-')}</td>
        </tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted" style="padding:32px">No adjustments yet</td></tr>'}
        </tbody>
      </table></div>
    </div>`;
}

window.adjustStock = function(productId, productName, currentStock) {
  openModal('Adjust Stock', `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700">${productName}</div>
      <div style="font-size:13px;color:var(--gray-500)">Current Stock: <strong>${currentStock}</strong></div>
    </div>
    <div class="form-grid form-grid-2">
      <div class="form-group"><label class="form-label">New Stock Quantity</label><input class="form-control" id="adj-qty" type="number" value="${currentStock}" min="0" /></div>
      <div class="form-group"><label class="form-label">Reason</label><input class="form-control" id="adj-reason" placeholder="e.g. Physical count, Damaged" /></div>
    </div>
  `, `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveStockAdj(${productId},\`${productName.replace(/`/g,'')}\`,${currentStock})">Save</button>`);
};

window.saveStockAdj = async function(productId, productName, previousStock) {
  const newStock = parseFloat(document.getElementById('adj-qty').value) || 0;
  const reason = document.getElementById('adj-reason').value;
  await api.stockAdjustments.add({
    product_id: productId, product_name: productName,
    previous_stock: previousStock, new_stock: newStock,
    adjustment: newStock - previousStock, reason
  });
  toast(`Stock adjusted: ${previousStock} → ${newStock}`);
  closeModal();
  window._stockProducts = await api.reports.stockReport();
  renderStockTable();
};

window.exportStockExcel = function() {
  const table = document.getElementById('stock-table');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
  XLSX.writeFile(wb, `Stock_Report_${today()}.xlsx`);
  toast('Stock report exported!');
};
