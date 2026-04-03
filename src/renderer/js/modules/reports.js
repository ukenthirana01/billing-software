// Reports Module — with PDF Export & Premium UI (10 Report Tabs)
export async function render() {
  const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const to = today();
  document.getElementById('page-content').innerHTML = `
    <div class="tabs" style="flex-wrap:wrap">
      <div class="tab-item active" onclick="switchReportTab('sales',this)"><i class="bi bi-graph-up-arrow"></i> Sales</div>
      <div class="tab-item" onclick="switchReportTab('purchase',this)"><i class="bi bi-cart3"></i> Purchase</div>
      <div class="tab-item" onclick="switchReportTab('pnl',this)"><i class="bi bi-piggy-bank"></i> P&L</div>
      <div class="tab-item" onclick="switchReportTab('gst',this)"><i class="bi bi-bank"></i> GST Summary</div>
      <div class="tab-item" onclick="switchReportTab('gstr1',this)"><i class="bi bi-file-earmark-ruled"></i> GSTR-1</div>
      <div class="tab-item" onclick="switchReportTab('itemwise',this)"><i class="bi bi-box-seam"></i> Item-wise</div>
      <div class="tab-item" onclick="switchReportTab('expense',this)"><i class="bi bi-wallet2"></i> Expenses</div>
      <div class="tab-item" onclick="switchReportTab('cash',this)"><i class="bi bi-cash-stack"></i> Cash Summary</div>
      <div class="tab-item" onclick="switchReportTab('customer',this)"><i class="bi bi-people-fill"></i> Customer</div>
      <div class="tab-item" onclick="switchReportTab('supplier',this)"><i class="bi bi-building"></i> Supplier</div>
      <div class="tab-item" onclick="switchReportTab('outstanding',this)"><i class="bi bi-exclamation-diamond"></i> Outstanding</div>
    </div>
    <div class="card mb-4">
      <div class="card-body">
        <div class="flex gap-3 items-center" style="flex-wrap:wrap">
          <div class="form-group"><label class="form-label">From Date</label><input class="form-control" id="r-from" type="date" value="${from}" /></div>
          <div class="form-group"><label class="form-label">To Date</label><input class="form-control" id="r-to" type="date" value="${to}" /></div>
          <div class="form-group" id="r-cust-wrap" style="display:none"><label class="form-label">Customer / Supplier</label><select class="form-control" id="r-entity" style="min-width:200px"></select></div>
          <div class="form-group" style="align-self:flex-end">
            <div class="report-actions">
              <button class="btn btn-primary" onclick="loadReport()"><i class="bi bi-search"></i> Load Report</button>
              <button class="btn btn-secondary" onclick="exportReport()"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button>
              <button class="btn btn-info" onclick="exportReportPDF()"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="report-content"></div>`;
  window._reportTab = 'sales';
  window.loadReport();
}

window.switchReportTab = function(tab, el) {
  document.querySelectorAll('.tab-item').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  window._reportTab = tab;
  const custWrap = document.getElementById('r-cust-wrap');
  if (tab==='customer') {
    custWrap.style.display='block';
    api.customers.getAll().then(list=>{
      document.getElementById('r-entity').innerHTML = list.map(c=>`<option value="${c.id}">${window.escapeHtml(c.name)}</option>`).join('');
    });
  } else if (tab==='supplier') {
    custWrap.style.display='block';
    api.suppliers.getAll().then(list=>{
      document.getElementById('r-entity').innerHTML = list.map(s=>`<option value="${s.id}">${window.escapeHtml(s.name)}</option>`).join('');
    });
  } else { custWrap.style.display='none'; }
  window.loadReport();
};

