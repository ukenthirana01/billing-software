// Reports Module — with PDF Export & Premium UI
export async function render() {
  const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const to = today();
  document.getElementById('page-content').innerHTML = `
    <div class="tabs">
      <div class="tab-item active" onclick="switchReportTab('sales',this)"><i class="bi bi-graph-up-arrow"></i> Sales Report</div>
      <div class="tab-item" onclick="switchReportTab('purchase',this)"><i class="bi bi-cart3"></i> Purchase Report</div>
      <div class="tab-item" onclick="switchReportTab('gst',this)"><i class="bi bi-bank"></i> GST Summary</div>
      <div class="tab-item" onclick="switchReportTab('customer',this)"><i class="bi bi-people-fill"></i> Customer Ledger</div>
      <div class="tab-item" onclick="switchReportTab('supplier',this)"><i class="bi bi-building"></i> Supplier Ledger</div>
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
      document.getElementById('r-entity').innerHTML = list.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    });
  } else if (tab==='supplier') {
    custWrap.style.display='block';
    api.suppliers.getAll().then(list=>{
      document.getElementById('r-entity').innerHTML = list.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
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
        <div class="stat-card brown"><div class="stat-icon">🧾</div><div class="stat-value">${count}</div><div class="stat-label">Total Invoices</div></div>
        <div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-value">${fmtCur(total)}</div><div class="stat-label">Total Sales</div></div>
        <div class="stat-card blue"><div class="stat-icon">🏛</div><div class="stat-value">${fmtCur(tax)}</div><div class="stat-label">Total GST Collected</div></div>
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
        <div class="stat-card brown"><div class="stat-icon">📦</div><div class="stat-value">${data.reduce((s,r)=>s+r.count,0)}</div><div class="stat-label">Total Bills</div></div>
        <div class="stat-card blue"><div class="stat-icon">💸</div><div class="stat-value">${fmtCur(total)}</div><div class="stat-label">Total Purchase</div></div>
      </div>
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Bills</th><th class="text-right">Purchase Amount</th></tr></thead>
        <tbody>${data.map(r=>`<tr><td>${r.date}</td><td><span class="badge badge-brown">${r.count}</span></td><td class="text-right font-semi">${fmtCur(r.total)}</td></tr>`).join('')||'<tr><td colspan="3" class="text-center text-muted" style="padding:32px">No data</td></tr>'}
        </tbody>
        <tfoot><tr style="background:var(--brown-50);font-weight:700"><td colspan="2">Total</td><td class="text-right">${fmtCur(total)}</td></tr></tfoot>
      </table></div></div>`;

  } else if (tab==='gst') {
    const {sales,purchase} = await api.reports.gstSummary({from,to});
    const outGst = (sales?.cgst||0)+(sales?.sgst||0);
    const inGst = (purchase?.cgst||0)+(purchase?.sgst||0);
    const netGst = outGst - inGst;
    area.innerHTML = `
      <div class="form-grid form-grid-2 mb-4">
        <div class="card"><div class="card-header"><span class="card-title">📤 GST Output (Sales)</span></div>
          <div class="card-body gst-box">
            <div class="gst-item"><div class="gst-item-label">CGST</div><div class="gst-item-value">${fmtCur(sales?.cgst)}</div></div>
            <div class="gst-item"><div class="gst-item-label">SGST</div><div class="gst-item-value">${fmtCur(sales?.sgst)}</div></div>
            <div class="gst-item" style="background:var(--brown-100)"><div class="gst-item-label">Total Output</div><div class="gst-item-value">${fmtCur(outGst)}</div></div>
          </div>
        </div>
        <div class="card"><div class="card-header"><span class="card-title">📥 GST Input (Purchase)</span></div>
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

  } else if (tab==='customer') {
    const entityId = document.getElementById('r-entity').value;
    if (!entityId) { area.innerHTML='<div class="empty-state"><div class="icon">👥</div><p>Select a customer to view ledger</p></div>'; return; }
    const data = await api.reports.customerLedger(parseInt(entityId));
    const total = data.reduce((s,r)=>s+r.total,0);
    area.innerHTML = `<div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Invoice No</th><th>Date</th><th class="text-right">Total</th><th class="text-right">GST</th><th>Mode</th></tr></thead>
      <tbody>${data.map(r=>`<tr><td><strong>${r.invoice_no}</strong></td><td>${r.date}</td><td class="text-right">${fmtCur(r.total)}</td><td class="text-right">${fmtCur(r.cgst+r.sgst)}</td><td><span class="badge badge-gray">${r.payment_mode}</span></td></tr>`).join('')||'<tr><td colspan="5" class="text-center text-muted" style="padding:32px">No transactions</td></tr>'}
      </tbody><tfoot><tr style="font-weight:700;background:var(--brown-50)"><td colspan="2">Total</td><td class="text-right">${fmtCur(total)}</td><td colspan="2"></td></tr></tfoot>
    </table></div></div>`;

  } else if (tab==='supplier') {
    const entityId = document.getElementById('r-entity').value;
    if (!entityId) { area.innerHTML='<div class="empty-state"><div class="icon">🏭</div><p>Select a supplier</p></div>'; return; }
    const data = await api.reports.supplierLedger(parseInt(entityId));
    const total = data.reduce((s,r)=>s+r.total,0);
    area.innerHTML = `<div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Bill No</th><th>Date</th><th class="text-right">Total</th><th class="text-right">GST</th></tr></thead>
      <tbody>${data.map(r=>`<tr><td><strong>${r.bill_no}</strong></td><td>${r.date}</td><td class="text-right">${fmtCur(r.total)}</td><td class="text-right">${fmtCur(r.cgst+r.sgst)}</td></tr>`).join('')||'<tr><td colspan="4" class="text-center text-muted" style="padding:32px">No transactions</td></tr>'}
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
  doc.setFillColor(45, 22, 0);
  doc.rect(0, 0, W, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text(co?.name || 'Relyce Book', 14, 14);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  if (co?.address) doc.text(co.address, 14, 20, { maxWidth: 120 });
  doc.text(`GST: ${co?.gst_no||'-'}`, 14, 27);

  // Report title (right side)
  const reportTitles = { sales:'SALES REPORT', purchase:'PURCHASE REPORT', gst:'GST SUMMARY', customer:'CUSTOMER LEDGER', supplier:'SUPPLIER LEDGER' };
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

    // Summary boxes
    doc.setFillColor(253,236,216); doc.roundedRect(14, startY, 55, 18, 2, 2, 'F');
    doc.setFillColor(209,250,229); doc.roundedRect(75, startY, 55, 18, 2, 2, 'F');
    doc.setFillColor(219,234,254); doc.roundedRect(136, startY, 60, 18, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.setTextColor(100,50,0);
    doc.text('Total Invoices', 16, startY+5); doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.text(`${count}`, 16, startY+14);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(0,80,40);
    doc.text('Total Sales', 77, startY+5); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text(fmtCur(total), 77, startY+14);
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(30,64,175);
    doc.text('Total GST', 138, startY+5); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.text(fmtCur(tax), 138, startY+14);
    doc.setTextColor(0,0,0);
    startY += 25;

    doc.autoTable({
      startY, head: [['Date','Invoices','Sales Amount','GST Collected']],
      body: data.map(r=>[r.date, r.count, fmtCur(r.total), fmtCur(r.tax)]),
      foot: [['Total', count, fmtCur(total), fmtCur(tax)]],
      theme: 'striped',
      headStyles: { fillColor:[45,22,0], textColor:255, fontSize:9, fontStyle:'bold' },
      footStyles: { fillColor:[253,236,216], textColor:[45,22,0], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 2:{halign:'right'}, 3:{halign:'right'} }
    });

  } else if (tab === 'purchase') {
    const data = await api.reports.purchaseSummary({from, to});
    const total = data.reduce((s,r)=>s+r.total,0);
    doc.autoTable({
      startY, head: [['Date','Bills','Purchase Amount']],
      body: data.map(r=>[r.date, r.count, fmtCur(r.total)]),
      foot: [['Total', data.reduce((s,r)=>s+r.count,0), fmtCur(total)]],
      theme: 'striped',
      headStyles: { fillColor:[45,22,0], textColor:255, fontSize:9 },
      footStyles: { fillColor:[253,236,216], textColor:[45,22,0], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 2:{halign:'right'} }
    });

  } else if (tab === 'gst') {
    const {sales, purchase} = await api.reports.gstSummary({from, to});
    const outGst = (sales?.cgst||0)+(sales?.sgst||0);
    const inGst = (purchase?.cgst||0)+(purchase?.sgst||0);
    doc.autoTable({
      startY,
      head: [['GST Type','CGST','SGST','Total']],
      body: [
        ['Output GST (Sales)', fmtCur(sales?.cgst), fmtCur(sales?.sgst), fmtCur(outGst)],
        ['Input GST (Purchase)', fmtCur(purchase?.cgst), fmtCur(purchase?.sgst), fmtCur(inGst)],
      ],
      foot: [['Net GST Payable', '', '', fmtCur(outGst - inGst)]],
      theme: 'striped',
      headStyles: { fillColor:[45,22,0], textColor:255, fontSize:9 },
      footStyles: { fillColor:[45,22,0], textColor:255, fontStyle:'bold', fontSize:10 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 1:{halign:'right'}, 2:{halign:'right'}, 3:{halign:'right',fontStyle:'bold'} }
    });

  } else if (tab === 'customer') {
    const entityId = document.getElementById('r-entity')?.value;
    if (!entityId) { toast('Select a customer first','error'); return; }
    const data = await api.reports.customerLedger(parseInt(entityId));
    const customerName = document.getElementById('r-entity').options[document.getElementById('r-entity').selectedIndex]?.text || '';
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(`Customer: ${customerName}`, 14, startY);
    startY += 8;
    doc.autoTable({
      startY, head: [['Invoice No','Date','Total Amount','GST','Payment Mode']],
      body: data.map(r=>[r.invoice_no, r.date, fmtCur(r.total), fmtCur(r.cgst+r.sgst), r.payment_mode]),
      foot: [['Total','', fmtCur(data.reduce((s,r)=>s+r.total,0)),'','']],
      theme: 'striped',
      headStyles: { fillColor:[45,22,0], textColor:255, fontSize:9 },
      footStyles: { fillColor:[253,236,216], textColor:[45,22,0], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 2:{halign:'right'}, 3:{halign:'right'} }
    });

  } else if (tab === 'supplier') {
    const entityId = document.getElementById('r-entity')?.value;
    if (!entityId) { toast('Select a supplier first','error'); return; }
    const data = await api.reports.supplierLedger(parseInt(entityId));
    const supplierName = document.getElementById('r-entity').options[document.getElementById('r-entity').selectedIndex]?.text || '';
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(`Supplier: ${supplierName}`, 14, startY);
    startY += 8;
    doc.autoTable({
      startY, head: [['Bill No','Date','Total Amount','GST']],
      body: data.map(r=>[r.bill_no, r.date, fmtCur(r.total), fmtCur(r.cgst+r.sgst)]),
      foot: [['Total','',fmtCur(data.reduce((s,r)=>s+r.total,0)),'']],
      theme: 'striped',
      headStyles: { fillColor:[45,22,0], textColor:255, fontSize:9 },
      footStyles: { fillColor:[253,236,216], textColor:[45,22,0], fontStyle:'bold', fontSize:9 },
      bodyStyles: { fontSize:9 },
      columnStyles: { 2:{halign:'right'}, 3:{halign:'right'} }
    });
  }

  // Footer line
  const pgH = doc.internal.pageSize.height;
  doc.setDrawColor(200,200,200);
  doc.line(14, pgH-16, W-14, pgH-16);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('Relyce Book — Report', 14, pgH-9);
  doc.text(`Page 1`, W-14, pgH-9, {align:'right'});

  const reportTitlesFile = { sales:'Sales', purchase:'Purchase', gst:'GST_Summary', customer:'Customer_Ledger', supplier:'Supplier_Ledger' };
  doc.save(`MS_${reportTitlesFile[tab]}_Report_${from}_to_${to}.pdf`);
  toast('Report PDF downloaded!');
};
