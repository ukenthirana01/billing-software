// Stock Management Module
export async function render() {
  const products = await api.reports.stockReport();
  const lowStock = products.filter(p=>p.stock<=p.min_stock&&p.min_stock>0);
  document.getElementById('page-content').innerHTML = `
    ${lowStock.length ? `<div class="alert alert-warning mb-4">⚠ <strong>${lowStock.length} product(s)</strong> are at or below minimum stock level!</div>` : ''}
    <div class="page-header">
      <h2>Stock Management</h2>
      <div class="page-actions">
        <div class="search-bar"><input id="stock-search" placeholder="Search products..." /></div>
        <button class="btn btn-secondary" onclick="exportStockExcel()">📥 Export Excel</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table" id="stock-table">
          <thead><tr><th>#</th><th>Product</th><th>Code</th><th>Category</th><th>HSN</th><th>GST%</th><th>Unit</th><th>Stock</th><th>Min Stock</th><th>Purchase ₹</th><th>Selling ₹</th><th>Stock Value</th><th>Status</th></tr></thead>
          <tbody>${products.map((p,i)=>`
            <tr>
              <td>${i+1}</td>
              <td><strong>${p.name}</strong></td>
              <td>${p.code||'-'}</td>
              <td>${p.category_name||'-'}</td>
              <td>${p.hsn_code||'-'}</td>
              <td>${p.gst_percent}%</td>
              <td>${p.unit}</td>
              <td><strong>${p.stock}</strong></td>
              <td>${p.min_stock}</td>
              <td>${fmtCur(p.purchase_price)}</td>
              <td>${fmtCur(p.selling_price)}</td>
              <td>${fmtCur(p.stock * p.purchase_price)}</td>
              <td><span class="badge ${p.stock<=p.min_stock&&p.min_stock>0?'badge-danger':'badge-success'}">${p.stock<=p.min_stock&&p.min_stock>0?'Low Stock':'OK'}</span></td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--brown-50);font-weight:700">
              <td colspan="11">Total Stock Value</td>
              <td>${fmtCur(products.reduce((s,p)=>s+(p.stock*p.purchase_price),0))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;
  document.getElementById('stock-search').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#stock-table tbody tr').forEach(tr=>{
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

window.exportStockExcel = function() {
  const table = document.getElementById('stock-table');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Report');
  XLSX.writeFile(wb, `Stock_Report_${today()}.xlsx`);
  toast('Stock report exported!');
};