window.loadReport = async function() {
  const from = document.getElementById('r-from').value;
  const to = document.getElementById('r-to').value;
  const tab = window._reportTab||'sales';
  const area = document.getElementById('report-content');

  if (tab==='sales') {
    const data = await api.reports.salesSummary({from,to});
    const total = data.reduce((s,r)=>s+r.total,0);
    const tax = data.reduce((s,r)=>s+r.tax,0);
    const count = data.reduce((s,r)=>s+r.count,0);
    area.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        <div class="stat-card brown"><div class="stat-icon"><i class="bi bi-receipt"></i></div><div class="stat-value">${count}</div><div class="stat-label">Total Invoices</div></div>
        <div class="stat-card green"><div class="stat-icon"><i class="bi bi-currency-rupee"></i></div><div class="stat-value">${fmtCur(total)}</div><div class="stat-label">Total Sales</div></div>
        <div class="stat-card blue"><div class="stat-icon"><i class="bi bi-bank"></i></div><div class="stat-value">${fmtCur(tax)}</div><div class="stat-label">Total GST Collected</div></div>
      </div>
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Invoices</th><th class="text-right">Sales Amount</th><th class="text-right">GST</th></tr></thead>
        <tbody>${data.map(r=>`<tr><td>${r.date}</td><td><span class="badge badge-info">${r.count}</span></td><td class="text-right font-semi">${fmtCur(r.total)}</td><td class="text-right">${fmtCur(r.tax)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-center text-muted" style="padding:32px">No data found for selected period</td></tr>'}
        </tbody>
        <tfoot><tr style="background:var(--brown-50);font-weight:700"><td colspan="2">Total</td><td class="text-right">${fmtCur(total)}</td><td class="text-right">${fmtCur(tax)}</td></tr></tfoot>
      </table></div></div>`;

  } else if (tab==='purchase') {
    const data = await api.reports.purchaseSummary({from,to});
    const total = data.reduce((s,r)=>s+r.total,0);
    area.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">
        <div class="stat-card brown"><div class="stat-icon"><i class="bi bi-cart3"></i></div><div class="stat-value">${data.reduce((s,r)=>s+r.count,0)}</div><div class="stat-label">Total Bills</div></div>
        <div class="stat-card blue"><div class="stat-icon"><i class="bi bi-currency-rupee"></i></div><div class="stat-value">${fmtCur(total)}</div><div class="stat-label">Total Purchase</div></div>
      </div>
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Bills</th><th class="text-right">Purchase Amount</th></tr></thead>
        <tbody>${data.map(r=>`<tr><td>${r.date}</td><td><span class="badge badge-brown">${r.count}</span></td><td class="text-right font-semi">${fmtCur(r.total)}</td></tr>`).join('')||'<tr><td colspan="3" class="text-center text-muted" style="padding:32px">No data</td></tr>'}
        </tbody>
        <tfoot><tr style="background:var(--brown-50);font-weight:700"><td colspan="2">Total</td><td class="text-right">${fmtCur(total)}</td></tr></tfoot>
      </table></div></div>`;

  } else if (tab==='pnl') {
    const data = await api.reports.profitLoss({from,to});
    const isProfit = data.netProfit >= 0;
    area.innerHTML = `
      <div class="card mb-4">
        <div class="card-header"><span class="card-title"><i class="bi bi-piggy-bank" style="margin-right:6px;color:var(--primary-500)"></i>Profit & Loss Statement</span></div>
        <div class="card-body">
          <div style="max-width:500px;margin:auto">
            <div class="totals-row"><span><i class="bi bi-graph-up-arrow" style="color:var(--success);margin-right:8px"></i>Sales Revenue</span><span class="font-bold">${fmtCur(data.salesRevenue)}</span></div>
            <div class="totals-row"><span><i class="bi bi-cart-dash" style="color:var(--info);margin-right:8px"></i>Less: Purchase Cost</span><span class="text-danger font-semi">- ${fmtCur(data.purchaseCost)}</span></div>
            <div class="totals-row" style="border-top:2px solid var(--primary-200);font-weight:700"><span>Gross Profit</span><span>${fmtCur(data.salesRevenue - data.purchaseCost)}</span></div>
            <div class="totals-row"><span><i class="bi bi-wallet2" style="color:var(--warning);margin-right:8px"></i>Less: Expenses</span><span class="text-danger font-semi">- ${fmtCur(data.expenses)}</span></div>
            <div class="totals-row"><span><i class="bi bi-cash" style="color:var(--success);margin-right:8px"></i>Add: Other Income</span><span class="text-success font-semi">+ ${fmtCur(data.otherIncome)}</span></div>
            <div class="totals-row grand-total" style="border-top:3px solid ${isProfit?'var(--success)':'var(--danger)'}">
              <span>Net ${isProfit?'Profit':'Loss'}</span>
              <span style="color:${isProfit?'var(--success)':'var(--danger)'};font-size:24px">${isProfit?'+':''}${fmtCur(data.netProfit)}</span>
            </div>
          </div>
        </div>
      </div>`;

  } else if (tab==='gst') {
    const {sales,purchase} = await api.reports.gstSummary({from,to});
    const outGst = (sales?.cgst||0)+(sales?.sgst||0);
    const inGst = (purchase?.cgst||0)+(purchase?.sgst||0);
    const netGst = outGst - inGst;
    area.innerHTML = `
      <div class="form-grid form-grid-2 mb-4">
        <div class="card"><div class="card-header"><span class="card-title"><i class="bi bi-arrow-up-circle" style="margin-right:6px;color:var(--success)"></i> GST Output (Sales)</span></div>
          <div class="card-body gst-box">
            <div class="gst-item"><div class="gst-item-label">CGST</div><div class="gst-item-value">${fmtCur(sales?.cgst)}</div></div>
            <div class="gst-item"><div class="gst-item-label">SGST</div><div class="gst-item-value">${fmtCur(sales?.sgst)}</div></div>
            <div class="gst-item" style="background:var(--brown-100)"><div class="gst-item-label">Total Output</div><div class="gst-item-value">${fmtCur(outGst)}</div></div>
          </div>
        </div>
        <div class="card"><div class="card-header"><span class="card-title"><i class="bi bi-arrow-down-circle" style="margin-right:6px;color:var(--info)"></i> GST Input (Purchase)</span></div>
          <div class="card-body gst-box">
            <div class="gst-item"><div class="gst-item-label">CGST</div><div class="gst-item-value">${fmtCur(purchase?.cgst)}</div></div>
            <div class="gst-item"><div class="gst-item-label">SGST</div><div class="gst-item-value">${fmtCur(purchase?.sgst)}</div></div>
            <div class="gst-item" style="background:var(--brown-100)"><div class="gst-item-label">Total Input</div><div class="gst-item-value">${fmtCur(inGst)}</div></div>
          </div>
        </div>
      </div>
      <div class="card"><div class="card-body">
        <div class="totals-row grand-total" style="border:none;padding:0">
          <span>Net GST Payable (Output − Input)</span>
          <span style="color:${netGst>=0?'var(--danger)':'var(--success)'}">${fmtCur(netGst)}</span>
        </div>
      </div></div>`;

  } else if (tab==='gstr1') {
    const data = await api.reports.gstr1Summary({from,to});
    const totTaxable = data.reduce((s,r)=>s+(r.taxable_value||0),0);
    const totCgst = data.reduce((s,r)=>s+(r.cgst||0),0);
    const totSgst = data.reduce((s,r)=>s+(r.sgst||0),0);
    const totTotal = data.reduce((s,r)=>s+(r.total||0),0);
    area.innerHTML = `
      <div class="card mb-3">
        <div class="card-header"><span class="card-title"><i class="bi bi-file-earmark-ruled" style="margin-right:6px;color:var(--primary-500)"></i>GSTR-1 Summary (Rate-wise Breakup)</span>
          <span class="badge badge-info">For GST Portal Upload</span>
        </div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>GST Rate</th><th>Invoices</th><th class="text-right">Taxable Value</th><th class="text-right">CGST</th><th class="text-right">SGST</th><th class="text-right">Total</th></tr></thead>
          <tbody>${data.map(r=>`<tr>
            <td><span class="badge badge-primary">${r.gst_percent||0}%</span></td>
            <td>${r.invoice_count}</td>
            <td class="text-right">${fmtCur(r.taxable_value)}</td>
            <td class="text-right">${fmtCur(r.cgst)}</td>
            <td class="text-right">${fmtCur(r.sgst)}</td>
            <td class="text-right font-bold">${fmtCur(r.total)}</td>
          </tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted" style="padding:32px">No data</td></tr>'}
          </tbody>
          <tfoot><tr style="background:var(--brown-50);font-weight:700"><td colspan="2">Total</td><td class="text-right">${fmtCur(totTaxable)}</td><td class="text-right">${fmtCur(totCgst)}</td><td class="text-right">${fmtCur(totSgst)}</td><td class="text-right">${fmtCur(totTotal)}</td></tr></tfoot>
        </table></div>
      </div>`;

  } else if (tab==='itemwise') {
    const data = await api.reports.itemWiseSales({from,to});
    const totQty = data.reduce((s,r)=>s+(r.total_qty||0),0);
    const totAmt = data.reduce((s,r)=>s+(r.total_amount||0),0);
    area.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="bi bi-box-seam" style="margin-right:6px;color:var(--primary-500)"></i>Item-wise Sales</span>
          <span class="badge badge-info">${data.length} products sold</span></div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>#</th><th>Product</th><th>HSN</th><th class="text-right">Qty Sold</th><th>Unit</th><th class="text-right">Revenue</th><th>Times Sold</th></tr></thead>
          <tbody>${data.map((r,i)=>`<tr>
            <td>${i+1}</td>
            <td><strong>${window.escapeHtml(r.product_name)}</strong></td>
            <td>${r.hsn_code||'-'}</td>
            <td class="text-right font-semi">${r.total_qty}</td>
            <td>${r.unit||'Nos'}</td>
            <td class="text-right font-bold">${fmtCur(r.total_amount)}</td>
            <td><span class="badge badge-gray">${r.times_sold}x</span></td>
          </tr>`).join('')||'<tr><td colspan="7" class="text-center text-muted" style="padding:32px">No data</td></tr>'}
          </tbody>
          <tfoot><tr style="background:var(--brown-50);font-weight:700"><td colspan="3">Total</td><td class="text-right">${totQty}</td><td></td><td class="text-right">${fmtCur(totAmt)}</td><td></td></tr></tfoot>
        </table></div>
      </div>`;

  } else if (tab==='expense') {
    const data = await api.reports.expenseSummary({from,to});
    const total = data.reduce((s,r)=>s+(r.amount||0),0);
    area.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">
        <div class="stat-card red"><div class="stat-icon"><i class="bi bi-wallet2"></i></div><div class="stat-value">${fmtCur(total)}</div><div class="stat-label">Total Expenses</div></div>
        <div class="stat-card brown"><div class="stat-icon"><i class="bi bi-receipt"></i></div><div class="stat-value">${data.length}</div><div class="stat-label">Entries</div></div>
      </div>
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Description</th><th>Party</th><th class="text-right">Amount</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td>${r.date}</td>
          <td>${window.escapeHtml(r.description||'-')}</td>
          <td>${window.escapeHtml(r.party_name||'-')}</td>
          <td class="text-right font-bold text-danger">${fmtCur(r.amount)}</td>
        </tr>`).join('')||'<tr><td colspan="4" class="text-center text-muted" style="padding:32px">No expenses found</td></tr>'}
        </tbody>
        <tfoot><tr style="background:var(--danger-bg);font-weight:700;color:var(--danger)"><td colspan="3">Total Expenses</td><td class="text-right">${fmtCur(total)}</td></tr></tfoot>
      </table></div></div>`;

  } else if (tab==='cash') {
    const data = await api.reports.cashSummary({from,to});
    const totCash = data.salesCash.reduce((s,r)=>s+(r.amount||0),0);
    const totExp = data.expenses.reduce((s,r)=>s+(r.amount||0),0);
    const totIn = data.fundsIn.reduce((s,r)=>s+(r.amount||0),0);
    area.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
        <div class="stat-card green"><div class="stat-icon"><i class="bi bi-cash"></i></div><div class="stat-value">${fmtCur(totCash)}</div><div class="stat-label">Cash Sales</div></div>
        <div class="stat-card blue"><div class="stat-icon"><i class="bi bi-plus-circle"></i></div><div class="stat-value">${fmtCur(totIn)}</div><div class="stat-label">Cash Received</div></div>
        <div class="stat-card red"><div class="stat-icon"><i class="bi bi-dash-circle"></i></div><div class="stat-value">${fmtCur(totExp)}</div><div class="stat-label">Cash Paid Out</div></div>
      </div>
      <div class="card"><div class="card-body">
        <div class="totals-row grand-total" style="border:none;padding:0">
          <span>Net Cash Position</span>
          <span style="color:${(totCash+totIn-totExp)>=0?'var(--success)':'var(--danger)'}; font-size:24px">${fmtCur(totCash+totIn-totExp)}</span>
        </div>
      </div></div>`;

  } else if (tab==='outstanding') {
    const data = await api.reports.outstanding();
    const total = data.reduce((s,r)=>s+(r.total||0),0);
    area.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px">
        <div class="stat-card red"><div class="stat-icon"><i class="bi bi-exclamation-diamond"></i></div><div class="stat-value">${fmtCur(total)}</div><div class="stat-label">Total Outstanding</div></div>
        <div class="stat-card orange"><div class="stat-icon"><i class="bi bi-receipt"></i></div><div class="stat-value">${data.length}</div><div class="stat-label">Unpaid Invoices</div></div>
      </div>
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Phone</th><th class="text-right">Amount</th><th>Status</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td><strong>${window.escapeHtml(r.invoice_no)}</strong></td>
          <td>${r.date}</td>
          <td>${window.escapeHtml(r.customer_name||'Walk-in')}</td>
          <td>${r.customer_phone||'-'}</td>
          <td class="text-right font-bold text-danger">${fmtCur(r.total)}</td>
          <td><span class="badge ${r.status==='Partial'?'badge-warning':'badge-danger'}">${r.status}</span></td>
        </tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted" style="padding:32px">No outstanding invoices 🎉</td></tr>'}
        </tbody>
      </table></div></div>`;

  } else if (tab==='customer') {
    const entityId = document.getElementById('r-entity').value;
    if (!entityId) { area.innerHTML='<div class="empty-state"><div class="icon"><i class="bi bi-people" style="font-size:48px;color:var(--gray-300)"></i></div><p>Select a customer to view ledger</p></div>'; return; }
    const data = await api.reports.customerLedger(parseInt(entityId));
    const total = data.reduce((s,r)=>s+r.total,0);
    area.innerHTML = `<div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Invoice No</th><th>Date</th><th class="text-right">Total</th><th class="text-right">GST</th><th>Mode</th></tr></thead>
      <tbody>${data.map(r=>`<tr><td><strong>${window.escapeHtml(r.invoice_no)}</strong></td><td>${window.escapeHtml(r.date)}</td><td class="text-right">${fmtCur(r.total)}</td><td class="text-right">${fmtCur(r.cgst+r.sgst)}</td><td><span class="badge badge-gray">${window.escapeHtml(r.payment_mode)}</span></td></tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted" style="padding:32px">No transactions</td></tr>'}
      </tbody><tfoot><tr style="font-weight:700;background:var(--brown-50)"><td colspan="2">Total</td><td class="text-right">${fmtCur(total)}</td><td colspan="2"></td></tr></tfoot>
    </table></div></div>`;

  } else if (tab==='supplier') {
    const entityId = document.getElementById('r-entity').value;
    if (!entityId) { area.innerHTML='<div class="empty-state"><div class="icon"><i class="bi bi-building" style="font-size:48px;color:var(--gray-300)"></i></div><p>Select a supplier</p></div>'; return; }
    const data = await api.reports.supplierLedger(parseInt(entityId));
    const total = data.reduce((s,r)=>s+r.total,0);
    area.innerHTML = `<div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Bill No</th><th>Date</th><th class="text-right">Total</th><th class="text-right">GST</th></tr></thead>
      <tbody>${data.map(r=>`<tr><td><strong>${window.escapeHtml(r.bill_no)}</strong></td><td>${window.escapeHtml(r.date)}</td><td class="text-right">${fmtCur(r.total)}</td><td class="text-right">${fmtCur(r.cgst+r.sgst)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-center text-muted" style="padding:32px">No transactions</td></tr>'}
      </tbody><tfoot><tr style="font-weight:700;background:var(--brown-50)"><td colspan="2">Total</td><td class="text-right">${fmtCur(total)}</td><td></td></tr></tfoot>
    </table></div></div>`;
  }
};

window.exportReport = function() {
  const table = document.querySelector('#report-content table');
  if (!table) { toast('No data to export','error'); return; }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.table_to_sheet(table);
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `MS_Billing_Report_${today()}.xlsx`);
  toast('Exported to Excel!');
};

// ─── PDF EXPORT FOR REPORTS ─────────────────────────────
window.exportReportPDF = async function() {
  const tab = window._reportTab || 'sales';
  const from = document.getElementById('r-from').value;
  const to = document.getElementById('r-to').value;
  const co = await api.company.get();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const W = doc.internal.pageSize.width;

  // ── PDF Header ──
  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, W, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text(co?.name || 'Relyce Book', 14, 14);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  if (co?.address) doc.text(co.address, 14, 20, { maxWidth: 120 });
  doc.text(`GST: ${co?.gst_no||'-'}`, 14, 27);

  const reportTitles = { sales:'SALES REPORT', purchase:'PURCHASE REPORT', pnl:'PROFIT & LOSS', gst:'GST SUMMARY', gstr1:'GSTR-1 SUMMARY', itemwise:'ITEM-WISE SALES', expense:'EXPENSE REPORT', cash:'CASH SUMMARY', customer:'CUSTOMER LEDGER', supplier:'SUPPLIER LEDGER', outstanding:'OUTSTANDING REPORT' };
  doc.setFontSize(15); doc.setFont('helvetica','bold');
  doc.text(reportTitles[tab]||'REPORT', W-14, 14, {align:'right'});
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text(`Period: ${from} to ${to}`, W-14, 22, {align:'right'});
  doc.text(`Generated: ${today()}`, W-14, 29, {align:'right'});
  doc.setTextColor(0, 0, 0);

  let startY = 46;

  if (tab === 'sales') {
    const data = await api.reports.salesSummary({from, to});
    const total = data.reduce((s,r)=>s+r.total,0);
    const tax = data.reduce((s,r)=>s+r.tax,0);
    const count = data.reduce((s,r)=>s+r.count,0);
    doc.autoTable({
      startY, head: [['Date','Invoices','Sales Amount','GST Collected']],
      body: data.map(r=>[r.date, r.count, fmtCur(r.total), fmtCur(r.tax)]),
      foot: [['Total', count, fmtCur(total), fmtCur(tax)]],
      theme: 'striped',
      headStyles: { fillColor:[30,27,75], textColor:255, fontSize:9, fontStyle:'bold' },
      footStyles: { fillColor:[224,231,255], textColor:[30,27,75], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 2:{halign:'right'}, 3:{halign:'right'} }
    });
  } else if (tab === 'pnl') {
    const data = await api.reports.profitLoss({from,to});
    doc.autoTable({
      startY, head: [['Description','Amount']],
      body: [
        ['Sales Revenue', fmtCur(data.salesRevenue)],
        ['Less: Purchase Cost', `- ${fmtCur(data.purchaseCost)}`],
        ['Gross Profit', fmtCur(data.salesRevenue - data.purchaseCost)],
        ['Less: Expenses', `- ${fmtCur(data.expenses)}`],
        ['Add: Other Income', `+ ${fmtCur(data.otherIncome)}`],
        ['NET PROFIT/LOSS', fmtCur(data.netProfit)]
      ],
      theme: 'striped',
      headStyles: { fillColor:[30,27,75], textColor:255 },
      bodyStyles: { fontSize:10 },
      columnStyles: { 1:{halign:'right',fontStyle:'bold'} }
    });
  } else if (tab === 'gstr1') {
    const data = await api.reports.gstr1Summary({from,to});
    doc.autoTable({
      startY, head: [['GST Rate','Invoices','Taxable Value','CGST','SGST','Total']],
      body: data.map(r=>[`${r.gst_percent||0}%`, r.invoice_count, fmtCur(r.taxable_value), fmtCur(r.cgst), fmtCur(r.sgst), fmtCur(r.total)]),
      theme: 'striped',
      headStyles: { fillColor:[30,27,75], textColor:255, fontSize:9 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'} }
    });
  } else if (tab === 'itemwise') {
    const data = await api.reports.itemWiseSales({from,to});
    doc.autoTable({
      startY, head: [['Product','HSN','Qty','Unit','Revenue','Times']],
      body: data.map(r=>[r.product_name, r.hsn_code||'-', r.total_qty, r.unit||'Nos', fmtCur(r.total_amount), r.times_sold]),
      theme: 'striped',
      headStyles: { fillColor:[30,27,75], textColor:255, fontSize:9 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 4:{halign:'right'} }
    });
  } else {
    // Generic: render from table
    const table = document.querySelector('#report-content table');
    if (table) doc.autoTable({ html: table, startY, theme: 'striped', headStyles: { fillColor:[30,27,75] }, bodyStyles: { fontSize:9 } });
  }

  const pgH = doc.internal.pageSize.height;
  doc.setDrawColor(200,200,200);
  doc.line(14, pgH-16, W-14, pgH-16);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('Relyce Book — Report', 14, pgH-9);
  doc.text(`Page 1`, W-14, pgH-9, {align:'right'});

  const reportTitlesFile = { sales:'Sales', purchase:'Purchase', pnl:'ProfitLoss', gst:'GST_Summary', gstr1:'GSTR1', itemwise:'ItemWise', expense:'Expenses', cash:'Cash_Summary', customer:'Customer_Ledger', supplier:'Supplier_Ledger', outstanding:'Outstanding' };
  doc.save(`MS_${reportTitlesFile[tab]}_Report_${from}_to_${to}.pdf`);
  toast('Report PDF downloaded!');
};
