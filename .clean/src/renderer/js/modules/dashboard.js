// Dashboard Module — Professional Icons
export async function render() {
  const stats = await api.reports.dashboardStats();
  document.getElementById('page-content').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card brown">
        <div class="stat-icon"><i class="bi bi-currency-rupee"></i></div>
        <div class="stat-value">${fmtCur(stats.todaySales?.total)}</div>
        <div class="stat-label">Today's Sales</div>
        <div class="stat-sub">${stats.todaySales?.count || 0} invoice(s)</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon"><i class="bi bi-graph-up-arrow"></i></div>
        <div class="stat-value">${fmtCur(stats.monthSales?.total)}</div>
        <div class="stat-label">Monthly Sales</div>
        <div class="stat-sub">${stats.monthSales?.count || 0} invoice(s)</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon"><i class="bi bi-cart3"></i></div>
        <div class="stat-value">${fmtCur(stats.totalPurchase?.total)}</div>
        <div class="stat-label">Monthly Purchase</div>
        <div class="stat-sub">This month</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-icon"><i class="bi bi-people-fill"></i></div>
        <div class="stat-value">${stats.totalCustomers?.count || 0}</div>
        <div class="stat-label">Customers</div>
      </div>
      <div class="stat-card brown">
        <div class="stat-icon"><i class="bi bi-box-seam"></i></div>
        <div class="stat-value">${stats.totalProducts?.count || 0}</div>
        <div class="stat-label">Products</div>
      </div>
      <div class="stat-card ${stats.lowStock?.count > 0 ? 'red' : 'green'}">
        <div class="stat-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
        <div class="stat-value">${stats.lowStock?.count || 0}</div>
        <div class="stat-label">Low Stock Items</div>
      </div>
    </div>
    ${stats.lowStock?.count > 0 ? `<div class="alert alert-warning mb-4"><i class="bi bi-exclamation-triangle-fill"></i> ${stats.lowStock.count} product(s) are below minimum stock level. <a href="#" onclick="navigateTo('stock')">View Stock →</a></div>` : ''}
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="bi bi-receipt" style="margin-right:6px;color:var(--brown-500)"></i>Recent Sales</span>
          <button class="btn btn-sm btn-secondary" onclick="navigateTo('sales')"><i class="bi bi-arrow-right"></i> View All</button>
        </div>
        <div class="card-body" style="padding:0">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Invoice No</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>${(stats.recentSales||[]).map(s=>`
                <tr>
                  <td><strong>${s.invoice_no}</strong></td>
                  <td>${s.customer_name||'Walk-in'}</td>
                  <td>${s.date}</td>
                  <td><strong>${fmtCur(s.total)}</strong></td>
                  <td><span class="badge badge-success">${s.status}</span></td>
                </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted" style="padding:20px">No sales yet</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="bi bi-lightning-charge-fill" style="margin-right:6px;color:var(--brown-500)"></i>Quick Actions</span></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-primary w-full" onclick="navigateTo('sales')"><i class="bi bi-receipt"></i> New Invoice</button>
          <button class="btn btn-secondary w-full" onclick="navigateTo('purchase')"><i class="bi bi-cart3"></i> New Purchase</button>
          <button class="btn btn-secondary w-full" onclick="navigateTo('customers')"><i class="bi bi-person-plus-fill"></i> Add Customer</button>
          <button class="btn btn-secondary w-full" onclick="navigateTo('products')"><i class="bi bi-plus-circle-fill"></i> Add Product</button>
          <button class="btn btn-secondary w-full" onclick="navigateTo('quotation')"><i class="bi bi-file-earmark-text"></i> New Quotation</button>
          <button class="btn btn-secondary w-full" onclick="navigateTo('reports')"><i class="bi bi-graph-up-arrow"></i> View Reports</button>
        </div>
      </div>
    </div>`;
}
